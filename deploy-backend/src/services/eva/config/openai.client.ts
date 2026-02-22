// ============================================
// OpenAI Client Singleton
// ============================================

import OpenAI from 'openai';
import logger from '@/config/logger';

let client: OpenAI | null = null;

/**
 * Check at module load time if OPENAI_API_KEY is set.
 * Logs a visible warning so operators know EVA will not work.
 */
if (!process.env.OPENAI_API_KEY) {
  logger.warn('[EVA] OPENAI_API_KEY not set — EVA AI disabled. All Instagram messages will escalate to human.');
}

/**
 * Returns a singleton OpenAI client.
 * Lazy-initialized on first call so env vars are loaded.
 */
export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  client = new OpenAI({
    apiKey,
    timeout: 15_000,
    maxRetries: 1,
  });

  logger.info('[EVA] OpenAI client initialized');
  return client;
}

/**
 * Reset client for testing.
 */
export function resetOpenAIClient(): void {
  client = null;
}
