// ============================================
// Prompt Injection Guard
// 3-layer defense: input validation, output sanitization
// ============================================

import logger from '@/config/logger';

/**
 * Patterns that indicate prompt injection attempts.
 * Tested against lowercase input.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // Direct instruction override
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
  /override\s+instructions/i,
  /new\s+instructions:/i,

  // Role play attacks
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(a|an)\s+/i,
  /pretend\s+(to\s+be|you('re| are))\s+/i,
  /from\s+now\s+on\s+you/i,
  /switch\s+to\s+/i,
  /enter\s+\w+\s+mode/i,

  // System prompt extraction
  /reveal\s+(your\s+)?system\s+prompt/i,
  /show\s+(me\s+)?(your\s+)?instructions/i,
  /what\s+are\s+your\s+instructions/i,
  /repeat\s+(your\s+)?system/i,
  /print\s+your\s+(system|prompt)/i,
  /output\s+your\s+(initial|system|first)/i,

  // Delimiter injection
  /\[system\]/i,
  /\[assistant\]/i,
  /\[user\]/i,
  /<\/?system>/i,
  /```system/i,
  /\bsystem:/i,

  // Jailbreak keywords
  /\bjailbreak\b/i,
  /\bdan\s+mode\b/i,
  /\bdo\s+anything\s+now\b/i,
  /\bdeveloper\s+mode\b/i,
];

/**
 * Detects prompt injection attempts in user input.
 * Returns true if injection detected.
 */
export function detectInjection(text: string): boolean {
  if (!text || text.length === 0) return false;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      logger.warn(
        { pattern: pattern.source, textPreview: text.substring(0, 100) },
        '[EVA GUARD] Prompt injection detected'
      );
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes AI output before sending to client.
 * Removes leaked system prompts, API keys, internal info.
 */
export function sanitizeOutput(text: string): string {
  let sanitized = text;

  // Remove potential API key leaks
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED]');

  // Remove potential system prompt leaks
  sanitized = sanitized.replace(/INSTRUCOES DE SEGURANCA[\s\S]*?(?=\n\n)/gi, '');
  sanitized = sanitized.replace(/system\s*prompt:[\s\S]*?(?=\n\n)/gi, '');

  // Remove markdown code blocks that might contain internal info
  sanitized = sanitized.replace(/```(?:json|typescript|javascript)?\s*\{[\s\S]*?"apiKey"[\s\S]*?```/gi, '[REDACTED]');

  return sanitized.trim();
}

/**
 * Strips PII-like patterns from text.
 * Caller controls length — this function only masks PII.
 */
export function stripPII(text: string): string {
  return text
    // Credit card (MUST come before phone to avoid partial match)
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
    // CPF (MUST come before phone to avoid partial match)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // Phone numbers (Brazilian formats)
    .replace(/\b(\+?55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g, '[PHONE]');
}
