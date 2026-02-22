-- ============================================================
-- Migration 011: AI Events Pipeline
-- Created: 2026-02-21
-- Purpose: Event sourcing table for ML pipeline integration
--
-- Design goals:
--   - Append-only log (never UPDATE, only INSERT and DELETE for retention)
--   - JSONB payload for schema evolution without migrations
--   - Partitioning-ready: partition by occurred_at month
--   - Indexed for Python ML consumer access patterns
--   - PII-free: contact data is hashed at application layer
--   - LGPD: retain_until column drives automated deletion
--
-- Performance targets:
--   - Write: >10k events/sec sustained (batch inserts)
--   - Read: <500ms for 30-day tenant aggregation query
--   - Storage: ~200 bytes/event -> 10M events/month = ~2GB
-- ============================================================

-- Idempotency guard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ai_events'
  ) THEN

    -- ========================================================
    -- ENUM: event types
    -- ========================================================
    CREATE TYPE ai_event_type AS ENUM (
      'message_received',
      'intent_classified',
      'knowledge_queried',
      'knowledge_not_found',
      'llm_called',
      'llm_response',
      'tool_called',
      'message_sent',
      'escalated_to_human',
      'human_took_over',
      'human_responded',
      'ia_reactivated',
      'followup_sent',
      'satisfaction_received',
      'booking_link_created',
      'booking_confirmed'
    );

    -- ========================================================
    -- MAIN TABLE
    -- ========================================================
    CREATE TABLE ai_events (
      -- Identity
      event_id          UUID          NOT NULL DEFAULT gen_random_uuid(),
      schema_version    SMALLINT      NOT NULL DEFAULT 1,

      -- Tenant isolation (MANDATORY - indexed first)
      tenant_id         TEXT          NOT NULL,
      -- Hashed tenant slug for cross-tenant ML cohort analysis
      tenant_slug_hash  TEXT          NOT NULL,

      -- Event classification
      event_type        ai_event_type NOT NULL,

      -- Conversation context
      conversation_id   TEXT          NOT NULL,
      -- Nullable: some events are not tied to a specific message
      message_id        TEXT,

      -- Channel
      channel           TEXT          NOT NULL CHECK (channel IN ('whatsapp', 'messenger', 'instagram')),

      -- PII-hashed contact identifier (SHA-256 of externalId + salt)
      -- Allows ML to track contact behavior without storing phone numbers
      contact_id_hash   TEXT          NOT NULL,

      -- Groups all events within a single AI processing chain
      session_id        TEXT          NOT NULL,

      -- Timing
      occurred_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

      -- Structured event data (ML features live here)
      -- Schema is versioned via schema_version column
      payload           JSONB         NOT NULL DEFAULT '{}',

      -- LGPD/GDPR: automated retention management
      -- Application sets this to NOW() + retention_days
      -- Cron job deletes WHERE retain_until < NOW()
      retain_until      TIMESTAMPTZ   NOT NULL,

      -- Primary key
      CONSTRAINT ai_events_pkey PRIMARY KEY (event_id)
    );

    RAISE NOTICE 'Table ai_events created';
  ELSE
    RAISE NOTICE 'Table ai_events already exists, skipping creation';
  END IF;
END $$;

-- ========================================================
-- INDEXES
-- Ordered by query frequency in Python ML consumer
-- ========================================================

-- 1. Most common query: tenant + time range (for per-tenant analytics)
CREATE INDEX IF NOT EXISTS idx_ai_events_tenant_time
  ON ai_events (tenant_id, occurred_at DESC);

-- 2. Conversation-level analysis (conversation flow reconstruction)
CREATE INDEX IF NOT EXISTS idx_ai_events_conversation
  ON ai_events (conversation_id, occurred_at ASC);

-- 3. Event type aggregation (funnel analysis)
CREATE INDEX IF NOT EXISTS idx_ai_events_type_time
  ON ai_events (event_type, occurred_at DESC);

-- 4. Session-level grouping (single AI chain analysis)
CREATE INDEX IF NOT EXISTS idx_ai_events_session
  ON ai_events (session_id, occurred_at ASC);

-- 5. Retention cleanup (LGPD compliance cron)
CREATE INDEX IF NOT EXISTS idx_ai_events_retain_until
  ON ai_events (retain_until)
  WHERE retain_until IS NOT NULL;

-- 6. Cross-tenant ML cohort (tenant_slug_hash without exposing tenant_id)
CREATE INDEX IF NOT EXISTS idx_ai_events_tenant_hash_type
  ON ai_events (tenant_slug_hash, event_type, occurred_at DESC);

-- 7. GIN index on payload for JSON queries (ML feature extraction)
-- Partial index only for events with meaningful payloads
CREATE INDEX IF NOT EXISTS idx_ai_events_payload_gin
  ON ai_events USING GIN (payload)
  WHERE event_type IN ('intent_classified', 'llm_response', 'booking_confirmed', 'satisfaction_received');

-- ========================================================
-- PARTITION PREPARATION (for future scaling >50M events/month)
-- ========================================================
-- NOTE: When volume requires it, convert to partitioned table:
--
-- CREATE TABLE ai_events_2026_03 PARTITION OF ai_events
--   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
--
-- Use pg_partman extension for automatic monthly partition management.
-- The current index structure is already partition-friendly.

-- ========================================================
-- VIEWS: Pre-computed for Python ML consumer
-- ========================================================

-- Daily event summary per tenant (used for billing + ML features)
CREATE OR REPLACE VIEW v_ai_events_daily_summary AS
SELECT
  tenant_id,
  event_type,
  channel,
  DATE_TRUNC('day', occurred_at) AS event_date,
  COUNT(*)                        AS event_count,
  COUNT(DISTINCT conversation_id) AS unique_conversations,
  COUNT(DISTINCT session_id)      AS unique_sessions
FROM ai_events
WHERE occurred_at >= NOW() - INTERVAL '90 days' -- Rolling 90-day window
GROUP BY tenant_id, event_type, channel, DATE_TRUNC('day', occurred_at);

COMMENT ON VIEW v_ai_events_daily_summary IS
  'Pre-aggregated daily AI event counts. Python ML consumer reads from this view for training data.';

-- Conversation funnel view (LLM efficiency analysis)
CREATE OR REPLACE VIEW v_ai_conversation_funnel AS
SELECT
  tenant_id,
  conversation_id,
  channel,
  MIN(occurred_at)                                            AS started_at,
  MAX(occurred_at)                                            AS last_event_at,
  COUNT(*) FILTER (WHERE event_type = 'message_received')     AS messages_received,
  COUNT(*) FILTER (WHERE event_type = 'llm_called')           AS llm_calls,
  COUNT(*) FILTER (WHERE event_type = 'knowledge_queried')    AS kb_queries,
  COUNT(*) FILTER (WHERE event_type = 'knowledge_not_found')  AS kb_misses,
  COUNT(*) FILTER (WHERE event_type = 'message_sent')         AS messages_sent,
  BOOL_OR(event_type = 'escalated_to_human')                  AS was_escalated,
  BOOL_OR(event_type = 'booking_confirmed')                   AS had_booking,
  BOOL_OR(event_type = 'satisfaction_received')               AS got_satisfaction
FROM ai_events
WHERE occurred_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, conversation_id, channel;

COMMENT ON VIEW v_ai_conversation_funnel IS
  'Per-conversation AI funnel metrics. Used for conversation flow ML analysis.';

-- LLM cost tracking view
CREATE OR REPLACE VIEW v_ai_llm_cost_daily AS
SELECT
  tenant_id,
  DATE_TRUNC('day', occurred_at) AS cost_date,
  payload->>'provider'           AS provider,
  payload->>'model'              AS model,
  SUM((payload->>'totalTokens')::NUMERIC)         AS total_tokens,
  SUM((payload->>'estimatedCostUsd')::NUMERIC)    AS total_cost_usd,
  COUNT(*)                                        AS llm_calls
FROM ai_events
WHERE event_type = 'llm_response'
  AND occurred_at >= NOW() - INTERVAL '90 days'
GROUP BY tenant_id, DATE_TRUNC('day', occurred_at), payload->>'provider', payload->>'model';

COMMENT ON VIEW v_ai_llm_cost_daily IS
  'Daily LLM cost tracking by provider and model. Used for billing and optimization.';

-- Knowledge base gap analysis view
CREATE OR REPLACE VIEW v_ai_kb_gaps AS
SELECT
  tenant_id,
  payload->>'queryText'          AS query_text,
  payload->>'collection'         AS collection,
  payload->>'hotelUnit'          AS hotel_unit,
  AVG((payload->>'bestScore')::NUMERIC) AS avg_best_score,
  COUNT(*)                              AS miss_count,
  MAX(occurred_at)                      AS last_seen_at
FROM ai_events
WHERE event_type = 'knowledge_not_found'
  AND occurred_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, payload->>'queryText', payload->>'collection', payload->>'hotelUnit'
ORDER BY miss_count DESC;

COMMENT ON VIEW v_ai_kb_gaps IS
  'Knowledge base coverage gaps ranked by frequency. Used to prioritize KB content creation.';

-- ========================================================
-- FUNCTIONS: LGPD Compliance
-- ========================================================

-- Anonymize a tenant's data (LGPD right to erasure)
CREATE OR REPLACE FUNCTION anonymize_tenant_ai_events(p_tenant_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Replace tenant_id with anonymized marker, zero out hashes
  UPDATE ai_events
  SET
    tenant_id        = 'ANONYMIZED',
    tenant_slug_hash = 'ANONYMIZED',
    contact_id_hash  = 'ANONYMIZED',
    conversation_id  = 'ANONYMIZED_' || event_id::TEXT,
    session_id       = 'ANONYMIZED',
    -- Purge payload fields that could identify the user
    payload          = payload - 'queryText' - 'triggerMessage'
  WHERE tenant_id = p_tenant_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION anonymize_tenant_ai_events IS
  'LGPD Art. 18 - Right to erasure: anonymizes all events for a tenant without deleting analytics value.';

-- Retention cleanup function (called by cron)
CREATE OR REPLACE FUNCTION purge_expired_ai_events()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM ai_events
  WHERE retain_until < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO audit_logs (action, entity, metadata, created_at)
  VALUES (
    'PURGE_EXPIRED_AI_EVENTS',
    'ai_events',
    jsonb_build_object('deleted_count', v_count, 'purged_at', NOW()),
    NOW()
  );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION purge_expired_ai_events IS
  'LGPD Art. 16 - Deletes events past their retain_until date. Run daily via pg_cron or external scheduler.';

-- ========================================================
-- COMMENTS (documentation baked into schema)
-- ========================================================

COMMENT ON TABLE ai_events IS
  'Append-only event log for all AI interactions. Feeds ML pipeline for quality improvement. '
  'PII-free by design: contact identifiers are SHA-256 hashed. '
  'LGPD: retain_until drives automated deletion via purge_expired_ai_events().';

COMMENT ON COLUMN ai_events.event_id IS 'UUID primary key. Idempotency key for deduplication on retry.';
COMMENT ON COLUMN ai_events.schema_version IS 'Payload schema version. Increment when payload structure changes.';
COMMENT ON COLUMN ai_events.tenant_id IS 'Multi-tenant isolation. NEVER query without this filter.';
COMMENT ON COLUMN ai_events.tenant_slug_hash IS 'SHA-256(salt+tenantId). Enables cross-tenant ML cohorts without exposing identity.';
COMMENT ON COLUMN ai_events.contact_id_hash IS 'SHA-256(salt+externalId). Tracks contact behavior without storing phone/PSID.';
COMMENT ON COLUMN ai_events.session_id IS 'Groups events in one AI processing chain. Stored in Redis TTL=10min.';
COMMENT ON COLUMN ai_events.payload IS 'JSONB event-specific data. ML features extracted from here.';
COMMENT ON COLUMN ai_events.retain_until IS 'LGPD retention deadline. purge_expired_ai_events() deletes rows past this date.';

-- ========================================================
-- Migration tracking (idempotent)
-- ========================================================
INSERT INTO _migrations_manual (migration_name, applied_at)
VALUES ('011_ai_events', NOW())
ON CONFLICT (migration_name) DO NOTHING;
