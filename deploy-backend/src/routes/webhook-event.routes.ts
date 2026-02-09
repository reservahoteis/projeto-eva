import { Router } from 'express';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  listWebhookEventsSchema,
  webhookEventParamsSchema,
} from '@/validators/webhook-event.validator';
import {
  listWebhookEvents,
  getWebhookEventById,
  replayWebhookEvent,
  deleteWebhookEvent,
} from '@/controllers/webhook-event.controller';

const router = Router();

// Todas as rotas requerem autenticacao, tenant e role ADMIN+
router.use(authenticate);
router.use(requireTenant);
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));

// Listar webhook events (paginado, com filtros)
router.get('/', validate(listWebhookEventsSchema, 'query'), listWebhookEvents);

// Detalhe de um webhook event (com payload)
router.get('/:id', validate(webhookEventParamsSchema, 'params'), getWebhookEventById);

// Replay webhook event
router.post('/:id/replay', validate(webhookEventParamsSchema, 'params'), replayWebhookEvent);

// Deletar webhook event
router.delete('/:id', validate(webhookEventParamsSchema, 'params'), deleteWebhookEvent);

export default router;
