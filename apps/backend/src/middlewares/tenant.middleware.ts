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
  res: Response,
  next: NextFunction
) {
  try {
    const host = req.headers.host || '';
    logger.debug({ host }, 'Processing tenant from host');

    // Extrair subdomínio
    const parts = host.split('.');
    let subdomain: string;

    // Em desenvolvimento (localhost:3000), pode não ter subdomínio
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      // Aceitar localhost sem tenant (para super admin)
      // Ou permitir query param ?tenant=slug para testes
      subdomain = req.query.tenant as string || 'super-admin';
    } else {
      subdomain = parts[0] || '';
    }

    logger.debug({ subdomain }, 'Extracted subdomain');

    // Se é super-admin, não precisa de tenant
    if (subdomain === 'super-admin' || subdomain === 'admin') {
      req.tenantId = null;
      logger.debug('Super admin access - no tenant required');

      // Set async context
      return asyncStorage.run({ tenantId: null }, () => next());
    }

    // Buscar tenant pelo slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: subdomain },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
    });

    if (!tenant) {
      logger.warn({ subdomain }, 'Tenant not found');
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
export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    return next(new TenantNotFoundError());
  }
  next();
}

/**
 * Middleware para rotas que NÃO DEVEM ter tenant (super admin only)
 */
export function requireNoTenant(req: Request, res: Response, next: NextFunction) {
  if (req.tenantId !== null && req.tenantId !== undefined) {
    return res.status(403).json({
      error: 'This endpoint is only accessible by super admin',
    });
  }
  next();
}
