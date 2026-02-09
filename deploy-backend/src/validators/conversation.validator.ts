import { z } from 'zod';

export const listConversationsSchema = z.object({
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().uuid().optional(),
  isOpportunity: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateConversationSchema = z.object({
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const assignConversationSchema = z.object({
  userId: z.string().uuid(),
});

export const createConversationSchema = z.object({
  contactPhoneNumber: z.string()
    .min(10, 'Número de telefone deve ter no mínimo 10 dígitos')
    .max(15, 'Número de telefone deve ter no máximo 15 dígitos')
    .regex(/^\d+$/, 'Número de telefone deve conter apenas dígitos'),

  status: z.enum([
    'BOT_HANDLING',
    'OPEN',
    'IN_PROGRESS',
    'WAITING',
    'CLOSED'
  ]).optional().default('OPEN'),

  source: z.enum(['n8n', 'manual', 'webhook', 'whatsapp']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  metadata: z.record(z.any()).optional(),
  assignedToId: z.string().uuid().optional(),
});

export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type AssignConversationInput = z.infer<typeof assignConversationSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
