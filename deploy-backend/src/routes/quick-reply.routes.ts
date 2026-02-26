import { Router } from 'express';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  listQuickRepliesQuerySchema,
  getQuickReplyByIdParamsSchema,
  createQuickReplySchema,
  updateQuickReplyBodySchema,
  updateQuickReplyParamsSchema,
  deleteQuickReplyParamsSchema,
} from '@/validators/quick-reply.validator';
import {
  listQuickReplies,
  getQuickReplyById,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
} from '@/controllers/quick-reply.controller';

const router = Router();

// Todas as rotas requerem autenticacao e tenant
router.use(authenticate);
router.use(requireTenant);

// READ: Todos autenticados (atendentes precisam para o popup do chat)
router.get('/', validate(listQuickRepliesQuerySchema, 'query'), listQuickReplies);
router.get('/:id', validate(getQuickReplyByIdParamsSchema, 'params'), getQuickReplyById);

// WRITE: Apenas admins
router.post('/', authorize(['SUPER_ADMIN', 'TENANT_ADMIN']), validate(createQuickReplySchema), createQuickReply);
router.patch('/:id', authorize(['SUPER_ADMIN', 'TENANT_ADMIN']), validate(updateQuickReplyParamsSchema, 'params'), validate(updateQuickReplyBodySchema), updateQuickReply);
router.delete('/:id', authorize(['SUPER_ADMIN', 'TENANT_ADMIN']), validate(deleteQuickReplyParamsSchema, 'params'), deleteQuickReply);

export default router;
