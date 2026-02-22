/**
 * AI Metrics Service
 *
 * Queries the ai_events table to produce analytics for:
 * - Per-tenant performance dashboards
 * - Knowledge base gap identification
 * - Escalation pattern analysis
 * - LLM cost tracking
 * - Conversation funnel metrics
 *
 * All queries are tenant-isolated and optimized for the indexes created
 * in migration 011_ai_events.sql.
 *
 * Used by: /api/analytics/ai endpoint (future)
 * Used by: Python ML consumer as labeled training data reference
 */

import { prisma } from '@/config/database';
import type { AIEventType } from './ai-event.types';

// ============================================
// INTERFACES
// ============================================

export interface AIEventSummary {
  eventType: AIEventType;
  count: number;
  uniqueConversations: number;
  date: string;
}

export interface ConversationFunnelMetrics {
  totalConversations: number;
  aiOnlyResolved: number;
  escalatedToHuman: number;
  escalationRate: number; // percentage
  withBooking: number;
  bookingConversionRate: number; // percentage
  avgLLMCallsPerConversation: number;
  avgKBMissesPerConversation: number;
  avgKBHitRate: number; // percentage
}

export interface LLMCostSummary {
  provider: string;
  model: string;
  totalTokens: number;
  totalCostUsd: number;
  llmCalls: number;
  avgCostPerConversation: number;
  period: string;
}

export interface KBGapEntry {
  queryText: string;
  collection: string;
  hotelUnit: string | null;
  missCount: number;
  avgBestScore: number;
  lastSeenAt: string;
}

export interface EscalationPatternMetrics {
  reason: string;
  count: number;
  avgTurnsBeforeEscalation: number;
  mostCommonTriggerIntent: string | null;
  automaticVsManual: { automatic: number; manual: number };
}

export interface IntentAccuracyMetrics {
  intent: string;
  classificationCount: number;
  avgConfidence: number;
  lowConfidenceRate: number; // % below 0.6
  escalationRate: number; // % of sessions with this intent that escalated
}

export interface ResponseQualityMetrics {
  satisfactionScore: number | null;
  positiveRate: number;
  neutralRate: number;
  negativeRate: number;
  handledByAI: number;
  handledByHuman: number;
  handledByMixed: number;
}

// ============================================
// SERVICE
// ============================================

export class AIMetricsService {
  /**
   * Get event volume summary for a tenant over a date range.
   * Primary input for the frontend analytics dashboard.
   */
  async getEventSummary(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<AIEventSummary[]> {
    const results = await prisma.$queryRaw<
      Array<{
        event_type: string;
        event_count: bigint;
        unique_conversations: bigint;
        event_date: Date;
      }>
    >`
      SELECT
        event_type::TEXT,
        COUNT(*)::BIGINT                    AS event_count,
        COUNT(DISTINCT conversation_id)::BIGINT AS unique_conversations,
        DATE_TRUNC('day', occurred_at)      AS event_date
      FROM ai_events
      WHERE tenant_id = ${tenantId}
        AND occurred_at >= ${fromDate}
        AND occurred_at <= ${toDate}
      GROUP BY event_type, DATE_TRUNC('day', occurred_at)
      ORDER BY event_date DESC, event_count DESC
    `;

    return results.map((r) => ({
      eventType: r.event_type as AIEventType,
      count: Number(r.event_count),
      uniqueConversations: Number(r.unique_conversations),
      date: r.event_date.toISOString().split('T')[0] ?? '',
    }));
  }

  /**
   * Conversation funnel: how many conversations were resolved by AI vs escalated.
   * Key metric for measuring AI effectiveness.
   */
  async getConversationFunnel(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<ConversationFunnelMetrics> {
    const rows = await prisma.$queryRaw<
      Array<{
        total_conversations: bigint;
        escalated: bigint;
        with_booking: bigint;
        avg_llm_calls: number;
        avg_kb_queries: number;
        avg_kb_misses: number;
      }>
    >`
      WITH conversation_stats AS (
        SELECT
          conversation_id,
          BOOL_OR(event_type = 'escalated_to_human') AS was_escalated,
          BOOL_OR(event_type = 'booking_confirmed')  AS had_booking,
          COUNT(*) FILTER (WHERE event_type = 'llm_called')           AS llm_calls,
          COUNT(*) FILTER (WHERE event_type = 'knowledge_queried')    AS kb_queries,
          COUNT(*) FILTER (WHERE event_type = 'knowledge_not_found')  AS kb_misses
        FROM ai_events
        WHERE tenant_id = ${tenantId}
          AND occurred_at >= ${fromDate}
          AND occurred_at <= ${toDate}
        GROUP BY conversation_id
      )
      SELECT
        COUNT(*)::BIGINT            AS total_conversations,
        SUM(CASE WHEN was_escalated THEN 1 ELSE 0 END)::BIGINT AS escalated,
        SUM(CASE WHEN had_booking THEN 1 ELSE 0 END)::BIGINT   AS with_booking,
        AVG(llm_calls)::FLOAT       AS avg_llm_calls,
        AVG(kb_queries)::FLOAT      AS avg_kb_queries,
        AVG(kb_misses)::FLOAT       AS avg_kb_misses
      FROM conversation_stats
    `;

    const row = rows[0];
    if (!row) {
      return {
        totalConversations: 0,
        aiOnlyResolved: 0,
        escalatedToHuman: 0,
        escalationRate: 0,
        withBooking: 0,
        bookingConversionRate: 0,
        avgLLMCallsPerConversation: 0,
        avgKBMissesPerConversation: 0,
        avgKBHitRate: 0,
      };
    }

    const total = Number(row.total_conversations);
    const escalated = Number(row.escalated);
    const withBooking = Number(row.with_booking);
    const avgKBQueries = row.avg_kb_queries ?? 0;
    const avgKBMisses = row.avg_kb_misses ?? 0;
    const avgKBHitRate = avgKBQueries > 0
      ? ((avgKBQueries - avgKBMisses) / avgKBQueries) * 100
      : 0;

    return {
      totalConversations: total,
      aiOnlyResolved: total - escalated,
      escalatedToHuman: escalated,
      escalationRate: total > 0 ? (escalated / total) * 100 : 0,
      withBooking,
      bookingConversionRate: total > 0 ? (withBooking / total) * 100 : 0,
      avgLLMCallsPerConversation: row.avg_llm_calls ?? 0,
      avgKBMissesPerConversation: avgKBMisses,
      avgKBHitRate,
    };
  }

  /**
   * LLM cost breakdown by provider and model.
   * Used for budget allocation and provider switching decisions.
   */
  async getLLMCostSummary(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<LLMCostSummary[]> {
    const results = await prisma.$queryRaw<
      Array<{
        provider: string;
        model: string;
        total_tokens: bigint;
        total_cost_usd: number;
        llm_calls: bigint;
      }>
    >`
      SELECT
        payload->>'provider'                          AS provider,
        payload->>'model'                             AS model,
        SUM((payload->>'totalTokens')::NUMERIC)::BIGINT AS total_tokens,
        SUM((payload->>'estimatedCostUsd')::NUMERIC)  AS total_cost_usd,
        COUNT(*)::BIGINT                              AS llm_calls
      FROM ai_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'llm_response'
        AND occurred_at >= ${fromDate}
        AND occurred_at <= ${toDate}
        AND payload->>'provider' IS NOT NULL
      GROUP BY payload->>'provider', payload->>'model'
      ORDER BY total_cost_usd DESC
    `;

    const uniqueConversations = await this.countUniqueConversations(tenantId, fromDate, toDate);

    return results.map((r) => ({
      provider: r.provider,
      model: r.model,
      totalTokens: Number(r.total_tokens),
      totalCostUsd: r.total_cost_usd ?? 0,
      llmCalls: Number(r.llm_calls),
      avgCostPerConversation:
        uniqueConversations > 0 ? (r.total_cost_usd ?? 0) / uniqueConversations : 0,
      period: `${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`,
    }));
  }

  /**
   * Knowledge base gap analysis: queries that returned no good match.
   * The primary input for KB content improvement.
   */
  async getKBGaps(
    tenantId: string,
    fromDate: Date,
    limit: number = 50
  ): Promise<KBGapEntry[]> {
    const results = await prisma.$queryRaw<
      Array<{
        query_text: string;
        collection: string;
        hotel_unit: string | null;
        miss_count: bigint;
        avg_best_score: number;
        last_seen_at: Date;
      }>
    >`
      SELECT
        payload->>'queryText'                      AS query_text,
        payload->>'collection'                     AS collection,
        payload->>'hotelUnit'                      AS hotel_unit,
        COUNT(*)::BIGINT                           AS miss_count,
        AVG((payload->>'bestScore')::NUMERIC)      AS avg_best_score,
        MAX(occurred_at)                           AS last_seen_at
      FROM ai_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'knowledge_not_found'
        AND occurred_at >= ${fromDate}
        AND payload->>'queryText' IS NOT NULL
      GROUP BY payload->>'queryText', payload->>'collection', payload->>'hotelUnit'
      ORDER BY miss_count DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      queryText: r.query_text,
      collection: r.collection,
      hotelUnit: r.hotel_unit,
      missCount: Number(r.miss_count),
      avgBestScore: r.avg_best_score ?? 0,
      lastSeenAt: r.last_seen_at.toISOString(),
    }));
  }

  /**
   * Escalation pattern breakdown: why and when does the AI fail?
   */
  async getEscalationPatterns(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<EscalationPatternMetrics[]> {
    const results = await prisma.$queryRaw<
      Array<{
        reason: string;
        count: bigint;
        avg_turns: number;
        top_intent: string | null;
        automatic_count: bigint;
        manual_count: bigint;
      }>
    >`
      SELECT
        payload->>'reason'                                  AS reason,
        COUNT(*)::BIGINT                                    AS count,
        AVG((payload->>'turnsBeforeEscalation')::NUMERIC)  AS avg_turns,
        MODE() WITHIN GROUP (ORDER BY payload->>'triggerIntent') AS top_intent,
        COUNT(*) FILTER (WHERE (payload->>'isAutomatic')::BOOLEAN = true)::BIGINT  AS automatic_count,
        COUNT(*) FILTER (WHERE (payload->>'isAutomatic')::BOOLEAN = false)::BIGINT AS manual_count
      FROM ai_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'escalated_to_human'
        AND occurred_at >= ${fromDate}
        AND occurred_at <= ${toDate}
        AND payload->>'reason' IS NOT NULL
      GROUP BY payload->>'reason'
      ORDER BY count DESC
    `;

    return results.map((r) => ({
      reason: r.reason,
      count: Number(r.count),
      avgTurnsBeforeEscalation: r.avg_turns ?? 0,
      mostCommonTriggerIntent: r.top_intent,
      automaticVsManual: {
        automatic: Number(r.automatic_count),
        manual: Number(r.manual_count),
      },
    }));
  }

  /**
   * Intent classification accuracy and downstream performance.
   * Used to identify intents that need classifier improvement.
   */
  async getIntentAccuracy(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<IntentAccuracyMetrics[]> {
    const results = await prisma.$queryRaw<
      Array<{
        intent: string;
        classification_count: bigint;
        avg_confidence: number;
        low_confidence_count: bigint;
      }>
    >`
      SELECT
        payload->>'intent'                                   AS intent,
        COUNT(*)::BIGINT                                     AS classification_count,
        AVG((payload->>'confidence')::NUMERIC)               AS avg_confidence,
        COUNT(*) FILTER (
          WHERE (payload->>'confidence')::NUMERIC < 0.6
        )::BIGINT                                            AS low_confidence_count
      FROM ai_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'intent_classified'
        AND occurred_at >= ${fromDate}
        AND occurred_at <= ${toDate}
        AND payload->>'intent' IS NOT NULL
      GROUP BY payload->>'intent'
      ORDER BY classification_count DESC
    `;

    // For each intent, check what % of sessions that had this intent escalated
    const escalationRates = await this.getEscalationRateByIntent(tenantId, fromDate, toDate);

    return results.map((r) => ({
      intent: r.intent,
      classificationCount: Number(r.classification_count),
      avgConfidence: r.avg_confidence ?? 0,
      lowConfidenceRate:
        Number(r.classification_count) > 0
          ? (Number(r.low_confidence_count) / Number(r.classification_count)) * 100
          : 0,
      escalationRate: escalationRates.get(r.intent) ?? 0,
    }));
  }

  /**
   * Satisfaction and response quality metrics.
   */
  async getResponseQuality(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<ResponseQualityMetrics> {
    const results = await prisma.$queryRaw<
      Array<{
        avg_score: number | null;
        positive_count: bigint;
        neutral_count: bigint;
        negative_count: bigint;
        ai_only_count: bigint;
        human_only_count: bigint;
        mixed_count: bigint;
        total_count: bigint;
      }>
    >`
      SELECT
        AVG((payload->>'score')::NUMERIC)                    AS avg_score,
        COUNT(*) FILTER (WHERE payload->>'sentiment' = 'positive')::BIGINT AS positive_count,
        COUNT(*) FILTER (WHERE payload->>'sentiment' = 'neutral')::BIGINT  AS neutral_count,
        COUNT(*) FILTER (WHERE payload->>'sentiment' = 'negative')::BIGINT AS negative_count,
        COUNT(*) FILTER (WHERE payload->>'handledBy' = 'ai_only')::BIGINT    AS ai_only_count,
        COUNT(*) FILTER (WHERE payload->>'handledBy' = 'human_only')::BIGINT AS human_only_count,
        COUNT(*) FILTER (WHERE payload->>'handledBy' LIKE '%mixed%' OR payload->>'handledBy' = 'ai_then_human' OR payload->>'handledBy' = 'human_then_ai')::BIGINT AS mixed_count,
        COUNT(*)::BIGINT                                     AS total_count
      FROM ai_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'satisfaction_received'
        AND occurred_at >= ${fromDate}
        AND occurred_at <= ${toDate}
    `;

    const row = results[0];
    const total = Number(row?.total_count ?? 0);

    return {
      satisfactionScore: row?.avg_score ?? null,
      positiveRate: total > 0 && row ? (Number(row.positive_count) / total) * 100 : 0,
      neutralRate: total > 0 && row ? (Number(row.neutral_count) / total) * 100 : 0,
      negativeRate: total > 0 && row ? (Number(row.negative_count) / total) * 100 : 0,
      handledByAI: Number(row?.ai_only_count ?? 0),
      handledByHuman: Number(row?.human_only_count ?? 0),
      handledByMixed: Number(row?.mixed_count ?? 0),
    };
  }

  /**
   * Cross-tenant performance comparison (SUPER_ADMIN only).
   * Uses hashed tenant IDs so individual tenants are not identifiable.
   * Used for ML training to create performance benchmarks.
   */
  async getCrossTenantBenchmark(fromDate: Date, toDate: Date): Promise<
    Array<{
      tenantCohort: string; // plan size bucket, not the actual tenant
      avgEscalationRate: number;
      avgLLMCostUsd: number;
      avgBookingConversionRate: number;
      sampleSize: number;
    }>
  > {
    // Returns aggregated cohorts, not individual tenant data
    const results = await prisma.$queryRaw<
      Array<{
        tenant_cohort: string;
        avg_escalation_rate: number;
        avg_llm_cost: number;
        avg_booking_rate: number;
        sample_size: bigint;
      }>
    >`
      WITH tenant_funnel AS (
        SELECT
          tenant_slug_hash,
          COUNT(DISTINCT conversation_id)                                                     AS total_convs,
          COUNT(DISTINCT conversation_id) FILTER (WHERE event_type = 'escalated_to_human')   AS escalated_convs,
          SUM((payload->>'estimatedCostUsd')::NUMERIC) FILTER (WHERE event_type = 'llm_response') AS total_llm_cost,
          COUNT(DISTINCT conversation_id) FILTER (WHERE event_type = 'booking_confirmed')    AS booked_convs
        FROM ai_events
        WHERE occurred_at >= ${fromDate}
          AND occurred_at <= ${toDate}
        GROUP BY tenant_slug_hash
      ),
      -- Bucket tenants into cohorts by conversation volume (not by identity)
      tenant_cohorts AS (
        SELECT
          CASE
            WHEN total_convs < 100   THEN 'small'
            WHEN total_convs < 1000  THEN 'medium'
            WHEN total_convs < 10000 THEN 'large'
            ELSE 'enterprise'
          END AS cohort,
          CASE WHEN total_convs > 0 THEN escalated_convs::FLOAT / total_convs ELSE 0 END AS escalation_rate,
          total_llm_cost,
          CASE WHEN total_convs > 0 THEN booked_convs::FLOAT / total_convs ELSE 0 END AS booking_rate
        FROM tenant_funnel
      )
      SELECT
        cohort                        AS tenant_cohort,
        AVG(escalation_rate)          AS avg_escalation_rate,
        AVG(total_llm_cost)           AS avg_llm_cost,
        AVG(booking_rate)             AS avg_booking_rate,
        COUNT(*)::BIGINT              AS sample_size
      FROM tenant_cohorts
      GROUP BY cohort
    `;

    return results.map((r) => ({
      tenantCohort: r.tenant_cohort,
      avgEscalationRate: (r.avg_escalation_rate ?? 0) * 100,
      avgLLMCostUsd: r.avg_llm_cost ?? 0,
      avgBookingConversionRate: (r.avg_booking_rate ?? 0) * 100,
      sampleSize: Number(r.sample_size),
    }));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async countUniqueConversations(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<number> {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT conversation_id)::BIGINT AS count
      FROM ai_events
      WHERE tenant_id = ${tenantId}
        AND occurred_at >= ${fromDate}
        AND occurred_at <= ${toDate}
    `;
    return Number(result[0]?.count ?? 0);
  }

  private async getEscalationRateByIntent(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Map<string, number>> {
    const results = await prisma.$queryRaw<
      Array<{ intent: string; escalation_rate: number }>
    >`
      WITH sessions_with_intent AS (
        SELECT
          session_id,
          payload->>'intent' AS intent
        FROM ai_events
        WHERE tenant_id = ${tenantId}
          AND event_type = 'intent_classified'
          AND occurred_at >= ${fromDate}
          AND occurred_at <= ${toDate}
          AND payload->>'intent' IS NOT NULL
      ),
      sessions_escalated AS (
        SELECT DISTINCT session_id
        FROM ai_events
        WHERE tenant_id = ${tenantId}
          AND event_type = 'escalated_to_human'
          AND occurred_at >= ${fromDate}
          AND occurred_at <= ${toDate}
      )
      SELECT
        i.intent,
        COUNT(*) FILTER (WHERE e.session_id IS NOT NULL)::FLOAT / COUNT(*) AS escalation_rate
      FROM sessions_with_intent i
      LEFT JOIN sessions_escalated e ON i.session_id = e.session_id
      GROUP BY i.intent
    `;

    const map = new Map<string, number>();
    results.forEach((r) => {
      map.set(r.intent, (r.escalation_rate ?? 0) * 100);
    });
    return map;
  }
}

export const aiMetricsService = new AIMetricsService();
