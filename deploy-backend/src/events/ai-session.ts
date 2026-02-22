/**
 * AI Session Manager
 *
 * Groups all events within a single AI processing chain under one sessionId.
 * A "session" starts when a message is received and ends when the AI response
 * is sent (or escalation happens).
 *
 * sessionId is stored in Redis with a short TTL so it can be shared between
 * the webhook worker and the N8N callback handler without coupling them.
 *
 * Key: ai_session:{conversationId}
 * TTL: 10 minutes (covers N8N processing time + retries)
 */

import { randomUUID } from 'crypto';
import { redis } from '@/config/redis';
import logger from '@/config/logger';

const SESSION_TTL_SECONDS = 600; // 10 minutes
const KEY_PREFIX = 'ai_session:';

/**
 * Start a new AI processing session for a conversation.
 * Called when a message is received in the worker.
 * Returns the sessionId that must be passed to all subsequent event emissions.
 */
export async function startAISession(conversationId: string): Promise<string> {
  const sessionId = randomUUID();

  try {
    await redis.setex(
      `${KEY_PREFIX}${conversationId}`,
      SESSION_TTL_SECONDS,
      sessionId
    );
  } catch (err) {
    // Non-critical - if Redis fails, we still return a valid sessionId
    // Events will just have a session that can't be correlated across Redis failure
    logger.warn({ err, conversationId }, 'AISession: failed to persist session to Redis');
  }

  return sessionId;
}

/**
 * Get the current session ID for a conversation.
 * Returns a new ephemeral ID if no session exists (e.g., for human-triggered events).
 */
export async function getOrCreateAISession(conversationId: string): Promise<string> {
  try {
    const existing = await redis.get(`${KEY_PREFIX}${conversationId}`);
    if (existing) return existing;
  } catch (err) {
    logger.debug({ err, conversationId }, 'AISession: Redis read failed, creating ephemeral session');
  }

  return randomUUID();
}

/**
 * End a session explicitly (optional - sessions auto-expire via TTL).
 * Call after message sent or escalation to prevent session reuse.
 */
export async function endAISession(conversationId: string): Promise<void> {
  try {
    await redis.del(`${KEY_PREFIX}${conversationId}`);
  } catch (err) {
    logger.debug({ err, conversationId }, 'AISession: failed to delete session key');
  }
}
