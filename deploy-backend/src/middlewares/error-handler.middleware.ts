import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import logger from '@/config/logger';
import { isProd } from '@/config/env';

/**
 * Global Error Handler Middleware
 * Deve ser registrado por último no app.use()
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Se já respondeu, passar para o Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Log do erro
  logger.error({
    err,
    url: req.url,
    method: req.method,
    tenantId: req.tenantId,
    userId: req.user?.id,
  });

  // AppError (nossos erros customizados)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(isProd ? {} : { stack: err.stack }),
    });
  }

  // Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Prisma Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Resource already exists',
        field: (err.meta?.target as string[])?.join(', '),
      });
    }

    // Foreign key constraint failed
    if (err.code === 'P2003') {
      return res.status(400).json({
        error: 'Invalid reference',
      });
    }

    // Record not found
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Resource not found',
      });
    }
  }

  // JWT Errors (não capturados pelo auth middleware)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
    });
  }

  // Default: Internal Server Error
  res.status(500).json({
    error: isProd ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

/**
 * 404 Not Found Handler
 * Para rotas que não existem
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
}
