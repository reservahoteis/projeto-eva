import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import logger from '@/config/logger';
import { enqueueInstagramMessage } from '@/queues/whatsapp-webhook.queue';

/**
 * Instagram Webhook Controller
 *
 * Handles Instagram Messaging API webhook verification and incoming events.
 * - GET: Challenge verification
 * - POST: Receive events with body.object === 'instagram', entry[].messaging[]
 */
export class InstagramWebhookController {
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      if (!mode || !token || !challenge) {
        res.status(400).send('Missing parameters');
        return;
      }

      const verifyToken = env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;

      if (!verifyToken) {
        logger.error('INSTAGRAM_WEBHOOK_VERIFY_TOKEN not configured');
        res.status(403).send('Webhook not configured');
        return;
      }

      if (mode === 'subscribe' && token === verifyToken) {
        logger.info({ challenge }, 'Instagram webhook verified');
        res.set('Content-Type', 'text/plain');
        res.status(200).send(challenge);
        return;
      }

      res.status(403).send('Verification failed');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown' }, 'Instagram verify error');
      res.status(500).send('Internal server error');
    }
  }

  /**
   * POST /webhooks/instagram - Receber eventos do Instagram
   *
   * IMPORTANTE: Responder 200 em < 5 segundos (processamento via fila)
   */
  async handleInstagram(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;

      if (body.object !== 'instagram') {
        res.status(404).send('Not Found');
        return;
      }

      // Responder 200 imediatamente
      res.status(200).send('EVENT_RECEIVED');

      // Processar em background
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const igAccountId = entry.id;
          const tenantId = await this.resolveTenantByIgId(igAccountId);

          if (!tenantId) {
            logger.warn({ igAccountId }, 'No tenant for Instagram account, skipping');
            continue;
          }

          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const event of entry.messaging) {
              this.logEvent(tenantId, event).catch(() => {});

              const senderId = event.sender?.id;
              if (!senderId) continue;

              if (event.message) {
                await enqueueInstagramMessage({
                  tenantId,
                  senderId,
                  message: {
                    mid: event.message.mid,
                    text: event.message.text,
                    attachments: event.message.attachments,
                  },
                });
              } else if (event.postback) {
                await enqueueInstagramMessage({
                  tenantId,
                  senderId,
                  message: { mid: `postback-${Date.now()}` },
                  postback: {
                    payload: event.postback.payload,
                    title: event.postback.title,
                  },
                });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'Error processing Instagram webhook'
      );
    }
  }

  /**
   * Resolve tenantId pelo Instagram Account ID.
   * Primeiro tenta DB (instagramAccountId), fallback para env var.
   */
  private async resolveTenantByIgId(igAccountId: string): Promise<string | null> {
    try {
      // Buscar no DB (multi-tenant)
      const tenant = await prisma.tenant.findFirst({
        where: { instagramAccountId: igAccountId, status: 'ACTIVE' },
        select: { id: true },
      });

      if (tenant) return tenant.id;

      // Fallback: env var (single-tenant)
      if (env.INSTAGRAM_ACCOUNT_ID === igAccountId) {
        const fallback = await prisma.tenant.findFirst({
          where: { status: 'ACTIVE' },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        return fallback?.id || null;
      }

      return null;
    } catch (error) {
      logger.error({ igAccountId, error: error instanceof Error ? error.message : 'Unknown' }, 'Resolve tenant error');
      return null;
    }
  }

  private async logEvent(tenantId: string, event: Record<string, unknown>): Promise<void> {
    try {
      await prisma.webhookEvent.create({
        data: {
          tenantId,
          source: 'instagram',
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

export const instagramWebhookController = new InstagramWebhookController();
