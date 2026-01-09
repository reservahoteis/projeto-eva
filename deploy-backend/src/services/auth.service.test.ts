import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prismaMock, resetPrismaMock } from '../test/helpers/prisma-mock';
import { AuthService } from './auth.service';
import { UnauthorizedError, BadRequestError } from '@/utils/errors';

// Mock bcrypt
jest.mock('bcrypt');
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const jwtMock = jwt as jest.Mocked<typeof jwt>;

// Mock logger
jest.mock('@/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock env
jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@hotel.com',
      name: 'Test User',
      password: '$2b$12$hashedpassword',
      role: 'ATTENDANT' as const,
      status: 'ACTIVE' as const,
      tenantId: 'tenant-123',
      avatarUrl: null,
      hotelUnit: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    };

    it('deve fazer login com sucesso', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUser as any);
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtMock.sign.mockReturnValue('mock-access-token' as never);

      // Act
      const result = await authService.login('test@hotel.com', 'password123');

      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@hotel.com' },
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

      expect(bcryptMock.compare).toHaveBeenCalledWith('password123', mockUser.password);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLogin: expect.any(Date) },
      });

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
          tenantId: mockUser.tenantId,
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-access-token',
      });
    });

    it('deve rejeitar login com email inexistente', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login('inexistente@hotel.com', 'password123')).rejects.toThrow(
        UnauthorizedError
      );
      await expect(authService.login('inexistente@hotel.com', 'password123')).rejects.toThrow(
        'Email ou senha inválidos'
      );
    });

    it('deve rejeitar login com usuário inativo', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'INACTIVE',
      });

      // Act & Assert
      await expect(authService.login('test@hotel.com', 'password123')).rejects.toThrow(
        UnauthorizedError
      );
      await expect(authService.login('test@hotel.com', 'password123')).rejects.toThrow(
        'Usuário inativo'
      );
    });

    it('deve rejeitar login com senha incorreta', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(authService.login('test@hotel.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedError
      );
      await expect(authService.login('test@hotel.com', 'wrongpassword')).rejects.toThrow(
        'Email ou senha inválidos'
      );
    });

    it('deve rejeitar login de usuário não-admin em tenant incorreto', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      bcryptMock.compare.mockResolvedValue(true as never);

      // Act & Assert
      await expect(
        authService.login('test@hotel.com', 'password123', 'different-tenant')
      ).rejects.toThrow(UnauthorizedError);
      await expect(
        authService.login('test@hotel.com', 'password123', 'different-tenant')
      ).rejects.toThrow('Usuário não pertence a este tenant');
    });

    it('deve permitir login de SUPER_ADMIN em qualquer tenant', async () => {
      // Arrange
      const superAdminUser = {
        ...mockUser,
        role: 'SUPER_ADMIN' as const,
      };
      prismaMock.user.findUnique.mockResolvedValue(superAdminUser);
      prismaMock.user.update.mockResolvedValue(superAdminUser as any);
      bcryptMock.compare.mockResolvedValue(true as never);
      jwtMock.sign.mockReturnValue('mock-token' as never);

      // Act
      const result = await authService.login('admin@hotel.com', 'password123', 'any-tenant');

      // Assert
      expect(result.user.id).toBe(superAdminUser.id);
    });
  });

  describe('refreshToken', () => {
    it('deve renovar access token com refresh token válido', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        role: 'ATTENDANT' as const,
        tenantId: 'tenant-123',
      };

      jwtMock.verify.mockReturnValue(mockPayload as never);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        status: 'ACTIVE',
      } as any);
      jwtMock.sign.mockReturnValue('new-access-token' as never);

      // Act
      const result = await authService.refreshToken('valid-refresh-token');

      // Assert
      expect(jwtMock.verify).toHaveBeenCalledWith('valid-refresh-token', 'test-jwt-refresh-secret');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { id: true, status: true },
      });
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('deve rejeitar refresh token inválido (JsonWebTokenError)', async () => {
      // Arrange
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      // Act & Assert
      await expect(authService.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedError);
      await expect(authService.refreshToken('invalid-token')).rejects.toThrow(
        'Refresh token inválido ou expirado'
      );
    });

    it('deve rejeitar refresh token expirado (TokenExpiredError)', async () => {
      // Arrange
      jwtMock.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('token expired', new Date());
      });

      // Act & Assert
      await expect(authService.refreshToken('expired-token')).rejects.toThrow(UnauthorizedError);
      await expect(authService.refreshToken('expired-token')).rejects.toThrow(
        'Refresh token inválido ou expirado'
      );
    });

    it('deve rejeitar refresh token de usuário inexistente', async () => {
      // Arrange
      jwtMock.verify.mockReturnValue({
        userId: 'nonexistent-user',
        role: 'ATTENDANT',
      } as never);
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshToken('valid-token')).rejects.toThrow(UnauthorizedError);
      await expect(authService.refreshToken('valid-token')).rejects.toThrow('Usuário inválido');
    });

    it('deve rejeitar refresh token de usuário inativo', async () => {
      // Arrange
      jwtMock.verify.mockReturnValue({
        userId: 'user-123',
        role: 'ATTENDANT',
      } as never);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        status: 'INACTIVE',
      } as any);

      // Act & Assert
      await expect(authService.refreshToken('valid-token')).rejects.toThrow(UnauthorizedError);
      await expect(authService.refreshToken('valid-token')).rejects.toThrow('Usuário inválido');
    });
  });

  describe('register', () => {
    it('deve registrar novo usuário com sucesso', async () => {
      // Arrange
      const userData = {
        email: 'novo@hotel.com',
        password: 'password123',
        name: 'Novo Usuário',
      };

      prismaMock.user.findUnique.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('$2b$12$hashedpassword' as never);
      prismaMock.user.create.mockResolvedValue({
        id: 'new-user-123',
        email: userData.email,
        name: userData.name,
        role: 'ATTENDANT',
        tenantId: null,
        createdAt: new Date(),
      } as any);

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: userData.email },
      });

      expect(bcryptMock.hash).toHaveBeenCalledWith(userData.password, 12);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          password: '$2b$12$hashedpassword',
          name: userData.name,
          role: 'ATTENDANT',
          tenantId: null,
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

      expect(result.email).toBe(userData.email);
      expect(result.name).toBe(userData.name);
    });

    it('deve registrar usuário com role customizado', async () => {
      // Arrange
      const userData = {
        email: 'admin@hotel.com',
        password: 'password123',
        name: 'Admin User',
        role: 'TENANT_ADMIN' as const,
        tenantId: 'tenant-123',
      };

      prismaMock.user.findUnique.mockResolvedValue(null);
      bcryptMock.hash.mockResolvedValue('$2b$12$hashedpassword' as never);
      prismaMock.user.create.mockResolvedValue({
        id: 'admin-123',
        email: userData.email,
        name: userData.name,
        role: 'TENANT_ADMIN',
        tenantId: 'tenant-123',
        createdAt: new Date(),
      } as any);

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'TENANT_ADMIN',
            tenantId: 'tenant-123',
          }),
        })
      );

      expect(result.role).toBe('TENANT_ADMIN');
    });

    it('deve rejeitar registro com email já existente', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'existing@hotel.com',
      } as any);

      // Act & Assert
      await expect(
        authService.register({
          email: 'existing@hotel.com',
          password: 'password123',
          name: 'Test',
        })
      ).rejects.toThrow(BadRequestError);

      await expect(
        authService.register({
          email: 'existing@hotel.com',
          password: 'password123',
          name: 'Test',
        })
      ).rejects.toThrow('Email já cadastrado');
    });
  });

  describe('changePassword', () => {
    it('deve trocar senha com sucesso', async () => {
      // Arrange
      const userId = 'user-123';
      const oldPassword = 'oldpassword';
      const newPassword = 'newpassword123';

      prismaMock.user.findUnique.mockResolvedValue({
        password: '$2b$12$oldhash',
      } as any);
      bcryptMock.compare.mockResolvedValue(true as never);
      bcryptMock.hash.mockResolvedValue('$2b$12$newhash' as never);
      prismaMock.user.update.mockResolvedValue({} as any);

      // Act
      await authService.changePassword(userId, oldPassword, newPassword);

      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { password: true },
      });

      expect(bcryptMock.compare).toHaveBeenCalledWith(oldPassword, '$2b$12$oldhash');
      expect(bcryptMock.hash).toHaveBeenCalledWith(newPassword, 12);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: '$2b$12$newhash' },
      });
    });

    it('deve rejeitar mudança de senha de usuário inexistente', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.changePassword('nonexistent-user', 'oldpass', 'newpass')
      ).rejects.toThrow(UnauthorizedError);

      await expect(
        authService.changePassword('nonexistent-user', 'oldpass', 'newpass')
      ).rejects.toThrow('Usuário não encontrado');
    });

    it('deve rejeitar mudança de senha com senha antiga incorreta', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue({
        password: '$2b$12$oldhash',
      } as any);
      bcryptMock.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(authService.changePassword('user-123', 'wrongold', 'newpass')).rejects.toThrow(
        UnauthorizedError
      );

      await expect(authService.changePassword('user-123', 'wrongold', 'newpass')).rejects.toThrow(
        'Senha atual incorreta'
      );
    });
  });

  describe('hashPassword', () => {
    it('deve fazer hash da senha com bcrypt', async () => {
      // Arrange
      bcryptMock.hash.mockResolvedValue('$2b$12$hashedpassword' as never);

      // Act
      const result = await authService.hashPassword('mypassword');

      // Assert
      expect(bcryptMock.hash).toHaveBeenCalledWith('mypassword', 12);
      expect(result).toBe('$2b$12$hashedpassword');
    });
  });

  describe('validatePassword', () => {
    it('deve validar senha correta', async () => {
      // Arrange
      bcryptMock.compare.mockResolvedValue(true as never);

      // Act
      const result = await authService.validatePassword('plainpassword', '$2b$12$hashedpassword');

      // Assert
      expect(bcryptMock.compare).toHaveBeenCalledWith('plainpassword', '$2b$12$hashedpassword');
      expect(result).toBe(true);
    });

    it('deve rejeitar senha incorreta', async () => {
      // Arrange
      bcryptMock.compare.mockResolvedValue(false as never);

      // Act
      const result = await authService.validatePassword('wrongpassword', '$2b$12$hashedpassword');

      // Assert
      expect(result).toBe(false);
    });
  });
});
