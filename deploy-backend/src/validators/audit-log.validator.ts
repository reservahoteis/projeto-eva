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

// Types inferidos
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
export type GetAuditLogParams = z.infer<typeof getAuditLogParamsSchema>;
