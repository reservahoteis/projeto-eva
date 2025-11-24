import { z } from 'zod';

/**
 * Schema para query params de relatórios
 */
export const reportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d'),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
