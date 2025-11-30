import { z } from 'zod';

/**
 * Schema para criar uma escalacao (chamado pelo N8N)
 */
export const createEscalationSchema = z.object({
  // Telefone do contato (obrigatorio)
  contactPhoneNumber: z.string()
    .min(10, 'Numero de telefone deve ter no minimo 10 digitos')
    .max(15, 'Numero de telefone deve ter no maximo 15 digitos')
    .regex(/^\d+$/, 'Numero de telefone deve conter apenas digitos'),

  // Motivo da escalacao
  reason: z.enum([
    'USER_REQUESTED',
    'AI_UNABLE',
    'COMPLEX_QUERY',
    'COMPLAINT',
    'SALES_OPPORTUNITY',
    'URGENCY',
    'OTHER',
  ]),

  // Descricao livre do motivo
  reasonDetail: z.string().max(2000).optional(),

  // Unidade hoteleira
  hotelUnit: z.enum([
    'Campos do Jordao',
    'Ilhabela',
    'Camburi',
    'Santo Antonio do Pinhal',
  ]).optional(),

  // Historico de mensagens da conversa atual (vindo do N8N/Redis)
  messageHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional(),

  // Contexto adicional da IA
  aiContext: z.record(z.any()).optional(),

  // Prioridade (default: HIGH para escalacoes)
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('HIGH'),
});

/**
 * Schema para listar escalacoes
 */
export const listEscalationsSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']).optional(),
  hotelUnit: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Schema para atualizar escalacao
 */
export const updateEscalationSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']).optional(),
});

/**
 * Schema para toggle IA lock na conversa
 */
export const toggleIaLockSchema = z.object({
  locked: z.boolean(),
});

export type CreateEscalationInput = z.infer<typeof createEscalationSchema>;
export type ListEscalationsInput = z.infer<typeof listEscalationsSchema>;
export type UpdateEscalationInput = z.infer<typeof updateEscalationSchema>;
export type ToggleIaLockInput = z.infer<typeof toggleIaLockSchema>;
