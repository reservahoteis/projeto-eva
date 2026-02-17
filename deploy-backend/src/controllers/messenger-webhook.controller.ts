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

      // Buscar verify token: env var global
      const verifyToken = env.MESSENGER_WEBHOOK_VERIFY_TOKEN;

      if (!verifyToken) {
        logger.error('MESSENGER_WEBHOOK_VERIFY_TOKEN not configured');
        res.status(403).send('Webhook not configured');
        return;
      }

      if (mode === 'subscribe' && token === verifyToken) {
        logger.info({ challenge }, 'Messenger webhook verified successfully');
        // Meta espera o challenge como inteiro em text/plain
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

      // Verificar que e um evento de Page (Messenger)
      if (body.object !== 'page') {
        logger.warn({ object: body.object }, 'Messenger webhook received non-page event');
        res.status(404).send('Not Found');
        return;
      }

      logger.info(
        {
          entriesCount: body.entry?.length || 0,
        },
        'Messenger webhook event received'
      );

      // Processar entries
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const pageId = entry.id;

          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const messagingEvent of entry.messaging) {
              // Log do evento para debug (async, nao bloquear)
              this.logMessengerEvent(pageId, messagingEvent).catch((err) => {
                logger.error({ error: err.message }, 'Failed to log Messenger event');
              });

              // Processar diferentes tipos de evento
              if (messagingEvent.message) {
                logger.info(
                  {
                    pageId,
                    senderId: messagingEvent.sender?.id,
                    messageId: messagingEvent.message.mid,
                    text: messagingEvent.message.text ? '[text]' : undefined,
                    hasAttachments: !!messagingEvent.message.attachments,
                  },
                  'Messenger message received'
                );
              } else if (messagingEvent.postback) {
                logger.info(
                  {
                    pageId,
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

      // RESPONDER IMEDIATAMENTE
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

      // SEMPRE responder 200 para nao bloquear webhook
      res.status(200).send('EVENT_RECEIVED');
    }
  }

  /**
   * Loga evento do Messenger no banco para debug
   */
  private async logMessengerEvent(pageId: string, event: Record<string, unknown>): Promise<void> {
    try {
      await prisma.webhookEvent.create({
        data: {
          tenantId: pageId,
          source: 'messenger',
          event: 'messaging',
          payload: event as any,
          processed: false,
        },
      });
    } catch (err) {
      logger.error(
        { pageId, error: err instanceof Error ? err.message : 'Unknown error' },
        'Failed to log Messenger webhook event'
      );
    }
  }
}

export const messengerWebhookController = new MessengerWebhookController();
