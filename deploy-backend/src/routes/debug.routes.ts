import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { env } from '@/config/env';
import logger from '@/config/logger';

const router = Router();

/**
 * Rotas de debug - APENAS DESENVOLVIMENTO E SUPER_ADMIN
 * Estas rotas ajudam a debugar problemas com tenant, auth, etc.
 */

/**
 * Middleware: Bloqueia TODAS as rotas de debug em produção
 * A menos que seja SUPER_ADMIN autenticado
 */
function debugModeGuard(req: Request, res: Response, next: NextFunction) {
  // Em produção, apenas SUPER_ADMIN pode acessar
  if (env.NODE_ENV === 'production') {
    // Se não autenticado, bloqueia
    if (!req.user) {
      return res.status(404).json({ error: 'Not found' });
    }
    // Se não é SUPER_ADMIN, bloqueia
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ error: 'Not found' });
    }
  }
  next();
}

// Aplicar guarda em todas as rotas de debug
router.use(debugModeGuard);

// GET /api/debug/tenant-info
// Retorna informações sobre o tenant detectado no request
router.get('/tenant-info', (req: Request, res: Response) => {
  const info = {
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        host: req.headers.host,
        'x-tenant-slug': req.headers['x-tenant-slug'],
        authorization: req.headers.authorization ? 'Bearer [REDACTED]' : undefined,
        'content-type': req.headers['content-type'],
        origin: req.headers.origin,
        referer: req.headers.referer,
      },
    },
    tenant: {
      tenantId: req.tenantId || null,
      tenantSlug: req.tenant?.slug || null,
      tenantName: req.tenant?.name || null,
      tenantStatus: req.tenant?.status || null,
    },
    user: req.user
      ? {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
        }
      : null,
  };

  logger.debug(info, 'Debug tenant info requested');

  return res.json(info);
});

// GET /api/debug/auth-info
// Retorna informações sobre autenticação (com middleware auth)
router.get('/auth-info', authenticate, (req: Request, res: Response) => {
  const info = {
    authenticated: true,
    user: {
      id: req.user?.id,
      email: req.user?.email,
      name: req.user?.name,
      role: req.user?.role,
      tenantId: req.user?.tenantId,
    },
    tenant: {
      fromRequest: req.tenantId,
      fromUser: req.user?.tenantId,
      match: req.tenantId === req.user?.tenantId,
    },
    token: {
      hasAuthHeader: !!req.headers.authorization,
      type: req.headers.authorization?.split(' ')[0],
    },
  };

  return res.json(info);
});

// GET /api/debug/headers
// Retorna todos os headers recebidos (útil para debug de CORS, auth, etc)
router.get('/headers', (req: Request, res: Response) => {
  const headers = { ...req.headers };

  // Redact sensitive headers
  if (headers.authorization) {
    headers.authorization = 'Bearer [REDACTED]';
  }
  if (headers.cookie) {
    headers.cookie = '[REDACTED]';
  }

  return res.json({
    method: req.method,
    url: req.url,
    headers,
    ip: req.ip,
    ips: req.ips,
  });
});

// GET /api/debug/test-tenant/:slug
// Testa se um tenant existe e está ativo
router.get('/test-tenant/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const { prisma } = await import('@/config/database');

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            conversations: true,
            contacts: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({
        found: false,
        slug,
        message: 'Tenant não encontrado',
      });
    }

    return res.json({
      found: true,
      tenant: {
        ...tenant,
        isActive: tenant.status === 'ACTIVE' || tenant.status === 'TRIAL',
      },
    });
  } catch (error) {
    logger.error({ error, slug }, 'Erro ao testar tenant');
    return res.status(500).json({
      error: 'Erro ao buscar tenant',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;