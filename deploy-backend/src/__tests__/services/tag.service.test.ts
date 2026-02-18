/**
 * Testes para TagService
 *
 * TDD: RED → GREEN → REFACTOR
 *
 * Testes de isolamento multi-tenant e CRUD completo
 */

import { TagService } from '@/services/tag.service';
import { prisma } from '@/config/database';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import type { Tag, Conversation } from '@prisma/client';

// Mock adicional do Prisma para tag - complementa o jest.setup.ts
(prisma as any).tag = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaTag = prisma.tag as jest.Mocked<typeof prisma.tag>;
const mockPrismaConversation = prisma.conversation as jest.Mocked<typeof prisma.conversation>;

// Factory para criar mock de Tag
function createMockTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1-uuid',
    name: 'VIP',
    color: '#FF5733',
    tenantId: 'tenant-1',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// Factory para criar mock de Conversation
function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1-uuid',
    contactId: 'contact-1',
    assignedToId: null,
    status: 'OPEN',
    priority: 'MEDIUM',
    channel: 'WHATSAPP',
    source: null,
    hotelUnit: null,
    iaLocked: false,
    iaLockedAt: null,
    iaLockedBy: null,
    isOpportunity: false,
    opportunityAt: null,
    lastMessageAt: new Date(),
    createdAt: new Date('2026-01-01'),
    closedAt: null,
    metadata: null,
    tenantId: 'tenant-1',
    ...overrides,
  };
}

describe('TagService', () => {
  let tagService: TagService;

  beforeEach(() => {
    tagService = new TagService();
    jest.clearAllMocks();
  });

  describe('listTags - Multi-Tenant Isolation', () => {
    /**
     * TESTE CRITICO - Multi-Tenant
     *
     * listTags DEVE SEMPRE incluir tenantId na query
     */
    it('deve incluir tenantId na query ao listar tags', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      mockPrismaTag.findMany.mockResolvedValue([]);

      // Act
      await tagService.listTags(tenantId);

      // Assert
      expect(mockPrismaTag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });

    it('deve retornar apenas tags do tenant especificado', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const mockTags = [
        { ...createMockTag({ id: 'tag-1', name: 'VIP', tenantId }), _count: { conversations: 5 } },
        { ...createMockTag({ id: 'tag-2', name: 'Premium', tenantId }), _count: { conversations: 3 } },
      ];
      mockPrismaTag.findMany.mockResolvedValue(mockTags as any);

      // Act
      const result = await tagService.listTags(tenantId);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockPrismaTag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
        })
      );
    });
  });

  describe('listTags - Funcionalidades', () => {
    it('deve retornar tags formatadas com conversationsCount', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const createdAt = new Date('2026-01-01');
      const mockTags = [
        {
          id: 'tag-1',
          name: 'VIP',
          color: '#FF5733',
          createdAt: createdAt,
          _count: { conversations: 5 },
        },
      ];
      mockPrismaTag.findMany.mockResolvedValue(mockTags as any);

      // Act
      const result = await tagService.listTags(tenantId);

      // Assert
      expect(result[0]).toEqual({
        id: 'tag-1',
        name: 'VIP',
        color: '#FF5733',
        createdAt: createdAt,
        conversationsCount: 5,
      });
    });

    it('deve aplicar filtro de busca quando fornecido', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      mockPrismaTag.findMany.mockResolvedValue([]);

      // Act
      await tagService.listTags(tenantId, { search: 'VIP' });

      // Assert
      expect(mockPrismaTag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            name: { contains: 'VIP', mode: 'insensitive' },
          },
        })
      );
    });

    it('deve retornar todas as tags quando search estiver vazio', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      mockPrismaTag.findMany.mockResolvedValue([]);

      // Act
      await tagService.listTags(tenantId, { search: '' });

      // Assert
      expect(mockPrismaTag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
        })
      );
    });

    it('deve ordenar tags por nome ascendente', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      mockPrismaTag.findMany.mockResolvedValue([]);

      // Act
      await tagService.listTags(tenantId);

      // Assert
      expect(mockPrismaTag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });
  });

  describe('getTagById - Multi-Tenant Isolation', () => {
    /**
     * TESTE CRITICO - Multi-Tenant
     *
     * getTagById DEVE verificar que tag pertence ao tenant
     */
    it('deve incluir tenantId na query ao buscar tag por ID', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const mockTag = {
        ...createMockTag({ id: tagId, tenantId }),
        _count: { conversations: 2 },
      };
      mockPrismaTag.findFirst.mockResolvedValue(mockTag as any);

      // Act
      await tagService.getTagById(tagId, tenantId);

      // Assert
      expect(mockPrismaTag.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: tagId,
            tenantId: tenantId,
          },
        })
      );
    });

    it('deve retornar tag formatada com conversationsCount', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const mockTag = {
        id: tagId,
        name: 'VIP',
        color: '#FF5733',
        createdAt: new Date('2026-01-01'),
        _count: { conversations: 7 },
      };
      mockPrismaTag.findFirst.mockResolvedValue(mockTag as any);

      // Act
      const result = await tagService.getTagById(tagId, tenantId);

      // Assert
      expect(result).toEqual({
        id: tagId,
        name: 'VIP',
        color: '#FF5733',
        createdAt: mockTag.createdAt,
        conversationsCount: 7,
      });
    });

    it('deve lancar NotFoundError quando tag nao existe', async () => {
      // Arrange
      mockPrismaTag.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        tagService.getTagById('non-existent-tag', 'tenant-1')
      ).rejects.toThrow(NotFoundError);
      await expect(
        tagService.getTagById('non-existent-tag', 'tenant-1')
      ).rejects.toThrow('Tag nao encontrada');
    });

    it('deve lancar NotFoundError quando tag existe mas pertence a outro tenant', async () => {
      // Arrange
      mockPrismaTag.findFirst.mockResolvedValue(null); // findFirst com tenantId diferente nao acha

      // Act & Assert
      await expect(
        tagService.getTagById('tag-1', 'tenant-2')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('createTag - Multi-Tenant Isolation', () => {
    /**
     * TESTE CRITICO - Multi-Tenant
     *
     * createTag DEVE verificar unicidade de nome DENTRO do tenant
     */
    it('deve verificar duplicidade de nome DENTRO do tenant', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const data = { name: 'VIP', color: '#FF5733' };
      mockPrismaTag.findFirst.mockResolvedValue(null);
      mockPrismaTag.create.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.createTag(tenantId, data);

      // Assert - Verifica que busca por nome + tenantId
      expect(mockPrismaTag.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          name: 'VIP',
        },
      });
    });

    it('deve criar tag com tenantId correto', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const data = { name: 'VIP', color: '#FF5733' };
      mockPrismaTag.findFirst.mockResolvedValue(null);
      mockPrismaTag.create.mockResolvedValue(createMockTag({ tenantId }) as any);

      // Act
      await tagService.createTag(tenantId, data);

      // Assert
      expect(mockPrismaTag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tenantId: 'tenant-1',
            name: 'VIP',
            color: '#FF5733',
          },
        })
      );
    });

    it('deve permitir mesmo nome em tenants diferentes', async () => {
      // Arrange
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';
      const data = { name: 'VIP', color: '#FF5733' };

      mockPrismaTag.findFirst.mockResolvedValue(null);
      mockPrismaTag.create
        .mockResolvedValueOnce(createMockTag({ tenantId: tenant1 }) as any)
        .mockResolvedValueOnce(createMockTag({ tenantId: tenant2 }) as any);

      // Act & Assert - Deve criar em ambos os tenants sem erro
      await expect(tagService.createTag(tenant1, data)).resolves.toBeDefined();
      await expect(tagService.createTag(tenant2, data)).resolves.toBeDefined();
    });
  });

  describe('createTag - Validacoes', () => {
    it('deve retornar tag criada com todos os campos', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const data = { name: 'VIP', color: '#FF5733' };
      const mockTag = {
        id: 'tag-1',
        name: 'VIP',
        color: '#FF5733',
        createdAt: new Date('2026-01-01'),
      };
      mockPrismaTag.findFirst.mockResolvedValue(null);
      mockPrismaTag.create.mockResolvedValue(mockTag as any);

      // Act
      const result = await tagService.createTag(tenantId, data);

      // Assert
      expect(result).toEqual(mockTag);
    });

    it('deve lancar BadRequestError quando nome ja existe no tenant', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const data = { name: 'VIP', color: '#FF5733' };
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ name: 'VIP', tenantId }));

      // Act & Assert
      await expect(
        tagService.createTag(tenantId, data)
      ).rejects.toThrow(BadRequestError);
      await expect(
        tagService.createTag(tenantId, data)
      ).rejects.toThrow('Ja existe uma tag com este nome');
    });
  });

  describe('updateTag - Multi-Tenant Isolation', () => {
    /**
     * TESTE CRITICO - Multi-Tenant
     *
     * updateTag DEVE verificar que tag pertence ao tenant antes de atualizar
     */
    it('deve verificar que tag pertence ao tenant antes de atualizar', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { name: 'VIP Premium' };
      mockPrismaTag.findFirst
        .mockResolvedValueOnce(createMockTag({ id: tagId, tenantId }))
        .mockResolvedValueOnce(null); // Verificacao de duplicidade
      mockPrismaTag.update.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.updateTag(tagId, tenantId, data);

      // Assert
      expect(mockPrismaTag.findFirst).toHaveBeenCalledWith({
        where: { id: tagId, tenantId: tenantId },
      });
    });

    it('deve verificar duplicidade de nome DENTRO do tenant excluindo a propria tag', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { name: 'VIP Premium' };
      mockPrismaTag.findFirst
        .mockResolvedValueOnce(createMockTag({ id: tagId, name: 'VIP', tenantId }))
        .mockResolvedValueOnce(null);
      mockPrismaTag.update.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.updateTag(tagId, tenantId, data);

      // Assert - Segunda chamada verifica duplicidade
      expect(mockPrismaTag.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          tenantId: tenantId,
          name: 'VIP Premium',
          id: { not: tagId },
        },
      });
    });

    it('deve lancar NotFoundError quando tag nao existe', async () => {
      // Arrange
      mockPrismaTag.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        tagService.updateTag('non-existent', 'tenant-1', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);
      await expect(
        tagService.updateTag('non-existent', 'tenant-1', { name: 'Test' })
      ).rejects.toThrow('Tag nao encontrada');
    });

    it('deve lancar NotFoundError quando tag existe mas pertence a outro tenant', async () => {
      // Arrange
      mockPrismaTag.findFirst.mockResolvedValue(null); // Nao acha com tenantId diferente

      // Act & Assert
      await expect(
        tagService.updateTag('tag-1', 'tenant-2', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateTag - Validacoes', () => {
    it('deve atualizar apenas o nome quando fornecido', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { name: 'VIP Premium' };
      mockPrismaTag.findFirst
        .mockResolvedValueOnce(createMockTag({ id: tagId, name: 'VIP' }))
        .mockResolvedValueOnce(null);
      mockPrismaTag.update.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.updateTag(tagId, tenantId, data);

      // Assert
      expect(mockPrismaTag.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tagId },
          data: { name: 'VIP Premium' },
        })
      );
    });

    it('deve atualizar apenas a cor quando fornecida', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { color: '#00FF00' };
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ id: tagId }));
      mockPrismaTag.update.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.updateTag(tagId, tenantId, data);

      // Assert
      expect(mockPrismaTag.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tagId },
          data: { color: '#00FF00' },
        })
      );
    });

    it('deve atualizar nome e cor quando ambos fornecidos', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { name: 'VIP Premium', color: '#00FF00' };
      mockPrismaTag.findFirst
        .mockResolvedValueOnce(createMockTag({ id: tagId, name: 'VIP' }))
        .mockResolvedValueOnce(null);
      mockPrismaTag.update.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.updateTag(tagId, tenantId, data);

      // Assert
      expect(mockPrismaTag.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'VIP Premium', color: '#00FF00' },
        })
      );
    });

    it('nao deve verificar duplicidade quando nome nao foi alterado', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { name: 'VIP' }; // Mesmo nome
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ id: tagId, name: 'VIP' }));
      mockPrismaTag.update.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.updateTag(tagId, tenantId, data);

      // Assert - Apenas 1 chamada (buscar tag), nao verifica duplicidade
      expect(mockPrismaTag.findFirst).toHaveBeenCalledTimes(1);
    });

    it('deve lancar BadRequestError quando novo nome ja existe em outra tag do tenant', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { name: 'Premium' };
      mockPrismaTag.findFirst
        .mockResolvedValueOnce(createMockTag({ id: tagId, name: 'VIP' }))
        .mockResolvedValueOnce(createMockTag({ id: 'tag-2', name: 'Premium' })); // Ja existe

      // Act & Assert
      try {
        await tagService.updateTag(tagId, tenantId, data);
        fail('Should have thrown BadRequestError');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);
        expect((error as Error).message).toBe('Ja existe uma tag com este nome');
      }
    });

    it('deve retornar tag atualizada', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      const data = { name: 'VIP Premium' };
      const updatedTag = {
        id: tagId,
        name: 'VIP Premium',
        color: '#FF5733',
        createdAt: new Date('2026-01-01'),
      };
      mockPrismaTag.findFirst
        .mockResolvedValueOnce(createMockTag({ id: tagId, name: 'VIP' }))
        .mockResolvedValueOnce(null);
      mockPrismaTag.update.mockResolvedValue(updatedTag as any);

      // Act
      const result = await tagService.updateTag(tagId, tenantId, data);

      // Assert
      expect(result).toEqual(updatedTag);
    });
  });

  describe('deleteTag - Multi-Tenant Isolation', () => {
    /**
     * TESTE CRITICO - Multi-Tenant
     *
     * deleteTag DEVE verificar que tag pertence ao tenant antes de deletar
     */
    it('deve verificar que tag pertence ao tenant antes de deletar', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ id: tagId, tenantId }));
      mockPrismaTag.delete.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.deleteTag(tagId, tenantId);

      // Assert
      expect(mockPrismaTag.findFirst).toHaveBeenCalledWith({
        where: { id: tagId, tenantId: tenantId },
      });
    });

    it('deve deletar tag quando ela pertence ao tenant', async () => {
      // Arrange
      const tagId = 'tag-1';
      const tenantId = 'tenant-1';
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ id: tagId, tenantId }));
      mockPrismaTag.delete.mockResolvedValue(createMockTag() as any);

      // Act
      await tagService.deleteTag(tagId, tenantId);

      // Assert
      expect(mockPrismaTag.delete).toHaveBeenCalledWith({
        where: { id: tagId },
      });
    });

    it('deve lancar NotFoundError quando tag nao existe', async () => {
      // Arrange
      mockPrismaTag.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        tagService.deleteTag('non-existent', 'tenant-1')
      ).rejects.toThrow(NotFoundError);
      await expect(
        tagService.deleteTag('non-existent', 'tenant-1')
      ).rejects.toThrow('Tag nao encontrada');
    });

    it('deve lancar NotFoundError quando tag existe mas pertence a outro tenant', async () => {
      // Arrange
      mockPrismaTag.findFirst.mockResolvedValue(null); // Nao acha com tenantId diferente

      // Act & Assert
      await expect(
        tagService.deleteTag('tag-1', 'tenant-2')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('addTagToConversation - Multi-Tenant Isolation', () => {
    /**
     * TESTE CRITICO - Multi-Tenant
     *
     * addTagToConversation DEVE verificar que AMBOS conversation E tag pertencem ao tenant
     */
    it('deve verificar que conversation pertence ao tenant', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const conversationId = 'conv-1';
      const tagId = 'tag-1';
      mockPrismaConversation.findFirst.mockResolvedValue(createMockConversation({ id: conversationId, tenantId }));
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ id: tagId, tenantId }));
      mockPrismaConversation.update.mockResolvedValue({} as any);

      // Act
      await tagService.addTagToConversation(tenantId, conversationId, tagId);

      // Assert
      expect(mockPrismaConversation.findFirst).toHaveBeenCalledWith({
        where: { id: conversationId, tenantId: tenantId },
        select: { id: true },
      });
    });

    it('deve verificar que tag pertence ao tenant', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const conversationId = 'conv-1';
      const tagId = 'tag-1';
      mockPrismaConversation.findFirst.mockResolvedValue(createMockConversation({ id: conversationId, tenantId }));
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ id: tagId, tenantId }));
      mockPrismaConversation.update.mockResolvedValue({} as any);

      // Act
      await tagService.addTagToConversation(tenantId, conversationId, tagId);

      // Assert
      expect(mockPrismaTag.findFirst).toHaveBeenCalledWith({
        where: { id: tagId, tenantId: tenantId },
        select: { id: true },
      });
    });

    it('deve conectar tag a conversation quando ambos pertencem ao tenant', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const conversationId = 'conv-1';
      const tagId = 'tag-1';
      mockPrismaConversation.findFirst.mockResolvedValue(createMockConversation({ id: conversationId, tenantId }));
      mockPrismaTag.findFirst.mockResolvedValue(createMockTag({ id: tagId, tenantId }));
      mockPrismaConversation.update.mockResolvedValue({} as any);

      // Act
      await tagService.addTagToConversation(tenantId, conversationId, tagId);

      // Assert
      expect(mockPrismaConversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: {
          tags: {
            connect: { id: tagId },
          },
        },
      });
    });

    it('deve lancar NotFoundError quando conversation nao existe', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      mockPrismaConversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        tagService.addTagToConversation(tenantId, 'non-existent-conv', 'tag-1')
      ).rejects.toThrow(NotFoundError);
      await expect(
        tagService.addTagToConversation(tenantId, 'non-existent-conv', 'tag-1')
      ).rejects.toThrow('Conversa nao encontrada');
    });

    it('deve lancar NotFoundError quando conversation pertence a outro tenant', async () => {
      // Arrange
      mockPrismaConversation.findFirst.mockResolvedValue(null); // Nao acha com tenantId diferente

      // Act & Assert
      await expect(
        tagService.addTagToConversation('tenant-2', 'conv-1', 'tag-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('deve lancar NotFoundError quando tag nao existe', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const conversationId = 'conv-1';
      mockPrismaConversation.findFirst.mockResolvedValue(createMockConversation({ id: conversationId, tenantId }));
      mockPrismaTag.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        tagService.addTagToConversation(tenantId, conversationId, 'non-existent-tag')
      ).rejects.toThrow(NotFoundError);
      await expect(
        tagService.addTagToConversation(tenantId, conversationId, 'non-existent-tag')
      ).rejects.toThrow('Tag nao encontrada');
    });

    it('deve lancar NotFoundError quando tag pertence a outro tenant', async () => {
      // Arrange
      const conversationId = 'conv-1';
      mockPrismaConversation.findFirst.mockResolvedValue(createMockConversation({ id: conversationId, tenantId: 'tenant-1' }));
      mockPrismaTag.findFirst.mockResolvedValue(null); // Tag de outro tenant nao e achada

      // Act & Assert
      await expect(
        tagService.addTagToConversation('tenant-1', conversationId, 'tag-from-tenant-2')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('removeTagFromConversation - Multi-Tenant Isolation', () => {
    /**
     * TESTE CRITICO - Multi-Tenant
     *
     * removeTagFromConversation DEVE verificar que conversation pertence ao tenant
     */
    it('deve verificar que conversation pertence ao tenant', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const conversationId = 'conv-1';
      const tagId = 'tag-1';
      mockPrismaConversation.findFirst.mockResolvedValue(createMockConversation({ id: conversationId, tenantId }));
      mockPrismaConversation.update.mockResolvedValue({} as any);

      // Act
      await tagService.removeTagFromConversation(tenantId, conversationId, tagId);

      // Assert
      expect(mockPrismaConversation.findFirst).toHaveBeenCalledWith({
        where: { id: conversationId, tenantId: tenantId },
        select: { id: true },
      });
    });

    it('deve desconectar tag da conversation quando conversation pertence ao tenant', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      const conversationId = 'conv-1';
      const tagId = 'tag-1';
      mockPrismaConversation.findFirst.mockResolvedValue(createMockConversation({ id: conversationId, tenantId }));
      mockPrismaConversation.update.mockResolvedValue({} as any);

      // Act
      await tagService.removeTagFromConversation(tenantId, conversationId, tagId);

      // Assert
      expect(mockPrismaConversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: {
          tags: {
            disconnect: { id: tagId },
          },
        },
      });
    });

    it('deve lancar NotFoundError quando conversation nao existe', async () => {
      // Arrange
      const tenantId = 'tenant-1';
      mockPrismaConversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        tagService.removeTagFromConversation(tenantId, 'non-existent-conv', 'tag-1')
      ).rejects.toThrow(NotFoundError);
      await expect(
        tagService.removeTagFromConversation(tenantId, 'non-existent-conv', 'tag-1')
      ).rejects.toThrow('Conversa nao encontrada');
    });

    it('deve lancar NotFoundError quando conversation pertence a outro tenant', async () => {
      // Arrange
      mockPrismaConversation.findFirst.mockResolvedValue(null); // Nao acha com tenantId diferente

      // Act & Assert
      await expect(
        tagService.removeTagFromConversation('tenant-2', 'conv-1', 'tag-1')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
