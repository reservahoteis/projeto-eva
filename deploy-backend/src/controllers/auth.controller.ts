import { Request, Response } from 'express';
import { authService } from '@/services/auth.service';
import type { LoginInput, RefreshTokenInput, RegisterInput, ChangePasswordInput } from '@/validators/auth.validator';

export class AuthController {
  /**
   * POST /auth/login
   */
  async login(req: Request, res: Response) {
    const { email, password } = req.body as LoginInput;

    const result = await authService.login(email, password, req.tenantId);

    res.json(result);
  }

  /**
   * POST /auth/refresh
   */
  async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body as RefreshTokenInput;

    const result = await authService.refreshToken(refreshToken);

    res.json(result);
  }

  /**
   * POST /auth/register
   * (Usado por Tenant Admin para criar atendentes)
   */
  async register(req: Request, res: Response) {
    const data = req.body as RegisterInput;

    // ✅ TYPE-SAFE: Criar payload tipado corretamente
    const payload = {
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
      tenantId: req.tenantId || '', // requireTenant middleware garante que existe
    };

    const user = await authService.register(payload);

    res.status(201).json(user);
  }

  /**
   * POST /auth/change-password
   */
  async changePassword(req: Request, res: Response) {
    const { oldPassword, newPassword } = req.body as ChangePasswordInput;

    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    await authService.changePassword(req.user.id, oldPassword, newPassword);

    return res.json({ message: 'Senha alterada com sucesso' });
  }

  /**
   * GET /auth/me
   */
  async me(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Buscar dados completos do usuário
    const { prisma } = await import('@/config/database');

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        avatarUrl: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    return res.json(user);
  }
}

export const authController = new AuthController();
