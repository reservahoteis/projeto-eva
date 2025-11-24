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
  req: Request<{}, {}, {}, ListUsersQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { page = 1, limit = 20, role, status, search } = req.query;

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

    // Get users
    const users = await prisma.user.findMany({
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
    const data = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      conversationsCount: user._count.conversations,
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
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    const user = await prisma.user.findFirst({
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
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin,
      conversationsCount: user._count.conversations,
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
) {
  try {
    const tenantId = req.user!.tenantId!;
    const data = req.body as CreateUserInput;

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role,
        avatarUrl: data.avatarUrl,
        tenantId,
      },
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

    res.status(201).json(user);
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
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const data = req.body as UpdateUserBody;

    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Se está alterando email, verificar se já existe
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        return res.status(400).json({ message: 'Email já cadastrado' });
      }
    }

    // Preparar dados para atualizar
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    // Se está alterando senha, fazer hash
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    // Atualizar usuário
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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
 * Atualizar status do usuário (ativar/suspender)
 */
export async function updateUserStatus(
  req: Request<{ id: string }, {}, UpdateUserStatusBody>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;
    const data = req.body as UpdateUserStatusBody;

    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Não permitir que usuário altere seu próprio status
    if (id === req.user!.id) {
      return res.status(400).json({ message: 'Você não pode alterar seu próprio status' });
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
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    // Verificar se usuário existe e pertence ao tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Não permitir que usuário delete a si mesmo
    if (id === req.user!.id) {
      return res.status(400).json({ message: 'Você não pode deletar sua própria conta' });
    }

    // Verificar se usuário tem conversas atribuídas
    const conversationsCount = await prisma.conversation.count({
      where: { assignedToId: id },
    });

    if (conversationsCount > 0) {
      return res.status(400).json({
        message: 'Não é possível deletar usuário com conversas atribuídas',
        conversationsCount,
      });
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
