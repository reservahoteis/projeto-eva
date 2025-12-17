import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import bcrypt from 'bcrypt';
import type {
  ListUsersQuery,
  CreateUserInput,
  UpdateUserBody,
  UpdateUserStatusBody,
} from '../validators/user.validator';

/**
 * Listar usuários do tenant
 */
export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant ID não encontrado' });
      return;
    }

    const query = req.query as unknown as ListUsersQuery;
    const { page = 1, limit = 20, role, status, search } = query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {
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
    const data = users.map((user: any) => ({
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

    res.json({
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Buscar usuário por ID
 */
export async function getUserById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

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
      res.status(404).json({ message: 'Usuário não encontrado' });
      return;
    }

    res.json({
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
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Criar usuário
 */
export async function createUser(
  req: Request<{}, {}, CreateUserInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const data = req.body as CreateUserInput;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      res.status(400).json({ message: 'Email já cadastrado' });
      return;
    }

    // SECURITY FIX [SEC-015]: Hash da senha com salt=12 (padronizado com auth.service.ts)
    // OWASP recomenda minimo de 10 rounds, usando 12 para maior seguranca
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

    res.status(201).json({
      ...user,
      hotelUnit: user.hotelUnit || null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Atualizar usuário
 */
export async function updateUser(
  req: Request<{ id: string }, {}, UpdateUserBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = req.body as UpdateUserBody;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      res.status(404).json({ message: 'Usuário não encontrado' });
      return;
    }

    // Se está alterando email, verificar se já existe
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        res.status(400).json({ message: 'Email já cadastrado' });
        return;
      }
    }

    // Preparar dados para atualizar
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if ((data as any).hotelUnit !== undefined) updateData.hotelUnit = (data as any).hotelUnit;

    // SECURITY FIX [SEC-015]: Se esta alterando senha, fazer hash com salt=12
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

    res.json({
      ...user,
      hotelUnit: user.hotelUnit || null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Atualizar status do usuário (ativar/suspender)
 */
export async function updateUserStatus(
  req: Request<{ id: string }, {}, UpdateUserStatusBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = req.body as UpdateUserStatusBody;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      res.status(404).json({ message: 'Usuário não encontrado' });
      return;
    }

    // Não permitir que usuário altere seu próprio status
    if (id === req.user!.id) {
      res.status(400).json({ message: 'Você não pode alterar seu próprio status' });
      return;
    }

    // Atualizar status
    const user = await prisma.user.update({
      where: { id },
      data: { status: data.status },
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

    res.json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * Deletar usuário
 */
export async function deleteUser(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      res.status(404).json({ message: 'Usuário não encontrado' });
      return;
    }

    // Não permitir que usuário delete a si mesmo
    if (id === req.user!.id) {
      res.status(400).json({ message: 'Você não pode deletar sua própria conta' });
      return;
    }

    // Verificar se usuário tem conversas atribuídas
    const conversationsCount = await prisma.conversation.count({
      where: { assignedToId: id },
    });

    if (conversationsCount > 0) {
      res.status(400).json({
        message: 'Não é possível deletar usuário com conversas atribuídas',
        conversationsCount,
      });
      return;
    }

    // Deletar usuário
    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
