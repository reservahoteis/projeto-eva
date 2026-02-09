import { Request, Response, NextFunction } from 'express';
import { userService } from '@/services/user.service';
import type {
  ListUsersQuery,
  CreateUserInput,
  UpdateUserBody,
  UpdateUserStatusBody,
} from '@/validators/user.validator';

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

    const result = await userService.listUsers(tenantId, query);

    res.json(result);
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

    const user = await userService.getUserById(id, tenantId);

    res.json(user);
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

    const user = await userService.createUser(data, tenantId);

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
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const data = req.body as UpdateUserBody;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

    const user = await userService.updateUser(id, data, tenantId);

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
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const requestUserId = req.user!.id;
    const { id } = req.params;
    const data = req.body as UpdateUserStatusBody;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

    const user = await userService.updateUserStatus(
      id,
      data.status,
      tenantId,
      requestUserId
    );

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
    const requestUserId = req.user!.id;
    const { id } = req.params;

    if (!tenantId) {
      res.status(400).json({ message: 'Tenant ID não encontrado' });
      return;
    }

    await userService.deleteUser(id, tenantId, requestUserId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
