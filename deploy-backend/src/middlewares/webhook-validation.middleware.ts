/**
 * Webhook validation middleware for WhatsApp Business API
 * Implements HMAC signature verification as per Meta's security requirements
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '@/config/database';
import { UnauthorizedError, BadRequestError } from '@/utils/errors';
import { decrypt, secureCompare } from '@/utils/encryption';
import logger from '@/config/logger';

interface WebhookRequest extends Request {
  rawBody?: string;
  webhookVerified?: boolean;
}

/**
 * Validates WhatsApp webhook signature using HMAC-SHA256
 * Reference: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export async function validateWhatsAppWebhook(
  req: WebhookRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip validation for webhook verification requests (GET)
    if (req.method === 'GET') {
      return next();
    }

    const signature = req.headers['x-hub-signature-256'] as string;

    if (!signature) {
      logger.warn({
        ip: req.ip,
        url: req.url,
        headers: req.headers,
      }, 'Webhook request without signature');

      throw new UnauthorizedError('Missing webhook signature');
    }

    // Extract the actual signature (remove 'sha256=' prefix)
    if (!signature.startsWith('sha256=')) {
      throw new UnauthorizedError('Invalid signature format');
    }

    const actualSignature = signature.substring(7);

    // Ensure we have the raw body
    if (!req.rawBody) {
      logger.error('Raw body not available for webhook validation');
      throw new BadRequestError('Raw body required for webhook validation');
    }

    // Get tenant from the webhook path or query params
    const tenantId = req.tenantId || req.query.tenant_id as string;

    if (!tenantId) {
      throw new BadRequestError('Tenant identification required');
    }

    // Fetch tenant's WhatsApp app secret
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappAppSecret: true,
        status: true,
      },
    });

    if (!tenant) {
      logger.warn({ tenantId }, 'Tenant not found for webhook');
      throw new UnauthorizedError('Invalid tenant');
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      logger.warn({ tenantId, status: tenant.status }, 'Inactive tenant webhook attempt');
      throw new UnauthorizedError('Tenant is not active');
    }

    if (!tenant.whatsappAppSecret) {
      logger.error({ tenantId }, 'Tenant missing WhatsApp app secret');
      throw new UnauthorizedError('Webhook not configured for tenant');
    }

    // Decrypt the app secret
    let appSecret: string;
    try {
      appSecret = decrypt(tenant.whatsappAppSecret);
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to decrypt app secret');
      throw new UnauthorizedError('Invalid webhook configuration');
    }

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(req.rawBody, 'utf8')
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const isValid = secureCompare(actualSignature, expectedSignature);

    if (!isValid) {
      logger.warn({
        tenantId,
        actualSignature,
        expectedSignature: expectedSignature.substring(0, 10) + '...', // Log partial for debugging
        ip: req.ip,
      }, 'Invalid webhook signature');

      // Log to audit for security monitoring
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'WEBHOOK_INVALID_SIGNATURE',
          entity: 'Webhook',
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            url: req.url,
            timestamp: new Date().toISOString(),
          },
        },
      }).catch(err => logger.error({ err }, 'Failed to create audit log'));

      throw new UnauthorizedError('Invalid webhook signature');
    }

    // Mark webhook as verified
    req.webhookVerified = true;

    logger.debug({
      tenantId,
      url: req.url,
      ip: req.ip,
    }, 'Webhook signature verified successfully');

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Handles WhatsApp webhook verification (GET request)
 * This is called when setting up the webhook URL in Meta Business Platform
 */
export function handleWebhookVerification(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method !== 'GET') {
    return next();
  }

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info({
    mode,
    token: token ? '***' : undefined,
    hasChallenge: !!challenge,
  }, 'Webhook verification request');

  if (mode !== 'subscribe') {
    return res.status(400).json({
      error: 'Invalid verification mode',
    });
  }

  // Get expected token from environment or tenant config
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!token || token !== expectedToken) {
    logger.warn({
      ip: req.ip,
      providedToken: token ? '***' : undefined,
    }, 'Invalid webhook verification token');

    return res.status(403).json({
      error: 'Invalid verify token',
    });
  }

  // Respond with the challenge to verify the webhook
  logger.info('Webhook verified successfully');
  res.status(200).send(challenge);
}

/**
 * Rate limiting specifically for webhooks
 * WhatsApp can send bursts of webhooks, so we need higher limits
 */
export function webhookRateLimiter(
  req: WebhookRequest,
  res: Response,
  next: NextFunction
) {
  // Skip rate limiting for verified webhooks
  if (req.webhookVerified) {
    return next();
  }

  // Apply strict rate limiting for non-verified requests
  // This is handled by the general rate limiter
  next();
}

/**
 * Logs webhook events for debugging and audit
 */
export async function logWebhookEvent(
  req: WebhookRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.webhookVerified || req.method === 'GET') {
    return next();
  }

  try {
    const body = req.body;
    const tenantId = req.tenantId;

    await prisma.webhookEvent.create({
      data: {
        tenantId,
        source: 'whatsapp',
        event: body.entry?.[0]?.changes?.[0]?.field || 'unknown',
        payload: body as any,
        processed: false,
        createdAt: new Date(),
      },
    }).catch(err => {
      // Don't block the request if logging fails
      logger.error({ err }, 'Failed to log webhook event');
    });

    next();
  } catch (error) {
    // Don't block the request if logging fails
    logger.error({ error }, 'Error in webhook logging');
    next();
  }
}