import { z } from 'zod';

/**
 * Schema para listar tags
 */
export const listTagsQuerySchema = z.object({
  search: z.string().optional(),
});

/**
 * Schema para criar tag
 */
export const createTagSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio').max(50, 'Nome deve ter no maximo 50 caracteres'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hex: #FF5733'),
});

/**
 * Schema para atualizar tag
 */
export const updateTagParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

export const updateTagBodySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato hex: #FF5733').optional(),
});

/**
 * Schema para deletar tag
 */
export const deleteTagParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

/**
 * Schema para adicionar/remover tag de conversa
 */
export const tagConversationSchema = z.object({
  conversationId: z.string().uuid('conversationId invalido'),
  tagId: z.string().uuid('tagId invalido'),
});

// Types inferidos
export type ListTagsQuery = z.infer<typeof listTagsQuerySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagParams = z.infer<typeof updateTagParamsSchema>;
export type UpdateTagBody = z.infer<typeof updateTagBodySchema>;
export type DeleteTagParams = z.infer<typeof deleteTagParamsSchema>;
export type TagConversationInput = z.infer<typeof tagConversationSchema>;
