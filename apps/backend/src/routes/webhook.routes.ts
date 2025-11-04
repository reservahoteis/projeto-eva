import { Router } from 'express';
import { webhookController } from '@/controllers/webhook.controller';
import { webhookLimiter } from '@/middlewares/rate-limit.middleware';

const router = Router();

// GET /webhooks/whatsapp - Verificação (Meta)
router.get('/whatsapp', webhookController.verify.bind(webhookController));

// POST /webhooks/whatsapp - Receber eventos
router.post('/whatsapp', webhookLimiter, webhookController.handleWhatsApp.bind(webhookController));

export default router;
