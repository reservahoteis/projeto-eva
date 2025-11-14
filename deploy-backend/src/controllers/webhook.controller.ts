import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@/config/database';
import { messageService } from '@/services/message.service';
import logger from '@/config/logger';

export class WebhookController {
  /**
   * GET /webhooks/whatsapp - Verificação do webhook (Meta)
   */
  async verify(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (!req.tenantId) {
      // Verificar via query param se em desenvolvimento
      const slug = req.query.tenant as string;
      if (slug) {
        const tenant = await prisma.tenant.findUnique({
          where: { slug },
          select: { whatsappWebhookVerifyToken: true },
        });

        if (tenant && mode === 'subscribe' && token === tenant.whatsappWebhookVerifyToken) {
          logger.info({ slug }, 'Webhook verified for tenant');
          return res.status(200).send(challenge);
        }
      }

      return res.status(403).send('Forbidden');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { whatsappWebhookVerifyToken: true },
    });

    if (mode === 'subscribe' && token === tenant?.whatsappWebhookVerifyToken) {
      logger.info({ tenantId: req.tenantId }, 'Webhook verified');
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Forbidden');
    }
  }

  /**
   * POST /webhooks/whatsapp - Receber eventos do WhatsApp
   */
  async handleWhatsApp(req: Request, res: Response) {
    try {
      // 1. IDENTIFICAR TENANT
      let tenantId = req.tenantId;

      // Se não tem tenantId no middleware, tentar identificar pelo payload
      if (!tenantId) {
        const body = req.body;
        const wabaId = body.entry?.[0]?.id; // WhatsApp Business Account ID

        if (wabaId) {
          const tenant = await prisma.tenant.findFirst({
            where: { whatsappBusinessAccountId: wabaId },
            select: { id: true, whatsappAppSecret: true },
          });

          if (tenant) {
            tenantId = tenant.id;
            logger.info({ tenantId, wabaId }, 'Tenant identified by WABA ID');
          } else {
            logger.warn({ wabaId }, 'Webhook received for unknown WABA ID');
            return res.status(200).send('EVENT_RECEIVED');
          }
        } else {
          logger.warn('Webhook received without tenant context and no WABA ID');
          return res.status(200).send('EVENT_RECEIVED');
        }
      }

      // 2. VALIDAR ASSINATURA (SEGURANÇA CRÍTICA!)
      const signature = req.headers['x-hub-signature-256'] as string;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappAppSecret: true },
      });

      if (!tenant?.whatsappAppSecret) {
        logger.warn({ tenantId }, 'Tenant has no WhatsApp secret configured');
        return res.status(200).send('EVENT_RECEIVED');
      }

      const isValid = this.validateSignature(
        JSON.stringify(req.body),
        signature,
        tenant.whatsappAppSecret
      );

      if (!isValid) {
        logger.error({ tenantId }, 'Invalid webhook signature - possible attack!');
        return res.status(403).send('Invalid signature');
      }

      // 3. PROCESSAR WEBHOOK
      const body = req.body;

      // Log do evento (opcional, para debug)
      await prisma.webhookEvent.create({
        data: {
          tenantId,
          source: 'whatsapp',
          event: body.entry?.[0]?.changes?.[0]?.field || 'unknown',
          payload: body,
          processed: false,
        },
      });

      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              await this.processMessages(change.value, tenantId);
            }

            if (change.field === 'message_status') {
              await this.processStatusUpdates(change.value);
            }
          }
        }
      }

      // 4. RESPONDER IMEDIATAMENTE (Meta espera 200 OK rápido!)
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      logger.error({ error }, 'Error processing webhook');
      // SEMPRE responder 200, mesmo com erro (para não bloquear webhook)
      return res.status(200).send('EVENT_RECEIVED');
    }
  }

  /**
   * Processar mensagens recebidas
   */
  private async processMessages(value: any, tenantId: string) {
    const messages = value.messages;

    if (!messages || messages.length === 0) {
      return;
    }

    for (const message of messages) {
      try {
        const from = message.from; // 5511999999999
        const messageId = message.id;
        const timestamp = new Date(parseInt(message.timestamp) * 1000);

        // Extrair dados da mensagem
        const messageData = this.extractMessageData(message);

        // Nome do contato (se fornecido)
        const contactName = value.contacts?.[0]?.profile?.name;

        // Processar mensagem via service
        await messageService.receiveMessage({
          tenantId,
          contactPhoneNumber: from,
          contactName,
          whatsappMessageId: messageId,
          type: messageData.type,
          content: messageData.content,
          metadata: messageData.metadata,
          timestamp,
        });

        logger.info({ tenantId, messageId, from }, 'Webhook message processed');
      } catch (error) {
        logger.error({ error, message }, 'Error processing individual message');
      }
    }
  }

  /**
   * Processar atualizações de status de mensagem
   */
  private async processStatusUpdates(value: any) {
    const statuses = value.statuses;

    if (!statuses || statuses.length === 0) {
      return;
    }

    for (const status of statuses) {
      try {
        const messageId = status.id;
        const newStatus = status.status; // sent, delivered, read, failed

        await messageService.updateMessageStatus(messageId, newStatus.toUpperCase());

        logger.debug({ messageId, status: newStatus }, 'Message status updated from webhook');
      } catch (error) {
        logger.error({ error, status }, 'Error processing status update');
      }
    }
  }

  /**
   * Extrair dados da mensagem do payload do WhatsApp
   */
  private extractMessageData(message: any): {
    type: any;
    content: string;
    metadata: any;
  } {
    const type = message.type.toUpperCase();

    if (type === 'TEXT') {
      return {
        type: 'TEXT',
        content: message.text.body,
        metadata: null,
      };
    }

    if (type === 'IMAGE') {
      return {
        type: 'IMAGE',
        content: message.image.id, // Media ID (baixar depois se necessário)
        metadata: {
          caption: message.image.caption,
          mimeType: message.image.mime_type,
          sha256: message.image.sha256,
        },
      };
    }

    if (type === 'VIDEO') {
      return {
        type: 'VIDEO',
        content: message.video.id,
        metadata: {
          caption: message.video.caption,
          mimeType: message.video.mime_type,
        },
      };
    }

    if (type === 'AUDIO') {
      return {
        type: 'AUDIO',
        content: message.audio.id,
        metadata: {
          mimeType: message.audio.mime_type,
        },
      };
    }

    if (type === 'DOCUMENT') {
      return {
        type: 'DOCUMENT',
        content: message.document.id,
        metadata: {
          filename: message.document.filename,
          mimeType: message.document.mime_type,
          caption: message.document.caption,
        },
      };
    }

    if (type === 'LOCATION') {
      return {
        type: 'LOCATION',
        content: JSON.stringify({
          latitude: message.location.latitude,
          longitude: message.location.longitude,
        }),
        metadata: {
          name: message.location.name,
          address: message.location.address,
        },
      };
    }

    // Fallback
    return {
      type: 'TEXT',
      content: `[Tipo não suportado: ${type}]`,
      metadata: message,
    };
  }

  /**
   * Validar assinatura do webhook
   */
  private validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }
}

export const webhookController = new WebhookController();
