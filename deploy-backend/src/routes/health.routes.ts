import { Router, Request, Response } from 'express';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import logger from '@/config/logger';
import { env } from '@/config/env';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded';
  api: 'ok';
  database: 'ok' | 'error';
  redis: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  nodeVersion: string;
  environment: string;
}

/**
 * GET /api/health
 *
 * Endpoint completo de health check para CI/CD
 * Verifica status de: API, Database (Prisma), Redis
 *
 * Retorna:
 * - 200 se tudo estiver saudável
 * - 503 se algum serviço estiver degradado
 */
router.get('/health', async (_req: Request, res: Response) => {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    api: 'ok',
    database: 'ok',
    redis: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    environment: env.NODE_ENV,
  };

  let isHealthy = true;

  // Verificar Database (Prisma)
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.error('Health check - Database error:', error);
    healthStatus.database = 'error';
    isHealthy = false;
  }

  // Verificar Redis
  try {
    await redis.ping();
  } catch (error) {
    logger.error('Health check - Redis error:', error);
    healthStatus.redis = 'error';
    isHealthy = false;
  }

  // Definir status geral
  if (!isHealthy) {
    healthStatus.status = 'degraded';
    return res.status(503).json(healthStatus);
  }

  return res.status(200).json(healthStatus);
});

export default router;
