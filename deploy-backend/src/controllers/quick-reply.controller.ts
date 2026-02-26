import { Request, Response, NextFunction } from 'express';
import { quickReplyService } from '@/services/quick-reply.service';
import type {
  ListQuickRepliesQuery,
  CreateQuickReplyInput,
  UpdateQuickReplyBody,
} from '@/validators/quick-reply.validator';

/**
 * Listar quick replies do tenant
 */
export async function listQuickReplies(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const query = req.query as unknown as ListQuickRepliesQuery;
    const quickReplies = await quickReplyService.listQuickReplies(tenantId, query);

    res.json({ data: quickReplies });
  } catch (error) {
    next(error);
  }
}

/**
 * Buscar quick reply por ID
 */
export async function getQuickReplyById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const quickReply = await quickReplyService.getQuickReplyById(req.params.id, tenantId);
    res.json(quickReply);
  } catch (error) {
    next(error);
  }
}

/**
 * Criar quick reply
 */
export async function createQuickReply(
  req: Request<{}, {}, CreateQuickReplyInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const quickReply = await quickReplyService.createQuickReply(tenantId, req.body, req.user?.id);
    res.status(201).json(quickReply);
  } catch (error) {
    next(error);
  }
}

/**
 * Atualizar quick reply
 */
export async function updateQuickReply(
  req: Request<{ id: string }, {}, UpdateQuickReplyBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    const quickReply = await quickReplyService.updateQuickReply(req.params.id, tenantId, req.body);
    res.json(quickReply);
  } catch (error) {
    next(error);
  }
}

/**
 * Deletar quick reply
 */
export async function deleteQuickReply(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID nao encontrado' });
      return;
    }

    await quickReplyService.deleteQuickReply(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
