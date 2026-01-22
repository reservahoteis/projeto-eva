import { Router } from 'express';
import { contactController } from '@/controllers/contact.controller';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createContactSchema,
  updateContactSchema,
  listContactsSchema,
  getContactByIdSchema,
  deleteContactSchema,
  getContactByPhoneSchema,
} from '@/validators/contact.validator';

const router = Router();

/**
 * Todas as rotas requerem autenticação
 */
router.use(authenticate);

/**
 * Apenas TENANT_ADMIN e SUPER_ADMIN podem acessar contatos
 * HEAD não tem acesso a esta seção
 */
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));

/**
 * GET /api/contacts
 * Listar contatos do tenant com paginação e busca
 */
router.get(
  '/',
  validate(listContactsSchema, 'query'),
  contactController.list
);

/**
 * GET /api/contacts/stats
 * Obter estatísticas dos contatos
 * Nota: Esta rota deve vir antes de /:id para evitar conflito
 */
router.get(
  '/stats',
  contactController.getStats
);

/**
 * GET /api/contacts/phone/:phoneNumber
 * Buscar contato por número de telefone
 */
router.get(
  '/phone/:phoneNumber',
  validate(getContactByPhoneSchema, 'params'),
  contactController.getByPhone
);

/**
 * GET /api/contacts/:id
 * Buscar contato por ID
 */
router.get(
  '/:id',
  validate(getContactByIdSchema, 'params'),
  contactController.getById
);

/**
 * POST /api/contacts
 * Criar novo contato
 */
router.post(
  '/',
  validate(createContactSchema),
  contactController.create
);

/**
 * PATCH /api/contacts/:id
 * Atualizar contato existente
 */
router.patch(
  '/:id',
  validate(updateContactSchema),
  contactController.update
);

/**
 * DELETE /api/contacts/:id
 * Deletar contato
 */
router.delete(
  '/:id',
  validate(deleteContactSchema, 'params'),
  contactController.delete
);

export default router;