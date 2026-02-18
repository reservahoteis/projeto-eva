import { describe, it, expect, beforeEach } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../test/helpers/prisma-mock';
import { ContactService } from './contact.service';
import { NotFoundError } from '@/utils/errors';

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    resetPrismaMock();
    contactService = new ContactService();
  });

  describe('listContacts', () => {
    const mockContacts = [
      {
        id: 'contact-1',
        phoneNumber: '5511999999999',
        name: 'João Silva',
        email: 'joao@email.com',
        profilePictureUrl: null,
        metadata: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _count: { conversations: 5 },
        conversations: [{ id: 'conv-1', status: 'OPEN', lastMessageAt: new Date('2024-01-15') }],
      },
      {
        id: 'contact-2',
        phoneNumber: '5511888888888',
        name: 'Maria Santos',
        email: 'maria@email.com',
        profilePictureUrl: null,
        metadata: {},
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
        _count: { conversations: 3 },
        conversations: [{ id: 'conv-2', status: 'OPEN', lastMessageAt: new Date('2024-01-16') }],
      },
    ];

    it('deve listar contatos com paginação padrão', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue(mockContacts as never);
      prismaMock.contact.count.mockResolvedValue(2);

      // Act
      const result = await contactService.listContacts('tenant-123');

      // Assert
      expect(prismaMock.contact.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('deve listar contatos com paginação customizada', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue([mockContacts[0]] as never);
      prismaMock.contact.count.mockResolvedValue(10);

      // Act
      const result = await contactService.listContacts('tenant-123', {
        page: 2,
        limit: 5,
      });

      // Assert
      expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page 2 - 1) * 5
          take: 5,
        })
      );

      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
      });
    });

    it('deve limitar paginação a 100 itens máximo', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue([]);
      prismaMock.contact.count.mockResolvedValue(0);

      // Act
      await contactService.listContacts('tenant-123', {
        limit: 200,
      });

      // Assert
      expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Máximo permitido
        })
      );
    });

    it('deve buscar contatos por nome', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue([mockContacts[0]] as never);
      prismaMock.contact.count.mockResolvedValue(1);

      // Act
      await contactService.listContacts('tenant-123', {
        search: 'João',
      });

      // Assert
      expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-123',
            OR: [
              { name: { contains: 'João', mode: 'insensitive' } },
              { phoneNumber: { contains: 'João' } },
              { email: { contains: 'João', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('deve incluir conversationsCount e lastConversationAt', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue([mockContacts[0]] as never);
      prismaMock.contact.count.mockResolvedValue(1);

      // Act
      const result = await contactService.listContacts('tenant-123');

      // Assert
      expect(result.data[0]).toHaveProperty('conversationsCount', 5);
      expect(result.data[0]).toHaveProperty('lastConversationAt');
      expect((result.data[0] as Record<string, unknown>)?._count).toBeUndefined();
    });

    it('deve retornar lastConversationAt null quando não há conversas', async () => {
      // Arrange - contato sem conversas
      const contactWithoutConversations = {
        ...mockContacts[0],
        conversations: [],
      };
      prismaMock.contact.findMany.mockResolvedValue([contactWithoutConversations] as never);
      prismaMock.contact.count.mockResolvedValue(1);

      // Act
      const result = await contactService.listContacts('tenant-123');

      // Assert
      expect(result.data[0]?.lastConversationAt).toBeNull();
    });
  });

  describe('getContactById', () => {
    const mockContact = {
      id: 'contact-123',
      phoneNumber: '5511999999999',
      name: 'João Silva',
      email: 'joao@email.com',
      profilePictureUrl: null,
      tenantId: 'tenant-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: null,
      _count: { conversations: 1 },
      conversations: [
        {
          id: 'conv-1',
          lastMessageAt: new Date(),
        },
      ],
    };

    it('deve buscar contato por ID com sucesso', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(mockContact as never);

      // Act
      const result = await contactService.getContactById('contact-123', 'tenant-123');

      // Assert
      expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'contact-123',
          tenantId: 'tenant-123',
        },
        include: {
          _count: {
            select: {
              conversations: true,
            },
          },
          conversations: {
            orderBy: { lastMessageAt: 'desc' },
            take: 1,
            select: {
              id: true,
              lastMessageAt: true,
            },
          },
        },
      });

      expect(result!.id).toBe('contact-123');
      expect(result!.lastConversation).toBeDefined();
    });

    it('deve retornar null quando contato não existe', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act
      const result = await contactService.getContactById('nonexistent-contact', 'tenant-123');

      // Assert
      expect(result).toBeNull();
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act
      const result = await contactService.getContactById('contact-123', 'wrong-tenant');

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'contact-123',
            tenantId: 'wrong-tenant',
          },
        })
      );
    });
  });

  describe('getContactByPhoneNumber', () => {
    it('deve buscar contato por número de telefone', async () => {
      // Arrange
      const mockContact = {
        id: 'contact-123',
        phoneNumber: '5511999999999',
        name: 'João Silva',
        tenantId: 'tenant-123',
      };

      prismaMock.contact.findFirst.mockResolvedValue(mockContact as any);

      // Act
      const result = await contactService.getContactByPhoneNumber('5511999999999', 'tenant-123');

      // Assert
      expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
        where: {
          phoneNumber: '5511999999999',
          tenantId: 'tenant-123',
        },
      });

      expect(result?.phoneNumber).toBe('5511999999999');
    });

    it('deve retornar null quando contato não existe', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act
      const result = await contactService.getContactByPhoneNumber('5511888888888', 'tenant-123');

      // Assert
      expect(result).toBeNull();
    });

    it('deve respeitar isolamento de tenant na busca por telefone', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act
      await contactService.getContactByPhoneNumber('5511999999999', 'tenant-123');

      // Assert
      expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
        where: {
          phoneNumber: '5511999999999',
          tenantId: 'tenant-123',
        },
      });
    });
  });

  describe('createContact', () => {
    it('deve criar contato com todos os campos', async () => {
      // Arrange
      const contactData = {
        phoneNumber: '5511999999999',
        name: 'João Silva',
        email: 'joao@email.com',
        tenantId: 'tenant-123',
      };

      const mockCreatedContact = {
        id: 'new-contact-123',
        ...contactData,
        profilePictureUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        _count: { conversations: 0 },
      };

      prismaMock.contact.create.mockResolvedValue(mockCreatedContact as never);

      // Act
      const result = await contactService.createContact(contactData);

      // Assert
      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: {
          phoneNumber: contactData.phoneNumber,
          name: contactData.name,
          email: contactData.email,
          profilePictureUrl: null,
          metadata: {},
          tenantId: contactData.tenantId,
          channel: 'WHATSAPP',
          externalId: contactData.phoneNumber,
        },
        include: {
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      });

      expect(result.id).toBe('new-contact-123');
      expect(result.phoneNumber).toBe(contactData.phoneNumber);
    });

    it('deve criar contato apenas com telefone (campos opcionais null)', async () => {
      // Arrange
      const contactData = {
        phoneNumber: '5511999999999',
        tenantId: 'tenant-123',
      };

      const mockCreatedContact = {
        id: 'new-contact-123',
        phoneNumber: contactData.phoneNumber,
        name: null,
        email: null,
        tenantId: contactData.tenantId,
        profilePictureUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
        _count: { conversations: 0 },
      };

      prismaMock.contact.create.mockResolvedValue(mockCreatedContact as never);

      // Act
      const result = await contactService.createContact(contactData);

      // Assert
      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: {
          phoneNumber: contactData.phoneNumber,
          name: null,
          email: null,
          profilePictureUrl: null,
          metadata: {},
          tenantId: contactData.tenantId,
          channel: 'WHATSAPP',
          externalId: contactData.phoneNumber,
        },
        include: {
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      });

      expect(result.name).toBeNull();
      expect(result.email).toBeNull();
    });
  });

  describe('updateContact', () => {
    it('deve atualizar contato com sucesso', async () => {
      // Arrange
      const existingContact = {
        id: 'contact-123',
        phoneNumber: '5511999999999',
        name: 'João Silva',
        tenantId: 'tenant-123',
      };

      const updateData = {
        name: 'João Pedro Silva',
        email: 'joao.pedro@email.com',
      };

      prismaMock.contact.findFirst.mockResolvedValue(existingContact as never);
      prismaMock.contact.update.mockResolvedValue({
        ...existingContact,
        ...updateData,
        updatedAt: new Date(),
        _count: { conversations: 0 },
      } as never);

      // Act
      const result = await contactService.updateContact('contact-123', 'tenant-123', updateData);

      // Assert
      expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'contact-123',
          tenantId: 'tenant-123',
        },
      });

      expect(prismaMock.contact.update).toHaveBeenCalledWith({
        where: { id: 'contact-123' },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
        include: {
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      });

      expect(result.name).toBe(updateData.name);
    });

    it('deve atualizar apenas campos fornecidos', async () => {
      // Arrange
      const existingContact = {
        id: 'contact-123',
        phoneNumber: '5511999999999',
        name: 'João Silva',
        email: 'joao@email.com',
        tenantId: 'tenant-123',
      };

      const updateData = {
        name: 'João Pedro',
      };

      prismaMock.contact.findFirst.mockResolvedValue(existingContact as any);
      prismaMock.contact.update.mockResolvedValue({
        ...existingContact,
        ...updateData,
      } as any);

      // Act
      await contactService.updateContact('contact-123', 'tenant-123', updateData);

      // Assert
      expect(prismaMock.contact.update).toHaveBeenCalledWith({
        where: { id: 'contact-123' },
        data: {
          name: 'João Pedro',
          updatedAt: expect.any(Date),
        },
        include: {
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      });
    });

    it('deve lançar NotFoundError quando contato não existe', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        contactService.updateContact('nonexistent-contact', 'tenant-123', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);

      await expect(
        contactService.updateContact('nonexistent-contact', 'tenant-123', { name: 'Test' })
      ).rejects.toThrow('Contato não encontrado');
    });

    it('deve respeitar isolamento de tenant na atualização', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        contactService.updateContact('contact-123', 'wrong-tenant', { name: 'Test' })
      ).rejects.toThrow(NotFoundError);

      expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'contact-123',
          tenantId: 'wrong-tenant',
        },
      });
    });

    it('deve atualizar metadata quando fornecido', async () => {
      // Arrange
      const existingContact = {
        id: 'contact-123',
        tenantId: 'tenant-123',
      };

      const updateData = {
        metadata: { source: 'whatsapp', lastInteraction: '2024-01-01' },
      };

      prismaMock.contact.findFirst.mockResolvedValue(existingContact as any);
      prismaMock.contact.update.mockResolvedValue({
        ...existingContact,
        ...updateData,
      } as any);

      // Act
      await contactService.updateContact('contact-123', 'tenant-123', updateData);

      // Assert
      expect(prismaMock.contact.update).toHaveBeenCalledWith({
        where: { id: 'contact-123' },
        data: {
          metadata: updateData.metadata,
          updatedAt: expect.any(Date),
        },
        include: {
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      });
    });
  });
});
