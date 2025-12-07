import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * Rate limiter geral para API
 * 100 requests por minuto por IP
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${req.tenantId || 'global'}:${ip}`;
  },
  skip: () => false,
});

/**
 * Rate limiter para login - Protecao contra brute force
 * OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 * Limite: 5 tentativas por IP em 15 minutos
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // SECURITY FIX [SEC-001]: Reduzido de 100 para 5 tentativas para prevenir brute force
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `login:${ip}`;
  },
});

/**
 * Rate limiter para criação de recursos
 * 20 por minuto
 */
export const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many create requests',
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${req.tenantId || 'global'}:${req.user?.id || ip}`;
  },
});

/**
 * Rate limiter para webhooks (WhatsApp pode enviar muitos)
 * 1000 por minuto
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  message: 'Webhook rate limit exceeded',
  keyGenerator: (req: Request) => {
    return `webhook:${req.tenantId || 'global'}`;
  },
});
