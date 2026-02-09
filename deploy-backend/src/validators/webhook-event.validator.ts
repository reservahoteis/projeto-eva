import { z } from 'zod';

/**
 * Schema para listar webhook events
 */
export const listWebhookEventsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  source: z.string().optional(),
  event: z.string().optional(),
  processed: z.enum(['true', 'false']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Schema para params por ID
 */
export const webhookEventParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

// Types inferidos
export type ListWebhookEventsQuery = z.infer<typeof listWebhookEventsSchema>;
export type WebhookEventParams = z.infer<typeof webhookEventParamsSchema>;
