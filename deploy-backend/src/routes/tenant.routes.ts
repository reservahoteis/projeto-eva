import { Router } from 'express';
import { tenantController } from '@/controllers/tenant.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate, authorize } from '@/middlewares/auth.middleware';
import { requireNoTenant, requireTenant } from '@/middlewares/tenant.middleware';
import { createTenantSchema, updateTenantSchema, configureWhatsAppSchema } from '@/validators/tenant.validator';

const router = Router();

// ============================================
// SUPER ADMIN ROUTES (sem tenant)
// ============================================

// POST /api/tenants - Criar tenant
router.post(
  '/',
  authenticate,
  authorize(['SUPER_ADMIN']),
  requireNoTenant,
  validate(createTenantSchema),
  tenantController.create.bind(tenantController)
);

// GET /api/tenants - Listar todos
router.get(
  '/',
  authenticate,
  authorize(['SUPER_ADMIN']),
  requireNoTenant,
  tenantController.list.bind(tenantController)
);

// GET /api/tenants/:id - Buscar por ID
router.get(
  '/:id',
  authenticate,
  authorize(['SUPER_ADMIN']),
  requireNoTenant,
  tenantController.getById.bind(tenantController)
);

// PATCH /api/tenants/:id - Atualizar
router.patch(
  '/:id',
  authenticate,
  authorize(['SUPER_ADMIN']),
  requireNoTenant,
  validate(updateTenantSchema),
  tenantController.update.bind(tenantController)
);

// DELETE /api/tenants/:id - Deletar
router.delete(
  '/:id',
  authenticate,
  authorize(['SUPER_ADMIN']),
  requireNoTenant,
  tenantController.delete.bind(tenantController)
);

// ============================================
// TENANT ADMIN ROUTES (com tenant)
// ============================================

// POST /api/tenant/whatsapp-config - Configurar WhatsApp
router.post(
  '/whatsapp-config',
  authenticate,
  authorize(['TENANT_ADMIN']),
  requireTenant,
  validate(configureWhatsAppSchema),
  tenantController.configureWhatsApp.bind(tenantController)
);

// GET /api/tenant/whatsapp-config - Ver config
router.get(
  '/whatsapp-config',
  authenticate,
  authorize(['TENANT_ADMIN']),
  requireTenant,
  tenantController.getWhatsAppConfig.bind(tenantController)
);

export default router;
