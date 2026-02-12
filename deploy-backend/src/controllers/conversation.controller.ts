import { Request, Response } from 'express';
import { conversationService } from '@/services/conversation.service';
import { auditLogService } from '@/services/audit-log.service';
import { NotFoundError, ForbiddenError, BadRequestError } from '@/utils/errors';
import logger from '@/config/logger';
import type {
  ListConversationsInput,
  UpdateConversationInput,
  AssignConversationInput,
  CreateConversationInput,
} from '@/validators/conversation.validator';

export class ConversationController {
  /**
   * GET /api/conversations
   */
  async list(req: Request, res: Response) {
    try {
      const params = req.query as unknown as ListConversationsInput;

      // Log de debug para verificar tenant
      logger.debug({
        tenantId: req.tenantId,
        tenant: req.tenant,
        user: req.user?.id,
        headers: {
          'x-tenant-slug': req.headers['x-tenant-slug'],
          'host': req.headers.host
        },
        query: req.query
      }, 'list conversations - Verificando tenant');

      if (!req.tenantId) {
        logger.warn({
          headers: {
            'x-tenant-slug': req.headers['x-tenant-slug'],
            'host': req.headers.host
          },
          query: req.query
        }, 'Tenant ID não encontrado em /api/conversations');

        return res.status(400).json({
          error: 'Tenant ID não encontrado',
          debug: process.env.NODE_ENV !== 'production' ? {
            headers: {
              'x-tenant-slug': req.headers['x-tenant-slug'],
              'host': req.headers.host
            },
            query: req.query,
            tip: 'Certifique-se de enviar o header X-Tenant-Slug com o slug do tenant'
          } : undefined
        });
      }

      const result = await conversationService.listConversations({
        tenantId: req.tenantId,
        userId: req.user?.id,
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
        req.user?.id,
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
          req.user?.id,
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

      auditLogService.log({
        tenantId: req.tenantId,
        userId: req.user?.id,
        action: 'ASSIGN_CONVERSATION',
        entity: 'Conversation',
        entityId: id,
        newData: { assignedToId: userId },
      });

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
   * POST /api/conversations/:id/unassign
   */
  async unassign(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const conversation = await conversationService.unassignConversation(id, req.tenantId);

      auditLogService.log({
        tenantId: req.tenantId,
        userId: req.user?.id,
        action: 'UNASSIGN_CONVERSATION',
        entity: 'Conversation',
        entityId: id,
      });

      return res.json(conversation);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao desatribuir conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao desatribuir conversa' });
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

      auditLogService.log({
        tenantId: req.tenantId,
        userId: req.user?.id,
        action: 'CLOSE_CONVERSATION',
        entity: 'Conversation',
        entityId: id,
      });

      return res.json(conversation);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao fechar conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao fechar conversa' });
    }
  }

  /**
   * POST /api/conversations
   * Criar nova conversa a partir de phoneNumber (para N8N)
   */
  async create(req: Request, res: Response) {
    try {
      const data = req.body as CreateConversationInput;

      if (!req.tenantId) {
        return res.status(400).json({
          error: 'Tenant ID não encontrado',
          hint: 'Certifique-se de enviar o header X-Tenant-Slug',
        });
      }

      const conversation = await conversationService.createFromPhone({
        tenantId: req.tenantId,
        contactPhoneNumber: data.contactPhoneNumber,
        status: data.status as any,
        source: data.source,
        priority: data.priority,
        metadata: data.metadata,
        assignedToId: data.assignedToId,
      });

      logger.info({
        conversationId: conversation.id,
        contactPhoneNumber: data.contactPhoneNumber,
        tenantId: req.tenantId,
        status: conversation.status,
        source: data.source,
      }, 'Conversation created via API');

      return res.status(201).json(conversation);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        tenantId: req.tenantId,
      }, 'Erro ao criar conversa');

      if (error instanceof BadRequestError) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao criar conversa' });
    }
  }

  /**
   * POST /api/conversations/:id/read
   * Marca todas as mensagens INBOUND como READ
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const result = await conversationService.markConversationAsRead(id, req.tenantId);

      return res.json(result);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao marcar conversa como lida');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao marcar conversa como lida' });
    }
  }

  /**
   * POST /api/conversations/:id/archive
   */
  async archive(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const conversation = await conversationService.archiveConversation(id, req.tenantId);

      return res.json(conversation);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao arquivar conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao arquivar conversa' });
    }
  }

  /**
   * DELETE /api/conversations/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const result = await conversationService.deleteConversation(id, req.tenantId);

      return res.json(result);
    } catch (error) {
      logger.error({ error, conversationId: req.params.id }, 'Erro ao excluir conversa');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao excluir conversa' });
    }
  }

  /**
   * GET /api/conversations/stats
   * Retorna estatísticas das conversas do tenant
   */
  async getStats(req: Request, res: Response) {
    try {
      // Log de debug para verificar tenant
      logger.debug({
        tenantId: req.tenantId,
        tenant: req.tenant,
        headers: {
          'x-tenant-slug': req.headers['x-tenant-slug'],
          'host': req.headers.host
        }
      }, 'getStats - Verificando tenant');

      if (!req.tenantId) {
        return res.status(400).json({
          error: 'Tenant ID não encontrado',
          debug: {
            headers: {
              'x-tenant-slug': req.headers['x-tenant-slug'],
              'host': req.headers.host
            },
            query: req.query
          }
        });
      }

      const stats = await conversationService.getConversationStats(
        req.tenantId,
        req.user?.id,
        req.user?.role
      );

      return res.json(stats);
    } catch (error) {
      logger.error({ error }, 'Erro ao buscar estatísticas de conversas');
      return res.status(500).json({ error: 'Erro interno ao buscar estatísticas' });
    }
  }
}

export const conversationController = new ConversationController();
