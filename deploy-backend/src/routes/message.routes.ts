import { Router } from 'express';
import { messageController } from '@/controllers/message.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import { sendMessageSchema, listMessagesSchema } from '@/validators/message.validator';
import { createLimiter } from '@/middlewares/rate-limit.middleware';

const router = Router();

// Todas as rotas requerem autenticação e tenant
router.use(authenticate);
router.use(requireTenant);

// ============================================
// Message Listing & Search
// ============================================

// GET /api/conversations/:conversationId/messages
router.get(
  '/conversations/:conversationId/messages',
  validate(listMessagesSchema, 'query'),
  messageController.list.bind(messageController)
);

// GET /api/messages/search
// Busca mensagens por texto (full-text search)
router.get('/search', messageController.search.bind(messageController));

// GET /api/conversations/:conversationId/stats
// Estatísticas de mensagens de uma conversa
router.get(
  '/conversations/:conversationId/stats',
  messageController.getStats.bind(messageController)
);

// ============================================
// Send Messages
// ============================================

// POST /api/messages
// Envia mensagem de texto ou mídia (assíncrono via fila)
router.post(
  '/',
  createLimiter,
  validate(sendMessageSchema),
  messageController.send.bind(messageController)
);

// POST /api/messages/template
// Envia template message (assíncrono via fila)
router.post('/template', createLimiter, messageController.sendTemplate.bind(messageController));

// POST /api/messages/buttons
// Envia mensagem interativa com botões (NOVO no V2)
router.post('/buttons', createLimiter, messageController.sendButtons.bind(messageController));

// POST /api/messages/list
// Envia mensagem interativa com lista (NOVO no V2)
router.post('/list', createLimiter, messageController.sendList.bind(messageController));

// ============================================
// Message Actions
// ============================================

// POST /api/messages/:id/read
// Marca mensagem como lida
router.post('/:id/read', messageController.markAsRead.bind(messageController));

export default router;
