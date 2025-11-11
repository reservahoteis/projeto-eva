import { Router } from 'express';
import { conversationController } from '@/controllers/conversation.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import { listConversationsSchema, updateConversationSchema, assignConversationSchema } from '@/validators/conversation.validator';

const router = Router();

// Todas as rotas requerem autenticação e tenant
router.use(authenticate);
router.use(requireTenant);

// GET /api/conversations
router.get('/', validate(listConversationsSchema, 'query'), conversationController.list.bind(conversationController));

// GET /api/conversations/:id
router.get('/:id', conversationController.getById.bind(conversationController));

// PATCH /api/conversations/:id
router.patch('/:id', validate(updateConversationSchema), conversationController.update.bind(conversationController));

// POST /api/conversations/:id/assign
router.post('/:id/assign', validate(assignConversationSchema), conversationController.assign.bind(conversationController));

// POST /api/conversations/:id/close
router.post('/:id/close', conversationController.close.bind(conversationController));

export default router;
