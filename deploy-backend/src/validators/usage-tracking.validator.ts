import { z } from 'zod';

/**
 * Schema para listar usage tracking
 */
export const listUsageTrackingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Schema para uso corrente (sem params)
 */
export const getCurrentUsageSchema = z.object({});

// Types inferidos
export type ListUsageTrackingQuery = z.infer<typeof listUsageTrackingSchema>;
