/**
 * Testes para EscalationService
 *
 * TDD: RED → GREEN → REFACTOR
 *
 * Cobre todos os metodos criticos:
 * - createEscalation (criar escalacao + conversa + mensagens + events)
 * - listEscalations (paginacao, filtros, multi-tenant)
 * - getEscalationById (busca individual + includes)
 * - updateEscalationStatus (status transitions + timestamps)
 * - toggleIaLock (travar/destravar IA + socket events)
 * - isIaLockedByPhone (verificacao para N8N)
 * - getEscalationStats (estatisticas agrupadas)
 */

import { EscalationService } from '@/services/escalation.service';
import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import { Priority } from '@prisma/client';
import * as socketModule from '@/config/socket';

// Mock dependencies
jest.mock('@/config/database', () => ({
  prisma: {
    contact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      createMany: jest.fn(),
    },
    escalation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

jest.mock('@/config/socket', () => ({
  emitNewConversation: jest.fn(),
  emitConversationUpdate: jest.fn(),
  getSocketIO: jest.fn(() => ({
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  })),
}));

jest.mock('@/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Type helpers for mocked Prisma
const mockPrismaContact = prisma.contact as jest.Mocked<typeof prisma.contact>;
const mockPrismaConversation = prisma.conversation as jest.Mocked<typeof prisma.conversation>;
const mockPrismaMessage = prisma.message as jest.Mocked<typeof prisma.message>;
const mockPrismaEscalation = (prisma as any).escalation as jest.Mocked<any>;

describe('EscalationService', () => {
  let escalationService: EscalationService;
  const tenantId = 'tenant-1-uuid';
  const contactPhoneNumber = '+5511999998888';
  const userId = 'user-1-uuid';

  beforeEach(() => {
    escalationService = new EscalationService();
    jest.clearAllMocks();
  });

  describe('createEscalation', () => {
    const baseParams = {
      tenantId,
      contactPhoneNumber,
      reason: 'USER_REQUESTED' as const,
      reasonDetail: 'Cliente solicitou atendente humano',
      hotelUnit: 'unit-1',
      priority: 'HIGH' as Priority,
    };

    it('deve criar escalacao com novo contato quando contato nao existe', async () => {
      // Arrange
      const newContact = {
        id: 'contact-1',
        tenantId,
        phoneNumber: contactPhoneNumber,
        name: null,
        profilePictureUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newConversation = {
        id: 'conv-1',
        tenantId,
        contactId: 'contact-1',
        status: 'OPEN',
        priority: 'HIGH',
        source: 'n8n',
        hotelUnit: 'unit-1',
        iaLocked: true,
        iaLockedAt: expect.any(Date),
        iaLockedBy: 'system',
        lastMessageAt: expect.any(Date),
        contact: {
          id: 'contact-1',
          phoneNumber: contactPhoneNumber,
          name: null,
          profilePictureUrl: null,
        },
        assignedTo: null,
        tags: [],
      };

      const newEscalation = {
        id: 'escalation-1',
        tenantId,
        conversationId: 'conv-1',
        reason: 'USER_REQUESTED',
        reasonDetail: 'Cliente solicitou atendente humano',
        hotelUnit: 'unit-1',
        status: 'PENDING',
        createdAt: new Date(),
      };

      mockPrismaContact.findFirst.mockResolvedValue(null);
      mockPrismaContact.create.mockResolvedValue(newContact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(null);
      mockPrismaConversation.create.mockResolvedValue(newConversation as any);
      mockPrismaEscalation.create.mockResolvedValue(newEscalation);

      // Act
      const result = await escalationService.createEscalation(baseParams);

      // Assert - Verificar criacao do contato
      expect(mockPrismaContact.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId,
          phoneNumber: contactPhoneNumber,
        },
      });

      expect(mockPrismaContact.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          phoneNumber: contactPhoneNumber,
        },
      });

      // Assert - Verificar criacao da conversa com iaLocked=true
      expect(mockPrismaConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          contactId: 'contact-1',
          status: 'OPEN',
          priority: 'HIGH',
          source: 'n8n',
          hotelUnit: 'unit-1',
          iaLocked: true,
          iaLockedAt: expect.any(Date),
          iaLockedBy: 'system',
        }),
        include: expect.any(Object),
      });

      // Assert - Verificar criacao da escalacao
      expect(mockPrismaEscalation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          conversationId: 'conv-1',
          reason: 'USER_REQUESTED',
          reasonDetail: 'Cliente solicitou atendente humano',
          hotelUnit: 'unit-1',
          status: 'PENDING',
        }),
      });

      // Assert - Verificar retorno
      expect(result).toEqual({
        escalation: newEscalation,
        conversation: newConversation,
        contact: newContact,
      });
    });

    it('deve criar escalacao com contato e conversa existentes', async () => {
      // Arrange
      const existingContact = {
        id: 'contact-1',
        tenantId,
        phoneNumber: contactPhoneNumber,
        name: 'Joao Silva',
        profilePictureUrl: null,
      };

      const existingConversation = {
        id: 'conv-1',
        tenantId,
        contactId: 'contact-1',
        status: 'BOT_HANDLING',
        iaLocked: false,
        hotelUnit: 'unit-2',
      };

      const updatedConversation = {
        ...existingConversation,
        status: 'OPEN',
        iaLocked: true,
        iaLockedAt: expect.any(Date),
        iaLockedBy: 'system',
        priority: 'HIGH',
        hotelUnit: 'unit-1', // Atualizado
        contact: {
          id: 'contact-1',
          phoneNumber: contactPhoneNumber,
          name: 'Joao Silva',
          profilePictureUrl: null,
        },
        assignedTo: null,
        tags: [],
      };

      const newEscalation = {
        id: 'escalation-1',
        tenantId,
        conversationId: 'conv-1',
        reason: 'USER_REQUESTED',
        status: 'PENDING',
      };

      mockPrismaContact.findFirst.mockResolvedValue(existingContact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(existingConversation as any);
      mockPrismaConversation.update.mockResolvedValue(updatedConversation as any);
      mockPrismaEscalation.create.mockResolvedValue(newEscalation);

      // Act
      const result = await escalationService.createEscalation(baseParams);

      // Assert - NAO deve criar novo contato
      expect(mockPrismaContact.create).not.toHaveBeenCalled();

      // Assert - Deve atualizar conversa existente
      expect(mockPrismaConversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          status: 'OPEN',
          iaLocked: true,
          iaLockedAt: expect.any(Date),
          iaLockedBy: 'system',
          priority: 'HIGH',
          hotelUnit: 'unit-1',
        }),
        include: expect.any(Object),
      });

      // Assert - NAO deve criar nova conversa
      expect(mockPrismaConversation.create).not.toHaveBeenCalled();

      expect(result.conversation.id).toBe('conv-1');
    });

    it('deve criar nova conversa se nenhuma conversa ativa existir', async () => {
      // Arrange
      const existingContact = {
        id: 'contact-1',
        tenantId,
        phoneNumber: contactPhoneNumber,
      };

      const newConversation = {
        id: 'conv-new',
        tenantId,
        contactId: 'contact-1',
        status: 'OPEN',
        iaLocked: true,
        contact: {
          id: 'contact-1',
          phoneNumber: contactPhoneNumber,
          name: null,
          profilePictureUrl: null,
        },
        assignedTo: null,
        tags: [],
      };

      const newEscalation = {
        id: 'escalation-1',
        tenantId,
        conversationId: 'conv-new',
        status: 'PENDING',
      };

      mockPrismaContact.findFirst.mockResolvedValue(existingContact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(null); // Nenhuma conversa ativa
      mockPrismaConversation.create.mockResolvedValue(newConversation as any);
      mockPrismaEscalation.create.mockResolvedValue(newEscalation);

      // Act
      const result = await escalationService.createEscalation(baseParams);

      // Assert
      expect(mockPrismaConversation.create).toHaveBeenCalled();
      expect(mockPrismaConversation.update).not.toHaveBeenCalled();
      expect(result.conversation.id).toBe('conv-new');
    });

    it('deve importar historico de mensagens quando fornecido', async () => {
      // Arrange
      const existingContact = {
        id: 'contact-1',
        tenantId,
        phoneNumber: contactPhoneNumber,
      };

      const newConversation = {
        id: 'conv-1',
        tenantId,
        contactId: 'contact-1',
        status: 'OPEN',
        contact: { id: 'contact-1', phoneNumber: contactPhoneNumber, name: null, profilePictureUrl: null },
        assignedTo: null,
        tags: [],
      };

      const newEscalation = {
        id: 'escalation-1',
        tenantId,
        conversationId: 'conv-1',
      };

      const messageHistory = [
        { role: 'user' as const, content: 'Ola, gostaria de fazer uma reserva' },
        { role: 'assistant' as const, content: 'Ola! Claro, posso ajudar' },
        { role: 'user' as const, content: 'Preciso falar com uma pessoa' },
      ];

      mockPrismaContact.findFirst.mockResolvedValue(existingContact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(null);
      mockPrismaConversation.create.mockResolvedValue(newConversation as any);
      mockPrismaEscalation.create.mockResolvedValue(newEscalation);
      mockPrismaMessage.createMany.mockResolvedValue({ count: 3 } as any);

      // Act
      await escalationService.createEscalation({
        ...baseParams,
        messageHistory,
      });

      // Assert - Verificar que mensagens foram importadas
      expect(mockPrismaMessage.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            tenantId,
            conversationId: 'conv-1',
            direction: 'INBOUND',
            type: 'TEXT',
            content: 'Ola, gostaria de fazer uma reserva',
            status: 'DELIVERED',
            metadata: {
              importedFrom: 'n8n',
              originalRole: 'user',
            },
          }),
          expect.objectContaining({
            tenantId,
            conversationId: 'conv-1',
            direction: 'OUTBOUND',
            type: 'TEXT',
            content: 'Ola! Claro, posso ajudar',
            status: 'DELIVERED',
            metadata: {
              importedFrom: 'n8n',
              originalRole: 'assistant',
            },
          }),
        ]),
      });

      expect(mockPrismaMessage.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ timestamp: expect.any(Date) }),
        ]),
      });
    });

    it('deve emitir eventos Socket.io para notificar atendentes', async () => {
      // Arrange
      const contact = { id: 'contact-1', tenantId, phoneNumber: contactPhoneNumber };
      const conversation = {
        id: 'conv-1',
        tenantId,
        contactId: 'contact-1',
        status: 'OPEN',
        hotelUnit: 'unit-1',
        contact: { id: 'contact-1', phoneNumber: contactPhoneNumber, name: null, profilePictureUrl: null },
        assignedTo: null,
        tags: [],
      };
      const escalation = {
        id: 'escalation-1',
        tenantId,
        conversationId: 'conv-1',
        reason: 'USER_REQUESTED',
        reasonDetail: 'Cliente solicitou atendente',
        hotelUnit: 'unit-1',
        status: 'PENDING',
      };

      mockPrismaContact.findFirst.mockResolvedValue(contact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(null);
      mockPrismaConversation.create.mockResolvedValue(conversation as any);
      mockPrismaEscalation.create.mockResolvedValue(escalation);

      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      (socketModule.getSocketIO as jest.Mock).mockReturnValue(mockIo);

      // Act
      await escalationService.createEscalation(baseParams);

      // Assert - Verificar emitNewConversation
      expect(socketModule.emitNewConversation).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          id: 'conv-1',
          escalation: expect.objectContaining({
            id: 'escalation-1',
            reason: 'USER_REQUESTED',
            status: 'PENDING',
          }),
        })
      );

      // Assert - Verificar eventos Socket.io para admins e unidade
      expect(mockIo.to).toHaveBeenCalledWith(`tenant:${tenantId}:admins`);
      expect(mockIo.to).toHaveBeenCalledWith(`tenant:${tenantId}:unit:unit-1`);
      expect(mockIo.emit).toHaveBeenCalledWith('escalation:new', expect.any(Object));
    });

    it('deve incluir tenantId em todas as queries Prisma (multi-tenant security)', async () => {
      // Arrange
      const contact = { id: 'contact-1', tenantId, phoneNumber: contactPhoneNumber };
      const conversation = {
        id: 'conv-1',
        tenantId,
        contactId: 'contact-1',
        contact: { id: 'contact-1', phoneNumber: contactPhoneNumber, name: null, profilePictureUrl: null },
        assignedTo: null,
        tags: [],
      };
      const escalation = { id: 'escalation-1', tenantId, conversationId: 'conv-1' };

      mockPrismaContact.findFirst.mockResolvedValue(contact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(null);
      mockPrismaConversation.create.mockResolvedValue(conversation as any);
      mockPrismaEscalation.create.mockResolvedValue(escalation);

      // Act
      await escalationService.createEscalation(baseParams);

      // Assert - Contact query
      expect(mockPrismaContact.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId }),
      });

      // Assert - Conversation query
      expect(mockPrismaConversation.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId }),
      });

      // Assert - Conversation creation
      expect(mockPrismaConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId }),
        include: expect.any(Object),
      });

      // Assert - Escalation creation
      expect(mockPrismaEscalation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId }),
      });
    });
  });

  describe('listEscalations', () => {
    it('deve listar escalacoes com paginacao', async () => {
      // Arrange
      const escalations = [
        { id: 'esc-1', tenantId, status: 'PENDING', conversation: { contact: {} } },
        { id: 'esc-2', tenantId, status: 'PENDING', conversation: { contact: {} } },
      ];

      mockPrismaEscalation.findMany.mockResolvedValue(escalations);
      mockPrismaEscalation.count.mockResolvedValue(10);

      // Act
      const result = await escalationService.listEscalations({
        tenantId,
        page: 2,
        limit: 2,
      });

      // Assert - Verificar paginacao
      expect(mockPrismaEscalation.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        skip: 2, // (page 2 - 1) * limit 2
        take: 2,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });

      expect(result).toEqual({
        data: escalations,
        pagination: {
          page: 2,
          limit: 2,
          total: 10,
          pages: 5, // Math.ceil(10 / 2)
        },
      });
    });

    it('deve filtrar por status quando fornecido', async () => {
      // Arrange
      mockPrismaEscalation.findMany.mockResolvedValue([]);
      mockPrismaEscalation.count.mockResolvedValue(0);

      // Act
      await escalationService.listEscalations({
        tenantId,
        status: 'PENDING',
      });

      // Assert
      expect(mockPrismaEscalation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            status: 'PENDING',
          }),
        })
      );
    });

    it('deve filtrar por hotelUnit quando fornecido', async () => {
      // Arrange
      mockPrismaEscalation.findMany.mockResolvedValue([]);
      mockPrismaEscalation.count.mockResolvedValue(0);

      // Act
      await escalationService.listEscalations({
        tenantId,
        hotelUnit: 'unit-1',
      });

      // Assert
      expect(mockPrismaEscalation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            hotelUnit: 'unit-1',
          }),
        })
      );
    });

    it('deve incluir tenantId em todas as queries (multi-tenant security)', async () => {
      // Arrange
      mockPrismaEscalation.findMany.mockResolvedValue([]);
      mockPrismaEscalation.count.mockResolvedValue(0);

      // Act
      await escalationService.listEscalations({ tenantId });

      // Assert - findMany deve incluir tenantId
      expect(mockPrismaEscalation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId }),
        })
      );

      // Assert - count deve incluir tenantId
      expect(mockPrismaEscalation.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId }),
      });
    });

    it('deve limitar o numero maximo de resultados por pagina a 100', async () => {
      // Arrange
      mockPrismaEscalation.findMany.mockResolvedValue([]);
      mockPrismaEscalation.count.mockResolvedValue(0);

      // Act
      await escalationService.listEscalations({
        tenantId,
        limit: 500, // Tentar buscar 500
      });

      // Assert - Deve limitar a 100
      expect(mockPrismaEscalation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });

  describe('getEscalationById', () => {
    it('deve retornar escalacao com conversa e mensagens', async () => {
      // Arrange
      const escalation = {
        id: 'esc-1',
        tenantId,
        conversation: {
          id: 'conv-1',
          contact: { id: 'contact-1', phoneNumber: contactPhoneNumber },
          assignedTo: null,
          messages: [
            { id: 'msg-1', content: 'Hello', timestamp: new Date() },
          ],
        },
      };

      mockPrismaEscalation.findFirst.mockResolvedValue(escalation);

      // Act
      const result = await escalationService.getEscalationById('esc-1', tenantId);

      // Assert
      expect(mockPrismaEscalation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'esc-1',
          tenantId, // CRITICO: tenantId na query
        },
        include: expect.objectContaining({
          conversation: expect.any(Object),
        }),
      });

      expect(result).toEqual(escalation);
    });

    it('deve lancar NotFoundError quando escalacao nao existe', async () => {
      // Arrange
      mockPrismaEscalation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        escalationService.getEscalationById('esc-nonexistent', tenantId)
      ).rejects.toThrow(NotFoundError);
      await expect(
        escalationService.getEscalationById('esc-nonexistent', tenantId)
      ).rejects.toThrow('Escalacao nao encontrada');
    });

    it('deve incluir tenantId na query (multi-tenant security)', async () => {
      // Arrange
      mockPrismaEscalation.findFirst.mockResolvedValue(null);

      // Act & Assert
      try {
        await escalationService.getEscalationById('esc-1', tenantId);
      } catch (error) {
        // Esperado
      }

      expect(mockPrismaEscalation.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: 'esc-1',
          tenantId, // CRITICO: DEVE incluir tenantId
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('updateEscalationStatus', () => {
    const escalationId = 'esc-1';

    it('deve atualizar status para IN_PROGRESS com attendedById e attendedAt', async () => {
      // Arrange
      const existingEscalation = {
        id: escalationId,
        tenantId,
        status: 'PENDING',
      };

      const updatedEscalation = {
        id: escalationId,
        tenantId,
        status: 'IN_PROGRESS',
        attendedById: userId,
        attendedAt: expect.any(Date),
      };

      mockPrismaEscalation.findFirst.mockResolvedValue(existingEscalation);
      mockPrismaEscalation.update.mockResolvedValue(updatedEscalation);

      // Act
      const result = await escalationService.updateEscalationStatus(
        escalationId,
        tenantId,
        'IN_PROGRESS',
        userId
      );

      // Assert
      expect(mockPrismaEscalation.update).toHaveBeenCalledWith({
        where: { id: escalationId },
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
          attendedById: userId,
          attendedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.attendedById).toBe(userId);
    });

    it('deve atualizar status para RESOLVED com resolvedAt', async () => {
      // Arrange
      const existingEscalation = {
        id: escalationId,
        tenantId,
        status: 'IN_PROGRESS',
      };

      const updatedEscalation = {
        id: escalationId,
        tenantId,
        status: 'RESOLVED',
        resolvedAt: expect.any(Date),
      };

      mockPrismaEscalation.findFirst.mockResolvedValue(existingEscalation);
      mockPrismaEscalation.update.mockResolvedValue(updatedEscalation);

      // Act
      const result = await escalationService.updateEscalationStatus(
        escalationId,
        tenantId,
        'RESOLVED'
      );

      // Assert
      expect(mockPrismaEscalation.update).toHaveBeenCalledWith({
        where: { id: escalationId },
        data: expect.objectContaining({
          status: 'RESOLVED',
          resolvedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });

      expect(result.status).toBe('RESOLVED');
    });

    it('deve lancar NotFoundError quando escalacao nao existe', async () => {
      // Arrange
      mockPrismaEscalation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        escalationService.updateEscalationStatus('esc-nonexistent', tenantId, 'RESOLVED')
      ).rejects.toThrow(NotFoundError);
    });

    it('deve incluir tenantId na query de verificacao (multi-tenant security)', async () => {
      // Arrange
      mockPrismaEscalation.findFirst.mockResolvedValue(null);

      // Act & Assert
      try {
        await escalationService.updateEscalationStatus(escalationId, tenantId, 'RESOLVED');
      } catch (error) {
        // Esperado
      }

      expect(mockPrismaEscalation.findFirst).toHaveBeenCalledWith({
        where: {
          id: escalationId,
          tenantId, // CRITICO: tenantId na query
        },
      });
    });
  });

  describe('toggleIaLock', () => {
    const conversationId = 'conv-1';

    it('deve travar conversa (iaLocked=true) com userId e timestamp', async () => {
      // Arrange
      const conversation = {
        id: conversationId,
        tenantId,
        iaLocked: false,
      };

      const updatedConversation = {
        id: conversationId,
        tenantId,
        iaLocked: true,
        iaLockedAt: expect.any(Date),
        iaLockedBy: userId,
        contact: { id: 'contact-1', phoneNumber: contactPhoneNumber, name: null, profilePictureUrl: null },
        assignedTo: null,
      };

      mockPrismaConversation.findFirst.mockResolvedValue(conversation as any);
      mockPrismaConversation.update.mockResolvedValue(updatedConversation as any);

      // Act
      const result = await escalationService.toggleIaLock(
        conversationId,
        tenantId,
        true,
        userId
      );

      // Assert
      expect(mockPrismaConversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: expect.objectContaining({
          iaLocked: true,
          iaLockedAt: expect.any(Date),
          iaLockedBy: userId,
        }),
        include: expect.any(Object),
      });

      expect(result.iaLocked).toBe(true);
      expect(result.iaLockedBy).toBe(userId);
    });

    it('deve destravar conversa (iaLocked=false) e limpar campos', async () => {
      // Arrange
      const conversation = {
        id: conversationId,
        tenantId,
        iaLocked: true,
        iaLockedBy: userId,
      };

      const updatedConversation = {
        id: conversationId,
        tenantId,
        iaLocked: false,
        iaLockedAt: null,
        iaLockedBy: null,
        contact: { id: 'contact-1', phoneNumber: contactPhoneNumber, name: null, profilePictureUrl: null },
        assignedTo: null,
      };

      mockPrismaConversation.findFirst.mockResolvedValue(conversation as any);
      mockPrismaConversation.update.mockResolvedValue(updatedConversation as any);

      // Act
      const result = await escalationService.toggleIaLock(
        conversationId,
        tenantId,
        false,
        userId
      );

      // Assert
      expect(mockPrismaConversation.update).toHaveBeenCalledWith({
        where: { id: conversationId },
        data: expect.objectContaining({
          iaLocked: false,
          iaLockedAt: null,
          iaLockedBy: null,
        }),
        include: expect.any(Object),
      });

      expect(result.iaLocked).toBe(false);
      expect(result.iaLockedAt).toBeNull();
      expect(result.iaLockedBy).toBeNull();
    });

    it('deve emitir evento Socket.io ao alterar lock', async () => {
      // Arrange
      const conversation = {
        id: conversationId,
        tenantId,
        iaLocked: false,
      };

      const updatedConversation = {
        id: conversationId,
        tenantId,
        iaLocked: true,
        iaLockedAt: new Date(),
        iaLockedBy: userId,
        contact: { id: 'contact-1', phoneNumber: contactPhoneNumber, name: null, profilePictureUrl: null },
        assignedTo: null,
      };

      mockPrismaConversation.findFirst.mockResolvedValue(conversation as any);
      mockPrismaConversation.update.mockResolvedValue(updatedConversation as any);

      // Act
      await escalationService.toggleIaLock(conversationId, tenantId, true, userId);

      // Assert
      expect(socketModule.emitConversationUpdate).toHaveBeenCalledWith(
        tenantId,
        conversationId,
        expect.objectContaining({
          iaLocked: true,
          iaLockedAt: expect.any(Date),
          iaLockedBy: userId,
        })
      );
    });

    it('deve lancar NotFoundError quando conversa nao existe', async () => {
      // Arrange
      mockPrismaConversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        escalationService.toggleIaLock('conv-nonexistent', tenantId, true, userId)
      ).rejects.toThrow(NotFoundError);
      await expect(
        escalationService.toggleIaLock('conv-nonexistent', tenantId, true, userId)
      ).rejects.toThrow('Conversa nao encontrada');
    });

    it('deve incluir tenantId na query (multi-tenant security)', async () => {
      // Arrange
      mockPrismaConversation.findFirst.mockResolvedValue(null);

      // Act & Assert
      try {
        await escalationService.toggleIaLock(conversationId, tenantId, true, userId);
      } catch (error) {
        // Esperado
      }

      expect(mockPrismaConversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: conversationId,
          tenantId, // CRITICO: tenantId na query
        },
      });
    });
  });

  describe('isIaLockedByPhone', () => {
    it('deve retornar locked=true para conversa travada', async () => {
      // Arrange
      const contact = {
        id: 'contact-1',
        tenantId,
        phoneNumber: contactPhoneNumber,
      };

      const conversation = {
        id: 'conv-1',
        iaLocked: true,
      };

      mockPrismaContact.findFirst.mockResolvedValue(contact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(conversation as any);

      // Act
      const result = await escalationService.isIaLockedByPhone(tenantId, contactPhoneNumber);

      // Assert
      expect(result).toEqual({
        locked: true,
        conversationId: 'conv-1',
      });
    });

    it('deve retornar locked=false quando nao ha contato', async () => {
      // Arrange
      mockPrismaContact.findFirst.mockResolvedValue(null);

      // Act
      const result = await escalationService.isIaLockedByPhone(tenantId, contactPhoneNumber);

      // Assert
      expect(result).toEqual({ locked: false });
      expect(mockPrismaConversation.findFirst).not.toHaveBeenCalled();
    });

    it('deve retornar locked=false quando nao ha conversa ativa', async () => {
      // Arrange
      const contact = {
        id: 'contact-1',
        tenantId,
        phoneNumber: contactPhoneNumber,
      };

      mockPrismaContact.findFirst.mockResolvedValue(contact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(null);

      // Act
      const result = await escalationService.isIaLockedByPhone(tenantId, contactPhoneNumber);

      // Assert
      expect(result).toEqual({ locked: false });
    });

    it('deve incluir tenantId em todas as queries (multi-tenant security)', async () => {
      // Arrange
      const contact = {
        id: 'contact-1',
        tenantId,
        phoneNumber: contactPhoneNumber,
      };

      const conversation = {
        id: 'conv-1',
        iaLocked: false,
      };

      mockPrismaContact.findFirst.mockResolvedValue(contact as any);
      mockPrismaConversation.findFirst.mockResolvedValue(conversation as any);

      // Act
      await escalationService.isIaLockedByPhone(tenantId, contactPhoneNumber);

      // Assert - Contact query
      expect(mockPrismaContact.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId,
          phoneNumber: contactPhoneNumber,
        },
      });

      // Assert - Conversation query
      expect(mockPrismaConversation.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId,
          contactId: 'contact-1',
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('getEscalationStats', () => {
    it('deve retornar estatisticas agrupadas por status, reason e hotelUnit', async () => {
      // Arrange
      mockPrismaEscalation.count.mockResolvedValue(25);

      mockPrismaEscalation.groupBy
        .mockResolvedValueOnce([
          { status: 'PENDING', _count: { id: 10 } },
          { status: 'IN_PROGRESS', _count: { id: 8 } },
          { status: 'RESOLVED', _count: { id: 7 } },
        ])
        .mockResolvedValueOnce([
          { reason: 'USER_REQUESTED', _count: { id: 12 } },
          { reason: 'AI_UNABLE', _count: { id: 8 } },
          { reason: 'COMPLAINT', _count: { id: 5 } },
        ])
        .mockResolvedValueOnce([
          { hotelUnit: 'unit-1', _count: { id: 15 } },
          { hotelUnit: 'unit-2', _count: { id: 10 } },
        ]);

      // Act
      const result = await escalationService.getEscalationStats(tenantId);

      // Assert - Verificar totais
      expect(result.total).toBe(25);
      expect(result.pending).toBe(10);
      expect(result.inProgress).toBe(8);
      expect(result.resolved).toBe(7);
      expect(result.cancelled).toBe(0);

      // Assert - Verificar agrupamentos
      expect(result.byStatus).toEqual({
        PENDING: 10,
        IN_PROGRESS: 8,
        RESOLVED: 7,
        CANCELLED: 0,
      });

      expect(result.byReason).toEqual({
        USER_REQUESTED: 12,
        AI_UNABLE: 8,
        COMPLAINT: 5,
      });

      expect(result.byHotelUnit).toEqual({
        'unit-1': 15,
        'unit-2': 10,
      });
    });

    it('deve incluir tenantId em todas as queries de agrupamento (multi-tenant security)', async () => {
      // Arrange
      mockPrismaEscalation.count.mockResolvedValue(0);
      mockPrismaEscalation.groupBy.mockResolvedValue([]);

      // Act
      await escalationService.getEscalationStats(tenantId);

      // Assert - Count deve incluir tenantId
      expect(mockPrismaEscalation.count).toHaveBeenCalledWith({
        where: { tenantId },
      });

      // Assert - Todos os groupBy devem incluir tenantId
      expect(mockPrismaEscalation.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          by: ['status'],
        })
      );

      expect(mockPrismaEscalation.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          by: ['reason'],
        })
      );

      expect(mockPrismaEscalation.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, hotelUnit: { not: null } },
          by: ['hotelUnit'],
        })
      );
    });

    it('deve retornar zeros para categorias sem dados', async () => {
      // Arrange
      mockPrismaEscalation.count.mockResolvedValue(0);
      mockPrismaEscalation.groupBy.mockResolvedValue([]);

      // Act
      const result = await escalationService.getEscalationStats(tenantId);

      // Assert - Todos os status devem ter valor 0
      expect(result.byStatus).toEqual({
        PENDING: 0,
        IN_PROGRESS: 0,
        RESOLVED: 0,
        CANCELLED: 0,
      });

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.inProgress).toBe(0);
      expect(result.resolved).toBe(0);
      expect(result.cancelled).toBe(0);
    });
  });
});
