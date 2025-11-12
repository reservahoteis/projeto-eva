import { Request, Response } from 'express';
import { messageServiceV2 } from '@/services/message.service.v2';
import { whatsAppServiceV2 } from '@/services/whatsapp.service.v2';
import { WhatsAppApiError, WhatsAppErrorCode } from '@/services/whatsapp.service.v2';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import type { SendMessageInput, ListMessagesInput } from '@/validators/message.validator';
import logger from '@/config/logger';
import { prisma } from '@/config/database';

export class MessageController {
  /**
   * GET /api/conversations/:conversationId/messages
   */
  async list(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const params = req.query as unknown as ListMessagesInput;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const result = await messageServiceV2.listMessages(conversationId, req.tenantId, params);

      res.json(result);
    } catch (error) {
      logger.error({ error, conversationId: req.params.conversationId }, 'Erro ao listar mensagens');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Erro interno ao listar mensagens' });
    }
  }

  /**
   * POST /api/messages
   * Envia mensagem de texto ou mídia (assíncrono via fila)
   */
  async send(req: Request, res: Response) {
    try {
      const data = req.body as SendMessageInput;

      if (!req.tenantId || !req.user) {
        return res.status(400).json({ error: 'Tenant ou user não encontrado' });
      }

      // Usar messageServiceV2 - enfileira e retorna imediatamente
      const message = await messageServiceV2.sendMessage(
        {
          ...data,
          sentById: req.user.userId,
        } as any,
        req.tenantId
      );

      res.status(201).json(message);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          conversationId: req.body.conversationId,
          type: req.body.type,
        },
        'Erro ao enviar mensagem'
      );

      if (error instanceof BadRequestError) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof WhatsAppApiError) {
        // Tratar erros específicos da WhatsApp API
        switch (error.code) {
          case WhatsAppErrorCode.RATE_LIMIT_HIT:
            return res.status(429).json({
              error: 'Muitas mensagens enviadas. Tente novamente em alguns segundos.',
            });

          case WhatsAppErrorCode.MESSAGE_UNDELIVERABLE:
            return res.status(400).json({
              error: 'Mensagem não pode ser entregue a este número',
            });

          case WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE:
            return res.status(400).json({
              error: 'Use template message para contatos inativos (fora da janela de 24h)',
            });

          case WhatsAppErrorCode.PHONE_NUMBER_NOT_WHATSAPP:
            return res.status(400).json({
              error: 'Número não tem WhatsApp',
            });

          default:
            return res.status(500).json({
              error: 'Erro ao enviar mensagem via WhatsApp',
              details: error.title,
            });
        }
      }

      res.status(500).json({ error: 'Erro interno ao enviar mensagem' });
    }
  }

  /**
   * POST /api/messages/template
   * Envia template message (assíncrono via fila)
   */
  async sendTemplate(req: Request, res: Response) {
    try {
      const { conversationId, templateName, parameters, languageCode } = req.body;

      if (!req.tenantId || !req.user) {
        return res.status(400).json({ error: 'Tenant ou user não encontrado' });
      }

      if (!conversationId || !templateName || !parameters) {
        return res.status(400).json({
          error: 'conversationId, templateName e parameters são obrigatórios',
        });
      }

      const message = await messageServiceV2.sendTemplateMessage(
        req.tenantId,
        conversationId,
        templateName,
        parameters,
        req.user.userId,
        languageCode || 'pt_BR'
      );

      res.status(201).json(message);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          conversationId: req.body.conversationId,
          templateName: req.body.templateName,
        },
        'Erro ao enviar template message'
      );

      if (error instanceof BadRequestError) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      if (error instanceof WhatsAppApiError) {
        switch (error.code) {
          case WhatsAppErrorCode.TEMPLATE_DOES_NOT_EXIST:
            return res.status(404).json({
              error: 'Template não encontrado',
              details: 'Verifique o nome do template no WhatsApp Business Manager',
            });

          case WhatsAppErrorCode.TEMPLATE_PAUSED:
            return res.status(400).json({
              error: 'Template pausado',
              details: 'Ative o template no WhatsApp Business Manager',
            });

          case WhatsAppErrorCode.TEMPLATE_PARAM_COUNT_MISMATCH:
            return res.status(400).json({
              error: 'Número de parâmetros incorreto',
              details: 'Verifique quantos placeholders o template tem',
            });

          default:
            return res.status(500).json({
              error: 'Erro ao enviar template',
              details: error.title,
            });
        }
      }

      res.status(500).json({ error: 'Erro interno ao enviar template' });
    }
  }

  /**
   * POST /api/messages/buttons
   * Envia mensagem interativa com botões
   */
  async sendButtons(req: Request, res: Response) {
    try {
      const { conversationId, bodyText, buttons, headerText, footerText } = req.body;

      if (!req.tenantId || !req.user) {
        return res.status(400).json({ error: 'Tenant ou user não encontrado' });
      }

      if (!conversationId || !bodyText || !buttons) {
        return res.status(400).json({
          error: 'conversationId, bodyText e buttons são obrigatórios',
        });
      }

      // Buscar conversa para pegar número do contato
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          tenantId: req.tenantId,
        },
        include: {
          contact: true,
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversa não encontrada' });
      }

      // Enviar botões
      await whatsAppServiceV2.sendInteractiveButtons(
        req.tenantId,
        conversation.contact.phoneNumber,
        bodyText,
        buttons,
        headerText,
        footerText
      );

      // Criar registro no banco
      const message = await prisma.message.create({
        data: {
          tenantId: req.tenantId,
          conversationId,
          direction: 'OUTBOUND',
          type: 'INTERACTIVE',
          content: bodyText,
          metadata: {
            interactiveType: 'button',
            buttons,
            headerText,
            footerText,
          },
          sentById: req.user.userId,
          timestamp: new Date(),
          status: 'SENT',
        },
      });

      res.status(201).json(message);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          conversationId: req.body.conversationId,
        },
        'Erro ao enviar mensagem com botões'
      );

      if (error instanceof BadRequestError) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Erro interno ao enviar mensagem com botões' });
    }
  }

  /**
   * POST /api/messages/list
   * Envia mensagem interativa com lista
   */
  async sendList(req: Request, res: Response) {
    try {
      const { conversationId, bodyText, buttonText, sections } = req.body;

      if (!req.tenantId || !req.user) {
        return res.status(400).json({ error: 'Tenant ou user não encontrado' });
      }

      if (!conversationId || !bodyText || !buttonText || !sections) {
        return res.status(400).json({
          error: 'conversationId, bodyText, buttonText e sections são obrigatórios',
        });
      }

      // Buscar conversa
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          tenantId: req.tenantId,
        },
        include: {
          contact: true,
        },
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversa não encontrada' });
      }

      // Enviar lista
      await whatsAppServiceV2.sendInteractiveList(
        req.tenantId,
        conversation.contact.phoneNumber,
        bodyText,
        buttonText,
        sections
      );

      // Criar registro no banco
      const message = await prisma.message.create({
        data: {
          tenantId: req.tenantId,
          conversationId,
          direction: 'OUTBOUND',
          type: 'INTERACTIVE',
          content: bodyText,
          metadata: {
            interactiveType: 'list',
            buttonText,
            sections,
          },
          sentById: req.user.userId,
          timestamp: new Date(),
          status: 'SENT',
        },
      });

      res.status(201).json(message);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          conversationId: req.body.conversationId,
        },
        'Erro ao enviar mensagem com lista'
      );

      if (error instanceof BadRequestError) {
        return res.status(400).json({ error: error.message });
      }

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Erro interno ao enviar mensagem com lista' });
    }
  }

  /**
   * POST /api/messages/:id/read
   */
  async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      await messageServiceV2.markAsRead(id, req.tenantId);

      res.status(204).send();
    } catch (error) {
      logger.error({ error, messageId: req.params.id }, 'Erro ao marcar mensagem como lida');

      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Erro interno ao marcar mensagem como lida' });
    }
  }

  /**
   * GET /api/messages/search
   * Busca mensagens por texto
   */
  async search(req: Request, res: Response) {
    try {
      const { query, conversationId, limit } = req.query;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'query é obrigatório' });
      }

      const result = await messageServiceV2.searchMessages(req.tenantId, query, {
        conversationId: conversationId as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json(result);
    } catch (error) {
      logger.error({ error, query: req.query.query }, 'Erro ao buscar mensagens');

      res.status(500).json({ error: 'Erro interno ao buscar mensagens' });
    }
  }

  /**
   * GET /api/conversations/:conversationId/stats
   * Estatísticas de mensagens de uma conversa
   */
  async getStats(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID não encontrado' });
      }

      const stats = await messageServiceV2.getConversationStats(conversationId, req.tenantId);

      res.json(stats);
    } catch (error) {
      logger.error({ error, conversationId: req.params.conversationId }, 'Erro ao buscar estatísticas');

      res.status(500).json({ error: 'Erro interno ao buscar estatísticas' });
    }
  }
}

export const messageController = new MessageController();
