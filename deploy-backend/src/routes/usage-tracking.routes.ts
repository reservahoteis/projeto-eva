import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { listUsageTrackingSchema } from '@/validators/usage-tracking.validator';
import { listUsage, getCurrentUsage } from '@/controllers/usage-tracking.controller';

const router = Router();

// Todas as rotas requerem autenticacao, tenant e role ADMIN+
router.use(authenticate);
router.use(requireTenant);
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));

// Listar uso (paginado, com filtro de datas)
router.get('/', validate(listUsageTrackingSchema, 'query'), listUsage);

// Metricas do mes atual
router.get('/current', getCurrentUsage);

export default router;
