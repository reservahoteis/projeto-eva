import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { env } from '@/config/env';
import { UnauthorizedError, BadRequestError } from '@/utils/errors';
import { Role } from '@prisma/client';
import logger from '@/config/logger';

const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';

interface LoginResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    tenantId: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

interface JWTPayload {
  userId: string;
  role: Role;
  tenantId?: string | null;
}

export class AuthService {
  /**
   * Login de usuário
   *
   * MULTI-TENANT SECURITY:
   * - Quando tenantId é fornecido, a query DEVE incluir tenantId
   * - Isso previne timing attacks e garante isolamento de dados
   * - SUPER_ADMIN pode logar sem tenantId (acesso global)
   */
  async login(email: string, password: string, tenantId?: string | null): Promise<LoginResult> {
    // Construir where clause com tenantId quando fornecido
    // Isso garante isolamento multi-tenant na query (nao apenas verificacao posterior)
    const whereClause: { email: string; tenantId?: string } = { email };

    // Se tenantId foi fornecido, incluir na query para isolamento multi-tenant
    if (tenantId !== undefined && tenantId !== null) {
      whereClause.tenantId = tenantId;
    }

    // Buscar usuário (findFirst porque email+tenantId nao eh unique key)
    const user = await prisma.user.findFirst({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        status: true,
        tenantId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    // Verificar se user está ativo
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Usuário inativo');
    }

    // Verificacao adicional: se nao eh SUPER_ADMIN e tenantId foi fornecido,
    // garantir que usuario pertence ao tenant (double-check)
    if (user.role !== 'SUPER_ADMIN' && tenantId !== undefined && tenantId !== null && user.tenantId !== tenantId) {
      throw new UnauthorizedError('Usuário não pertence a este tenant');
    }

    // Validar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Email ou senha inválidos');
    }

    // Atualizar lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Gerar tokens
    const accessToken = this.generateAccessToken({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
    });

    const refreshToken = this.generateRefreshToken({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JWTPayload;

      // Verificar se usuário ainda existe e está ativo
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedError('Usuário inválido');
      }

      // Gerar novo access token
      const accessToken = this.generateAccessToken({
        userId: payload.userId,
        role: payload.role,
        tenantId: payload.tenantId,
      });

      return { accessToken };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token inválido ou expirado');
      }
      throw error;
    }
  }

  /**
   * Criar novo usuário (registro)
   */
  async register(data: {
    email: string;
    password: string;
    name: string;
    role?: Role;
    tenantId?: string | null;
  }) {
    // SECURITY FIX [CRIT-002]: Verificar email dentro do tenant (multi-tenant isolation)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: data.email,
        ...(data.tenantId ? { tenantId: data.tenantId } : {}),
      },
    });

    if (existingUser) {
      throw new BadRequestError('Email já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await this.hashPassword(data.password);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || 'ATTENDANT',
        tenantId: data.tenantId || null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    return user;
  }

  /**
   * Trocar senha
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado');
    }

    // Verificar senha antiga
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new UnauthorizedError('Senha atual incorreta');
    }

    // Hash da nova senha
    const hashedNewPassword = await this.hashPassword(newPassword);

    // Atualizar senha
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    logger.info({ userId }, 'Password changed');
  }

  /**
   * Gerar Access Token (15 minutos)
   */
  private generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '8h',
    });
  }

  /**
   * Gerar Refresh Token (7 dias)
   */
  private generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: '7d',
    });
  }

  /**
   * Revogar token (adicionar a blacklist no Redis)
   * O token fica na blacklist ate expirar naturalmente
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      if (!decoded?.exp) return;

      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      if (ttl > 0) {
        await redis.setex(`${TOKEN_BLACKLIST_PREFIX}${token}`, ttl, '1');
        logger.info('Token revoked and added to blacklist');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to revoke token');
    }
  }

  /**
   * Verificar se token esta na blacklist
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      const result = await redis.get(`${TOKEN_BLACKLIST_PREFIX}${token}`);
      return result === '1';
    } catch (error) {
      logger.error({ error }, 'Failed to check token blacklist');
      return false;
    }
  }

  /**
   * Revogar todos os tokens de um usuario
   * Usa uma versao de token por usuario - ao incrementar, todos os tokens antigos ficam invalidos
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      await redis.incr(`token:version:${userId}`);
      logger.info({ userId }, 'All tokens revoked for user');
    } catch (error) {
      logger.error({ error, userId }, 'Failed to revoke all user tokens');
    }
  }

  /**
   * Hash password com bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * Validar senha
   */
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

export const authService = new AuthService();
