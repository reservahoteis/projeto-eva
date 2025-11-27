import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserParamsSchema,
  updateUserBodySchema,
  updateUserStatusParamsSchema,
  updateUserStatusBodySchema,
  deleteUserParamsSchema,
} from '../validators/user.validator';

const router = Router();

/**
 * Todas as rotas requerem autenticação
 */
router.use(authenticate);

/**
 * Apenas TENANT_ADMIN e SUPER_ADMIN podem gerenciar usuários
 */
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));

/**
 * GET /api/users
 * Listar usuários do tenant
 */
router.get(
  '/',
  validate(listUsersQuerySchema, 'query'),
  userController.listUsers
);

/**
 * GET /api/users/:id
 * Buscar usuário por ID
 */
router.get(
  '/:id',
  userController.getUserById
);

/**
 * POST /api/users
 * Criar novo usuário
 */
router.post(
  '/',
  validate(createUserSchema, 'body'),
  userController.createUser
);

/**
 * PATCH /api/users/:id
 * Atualizar usuário
 */
router.patch(
  '/:id',
  validate(updateUserParamsSchema, 'params'),
  validate(updateUserBodySchema, 'body'),
  userController.updateUser
);

/**
 * PATCH /api/users/:id/status
 * Atualizar status do usuário (ativar/suspender)
 */
router.patch(
  '/:id/status',
  validate(updateUserStatusParamsSchema, 'params'),
  validate(updateUserStatusBodySchema, 'body'),
  userController.updateUserStatus
);

/**
 * DELETE /api/users/:id
 * Deletar usuário
 */
router.delete(
  '/:id',
  validate(deleteUserParamsSchema, 'params'),
  userController.deleteUser
);

export default router;
