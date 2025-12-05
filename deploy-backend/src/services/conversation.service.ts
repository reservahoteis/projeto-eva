import { prisma } from '@/config/database';
import { NotFoundError, ForbiddenError } from '@/utils/errors';
import { ConversationStatus, Priority, Role } from '@prisma/client';
import logger from '@/config/logger';

// TEMPORARY: Extend ConversationStatus until Prisma migration is applied
type ExtendedConversationStatus = ConversationStatus | 'BOT_HANDLING';

interface ListConversationsParams {
  tenantId: string;
  userId?: string;
  userRole?: Role;
  status?: ExtendedConversationStatus;
  priority?: Priority;
  assignedToId?: string;
  search?: string;
  page?: number;
  limit?: number;
  hotelUnit?: string; // Filtro opcional por unidade
}

export class ConversationService {
  /**
   * Listar conversas (com filtros e paginação)
   */
  async listConversations(params: ListConversationsParams) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId: params.tenantId,
    };

    // Filtrar por status - suportar múltiplos valores com CSV
    if (params.status) {
      // Suportar CSV: "OPEN,IN_PROGRESS,WAITING"
      if (typeof params.status === 'string' && params.status.includes(',')) {
        where.status = {
          in: params.status.split(',') as ExtendedConversationStatus[],
        };
      } else {
        where.status = params.status;
      }
    }

    // Filtrar por priority
    if (params.priority) {
      where.priority = params.priority;
    }

    // Filtrar por atendente atribuído
    if (params.assignedToId) {
      where.assignedToId = params.assignedToId;
    }

    // Filtrar por unidade hoteleira (se fornecido)
    if (params.hotelUnit) {
      where.hotelUnit = params.hotelUnit;
    }

    // Se é ATTENDANT, filtrar automaticamente pela unidade do usuário
    if (params.userRole === 'ATTENDANT' && params.userId) {
      // Buscar a unidade do atendente
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { hotelUnit: true },
      });

      // Se atendente tem unidade definida, filtrar por ela
      if (user?.hotelUnit) {
        where.hotelUnit = user.hotelUnit;
        logger.debug({ userId: params.userId, hotelUnit: user.hotelUnit }, 'Filtering conversations by attendant hotel unit');
      }

      // Atendente vê apenas conversas atribuídas a ele OU da sua unidade sem atribuição
      // Removido: where.assignedToId = params.userId;
      // Agora: atendente vê todas as conversas da sua unidade
    }

    // Busca por nome/telefone do contato
    if (params.search) {
      where.contact = {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { phoneNumber: { contains: params.search } },
        ],
      };
    }

    // Buscar conversas
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
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
          messages: {
            take: 1,
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              content: true,
              direction: true,
              type: true,
              timestamp: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Buscar contagem de mensagens não lidas em batch (evita N+1)
    const conversationIds = conversations.map((c) => c.id);
    const unreadCounts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        direction: 'INBOUND',
        status: { not: 'READ' },
      },
      _count: {
        id: true,
      },
    });

    // Criar mapa para lookup rápido
    const unreadMap = new Map(
      unreadCounts.map((uc) => [uc.conversationId, uc._count.id])
    );

    // Formatar resposta (sem N+1 - usamos batch query)
    const conversationsFormatted = conversations.map((conv) => ({
      ...conv,
      lastMessage: conv.messages[0] || null,
      messages: undefined, // Remover array de messages
      unreadCount: unreadMap.get(conv.id) || 0,
    }));

    return {
      data: conversationsFormatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar conversa por ID
   */
  async getConversationById(conversationId: string, tenantId: string, userId?: string, userRole?: Role) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
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

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Se não é admin, verificar se conversa pertence ao atendente
    if (userRole === 'ATTENDANT' && conversation.assignedToId !== userId) {
      throw new ForbiddenError('Você não tem acesso a esta conversa');
    }

    return conversation;
  }

  /**
   * Criar ou buscar conversa existente para um contato
   */
  async getOrCreateConversation(tenantId: string, contactId: string) {
    // Buscar conversa aberta existente
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId,
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'WAITING'],
        },
      },
      include: {
        contact: true,
        assignedTo: true,
      },
    });

    // Se não existir, criar nova
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId,
          status: 'OPEN',
          priority: 'MEDIUM',
          lastMessageAt: new Date(),
        },
        include: {
          contact: true,
          assignedTo: true,
        },
      });

      logger.info({ conversationId: conversation.id, contactId }, 'New conversation created');
    }

    return conversation;
  }

  /**
   * Atribuir conversa a um atendente
   */
  async assignConversation(conversationId: string, tenantId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Verificar se user pertence ao tenant
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        status: 'ACTIVE',
      },
    });

    if (!user) {
      throw new NotFoundError('Atendente não encontrado');
    }

    // Atribuir
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId: userId,
        status: conversation.status === 'OPEN' ? 'IN_PROGRESS' : conversation.status,
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

    logger.info({ conversationId, userId }, 'Conversation assigned');

    return updated;
  }

  /**
   * Atualizar status da conversa
   */
  async updateConversationStatus(
    conversationId: string,
    tenantId: string,
    status: ExtendedConversationStatus,
    userId?: string,
    userRole?: Role
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Se não é admin, verificar permissão
    if (userRole === 'ATTENDANT' && conversation.assignedToId !== userId) {
      throw new ForbiddenError('Você não tem permissão para atualizar esta conversa');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: status as ConversationStatus, // Cast until migration
        closedAt: status === 'CLOSED' ? new Date() : null,
      },
    });

    logger.info({ conversationId, status }, 'Conversation status updated');

    return updated;
  }

  /**
   * Atualizar prioridade
   */
  async updatePriority(conversationId: string, tenantId: string, priority: Priority) {
    const updated = await prisma.conversation.update({
      where: {
        id: conversationId,
        tenantId,
      },
      data: { priority },
    });

    logger.info({ conversationId, priority }, 'Conversation priority updated');

    return updated;
  }

  /**
   * Adicionar/remover tags
   */
  async updateTags(conversationId: string, tenantId: string, tagIds: string[]) {
    // Verificar se todas as tags pertencem ao tenant
    const tags = await prisma.tag.findMany({
      where: {
        id: { in: tagIds },
        tenantId,
      },
    });

    if (tags.length !== tagIds.length) {
      throw new NotFoundError('Uma ou mais tags não encontradas');
    }

    const updated = await prisma.conversation.update({
      where: {
        id: conversationId,
        tenantId,
      },
      data: {
        tags: {
          set: tagIds.map((id) => ({ id })),
        },
      },
      include: {
        tags: true,
      },
    });

    return updated;
  }

  /**
   * Fechar conversa
   */
  async closeConversation(conversationId: string, tenantId: string) {
    return this.updateConversationStatus(conversationId, tenantId, 'CLOSED');
  }

  /**
   * Obter estatísticas das conversas
   */
  async getConversationStats(tenantId: string, userId?: string, userRole?: Role) {
    try {
      // Base query
      const baseWhere: any = {
        tenantId,
      };

      // Se não é admin, filtrar apenas conversas do atendente
      if (userRole === 'ATTENDANT' && userId) {
        baseWhere.assignedToId = userId;
      }

      // Buscar estatísticas agregadas
      const [
        total,
        byStatus,
        byPriority,
        unassigned,
        avgResponseTime
      ] = await Promise.all([
        // Total de conversas
        prisma.conversation.count({
          where: baseWhere,
        }),

        // Conversas por status
        prisma.conversation.groupBy({
          by: ['status'],
          where: baseWhere,
          _count: {
            id: true,
          },
        }),

        // Conversas por prioridade
        prisma.conversation.groupBy({
          by: ['priority'],
          where: baseWhere,
          _count: {
            id: true,
          },
        }),

        // Conversas não atribuídas
        prisma.conversation.count({
          where: {
            ...baseWhere,
            assignedToId: null,
            status: {
              in: ['OPEN', 'IN_PROGRESS', 'WAITING'],
            },
          },
        }),

        // Tempo médio de resposta (últimas 24h)
        this.calculateAvgResponseTime(tenantId, userId, userRole),
      ]);

      // Formatar estatísticas por status
      const statusStats = {
        OPEN: 0,
        IN_PROGRESS: 0,
        WAITING: 0,
        CLOSED: 0,
      };

      byStatus.forEach((item) => {
        statusStats[item.status] = item._count.id;
      });

      // Formatar estatísticas por prioridade
      const priorityStats = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0,
      };

      byPriority.forEach((item) => {
        priorityStats[item.priority] = item._count.id;
      });

      // Calcular conversas ativas
      const active = statusStats.OPEN + statusStats.IN_PROGRESS + statusStats.WAITING;

      // Mensagens não lidas
      const unreadMessages = await prisma.message.count({
        where: {
          conversation: baseWhere,
          direction: 'INBOUND',
          status: { not: 'READ' },
        },
      });

      return {
        total,
        active,
        unassigned,
        unreadMessages,
        avgResponseTime: avgResponseTime || 0,
        byStatus: statusStats,
        byPriority: priorityStats,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Erro ao calcular estatísticas');
      throw error;
    }
  }

  /**
   * Calcular tempo médio de resposta
   */
  private async calculateAvgResponseTime(tenantId: string, userId?: string, userRole?: Role): Promise<number> {
    try {
      // Buscar conversas das últimas 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const where: any = {
        tenantId,
        createdAt: { gte: since },
        status: { not: 'OPEN' }, // Apenas conversas que tiveram interação
      };

      if (userRole === 'ATTENDANT' && userId) {
        where.assignedToId = userId;
      }

      const conversations = await prisma.conversation.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          messages: {
            where: {
              direction: 'OUTBOUND',
            },
            orderBy: {
              timestamp: 'asc',
            },
            take: 1,
            select: {
              timestamp: true,
            },
          },
        },
      });

      if (conversations.length === 0) return 0;

      // Calcular tempo de resposta para cada conversa
      const responseTimes = conversations
        .filter((conv) => conv.messages.length > 0)
        .map((conv) => {
          const firstResponse = conv.messages[0];
          if (!firstResponse) return 0; // Type guard
          const responseTime = firstResponse.timestamp.getTime() - conv.createdAt.getTime();
          return responseTime;
        })
        .filter((time) => time > 0); // Remover zeros

      if (responseTimes.length === 0) return 0;

      // Calcular média em segundos
      const avgMs = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      return Math.round(avgMs / 1000); // Retornar em segundos
    } catch (error) {
      logger.error({ error }, 'Erro ao calcular tempo médio de resposta');
      return 0;
    }
  }

  /**
   * Criar conversa a partir de phoneNumber (para N8N)
   * Busca ou cria Contact automaticamente
   */
  async createFromPhone(data: {
    tenantId: string;
    contactPhoneNumber: string;
    status?: ExtendedConversationStatus;
    source?: string;
    priority?: Priority;
    metadata?: any;
    assignedToId?: string;
    hotelUnit?: string; // Unidade hoteleira (Ilha Bela, Campos do Jordão, etc)
  }) {
    // 1. Buscar Contact por phoneNumber + tenantId
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: data.tenantId,
        phoneNumber: data.contactPhoneNumber,
      },
    });

    // 2. Se não existir, criar Contact
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: data.tenantId,
          phoneNumber: data.contactPhoneNumber,
        },
      });

      logger.info({
        contactId: contact.id,
        phoneNumber: data.contactPhoneNumber,
        tenantId: data.tenantId,
      }, 'Contact created automatically from phone number');
    }

    // 3. Validar assignedToId se fornecido
    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: {
          id: data.assignedToId,
          tenantId: data.tenantId,
          status: 'ACTIVE',
        },
      });

      if (!user) {
        throw new NotFoundError('Atendente não encontrado ou não pertence ao tenant');
      }
    }

    // 4. Criar Conversation
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: data.tenantId,
        contactId: contact.id,
        status: (data.status || 'OPEN') as ConversationStatus,
        priority: data.priority || 'MEDIUM',
        // @ts-ignore - Campo source pode não existir ainda no Prisma schema
        source: data.source,
        // @ts-ignore - Campo hotelUnit será adicionado após migration
        hotelUnit: data.hotelUnit,
        metadata: data.metadata,
        assignedToId: data.assignedToId,
        lastMessageAt: new Date(),
      },
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

    logger.info({
      conversationId: conversation.id,
      contactId: contact.id,
      contactPhoneNumber: data.contactPhoneNumber,
      status: conversation.status,
      source: data.source,
      tenantId: data.tenantId,
    }, 'Conversation created from phone number');

    // 5. Emitir evento Socket.io (apenas se status != BOT_HANDLING)
    // Conversas BOT_HANDLING não devem notificar atendentes
    // @ts-ignore - BOT_HANDLING será adicionado após migration
    if (conversation.status !== 'BOT_HANDLING') {
      try {
        const { emitNewConversation } = await import('@/config/socket');
        emitNewConversation(data.tenantId, conversation);
        logger.debug({ conversationId: conversation.id }, 'Socket.io event emitted for new conversation');
      } catch (error) {
        // Não falhar se Socket.io não estiver disponível
        logger.warn({ error, conversationId: conversation.id }, 'Failed to emit Socket.io event');
      }
    }

    return conversation;
  }
}

export const conversationService = new ConversationService();
