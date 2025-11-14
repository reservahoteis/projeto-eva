import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../test/helpers/prisma-mock';
import { TenantService } from './tenant.service';
import { BadRequestError, NotFoundError } from '@/utils/errors';
import { TenantStatus, Plan } from '@prisma/client';

// Mock do authService
jest.mock('./auth.service', () => ({
  authService: {
    register: jest.fn(),
  },
}));

// Mock do generateToken
jest.mock('@/utils/crypto', () => ({
  generateToken: jest.fn(),
}));

// Importar os mocks após a definição
import { authService } from './auth.service';
import { generateToken } from '@/utils/crypto';
const mockRegister = authService.register as jest.MockedFunction<typeof authService.register>;
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;

// Mock do logger
jest.mock('@/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock do env
process.env.BASE_DOMAIN = 'hotel.com';

describe('TenantService', () => {
  let tenantService: TenantService;

  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    tenantService = new TenantService();
  });

  describe('createTenant', () => {
    const validTenantData = {
      name: 'Hotel Paraíso',
      slug: 'hotel-paraiso',
      email: 'admin@hotel-paraiso.com',
      plan: 'PREMIUM' as Plan,
      maxAttendants: 20,
      maxMessages: 50000,
    };

    it('deve criar tenant com sucesso com todos os campos', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null); // Slug não existe
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null); // Email não existe
      mockGenerateToken.mockReturnValueOnce('webhook-token-32').mockReturnValueOnce('temp-pass-16');

      const mockCreatedTenant = {
        id: 'tenant-123',
        name: validTenantData.name,
        slug: validTenantData.slug,
        email: validTenantData.email,
        status: 'TRIAL' as TenantStatus,
        plan: validTenantData.plan,
        maxAttendants: validTenantData.maxAttendants,
        maxMessages: validTenantData.maxMessages,
        whatsappWebhookVerifyToken: 'webhook-token-32',
        trialEndsAt: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.tenant.create.mockResolvedValue(mockCreatedTenant as any);

      const mockAdminUser = {
        id: 'admin-user-123',
        email: validTenantData.email,
        name: `Admin ${validTenantData.name}`,
        role: 'TENANT_ADMIN' as const,
        tenantId: 'tenant-123',
        createdAt: new Date(),
      };

      mockRegister.mockResolvedValue(mockAdminUser);

      // Act
      const result = await tenantService.createTenant(validTenantData);

      // Assert
      expect(prismaMock.tenant.findUnique).toHaveBeenNthCalledWith(1, {
        where: { slug: validTenantData.slug },
      });

      expect(prismaMock.tenant.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: validTenantData.email },
      });

      expect(prismaMock.tenant.create).toHaveBeenCalledWith({
        data: {
          name: validTenantData.name,
          slug: validTenantData.slug,
          email: validTenantData.email,
          status: 'TRIAL',
          plan: validTenantData.plan,
          maxAttendants: validTenantData.maxAttendants,
          maxMessages: validTenantData.maxMessages,
          trialEndsAt: expect.any(Date),
          whatsappWebhookVerifyToken: 'webhook-token-32',
        },
      });

      expect(mockRegister).toHaveBeenCalledWith({
        email: validTenantData.email,
        password: 'temp-pass-16',
        name: `Admin ${validTenantData.name}`,
        role: 'TENANT_ADMIN',
        tenantId: 'tenant-123',
      });

      expect(result).toEqual({
        tenant: mockCreatedTenant,
        adminUser: {
          id: 'admin-user-123',
          email: validTenantData.email,
          temporaryPassword: 'temp-pass-16',
        },
        loginUrl: `https://${validTenantData.slug}.hotel.com`,
      });
    });

    it('deve criar tenant com valores padrão quando campos opcionais não fornecidos', async () => {
      // Arrange
      const minimalData = {
        name: 'Hotel Básico',
        slug: 'hotel-basico',
        email: 'admin@basico.com',
      };

      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      mockGenerateToken.mockReturnValueOnce('webhook-token').mockReturnValueOnce('temp-pass');

      prismaMock.tenant.create.mockResolvedValue({
        id: 'tenant-123',
        ...minimalData,
        status: 'TRIAL',
        plan: 'BASIC',
        maxAttendants: 10,
        maxMessages: 10000,
      } as any);

      mockRegister.mockResolvedValue({
        id: 'admin-123',
        email: minimalData.email,
      } as any);

      // Act
      await tenantService.createTenant(minimalData);

      // Assert
      expect(prismaMock.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            plan: 'BASIC',
            maxAttendants: 10,
            maxMessages: 10000,
          }),
        })
      );
    });

    it('deve rejeitar slug com caracteres inválidos (maiúsculas)', async () => {
      // Arrange
      const invalidData = {
        name: 'Hotel',
        slug: 'Hotel-Paraiso',
        email: 'admin@hotel.com',
      };

      // Act & Assert
      await expect(tenantService.createTenant(invalidData)).rejects.toThrow(BadRequestError);
      await expect(tenantService.createTenant(invalidData)).rejects.toThrow(
        'Slug deve conter apenas letras minúsculas, números e hífens'
      );
    });

    it('deve rejeitar slug com espaços', async () => {
      // Arrange
      const invalidData = {
        name: 'Hotel',
        slug: 'hotel paraiso',
        email: 'admin@hotel.com',
      };

      // Act & Assert
      await expect(tenantService.createTenant(invalidData)).rejects.toThrow(BadRequestError);
      await expect(tenantService.createTenant(invalidData)).rejects.toThrow(
        'Slug deve conter apenas letras minúsculas, números e hífens'
      );
    });

    it('deve rejeitar slug com caracteres especiais', async () => {
      // Arrange
      const invalidData = {
        name: 'Hotel',
        slug: 'hotel@paraiso!',
        email: 'admin@hotel.com',
      };

      // Act & Assert
      await expect(tenantService.createTenant(invalidData)).rejects.toThrow(BadRequestError);
    });

    it('deve rejeitar slug já existente', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'existing-tenant',
        slug: 'hotel-paraiso',
      } as any);

      // Act & Assert
      await expect(tenantService.createTenant(validTenantData)).rejects.toThrow(BadRequestError);
      await expect(tenantService.createTenant(validTenantData)).rejects.toThrow(
        'Slug já está em uso'
      );
    });

    it('deve rejeitar email já cadastrado', async () => {
      // Arrange
      // O teste chama createTenant 2 vezes (2x toThrow)
      // Cada chamada faz: findUnique(slug) e findUnique(email)
      // Total: 4 mocks necessários
      prismaMock.tenant.findUnique
        .mockResolvedValueOnce(null) // 1ª chamada - slug ok
        .mockResolvedValueOnce({      // 1ª chamada - email duplicado
          id: 'existing-tenant',
          email: 'admin@hotel-paraiso.com',
        } as any)
        .mockResolvedValueOnce(null) // 2ª chamada - slug ok
        .mockResolvedValueOnce({      // 2ª chamada - email duplicado
          id: 'existing-tenant',
          email: 'admin@hotel-paraiso.com',
        } as any);

      // Act & Assert
      await expect(tenantService.createTenant(validTenantData)).rejects.toThrow(BadRequestError);
      await expect(tenantService.createTenant(validTenantData)).rejects.toThrow(
        'Email já cadastrado'
      );
    });

    it('deve gerar webhook verify token único com 32 caracteres', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      mockGenerateToken.mockReturnValueOnce('webhook-32').mockReturnValueOnce('temp-16');

      prismaMock.tenant.create.mockResolvedValue({
        id: 'tenant-123',
        whatsappWebhookVerifyToken: 'webhook-32',
      } as any);

      mockRegister.mockResolvedValue({ id: 'admin-123' } as any);

      // Act
      await tenantService.createTenant(validTenantData);

      // Assert
      expect(mockGenerateToken).toHaveBeenCalledWith(32);
    });

    it('deve gerar senha temporária com 16 caracteres', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      mockGenerateToken.mockReturnValueOnce('webhook').mockReturnValueOnce('temp-16');

      prismaMock.tenant.create.mockResolvedValue({ id: 'tenant-123' } as any);
      mockRegister.mockResolvedValue({ id: 'admin-123' } as any);

      // Act
      await tenantService.createTenant(validTenantData);

      // Assert
      expect(mockGenerateToken).toHaveBeenCalledWith(16);
    });

    it('deve criar tenant com trial de 14 dias', async () => {
      // Arrange
      const now = Date.now();
      const expectedTrialEnd = new Date(now + 14 * 24 * 60 * 60 * 1000);

      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null);
      mockGenerateToken.mockReturnValue('token');

      prismaMock.tenant.create.mockImplementation((async (args: any) => {
        const trialEndsAt = args.data.trialEndsAt;
        expect(trialEndsAt.getTime()).toBeGreaterThanOrEqual(expectedTrialEnd.getTime() - 1000);
        expect(trialEndsAt.getTime()).toBeLessThanOrEqual(expectedTrialEnd.getTime() + 1000);
        return { id: 'tenant-123' } as any;
      }) as any);

      mockRegister.mockResolvedValue({ id: 'admin-123' } as any);

      // Act
      await tenantService.createTenant(validTenantData);

      // Assert
      expect(prismaMock.tenant.create).toHaveBeenCalled();
    });
  });

  describe('listTenants', () => {
    const mockTenants = [
      {
        id: 'tenant-1',
        name: 'Hotel A',
        slug: 'hotel-a',
        email: 'admin@hotel-a.com',
        status: 'ACTIVE' as TenantStatus,
        plan: 'PREMIUM' as Plan,
        createdAt: new Date('2024-01-01'),
        _count: { users: 10, conversations: 50 },
      },
      {
        id: 'tenant-2',
        name: 'Hotel B',
        slug: 'hotel-b',
        email: 'admin@hotel-b.com',
        status: 'TRIAL' as TenantStatus,
        plan: 'BASIC' as Plan,
        createdAt: new Date('2024-01-02'),
        _count: { users: 5, conversations: 20 },
      },
    ];

    it('deve listar tenants com paginação padrão', async () => {
      // Arrange
      prismaMock.tenant.findMany.mockResolvedValue(mockTenants as any);
      prismaMock.tenant.count.mockResolvedValue(2);

      // Act
      const result = await tenantService.listTenants();

      // Assert
      expect(prismaMock.tenant.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          status: true,
          plan: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              conversations: true,
            },
          },
        },
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        pages: 1,
      });
    });

    it('deve listar tenants com paginação customizada', async () => {
      // Arrange
      prismaMock.tenant.findMany.mockResolvedValue([mockTenants[0]] as any);
      prismaMock.tenant.count.mockResolvedValue(15);

      // Act
      const result = await tenantService.listTenants({
        page: 3,
        limit: 5,
      });

      // Assert
      expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 3 - 1) * 5
          take: 5,
        })
      );

      expect(result.pagination).toEqual({
        page: 3,
        limit: 5,
        total: 15,
        pages: 3,
      });
    });

    it('deve limitar paginação a 100 itens máximo', async () => {
      // Arrange
      prismaMock.tenant.findMany.mockResolvedValue([]);
      prismaMock.tenant.count.mockResolvedValue(0);

      // Act
      await tenantService.listTenants({
        limit: 500,
      });

      // Assert
      expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('deve filtrar tenants por status', async () => {
      // Arrange
      prismaMock.tenant.findMany.mockResolvedValue([mockTenants[0]] as any);
      prismaMock.tenant.count.mockResolvedValue(1);

      // Act
      await tenantService.listTenants({
        status: 'ACTIVE',
      });

      // Assert
      expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
          },
        })
      );
    });

    it('deve buscar tenants por nome', async () => {
      // Arrange
      prismaMock.tenant.findMany.mockResolvedValue([mockTenants[0]] as any);
      prismaMock.tenant.count.mockResolvedValue(1);

      // Act
      await tenantService.listTenants({
        search: 'Hotel A',
      });

      // Assert
      expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'Hotel A', mode: 'insensitive' } },
              { email: { contains: 'Hotel A', mode: 'insensitive' } },
              { slug: { contains: 'Hotel A', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('deve combinar status e busca', async () => {
      // Arrange
      prismaMock.tenant.findMany.mockResolvedValue([]);
      prismaMock.tenant.count.mockResolvedValue(0);

      // Act
      await tenantService.listTenants({
        status: 'ACTIVE',
        search: 'Hotel',
      });

      // Assert
      expect(prismaMock.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
            OR: [
              { name: { contains: 'Hotel', mode: 'insensitive' } },
              { email: { contains: 'Hotel', mode: 'insensitive' } },
              { slug: { contains: 'Hotel', mode: 'insensitive' } },
            ],
          },
        })
      );
    });
  });

  describe('getTenantById', () => {
    const mockTenant = {
      id: 'tenant-123',
      name: 'Hotel Paraíso',
      slug: 'hotel-paraiso',
      email: 'admin@hotel.com',
      status: 'ACTIVE' as TenantStatus,
      plan: 'PREMIUM' as Plan,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: {
        users: 10,
        conversations: 50,
        messages: 1000,
        contacts: 200,
      },
    };

    it('deve buscar tenant por ID com sucesso', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      // Act
      const result = await tenantService.getTenantById('tenant-123');

      // Assert
      expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        include: {
          _count: {
            select: {
              users: true,
              conversations: true,
              messages: true,
              contacts: true,
            },
          },
        },
      });

      expect(result.id).toBe('tenant-123');
      expect(result._count.users).toBe(10);
    });

    it('deve lançar NotFoundError quando tenant não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(tenantService.getTenantById('nonexistent-tenant')).rejects.toThrow(
        NotFoundError
      );
      await expect(tenantService.getTenantById('nonexistent-tenant')).rejects.toThrow(
        'Tenant não encontrado'
      );
    });
  });

  describe('updateTenant', () => {
    const existingTenant = {
      id: 'tenant-123',
      name: 'Hotel Original',
      slug: 'hotel-original',
      email: 'original@hotel.com',
      status: 'ACTIVE' as TenantStatus,
      plan: 'BASIC' as Plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('deve atualizar tenant com sucesso', async () => {
      // Arrange
      const updateData = {
        name: 'Hotel Atualizado',
        plan: 'PREMIUM' as Plan,
        maxAttendants: 50,
      };

      prismaMock.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaMock.tenant.update.mockResolvedValue({
        ...existingTenant,
        ...updateData,
      } as any);

      // Act
      const result = await tenantService.updateTenant('tenant-123', updateData);

      // Assert
      expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
      });

      expect(prismaMock.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.name).toBe('Hotel Atualizado');
    });

    it('deve atualizar email quando não está em uso', async () => {
      // Arrange
      const updateData = {
        email: 'novo@hotel.com',
      };

      prismaMock.tenant.findUnique.mockResolvedValueOnce(existingTenant as any);
      prismaMock.tenant.findUnique.mockResolvedValueOnce(null); // Email disponível
      prismaMock.tenant.update.mockResolvedValue({
        ...existingTenant,
        ...updateData,
      } as any);

      // Act
      await tenantService.updateTenant('tenant-123', updateData);

      // Assert
      expect(prismaMock.tenant.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: 'novo@hotel.com' },
      });

      expect(prismaMock.tenant.update).toHaveBeenCalled();
    });

    it('deve rejeitar atualização de email já em uso', async () => {
      // Arrange
      const updateData = {
        email: 'ocupado@hotel.com',
      };

      // O teste chama updateTenant 2 vezes (2x toThrow)
      // Cada chamada faz: findUnique(id) e findUnique(email)
      // Total: 4 mocks necessários
      prismaMock.tenant.findUnique
        .mockResolvedValueOnce(existingTenant as any) // 1ª chamada - buscar por ID
        .mockResolvedValueOnce({                       // 1ª chamada - email já existe
          id: 'outro-tenant',
          email: 'ocupado@hotel.com',
        } as any)
        .mockResolvedValueOnce(existingTenant as any) // 2ª chamada - buscar por ID
        .mockResolvedValueOnce({                       // 2ª chamada - email já existe
          id: 'outro-tenant',
          email: 'ocupado@hotel.com',
        } as any);

      // Act & Assert
      await expect(tenantService.updateTenant('tenant-123', updateData)).rejects.toThrow(
        BadRequestError
      );
      await expect(tenantService.updateTenant('tenant-123', updateData)).rejects.toThrow(
        'Email já em uso'
      );
    });

    it('deve permitir manter o mesmo email', async () => {
      // Arrange
      const updateData = {
        email: 'original@hotel.com', // Mesmo email
        name: 'Novo Nome',
      };

      prismaMock.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaMock.tenant.update.mockResolvedValue({
        ...existingTenant,
        ...updateData,
      } as any);

      // Act
      await tenantService.updateTenant('tenant-123', updateData);

      // Assert
      // Não deve verificar duplicação de email
      expect(prismaMock.tenant.findUnique).toHaveBeenCalledTimes(1);
      expect(prismaMock.tenant.update).toHaveBeenCalled();
    });

    it('deve lançar NotFoundError quando tenant não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        tenantService.updateTenant('nonexistent-tenant', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);
      await expect(
        tenantService.updateTenant('nonexistent-tenant', { name: 'Test' })
      ).rejects.toThrow('Tenant não encontrado');
    });

    it('deve atualizar configurações do WhatsApp', async () => {
      // Arrange
      const updateData = {
        whatsappPhoneNumberId: '1234567890',
        whatsappAccessToken: 'EAAtoken123',
        whatsappBusinessAccountId: 'biz-123',
      };

      prismaMock.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaMock.tenant.update.mockResolvedValue({
        ...existingTenant,
        ...updateData,
      } as any);

      // Act
      await tenantService.updateTenant('tenant-123', updateData);

      // Assert
      expect(prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining(updateData),
        })
      );
    });
  });

  describe('deleteTenant', () => {
    it('deve deletar tenant com sucesso', async () => {
      // Arrange
      const mockTenant = {
        id: 'tenant-123',
        slug: 'hotel-deletar',
      };

      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      prismaMock.tenant.delete.mockResolvedValue(mockTenant as any);

      // Act
      await tenantService.deleteTenant('tenant-123');

      // Assert
      expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
      });

      expect(prismaMock.tenant.delete).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
      });
    });

    it('deve lançar NotFoundError quando tenant não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(tenantService.deleteTenant('nonexistent-tenant')).rejects.toThrow(
        NotFoundError
      );
      await expect(tenantService.deleteTenant('nonexistent-tenant')).rejects.toThrow(
        'Tenant não encontrado'
      );

      expect(prismaMock.tenant.delete).not.toHaveBeenCalled();
    });
  });

  describe('suspendTenant', () => {
    it('deve suspender tenant com sucesso', async () => {
      // Arrange
      const existingTenant = {
        id: 'tenant-123',
        status: 'ACTIVE' as TenantStatus,
      };

      prismaMock.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaMock.tenant.update.mockResolvedValue({
        ...existingTenant,
        status: 'SUSPENDED',
      } as any);

      // Act
      const result = await tenantService.suspendTenant('tenant-123');

      // Assert
      expect(prismaMock.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: {
          status: 'SUSPENDED',
          updatedAt: expect.any(Date),
        },
      });

      expect(result.status).toBe('SUSPENDED');
    });

    it('deve propagar NotFoundError de updateTenant', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(tenantService.suspendTenant('nonexistent-tenant')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('activateTenant', () => {
    it('deve ativar tenant com sucesso', async () => {
      // Arrange
      const existingTenant = {
        id: 'tenant-123',
        status: 'SUSPENDED' as TenantStatus,
      };

      prismaMock.tenant.findUnique.mockResolvedValue(existingTenant as any);
      prismaMock.tenant.update.mockResolvedValue({
        ...existingTenant,
        status: 'ACTIVE',
      } as any);

      // Act
      const result = await tenantService.activateTenant('tenant-123');

      // Assert
      expect(prismaMock.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: {
          status: 'ACTIVE',
          updatedAt: expect.any(Date),
        },
      });

      expect(result.status).toBe('ACTIVE');
    });

    it('deve propagar NotFoundError de updateTenant', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(tenantService.activateTenant('nonexistent-tenant')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('configureWhatsApp', () => {
    const whatsappConfig = {
      whatsappPhoneNumberId: '1234567890',
      whatsappAccessToken: 'EAAtoken123',
      whatsappBusinessAccountId: 'biz-123',
      whatsappAppSecret: 'secret-abc',
    };

    it('deve configurar WhatsApp com sucesso', async () => {
      // Arrange
      const mockUpdatedTenant = {
        id: 'tenant-123',
        ...whatsappConfig,
      };

      prismaMock.tenant.update.mockResolvedValue(mockUpdatedTenant as any);

      // Act
      const result = await tenantService.configureWhatsApp('tenant-123', whatsappConfig);

      // Assert
      expect(prismaMock.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: {
          whatsappPhoneNumberId: whatsappConfig.whatsappPhoneNumberId,
          whatsappAccessToken: whatsappConfig.whatsappAccessToken,
          whatsappBusinessAccountId: whatsappConfig.whatsappBusinessAccountId,
          whatsappAppSecret: whatsappConfig.whatsappAppSecret,
        },
      });

      expect(result.whatsappPhoneNumberId).toBe(whatsappConfig.whatsappPhoneNumberId);
    });

    it('deve atualizar apenas os campos de WhatsApp fornecidos', async () => {
      // Arrange
      const partialConfig = {
        whatsappPhoneNumberId: '1234567890',
        whatsappAccessToken: 'EAAtoken123',
        whatsappBusinessAccountId: 'biz-123',
        whatsappAppSecret: 'secret-abc',
      };

      prismaMock.tenant.update.mockResolvedValue({ id: 'tenant-123' } as any);

      // Act
      await tenantService.configureWhatsApp('tenant-123', partialConfig);

      // Assert
      expect(prismaMock.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        data: partialConfig,
      });
    });
  });

  describe('getWhatsAppConfig', () => {
    it('deve buscar configuração WhatsApp com sucesso', async () => {
      // Arrange
      const mockConfig = {
        whatsappPhoneNumberId: '1234567890',
        whatsappBusinessAccountId: 'biz-123',
        whatsappWebhookVerifyToken: 'verify-token-123',
      };

      prismaMock.tenant.findUnique.mockResolvedValue(mockConfig as any);

      // Act
      const result = await tenantService.getWhatsAppConfig('tenant-123');

      // Assert
      expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        select: {
          whatsappPhoneNumberId: true,
          whatsappBusinessAccountId: true,
          whatsappWebhookVerifyToken: true,
        },
      });

      expect(result).toEqual(mockConfig);
    });

    it('deve retornar apenas campos não sensíveis', async () => {
      // Arrange
      const mockConfig = {
        whatsappPhoneNumberId: '1234567890',
        whatsappBusinessAccountId: 'biz-123',
        whatsappWebhookVerifyToken: 'verify-token',
      };

      prismaMock.tenant.findUnique.mockResolvedValue(mockConfig as any);

      // Act
      const result = await tenantService.getWhatsAppConfig('tenant-123');

      // Assert
      expect(result).not.toHaveProperty('whatsappAccessToken');
      expect(result).not.toHaveProperty('whatsappAppSecret');
    });

    it('deve lançar NotFoundError quando tenant não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(tenantService.getWhatsAppConfig('nonexistent-tenant')).rejects.toThrow(
        NotFoundError
      );
      await expect(tenantService.getWhatsAppConfig('nonexistent-tenant')).rejects.toThrow(
        'Tenant não encontrado'
      );
    });
  });
});
