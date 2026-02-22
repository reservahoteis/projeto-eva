// ============================================
// EVA Conversation Memory
// Redis sliding window (last N messages)
// ============================================

import { redis } from '@/config/redis';
import logger from '@/config/logger';
import { REDIS_PREFIX, EVA_CONFIG, N8N_LEGACY_REDIS } from '../config/eva.constants';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Builds the Redis key for a conversation's memory.
 */
function memoryKey(conversationId: string): string {
  return `${REDIS_PREFIX.EVA_MEMORY}${conversationId}`;
}

/**
 * Builds the Redis key for a conversation's selected unit.
 */
function unitKey(conversationId: string): string {
  return `${REDIS_PREFIX.EVA_UNIT}${conversationId}`;
}

/**
 * Retrieves conversation history from Redis.
 * Returns the last N messages as ChatMessage array (compatible with OpenAI).
 */
export async function getConversationHistory(
  conversationId: string,
  maxMessages: number = EVA_CONFIG.MEMORY_MAX_MESSAGES
): Promise<ChatMessage[]> {
  try {
    const key = memoryKey(conversationId);
    const raw = await redis.lrange(key, -maxMessages, -1);

    return raw.map((item) => {
      try {
        return JSON.parse(item) as ChatMessage;
      } catch {
        return { role: 'user' as const, content: item };
      }
    });
  } catch (err) {
    logger.warn(
      { conversationId, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to get history, returning empty'
    );
    return [];
  }
}

/**
 * Batch fetch: gets conversation history + selected unit in a SINGLE Redis pipeline.
 * Reduces 2 round-trips to 1 (~10-15ms saved per message).
 */
export async function getHistoryAndUnit(
  conversationId: string,
  maxMessages: number = EVA_CONFIG.MEMORY_MAX_MESSAGES
): Promise<{ history: ChatMessage[]; unit: string | null }> {
  try {
    const pipeline = redis.pipeline();
    pipeline.lrange(memoryKey(conversationId), -maxMessages, -1);
    pipeline.get(unitKey(conversationId));
    const results = await pipeline.exec();

    // Pipeline returns [[err, result], [err, result]]
    const historyRaw = (results?.[0]?.[1] as string[]) || [];
    const unitRaw = (results?.[1]?.[1] as string) || null;

    const history = historyRaw.map((item) => {
      try {
        return JSON.parse(item) as ChatMessage;
      } catch {
        return { role: 'user' as const, content: item };
      }
    });

    return { history, unit: unitRaw };
  } catch (err) {
    logger.warn(
      { conversationId, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to batch get history+unit, returning empty'
    );
    return { history: [], unit: null };
  }
}

/**
 * Adds a message and returns the updated history in a SINGLE pipeline + fetch.
 * Combines addMessage + getConversationHistory into 1 Redis pipeline.
 */
export async function addMessageAndGetHistory(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  maxMessages: number = EVA_CONFIG.MEMORY_MAX_MESSAGES
): Promise<ChatMessage[]> {
  try {
    const key = memoryKey(conversationId);
    const entry = JSON.stringify({ role, content });

    const pipeline = redis.pipeline();
    pipeline.rpush(key, entry);
    pipeline.ltrim(key, -maxMessages, -1);
    pipeline.expire(key, EVA_CONFIG.MEMORY_TTL_SECONDS);
    pipeline.lrange(key, -maxMessages, -1);
    const results = await pipeline.exec();

    const historyRaw = (results?.[3]?.[1] as string[]) || [];
    return historyRaw.map((item) => {
      try {
        return JSON.parse(item) as ChatMessage;
      } catch {
        return { role: 'user' as const, content: item };
      }
    });
  } catch (err) {
    logger.warn(
      { conversationId, role, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to add+get (non-critical)'
    );
    return [];
  }
}

/**
 * Adds a message to the conversation memory.
 * Trims to sliding window size and refreshes TTL.
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    const key = memoryKey(conversationId);
    const entry = JSON.stringify({ role, content });

    const pipeline = redis.pipeline();
    // Push to end of list
    pipeline.rpush(key, entry);
    // Trim to keep only last N messages
    pipeline.ltrim(key, -EVA_CONFIG.MEMORY_MAX_MESSAGES, -1);
    // Refresh TTL
    pipeline.expire(key, EVA_CONFIG.MEMORY_TTL_SECONDS);

    await pipeline.exec();
  } catch (err) {
    logger.warn(
      { conversationId, role, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to add message (non-critical)'
    );
  }
}

/**
 * Clears all memory for a conversation (chat history + selected unit).
 */
export async function clearMemory(conversationId: string): Promise<void> {
  try {
    await redis.del(memoryKey(conversationId), unitKey(conversationId));
    logger.info({ conversationId }, '[EVA MEMORY] Memory cleared (history + unit)');
  } catch (err) {
    logger.warn(
      { conversationId, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to clear memory'
    );
  }
}

/**
 * Full memory reset: clears EVA Redis keys + N8N legacy Redis keys + IA_SDR_CAMPOS row.
 * Replicates the exact behavior of the N8N ##memoria## workflow.
 *
 * @param conversationId - EVA conversation ID (for eva:memory/eva:unit keys)
 * @param senderId - Phone number or IGSID (for N8N legacy keys + DB cleanup)
 * @param kbClient - Prisma client with access to IA_SDR_CAMPOS table
 */
export async function clearAllMemory(
  conversationId: string,
  senderId: string,
  kbClient: { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number> }
): Promise<void> {
  // 1. Clear EVA Redis keys (memory + unit)
  await clearMemory(conversationId);

  // 2. Clear N8N legacy Redis keys (non-critical — may not exist)
  try {
    const legacyKeys = [
      `${senderId}${N8N_LEGACY_REDIS.SUFFIX_MEMORY}`,  // {phone}marcioHotel
      `${N8N_LEGACY_REDIS.PREFIX_ALT}${senderId}`,      // |MARCIO-{phone}
      senderId,                                           // {phone}
    ];
    const deleted = await redis.del(...legacyKeys);
    if (deleted > 0) {
      logger.info({ conversationId, senderId, deleted }, '[EVA MEMORY] N8N legacy Redis keys cleared');
    }
  } catch (err) {
    logger.warn(
      { conversationId, senderId, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to clear N8N legacy Redis keys (non-critical)'
    );
  }

  // 3. Delete lead from IA_SDR_CAMPOS (non-critical — may not exist)
  try {
    const deletedRows = await kbClient.$executeRawUnsafe(
      'DELETE FROM "IA_SDR_CAMPOS" WHERE "numero" = $1',
      senderId
    );
    if (deletedRows > 0) {
      logger.info({ conversationId, senderId, deletedRows }, '[EVA MEMORY] IA_SDR_CAMPOS lead deleted');
    }
  } catch (err) {
    logger.warn(
      { conversationId, senderId, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to delete from IA_SDR_CAMPOS (non-critical — table may not exist)'
    );
  }
}

/**
 * Persists the selected hotel unit for a conversation.
 * TTL matches memory TTL (24h).
 */
export async function setUnit(conversationId: string, unit: string): Promise<void> {
  try {
    const key = unitKey(conversationId);
    await redis.set(key, unit, 'EX', EVA_CONFIG.MEMORY_TTL_SECONDS);
  } catch (err) {
    logger.warn(
      { conversationId, unit, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to set unit (non-critical)'
    );
  }
}

/**
 * Retrieves the selected hotel unit for a conversation.
 */
export async function getUnit(conversationId: string): Promise<string | null> {
  try {
    return await redis.get(unitKey(conversationId));
  } catch (err) {
    logger.warn(
      { conversationId, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to get unit'
    );
    return null;
  }
}
