import { z } from 'zod';

/**
 * Schema de validação para envio de Flow via WhatsApp
 * Endpoint: POST /api/n8n/send-flow
 */
export const sendFlowSchema = z.object({
  body: z.object({
    phoneNumber: z
      .string()
      .regex(/^55\d{10,11}$/, 'Número deve estar no formato brasileiro: 5511999999999 (55 + DDD + número)')
      .length(13, 'Número brasileiro deve ter 13 dígitos (55 + DDD + 9 dígitos)')
      .refine((val) => {
        // Validar que o DDD é válido (11-99)
        const ddd = parseInt(val.substring(2, 4));
        return ddd >= 11 && ddd <= 99;
      }, 'DDD inválido'),

    flowId: z
      .string()
      .uuid('flowId deve ser um UUID válido'),

    flowToken: z
      .string()
      .min(1, 'flowToken é obrigatório')
      .max(100, 'flowToken deve ter no máximo 100 caracteres'),

    ctaText: z
      .string()
      .min(1, 'Texto do botão é obrigatório')
      .max(20, 'Texto do botão deve ter no máximo 20 caracteres')
      .trim(),

    headerText: z
      .string()
      .max(60, 'Texto do header deve ter no máximo 60 caracteres')
      .trim()
      .optional(),

    bodyText: z
      .string()
      .max(1024, 'Texto do body deve ter no máximo 1024 caracteres')
      .trim()
      .optional(),

    conversationId: z
      .string()
      .uuid('conversationId deve ser um UUID válido')
      .optional(),
  }),
});

/**
 * Schema de validação para criação de Flow no WhatsApp Business
 */
export const createFlowSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Nome do flow é obrigatório')
      .max(100, 'Nome do flow deve ter no máximo 100 caracteres')
      .trim(),

    categories: z
      .array(
        z.enum([
          'SIGN_UP',
          'SIGN_IN',
          'APPOINTMENT_BOOKING',
          'LEAD_GENERATION',
          'CONTACT_US',
          'CUSTOMER_SUPPORT',
          'SURVEY',
          'OTHER',
        ])
      )
      .min(1, 'Pelo menos uma categoria deve ser fornecida')
      .max(3, 'Máximo de 3 categorias permitidas'),

    flowJson: z
      .object({
        version: z.string().optional(),
        screens: z.array(z.record(z.any())),
      })
      .passthrough() // Permitir campos adicionais no flowJson
      .refine((val) => {
        // Limitar tamanho do JSON para evitar payloads muito grandes
        const jsonSize = JSON.stringify(val).length;
        return jsonSize <= 100000; // 100KB
      }, 'Flow JSON muito grande (máximo 100KB)'),
  }),
});

/**
 * Schema de validação para resposta de Flow do webhook WhatsApp
 * Tipo de mensagem: nfm_reply (Native Flow Manager Reply)
 */
export const flowResponseSchema = z.object({
  body: z.object({
    response_json: z
      .string()
      .min(1, 'response_json é obrigatório')
      .refine((val) => {
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      }, 'response_json deve ser um JSON válido stringificado'),

    // Campos adicionais que podem vir no webhook
    flow_token: z.string().optional(),
  }),
});

/**
 * Schema de validação para atualização de Flow
 */
export const updateFlowSchema = z.object({
  params: z.object({
    flowId: z
      .string()
      .uuid('flowId deve ser um UUID válido'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Nome do flow é obrigatório')
      .max(100, 'Nome do flow deve ter no máximo 100 caracteres')
      .trim()
      .optional(),

    categories: z
      .array(
        z.enum([
          'SIGN_UP',
          'SIGN_IN',
          'APPOINTMENT_BOOKING',
          'LEAD_GENERATION',
          'CONTACT_US',
          'CUSTOMER_SUPPORT',
          'SURVEY',
          'OTHER',
        ])
      )
      .min(1, 'Pelo menos uma categoria deve ser fornecida')
      .max(3, 'Máximo de 3 categorias permitidas')
      .optional(),

    flowJson: z
      .object({
        version: z.string().optional(),
        screens: z.array(z.record(z.any())),
      })
      .passthrough()
      .refine((val) => {
        const jsonSize = JSON.stringify(val).length;
        return jsonSize <= 100000;
      }, 'Flow JSON muito grande (máximo 100KB)')
      .optional(),
  }).refine((data) => {
    // Garantir que pelo menos um campo está sendo atualizado
    return Object.keys(data).length > 0;
  }, 'Pelo menos um campo deve ser fornecido para atualização'),
});

/**
 * Schema de validação para listagem de Flows
 */
export const listFlowsSchema = z.object({
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
    .max(50, 'Limite máximo é 50')
    .default(20)
    .optional(),

  category: z
    .enum([
      'SIGN_UP',
      'SIGN_IN',
      'APPOINTMENT_BOOKING',
      'LEAD_GENERATION',
      'CONTACT_US',
      'CUSTOMER_SUPPORT',
      'SURVEY',
      'OTHER',
    ])
    .optional(),
});

/**
 * Schema de validação para obter Flow por ID
 */
export const getFlowByIdSchema = z.object({
  params: z.object({
    flowId: z
      .string()
      .uuid('flowId deve ser um UUID válido'),
  }),
});

/**
 * Schema de validação para deletar Flow
 */
export const deleteFlowSchema = z.object({
  params: z.object({
    flowId: z
      .string()
      .uuid('flowId deve ser um UUID válido'),
  }),
});

// Tipos inferidos dos schemas
export type SendFlowInput = z.infer<typeof sendFlowSchema>['body'];
export type CreateFlowInput = z.infer<typeof createFlowSchema>['body'];
export type FlowResponseInput = z.infer<typeof flowResponseSchema>['body'];
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>['body'];
export type ListFlowsQuery = z.infer<typeof listFlowsSchema>;
