import { Router } from 'express';
import { webhookControllerV2 } from '@/controllers/webhook.controller.v2';
import { webhookLimiter } from '@/middlewares/rate-limit.middleware';

const router = Router();

/**
 * GET /webhooks/whatsapp - Verificação do webhook (Meta)
 *
 * Meta envia GET request com query params:
 * - hub.mode: 'subscribe'
 * - hub.verify_token: token configurado no tenant
 * - hub.challenge: string aleatória para retornar
 *
 * Headers:
 * - X-Tenant-Slug: slug do tenant (recomendado)
 * Ou query param: ?tenant=slug (fallback)
 */
router.get('/whatsapp', webhookControllerV2.verify.bind(webhookControllerV2));

/**
 * POST /webhooks/whatsapp - Receber eventos do WhatsApp
 *
 * Meta envia POST request com eventos de:
 * - messages: mensagens recebidas
 * - message_status: status de mensagens enviadas (sent, delivered, read, failed)
 * - account_update: atualizações de conta
 * - account_alerts: alertas de conta
 * - message_template_status_update: status de templates
 *
 * Headers:
 * - X-Hub-Signature-256: assinatura HMAC SHA256 (validação obrigatória!)
 * - X-Tenant-Slug: slug do tenant (recomendado)
 * Ou query param: ?tenant=slug (fallback)
 *
 * Rate Limiting:
 * - Max 1000 requests por 1 minuto por IP
 */
router.post(
  '/whatsapp',
  webhookLimiter,
  webhookControllerV2.handleWhatsApp.bind(webhookControllerV2)
);

export default router;
