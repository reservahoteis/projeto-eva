import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/config/database';
import { TenantNotFoundError, TenantInactiveError } from '@/utils/errors';
import { asyncStorage } from '@/utils/async-storage';
import logger from '@/config/logger';

/**
 * MIDDLEWARE CRÍTICO: Tenant Isolation
 *
 * Extrai o tenant do subdomínio e valida se está ativo.
 * Define req.tenantId para uso em toda a aplicação.
 *
 * Exemplos:
 * - hotelcopacabana.seucrm.com → tenantId do "hotelcopacabana"
 * - super-admin.seucrm.com → tenantId = null (super admin)
 * - localhost:3000 → desenvolvimento (usar tenant demo ou nulo)
 */
export async function tenantIsolationMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    // Rotas públicas que não precisam REQUERER tenant (mas podem ter)
    const publicRoutes = ['/auth/login', '/auth/refresh', '/webhooks', '/health'];
    const isPublicRoute = publicRoutes.some((route) => req.path.startsWith(route));

    const host = req.headers.host || '';
    const tenantSlugHeader = req.headers['x-tenant-slug'] as string;

    logger.debug({ host, tenantSlugHeader, isPublicRoute }, 'Processing tenant');

    let tenantSlug: string | null = null;

    // PRIORIDADE 1: Header X-Tenant-Slug (para APIs sem subdomínio)
    if (tenantSlugHeader) {
      tenantSlug = tenantSlugHeader;
      logger.debug({ tenantSlug }, 'Tenant from header X-Tenant-Slug');
    }
    // PRIORIDADE 2: Subdomínio (para multi-tenant com subdomínios)
    else {
      const parts = host.split('.');

      // Em desenvolvimento (localhost:3000), pode não ter subdomínio
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        // Aceitar query param ?tenant=slug para testes
        const queryTenant = req.query.tenant as string | undefined;
        tenantSlug = queryTenant ? queryTenant : null;
      } else if (parts.length >= 3) {
        // api.botreserva.com.br ou hotel1.botreserva.com.br
        tenantSlug = parts[0] || null;
      } else {
        // botreserva.com.br (sem subdomínio) = sem tenant
        tenantSlug = null;
      }

      logger.debug({ tenantSlug, host }, 'Tenant from subdomain');
    }

    // Se não tem tenant slug, é acesso sem tenant (super-admin)
    if (!tenantSlug || tenantSlug === 'super-admin' || tenantSlug === 'admin' || tenantSlug === 'api' || tenantSlug === 'www') {
      req.tenantId = null as string | null;
      logger.debug('No tenant - super admin access');

      // Se é rota pública, permite continuar
      if (isPublicRoute) {
        return asyncStorage.run({ tenantId: null }, () => next());
      }

      // Se é rota protegida sem tenant, deixa os middlewares de auth decidirem
      return asyncStorage.run({ tenantId: null }, () => next());
    }

    // Buscar tenant pelo slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
    });

    if (!tenant) {
      logger.warn({ tenantSlug }, 'Tenant not found');

      // Se é rota pública, permite continuar sem tenant
      if (isPublicRoute) {
        req.tenantId = null;
        return asyncStorage.run({ tenantId: null }, () => next());
      }

      // Se é rota protegida, retorna erro
      throw new TenantNotFoundError();
    }

    // Verificar se tenant está ativo
    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      logger.warn({ tenant: tenant.slug, status: tenant.status }, 'Tenant inactive');
      throw new TenantInactiveError();
    }

    // Definir no request
    req.tenantId = tenant.id;
    req.tenant = tenant;

    logger.debug({ tenantId: tenant.id, slug: tenant.slug }, 'Tenant resolved');

    // Set async context para usar em queries Prisma
    return asyncStorage.run({ tenantId: tenant.id }, () => next());
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware para rotas que DEVEM ter tenant
 * Use depois do tenantIsolationMiddleware
 */
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) {
    return next(new TenantNotFoundError());
  }
  next();
}

/**
 * Middleware para rotas que NÃO DEVEM ter tenant (super admin only)
 */
export function requireNoTenant(req: Request, res: Response, next: NextFunction): void {
  if (req.tenantId !== null && req.tenantId !== undefined) {
    res.status(403).json({
      error: 'This endpoint is only accessible by super admin',
    });
    return;
  }
  next();
}
