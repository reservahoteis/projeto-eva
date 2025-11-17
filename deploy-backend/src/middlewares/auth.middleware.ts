import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { UnauthorizedError, ForbiddenError } from '@/utils/errors';
import { Role } from '@prisma/client';
import logger from '@/config/logger';

interface JWTPayload {
  userId: string;
  role: Role;
  tenantId?: string | null;
}

/**
 * Middleware de autenticação JWT
 * Valida o token e adiciona user no request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Extrair token do header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token não fornecido');
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar e decodificar token
    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    // Buscar usuário no banco para ter todos os campos do User
    const user = await (await import('@/config/database')).prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    // Adicionar user completo no request
    req.user = user;

    logger.debug({ userId: payload.userId, role: payload.role }, 'User authenticated');

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError('Token inválido'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token expirado'));
    }
    next(error);
  }
}

/**
 * Middleware para verificar roles
 * @param allowedRoles - Array de roles permitidas
 *
 * @example
 * router.get('/admin', authenticate, authorize(['SUPER_ADMIN', 'TENANT_ADMIN']), handler)
 */
export function authorize(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Usuário não autenticado'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.id, role: req.user.role, allowedRoles },
        'Authorization failed'
      );
      return next(new ForbiddenError('Você não tem permissão para acessar este recurso'));
    }

    next();
  };
}

/**
 * Middleware para verificar se user pertence ao tenant correto
 * Use depois de authenticate e tenantIsolationMiddleware
 */
export function verifyTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new UnauthorizedError());
  }

  // Super admin tem acesso a todos os tenants
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Usuário deve pertencer ao mesmo tenant
  if (req.user.tenantId !== req.tenantId) {
    logger.warn(
      {
        userId: req.user.id,
        userTenantId: req.user.tenantId,
        requestTenantId: req.tenantId,
      },
      'Tenant access denied'
    );
    return next(new ForbiddenError('Acesso negado a este tenant'));
  }

  next();
}

/**
 * Middleware opcional de autenticação
 * Tenta autenticar, mas não falha se não tiver token
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continua sem user
    }

    const token = authHeader.substring(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    // Buscar usuário no banco
    const user = await (await import('@/config/database')).prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Ignora erros de JWT e continua
    next();
  }
}
