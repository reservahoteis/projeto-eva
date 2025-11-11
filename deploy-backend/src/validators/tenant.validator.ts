import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string()
    .min(3, 'Slug deve ter pelo menos 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  email: z.string().email('Email inválido'),
  plan: z.enum(['BASIC', 'PRO', 'ENTERPRISE']).optional(),
  maxAttendants: z.number().int().positive().optional(),
  maxMessages: z.number().int().positive().optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
  plan: z.enum(['BASIC', 'PRO', 'ENTERPRISE']).optional(),
  maxAttendants: z.number().int().positive().optional(),
  maxMessages: z.number().int().positive().optional(),
});

export const configureWhatsAppSchema = z.object({
  whatsappPhoneNumberId: z.string().min(1),
  whatsappAccessToken: z.string().min(1),
  whatsappBusinessAccountId: z.string().min(1),
  whatsappAppSecret: z.string().min(1),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type ConfigureWhatsAppInput = z.infer<typeof configureWhatsAppSchema>;
