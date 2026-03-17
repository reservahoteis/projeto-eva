"""
Historical Feature Engineering

Extracts ML features directly from existing Message, Conversation, and Contact
tables — no dependency on ai_events table.

This allows training models immediately using 3+ months of production data
(42k+ messages, 2300+ conversations) without waiting for Event Bus accumulation.

Features are extracted at conversation-level granularity:
  - Message patterns (count, length, types, media usage)
  - Temporal patterns (hour, day, business hours, weekend)
  - Response time patterns (avg, p90 response time)
  - Contact history (total conversations, previous escalations)
  - Channel and hotel unit context

Target variable: was_escalated (iaLocked = true)
"""

from __future__ import annotations

import logging
from typing import Optional

import pandas as pd
from sqlalchemy import create_engine, text

from config import DATABASE_URL

logger = logging.getLogger(__name__)

# ============================================================
# SQL: Conversation-level features from Message + Conversation
# ============================================================

CONVERSATION_FEATURES_QUERY = text("""
WITH msg_stats AS (
    SELECT
        m."conversationId",
        COUNT(*)                                                    AS total_messages,
        COUNT(*) FILTER (WHERE m.direction = 'INBOUND')             AS inbound_count,
        COUNT(*) FILTER (WHERE m.direction = 'OUTBOUND')            AS outbound_count,
        AVG(LENGTH(m.content))                                      AS avg_content_length,
        MAX(LENGTH(m.content))                                      AS max_content_length,
        MIN(LENGTH(m.content))                                      AS min_content_length,
        STDDEV(LENGTH(m.content))                                   AS std_content_length,
        COUNT(DISTINCT m.type)                                      AS distinct_msg_types,
        BOOL_OR(m.type IN ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT')) AS has_media,
        COUNT(*) FILTER (WHERE m.type = 'IMAGE')                    AS image_count,
        COUNT(*) FILTER (WHERE m.type = 'AUDIO')                    AS audio_count,
        COUNT(*) FILTER (WHERE m.type = 'INTERACTIVE')              AS interactive_count,
        MIN(m.timestamp)                                            AS first_msg_at,
        MAX(m.timestamp)                                            AS last_msg_at,
        EXTRACT(EPOCH FROM MAX(m.timestamp) - MIN(m.timestamp)) / 60.0
                                                                    AS duration_minutes
    FROM messages m
    GROUP BY m."conversationId"
),

-- Response times: time between INBOUND and next OUTBOUND
response_pairs AS (
    SELECT
        m."conversationId",
        m.timestamp AS inbound_at,
        (
            SELECT MIN(m2.timestamp)
            FROM messages m2
            WHERE m2."conversationId" = m."conversationId"
              AND m2.direction = 'OUTBOUND'
              AND m2.timestamp > m.timestamp
        ) AS next_outbound_at
    FROM messages m
    WHERE m.direction = 'INBOUND'
),
response_times AS (
    SELECT
        "conversationId",
        AVG(EXTRACT(EPOCH FROM next_outbound_at - inbound_at))  AS avg_response_secs,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM next_outbound_at - inbound_at)
        )                                                        AS median_response_secs,
        PERCENTILE_CONT(0.9) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM next_outbound_at - inbound_at)
        )                                                        AS p90_response_secs,
        MIN(EXTRACT(EPOCH FROM next_outbound_at - inbound_at))  AS min_response_secs,
        MAX(EXTRACT(EPOCH FROM next_outbound_at - inbound_at))  AS max_response_secs
    FROM response_pairs
    WHERE next_outbound_at IS NOT NULL
    GROUP BY "conversationId"
)

SELECT
    c.id                                                AS conversation_id,
    c."tenantId"                                        AS tenant_id,

    -- Target variable
    c."iaLocked"                                        AS was_escalated,

    -- Channel & context
    c.channel::TEXT                                      AS channel,
    COALESCE(c."hotelUnit", 'unknown')                  AS hotel_unit,
    c.status::TEXT                                       AS conv_status,
    c."isOpportunity"                                   AS is_opportunity,

    -- Message volume
    COALESCE(ms.total_messages, 0)                      AS total_messages,
    COALESCE(ms.inbound_count, 0)                       AS inbound_count,
    COALESCE(ms.outbound_count, 0)                      AS outbound_count,
    CASE WHEN COALESCE(ms.total_messages, 0) > 0
         THEN ms.inbound_count::FLOAT / ms.total_messages
         ELSE 0 END                                     AS inbound_ratio,

    -- Content features
    COALESCE(ms.avg_content_length, 0)                  AS avg_content_length,
    COALESCE(ms.max_content_length, 0)                  AS max_content_length,
    COALESCE(ms.min_content_length, 0)                  AS min_content_length,
    COALESCE(ms.std_content_length, 0)                  AS std_content_length,
    COALESCE(ms.distinct_msg_types, 0)                  AS distinct_msg_types,
    COALESCE(ms.has_media, false)                        AS has_media,
    COALESCE(ms.image_count, 0)                         AS image_count,
    COALESCE(ms.audio_count, 0)                         AS audio_count,
    COALESCE(ms.interactive_count, 0)                   AS interactive_count,

    -- Temporal features
    EXTRACT(HOUR FROM ms.first_msg_at)                  AS first_msg_hour,
    EXTRACT(DOW FROM ms.first_msg_at)                   AS first_msg_dow,
    COALESCE(ms.duration_minutes, 0)                    AS duration_minutes,

    -- Response time features
    COALESCE(rt.avg_response_secs, 0)                   AS avg_response_secs,
    COALESCE(rt.median_response_secs, 0)                AS median_response_secs,
    COALESCE(rt.p90_response_secs, 0)                   AS p90_response_secs

FROM conversations c
LEFT JOIN msg_stats ms ON ms."conversationId" = c.id
LEFT JOIN response_times rt ON rt."conversationId" = c.id
WHERE COALESCE(ms.total_messages, 0) >= 2
ORDER BY c."createdAt" DESC
""")

# ============================================================
# SQL: Contact history (repeat visitor features)
# ============================================================

CONTACT_HISTORY_QUERY = text("""
SELECT
    conv.id                                             AS conversation_id,
    conv."contactId"                                    AS contact_id,
    -- Count ONLY conversations BEFORE the current one (no data leakage)
    (SELECT COUNT(*) FROM conversations c2
     WHERE c2."contactId" = conv."contactId"
       AND c2."createdAt" < conv."createdAt")           AS prior_conversations,
    (SELECT COUNT(*) FROM conversations c2
     WHERE c2."contactId" = conv."contactId"
       AND c2."iaLocked" = true
       AND c2."createdAt" < conv."createdAt")           AS prior_escalations,
    EXTRACT(DAY FROM conv."createdAt" - (
        SELECT MIN(c2."createdAt") FROM conversations c2
        WHERE c2."contactId" = conv."contactId"
    ))                                                  AS tenure_days,
    COALESCE((SELECT SUM(mc.cnt) FROM (
        SELECT COUNT(*) as cnt FROM messages m
        JOIN conversations c2 ON m."conversationId" = c2.id
        WHERE c2."contactId" = conv."contactId"
          AND c2."createdAt" < conv."createdAt"
        GROUP BY c2.id
    ) mc), 0)                                           AS prior_messages
FROM conversations conv
""")


# ============================================================
# Feature builder
# ============================================================

def build_conversation_dataset(
    tenant_id: Optional[str] = None,
) -> pd.DataFrame:
    """
    Build ML-ready dataset from existing Message/Conversation tables.

    Returns a DataFrame with one row per conversation, containing
    message patterns, temporal features, response times, and the
    target variable (was_escalated).
    """
    engine = create_engine(DATABASE_URL)

    logger.info("Extracting conversation features from production data...")
    df = pd.read_sql(CONVERSATION_FEATURES_QUERY, engine)
    logger.info(f"Loaded {len(df)} conversations with features")

    if tenant_id:
        df = df[df["tenant_id"] == tenant_id]
        logger.info(f"Filtered to tenant {tenant_id}: {len(df)} conversations")

    # --- Contact history enrichment (leak-free: only prior conversations) ---
    logger.info("Extracting contact history (excluding current conversation)...")
    contact_df = pd.read_sql(CONTACT_HISTORY_QUERY, engine)

    df = df.merge(
        contact_df[["conversation_id", "prior_conversations", "prior_escalations",
                     "tenure_days", "prior_messages"]],
        on="conversation_id",
        how="left",
    )

    engine.dispose()

    # --- Derived features ---
    df = _add_derived_features(df)

    # --- Encode categoricals ---
    df = _encode_categoricals(df)

    # --- Clean up ---
    drop_cols = ["conversation_id", "tenant_id", "conv_status"]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")

    # Cast target
    df["was_escalated"] = df["was_escalated"].astype(int)

    logger.info(
        f"Final dataset: {len(df)} rows, {len(df.columns)} features, "
        f"escalation rate: {df['was_escalated'].mean():.1%}"
    )

    return df


def _add_derived_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute derived features from raw extracted data."""

    # Business hours (UTC-3 Brazil: 8-20 local = 11-23 UTC)
    df["is_business_hours"] = df["first_msg_hour"].between(11, 23).astype(int)
    df["is_weekend"] = df["first_msg_dow"].isin([0, 6]).astype(int)

    # Message balance
    df["outbound_ratio"] = df["outbound_count"] / df["total_messages"].clip(lower=1)
    df["msg_balance"] = (df["inbound_count"] - df["outbound_count"]).abs()

    # Response time buckets
    df["slow_response"] = (df["avg_response_secs"] > 300).astype(int)  # > 5 min
    df["very_slow_response"] = (df["avg_response_secs"] > 900).astype(int)  # > 15 min

    # Contact is repeat visitor (based on PRIOR conversations only)
    df["is_repeat_visitor"] = (
        df["prior_conversations"].fillna(0) > 0
    ).astype(int)

    # Previous escalation history (PRIOR only — no leakage)
    df["has_previous_escalation"] = (
        df["prior_escalations"].fillna(0) > 0
    ).astype(int)

    # Long conversation flag
    df["is_long_conversation"] = (df["total_messages"] > 20).astype(int)

    # High media usage
    df["high_media"] = (df["image_count"] + df["audio_count"] > 2).astype(int)

    return df


def _encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    """One-hot encode categorical columns."""

    # Channel encoding
    if "channel" in df.columns:
        channel_dummies = pd.get_dummies(df["channel"], prefix="channel")
        df = pd.concat([df, channel_dummies], axis=1)
        df = df.drop(columns=["channel"])

    # Hotel unit encoding (top N + other)
    if "hotel_unit" in df.columns:
        top_units = df["hotel_unit"].value_counts().head(10).index
        df["hotel_unit_enc"] = df["hotel_unit"].where(
            df["hotel_unit"].isin(top_units), "other"
        )
        unit_dummies = pd.get_dummies(df["hotel_unit_enc"], prefix="unit")
        df = pd.concat([df, unit_dummies], axis=1)
        df = df.drop(columns=["hotel_unit", "hotel_unit_enc"])

    return df


def get_dataset_stats(df: pd.DataFrame) -> dict:
    """Return summary statistics for logging/validation."""
    return {
        "total_samples": len(df),
        "features": len(df.columns) - 1,  # exclude target
        "escalation_rate": float(df["was_escalated"].mean()),
        "escalated_count": int(df["was_escalated"].sum()),
        "not_escalated_count": int((1 - df["was_escalated"]).sum()),
        "missing_pct": float(df.isnull().mean().mean()),
    }
