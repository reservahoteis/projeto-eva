import { Router } from 'express';
import { webhookControllerV2 } from '@/controllers/webhook.controller.v2';
import { messengerWebhookController } from '@/controllers/messenger-webhook.controller';
import { webhookLimiter } from '@/middlewares/rate-limit.middleware';

const router = Router();

// GET /webhooks/whatsapp - Verificação (Meta)
router.get('/whatsapp', webhookControllerV2.verify.bind(webhookControllerV2));

// POST /webhooks/whatsapp - Receber eventos
router.post('/whatsapp', webhookLimiter, webhookControllerV2.handleWhatsApp.bind(webhookControllerV2));

// GET /webhooks/messenger - Verificação (Meta Messenger)
router.get('/messenger', messengerWebhookController.verify.bind(messengerWebhookController));

// POST /webhooks/messenger - Receber eventos Messenger
router.post('/messenger', webhookLimiter, messengerWebhookController.handleMessenger.bind(messengerWebhookController));

export default router;
