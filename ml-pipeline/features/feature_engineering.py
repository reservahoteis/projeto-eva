"""
ML Feature Engineering from AI Events

Extracts ML-ready features from the ai_events PostgreSQL table.
Designed to feed:
  1. Escalation probability classifier
  2. Intent classification quality model
  3. Booking conversion prediction
  4. Knowledge base coverage scorer

Data sources:
  - PostgreSQL ai_events table (batch training)
  - Redis feature store (real-time inference)

LGPD compliance:
  - Uses contact_id_hash (never raw phone)
  - Uses conversation_id (anonymizable)
  - No content extraction - only structural/behavioral features

Usage:
  from features.feature_engineering import build_training_dataset
  df = build_training_dataset(db_url, from_date, to_date)
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import sqlalchemy as sa
from sqlalchemy import create_engine


# ============================================
# DATABASE CONNECTION
# ============================================

def get_engine(database_url: Optional[str] = None) -> sa.Engine:
    url = database_url or os.getenv("DATABASE_URL", "postgresql://localhost/crm_dev")
    return create_engine(
        url,
        pool_size=5,
        max_overflow=2,
        pool_pre_ping=True,
    )


# ============================================
# FEATURE SET 1: SESSION-LEVEL FEATURES
# Grain: one row per AI processing session
# Target: was_escalated, had_booking
# ============================================

SESSION_FEATURES_QUERY = """
WITH session_events AS (
  SELECT
    session_id,
    tenant_id,
    tenant_slug_hash,
    contact_id_hash,
    channel,
    MIN(occurred_at)  AS session_start,
    MAX(occurred_at)  AS session_end,

    -- Message features
    COUNT(*) FILTER (WHERE event_type = 'message_received')    AS messages_received,
    MAX(CASE WHEN event_type = 'message_received'
      THEN (payload->>'contentLengthChars')::INT END)          AS max_message_length,
    MAX(CASE WHEN event_type = 'message_received'
      THEN (payload->>'wordCount')::INT END)                   AS max_word_count,
    BOOL_OR(
      event_type = 'message_received'
      AND (payload->>'isStructuredReply')::BOOLEAN = true
    )                                                          AS had_structured_reply,

    -- LLM features
    COUNT(*) FILTER (WHERE event_type = 'llm_called')          AS llm_calls,
    SUM(CASE WHEN event_type = 'llm_response'
      THEN (payload->>'promptTokens')::INT ELSE 0 END)         AS total_prompt_tokens,
    SUM(CASE WHEN event_type = 'llm_response'
      THEN (payload->>'completionTokens')::INT ELSE 0 END)     AS total_completion_tokens,
    AVG(CASE WHEN event_type = 'llm_response'
      THEN (payload->>'latencyMs')::FLOAT END)                 AS avg_llm_latency_ms,
    SUM(CASE WHEN event_type = 'llm_response'
      THEN (payload->>'estimatedCostUsd')::FLOAT ELSE 0 END)   AS total_cost_usd,

    -- Intent features
    MAX(CASE WHEN event_type = 'intent_classified'
      THEN payload->>'intent' END)                             AS primary_intent,
    AVG(CASE WHEN event_type = 'intent_classified'
      THEN (payload->>'confidence')::FLOAT END)                AS avg_intent_confidence,
    MIN(CASE WHEN event_type = 'intent_classified'
      THEN (payload->>'confidence')::FLOAT END)                AS min_intent_confidence,

    -- Knowledge base features
    COUNT(*) FILTER (WHERE event_type = 'knowledge_queried')   AS kb_queries,
    COUNT(*) FILTER (WHERE event_type = 'knowledge_not_found') AS kb_misses,
    AVG(CASE WHEN event_type = 'knowledge_queried'
      THEN (payload->>'topScore')::FLOAT END)                  AS avg_kb_score,

    -- Tool use
    COUNT(*) FILTER (WHERE event_type = 'tool_called')         AS tool_calls,
    COUNT(*) FILTER (
      WHERE event_type = 'tool_called'
      AND (payload->>'success')::BOOLEAN = false
    )                                                          AS tool_failures,

    -- Temporal features
    EXTRACT(HOUR FROM MIN(occurred_at))                        AS start_hour_utc,
    EXTRACT(DOW FROM MIN(occurred_at))                         AS start_dow,

    -- Target variables
    BOOL_OR(event_type = 'escalated_to_human')                 AS was_escalated,
    BOOL_OR(event_type = 'booking_confirmed')                   AS had_booking,
    BOOL_OR(event_type = 'satisfaction_received'
      AND payload->>'sentiment' = 'negative')                   AS had_negative_feedback
  FROM ai_events
  WHERE occurred_at >= :from_date
    AND occurred_at <= :to_date
    AND tenant_id != 'ANONYMIZED'
  GROUP BY session_id, tenant_id, tenant_slug_hash, contact_id_hash, channel
),
-- Derived features
session_features AS (
  SELECT
    *,
    -- KB hit rate (0 to 1, or NULL if no queries)
    CASE WHEN kb_queries > 0
      THEN (kb_queries - kb_misses)::FLOAT / kb_queries
      ELSE NULL END                                            AS kb_hit_rate,

    -- Session duration in seconds
    EXTRACT(EPOCH FROM (session_end - session_start))          AS session_duration_secs,

    -- Tool failure rate
    CASE WHEN tool_calls > 0
      THEN tool_failures::FLOAT / tool_calls
      ELSE 0 END                                               AS tool_failure_rate,

    -- Cost efficiency (cost per message received)
    CASE WHEN messages_received > 0
      THEN total_cost_usd / messages_received
      ELSE 0 END                                               AS cost_per_message
  FROM session_events
)
SELECT * FROM session_features
"""


# ============================================
# FEATURE SET 2: CONTACT-LEVEL FEATURES
# Grain: one row per contact (historical behavior)
# Used as context features in escalation prediction
# ============================================

CONTACT_HISTORY_QUERY = """
SELECT
  contact_id_hash,
  tenant_id,
  COUNT(DISTINCT session_id)                                   AS total_sessions,
  COUNT(*) FILTER (WHERE event_type = 'escalated_to_human')   AS total_escalations,
  COUNT(*) FILTER (WHERE event_type = 'booking_confirmed')     AS total_bookings,
  COUNT(*) FILTER (WHERE event_type = 'satisfaction_received'
    AND payload->>'sentiment' = 'negative')                    AS total_negative_feedback,
  AVG(CASE WHEN event_type = 'intent_classified'
    THEN (payload->>'confidence')::FLOAT END)                  AS historical_avg_confidence,
  MIN(occurred_at)                                             AS first_seen_at,
  MAX(occurred_at)                                             AS last_seen_at,
  -- Days since first contact (tenure)
  EXTRACT(DAY FROM NOW() - MIN(occurred_at))                   AS contact_tenure_days
FROM ai_events
WHERE occurred_at >= :from_date
  AND tenant_id != 'ANONYMIZED'
GROUP BY contact_id_hash, tenant_id
"""


# ============================================
# FEATURE SET 3: KNOWLEDGE BASE HEALTH
# Grain: one row per (collection, query_text)
# Used for KB gap prioritization
# ============================================

KB_HEALTH_QUERY = """
SELECT
  tenant_id,
  payload->>'collection'                                       AS collection,
  payload->>'hotelUnit'                                        AS hotel_unit,
  payload->>'queryText'                                        AS query_text,
  COUNT(*)                                                     AS miss_count,
  AVG((payload->>'bestScore')::FLOAT)                          AS avg_best_score,
  STDDEV((payload->>'bestScore')::FLOAT)                       AS stddev_best_score,
  MIN(occurred_at)                                             AS first_miss_at,
  MAX(occurred_at)                                             AS last_miss_at,
  -- Gap severity score: high miss count + low scores = critical gap
  (COUNT(*) * (1 - AVG((payload->>'bestScore')::FLOAT)))::FLOAT AS gap_severity
FROM ai_events
WHERE event_type = 'knowledge_not_found'
  AND occurred_at >= :from_date
  AND payload->>'queryText' IS NOT NULL
  AND tenant_id != 'ANONYMIZED'
GROUP BY tenant_id, payload->>'collection', payload->>'hotelUnit', payload->>'queryText'
ORDER BY gap_severity DESC
"""


# ============================================
# MAIN DATASET BUILDER
# ============================================

def build_training_dataset(
    from_date: datetime,
    to_date: datetime,
    database_url: Optional[str] = None,
    tenant_id: Optional[str] = None,  # None = all tenants (SUPER_ADMIN training)
) -> pd.DataFrame:
    """
    Build the ML training dataset from ai_events.

    Returns a DataFrame with session-level features.
    Each row = one AI processing session.
    Columns = features + target variables (was_escalated, had_booking).

    Parameters:
        from_date: Start of training window
        to_date: End of training window
        database_url: PostgreSQL connection string (falls back to DATABASE_URL env)
        tenant_id: Restrict to single tenant (None = cross-tenant, anonymized)

    Returns:
        pd.DataFrame with ML-ready features
    """
    engine = get_engine(database_url)

    params: dict = {"from_date": from_date, "to_date": to_date}
    query = SESSION_FEATURES_QUERY

    # Add tenant filter if specified
    if tenant_id:
        query = query.replace(
            "AND tenant_id != 'ANONYMIZED'",
            f"AND tenant_id = :tenant_id AND tenant_id != 'ANONYMIZED'"
        )
        params["tenant_id"] = tenant_id

    with engine.connect() as conn:
        df = pd.read_sql_query(sa.text(query), conn, params=params)

    # Post-processing
    df = _add_derived_features(df)
    df = _encode_categoricals(df)

    return df


def build_kb_gap_report(
    from_date: datetime,
    database_url: Optional[str] = None,
) -> pd.DataFrame:
    """Build knowledge base gap analysis report."""
    engine = get_engine(database_url)
    params = {"from_date": from_date}

    with engine.connect() as conn:
        df = pd.read_sql_query(sa.text(KB_HEALTH_QUERY), conn, params=params)

    return df


def build_contact_history(
    from_date: datetime,
    database_url: Optional[str] = None,
) -> pd.DataFrame:
    """Build contact-level behavioral history for context features."""
    engine = get_engine(database_url)
    params = {"from_date": from_date}

    with engine.connect() as conn:
        df = pd.read_sql_query(sa.text(CONTACT_HISTORY_QUERY), conn, params=params)

    return df


# ============================================
# FEATURE ENGINEERING HELPERS
# ============================================

def _add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features that require pandas operations."""
    # Avoid division by zero
    df["kb_miss_rate"] = df.apply(
        lambda r: r["kb_misses"] / r["kb_queries"] if r["kb_queries"] > 0 else 0,
        axis=1,
    )

    # Tokens per LLM call
    df["avg_tokens_per_call"] = df.apply(
        lambda r: (r["total_prompt_tokens"] + r["total_completion_tokens"]) / r["llm_calls"]
        if r["llm_calls"] > 0 else 0,
        axis=1,
    )

    # Is business hours (8-20 UTC-3 = 11-23 UTC)
    df["is_business_hours"] = df["start_hour_utc"].between(11, 23)

    # Is weekend
    df["is_weekend"] = df["start_dow"].isin([0, 6])

    # Confidence quality bucket
    df["confidence_bucket"] = pd.cut(
        df["avg_intent_confidence"].fillna(0),
        bins=[0, 0.4, 0.6, 0.8, 1.0],
        labels=["very_low", "low", "medium", "high"],
    )

    return df


def _encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    """One-hot encode categorical features for ML model input."""
    # Channel encoding
    channel_dummies = pd.get_dummies(df["channel"], prefix="channel")
    df = pd.concat([df, channel_dummies], axis=1)

    # Intent encoding (top-N intents, rest -> "other")
    top_intents = df["primary_intent"].value_counts().head(20).index.tolist()
    df["primary_intent_normalized"] = df["primary_intent"].where(
        df["primary_intent"].isin(top_intents), "other"
    )
    intent_dummies = pd.get_dummies(df["primary_intent_normalized"], prefix="intent")
    df = pd.concat([df, intent_dummies], axis=1)

    return df


# ============================================
# DATASET VALIDATION
# ============================================

def validate_dataset(df: pd.DataFrame) -> dict:
    """
    Validate the training dataset quality before model training.

    Returns a dict with validation results and warnings.
    """
    issues = []

    total = len(df)
    if total < 1000:
        issues.append(f"Small dataset: {total} samples (recommend >1000 for reliable training)")

    # Target imbalance check
    escalation_rate = df["was_escalated"].mean()
    if escalation_rate < 0.05:
        issues.append(f"Low escalation rate: {escalation_rate:.2%} (consider oversampling)")
    if escalation_rate > 0.50:
        issues.append(f"High escalation rate: {escalation_rate:.2%} (check data quality)")

    # Feature completeness
    missing_rates = df.isnull().mean()
    high_missing = missing_rates[missing_rates > 0.3]
    if not high_missing.empty:
        issues.append(f"High missing rates in: {high_missing.index.tolist()}")

    # PII check (should never have raw phones in hashed fields)
    if "contact_id_hash" in df.columns:
        # Hashed values should be 32 hex chars
        non_hash = df["contact_id_hash"].dropna().apply(
            lambda x: len(str(x)) != 32 and x != "ANONYMIZED"
        )
        if non_hash.any():
            issues.append("WARNING: contact_id_hash contains non-hashed values (potential PII leak)")

    return {
        "total_samples": total,
        "escalation_rate": escalation_rate,
        "booking_rate": df["had_booking"].mean(),
        "date_range": {
            "min": str(df["session_start"].min()),
            "max": str(df["session_end"].max()),
        },
        "issues": issues,
        "is_valid": len(issues) == 0,
    }
