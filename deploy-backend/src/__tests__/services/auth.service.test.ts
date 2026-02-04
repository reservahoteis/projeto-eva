/**
 * Testes para AuthService
 *
 * TDD: RED → GREEN → REFACTOR
 *
 * CRIT-001: Corrigir queries sem tenantId em auth.service.ts
 *
 * Problema identificado:
 * - Login busca usuario por email SEM filtrar tenantId na query
 * - Verificacao do tenant acontece APOS buscar (vulneravel a timing attacks)
 * - Nao segue padrao multi-tenant correto
 */

import { AuthService } from '@/services/auth.service';
import { prisma } from '@/config/database';
import bcrypt from 'bcrypt';
import { UnauthorizedError } from '@/utils/errors';
import type { User, Role, UserStatus } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Factory para criar mock de User com todos os campos obrigatorios
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1-uuid',
    email: 'user@example.com',
    name: 'Test User',
    password: 'hashed-password',
    role: 'ATTENDANT' as Role,
    status: 'ACTIVE' as UserStatus,
    tenantId: 'tenant-1',
    avatarUrl: null,
    hotelUnit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let authService: AuthService;
  // Usando findFirst agora pois email+tenantId nao eh unique key
  const mockPrismaUser = prisma.user as jest.Mocked<typeof prisma.user> & {
    findFirst: jest.Mock;
  };

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('login - Multi-Tenant Security', () => {
    const tenantA = 'tenant-a-uuid';
    const tenantB = 'tenant-b-uuid';

    const userTenantA = createMockUser({
      id: 'user-1-uuid',
      email: 'user@example.com',
      name: 'User Tenant A',
      tenantId: tenantA,
    });

    /**
     * TESTE CRITICO - CRIT-001
     *
     * Este teste DEVE FALHAR com o codigo atual porque:
     * - O codigo atual busca por email globalmente (sem tenantId na query)
     * - Depois verifica se o tenant corresponde
     *
     * Comportamento esperado (seguro):
     * - Query DEVE incluir tenantId quando fornecido
     * - Busca: { email, tenantId } em vez de apenas { email }
     *
     * Por que isso importa:
     * 1. Timing attacks: resposta mais rapida quando email nao existe no tenant
     * 2. Isolamento: queries devem ser tenant-scoped por padrao
     * 3. Padrao do projeto: TODA query Prisma DEVE ter tenantId (instinct 99% confianca)
     */
    it('CRIT-001: deve incluir tenantId na query quando fornecido (nao apenas verificar depois)', async () => {
      // Arrange
      mockPrismaUser.findFirst.mockResolvedValue(userTenantA);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaUser.update.mockResolvedValue(userTenantA);

      // Act
      await authService.login('user@example.com', 'password123', tenantA);

      // Assert - A query DEVE incluir tenantId
      // Este teste FALHA porque o codigo atual usa apenas { email }
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: 'user@example.com',
            tenantId: tenantA, // DEVE estar na query, nao apenas verificado depois
          }),
        })
      );
    });

    /**
     * Teste de isolamento cross-tenant
     * Usuario do Tenant A NAO deve conseguir logar no Tenant B
     */
    it('deve rejeitar login quando usuario tenta acessar tenant diferente', async () => {
      // Arrange - Usuario existe no Tenant A, tenta logar no Tenant B
      mockPrismaUser.findFirst.mockResolvedValue(userTenantA);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act & Assert
      await expect(
        authService.login('user@example.com', 'password123', tenantB)
      ).rejects.toThrow(UnauthorizedError);
    });

    /**
     * SUPER_ADMIN pode acessar qualquer tenant
     */
    it('deve permitir SUPER_ADMIN acessar qualquer tenant', async () => {
      // Arrange
      const superAdmin = createMockUser({
        id: 'admin-uuid',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN' as Role,
        tenantId: null, // SUPER_ADMIN nao tem tenant fixo
      });
      mockPrismaUser.findFirst.mockResolvedValue(superAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaUser.update.mockResolvedValue(superAdmin);

      // Act - SUPER_ADMIN pode logar sem tenant especifico
      const result = await authService.login('admin@example.com', 'password123');

      // Assert
      expect(result.user.role).toBe('SUPER_ADMIN');
    });

    /**
     * Login sem tenantId (para SUPER_ADMIN ou painel geral)
     */
    it('deve permitir login sem tenantId para usuarios sem restricao de tenant', async () => {
      // Arrange
      const superAdmin = createMockUser({
        id: 'admin-uuid',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN' as Role,
        tenantId: null,
      });
      mockPrismaUser.findFirst.mockResolvedValue(superAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaUser.update.mockResolvedValue(superAdmin);

      // Act - Login sem passar tenantId
      const result = await authService.login('admin@example.com', 'password123');

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('login - Validacoes basicas', () => {
    it('deve rejeitar email inexistente', async () => {
      // Arrange
      mockPrismaUser.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.login('nonexistent@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('deve rejeitar senha incorreta', async () => {
      // Arrange
      mockPrismaUser.findFirst.mockResolvedValue(createMockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        authService.login('user@example.com', 'wrong-password')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('deve rejeitar usuario inativo', async () => {
      // Arrange
      mockPrismaUser.findFirst.mockResolvedValue(createMockUser({
        status: 'INACTIVE' as UserStatus,
      }));

      // Act & Assert
      await expect(
        authService.login('user@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('login - Retorno correto', () => {
    it('deve retornar user, accessToken e refreshToken em login bem-sucedido', async () => {
      // Arrange
      const mockUser = createMockUser();
      mockPrismaUser.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaUser.update.mockResolvedValue(mockUser);

      // Act
      const result = await authService.login('user@example.com', 'password123');

      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('user@example.com');
      expect(result.user).not.toHaveProperty('password'); // Nao deve retornar senha
    });

    it('deve atualizar lastLogin apos login bem-sucedido', async () => {
      // Arrange
      const mockUser = createMockUser({ id: 'user-1' });
      mockPrismaUser.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaUser.update.mockResolvedValue(mockUser);

      // Act
      await authService.login('user@example.com', 'password123');

      // Assert
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            lastLogin: expect.any(Date),
          }),
        })
      );
    });
  });
});
