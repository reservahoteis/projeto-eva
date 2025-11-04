import { Router } from 'express';
import { messageController } from '@/controllers/message.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant, verifyTenantAccess } from '@/middlewares/tenant.middleware';
import { sendMessageSchema, listMessagesSchema } from '@/validators/message.validator';
import { createLimiter } from '@/middlewares/rate-limit.middleware';

const router = Router();

// Todas as rotas requerem autenticação e tenant
router.use(authenticate);
router.use(requireTenant);
router.use(verifyTenantAccess);

// GET /api/conversations/:conversationId/messages
router.get(
  '/conversations/:conversationId/messages',
  validate(listMessagesSchema, 'query'),
  messageController.list.bind(messageController)
);

// POST /api/messages
router.post(
  '/',
  createLimiter,
  validate(sendMessageSchema),
  messageController.send.bind(messageController)
);

// POST /api/messages/:id/read
router.post('/:id/read', messageController.markAsRead.bind(messageController));

export default router;
