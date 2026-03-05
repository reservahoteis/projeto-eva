import { z } from 'zod';

/**
 * Schema de validação para criação de contato
 */
export const createContactSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, 'Número deve ter no mínimo 10 dígitos')
    .max(15, 'Número deve ter no máximo 15 dígitos')
    .regex(/^\d+$/, 'Apenas dígitos são permitidos no telefone')
    .refine((val) => {
      // Validação adicional para números brasileiros
      const isBrazilian = val.startsWith('55');
      if (isBrazilian && val.length < 12) {
        return false;
      }
      return true;
    }, 'Número brasileiro deve incluir código do país (55) + DDD + número'),

  name: z
    .string()
    .min(1, 'Nome deve ter pelo menos 1 caractere')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim()
    .optional(),

  email: z
    .string()
    .email('Email inválido')
    .toLowerCase()
    .trim()
    .optional(),

  profilePictureUrl: z
    .string()
    .url('URL da foto de perfil inválida')
    .optional(),

  firstName: z
    .string()
    .min(1, 'Primeiro nome deve ter pelo menos 1 caractere')
    .max(100, 'Primeiro nome deve ter no máximo 100 caracteres')
    .trim()
    .optional(),

  lastName: z
    .string()
    .min(1, 'Sobrenome deve ter pelo menos 1 caractere')
    .max(100, 'Sobrenome deve ter no máximo 100 caracteres')
    .trim()
    .optional(),

  companyName: z
    .string()
    .min(1, 'Nome da empresa deve ter pelo menos 1 caractere')
    .max(200, 'Nome da empresa deve ter no máximo 200 caracteres')
    .trim()
    .optional(),

  designation: z
    .string()
    .min(1, 'Cargo deve ter pelo menos 1 caractere')
    .max(100, 'Cargo deve ter no máximo 100 caracteres')
    .trim()
    .optional(),

  metadata: z
    .record(z.any())
    .optional()
    .refine((val) => {
      // Limitar tamanho do metadata para evitar abuso
      if (val && JSON.stringify(val).length > 10000) {
        return false;
      }
      return true;
    }, 'Metadata muito grande (máximo 10KB)'),
});

/**
 * Schema de validação para atualização de contato
 */
export const updateContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome deve ter pelo menos 1 caractere')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim()
    .optional(),

  email: z
    .string()
    .email('Email inválido')
    .toLowerCase()
    .trim()
    .optional(),

  profilePictureUrl: z
    .string()
    .url('URL da foto de perfil inválida')
    .optional()
    .nullable(),

  firstName: z
    .string()
    .min(1, 'Primeiro nome deve ter pelo menos 1 caractere')
    .max(100, 'Primeiro nome deve ter no máximo 100 caracteres')
    .trim()
    .nullable()
    .optional(),

  lastName: z
    .string()
    .min(1, 'Sobrenome deve ter pelo menos 1 caractere')
    .max(100, 'Sobrenome deve ter no máximo 100 caracteres')
    .trim()
    .nullable()
    .optional(),

  companyName: z
    .string()
    .min(1, 'Nome da empresa deve ter pelo menos 1 caractere')
    .max(200, 'Nome da empresa deve ter no máximo 200 caracteres')
    .trim()
    .nullable()
    .optional(),

  designation: z
    .string()
    .min(1, 'Cargo deve ter pelo menos 1 caractere')
    .max(100, 'Cargo deve ter no máximo 100 caracteres')
    .trim()
    .nullable()
    .optional(),

  metadata: z
    .record(z.any())
    .optional()
    .nullable()
    .refine((val) => {
      if (val && JSON.stringify(val).length > 10000) {
        return false;
      }
      return true;
    }, 'Metadata muito grande (máximo 10KB)'),
}).refine((data) => {
  // Garantir que pelo menos um campo está sendo atualizado
  return Object.keys(data).length > 0;
}, 'Pelo menos um campo deve ser fornecido para atualização');

/**
 * Schema de validação para listagem de contatos
 * NOTA: Não usar wrapper { query: ... } pois o middleware já extrai req.query
 */
export const listContactsSchema = z.object({
  page: z
    .coerce
    .number()
    .int('Página deve ser um número inteiro')
    .min(1, 'Página deve ser maior que 0')
    .default(1)
    .optional(),

  limit: z
    .coerce
    .number()
    .int('Limite deve ser um número inteiro')
    .min(1, 'Limite mínimo é 1')
    .max(100, 'Limite máximo é 100')
    .default(20)
    .optional(),

  search: z
    .string()
    .trim()
    .max(200, 'Busca deve ter no maximo 200 caracteres')
    .optional(),

  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt', 'phoneNumber', 'firstName', 'lastName', 'companyName'])
    .default('createdAt')
    .optional(),

  sortOrder: z
    .enum(['asc', 'desc'])
    .default('desc')
    .optional(),
});

/**
 * Schema de validação para buscar contato por ID
 */
export const getContactByIdSchema = z.object({
  id: z
    .string()
    .uuid('ID do contato deve ser um UUID válido'),
});

/**
 * Schema de validação para deletar contato
 */
export const deleteContactSchema = z.object({
  id: z
    .string()
    .uuid('ID do contato deve ser um UUID válido'),
});

/**
 * Schema de validação para buscar contato por número de telefone
 */
export const getContactByPhoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, 'Número deve ter no mínimo 10 dígitos')
    .max(15, 'Número deve ter no máximo 15 dígitos')
    .regex(/^\d+$/, 'Apenas dígitos são permitidos'),
});

/**
 * Schema de validação para importação em lote de contatos
 */
export const bulkImportContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        phoneNumber: z
          .string()
          .min(10)
          .max(15)
          .regex(/^\d+$/),
        name: z.string().min(1).max(100).optional(),
        firstName: z.string().min(1).max(100).trim().optional(),
        lastName: z.string().min(1).max(100).trim().optional(),
        companyName: z.string().min(1).max(200).trim().optional(),
        designation: z.string().min(1).max(100).trim().optional(),
        email: z.string().email().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .min(1, 'Pelo menos 1 contato deve ser fornecido')
    .max(100, 'Máximo de 100 contatos por importação'),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsQuery = z.infer<typeof listContactsSchema>;
export type GetContactByIdInput = z.infer<typeof getContactByIdSchema>;
export type DeleteContactInput = z.infer<typeof deleteContactSchema>;
export type GetContactByPhoneInput = z.infer<typeof getContactByPhoneSchema>;
export type BulkImportInput = z.infer<typeof bulkImportContactsSchema>;