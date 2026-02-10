import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { reportQuerySchema } from '../validators/report.validator';

const router = Router();

/**
 * Todas as rotas requerem autenticação
 */
router.use(authenticate);

/**
 * Apenas TENANT_ADMIN e SUPER_ADMIN podem acessar relatórios
 * HEAD e ATTENDANT não têm acesso a esta seção
 */
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));

/**
 * GET /api/reports/overview
 * Retorna overview com métricas gerais
 */
router.get(
  '/overview',
  validate(reportQuerySchema, 'query'),
  reportController.getOverview
);

/**
 * GET /api/reports/attendants
 * Retorna performance por atendente
 */
router.get(
  '/attendants',
  validate(reportQuerySchema, 'query'),
  reportController.getAttendantsPerformance
);

/**
 * GET /api/reports/hourly
 * Retorna volume de mensagens por hora
 */
router.get(
  '/hourly',
  validate(reportQuerySchema, 'query'),
  reportController.getHourlyVolume
);

/**
 * GET /api/reports/outside-hours
 * Retorna conversas fora do horario comercial
 */
router.get(
  '/outside-hours',
  validate(reportQuerySchema, 'query'),
  reportController.getOutsideBusinessHours
);

export default router;
