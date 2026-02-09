/**
 * Testes para UserService
 *
 * TDD: RED → GREEN → REFACTOR
 *
 * Cobre todos os metodos criticos:
 * - listUsers (paginacao, filtros, multi-tenant)
 * - getUserById (busca individual + multi-tenant)
 * - createUser (unicidade email por tenant, hash bcrypt)
 * - updateUser (verificacao tenant, email uniqueness, hash senha)
 * - updateUserStatus (prevenir auto-modificacao)
 * - deleteUser (prevenir auto-exclusao, verificar conversas)
 *
 * MULTI-TENANT SECURITY:
 * - TODA query Prisma DEVE incluir tenantId (exceto SUPER_ADMIN)
 * - Verificacao de email uniqueness DENTRO do tenant (email+tenantId)
 * - Nao buscar globalmente e verificar depois - vulneravel a timing attacks
 */

import { UserService } from '@/services/user.service';
import { prisma } from '@/config/database';
import bcrypt from 'bcrypt';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import { Role, UserStatus } from '@prisma/client';

// Mock dependencies
jest.mock('@/config/database', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversation: {
      count: jest.fn(),
    },
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

jest.mock('@/config/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Type helpers for mocked Prisma
const mockPrismaUser = prisma.user as jest.Mocked<typeof prisma.user>;
const mockPrismaConversation = prisma.conversation as jest.Mocked<typeof prisma.conversation>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UserService', () => {
  let userService: UserService;
  const tenantId = 'tenant-1-uuid';
  const userId = 'user-1-uuid';
  const requestUserId = 'admin-uuid';

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('listUsers - Multi-tenant Security', () => {
    it('deve SEMPRE incluir tenantId na query (multi-tenant security)', async () => {
      // Arrange
      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      // Act
      await userService.listUsers(tenantId, {});

      // Assert - CRITICO: tenantId DEVE estar na WHERE clause
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
          }),
        })
      );

      expect(mockPrismaUser.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId,
        }),
      });
    });

    it('deve filtrar usuarios apenas do tenant especificado', async () => {
      // Arrange
      const tenant1Users = [
        {
          id: 'user-1',
          email: 'user1@tenant1.com',
          name: 'User 1',
          tenantId: 'tenant-1',
          role: 'ATTENDANT' as Role,
          status: 'ACTIVE' as UserStatus,
          avatarUrl: null,
          hotelUnit: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLogin: null,
          _count: { conversations: 5 },
        },
      ];

      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue(tenant1Users);
      mockPrismaUser.count.mockResolvedValue(1);

      // Act
      const result = await userService.listUsers('tenant-1', {});

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('user1@tenant1.com');
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });
  });

  describe('listUsers - Paginacao', () => {
    it('deve retornar usuarios com paginacao correta', async () => {
      // Arrange
      const users = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'ATTENDANT' as Role,
          status: 'ACTIVE' as UserStatus,
          avatarUrl: null,
          hotelUnit: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLogin: null,
          _count: { conversations: 0 },
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User 2',
          role: 'ATTENDANT' as Role,
          status: 'ACTIVE' as UserStatus,
          avatarUrl: null,
          hotelUnit: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLogin: null,
          _count: { conversations: 3 },
        },
      ];

      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue(users);
      mockPrismaUser.count.mockResolvedValue(25);

      // Act
      const result = await userService.listUsers(tenantId, {
        page: 2,
        limit: 10,
      });

      // Assert - Verificar skip e take
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * limit 10
          take: 10,
        })
      );

      // Assert - Verificar metadata de paginacao
      expect(result).toEqual({
        data: expect.any(Array),
        total: 25,
        page: 2,
        limit: 10,
        pages: 3, // Math.ceil(25 / 10)
      });
    });

    it('deve usar valores padrao para page e limit', async () => {
      // Arrange
      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      // Act - Sem passar page e limit
      await userService.listUsers(tenantId, {});

      // Assert - Valores padrao: page=1, limit=20
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // (1 - 1) * 20
          take: 20,
        })
      );
    });

    it('deve formatar response com conversationsCount', async () => {
      // Arrange
      const users = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'ATTENDANT' as Role,
          status: 'ACTIVE' as UserStatus,
          avatarUrl: null,
          hotelUnit: 'Unit A',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          lastLogin: new Date('2024-01-03'),
          _count: { conversations: 12 },
        },
      ];

      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue(users);
      mockPrismaUser.count.mockResolvedValue(1);

      // Act
      const result = await userService.listUsers(tenantId, {});

      // Assert - Verificar formatacao
      expect(result.data[0]).toEqual({
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'ATTENDANT',
        status: 'ACTIVE',
        avatarUrl: null,
        hotelUnit: 'Unit A',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLogin: expect.any(Date),
        conversationsCount: 12,
      });
    });
  });

  describe('listUsers - Filtros', () => {
    it('deve filtrar por role quando fornecido', async () => {
      // Arrange
      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      // Act
      await userService.listUsers(tenantId, {
        role: 'ADMIN' as Role,
      });

      // Assert
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            role: 'ADMIN',
          }),
        })
      );
    });

    it('deve filtrar por status quando fornecido', async () => {
      // Arrange
      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      // Act
      await userService.listUsers(tenantId, {
        status: 'INACTIVE' as UserStatus,
      });

      // Assert
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            status: 'INACTIVE',
          }),
        })
      );
    });

    it('deve filtrar por search (nome ou email) quando fornecido', async () => {
      // Arrange
      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      // Act
      await userService.listUsers(tenantId, {
        search: 'joao',
      });

      // Assert
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            OR: [
              { name: { contains: 'joao', mode: 'insensitive' } },
              { email: { contains: 'joao', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('deve combinar multiplos filtros', async () => {
      // Arrange
      (mockPrismaUser.findMany as jest.Mock).mockResolvedValue([]);
      mockPrismaUser.count.mockResolvedValue(0);

      // Act
      await userService.listUsers(tenantId, {
        role: 'ATTENDANT' as Role,
        status: 'ACTIVE' as UserStatus,
        search: 'maria',
      });

      // Assert
      expect(mockPrismaUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            role: 'ATTENDANT',
            status: 'ACTIVE',
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('getUserById - Multi-tenant Security', () => {
    it('deve incluir tenantId na query (multi-tenant security)', async () => {
      // Arrange
      const user = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'ATTENDANT' as Role,
        status: 'ACTIVE' as UserStatus,
        avatarUrl: null,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        _count: { conversations: 0 },
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(user);

      // Act
      await userService.getUserById(userId, tenantId);

      // Assert - CRITICO: tenantId DEVE estar na query
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: userId,
            tenantId, // OBRIGATORIO para isolamento multi-tenant
          },
        })
      );
    });

    it('deve lancar NotFoundError quando usuario nao pertence ao tenant', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.getUserById(userId, tenantId)
      ).rejects.toThrow(NotFoundError);

      await expect(
        userService.getUserById(userId, tenantId)
      ).rejects.toThrow('Usuário não encontrado');
    });

    it('deve retornar usuario com conversationsCount', async () => {
      // Arrange
      const user = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'ATTENDANT' as Role,
        status: 'ACTIVE' as UserStatus,
        avatarUrl: 'https://example.com/avatar.jpg',
        hotelUnit: 'Unit A',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        lastLogin: new Date('2024-01-03'),
        _count: { conversations: 25 },
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(user);

      // Act
      const result = await userService.getUserById(userId, tenantId);

      // Assert
      expect(result).toEqual({
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'ATTENDANT',
        status: 'ACTIVE',
        avatarUrl: 'https://example.com/avatar.jpg',
        hotelUnit: 'Unit A',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLogin: expect.any(Date),
        conversationsCount: 25,
      });
    });
  });

  describe('createUser - Email Uniqueness Per Tenant', () => {
    const createUserData = {
      email: 'newuser@example.com',
      password: 'Password123!',
      name: 'New User',
      role: 'ATTENDANT' as Role,
      avatarUrl: null,
    };

    it('deve verificar unicidade de email DENTRO do tenant (multi-tenant)', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaUser.create as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        ...createUserData,
        password: 'hashed_password',
        status: 'ACTIVE',
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.createUser(createUserData, tenantId);

      // Assert - CRITICO: Verificacao de email DEVE incluir tenantId
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'newuser@example.com',
          tenantId, // OBRIGATORIO: email+tenantId (nao apenas email)
        },
      });
    });

    it('deve permitir mesmo email em tenants diferentes', async () => {
      // Arrange - Email existe no Tenant A, criando no Tenant B
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null); // Nao existe no Tenant B
      (mockPrismaUser.create as jest.Mock).mockResolvedValue({
        id: 'user-tenant-b',
        ...createUserData,
        password: 'hashed_password',
        status: 'ACTIVE',
        tenantId: 'tenant-b',
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act - Criar no Tenant B
      const result = await userService.createUser(createUserData, 'tenant-b');

      // Assert
      expect(result.email).toBe('newuser@example.com');
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'newuser@example.com',
          tenantId: 'tenant-b',
        },
      });
    });

    it('deve lancar BadRequestError se email ja existe no mesmo tenant', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'newuser@example.com',
        tenantId,
      });

      // Act & Assert
      await expect(
        userService.createUser(createUserData, tenantId)
      ).rejects.toThrow(BadRequestError);

      await expect(
        userService.createUser(createUserData, tenantId)
      ).rejects.toThrow('Email já cadastrado');
    });

    it('deve fazer hash da senha com bcrypt (12 rounds)', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaUser.create as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        ...createUserData,
        password: 'hashed_password',
        status: 'ACTIVE',
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.createUser(createUserData, tenantId);

      // Assert - SECURITY: Senha DEVE ser hashed com 12 rounds (OWASP)
      expect(mockBcrypt.hash).toHaveBeenCalledWith('Password123!', 12);

      // Assert - Usuario criado com senha hashed
      expect(mockPrismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'hashed_password',
          }),
        })
      );
    });

    it('deve criar usuario com tenantId correto', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaUser.create as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        ...createUserData,
        password: 'hashed_password',
        status: 'ACTIVE',
        tenantId,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.createUser(createUserData, tenantId);

      // Assert
      expect(mockPrismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newuser@example.com',
            name: 'New User',
            role: 'ATTENDANT',
            tenantId,
          }),
        })
      );
    });

    it('deve retornar usuario criado SEM senha', async () => {
      // Arrange
      const createdUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'ATTENDANT' as Role,
        status: 'ACTIVE' as UserStatus,
        avatarUrl: null,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaUser.create as jest.Mock).mockResolvedValue(createdUser);

      // Act
      const result = await userService.createUser(createUserData, tenantId);

      // Assert - Senha NAO deve estar no retorno
      expect(result).not.toHaveProperty('password');
      expect(result).toEqual({
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'ATTENDANT',
        status: 'ACTIVE',
        avatarUrl: null,
        hotelUnit: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('deve suportar hotelUnit quando fornecido', async () => {
      // Arrange
      const dataWithHotelUnit = {
        ...createUserData,
        hotelUnit: 'Unit A',
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaUser.create as jest.Mock).mockResolvedValue({
        id: 'new-user-id',
        ...dataWithHotelUnit,
        password: 'hashed_password',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.createUser(dataWithHotelUnit as any, tenantId);

      // Assert
      expect(mockPrismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hotelUnit: 'Unit A',
          }),
        })
      );
    });
  });

  describe('updateUser - Multi-tenant Security', () => {
    const updateData = {
      name: 'Updated Name',
      role: 'MANAGER' as Role,
    };

    it('deve verificar que usuario pertence ao tenant antes de atualizar', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.updateUser(userId, updateData, tenantId)
      ).rejects.toThrow(NotFoundError);

      // Assert - Verificacao DEVE incluir tenantId
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
      });
    });

    it('deve lancar NotFoundError se usuario nao existe no tenant', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.updateUser(userId, updateData, tenantId)
      ).rejects.toThrow(NotFoundError);

      await expect(
        userService.updateUser(userId, updateData, tenantId)
      ).rejects.toThrow('Usuário não encontrado');
    });

    it('deve atualizar usuario com dados fornecidos', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Old Name',
        role: 'ATTENDANT' as Role,
        tenantId,
      };

      const updatedUser = {
        ...existingUser,
        name: 'Updated Name',
        role: 'MANAGER' as Role,
        status: 'ACTIVE' as UserStatus,
        avatarUrl: null,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaUser.update as jest.Mock).mockResolvedValue(updatedUser);

      // Act
      await userService.updateUser(userId, updateData, tenantId);

      // Assert
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({
            name: 'Updated Name',
            role: 'MANAGER',
          }),
        })
      );
    });

    it('deve verificar unicidade de email DENTRO do tenant ao alterar email', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        email: 'old@example.com',
        name: 'User',
        tenantId,
      };

      (mockPrismaUser.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingUser) // Primeira chamada: verificar usuario existe
        .mockResolvedValueOnce(null); // Segunda chamada: verificar novo email disponivel

      (mockPrismaUser.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        email: 'new@example.com',
        status: 'ACTIVE',
        role: 'ATTENDANT',
        avatarUrl: null,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.updateUser(
        userId,
        { email: 'new@example.com' },
        tenantId
      );

      // Assert - CRITICO: Verificacao de email DEVE incluir tenantId
      expect(mockPrismaUser.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          email: 'new@example.com',
          tenantId, // OBRIGATORIO para multi-tenant
        },
      });
    });

    it('deve lancar BadRequestError se novo email ja existe no tenant', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        email: 'old@example.com',
        tenantId,
      };

      const userWithSameEmail = {
        id: 'another-user-id',
        email: 'taken@example.com',
        tenantId,
      };

      (mockPrismaUser.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(userWithSameEmail);

      // Act & Assert
      await expect(
        userService.updateUser(userId, { email: 'taken@example.com' }, tenantId)
      ).rejects.toThrow(BadRequestError);

      await expect(
        userService.updateUser(userId, { email: 'taken@example.com' }, tenantId)
      ).rejects.toThrow('Email já cadastrado');
    });

    it('nao deve verificar email se nao houve alteracao', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        email: 'user@example.com',
        name: 'User',
        tenantId,
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaUser.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        name: 'Updated Name',
        status: 'ACTIVE',
        role: 'ATTENDANT',
        avatarUrl: null,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.updateUser(userId, { name: 'Updated Name' }, tenantId);

      // Assert - findFirst deve ser chamado apenas 1 vez (verificar usuario existe)
      expect(mockPrismaUser.findFirst).toHaveBeenCalledTimes(1);
    });

    it('deve fazer hash da senha se fornecida (12 rounds)', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        email: 'user@example.com',
        tenantId,
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaUser.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        password: 'hashed_password',
        status: 'ACTIVE',
        role: 'ATTENDANT',
        name: 'User',
        avatarUrl: null,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.updateUser(
        userId,
        { password: 'NewPassword123!' },
        tenantId
      );

      // Assert - SECURITY: Senha DEVE ser hashed com 12 rounds
      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);

      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'hashed_password',
          }),
        })
      );
    });

    it('nao deve incluir senha no retorno', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        email: 'user@example.com',
        tenantId,
      };

      const updatedUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Updated Name',
        role: 'ATTENDANT' as Role,
        status: 'ACTIVE' as UserStatus,
        avatarUrl: null,
        hotelUnit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaUser.update as jest.Mock).mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUser(
        userId,
        { name: 'Updated Name' },
        tenantId
      );

      // Assert - Senha NAO deve estar no retorno
      expect(result).not.toHaveProperty('password');
    });

    it('deve suportar atualizacao de hotelUnit', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        email: 'user@example.com',
        tenantId,
        hotelUnit: null,
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      (mockPrismaUser.update as jest.Mock).mockResolvedValue({
        ...existingUser,
        hotelUnit: 'Unit B',
        status: 'ACTIVE',
        role: 'ATTENDANT',
        name: 'User',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await userService.updateUser(
        userId,
        { hotelUnit: 'Unit B' } as any,
        tenantId
      );

      // Assert
      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hotelUnit: 'Unit B',
          }),
        })
      );
    });
  });

  describe('updateUserStatus - Prevent Self-Modification', () => {
    it('deve lancar BadRequestError ao tentar alterar proprio status', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        tenantId,
        status: 'ACTIVE',
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);

      // Act & Assert - Mesmo ID para usuario e requestUserId
      await expect(
        userService.updateUserStatus(
          userId,
          'INACTIVE' as UserStatus,
          tenantId,
          userId // CRITICO: tentando modificar a si mesmo
        )
      ).rejects.toThrow(BadRequestError);

      await expect(
        userService.updateUserStatus(userId, 'INACTIVE' as UserStatus, tenantId, userId)
      ).rejects.toThrow('Você não pode alterar seu próprio status');
    });

    it('deve permitir admin alterar status de outro usuario', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        tenantId,
        status: 'ACTIVE',
      };

      const updatedUser = {
        id: userId,
        email: 'user@example.com',
        name: 'User',
        role: 'ATTENDANT' as Role,
        status: 'INACTIVE' as UserStatus,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      mockPrismaUser.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userService.updateUserStatus(
        userId,
        'INACTIVE' as UserStatus,
        tenantId,
        requestUserId // ID diferente
      );

      // Assert
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { status: 'INACTIVE' },
        select: expect.any(Object),
      });

      expect(result.status).toBe('INACTIVE');
    });

    it('deve verificar que usuario pertence ao tenant (multi-tenant)', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.updateUserStatus(
          userId,
          'INACTIVE' as UserStatus,
          tenantId,
          requestUserId
        )
      ).rejects.toThrow(NotFoundError);

      // Assert - CRITICO: tenantId DEVE estar na query
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
      });
    });

    it('deve lancar NotFoundError se usuario nao existe', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.updateUserStatus(
          'nonexistent-id',
          'INACTIVE' as UserStatus,
          tenantId,
          requestUserId
        )
      ).rejects.toThrow(NotFoundError);

      await expect(
        userService.updateUserStatus(
          'nonexistent-id',
          'INACTIVE' as UserStatus,
          tenantId,
          requestUserId
        )
      ).rejects.toThrow('Usuário não encontrado');
    });
  });

  describe('deleteUser - Prevent Self-Deletion and Check Conversations', () => {
    it('deve lancar BadRequestError ao tentar deletar propria conta', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        tenantId,
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);

      // Act & Assert - Mesmo ID para usuario e requestUserId
      await expect(
        userService.deleteUser(
          userId,
          tenantId,
          userId // CRITICO: tentando deletar a si mesmo
        )
      ).rejects.toThrow(BadRequestError);

      await expect(
        userService.deleteUser(userId, tenantId, userId)
      ).rejects.toThrow('Você não pode deletar sua própria conta');
    });

    it('deve lancar BadRequestError se usuario tem conversas atribuidas', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        tenantId,
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      mockPrismaConversation.count.mockResolvedValue(15); // Usuario tem 15 conversas

      // Act & Assert
      await expect(
        userService.deleteUser(userId, tenantId, requestUserId)
      ).rejects.toThrow(BadRequestError);

      await expect(
        userService.deleteUser(userId, tenantId, requestUserId)
      ).rejects.toThrow('Não é possível deletar usuário com 15 conversas atribuídas');

      // Assert - Verificar que contou conversas
      expect(mockPrismaConversation.count).toHaveBeenCalledWith({
        where: { assignedToId: userId },
      });
    });

    it('deve deletar usuario quando nao tem conversas atribuidas', async () => {
      // Arrange
      const existingUser = {
        id: userId,
        tenantId,
      };

      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(existingUser);
      mockPrismaConversation.count.mockResolvedValue(0); // Sem conversas
      mockPrismaUser.delete.mockResolvedValue(existingUser as any);

      // Act
      await userService.deleteUser(userId, tenantId, requestUserId);

      // Assert
      expect(mockPrismaUser.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('deve verificar que usuario pertence ao tenant (multi-tenant)', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.deleteUser(userId, tenantId, requestUserId)
      ).rejects.toThrow(NotFoundError);

      // Assert - CRITICO: tenantId DEVE estar na query
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
      });
    });

    it('deve lancar NotFoundError se usuario nao existe', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        userService.deleteUser('nonexistent-id', tenantId, requestUserId)
      ).rejects.toThrow(NotFoundError);

      await expect(
        userService.deleteUser('nonexistent-id', tenantId, requestUserId)
      ).rejects.toThrow('Usuário não encontrado');
    });

    it('nao deve chamar delete se usuario nao existe', async () => {
      // Arrange
      (mockPrismaUser.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      try {
        await userService.deleteUser(userId, tenantId, requestUserId);
      } catch (error) {
        // Esperado
      }

      expect(mockPrismaUser.delete).not.toHaveBeenCalled();
    });
  });
});
