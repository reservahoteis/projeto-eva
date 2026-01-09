import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock, mockMessageGroupBy } from '../test/helpers/prisma-mock';
import { ConversationService } from './conversation.service';
import { NotFoundError, ForbiddenError } from '@/utils/errors';
import { ConversationStatus, Priority } from '@prisma/client';

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

describe('ConversationService', () => {
  let conversationService: ConversationService;

  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    conversationService = new ConversationService();
    // Mock padrão para groupBy (usado em listConversations para contar mensagens não lidas)
    mockMessageGroupBy([]);
  });

  describe('listConversations', () => {
    const mockConversations = [
      {
        id: 'conv-1',
        tenantId: 'tenant-123',
        contactId: 'contact-1',
        status: 'OPEN' as ConversationStatus,
        priority: 'MEDIUM' as Priority,
        assignedToId: 'user-1',
        lastMessageAt: new Date('2024-01-15'),
        closedAt: null,
        contact: {
          id: 'contact-1',
          phoneNumber: '5511999999999',
          name: 'João Silva',
          profilePictureUrl: null,
        },
        assignedTo: {
          id: 'user-1',
          name: 'Atendente 1',
          email: 'atendente1@hotel.com',
        },
        tags: [
          {
            id: 'tag-1',
            name: 'Urgente',
            color: '#FF0000',
          },
        ],
        messages: [
          {
            id: 'msg-1',
            content: 'Última mensagem',
            direction: 'INBOUND' as const,
            type: 'TEXT' as const,
            timestamp: new Date('2024-01-15'),
          },
        ],
      },
      {
        id: 'conv-2',
        tenantId: 'tenant-123',
        contactId: 'contact-2',
        status: 'IN_PROGRESS' as ConversationStatus,
        priority: 'HIGH' as Priority,
        assignedToId: 'user-2',
        lastMessageAt: new Date('2024-01-14'),
        closedAt: null,
        contact: {
          id: 'contact-2',
          phoneNumber: '5511888888888',
          name: 'Maria Santos',
          profilePictureUrl: null,
        },
        assignedTo: {
          id: 'user-2',
          name: 'Atendente 2',
          email: 'atendente2@hotel.com',
        },
        tags: [],
        messages: [],
      },
    ];

    it('deve listar conversas com paginação padrão', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue(mockConversations as never);
      prismaMock.conversation.count.mockResolvedValue(2);
      mockMessageGroupBy([{ conversationId: 'conv-1', _count: { id: 3 } }]);

      // Act
      const result = await conversationService.listConversations({
        tenantId: 'tenant-123',
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        skip: 0,
        take: 20,
        orderBy: { lastMessageAt: 'desc' },
        include: expect.any(Object),
      });

      expect(prismaMock.conversation.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        pages: 1,
      });
    });

    it('deve listar conversas com paginação customizada', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([mockConversations[0]] as never);
      prismaMock.conversation.count.mockResolvedValue(10);

      // Act
      const result = await conversationService.listConversations({
        tenantId: 'tenant-123',
        page: 2,
        limit: 5,
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page 2 - 1) * 5
          take: 5,
        })
      );

      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 10,
        pages: 2,
      });
    });

    it('deve limitar paginação a 100 itens máximo', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-123',
        limit: 200,
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Máximo permitido
        })
      );
    });

    it('deve filtrar por status', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-123',
        status: 'OPEN',
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            status: 'OPEN',
          },
        })
      );
    });

    it('deve filtrar por prioridade', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-123',
        priority: 'HIGH',
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            priority: 'HIGH',
          },
        })
      );
    });

    it('deve filtrar por atendente atribuído', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-123',
        assignedToId: 'user-1',
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            assignedToId: 'user-1',
          },
        })
      );
    });

    it('deve filtrar por nome do contato (search)', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-123',
        search: 'João',
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            contact: {
              OR: [
                { name: { contains: 'João', mode: 'insensitive' } },
                { phoneNumber: { contains: 'João' } },
              ],
            },
          },
        })
      );
    });

    it('deve filtrar conversas para ATTENDANT (apenas suas conversas)', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-123',
        userId: 'user-1',
        userRole: 'ATTENDANT',
      });

      // Assert - ATTENDANT só vê conversas atribuídas a ele (via OR)
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            OR: [{ assignedToId: 'user-1' }],
          },
        })
      );
    });

    it('deve permitir ADMIN ver todas as conversas', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-123',
        userId: 'admin-1',
        userRole: 'TENANT_ADMIN',
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
          },
        })
      );
    });

    it('deve incluir lastMessage e unreadCount', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue(mockConversations as never);
      prismaMock.conversation.count.mockResolvedValue(2);
      // Mock groupBy para retornar contagem de mensagens não lidas por conversa
      mockMessageGroupBy([
        { conversationId: 'conv-1', _count: { id: 3 } },
        // conv-2 não tem mensagens não lidas
      ]);

      // Act
      const result = await conversationService.listConversations({
        tenantId: 'tenant-123',
      });

      // Assert
      expect(result.data[0]).toHaveProperty('lastMessage');
      expect(result.data[0]?.lastMessage).toEqual(mockConversations[0]?.messages[0]);
      expect(result.data[0]).toHaveProperty('unreadCount', 3);
      expect(result.data[0]?.messages).toBeUndefined();

      expect(result.data[1]?.lastMessage).toBeNull();
      expect(result.data[1]?.unreadCount).toBe(0);
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.conversation.findMany.mockResolvedValue([]);
      prismaMock.conversation.count.mockResolvedValue(0);

      // Act
      await conversationService.listConversations({
        tenantId: 'tenant-456',
      });

      // Assert
      expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-456',
          }),
        })
      );
    });
  });

  describe('getConversationById', () => {
    const mockConversation = {
      id: 'conv-123',
      tenantId: 'tenant-123',
      contactId: 'contact-1',
      status: 'OPEN' as ConversationStatus,
      priority: 'MEDIUM' as Priority,
      assignedToId: 'user-1',
      lastMessageAt: new Date(),
      closedAt: null,
      contact: {
        id: 'contact-1',
        phoneNumber: '5511999999999',
        name: 'João Silva',
      },
      assignedTo: {
        id: 'user-1',
        name: 'Atendente 1',
        email: 'atendente1@hotel.com',
      },
      tags: [],
    };

    it('deve buscar conversa por ID com sucesso', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);

      // Act
      const result = await conversationService.getConversationById('conv-123', 'tenant-123');

      // Assert
      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'tenant-123',
        },
        include: {
          contact: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tags: true,
        },
      });

      expect(result.id).toBe('conv-123');
    });

    it('deve lançar NotFoundError quando conversa não existe', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.getConversationById('nonexistent-conv', 'tenant-123')
      ).rejects.toThrow(NotFoundError);

      await expect(
        conversationService.getConversationById('nonexistent-conv', 'tenant-123')
      ).rejects.toThrow('Conversa não encontrada');
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.getConversationById('conv-123', 'wrong-tenant')
      ).rejects.toThrow(NotFoundError);

      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'conv-123',
            tenantId: 'wrong-tenant',
          },
        })
      );
    });

    it('deve permitir ADMIN acessar qualquer conversa do tenant', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);

      // Act
      const result = await conversationService.getConversationById(
        'conv-123',
        'tenant-123',
        'admin-1',
        'TENANT_ADMIN'
      );

      // Assert
      expect(result.id).toBe('conv-123');
    });

    it('deve permitir ATTENDANT acessar sua própria conversa', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);

      // Act
      const result = await conversationService.getConversationById(
        'conv-123',
        'tenant-123',
        'user-1',
        'ATTENDANT'
      );

      // Assert
      expect(result.id).toBe('conv-123');
    });

    it('deve lançar ForbiddenError quando ATTENDANT tenta acessar conversa de outro', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);

      // Act & Assert
      await expect(
        conversationService.getConversationById('conv-123', 'tenant-123', 'user-2', 'ATTENDANT')
      ).rejects.toThrow(ForbiddenError);

      await expect(
        conversationService.getConversationById('conv-123', 'tenant-123', 'user-2', 'ATTENDANT')
      ).rejects.toThrow('Você não tem acesso a esta conversa');
    });
  });

  describe('getOrCreateConversation', () => {
    const mockExistingConversation = {
      id: 'conv-existing',
      tenantId: 'tenant-123',
      contactId: 'contact-1',
      status: 'OPEN' as ConversationStatus,
      priority: 'MEDIUM' as Priority,
      assignedToId: null,
      lastMessageAt: new Date(),
      closedAt: null,
      contact: {
        id: 'contact-1',
        phoneNumber: '5511999999999',
        name: 'João Silva',
      },
      assignedTo: null,
    };

    const mockNewConversation = {
      id: 'conv-new',
      tenantId: 'tenant-123',
      contactId: 'contact-1',
      status: 'OPEN' as ConversationStatus,
      priority: 'MEDIUM' as Priority,
      assignedToId: null,
      lastMessageAt: new Date(),
      closedAt: null,
      contact: {
        id: 'contact-1',
        phoneNumber: '5511999999999',
        name: 'João Silva',
      },
      assignedTo: null,
    };

    it('deve retornar conversa existente quando já existe (OPEN)', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockExistingConversation as never);

      // Act
      const result = await conversationService.getOrCreateConversation('tenant-123', 'contact-1');

      // Assert
      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          contactId: 'contact-1',
          status: {
            in: ['OPEN', 'IN_PROGRESS', 'WAITING'],
          },
        },
        include: {
          contact: true,
          assignedTo: true,
        },
      });

      expect(prismaMock.conversation.create).not.toHaveBeenCalled();
      expect(result.id).toBe('conv-existing');
    });

    it('deve retornar conversa existente quando já existe (IN_PROGRESS)', async () => {
      // Arrange
      const inProgressConversation = {
        ...mockExistingConversation,
        status: 'IN_PROGRESS' as ConversationStatus,
      };
      prismaMock.conversation.findFirst.mockResolvedValue(inProgressConversation as never);

      // Act
      const result = await conversationService.getOrCreateConversation('tenant-123', 'contact-1');

      // Assert
      expect(result.status).toBe('IN_PROGRESS');
      expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    });

    it('deve retornar conversa existente quando já existe (WAITING)', async () => {
      // Arrange
      const waitingConversation = {
        ...mockExistingConversation,
        status: 'WAITING' as ConversationStatus,
      };
      prismaMock.conversation.findFirst.mockResolvedValue(waitingConversation as never);

      // Act
      const result = await conversationService.getOrCreateConversation('tenant-123', 'contact-1');

      // Assert
      expect(result.status).toBe('WAITING');
      expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    });

    it('deve criar nova conversa quando não existe conversa aberta', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);
      prismaMock.conversation.create.mockResolvedValue(mockNewConversation as never);

      // Act
      const result = await conversationService.getOrCreateConversation('tenant-123', 'contact-1');

      // Assert
      expect(prismaMock.conversation.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-123',
          contactId: 'contact-1',
          status: 'OPEN',
          priority: 'MEDIUM',
          lastMessageAt: expect.any(Date),
        },
        include: {
          contact: true,
          assignedTo: true,
        },
      });

      expect(result.id).toBe('conv-new');
      expect(result.status).toBe('OPEN');
      expect(result.priority).toBe('MEDIUM');
    });

    it('deve criar nova conversa quando todas as conversas estão fechadas', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null); // Não encontra OPEN/IN_PROGRESS/WAITING
      prismaMock.conversation.create.mockResolvedValue(mockNewConversation as never);

      // Act
      const result = await conversationService.getOrCreateConversation('tenant-123', 'contact-1');

      // Assert
      expect(prismaMock.conversation.create).toHaveBeenCalled();
      expect(result.id).toBe('conv-new');
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);
      prismaMock.conversation.create.mockResolvedValue(mockNewConversation as never);

      // Act
      await conversationService.getOrCreateConversation('tenant-456', 'contact-1');

      // Assert
      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-456',
          }),
        })
      );

      expect(prismaMock.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-456',
          }),
        })
      );
    });
  });

  describe('assignConversation', () => {
    const mockConversation = {
      id: 'conv-123',
      tenantId: 'tenant-123',
      contactId: 'contact-1',
      status: 'OPEN' as ConversationStatus,
      priority: 'MEDIUM' as Priority,
      assignedToId: null,
      lastMessageAt: new Date(),
      closedAt: null,
    };

    const mockUser = {
      id: 'user-1',
      name: 'Atendente 1',
      email: 'atendente1@hotel.com',
      tenantId: 'tenant-123',
      status: 'ACTIVE' as const,
    };

    const mockUpdatedConversation = {
      ...mockConversation,
      assignedToId: 'user-1',
      status: 'IN_PROGRESS' as ConversationStatus,
      assignedTo: {
        id: 'user-1',
        name: 'Atendente 1',
        email: 'atendente1@hotel.com',
      },
    };

    it('deve atribuir conversa a um atendente com sucesso', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.user.findFirst.mockResolvedValue(mockUser as never);
      prismaMock.conversation.update.mockResolvedValue(mockUpdatedConversation as never);

      // Act
      const result = await conversationService.assignConversation('conv-123', 'tenant-123', 'user-1');

      // Assert
      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'tenant-123',
        },
      });

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          tenantId: 'tenant-123',
          status: 'ACTIVE',
        },
      });

      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: {
          assignedToId: 'user-1',
          status: 'IN_PROGRESS',
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      expect(result.assignedToId).toBe('user-1');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('deve manter status quando conversa já está IN_PROGRESS', async () => {
      // Arrange
      const inProgressConversation = {
        ...mockConversation,
        status: 'IN_PROGRESS' as ConversationStatus,
      };
      prismaMock.conversation.findFirst.mockResolvedValue(inProgressConversation as never);
      prismaMock.user.findFirst.mockResolvedValue(mockUser as never);
      prismaMock.conversation.update.mockResolvedValue({
        ...inProgressConversation,
        assignedToId: 'user-1',
      } as never);

      // Act
      await conversationService.assignConversation('conv-123', 'tenant-123', 'user-1');

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            assignedToId: 'user-1',
            status: 'IN_PROGRESS',
          },
        })
      );
    });

    it('deve lançar NotFoundError quando conversa não existe', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.assignConversation('nonexistent-conv', 'tenant-123', 'user-1')
      ).rejects.toThrow(NotFoundError);

      await expect(
        conversationService.assignConversation('nonexistent-conv', 'tenant-123', 'user-1')
      ).rejects.toThrow('Conversa não encontrada');
    });

    it('deve lançar NotFoundError quando usuário não existe', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.assignConversation('conv-123', 'tenant-123', 'nonexistent-user')
      ).rejects.toThrow(NotFoundError);

      await expect(
        conversationService.assignConversation('conv-123', 'tenant-123', 'nonexistent-user')
      ).rejects.toThrow('Atendente não encontrado');
    });

    it('deve lançar NotFoundError quando usuário está inativo', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.user.findFirst.mockResolvedValue(null); // User inativo não será encontrado

      // Act & Assert
      await expect(
        conversationService.assignConversation('conv-123', 'tenant-123', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('deve respeitar isolamento de tenant na conversa', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.assignConversation('conv-123', 'wrong-tenant', 'user-1')
      ).rejects.toThrow(NotFoundError);

      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'wrong-tenant',
        },
      });
    });

    it('deve respeitar isolamento de tenant no usuário', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.user.findFirst.mockResolvedValue(null); // User de outro tenant

      // Act & Assert
      await expect(
        conversationService.assignConversation('conv-123', 'tenant-123', 'user-from-other-tenant')
      ).rejects.toThrow(NotFoundError);

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-from-other-tenant',
          tenantId: 'tenant-123',
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('updateConversationStatus', () => {
    const mockConversation = {
      id: 'conv-123',
      tenantId: 'tenant-123',
      contactId: 'contact-1',
      status: 'OPEN' as ConversationStatus,
      priority: 'MEDIUM' as Priority,
      assignedToId: 'user-1',
      lastMessageAt: new Date(),
      closedAt: null,
    };

    it('deve atualizar status da conversa com sucesso', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'IN_PROGRESS',
      } as never);

      // Act
      const result = await conversationService.updateConversationStatus(
        'conv-123',
        'tenant-123',
        'IN_PROGRESS'
      );

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: {
          status: 'IN_PROGRESS',
          closedAt: null,
        },
      });

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('deve definir closedAt quando status é CLOSED', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'CLOSED',
        closedAt: new Date(),
      } as never);

      // Act
      await conversationService.updateConversationStatus('conv-123', 'tenant-123', 'CLOSED');

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: {
          status: 'CLOSED',
          closedAt: expect.any(Date),
        },
      });
    });

    it('deve definir closedAt como null quando status não é CLOSED', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'WAITING',
      } as never);

      // Act
      await conversationService.updateConversationStatus('conv-123', 'tenant-123', 'WAITING');

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: {
          status: 'WAITING',
          closedAt: null,
        },
      });
    });

    it('deve lançar NotFoundError quando conversa não existe', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.updateConversationStatus('nonexistent-conv', 'tenant-123', 'CLOSED')
      ).rejects.toThrow(NotFoundError);

      await expect(
        conversationService.updateConversationStatus('nonexistent-conv', 'tenant-123', 'CLOSED')
      ).rejects.toThrow('Conversa não encontrada');
    });

    it('deve permitir ADMIN atualizar qualquer conversa', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'CLOSED',
      } as never);

      // Act
      const result = await conversationService.updateConversationStatus(
        'conv-123',
        'tenant-123',
        'CLOSED',
        'admin-1',
        'TENANT_ADMIN'
      );

      // Assert
      expect(result.status).toBe('CLOSED');
    });

    it('deve permitir ATTENDANT atualizar sua própria conversa', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'CLOSED',
      } as never);

      // Act
      const result = await conversationService.updateConversationStatus(
        'conv-123',
        'tenant-123',
        'CLOSED',
        'user-1',
        'ATTENDANT'
      );

      // Assert
      expect(result.status).toBe('CLOSED');
    });

    it('deve lançar ForbiddenError quando ATTENDANT tenta atualizar conversa de outro', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);

      // Act & Assert
      await expect(
        conversationService.updateConversationStatus(
          'conv-123',
          'tenant-123',
          'CLOSED',
          'user-2',
          'ATTENDANT'
        )
      ).rejects.toThrow(ForbiddenError);

      await expect(
        conversationService.updateConversationStatus(
          'conv-123',
          'tenant-123',
          'CLOSED',
          'user-2',
          'ATTENDANT'
        )
      ).rejects.toThrow('Você não tem permissão para atualizar esta conversa');
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.updateConversationStatus('conv-123', 'wrong-tenant', 'CLOSED')
      ).rejects.toThrow(NotFoundError);

      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'wrong-tenant',
        },
      });
    });
  });

  describe('updatePriority', () => {
    const mockConversation = {
      id: 'conv-123',
      tenantId: 'tenant-123',
      priority: 'MEDIUM' as Priority,
    };

    it('deve atualizar prioridade com sucesso', async () => {
      // Arrange
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        priority: 'HIGH',
      } as never);

      // Act
      const result = await conversationService.updatePriority('conv-123', 'tenant-123', 'HIGH');

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'tenant-123',
        },
        data: { priority: 'HIGH' },
      });

      expect(result.priority).toBe('HIGH');
    });

    it('deve atualizar prioridade para LOW', async () => {
      // Arrange
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        priority: 'LOW',
      } as never);

      // Act
      const result = await conversationService.updatePriority('conv-123', 'tenant-123', 'LOW');

      // Assert
      expect(result.priority).toBe('LOW');
    });

    it('deve atualizar prioridade para URGENT', async () => {
      // Arrange
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        priority: 'URGENT',
      } as never);

      // Act
      const result = await conversationService.updatePriority('conv-123', 'tenant-123', 'URGENT');

      // Assert
      expect(result.priority).toBe('URGENT');
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.conversation.update.mockResolvedValue(mockConversation as never);

      // Act
      await conversationService.updatePriority('conv-123', 'tenant-456', 'HIGH');

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'tenant-456',
        },
        data: { priority: 'HIGH' },
      });
    });
  });

  describe('updateTags', () => {
    const mockTags = [
      { id: 'tag-1', name: 'Urgente', color: '#FF0000', tenantId: 'tenant-123' },
      { id: 'tag-2', name: 'VIP', color: '#00FF00', tenantId: 'tenant-123' },
    ];

    const mockUpdatedConversation = {
      id: 'conv-123',
      tenantId: 'tenant-123',
      tags: mockTags,
    };

    it('deve atualizar tags da conversa com sucesso', async () => {
      // Arrange
      prismaMock.tag.findMany.mockResolvedValue(mockTags as never);
      prismaMock.conversation.update.mockResolvedValue(mockUpdatedConversation as never);

      // Act
      const result = await conversationService.updateTags('conv-123', 'tenant-123', [
        'tag-1',
        'tag-2',
      ]);

      // Assert
      expect(prismaMock.tag.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['tag-1', 'tag-2'] },
          tenantId: 'tenant-123',
        },
      });

      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'tenant-123',
        },
        data: {
          tags: {
            set: [{ id: 'tag-1' }, { id: 'tag-2' }],
          },
        },
        include: {
          tags: true,
        },
      });

      expect(result.tags).toHaveLength(2);
    });

    it('deve limpar tags quando array vazio é fornecido', async () => {
      // Arrange
      prismaMock.tag.findMany.mockResolvedValue([]);
      prismaMock.conversation.update.mockResolvedValue({
        id: 'conv-123',
        tenantId: 'tenant-123',
        tags: [],
      } as never);

      // Act
      const result = await conversationService.updateTags('conv-123', 'tenant-123', []);

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tags: {
              set: [],
            },
          },
        })
      );

      expect(result.tags).toHaveLength(0);
    });

    it('deve lançar NotFoundError quando alguma tag não pertence ao tenant', async () => {
      // Arrange
      prismaMock.tag.findMany.mockResolvedValue([mockTags[0]] as never); // Apenas 1 tag encontrada

      // Act & Assert
      await expect(
        conversationService.updateTags('conv-123', 'tenant-123', ['tag-1', 'tag-2'])
      ).rejects.toThrow(NotFoundError);

      await expect(
        conversationService.updateTags('conv-123', 'tenant-123', ['tag-1', 'tag-2'])
      ).rejects.toThrow('Uma ou mais tags não encontradas');
    });

    it('deve lançar NotFoundError quando nenhuma tag é encontrada', async () => {
      // Arrange
      prismaMock.tag.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(
        conversationService.updateTags('conv-123', 'tenant-123', ['nonexistent-tag'])
      ).rejects.toThrow(NotFoundError);
    });

    it('deve respeitar isolamento de tenant nas tags', async () => {
      // Arrange
      prismaMock.tag.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(
        conversationService.updateTags('conv-123', 'tenant-123', ['tag-1'])
      ).rejects.toThrow(NotFoundError);

      expect(prismaMock.tag.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['tag-1'] },
          tenantId: 'tenant-123',
        },
      });
    });

    it('deve respeitar isolamento de tenant na conversa', async () => {
      // Arrange
      prismaMock.tag.findMany.mockResolvedValue(mockTags as never);
      prismaMock.conversation.update.mockResolvedValue(mockUpdatedConversation as never);

      // Act
      await conversationService.updateTags('conv-123', 'tenant-456', ['tag-1', 'tag-2']);

      // Assert
      expect(prismaMock.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'conv-123',
            tenantId: 'tenant-456',
          },
        })
      );
    });
  });

  describe('closeConversation', () => {
    const mockConversation = {
      id: 'conv-123',
      tenantId: 'tenant-123',
      status: 'OPEN' as ConversationStatus,
      assignedToId: null,
    };

    it('deve fechar conversa com sucesso', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(mockConversation as never);
      prismaMock.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'CLOSED',
        closedAt: new Date(),
      } as never);

      // Act
      const result = await conversationService.closeConversation('conv-123', 'tenant-123');

      // Assert
      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'tenant-123',
        },
      });

      expect(prismaMock.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: {
          status: 'CLOSED',
          closedAt: expect.any(Date),
        },
      });

      expect(result.status).toBe('CLOSED');
      expect(result.closedAt).toBeDefined();
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.closeConversation('conv-123', 'wrong-tenant')
      ).rejects.toThrow(NotFoundError);

      expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          tenantId: 'wrong-tenant',
        },
      });
    });

    it('deve lançar NotFoundError quando conversa não existe', async () => {
      // Arrange
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        conversationService.closeConversation('nonexistent-conv', 'tenant-123')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
