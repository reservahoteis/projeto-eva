import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import logger from '@/config/logger';

/**
 * Messenger Webhook Controller
 *
 * Handles Facebook Messenger webhook verification and incoming events.
 * Uses the same Meta webhook pattern as WhatsApp:
 * - GET: Challenge verification
 * - POST: Receive page messaging events (body.object === 'page')
 *
 * Page ID: 820408291148051 (Hoteis Reserva)
 */
export class MessengerWebhookController {
  /**
   * GET /webhooks/messenger - Verificacao do webhook (Meta)
   *
   * Meta envia GET request para verificar que o webhook esta ativo.
   * Params: hub.mode, hub.verify_token, hub.challenge
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      logger.debug({ mode, hasToken: !!token, hasChallenge: !!challenge }, 'Messenger webhook verification request');

      if (!mode || !token || !challenge) {
        logger.warn({ query: req.query }, 'Missing verification params for Messenger webhook');
        res.status(400).send('Missing parameters');
        return;
      }

      const verifyToken = env.MESSENGER_WEBHOOK_VERIFY_TOKEN;

      if (!verifyToken) {
        logger.error('MESSENGER_WEBHOOK_VERIFY_TOKEN not configured');
        res.status(403).send('Webhook not configured');
        return;
      }

      if (mode === 'subscribe' && token === verifyToken) {
        logger.info({ challenge }, 'Messenger webhook verified successfully');
        res.set('Content-Type', 'text/plain');
        res.status(200).send(challenge);
        return;
      }

      logger.warn({ mode, tokenMatch: token === verifyToken }, 'Messenger webhook verification failed');
      res.status(403).send('Verification failed');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Error in Messenger webhook verification'
      );
      res.status(500).send('Internal server error');
    }
  }

  /**
   * POST /webhooks/messenger - Receber eventos do Messenger
   *
   * Meta envia POST com body.object === 'page'
   * Eventos de mensagem estao em entry[].messaging[]
   *
   * IMPORTANTE: Responder 200 em < 5 segundos
   */
  async handleMessenger(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const body = req.body;

      if (body.object !== 'page') {
        logger.warn({ object: body.object }, 'Messenger webhook received non-page event');
        res.status(404).send('Not Found');
        return;
      }

      logger.info(
        { entriesCount: body.entry?.length || 0 },
        'Messenger webhook event received'
      );

      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const pageId = entry.id;

          // Resolver tenant pelo Page ID
          const tenantId = await this.resolveTenantByPageId(pageId);

          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const messagingEvent of entry.messaging) {
              // Log do evento para debug (async, nao bloquear)
              this.logMessengerEvent(tenantId || pageId, messagingEvent).catch((err) => {
                logger.error({ error: err.message }, 'Failed to log Messenger event');
              });

              if (messagingEvent.message) {
                const senderId = messagingEvent.sender?.id;
                const messageText = messagingEvent.message.text;
                const messageId = messagingEvent.message.mid;

                logger.info(
                  {
                    pageId,
                    tenantId,
                    senderId,
                    messageId,
                    hasText: !!messageText,
                    hasAttachments: !!messagingEvent.message.attachments,
                  },
                  'Messenger message received'
                );

                // TODO: Encaminhar para fila de processamento (similar ao WhatsApp)
                // Por enquanto, apenas loga. Quando o fluxo completo for implementado:
                // await enqueueMessengerMessage({ tenantId, pageId, senderId, message: messagingEvent.message })
              } else if (messagingEvent.postback) {
                logger.info(
                  {
                    pageId,
                    tenantId,
                    senderId: messagingEvent.sender?.id,
                    payload: messagingEvent.postback.payload,
                  },
                  'Messenger postback received'
                );
              } else if (messagingEvent.delivery) {
                logger.debug({ pageId }, 'Messenger delivery confirmation');
              } else if (messagingEvent.read) {
                logger.debug({ pageId }, 'Messenger read confirmation');
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info({ duration, entriesCount: body.entry?.length || 0 }, 'Messenger webhook processed');

      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          duration,
        },
        'Error processing Messenger webhook'
      );

      res.status(200).send('EVENT_RECEIVED');
    }
  }

  /**
   * Resolve o tenantId a partir do Page ID do Messenger.
   * Usa o MESSENGER_PAGE_ID do env para mapear ao tenant correto.
   * Quando multi-tenant for necessario, buscar do campo messengerPageId no Tenant model.
   */
  private async resolveTenantByPageId(pageId: string): Promise<string | null> {
    try {
      // Mapeamento via env var (global - um Page ID por instalacao)
      if (env.MESSENGER_PAGE_ID === pageId) {
        // Buscar o tenant principal (primeiro ACTIVE encontrado)
        const tenant = await prisma.tenant.findFirst({
          where: { status: 'ACTIVE' },
          select: { id: true, slug: true },
          orderBy: { createdAt: 'asc' },
        });

        if (tenant) {
          logger.debug({ pageId, tenantId: tenant.id, tenantSlug: tenant.slug }, 'Messenger page mapped to tenant');
          return tenant.id;
        }
      }

      logger.warn({ pageId, configuredPageId: env.MESSENGER_PAGE_ID }, 'No tenant found for Messenger page');
      return null;
    } catch (error) {
      logger.error(
        { pageId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Error resolving tenant for Messenger page'
      );
      return null;
    }
  }

  /**
   * Loga evento do Messenger no banco para debug
   */
  private async logMessengerEvent(tenantOrPageId: string, event: Record<string, unknown>): Promise<void> {
    try {
      await prisma.webhookEvent.create({
        data: {
          tenantId: tenantOrPageId,
          source: 'messenger',
          event: 'messaging',
          payload: event as any,
          processed: false,
        },
      });
    } catch (err) {
      logger.error(
        { tenantOrPageId, error: err instanceof Error ? err.message : 'Unknown error' },
        'Failed to log Messenger webhook event'
      );
    }
  }
}

export const messengerWebhookController = new MessengerWebhookController();
