import { Router } from 'express';
import { messageController } from '@/controllers/message.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';

const router = Router();

// Todas as rotas requerem autenticação e tenant
router.use(authenticate);
router.use(requireTenant);

// ============================================
// Global Message Operations (Non-nested)
// ============================================
// These routes are for operations that don't belong to a specific conversation
// or operations that span multiple conversations

// GET /api/messages/search
// Global message search across all conversations
// Use cases: Admin searching for specific content, compliance checks
router.get('/search', messageController.search.bind(messageController));

// POST /api/messages/:id/read
// Mark a specific message as read (by message ID)
// Note: This is a global operation because it's message-centric, not conversation-centric
router.post('/:id/read', messageController.markAsRead.bind(messageController));

// ============================================
// Deprecated Routes - For Backward Compatibility
// ============================================
// These routes are kept for backward compatibility but should be migrated
// to the nested pattern under /api/conversations/:id/messages

// DEPRECATED: Use GET /api/conversations/:conversationId/messages instead
router.get(
  '/conversations/:conversationId/messages',
  (_req, _res, next) => {
    console.warn(
      `DEPRECATED: GET /api/messages/conversations/:conversationId/messages is deprecated. ` +
      `Use GET /api/conversations/:conversationId/messages instead`
    );
    next();
  },
  validate(require('@/validators/message.validator').listMessagesSchema, 'query'),
  messageController.list.bind(messageController)
);

// DEPRECATED: Use GET /api/conversations/:conversationId/messages/stats instead
router.get(
  '/conversations/:conversationId/stats',
  (_req, _res, next) => {
    console.warn(
      `DEPRECATED: GET /api/messages/conversations/:conversationId/stats is deprecated. ` +
      `Use GET /api/conversations/:conversationId/messages/stats instead`
    );
    next();
  },
  messageController.getStats.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages instead
router.post(
  '/',
  (_req, _res, next) => {
    console.warn(
      `DEPRECATED: POST /api/messages is deprecated. ` +
      `Use POST /api/conversations/:conversationId/messages instead`
    );
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  validate(require('@/validators/message.validator').sendMessageSchema),
  messageController.send.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages/template instead
router.post(
  '/template',
  (_req, _res, next) => {
    console.warn(
      `DEPRECATED: POST /api/messages/template is deprecated. ` +
      `Use POST /api/conversations/:conversationId/messages/template instead`
    );
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  messageController.sendTemplate.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages/buttons instead
router.post(
  '/buttons',
  (_req, _res, next) => {
    console.warn(
      `DEPRECATED: POST /api/messages/buttons is deprecated. ` +
      `Use POST /api/conversations/:conversationId/messages/buttons instead`
    );
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  messageController.sendButtons.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages/list instead
router.post(
  '/list',
  (_req, _res, next) => {
    console.warn(
      `DEPRECATED: POST /api/messages/list is deprecated. ` +
      `Use POST /api/conversations/:conversationId/messages/list instead`
    );
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  messageController.sendList.bind(messageController)
);

export default router;