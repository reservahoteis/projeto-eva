import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import { Priority, Role } from '@prisma/client';
import { emitNewConversation, emitConversationUpdate } from '@/config/socket';
import logger from '@/config/logger';

// Tipos para escalacao (até regenerar Prisma Client)
type EscalationReason =
  | 'USER_REQUESTED'
  | 'AI_UNABLE'
  | 'COMPLEX_QUERY'
  | 'COMPLAINT'
  | 'SALES_OPPORTUNITY'
  | 'URGENCY'
  | 'OTHER';

type EscalationStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';

interface CreateEscalationParams {
  tenantId: string;
  contactPhoneNumber: string;
  reason: EscalationReason;
  reasonDetail?: string;
  hotelUnit?: string;
  messageHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
  }>;
  aiContext?: Record<string, any>;
  priority?: Priority;
}

interface ListEscalationsParams {
  tenantId: string;
  userId?: string;
  userRole?: Role;
  status?: EscalationStatus;
  hotelUnit?: string;
  page?: number;
  limit?: number;
}

export class EscalationService {
  /**
   * Criar escalacao e conversa associada
   * Chamado pelo N8N quando a IA precisa transferir para humano
   */
  async createEscalation(params: CreateEscalationParams) {
    const {
      tenantId,
      contactPhoneNumber,
      reason,
      reasonDetail,
      hotelUnit,
      messageHistory,
      aiContext,
      priority = 'HIGH',
    } = params;

    // 1. Buscar ou criar Contact
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        phoneNumber: contactPhoneNumber,
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          channel: 'WHATSAPP',
          externalId: contactPhoneNumber,
          phoneNumber: contactPhoneNumber,
        },
      });

      logger.info({
        contactId: contact.id,
        phoneNumber: contactPhoneNumber,
        tenantId,
      }, 'Contact created during escalation');
    }

    // 2. Buscar conversa existente ou criar nova
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: contact.id,
        status: {
          in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'] as any,
        },
      },
    });

    const now = new Date();
    let conversation: any;

    if (existingConversation) {
      // Atualizar conversa existente para status OPEN e travar IA
      conversation = await prisma.conversation.update({
        where: { id: existingConversation.id },
        data: {
          status: 'OPEN',
          iaLocked: true,
          iaLockedAt: now,
          iaLockedBy: 'system',
          priority,
          source: 'n8n',
          hotelUnit: hotelUnit || existingConversation.hotelUnit, // Atualizar unidade se fornecida
          lastMessageAt: now,
        } as any,
        include: {
          contact: {
            select: {
              id: true,
              phoneNumber: true,
              name: true,
              profilePictureUrl: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tags: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });
    } else {
      // Criar nova conversa com IA travada
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          status: 'OPEN',
          priority,
          source: 'n8n',
          hotelUnit, // Salvar unidade hoteleira
          iaLocked: true,
          iaLockedAt: now,
          iaLockedBy: 'system',
          lastMessageAt: now,
        } as any,
        include: {
          contact: {
            select: {
              id: true,
              phoneNumber: true,
              name: true,
              profilePictureUrl: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tags: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });
    }

    // 3. Criar registro de Escalation
    const escalation = await (prisma as any).escalation.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        reason,
        reasonDetail,
        hotelUnit,
        aiContext: {
          messageHistory,
          ...aiContext,
        },
        status: 'PENDING',
      },
    });

    // 4. Importar historico de mensagens como mensagens na conversa
    if (messageHistory && messageHistory.length > 0) {
      const messagesToCreate = messageHistory.map((msg, index) => ({
        tenantId,
        conversationId: conversation.id,
        direction: msg.role === 'user' ? 'INBOUND' as const : 'OUTBOUND' as const,
        type: 'TEXT' as const,
        content: msg.content,
        status: 'DELIVERED' as const,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(now.getTime() - (messageHistory.length - index) * 1000),
        metadata: {
          importedFrom: 'n8n',
          originalRole: msg.role,
        },
      }));

      await prisma.message.createMany({
        data: messagesToCreate,
      });

      logger.info({
        conversationId: conversation.id,
        messagesImported: messagesToCreate.length,
      }, 'Message history imported from N8N');
    }

    // 5. Emitir eventos Socket.io para notificar atendentes
    try {
      // Emitir nova conversa (aparece no Kanban)
      emitNewConversation(tenantId, {
        ...conversation,
        escalation: {
          id: escalation.id,
          reason,
          reasonDetail,
          hotelUnit,
          status: 'PENDING',
        },
      });

      // Emitir evento especifico de escalacao para notificacao sonora
      // Emitir para rooms corretas: admins (sempre) e unidade (se definida)
      const { getSocketIO } = await import('@/config/socket');
      const io = getSocketIO();

      const escalationPayload = {
        escalation: {
          id: escalation.id,
          reason,
          reasonDetail,
          hotelUnit,
          status: 'PENDING',
          conversationId: conversation.id,
          contact: conversation.contact,
        },
        conversation,
      };

      // 1. Emitir para room de admins (TENANT_ADMIN vê todas)
      io.to(`tenant:${tenantId}:admins`).emit('escalation:new', escalationPayload);

      // 2. Se tem hotelUnit, emitir para room da unidade (ATTENDANT da unidade)
      if (hotelUnit) {
        io.to(`tenant:${tenantId}:unit:${hotelUnit}`).emit('escalation:new', escalationPayload);
        logger.info({
          tenantId,
          hotelUnit,
          unitRoom: `tenant:${tenantId}:unit:${hotelUnit}`,
        }, 'Escalation emitted to unit room');
      }

      logger.info({
        escalationId: escalation.id,
        conversationId: conversation.id,
        tenantId,
        reason,
        hotelUnit,
      }, 'Escalation notification sent via Socket.io');
    } catch (error) {
      logger.warn({ error }, 'Failed to emit escalation Socket.io event');
    }

    logger.info({
      escalationId: escalation.id,
      conversationId: conversation.id,
      contactPhoneNumber,
      reason,
      hotelUnit,
      tenantId,
    }, 'Escalation created successfully');

    return {
      escalation,
      conversation,
      contact,
    };
  }

  /**
   * Listar escalacoes
   */
  async listEscalations(params: ListEscalationsParams) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId: params.tenantId,
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.hotelUnit) {
      where.hotelUnit = params.hotelUnit;
    }

    const [escalations, total] = await Promise.all([
      (prisma as any).escalation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            include: {
              contact: {
                select: {
                  id: true,
                  phoneNumber: true,
                  name: true,
                  profilePictureUrl: true,
                },
              },
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      (prisma as any).escalation.count({ where }),
    ]);

    return {
      data: escalations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar escalacao por ID
   */
  async getEscalationById(escalationId: string, tenantId: string) {
    const escalation = await (prisma as any).escalation.findFirst({
      where: {
        id: escalationId,
        tenantId,
      },
      include: {
        conversation: {
          include: {
            contact: true,
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            messages: {
              take: 100,
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
    });

    if (!escalation) {
      throw new NotFoundError('Escalacao nao encontrada');
    }

    return escalation;
  }

  /**
   * Atualizar status da escalacao
   */
  async updateEscalationStatus(
    escalationId: string,
    tenantId: string,
    status: EscalationStatus,
    userId?: string
  ) {
    const escalation = await (prisma as any).escalation.findFirst({
      where: {
        id: escalationId,
        tenantId,
      },
    });

    if (!escalation) {
      throw new NotFoundError('Escalacao nao encontrada');
    }

    const now = new Date();
    const updateData: any = {
      status,
    };

    if (status === 'IN_PROGRESS' && userId) {
      updateData.attendedById = userId;
      updateData.attendedAt = now;
    }

    if (status === 'RESOLVED' || status === 'CANCELLED') {
      updateData.resolvedAt = now;
    }

    const updated = await (prisma as any).escalation.update({
      where: { id: escalationId },
      data: updateData,
      include: {
        conversation: {
          include: {
            contact: true,
          },
        },
      },
    });

    logger.info({
      escalationId,
      status,
      userId,
    }, 'Escalation status updated');

    return updated;
  }

  /**
   * Toggle IA lock na conversa
   */
  async toggleIaLock(
    conversationId: string,
    tenantId: string,
    locked: boolean,
    userId: string
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa nao encontrada');
    }

    const now = new Date();
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        iaLocked: locked,
        iaLockedAt: locked ? now : null,
        iaLockedBy: locked ? userId : null,
      } as any,
      include: {
        contact: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
            profilePictureUrl: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Emitir atualizacao via Socket.io
    try {
      emitConversationUpdate(tenantId, conversationId, {
        iaLocked: locked,
        iaLockedAt: locked ? now : null,
        iaLockedBy: locked ? userId : null,
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to emit iaLock update via Socket.io');
    }

    logger.info({
      conversationId,
      iaLocked: locked,
      userId,
    }, 'Conversation IA lock toggled');

    return updated;
  }

  /**
   * Verificar se conversa esta com IA travada
   * (Chamado pelo webhook para decidir se processa ou ignora)
   */
  async isIaLocked(conversationId: string): Promise<boolean> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { iaLocked: true } as any,
    });

    return (conversation as any)?.iaLocked ?? false;
  }

  /**
   * Verificar se conversa por telefone esta com IA travada
   * (Chamado pelo N8N via API para decidir se responde)
   */
  async isIaLockedByPhone(tenantId: string, phoneNumber: string, channel?: string): Promise<{
    locked: boolean;
    conversationId?: string;
  }> {
    // Buscar contato: por phoneNumber (WhatsApp) OU externalId (Messenger/Instagram)
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        phoneNumber,
      },
    });

    // Se nao encontrou por phoneNumber, tentar por externalId (Messenger/Instagram PSID)
    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          externalId: phoneNumber,
          channel: channel ? { equals: channel as any } : { in: ['MESSENGER', 'INSTAGRAM'] },
        },
      });
    }

    if (!contact) {
      return { locked: false };
    }

    // Incluir BOT_HANDLING no filtro (conversas Messenger/IG comecam nesse status)
    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: contact.id,
        status: {
          in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'],
        },
      },
      select: {
        id: true,
        iaLocked: true,
      } as any,
    });

    if (!conversation) {
      return { locked: false };
    }

    return {
      locked: (conversation as any).iaLocked,
      conversationId: (conversation as any).id,
    };
  }

  /**
   * Obter estatisticas de escalacoes
   */
  async getEscalationStats(tenantId: string) {
    const [total, byStatus, byReason, byHotelUnit] = await Promise.all([
      (prisma as any).escalation.count({ where: { tenantId } }),

      (prisma as any).escalation.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),

      (prisma as any).escalation.groupBy({
        by: ['reason'],
        where: { tenantId },
        _count: { id: true },
      }),

      (prisma as any).escalation.groupBy({
        by: ['hotelUnit'],
        where: { tenantId, hotelUnit: { not: null } },
        _count: { id: true },
      }),
    ]);

    const statusStats: Record<string, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CANCELLED: 0,
    };
    byStatus.forEach((item: any) => {
      statusStats[item.status] = item._count.id;
    });

    const reasonStats: Record<string, number> = {};
    byReason.forEach((item: any) => {
      reasonStats[item.reason] = item._count.id;
    });

    const hotelUnitStats: Record<string, number> = {};
    byHotelUnit.forEach((item: any) => {
      if (item.hotelUnit) {
        hotelUnitStats[item.hotelUnit] = item._count.id;
      }
    });

    return {
      total,
      pending: statusStats.PENDING,
      inProgress: statusStats.IN_PROGRESS,
      resolved: statusStats.RESOLVED,
      cancelled: statusStats.CANCELLED,
      byStatus: statusStats,
      byReason: reasonStats,
      byHotelUnit: hotelUnitStats,
    };
  }
}

export const escalationService = new EscalationService();
