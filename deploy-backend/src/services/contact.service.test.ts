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
        createdAt: new Date('2024-01-01'),
        _count: { conversations: 5 },
      },
      {
        id: 'contact-2',
        phoneNumber: '5511888888888',
        name: 'Maria Santos',
        email: 'maria@email.com',
        profilePictureUrl: null,
        createdAt: new Date('2024-01-02'),
        _count: { conversations: 3 },
      },
    ];

    it('deve listar contatos com paginação padrão', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue(mockContacts as any);
      prismaMock.contact.count.mockResolvedValue(2);
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        status: 'OPEN',
        lastMessageAt: new Date(),
      } as any);

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
        pages: 1,
      });
    });

    it('deve listar contatos com paginação customizada', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue([mockContacts[0]] as any);
      prismaMock.contact.count.mockResolvedValue(10);
      prismaMock.conversation.findFirst.mockResolvedValue(null);

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
        pages: 2,
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
      prismaMock.contact.findMany.mockResolvedValue([mockContacts[0]] as any);
      prismaMock.contact.count.mockResolvedValue(1);
      prismaMock.conversation.findFirst.mockResolvedValue(null);

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
      prismaMock.contact.findMany.mockResolvedValue([mockContacts[0]] as any);
      prismaMock.contact.count.mockResolvedValue(1);
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        status: 'OPEN',
        lastMessageAt: new Date('2024-01-15'),
      } as any);

      // Act
      const result = await contactService.listContacts('tenant-123');

      // Assert
      expect(result.data[0]).toHaveProperty('conversationsCount', 5);
      expect(result.data[0]).toHaveProperty('lastConversationAt');
      expect(result.data[0]?._count).toBeUndefined();
    });

    it('deve retornar lastConversationAt null quando não há conversas', async () => {
      // Arrange
      prismaMock.contact.findMany.mockResolvedValue([mockContacts[0]] as any);
      prismaMock.contact.count.mockResolvedValue(1);
      prismaMock.conversation.findFirst.mockResolvedValue(null);

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
      conversations: [
        {
          id: 'conv-1',
          status: 'OPEN',
          priority: 'MEDIUM',
          createdAt: new Date(),
          closedAt: null,
        },
      ],
    };

    it('deve buscar contato por ID com sucesso', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(mockContact as any);

      // Act
      const result = await contactService.getContactById('contact-123', 'tenant-123');

      // Assert
      expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'contact-123',
          tenantId: 'tenant-123',
        },
        include: {
          conversations: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              status: true,
              priority: true,
              createdAt: true,
              closedAt: true,
            },
          },
        },
      });

      expect(result.id).toBe('contact-123');
      expect(result.conversations).toHaveLength(1);
    });

    it('deve lançar NotFoundError quando contato não existe', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        contactService.getContactById('nonexistent-contact', 'tenant-123')
      ).rejects.toThrow(NotFoundError);

      await expect(
        contactService.getContactById('nonexistent-contact', 'tenant-123')
      ).rejects.toThrow('Contato não encontrado');
    });

    it('deve respeitar isolamento de tenant', async () => {
      // Arrange
      prismaMock.contact.findFirst.mockResolvedValue(null);

      // Act
      await expect(
        contactService.getContactById('contact-123', 'wrong-tenant')
      ).rejects.toThrow(NotFoundError);

      // Assert
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
        metadata: null,
      };

      prismaMock.contact.create.mockResolvedValue(mockCreatedContact as any);

      // Act
      const result = await contactService.createContact(contactData);

      // Assert
      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: {
          phoneNumber: contactData.phoneNumber,
          name: contactData.name,
          email: contactData.email,
          tenantId: contactData.tenantId,
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
        metadata: null,
      };

      prismaMock.contact.create.mockResolvedValue(mockCreatedContact as any);

      // Act
      const result = await contactService.createContact(contactData);

      // Assert
      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: {
          phoneNumber: contactData.phoneNumber,
          name: null,
          email: null,
          tenantId: contactData.tenantId,
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

      prismaMock.contact.findFirst.mockResolvedValue(existingContact as any);
      prismaMock.contact.update.mockResolvedValue({
        ...existingContact,
        ...updateData,
        updatedAt: new Date(),
      } as any);

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
      });
    });
  });
});
