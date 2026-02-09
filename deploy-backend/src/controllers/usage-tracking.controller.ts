import { Request, Response, NextFunction } from 'express';
import { usageTrackingService } from '@/services/usage-tracking.service';
import type { ListUsageTrackingQuery } from '@/validators/usage-tracking.validator';

/**
 * Listar uso do tenant (paginado)
 */
export async function listUsage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const query = req.query as unknown as ListUsageTrackingQuery;
    const result = await usageTrackingService.listUsage(tenantId, query);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Metricas do mes atual
 */
export async function getCurrentUsage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const usage = await usageTrackingService.getCurrentMonth(tenantId);

    res.json(usage);
  } catch (error) {
    next(error);
  }
}
