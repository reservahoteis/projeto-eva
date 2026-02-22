// ============================================
// EVA Conversation Memory
// Redis sliding window (last N messages)
// ============================================

import { redis } from '@/config/redis';
import logger from '@/config/logger';
import { REDIS_PREFIX, EVA_CONFIG } from '../config/eva.constants';

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
 * Clears all memory for a conversation.
 */
export async function clearMemory(conversationId: string): Promise<void> {
  try {
    await redis.del(memoryKey(conversationId));
    logger.info({ conversationId }, '[EVA MEMORY] Memory cleared');
  } catch (err) {
    logger.warn(
      { conversationId, err: err instanceof Error ? err.message : 'Unknown' },
      '[EVA MEMORY] Failed to clear memory'
    );
  }
}
