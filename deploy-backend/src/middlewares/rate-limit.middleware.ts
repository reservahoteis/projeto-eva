import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiting Configuration
 *
 * Configura limites de requisicao por tipo de endpoint seguindo OWASP guidelines.
 * Cada tipo de rota tem seu proprio limite baseado no caso de uso.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html
 */

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string | object;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

/**
 * Configuracoes de rate limit por tipo de endpoint
 */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  /**
   * Login - Protecao contra brute force
   * OWASP: 5 tentativas por 15 minutos
   */
  login: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again after 15 minutes',
    keyGenerator: (req: Request) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `login:${ip}`;
    },
    skipSuccessfulRequests: true,
  },

  /**
   * Webhooks - Alto volume do WhatsApp
   * Limite alto para nao perder mensagens
   */
  webhook: {
    windowMs: 60 * 1000,
    max: 1000,
    message: 'Webhook rate limit exceeded',
    keyGenerator: (req: Request) => {
      return `webhook:${req.tenantId || 'global'}`;
    },
  },

  /**
   * N8N Integration - Automacoes enviam muitas requisicoes
   * Carrosseis, fluxos paralelos, multiplos clientes simultaneos
   * Alta temporada (final de ano): volume muito maior de reservas
   * Limite generoso para nao bloquear automacoes legitimas em picos
   */
  n8n: {
    windowMs: 60 * 1000,
    max: 5000, // 5000 req/min por tenant - preparado para alta temporada
    message: {
      error: 'Rate limit exceeded',
      message: 'Too many N8N requests, please try again later',
      retryAfter: 60,
    },
    keyGenerator: (req: Request) => {
      const apiKey = req.headers['x-api-key'] as string || '';
      const tenantSlug = apiKey.split(':')[0] || 'unknown';
      return `n8n:${tenantSlug}`;
    },
  },

  /**
   * API Geral - Limite padrao
   */
  general: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
    keyGenerator: (req: Request) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `${req.tenantId || 'global'}:${ip}`;
    },
  },

  /**
   * Criacao de recursos - Limite moderado
   */
  create: {
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many create requests',
    keyGenerator: (req: Request) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `${req.tenantId || 'global'}:${req.user?.id || ip}`;
    },
  },
};

/**
 * Cache de rate limiters criados
 * Evita recriar limiters a cada requisicao
 */
const limiterCache = new Map<string, RateLimitRequestHandler>();

/**
 * Cria ou retorna um rate limiter do cache
 */
function getOrCreateLimiter(type: string): RateLimitRequestHandler {
  const cached = limiterCache.get(type);
  if (cached) {
    return cached;
  }

  const config = RATE_LIMIT_CONFIGS[type] ?? RATE_LIMIT_CONFIGS.general!;

  const limiter = rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: config.keyGenerator,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
  });

  limiterCache.set(type, limiter);
  return limiter;
}

/**
 * Determina o tipo de rate limit baseado na rota
 */
function getRouteType(path: string): string {
  if (path.startsWith('/auth/login') || path.startsWith('/auth/register')) {
    return 'login';
  }
  if (path.startsWith('/webhooks')) {
    return 'webhook';
  }
  if (path.startsWith('/api/n8n')) {
    return 'n8n';
  }
  if (path.includes('/create') || (path.endsWith('/') === false && path.split('/').length <= 3)) {
    // POST em rotas base geralmente sao criacao
    return 'general';
  }
  return 'general';
}

/**
 * Middleware inteligente de rate limiting
 *
 * Aplica o rate limiter apropriado baseado na rota da requisicao.
 * Rotas especificas (login, webhook, n8n) tem seus proprios limites.
 *
 * @example
 * // No server.ts, usar apenas este middleware:
 * app.use(smartRateLimiter);
 */
export function smartRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const routeType = getRouteType(req.path);
  const limiter = getOrCreateLimiter(routeType);
  limiter(req, res, next);
}

/**
 * Exporta limiters individuais para uso direto em rotas especificas
 * quando necessario maior controle
 */
export const generalLimiter = getOrCreateLimiter('general');
export const loginLimiter = getOrCreateLimiter('login');
export const webhookLimiter = getOrCreateLimiter('webhook');
export const n8nLimiter = getOrCreateLimiter('n8n');
export const createLimiter = getOrCreateLimiter('create');

/**
 * Factory para criar limiters customizados
 */
export function createCustomLimiter(config: Partial<RateLimitConfig>): RateLimitRequestHandler {
  const finalConfig = { ...RATE_LIMIT_CONFIGS.general, ...config };

  return rateLimit({
    windowMs: finalConfig.windowMs,
    max: finalConfig.max,
    message: finalConfig.message,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: finalConfig.keyGenerator,
    skipSuccessfulRequests: finalConfig.skipSuccessfulRequests || false,
  });
}
