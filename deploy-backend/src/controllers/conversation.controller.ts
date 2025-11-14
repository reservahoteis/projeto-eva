import { Request, Response } from 'express';
import { conversationService } from '@/services/conversation.service';
import { NotFoundError, ForbiddenError } from '@/utils/errors';
import logger from '@/config/logger';
import type {
  ListConversationsInput,
  UpdateConversationInput,
  AssignConversationInput,
} from '@/validators/conversation.validator';

export class ConversationController {
  /**
   * GET /api/conversations
   */
  async list(req: Request, res: Response) {
    try {
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

      return res.json(result);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar conversas');
      return res.status(500).json({ error: 'Erro interno ao listar conversas' });
    }
  }

  /**
   * GET /api/conversations/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const conversation = await conversationService.getConversationById(
        id,
        req.tenantId,
        req.user?.userId,
        req.user?.role
      );

      return res.json(conversation);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao buscar conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof ForbiddenError) {
        return res.status(403).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao buscar conversa' });
    }
  }

  /**
   * PATCH /api/conversations/:id
   */
  async update(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
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

      return res.json(updated);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao atualizar conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof ForbiddenError) {
        return res.status(403).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao atualizar conversa' });
    }
  }

  /**
   * POST /api/conversations/:id/assign
   */
  async assign(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { userId } = req.body as AssignConversationInput;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const conversation = await conversationService.assignConversation(id, req.tenantId, userId);

      return res.json(conversation);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao atribuir conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao atribuir conversa' });
    }
  }

  /**
   * POST /api/conversations/:id/close
   */
  async close(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const conversation = await conversationService.closeConversation(id, req.tenantId);

      return res.json(conversation);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao fechar conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao fechar conversa' });
    }
  }
}

export const conversationController = new ConversationController();
