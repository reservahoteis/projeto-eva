/**
 * AI Event Bus - Non-blocking fire-and-forget emitter
 *
 * Architecture: In-process EventEmitter + Redis Streams dual-write
 *
 * Flow:
 *   AI processing code calls emit() -> returns immediately (non-blocking)
 *   Background: writes to Redis Stream AND batches to PostgreSQL
 *   Python ML consumer: reads from Redis Streams (real-time) or PostgreSQL (historical)
 *
 * Design decisions:
 * - Zero latency overhead on main message processing path
 * - Redis Stream provides at-least-once delivery to Python consumer
 * - PostgreSQL batch insert every 100 events OR 5 seconds (whichever comes first)
 * - All PII is hashed at emission point, never stored raw
 * - Tenant isolation enforced at type level
 */

import { EventEmitter } from 'node:events';
import { createHash, randomUUID } from 'crypto';
import { redis } from '@/config/redis';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import type { AIEvent, AIEventType, AIEventInsertRow } from './ai-event.types';

// ============================================
// CONSTANTS
// ============================================

const SCHEMA_VERSION = 1;
const REDIS_STREAM_KEY = 'ai_events:stream';
const REDIS_STREAM_MAX_LEN = 100_000; // ~100k events in stream before trimming
const BATCH_SIZE = 100; // Flush to Postgres after this many events
const BATCH_INTERVAL_MS = 5_000; // Or after 5 seconds
const RETENTION_DAYS_DEFAULT = 365; // 1 year LGPD-compliant retention
const RETENTION_DAYS_SENSITIVE = 90; // For events with higher sensitivity

// Salt for PII hashing - loaded from environment
// IMPORTANT: Changing the salt invalidates all existing hashes (no cross-reference possible)
const PII_HASH_SALT = process.env.AI_EVENT_PII_SALT ?? 'change-me-in-production';

// ============================================
// PII UTILITIES
// ============================================

/**
 * One-way hash for PII fields.
 * Uses SHA-256 with a per-deployment salt so:
 * - Same contact across events can be correlated within this deployment
 * - Cannot be reverse-engineered to obtain original PII
 * - Cannot be cross-referenced with another deployment (different salt)
 */
export function hashPII(value: string): string {
  return createHash('sha256')
    .update(PII_HASH_SALT + value)
    .digest('hex')
    .slice(0, 32); // 32 hex chars = 128 bits, sufficient for ML correlation
}

/**
 * Strips PII-like patterns from free text before storing in event payloads.
 * Applied to queryText fields in knowledge events.
 */
export function stripPIIFromText(text: string): string {
  return text
    // Phone numbers (Brazilian formats)
    .replace(/\b(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g, '[PHONE]')
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // CPF
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
    // Credit card patterns
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
    // Trim to reasonable length for storage
    .slice(0, 500);
}

// ============================================
// EVENT BUS
// ============================================

class AIEventBus extends EventEmitter {
  private buffer: AIEventInsertRow[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private totalEmitted = 0;
  private totalFailed = 0;

  constructor() {
    super();
    // High watermark for in-memory buffering
    this.setMaxListeners(50);
    this.startFlushTimer();

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Emit an AI event. This is ALWAYS non-blocking.
   *
   * Usage in worker:
   *   aiEventBus.emit('message_received', { tenantId, conversationId, ... })
   *
   * The caller never awaits this. Errors are swallowed and logged internally
   * so they NEVER propagate to the main processing pipeline.
   */
  emit(eventType: AIEventType, data: Omit<AIEvent, 'eventId' | 'occurredAt' | 'schemaVersion'>): boolean {
    // Fire-and-forget: call internal async method without await
    this.internalEmit(eventType, data).catch((err) => {
      this.totalFailed++;
      logger.warn(
        { err: err.message, eventType, tenantId: data.tenantId },
        'AIEventBus: failed to process event (non-critical)'
      );
    });

    return true; // Always return true (EventEmitter contract)
  }

  /**
   * Flush pending events to PostgreSQL immediately.
   * Call before graceful shutdown.
   */
  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.flushToPostgres();
    }
  }

  /**
   * Get current bus metrics for health checks
   */
  getMetrics() {
    return {
      bufferSize: this.buffer.length,
      totalEmitted: this.totalEmitted,
      totalFailed: this.totalFailed,
      isShuttingDown: this.isShuttingDown,
    };
  }

  // ============================================
  // INTERNAL PROCESSING
  // ============================================

  private async internalEmit(
    eventType: AIEventType,
    data: Omit<AIEvent, 'eventId' | 'occurredAt' | 'schemaVersion'>
  ): Promise<void> {
    const eventId = randomUUID();
    const occurredAt = new Date();

    // Calculate retention based on event sensitivity
    const retentionDays = this.getRetentionDays(eventType);
    const retainUntil = new Date(occurredAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);

    const row: AIEventInsertRow = {
      event_id: eventId,
      tenant_id: data.tenantId,
      tenant_slug_hash: hashPII(data.tenantId), // Hash tenant too for cross-tenant ML cohorts
      conversation_id: data.conversationId,
      message_id: data.messageId,
      event_type: eventType,
      channel: data.channel,
      contact_id_hash: data.contactIdHash,
      session_id: data.sessionId,
      occurred_at: occurredAt,
      schema_version: SCHEMA_VERSION,
      payload: (data as any).payload ?? {},
      retain_until: retainUntil,
    };

    // 1. Write to Redis Stream (real-time Python consumer)
    await this.writeToRedisStream(row);

    // 2. Buffer for batch Postgres insert
    this.buffer.push(row);
    this.totalEmitted++;

    // 3. Flush if buffer is full
    if (this.buffer.length >= BATCH_SIZE) {
      await this.flushToPostgres();
    }
  }

  /**
   * Write event to Redis Stream for real-time Python ML consumer.
   * Uses XADD with MAXLEN to auto-trim old entries.
   */
  private async writeToRedisStream(row: AIEventInsertRow): Promise<void> {
    try {
      await redis.xadd(
        REDIS_STREAM_KEY,
        'MAXLEN', '~', String(REDIS_STREAM_MAX_LEN), // Approximate trimming (faster)
        '*', // Auto-generate stream ID
        'event_id', row.event_id,
        'tenant_id', row.tenant_id,
        'event_type', row.event_type,
        'channel', row.channel,
        'conversation_id', row.conversation_id,
        'session_id', row.session_id,
        'occurred_at', row.occurred_at.toISOString(),
        'payload', JSON.stringify(row.payload),
        'schema_version', String(row.schema_version)
        // Note: contact_id_hash and tenant_slug_hash NOT sent to Redis stream
        // to minimize PII exposure in Redis memory
      );
    } catch (err) {
      // Redis failure is non-fatal - PostgreSQL is the source of truth
      logger.warn({ err, eventId: row.event_id }, 'AIEventBus: Redis stream write failed (events still buffered for PG)');
    }
  }

  /**
   * Batch insert buffered events into PostgreSQL.
   * Uses raw SQL for maximum performance (bypasses Prisma overhead on bulk inserts).
   */
  private async flushToPostgres(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length); // Take all buffered events

    try {
      // Build parameterized VALUES clause for batch insert
      // ai_events table has: event_id, tenant_id, tenant_slug_hash, conversation_id,
      // message_id, event_type, channel, contact_id_hash, session_id, occurred_at,
      // schema_version, payload, retain_until
      const values: unknown[] = [];
      const placeholders = batch.map((row, i) => {
        const base = i * 13;
        values.push(
          row.event_id,
          row.tenant_id,
          row.tenant_slug_hash,
          row.conversation_id,
          row.message_id,
          row.event_type,
          row.channel,
          row.contact_id_hash,
          row.session_id,
          row.occurred_at,
          row.schema_version,
          JSON.stringify(row.payload),
          row.retain_until
        );
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12}::jsonb,$${base + 13})`;
      });

      await prisma.$executeRawUnsafe(
        `INSERT INTO ai_events (
          event_id, tenant_id, tenant_slug_hash, conversation_id,
          message_id, event_type, channel, contact_id_hash,
          session_id, occurred_at, schema_version, payload, retain_until
        ) VALUES ${placeholders.join(',')}
        ON CONFLICT (event_id) DO NOTHING`,
        ...values
      );

      logger.debug(
        { batchSize: batch.length },
        'AIEventBus: flushed events to PostgreSQL'
      );
    } catch (err) {
      // Put events back in buffer for retry on next flush
      this.buffer.unshift(...batch);
      logger.error(
        { err, batchSize: batch.length },
        'AIEventBus: PostgreSQL flush failed, events re-buffered'
      );
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.buffer.length > 0) {
        await this.flushToPostgres().catch((err) => {
          logger.error({ err }, 'AIEventBus: timer-triggered flush failed');
        });
      }
    }, BATCH_INTERVAL_MS);

    // Allow Node.js process to exit even if timer is active
    this.flushTimer.unref();
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    logger.info({ bufferSize: this.buffer.length }, 'AIEventBus: shutting down, flushing remaining events');
    await this.flush();
    logger.info('AIEventBus: shutdown complete');
  }

  /**
   * Determines event-specific retention period.
   * LGPD Art. 16: data must be deleted after the purpose is fulfilled.
   * Events with content inference have shorter retention.
   */
  private getRetentionDays(eventType: AIEventType): number {
    // Events that could indirectly reveal user preferences
    const sensitiveEvents: AIEventType[] = [
      'knowledge_queried',
      'knowledge_not_found',
      'intent_classified',
    ];

    if (sensitiveEvents.includes(eventType)) {
      return RETENTION_DAYS_SENSITIVE;
    }

    return RETENTION_DAYS_DEFAULT;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

/**
 * Global singleton event bus.
 * Import and use directly in workers and services:
 *
 *   import { aiEventBus } from '@/events/ai-event-bus';
 *   aiEventBus.emit('message_received', { ... });
 */
export const aiEventBus = new AIEventBus();

// ============================================
// CONVENIENCE EMITTER FUNCTIONS
// ============================================
// Typed wrappers to make emission ergonomic at call sites.
// Each function handles sessionId generation and channel forwarding.

export function emitMessageReceived(params: {
  tenantId: string;
  conversationId: string;
  messageId: string;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  contactIdHash: string;
  sessionId: string;
  tenantSlugHash: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'button_reply' | 'list_reply';
  contentLengthChars: number;
  wordCount: number;
  isNewConversation: boolean;
  isStructuredReply: boolean;
}): void {
  const now = new Date();
  aiEventBus.emit('message_received', {
    tenantId: params.tenantId,
    tenantSlugHash: params.tenantSlugHash,
    conversationId: params.conversationId,
    messageId: params.messageId,
    channel: params.channel,
    contactIdHash: params.contactIdHash,
    sessionId: params.sessionId,
    payload: {
      messageType: params.messageType,
      contentLengthChars: params.contentLengthChars,
      wordCount: params.wordCount,
      isNewConversation: params.isNewConversation,
      hourOfDay: now.getUTCHours(),
      dayOfWeek: now.getUTCDay(),
      isStructuredReply: params.isStructuredReply,
    },
  } as any);
}

export function emitLLMCall(params: {
  tenantId: string;
  tenantSlugHash: string;
  conversationId: string;
  messageId: string | null;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  contactIdHash: string;
  sessionId: string;
  provider: 'openai' | 'anthropic' | 'groq' | 'gemini' | 'other';
  model: string;
  promptTokens: number;
  hasKnowledgeContext: boolean;
  contextTurns: number;
  temperature: number;
}): void {
  aiEventBus.emit('llm_called', {
    tenantId: params.tenantId,
    tenantSlugHash: params.tenantSlugHash,
    conversationId: params.conversationId,
    messageId: params.messageId,
    channel: params.channel,
    contactIdHash: params.contactIdHash,
    sessionId: params.sessionId,
    payload: {
      provider: params.provider,
      model: params.model,
      promptTokens: params.promptTokens,
      hasKnowledgeContext: params.hasKnowledgeContext,
      contextTurns: params.contextTurns,
      temperature: params.temperature,
    },
  } as any);
}

export function emitEscalation(params: {
  tenantId: string;
  tenantSlugHash: string;
  conversationId: string;
  messageId: string | null;
  channel: 'whatsapp' | 'messenger' | 'instagram';
  contactIdHash: string;
  sessionId: string;
  reason: 'user_requested' | 'ai_unable' | 'complex_query' | 'complaint' | 'sales_opportunity' | 'urgency' | 'confidence_low' | 'other';
  turnsBeforeEscalation: number;
  triggerIntent: string | null;
  isAutomatic: boolean;
  hotelUnit: string | null;
}): void {
  aiEventBus.emit('escalated_to_human', {
    tenantId: params.tenantId,
    tenantSlugHash: params.tenantSlugHash,
    conversationId: params.conversationId,
    messageId: params.messageId,
    channel: params.channel,
    contactIdHash: params.contactIdHash,
    sessionId: params.sessionId,
    payload: {
      reason: params.reason,
      turnsBeforeEscalation: params.turnsBeforeEscalation,
      triggerIntent: params.triggerIntent,
      isAutomatic: params.isAutomatic,
      hotelUnit: params.hotelUnit,
    },
  } as any);
}
