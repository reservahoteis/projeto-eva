import bcrypt from 'bcrypt';
import { prisma } from '@/config/database';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import { Role, UserStatus } from '@prisma/client';
import logger from '@/config/logger';
import type {
  ListUsersQuery,
  CreateUserInput,
  UpdateUserBody,
} from '@/validators/user.validator';

interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  hotelUnit: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
  conversationsCount: number;
}

interface PaginatedUsers {
  data: UserListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface UserDetail {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  hotelUnit: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
  conversationsCount: number;
}

interface CreatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  hotelUnit: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  /**
   * Listar usuários do tenant com paginação e filtros
   *
   * MULTI-TENANT SECURITY:
   * - SEMPRE inclui tenantId na query
   * - Garante isolamento de dados por tenant
   */
  async listUsers(tenantId: string, query: ListUsersQuery): Promise<PaginatedUsers> {
    const { page = 1, limit = 20, role, status, search } = query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause com tenantId OBRIGATORIO
    const where: {
      tenantId: string;
      role?: Role;
      status?: UserStatus;
      OR?: Array<{ name: { contains: string; mode: 'insensitive' } } | { email: { contains: string; mode: 'insensitive' } }>;
    } = {
      tenantId,
    };

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get users (usando any para suportar hotelUnit antes da migration)
    const users = await (prisma.user.findMany as any)({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        hotelUnit: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    // Format response
    const data: UserListItem[] = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      hotelUnit: user.hotelUnit || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      conversationsCount: user._count?.conversations || 0,
    }));

    logger.debug(
      { tenantId, page, limit, total, role, status, search },
      'Listed users'
    );

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    };
  }

  /**
   * Buscar usuário por ID
   *
   * MULTI-TENANT SECURITY:
   * - Query inclui tenantId para garantir isolamento
   * - Usa findFirst porque não é unique key
   */
  async getUserById(id: string, tenantId: string): Promise<UserDetail> {
    const user = await (prisma.user.findFirst as any)({
      where: {
        id,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        hotelUnit: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }

    logger.debug({ userId: id, tenantId }, 'Retrieved user by ID');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      hotelUnit: user.hotelUnit || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      conversationsCount: user._count?.conversations || 0,
    };
  }

  /**
   * Criar novo usuário
   *
   * MULTI-TENANT SECURITY:
   * - Verifica unicidade de email DENTRO do tenant (email+tenantId)
   * - Hash de senha com bcrypt (12 rounds, conforme OWASP)
   */
  async createUser(data: CreateUserInput, tenantId: string): Promise<CreatedUser> {
    // SECURITY FIX [CRIT-002]: Verificar email dentro do tenant (multi-tenant isolation)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        tenantId,
      },
    });

    if (existingUser) {
      throw new BadRequestError('Email já cadastrado');
    }

    // SECURITY FIX [SEC-015]: Hash da senha com salt=12 (padronizado com auth.service.ts)
    // OWASP recomenda mínimo de 10 rounds, usando 12 para maior segurança
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Criar usuário (usando any para suportar hotelUnit antes da migration)
    const user = await (prisma.user.create as any)({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role,
        avatarUrl: data.avatarUrl,
        hotelUnit: (data as any).hotelUnit || null,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        hotelUnit: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(
      { userId: user.id, email: user.email, role: user.role, tenantId },
      'User created'
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      hotelUnit: user.hotelUnit || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Atualizar usuário
   *
   * MULTI-TENANT SECURITY:
   * - Verifica que usuário pertence ao tenant
   * - Se email mudar, verifica unicidade dentro do tenant
   * - Hash de senha se fornecida (12 rounds)
   */
  async updateUser(id: string, data: UpdateUserBody, tenantId: string): Promise<CreatedUser> {
    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // SECURITY FIX [CRIT-002]: Verificar email dentro do tenant (multi-tenant isolation)
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: data.email,
          tenantId,
        },
      });

      if (emailExists) {
        throw new BadRequestError('Email já cadastrado');
      }
    }

    // Preparar dados para atualizar
    const updateData: {
      name?: string;
      email?: string;
      role?: Role;
      avatarUrl?: string | null;
      hotelUnit?: string | null;
      password?: string;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if ((data as any).hotelUnit !== undefined) updateData.hotelUnit = (data as any).hotelUnit;

    // SECURITY FIX [SEC-015]: Se está alterando senha, fazer hash com salt=12
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    // Atualizar usuário (usando any para suportar hotelUnit antes da migration)
    const user = await (prisma.user.update as any)({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        hotelUnit: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(
      { userId: id, tenantId, updatedFields: Object.keys(updateData) },
      'User updated'
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      hotelUnit: user.hotelUnit || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Atualizar status do usuário (ativar/suspender)
   *
   * MULTI-TENANT SECURITY:
   * - Verifica que usuário pertence ao tenant
   * - Previne auto-modificação de status
   */
  async updateUserStatus(
    id: string,
    status: UserStatus,
    tenantId: string,
    requestUserId: string
  ): Promise<Omit<CreatedUser, 'hotelUnit'>> {
    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Não permitir que usuário altere seu próprio status
    if (id === requestUserId) {
      throw new BadRequestError('Você não pode alterar seu próprio status');
    }

    // Atualizar status
    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(
      { userId: id, tenantId, newStatus: status, requestedBy: requestUserId },
      'User status updated'
    );

    return user;
  }

  /**
   * Deletar usuário
   *
   * MULTI-TENANT SECURITY:
   * - Verifica que usuário pertence ao tenant
   * - Previne auto-exclusão
   * - Previne exclusão se usuário tem conversas atribuídas
   */
  async deleteUser(id: string, tenantId: string, requestUserId: string): Promise<void> {
    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Não permitir que usuário delete a si mesmo
    if (id === requestUserId) {
      throw new BadRequestError('Você não pode deletar sua própria conta');
    }

    // Verificar se usuário tem conversas atribuídas
    const conversationsCount = await prisma.conversation.count({
      where: { assignedToId: id },
    });

    if (conversationsCount > 0) {
      throw new BadRequestError(
        `Não é possível deletar usuário com ${conversationsCount} conversas atribuídas`
      );
    }

    // Deletar usuário
    await prisma.user.delete({
      where: { id },
    });

    logger.info(
      { userId: id, tenantId, requestedBy: requestUserId },
      'User deleted'
    );
  }
}

export const userService = new UserService();
