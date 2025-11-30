import { Router } from 'express';
import { escalationController } from '@/controllers/escalation.controller';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import {
  createEscalationSchema,
  listEscalationsSchema,
  updateEscalationSchema,
} from '@/validators/escalation.validator';

const router = Router();

// Todas as rotas requerem autenticacao e tenant
router.use(authenticate);
router.use(requireTenant);

// ============================================
// Escalation Routes
// ============================================

// GET /api/escalations/stats - DEVE VIR ANTES da rota /:id para nao conflitar
router.get('/stats', escalationController.getStats.bind(escalationController));

// GET /api/escalations/check-ia-lock - Verifica se IA esta travada para um telefone
router.get('/check-ia-lock', escalationController.checkIaLock.bind(escalationController));

// GET /api/escalations
router.get(
  '/',
  validate(listEscalationsSchema, 'query'),
  escalationController.list.bind(escalationController)
);

// POST /api/escalations
// Criar nova escalacao (N8N integration)
router.post(
  '/',
  validate(createEscalationSchema),
  escalationController.create.bind(escalationController)
);

// GET /api/escalations/:id
router.get('/:id', escalationController.getById.bind(escalationController));

// PATCH /api/escalations/:id
router.patch(
  '/:id',
  validate(updateEscalationSchema),
  escalationController.update.bind(escalationController)
);

export default router;
