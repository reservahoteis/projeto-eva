import { Router } from 'express';
import { conversationController } from '@/controllers/conversation.controller';
import { messageController } from '@/controllers/message.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import {
  listConversationsSchema,
  updateConversationSchema,
  assignConversationSchema,
  createConversationSchema,
} from '@/validators/conversation.validator';
import { toggleIaLockSchema } from '@/validators/escalation.validator';
import { sendMessageSchema, listMessagesSchema } from '@/validators/message.validator';
import { createLimiter } from '@/middlewares/rate-limit.middleware';
import { escalationService } from '@/services/escalation.service';

const router = Router();

// Todas as rotas requerem autenticação e tenant
router.use(authenticate);
router.use(requireTenant);

// ============================================
// Conversation Routes - Top Level
// ============================================

// GET /api/conversations/stats - DEVE VIR ANTES da rota /:id para não conflitar
router.get('/stats', conversationController.getStats.bind(conversationController));

// GET /api/conversations
router.get('/', validate(listConversationsSchema, 'query'), conversationController.list.bind(conversationController));

// POST /api/conversations
// Criar nova conversa (N8N integration)
router.post(
  '/',
  validate(createConversationSchema),
  conversationController.create.bind(conversationController)
);

// GET /api/conversations/:id
router.get('/:id', conversationController.getById.bind(conversationController));

// PATCH /api/conversations/:id
router.patch('/:id', validate(updateConversationSchema), conversationController.update.bind(conversationController));

// POST /api/conversations/:id/assign
router.post('/:id/assign', validate(assignConversationSchema), conversationController.assign.bind(conversationController));

// POST /api/conversations/:id/close
router.post('/:id/close', conversationController.close.bind(conversationController));

// PATCH /api/conversations/:id/ia-lock
// Toggle IA lock (travar/destravar IA para esta conversa)
router.patch(
  '/:id/ia-lock',
  validate(toggleIaLockSchema),
  async (req, res) => {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({ error: 'ID da conversa não fornecido' });
      }

      const { locked } = req.body;

      if (!req.tenantId) {
        return res.status(400).json({ error: 'Tenant ID nao encontrado' });
      }

      if (!req.user?.id) {
        return res.status(401).json({ error: 'Usuario nao autenticado' });
      }

      // tenantId validado acima - type narrowing garantido
      const tenantId: string = req.tenantId;
      const updated = await escalationService.toggleIaLock(
        id,
        tenantId,
        locked,
        req.user.id
      );

      return res.json(updated);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Erro interno' });
    }
  }
);

// ============================================
// Nested Message Routes (RESTful Pattern)
// ============================================
// Messages belong to conversations, therefore they are nested resources
// Pattern: /api/conversations/:conversationId/messages
// Reference: REST API Design Rulebook (O'Reilly), Google API Design Guide

// GET /api/conversations/:conversationId/messages
// List all messages from a conversation
router.get(
  '/:conversationId/messages',
  validate(listMessagesSchema, 'query'),
  messageController.list.bind(messageController)
);

// POST /api/conversations/:conversationId/messages
// Send a new message to a conversation (text or media)
router.post(
  '/:conversationId/messages',
  createLimiter,
  validate(sendMessageSchema),
  async (req, res) => {
    // Adicionar conversationId ao body para manter compatibilidade com o controller
    req.body.conversationId = req.params.conversationId;
    return messageController.send(req, res);
  }
);

// GET /api/conversations/:conversationId/messages/stats
// Get message statistics for a conversation
router.get(
  '/:conversationId/messages/stats',
  messageController.getStats.bind(messageController)
);

// POST /api/conversations/:conversationId/messages/template
// Send a template message to a conversation
router.post(
  '/:conversationId/messages/template',
  createLimiter,
  async (req, res) => {
    req.body.conversationId = req.params.conversationId;
    return messageController.sendTemplate(req, res);
  }
);

// POST /api/conversations/:conversationId/messages/buttons
// Send interactive button message
router.post(
  '/:conversationId/messages/buttons',
  createLimiter,
  async (req, res) => {
    req.body.conversationId = req.params.conversationId;
    return messageController.sendButtons(req, res);
  }
);

// POST /api/conversations/:conversationId/messages/list
// Send interactive list message
router.post(
  '/:conversationId/messages/list',
  createLimiter,
  async (req, res) => {
    req.body.conversationId = req.params.conversationId;
    return messageController.sendList(req, res);
  }
);

// GET /api/conversations/:conversationId/messages/:messageId
// Get a specific message (future implementation)
// router.get('/:conversationId/messages/:messageId', messageController.getById.bind(messageController));

// PATCH /api/conversations/:conversationId/messages/:messageId
// Update a message (future implementation for editing)
// router.patch('/:conversationId/messages/:messageId', messageController.update.bind(messageController));

// DELETE /api/conversations/:conversationId/messages/:messageId
// Delete a message (future implementation)
// router.delete('/:conversationId/messages/:messageId', messageController.delete.bind(messageController));

export default router;
