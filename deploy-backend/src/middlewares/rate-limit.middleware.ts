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
  skip: (req) => false,
});

/**
 * Rate limiter para login (MUITO PERMISSIVO PARA DEBUG)
 * 100 tentativas por 15 minutos
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // AUMENTADO PARA 100 (antes: 5, depois: 20, agora: 100)
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
    return `${req.tenantId || 'global'}:${req.user?.userId || ip}`;
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
