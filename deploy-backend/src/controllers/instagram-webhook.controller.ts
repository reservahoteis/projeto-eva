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

      logger.info(
        { entryCount: body.entry?.length || 0 },
        '[INSTAGRAM WEBHOOK] Payload recebido'
      );

      // Processar em background
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const igAccountId = entry.id;
          const tenantId = await this.resolveTenantByIgId(igAccountId);

          if (!tenantId) {
            logger.warn({ igAccountId }, '[INSTAGRAM WEBHOOK] No tenant for account, skipping');
            continue;
          }

          logger.info({ igAccountId, tenantId }, '[INSTAGRAM WEBHOOK] Tenant resolvido');

          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const event of entry.messaging) {
              this.logEvent(tenantId, event).catch(() => {});

              const senderId = event.sender?.id;
              if (!senderId) {
                logger.warn({ tenantId }, '[INSTAGRAM WEBHOOK] Evento sem senderId, ignorando');
                continue;
              }

              // Filtrar echo messages (mensagens enviadas pelo proprio bot)
              if (event.message?.is_echo || senderId === igAccountId) {
                logger.info(
                  { tenantId, senderId, mid: event.message?.mid, isEcho: !!event.message?.is_echo },
                  '[INSTAGRAM WEBHOOK] Echo message ignorada (enviada pelo bot)'
                );
                continue;
              }

              const eventType = event.message
                ? 'message'
                : event.postback
                  ? 'postback'
                  : event.delivery
                    ? 'delivery'
                    : event.read
                      ? 'read'
                      : 'unknown';

              // Delivery/read are normal — only log messages and postbacks at info level
              if (eventType === 'delivery' || eventType === 'read') {
                logger.debug(
                  { tenantId, senderId, eventType },
                  '[INSTAGRAM WEBHOOK] Delivery/read receipt (ignorado)'
                );
                continue;
              }

              if (eventType === 'unknown') {
                logger.warn(
                  { tenantId, senderId, eventKeys: Object.keys(event) },
                  '[INSTAGRAM WEBHOOK] Evento desconhecido (ignorado)'
                );
                continue;
              }

              logger.info(
                {
                  tenantId,
                  senderId,
                  eventType,
                  hasText: !!event.message?.text,
                  hasAttachments: !!(event.message?.attachments?.length),
                  mid: event.message?.mid,
                },
                '[INSTAGRAM WEBHOOK] Evento recebido'
              );

              if (event.message) {
                await enqueueInstagramMessage({
                  tenantId,
                  senderId,
                  message: {
                    mid: event.message.mid,
                    text: event.message.text,
                    attachments: event.message.attachments,
                    quick_reply: event.message.quick_reply,
                  },
                });

                logger.info(
                  { tenantId, senderId, mid: event.message.mid },
                  '[INSTAGRAM WEBHOOK] Mensagem enfileirada no Bull'
                );
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

                logger.info(
                  { tenantId, senderId, postbackTitle: event.postback.title },
                  '[INSTAGRAM WEBHOOK] Postback enfileirado no Bull'
                );
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
