import { Request, Response } from 'express';
import { conversationService } from '@/services/conversation.service';
import type { ListConversationsInput, UpdateConversationInput, AssignConversationInput } from '@/validators/conversation.validator';

export class ConversationController {
  /**
   * GET /api/conversations
   */
  async list(req: Request, res: Response) {
    const params = req.query as unknown as ListConversationsInput;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    const result = await conversationService.listConversations({
      tenantId: req.tenantId,
      userId: req.user?.userId,
      userRole: req.user?.role,
      ...params,
    });

    res.json(result);
  }

  /**
   * GET /api/conversations/:id
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    const conversation = await conversationService.getConversationById(
      id,
      req.tenantId,
      req.user?.userId,
      req.user?.role
    );

    res.json(conversation);
  }

  /**
   * PATCH /api/conversations/:id
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body as UpdateConversationInput;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    let updated;

    // Atualizar status se fornecido
    if (data.status) {
      updated = await conversationService.updateConversationStatus(
        id,
        req.tenantId,
        data.status,
        req.user?.userId,
        req.user?.role
      );
    }

    // Atualizar priority se fornecido
    if (data.priority) {
      updated = await conversationService.updatePriority(id, req.tenantId, data.priority);
    }

    // Atualizar tags se fornecido
    if (data.tagIds) {
      updated = await conversationService.updateTags(id, req.tenantId, data.tagIds);
    }

    // Atribuir se fornecido
    if (data.assignedToId) {
      updated = await conversationService.assignConversation(id, req.tenantId, data.assignedToId);
    }

    res.json(updated);
  }

  /**
   * POST /api/conversations/:id/assign
   */
  async assign(req: Request, res: Response) {
    const { id } = req.params;
    const { userId } = req.body as AssignConversationInput;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    const conversation = await conversationService.assignConversation(id, req.tenantId, userId);

    res.json(conversation);
  }

  /**
   * POST /api/conversations/:id/close
   */
  async close(req: Request, res: Response) {
    const { id } = req.params;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    const conversation = await conversationService.closeConversation(id, req.tenantId);

    res.json(conversation);
  }
}

export const conversationController = new ConversationController();
