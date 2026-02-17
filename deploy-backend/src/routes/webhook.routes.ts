import { Router } from 'express';
import { webhookControllerV2 } from '@/controllers/webhook.controller.v2';
import { messengerWebhookController } from '@/controllers/messenger-webhook.controller';
import { instagramWebhookController } from '@/controllers/instagram-webhook.controller';
import { webhookLimiter } from '@/middlewares/rate-limit.middleware';

const router = Router();

// WhatsApp
router.get('/whatsapp', webhookControllerV2.verify.bind(webhookControllerV2));
router.post('/whatsapp', webhookLimiter, webhookControllerV2.handleWhatsApp.bind(webhookControllerV2));

// Messenger
router.get('/messenger', messengerWebhookController.verify.bind(messengerWebhookController));
router.post('/messenger', webhookLimiter, messengerWebhookController.handleMessenger.bind(messengerWebhookController));

// Instagram
router.get('/instagram', instagramWebhookController.verify.bind(instagramWebhookController));
router.post('/instagram', webhookLimiter, instagramWebhookController.handleInstagram.bind(instagramWebhookController));

export default router;
