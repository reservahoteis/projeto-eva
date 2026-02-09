import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  listTagsQuerySchema,
  createTagSchema,
  updateTagBodySchema,
  updateTagParamsSchema,
  deleteTagParamsSchema,
  tagConversationSchema,
} from '@/validators/tag.validator';
import {
  listTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  addTagToConversation,
  removeTagFromConversation,
} from '@/controllers/tag.controller';

const router = Router();

// Todas as rotas requerem autenticacao e tenant
router.use(authenticate);
router.use(requireTenant);

// CRUD de Tags
router.get('/', validate(listTagsQuerySchema, 'query'), listTags);
router.get('/:id', getTagById);
router.post('/', validate(createTagSchema), createTag);
router.patch('/:id', validate(updateTagParamsSchema, 'params'), validate(updateTagBodySchema), updateTag);
router.delete('/:id', validate(deleteTagParamsSchema, 'params'), deleteTag);

// Associacao Tag <-> Conversa
router.post('/conversation', validate(tagConversationSchema), addTagToConversation);
router.delete('/conversation', validate(tagConversationSchema), removeTagFromConversation);

export default router;
