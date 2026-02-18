import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import logger from '@/config/logger';
import { enqueueMessengerMessage } from '@/queues/whatsapp-webhook.queue';

/**
 * Messenger Webhook Controller
 *
 * Handles Facebook Messenger webhook verification and incoming events.
 * - GET: Challenge verification
 * - POST: Receive page messaging events (body.object === 'page')
 */
export class MessengerWebhookController {
  /**
   * GET /webhooks/messenger - Verificacao do webhook (Meta)
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      if (!mode || !token || !challenge) {
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
        logger.info({ challenge }, 'Messenger webhook verified');
        res.set('Content-Type', 'text/plain');
        res.status(200).send(challenge);
        return;
      }

      res.status(403).send('Verification failed');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Messenger verify error');
      res.status(500).send('Internal server error');
    }
  }

  /**
   * POST /webhooks/messenger - Receber eventos do Messenger
   *
   * IMPORTANTE: Responder 200 em < 5 segundos (processamento via fila)
   */
  async handleMessenger(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;

      if (body.object !== 'page') {
        res.status(404).send('Not Found');
        return;
      }

      // Responder 200 imediatamente (Meta exige < 5s)
      res.status(200).send('EVENT_RECEIVED');

      // Processar em background
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const pageId = entry.id;
          const tenantId = await this.resolveTenantByPageId(pageId);

          if (!tenantId) {
            logger.warn({ pageId }, 'No tenant for Messenger page, skipping');
            continue;
          }

          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const event of entry.messaging) {
              // Log async (nao bloquear)
              this.logEvent(tenantId, event).catch(() => {});

              const senderId = event.sender?.id;
              if (!senderId) continue;

              if (event.message) {
                await enqueueMessengerMessage({
                  tenantId,
                  senderId,
                  message: {
                    mid: event.message.mid,
                    text: event.message.text,
                    attachments: event.message.attachments,
                  },
                });
              } else if (event.postback) {
                await enqueueMessengerMessage({
                  tenantId,
                  senderId,
                  message: { mid: `postback-${Date.now()}` },
                  postback: {
                    payload: event.postback.payload,
                    title: event.postback.title,
                  },
                });
              }
              // delivery/read events ignorados (nao sao mensagens)
            }
          }
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'Error processing Messenger webhook'
      );
      // Ja enviou 200 acima
    }
  }

  /**
   * Resolve tenantId pelo Page ID do Messenger.
   * Primeiro tenta DB (messengerPageId), fallback para env var.
   */
  private async resolveTenantByPageId(pageId: string): Promise<string | null> {
    try {
      // Buscar no DB (multi-tenant)
      const tenant = await prisma.tenant.findFirst({
        where: { messengerPageId: pageId, status: 'ACTIVE' },
        select: { id: true },
      });

      if (tenant) return tenant.id;

      // Fallback: env var (single-tenant)
      if (env.MESSENGER_PAGE_ID === pageId) {
        const fallback = await prisma.tenant.findFirst({
          where: { status: 'ACTIVE' },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        return fallback?.id || null;
      }

      return null;
    } catch (error) {
      logger.error({ pageId, error: error instanceof Error ? error.message : 'Unknown' }, 'Resolve tenant error');
      return null;
    }
  }

  private async logEvent(tenantId: string, event: Record<string, unknown>): Promise<void> {
    try {
      await prisma.webhookEvent.create({
        data: {
          tenantId,
          source: 'messenger',
          event: 'messaging',
          payload: event as any,
          processed: false,
        },
      });
    } catch {
      // nao critico
    }
  }
}

export const messengerWebhookController = new MessengerWebhookController();
