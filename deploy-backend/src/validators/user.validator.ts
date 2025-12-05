import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';
import { HOTEL_UNITS } from '@/constants/hotel-units';

/**
 * Schema para listar usuários
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(), // Busca por nome ou email
  hotelUnit: z.string().optional(), // Filtrar por unidade hoteleira
});

/**
 * Schema para criar usuário
 */
export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  role: z.nativeEnum(Role).optional().default(Role.ATTENDANT),
  avatarUrl: z.string().url('URL inválida').optional(),
  hotelUnit: z.enum(HOTEL_UNITS).nullable().optional(), // Unidade hoteleira (obrigatória para ATTENDANT)
}).refine((data) => {
  // Atendentes devem ter unidade hoteleira definida
  if (data.role === Role.ATTENDANT && !data.hotelUnit) {
    return false;
  }
  return true;
}, {
  message: 'Atendentes devem ter uma unidade hoteleira definida',
  path: ['hotelUnit'],
});

/**
 * Schema para atualizar usuário
 */
export const updateUserParamsSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const updateUserBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  password: z.string().min(8).optional(), // Opcional - apenas se quiser alterar
  hotelUnit: z.enum(HOTEL_UNITS).nullable().optional(), // Unidade hoteleira
}).refine((data) => {
  // Se role for ATTENDANT e hotelUnit está sendo definido, deve ser válido
  // Esta validação só se aplica se role está sendo atualizado para ATTENDANT
  if (data.role === Role.ATTENDANT && data.hotelUnit === null) {
    return false;
  }
  return true;
}, {
  message: 'Atendentes devem ter uma unidade hoteleira definida',
  path: ['hotelUnit'],
});

/**
 * Schema para atualizar status do usuário
 */
export const updateUserStatusParamsSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const updateUserStatusBodySchema = z.object({
  status: z.nativeEnum(UserStatus),
});

/**
 * Schema para deletar usuário
 */
export const deleteUserParamsSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserParams = z.infer<typeof updateUserParamsSchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UpdateUserStatusParams = z.infer<typeof updateUserStatusParamsSchema>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;
export type DeleteUserParams = z.infer<typeof deleteUserParamsSchema>;
