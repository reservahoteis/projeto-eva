import { z } from 'zod';

/**
 * Schema para listar audit logs
 */
export const listAuditLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  entity: z.string().optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Schema para params de audit log por ID
 */
export const getAuditLogParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

/**
 * Schema para reportar erro client-side
 */
export const reportClientErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(5000).optional(),
  componentStack: z.string().max(5000).optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});

// Types inferidos
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
export type GetAuditLogParams = z.infer<typeof getAuditLogParamsSchema>;
export type ReportClientErrorBody = z.infer<typeof reportClientErrorSchema>;
