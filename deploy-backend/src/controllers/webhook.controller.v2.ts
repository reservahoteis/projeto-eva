import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import {
  validateWhatsAppWebhookSafe,
  validateWhatsAppVerificationSafe,
  type WhatsAppWebhook,
  type WhatsAppChange,
} from '@/validators/whatsapp-webhook.validator';
import {
  enqueueIncomingMessage,
  enqueueStatusUpdate,
} from '@/queues/whatsapp-webhook.queue';

/**
 * WhatsApp Webhook Controller - Versão 2 (Refatorada)
 *
 * Features:
 * - Validação Zod rigorosa
 * - Processamento assíncrono via filas Bull
 * - HMAC signature validation
 * - Error handling robusto
 * - Logging estruturado
 * - Response rápido para Meta (< 5s)
 */
export class WebhookControllerV2 {
  /**
   * GET /webhooks/whatsapp - Verificação do webhook (Meta)
   *
   * Meta envia GET request para verificar que o webhook está ativo
   * Parâmetros: hub.mode, hub.verify_token, hub.challenge
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      logger.debug({ query: req.query }, 'Webhook verification request received');

      // 1. VALIDAR QUERY PARAMS COM ZOD
      const validation = validateWhatsAppVerificationSafe(req.query);

      if (!validation.success) {
        logger.warn(
          {
            query: req.query,
            errors: validation.error.errors,
          },
          'Invalid webhook verification params'
        );
        res.status(400).send('Invalid verification parameters');
        return;
      }

      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = validation.data;

      // 2. DETERMINAR TENANT
      // Opção A: Via header X-Tenant-Slug (preferível)
      // Opção B: Via query param ?tenant=slug (fallback)
      const tenantSlug = (req.headers['x-tenant-slug'] as string) || (req.query.tenant as string);

      if (!tenantSlug) {
        logger.warn({ query: req.query }, 'Tenant not specified in verification');
        res.status(403).send('Tenant not specified');
        return;
      }

      // 3. BUSCAR TENANT E VALIDAR VERIFY TOKEN
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: {
          id: true,
          slug: true,
          whatsappWebhookVerifyToken: true,
        },
      });

      if (!tenant) {
        logger.warn({ tenantSlug }, 'Tenant not found in verification');
        res.status(403).send('Tenant not found');
        return;
      }

      if (!tenant.whatsappWebhookVerifyToken) {
        logger.warn({ tenantId: tenant.id, tenantSlug }, 'Tenant has no verify token configured');
        res.status(403).send('Webhook not configured');
        return;
      }

      // 4. VALIDAR VERIFY TOKEN
      if (mode === 'subscribe' && token === tenant.whatsappWebhookVerifyToken) {
        logger.info(
          {
            tenantId: tenant.id,
            tenantSlug,
            challenge,
          },
          'Webhook verified successfully'
        );

        // RETORNAR CHALLENGE (sem modificação)
        res.status(200).send(challenge);
        return;
      }

      logger.warn(
        {
          tenantId: tenant.id,
          tenantSlug,
          mode,
          tokenMatch: token === tenant.whatsappWebhookVerifyToken,
        },
        'Webhook verification failed'
      );

      res.status(403).send('Verification failed');
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Error in webhook verification'
      );

      res.status(500).send('Internal server error');
    }
  }

  /**
   * POST /webhooks/whatsapp - Receber eventos do WhatsApp
   *
   * Meta envia POST request com eventos de mensagens e status updates
   * IMPORTANTE: Deve responder em < 5 segundos ou Meta vai marcar como timeout
   */
  async handleWhatsApp(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      logger.debug({ body: req.body }, 'Webhook event received');

      // 1. DETERMINAR TENANT
      const tenantSlug = (req.headers['x-tenant-slug'] as string) || (req.query.tenant as string);

      if (!tenantSlug) {
        logger.warn({ headers: req.headers, query: req.query }, 'Tenant not specified in webhook');
        // IMPORTANTE: Responder 200 mesmo assim para não bloquear webhook
        res.status(200).send('EVENT_RECEIVED');
        return;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: {
          id: true,
          slug: true,
          whatsappAppSecret: true,
        },
      });

      if (!tenant) {
        logger.warn({ tenantSlug }, 'Tenant not found in webhook');
        res.status(200).send('EVENT_RECEIVED');
        return;
      }

      // 2. VALIDAR SIGNATURE HMAC (SEGURANÇA CRÍTICA!)
      const signature = req.headers['x-hub-signature-256'] as string;

      if (!signature) {
        logger.error({ tenantId: tenant.id }, 'Missing X-Hub-Signature-256 header');
        res.status(403).send('Missing signature');
        return;
      }

      if (!tenant.whatsappAppSecret) {
        logger.warn({ tenantId: tenant.id }, 'Tenant has no WhatsApp app secret configured');
        res.status(200).send('EVENT_RECEIVED');
        return;
      }

      // Usar rawBody (preservado pelo middleware) ao invés de JSON.stringify(req.body)
      // para garantir que a assinatura HMAC seja validada corretamente
      const payload = req.rawBody || JSON.stringify(req.body);

      const isValid = this.validateSignature(
        payload,
        signature,
        tenant.whatsappAppSecret
      );

      if (!isValid) {
        logger.error(
          {
            tenantId: tenant.id,
            signature,
          },
          'Invalid webhook signature - POSSIBLE ATTACK!'
        );
        res.status(403).send('Invalid signature');
        return;
      }

      // 3. VALIDAR PAYLOAD COM ZOD
      const validation = validateWhatsAppWebhookSafe(req.body);

      if (!validation.success) {
        logger.error(
          {
            tenantId: tenant.id,
            errors: validation.error.errors,
            body: req.body,
          },
          'Invalid webhook payload'
        );

        // Logar evento inválido para debug
        await this.logWebhookEvent(tenant.id, 'whatsapp', 'invalid_payload', req.body, false, validation.error.message);

        // IMPORTANTE: Responder 200 mesmo assim
        res.status(200).send('EVENT_RECEIVED');
        return;
      }

      const webhook: WhatsAppWebhook = validation.data;

      // 4. LOGAR EVENTO (async, não esperar)
      this.logWebhookEvent(tenant.id, 'whatsapp', 'received', req.body, false).catch((err) => {
        logger.error({ error: err.message }, 'Failed to log webhook event');
      });

      // 5. PROCESSAR ENTRIES (ENFILEIRAR)
      const processingPromises: Promise<void>[] = [];

      for (const entry of webhook.entry) {
        for (const change of entry.changes) {
          processingPromises.push(this.processChange(tenant.id, change));
        }
      }

      // Não esperar processamento (fazer em background via filas)
      Promise.all(processingPromises)
        .then(() => {
          logger.debug({ tenantId: tenant.id, entriesCount: webhook.entry.length }, 'All changes enqueued');
        })
        .catch((err) => {
          logger.error(
            {
              tenantId: tenant.id,
              error: err.message,
            },
            'Error enqueueing changes'
          );
        });

      // 6. RESPONDER IMEDIATAMENTE (< 5s!)
      const duration = Date.now() - startTime;

      logger.info(
        {
          tenantId: tenant.id,
          entriesCount: webhook.entry.length,
          duration,
        },
        'Webhook event processed and enqueued'
      );

      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          duration,
        },
        'Error processing webhook'
      );

      // SEMPRE responder 200, mesmo com erro (para não bloquear webhook)
      res.status(200).send('EVENT_RECEIVED');
    }
  }

  /**
   * Processa uma mudança (change) do webhook
   * Enfileira para processamento assíncrono
   */
  private async processChange(tenantId: string, change: WhatsAppChange): Promise<void> {
    const { field, value } = change;

    logger.debug(
      {
        tenantId,
        field,
        hasMessages: !!value.messages,
        hasStatuses: !!value.statuses,
      },
      'Processing change'
    );

    try {
      // MESSAGES (mensagens recebidas)
      if (field === 'messages' && value.messages && value.messages.length > 0) {
        for (const message of value.messages) {
          // Nome do contato (se fornecido)
          const contactName = value.contacts?.[0]?.profile?.name;

          await enqueueIncomingMessage({
            tenantId,
            message,
            contactName,
            metadata: {
              phoneNumberId: value.metadata.phone_number_id,
              displayPhoneNumber: value.metadata.display_phone_number,
            },
          });

          logger.debug(
            {
              tenantId,
              messageId: message.id,
              from: message.from,
              type: message.type,
            },
            'Message enqueued for processing'
          );
        }
      }

      // MESSAGE STATUS UPDATES (delivered, read, failed)
      if (field === 'message_status' && value.statuses && value.statuses.length > 0) {
        for (const status of value.statuses) {
          await enqueueStatusUpdate({
            tenantId,
            status,
            metadata: {
              phoneNumberId: value.metadata.phone_number_id,
            },
          });

          logger.debug(
            {
              tenantId,
              messageId: status.id,
              status: status.status,
            },
            'Status update enqueued'
          );
        }
      }

      // ACCOUNT UPDATES (não implementado ainda)
      if (field === 'account_update') {
        logger.info({ tenantId, field }, 'Account update received (not implemented)');
      }

      // ACCOUNT ALERTS (não implementado ainda)
      if (field === 'account_alerts') {
        logger.info({ tenantId, field }, 'Account alert received (not implemented)');
      }

      // MESSAGE TEMPLATE STATUS UPDATE (não implementado ainda)
      if (field === 'message_template_status_update') {
        logger.info({ tenantId, field }, 'Message template status update received (not implemented)');
      }
    } catch (error) {
      logger.error(
        {
          tenantId,
          field,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error processing change'
      );

      throw error;
    }
  }

  /**
   * Valida assinatura HMAC SHA256 do webhook
   */
  private validateSignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const expected = `sha256=${expectedSignature}`;

      // Comparação timing-safe
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error validating signature');
      return false;
    }
  }

  /**
   * Loga evento do webhook para debug
   */
  private async logWebhookEvent(
    tenantId: string,
    source: string,
    event: string,
    payload: any,
    processed: boolean,
    error?: string
  ): Promise<void> {
    try {
      await prisma.webhookEvent.create({
        data: {
          tenantId,
          source,
          event,
          payload,
          processed,
          error,
        },
      });
    } catch (err) {
      // Não falhar se log falhar
      logger.error(
        {
          tenantId,
          event,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        'Failed to log webhook event'
      );
    }
  }
}

export const webhookControllerV2 = new WebhookControllerV2();
