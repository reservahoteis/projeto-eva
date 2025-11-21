import { Router } from 'express';
import { webhookControllerV2 } from '@/controllers/webhook.controller.v2';
import { webhookLimiter } from '@/middlewares/rate-limit.middleware';

const router = Router();

// GET /webhooks/whatsapp - Verificação (Meta)
router.get('/whatsapp', webhookControllerV2.verify.bind(webhookControllerV2));

// POST /webhooks/whatsapp - Receber eventos
router.post('/whatsapp', webhookLimiter, webhookControllerV2.handleWhatsApp.bind(webhookControllerV2));

export default router;
