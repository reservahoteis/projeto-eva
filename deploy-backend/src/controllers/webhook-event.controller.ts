import { Request, Response, NextFunction } from 'express';
import { webhookEventService } from '@/services/webhook-event.service';
import type { ListWebhookEventsQuery } from '@/validators/webhook-event.validator';

/**
 * Listar webhook events (paginado, com filtros)
 */
export async function listWebhookEvents(
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

    const query = req.query as unknown as ListWebhookEventsQuery;
    const result = await webhookEventService.list(tenantId, query);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Buscar webhook event por ID (com payload completo)
 */
export async function getWebhookEventById(
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

    const webhookEvent = await webhookEventService.getById(req.params.id, tenantId);

    res.json(webhookEvent);
  } catch (error) {
    next(error);
  }
}

/**
 * Replay (reprocessar) webhook event
 */
export async function replayWebhookEvent(
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

    const result = await webhookEventService.replay(req.params.id, tenantId);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Deletar webhook event
 */
export async function deleteWebhookEvent(
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

    await webhookEventService.delete(req.params.id, tenantId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
