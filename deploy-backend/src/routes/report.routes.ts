import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { reportQuerySchema } from '../validators/report.validator';

const router = Router();

/**
 * Todas as rotas requerem autenticação
 */
router.use(authenticate);

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

export default router;
