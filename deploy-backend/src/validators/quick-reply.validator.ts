import { z } from 'zod';

/**
 * Schema para listar quick replies
 */
export const listQuickRepliesQuerySchema = z.object({
  search: z.string().max(200, 'Busca deve ter no maximo 200 caracteres').optional(),
  category: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

/**
 * Schema para params de buscar quick reply por ID
 */
export const getQuickReplyByIdParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

/**
 * Schema para criar quick reply
 */
export const createQuickReplySchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio').max(100, 'Titulo deve ter no maximo 100 caracteres'),
  shortcut: z
    .string()
    .min(2, 'Atalho deve ter no minimo 2 caracteres')
    .max(50, 'Atalho deve ter no maximo 50 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Atalho deve conter apenas letras minusculas, numeros e hifens'),
  content: z.string().min(1, 'Conteudo e obrigatorio').max(4000, 'Conteudo deve ter no maximo 4000 caracteres'),
  category: z.string().max(50, 'Categoria deve ter no maximo 50 caracteres').optional(),
  order: z.number().int('Ordem deve ser um numero inteiro').min(0, 'Ordem deve ser maior ou igual a zero').optional(),
});

/**
 * Schema para params de atualizar quick reply
 */
export const updateQuickReplyParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

/**
 * Schema para body de atualizar quick reply
 */
export const updateQuickReplyBodySchema = z.object({
  title: z.string().min(1).max(100).optional(),
  shortcut: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Atalho deve conter apenas letras minusculas, numeros e hifens')
    .optional(),
  content: z.string().min(1).max(4000).optional(),
  category: z.string().max(50).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema para params de deletar quick reply
 */
export const deleteQuickReplyParamsSchema = z.object({
  id: z.string().uuid('ID invalido'),
});

// Types inferidos
export type GetQuickReplyByIdParams = z.infer<typeof getQuickReplyByIdParamsSchema>;
export type ListQuickRepliesQuery = z.infer<typeof listQuickRepliesQuerySchema>;
export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;
export type UpdateQuickReplyParams = z.infer<typeof updateQuickReplyParamsSchema>;
export type UpdateQuickReplyBody = z.infer<typeof updateQuickReplyBodySchema>;
export type DeleteQuickReplyParams = z.infer<typeof deleteQuickReplyParamsSchema>;
