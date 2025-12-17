import { Request, Response } from 'express';
import { escalationService } from '@/services/escalation.service';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import logger from '@/config/logger';
import type {
  CreateEscalationInput,
  ListEscalationsInput,
  UpdateEscalationInput,
} from '@/validators/escalation.validator';

export class EscalationController {
  /**
   * POST /api/escalations
   * Criar nova escalacao (chamado pelo N8N)
   */
  async create(req: Request, res: Response) {
    try {
      const data = req.body as CreateEscalationInput;

      if (!req.tenantId) {
        return res.status(400).json({
          error: 'Tenant ID nao encontrado',
          hint: 'Certifique-se de enviar o header X-Tenant-Slug',
        });
      }

      const result = await escalationService.createEscalation({
        tenantId: req.tenantId,
        contactPhoneNumber: data.contactPhoneNumber,
        reason: data.reason as any,
        reasonDetail: data.reasonDetail,
        hotelUnit: data.hotelUnit,
        messageHistory: data.messageHistory as Array<{
          role: 'user' | 'assistant' | 'system';
          content: string;
          timestamp?: string;
        }>,
        aiContext: data.aiContext,
        priority: data.priority as any,
      });

      logger.info({
        escalationId: result.escalation.id,
        conversationId: result.conversation.id,
        contactPhoneNumber: data.contactPhoneNumber,
        reason: data.reason,
        hotelUnit: data.hotelUnit,
        tenantId: req.tenantId,
      }, 'Escalation created via API');

      return res.status(201).json(result);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body,
        tenantId: req.tenantId,
      }, 'Erro ao criar escalacao');

      if (error instanceof BadRequestError) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao criar escalacao' });
    }
  }

  /**
   * GET /api/escalations
   * Listar escalacoes
   */
  async list(req: Request, res: Response) {
    try {
      const params = req.query as unknown as ListEscalationsInput;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID nao encontrado' });
      }

      const result = await escalationService.listEscalations({
        tenantId: req.tenantId,
        userId: req.user?.id,
        userRole: req.user?.role,
        ...params,
      });

      return res.json(result);
    } catch (error) {
      logger.error({ error }, 'Erro ao listar escalacoes');
      return res.status(500).json({ error: 'Erro interno ao listar escalacoes' });
    }
  }

  /**
   * GET /api/escalations/stats
   * Estatisticas de escalacoes
   */
  async getStats(req: Request, res: Response) {
    try {
      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID nao encontrado' });
      }

      const stats = await escalationService.getEscalationStats(req.tenantId);
      return res.json(stats);
    } catch (error) {
      logger.error({ error }, 'Erro ao buscar estatisticas de escalacoes');
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  /**
   * GET /api/escalations/:id
   * Buscar escalacao por ID
   */
  async getById(req: Request, res: Response) {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({ error: 'ID da escalação não fornecido' });
      }

      const userTenantId = req.tenantId;
      if (!userTenantId) {
        return res.status(400).json({ error: 'Tenant ID nao encontrado' });
      }

      // Type narrowing garantido pela validação acima
      const tenantId: string = userTenantId;
      const escalation = await escalationService.getEscalationById(id, tenantId);
      return res.json(escalation);
    } catch (error) {
      logger.error({ error, escalationId: req.params.id }, 'Erro ao buscar escalacao');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  /**
   * PATCH /api/escalations/:id
   * Atualizar status da escalacao
   */
  async update(req: Request, res: Response) {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({ error: 'ID da escalação não fornecido' });
      }

      const data = req.body as UpdateEscalationInput;
      const userTenantId = req.tenantId;

      if (!userTenantId) {
        return res.status(400).json({ error: 'Tenant ID nao encontrado' });
      }

      // Type narrowing garantido pela validação acima
      const tenantId: string = userTenantId;

      if (!data.status) {
        return res.status(400).json({ error: 'Status e obrigatorio' });
      }

      const updated = await escalationService.updateEscalationStatus(
        id,
        tenantId,
        data.status,
        req.user?.id
      );

      return res.json(updated);
    } catch (error) {
      logger.error({ error, escalationId: req.params.id }, 'Erro ao atualizar escalacao');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  /**
   * GET /api/escalations/check-ia-lock
   * Verificar se IA esta travada para um telefone
   * (Chamado pelo N8N antes de responder)
   */
  async checkIaLock(req: Request, res: Response) {
    try {
      const { phoneNumber } = req.query;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID nao encontrado' });
      }

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ error: 'phoneNumber query parameter e obrigatorio' });
      }

      const result = await escalationService.isIaLockedByPhone(req.tenantId, phoneNumber);
      return res.json(result);
    } catch (error) {
      logger.error({ error }, 'Erro ao verificar IA lock');
      return res.status(500).json({ error: 'Erro interno' });
    }
  }
}

export const escalationController = new EscalationController();
