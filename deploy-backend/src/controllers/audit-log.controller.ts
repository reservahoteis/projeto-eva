import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '@/services/audit-log.service';
import type { ListAuditLogsQuery } from '@/validators/audit-log.validator';

/**
 * Listar audit logs (paginado, com filtros)
 */
export async function listAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.role === 'SUPER_ADMIN' ? null : req.user!.tenantId;

    if (req.user!.role !== 'SUPER_ADMIN' && !tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const query = req.query as unknown as ListAuditLogsQuery;
    const result = await auditLogService.list(tenantId, query);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Buscar audit log por ID (com oldData/newData)
 */
export async function getAuditLogById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.role === 'SUPER_ADMIN' ? null : req.user!.tenantId;

    if (req.user!.role !== 'SUPER_ADMIN' && !tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const log = await auditLogService.getById(req.params.id, tenantId);

    res.json(log);
  } catch (error) {
    next(error);
  }
}
