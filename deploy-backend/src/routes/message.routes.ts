import { Router } from 'express';
import { messageController } from '@/controllers/message.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import logger from '@/config/logger';

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
  (req, _res, next) => {
    logger.warn({
      deprecatedRoute: 'GET /api/messages/conversations/:conversationId/messages',
      newRoute: 'GET /api/conversations/:conversationId/messages',
      ip: req.ip,
    }, 'Deprecated route accessed');
    next();
  },
  validate(require('@/validators/message.validator').listMessagesSchema, 'query'),
  messageController.list.bind(messageController)
);

// DEPRECATED: Use GET /api/conversations/:conversationId/messages/stats instead
router.get(
  '/conversations/:conversationId/stats',
  (req, _res, next) => {
    logger.warn({
      deprecatedRoute: 'GET /api/messages/conversations/:conversationId/stats',
      newRoute: 'GET /api/conversations/:conversationId/messages/stats',
      ip: req.ip,
    }, 'Deprecated route accessed');
    next();
  },
  messageController.getStats.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages instead
router.post(
  '/',
  (req, _res, next) => {
    logger.warn({
      deprecatedRoute: 'POST /api/messages',
      newRoute: 'POST /api/conversations/:conversationId/messages',
      ip: req.ip,
    }, 'Deprecated route accessed');
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  validate(require('@/validators/message.validator').sendMessageSchema),
  messageController.send.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages/template instead
router.post(
  '/template',
  (req, _res, next) => {
    logger.warn({
      deprecatedRoute: 'POST /api/messages/template',
      newRoute: 'POST /api/conversations/:conversationId/messages/template',
      ip: req.ip,
    }, 'Deprecated route accessed');
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  messageController.sendTemplate.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages/buttons instead
router.post(
  '/buttons',
  (req, _res, next) => {
    logger.warn({
      deprecatedRoute: 'POST /api/messages/buttons',
      newRoute: 'POST /api/conversations/:conversationId/messages/buttons',
      ip: req.ip,
    }, 'Deprecated route accessed');
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  messageController.sendButtons.bind(messageController)
);

// DEPRECATED: Use POST /api/conversations/:conversationId/messages/list instead
router.post(
  '/list',
  (req, _res, next) => {
    logger.warn({
      deprecatedRoute: 'POST /api/messages/list',
      newRoute: 'POST /api/conversations/:conversationId/messages/list',
      ip: req.ip,
    }, 'Deprecated route accessed');
    next();
  },
  require('@/middlewares/rate-limit.middleware').createLimiter,
  messageController.sendList.bind(messageController)
);

export default router;