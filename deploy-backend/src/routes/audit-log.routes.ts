import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireTenant } from '@/middlewares/tenant.middleware';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  listAuditLogsSchema,
  getAuditLogParamsSchema,
} from '@/validators/audit-log.validator';
import { listAuditLogs, getAuditLogById } from '@/controllers/audit-log.controller';

const router = Router();

// Todas as rotas requerem autenticacao, tenant e role ADMIN+
router.use(authenticate);
router.use(requireTenant);
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));

// Listar audit logs (paginado, com filtros)
router.get('/', validate(listAuditLogsSchema, 'query'), listAuditLogs);

// Detalhe de um audit log
router.get('/:id', validate(getAuditLogParamsSchema, 'params'), getAuditLogById);

export default router;
