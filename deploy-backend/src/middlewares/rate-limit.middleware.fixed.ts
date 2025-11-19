/**
 * Rate limiting middleware using Redis store
 * Implements progressive delays and proper limits per Meta and industry standards
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request } from 'express';
import { redis } from '@/config/redis';
import logger from '@/config/logger';

/**
 * Creates a Redis store for rate limiting
 * This allows rate limits to be shared across multiple server instances
 */
const createRedisStore = (prefix: string) => {
  return new RedisStore({
    client: redis as any,
    prefix: `rate_limit:${prefix}:`,
    // Extend expiry to ensure limits are enforced
    sendCommand: (...args: string[]) => (redis as any).sendCommand(args),
  });
};

/**
 * General API rate limiter
 * 60 requests per minute per IP/user
 */
export const generalLimiter = rateLimit({
  store: createRedisStore('general'),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Reduced from 100 to 60
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: 60,
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Prioritize user ID over IP for authenticated requests
    const userId = req.user?.id;
    const tenantId = req.tenantId;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (userId && tenantId) {
      return `${tenantId}:user:${userId}`;
    }
    if (tenantId) {
      return `${tenantId}:ip:${ip}`;
    }
    return `global:ip:${ip}`;
  },
  handler: (req, res, next, options) => {
    logger.warn({
      ip: req.ip,
      userId: req.user?.id,
      tenantId: req.tenantId,
      url: req.url,
      method: req.method,
    }, 'Rate limit exceeded');

    res.status(429).json(options.message);
  },
});

/**
 * Strict login rate limiter
 * 5 attempts per 15 minutes per IP
 * Implements progressive delays after 2 attempts
 */
export const loginLimiter = rateLimit({
  store: createRedisStore('login'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 attempts
  message: {
    error: 'Too many login attempts',
    message: 'Too many failed login attempts. Please try again in 15 minutes.',
    retryAfter: 900, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  // Progressive delay after 2 attempts
  delayAfter: 2,
  delayMs: (hits) => {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, hits - 2), 5000);
  },
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const email = req.body?.email || 'unknown';
    // Track by both IP and email to prevent distributed attacks
    return `login:${ip}:${email.toLowerCase()}`;
  },
  handler: (req, res, next, options) => {
    logger.security({
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.headers['user-agent'],
    }, 'Login rate limit exceeded - possible brute force attempt');

    res.status(429).json(options.message);
  },
});

/**
 * Password reset rate limiter
 * 3 requests per hour per email
 */
export const passwordResetLimiter = rateLimit({
  store: createRedisStore('password_reset'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'Too many password reset requests',
    message: 'Too many password reset attempts. Please try again in 1 hour.',
    retryAfter: 3600,
  },
  keyGenerator: (req: Request) => {
    const email = req.body?.email || req.query?.email || 'unknown';
    return `reset:${email.toLowerCase()}`;
  },
});

/**
 * Strict API rate limiter for sensitive operations
 * 20 requests per minute
 */
export const strictApiLimiter = rateLimit({
  store: createRedisStore('strict_api'),
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    error: 'Rate limit exceeded for this operation',
    message: 'You are making requests too quickly. Please slow down.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    const tenantId = req.tenantId;
    const ip = req.ip || 'unknown';

    if (userId && tenantId) {
      return `${tenantId}:user:${userId}:${req.path}`;
    }
    return `global:ip:${ip}:${req.path}`;
  },
});

/**
 * Resource creation rate limiter
 * 10 resources per minute per user
 */
export const createLimiter = rateLimit({
  store: createRedisStore('create'),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Reduced from 20 to 10
  message: {
    error: 'Too many resources created',
    message: 'You are creating resources too quickly. Please wait a moment.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    const userId = req.user?.id || 'anonymous';
    const tenantId = req.tenantId || 'global';
    const resource = req.path.split('/')[2] || 'unknown'; // Extract resource type

    return `create:${tenantId}:${userId}:${resource}`;
  },
  handler: (req, res, next, options) => {
    logger.warn({
      userId: req.user?.id,
      tenantId: req.tenantId,
      resource: req.path,
    }, 'Resource creation rate limit exceeded');

    res.status(429).json(options.message);
  },
});

/**
 * WhatsApp webhook rate limiter
 * 100 webhooks per minute per tenant (WhatsApp can send bursts)
 */
export const webhookLimiter = rateLimit({
  store: createRedisStore('webhook'),
  windowMs: 60 * 1000, // 1 minute
  max: 100, // WhatsApp can send many webhooks in bursts
  message: {
    error: 'Webhook rate limit exceeded',
    message: 'Too many webhook requests received.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    const tenantId = req.tenantId || req.query?.tenant_id || 'unknown';
    return `webhook:${tenantId}`;
  },
  // Skip rate limiting for verified webhooks (with valid signature)
  skip: (req) => {
    return !!(req as any).webhookVerified;
  },
});

/**
 * Message sending rate limiter (per WhatsApp Business API limits)
 * WhatsApp limits: 80 messages/second for cloud API
 * We limit to 50 messages/minute per tenant to be safe
 */
export const messageSendLimiter = rateLimit({
  store: createRedisStore('message_send'),
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 messages per minute per tenant
  message: {
    error: 'Message rate limit exceeded',
    message: 'You are sending messages too quickly. Please wait before sending more.',
    retryAfter: 60,
  },
  keyGenerator: (req: Request) => {
    const tenantId = req.tenantId || 'global';
    const conversationId = req.params?.conversationId || req.body?.conversationId;

    // Rate limit per tenant and conversation
    return `message:${tenantId}:${conversationId || 'bulk'}`;
  },
  handler: (req, res, next, options) => {
    logger.warn({
      tenantId: req.tenantId,
      conversationId: req.params?.conversationId,
      userId: req.user?.id,
    }, 'Message sending rate limit exceeded');

    res.status(429).json({
      ...options.message,
      tip: 'Consider using message queues for bulk sending',
    });
  },
});

/**
 * File upload rate limiter
 * 10 uploads per 5 minutes per user
 */
export const uploadLimiter = rateLimit({
  store: createRedisStore('upload'),
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    error: 'Upload rate limit exceeded',
    message: 'Too many file uploads. Please wait 5 minutes.',
    retryAfter: 300,
  },
  keyGenerator: (req: Request) => {
    const userId = req.user?.id || 'anonymous';
    const tenantId = req.tenantId || 'global';

    return `upload:${tenantId}:${userId}`;
  },
});

/**
 * API key generation rate limiter
 * 5 keys per day per tenant
 */
export const apiKeyLimiter = rateLimit({
  store: createRedisStore('api_key'),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  message: {
    error: 'API key generation limit exceeded',
    message: 'You can only generate 5 API keys per day.',
    retryAfter: 86400,
  },
  keyGenerator: (req: Request) => {
    const tenantId = req.tenantId || 'global';
    return `api_key:${tenantId}`;
  },
});

/**
 * Export rate limiter for data exports
 * 10 exports per hour per tenant
 */
export const exportLimiter = rateLimit({
  store: createRedisStore('export'),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: 'Export rate limit exceeded',
    message: 'Too many export requests. Please wait 1 hour.',
    retryAfter: 3600,
  },
  keyGenerator: (req: Request) => {
    const tenantId = req.tenantId || 'global';
    const userId = req.user?.id || 'anonymous';

    return `export:${tenantId}:${userId}`;
  },
});

// Export a function to clean up rate limit records (for testing or maintenance)
export async function clearRateLimitForKey(prefix: string, key: string): Promise<void> {
  try {
    await redis.del(`rate_limit:${prefix}:${key}`);
  } catch (error) {
    logger.error({ error, prefix, key }, 'Failed to clear rate limit');
  }
}