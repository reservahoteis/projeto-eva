import { Request, Response, NextFunction } from 'express';
import { reportService } from '@/services/report.service';
import type { ReportQuery } from '@/validators/report.validator';

/**
 * GET /api/reports/overview
 * Retorna overview com metricas gerais
 */
export async function getOverview(
  req: Request<{}, {}, {}, ReportQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { period = '30d' } = req.query;

    const result = await reportService.getOverview(tenantId, period);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/attendants
 * Retorna performance por atendente
 */
export async function getAttendantsPerformance(
  req: Request<{}, {}, {}, ReportQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { period = '30d' } = req.query;

    const result = await reportService.getAttendantsPerformance(tenantId, period);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/hourly
 * Retorna volume de mensagens por hora
 */
export async function getHourlyVolume(
  req: Request<{}, {}, {}, ReportQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { period = '30d' } = req.query;

    const result = await reportService.getHourlyVolume(tenantId, period);

    res.json(result);
  } catch (error) {
    next(error);
  }
}
