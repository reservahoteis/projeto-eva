import { z } from 'zod';

// conversationId pode vir do route param OU do body (para POST /api/messages)
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid('conversationId deve ser um UUID válido'),
  content: z.string().min(1, 'Conteúdo é obrigatório').max(4096, 'Conteúdo muito longo'),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  metadata: z.record(z.any()).optional(),
});

export const listMessagesSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform((val) => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)).optional(),
  page: z.string().regex(/^\d+$/).transform((val) => parseInt(val, 10)).pipe(z.number().int().min(1)).optional(),
  before: z.string().uuid().optional(),
  after: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
