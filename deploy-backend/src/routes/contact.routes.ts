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
 * Roles com acesso de leitura (GET)
 */
const READ_ROLES = ['TENANT_ADMIN', 'SUPER_ADMIN', 'SALES', 'HEAD', 'ATTENDANT'] as const;

/**
 * Roles com acesso de escrita (POST, PATCH, DELETE)
 */
const WRITE_ROLES = ['TENANT_ADMIN', 'SUPER_ADMIN'] as const;

/**
 * Roles com acesso de exportacao (dados sensíveis em massa)
 */
const EXPORT_ROLES = ['TENANT_ADMIN', 'SUPER_ADMIN', 'HEAD'] as const;

// ===================== ROTAS DE LEITURA =====================

/**
 * GET /api/contacts
 * Listar contatos do tenant com paginação e busca
 */
router.get(
  '/',
  authorize([...READ_ROLES]),
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
  authorize([...READ_ROLES]),
  contactController.getStats
);

/**
 * GET /api/contacts/export
 * Exportar contatos para Excel
 * Nota: Esta rota deve vir antes de /:id para evitar conflito
 */
router.get(
  '/export',
  authorize([...EXPORT_ROLES]),
  contactController.exportExcel
);

/**
 * GET /api/contacts/phone/:phoneNumber
 * Buscar contato por número de telefone
 */
router.get(
  '/phone/:phoneNumber',
  authorize([...READ_ROLES]),
  validate(getContactByPhoneSchema, 'params'),
  contactController.getByPhone
);

/**
 * GET /api/contacts/:id/conversations
 * Buscar conversas de um contato
 * Nota: Esta rota deve vir antes de /:id para evitar conflito
 */
router.get(
  '/:id/conversations',
  authorize([...READ_ROLES]),
  validate(getContactByIdSchema, 'params'),
  contactController.getConversations.bind(contactController)
);

/**
 * GET /api/contacts/:id
 * Buscar contato por ID
 */
router.get(
  '/:id',
  authorize([...READ_ROLES]),
  validate(getContactByIdSchema, 'params'),
  contactController.getById
);

// ===================== ROTAS DE ESCRITA =====================

/**
 * POST /api/contacts
 * Criar novo contato
 */
router.post(
  '/',
  authorize([...WRITE_ROLES]),
  validate(createContactSchema),
  contactController.create
);

/**
 * PATCH /api/contacts/:id
 * Atualizar contato existente
 */
router.patch(
  '/:id',
  authorize([...WRITE_ROLES]),
  validate(updateContactSchema),
  contactController.update
);

/**
 * DELETE /api/contacts/:id
 * Deletar contato
 */
router.delete(
  '/:id',
  authorize([...WRITE_ROLES]),
  validate(deleteContactSchema, 'params'),
  contactController.delete
);

export default router;