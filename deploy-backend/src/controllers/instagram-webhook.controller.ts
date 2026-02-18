import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import logger from '@/config/logger';

/**
 * Instagram Webhook Controller
 *
 * Handles Instagram Messaging API webhook verification and incoming events.
 * - GET: Challenge verification (hub.mode, hub.verify_token, hub.challenge)
 * - POST: Receive events with body.object === 'instagram', entry[].messaging[]
 */
export class InstagramWebhookController {
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      logger.debug({ mode, hasToken: !!token, hasChallenge: !!challenge }, 'Instagram webhook verification request');

      if (!mode || !token || !challenge) {
        logger.warn({ query: req.query }, 'Missing verification params for Instagram webhook');
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
        logger.info({ challenge }, 'Instagram webhook verified successfully');
        res.set('Content-Type', 'text/plain');
        res.status(200).send(challenge);
        return;
      }

      logger.warn({ mode, tokenMatch: token === verifyToken }, 'Instagram webhook verification failed');
      res.status(403).send('Verification failed');
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Error in Instagram webhook verification'
      );
      res.status(500).send('Internal server error');
    }
  }

  async handleInstagram(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const body = req.body;

      if (body.object !== 'instagram') {
        logger.warn({ object: body.object }, 'Instagram webhook received non-instagram event');
        res.status(404).send('Not Found');
        return;
      }

      logger.info(
        { entriesCount: body.entry?.length || 0 },
        'Instagram webhook event received'
      );

      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const igAccountId = entry.id;
          const tenantId = await this.resolveTenantByIgId(igAccountId);

          if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const messagingEvent of entry.messaging) {
              this.logInstagramEvent(tenantId || igAccountId, messagingEvent).catch((err) => {
                logger.error({ error: err.message }, 'Failed to log Instagram event');
              });

              if (messagingEvent.message) {
                logger.info(
                  {
                    igAccountId,
                    tenantId,
                    senderId: messagingEvent.sender?.id,
                    messageId: messagingEvent.message.mid,
                    hasText: !!messagingEvent.message.text,
                    hasAttachments: !!messagingEvent.message.attachments,
                  },
                  'Instagram message received'
                );
              } else if (messagingEvent.postback) {
                logger.info(
                  {
                    igAccountId,
                    tenantId,
                    senderId: messagingEvent.sender?.id,
                    payload: messagingEvent.postback.payload,
                  },
                  'Instagram postback received'
                );
              } else if (messagingEvent.referral) {
                logger.info({ igAccountId, tenantId }, 'Instagram referral received');
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info({ duration, entriesCount: body.entry?.length || 0 }, 'Instagram webhook processed');

      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          duration,
        },
        'Error processing Instagram webhook'
      );

      res.status(200).send('EVENT_RECEIVED');
    }
  }

  private async resolveTenantByIgId(igAccountId: string): Promise<string | null> {
    try {
      if (env.INSTAGRAM_ACCOUNT_ID === igAccountId) {
        const tenant = await prisma.tenant.findFirst({
          where: { status: 'ACTIVE' },
          select: { id: true, slug: true },
          orderBy: { createdAt: 'asc' },
        });

        if (tenant) {
          logger.debug({ igAccountId, tenantId: tenant.id }, 'Instagram account mapped to tenant');
          return tenant.id;
        }
      }

      logger.warn({ igAccountId }, 'No tenant found for Instagram account');
      return null;
    } catch (error) {
      logger.error(
        { igAccountId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Error resolving tenant for Instagram account'
      );
      return null;
    }
  }

  private async logInstagramEvent(tenantOrIgId: string, event: Record<string, unknown>): Promise<void> {
    try {
      await prisma.webhookEvent.create({
        data: {
          tenantId: tenantOrIgId,
          source: 'instagram',
          event: 'messaging',
          payload: event as any,
          processed: false,
        },
      });
    } catch (err) {
      logger.error(
        { tenantOrIgId, error: err instanceof Error ? err.message : 'Unknown error' },
        'Failed to log Instagram webhook event'
      );
    }
  }
}

export const instagramWebhookController = new InstagramWebhookController();
