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
  isOpportunity?: boolean;
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

    // Se é ATTENDANT, filtrar por:
    // 1. Conversas atribuídas diretamente a ele (qualquer unidade)
    // 2. OU conversas que têm a mesma unidade hoteleira (hotelUnit deve estar definido!)
    // IMPORTANTE: Conversas sem hotelUnit definido NÃO aparecem para atendentes
    // (exceto se estiver atribuída diretamente a ele)
    if (params.userRole === 'ATTENDANT' && params.userId) {
      // Buscar a unidade do atendente
      const user = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { hotelUnit: true },
      });

      // Construir filtro OR: atribuídas a mim OU da minha unidade
      const orConditions: any[] = [
        { assignedToId: params.userId }, // Sempre vê conversas atribuídas a ele
      ];

      // Se atendente tem unidade definida, também vê conversas dessa unidade
      // MAS apenas se a conversa também tem hotelUnit definido (não null)
      if (user?.hotelUnit) {
        orConditions.push({
          hotelUnit: user.hotelUnit,  // Só conversas com exatamente esta unidade
        });
        logger.debug({ userId: params.userId, hotelUnit: user.hotelUnit }, 'Filtering conversations by attendant hotel unit');
      }

      where.OR = orConditions;
    }

    // Se é HEAD, filtrar por unidade hoteleira (similar ao ATTENDANT)
    // HEAD só vê conversas da unidade dele
    if (params.userRole === 'HEAD' && params.userId) {
      const headUser = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { hotelUnit: true },
      });

      if (headUser?.hotelUnit) {
        where.hotelUnit = headUser.hotelUnit;
        logger.debug({ userId: params.userId, hotelUnit: headUser.hotelUnit }, 'Filtering conversations for HEAD role by hotel unit');
      }
    }

    // Se é SALES, filtrar APENAS por conversas marcadas como oportunidade
    // SALES só vê conversas onde isOpportunity = true (clientes que não converteram no follow-up)
    if (params.userRole === 'SALES') {
      where.isOpportunity = true;
      logger.debug({ userId: params.userId }, 'Filtering conversations for SALES role - only opportunities');
    }

    // Filtrar explicitamente por isOpportunity (para admins na pagina de oportunidades)
    if (params.isOpportunity !== undefined && params.userRole !== 'SALES') {
      where.isOpportunity = params.isOpportunity;
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

    // Buscar timestamp da última mensagem INBOUND (do cliente) por conversa
    // Usado para calcular janela de 24h do Meta (Customer Service Window)
    const lastInboundTimestamps = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        direction: 'INBOUND',
      },
      _max: {
        timestamp: true,
      },
    });

    const lastInboundMap = new Map(
      lastInboundTimestamps.map((li) => [li.conversationId, li._max?.timestamp ?? null])
    );

    // Formatar resposta (sem N+1 - usamos batch queries)
    const conversationsFormatted = conversations.map((conv) => ({
      ...conv,
      lastMessage: conv.messages[0] || null,
      messages: undefined, // Remover array de messages
      unreadCount: unreadMap.get(conv.id) || 0,
      lastInboundAt: lastInboundMap.get(conv.id) || null,
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

    // Se é ATTENDANT, verificar acesso:
    // - Conversa atribuída a ele OU
    // - Conversa da mesma unidade hoteleira
    if (userRole === 'ATTENDANT' && userId) {
      const isAssignedToMe = conversation.assignedToId === userId;

      if (!isAssignedToMe) {
        // Buscar unidade do atendente para verificar se pode acessar
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { hotelUnit: true },
        });

        const conversationUnit = conversation.hotelUnit;
        const userUnit = user?.hotelUnit;

        // Se conversa não está atribuída a mim E não é da minha unidade
        const isSameUnit = userUnit && conversationUnit && userUnit === conversationUnit;

        if (!isSameUnit) {
          throw new ForbiddenError('Você não tem acesso a esta conversa');
        }
      }
    }

    return conversation;
  }

  /**
   * Criar ou buscar conversa existente para um contato
   * @returns { conversation, isNew } - conversation e flag indicando se foi criada agora
   */
  async getOrCreateConversation(tenantId: string, contactId: string): Promise<{
    conversation: Awaited<ReturnType<typeof prisma.conversation.findFirst>> & { contact: any; assignedTo: any };
    isNew: boolean;
  }> {
    // 1. Buscar conversa ativa (inclui BOT_HANDLING)
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId,
        status: {
          in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'],
        },
      },
      include: {
        contact: true,
        assignedTo: true,
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    if (conversation) {
      return { conversation: conversation as any, isNew: false };
    }

    // 2. Fallback: buscar conversa CLOSED recente (ultimos 30 min)
    // Isso previne criacao de conversa duplicada quando N8N responde apos fechamento
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentClosed = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId,
        status: 'CLOSED',
        lastMessageAt: { gte: thirtyMinAgo },
      },
      include: {
        contact: true,
        assignedTo: true,
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    if (recentClosed) {
      // Reabrir conversa fechada recentemente
      conversation = await prisma.conversation.update({
        where: { id: recentClosed.id },
        data: { status: 'OPEN', lastMessageAt: new Date() },
        include: {
          contact: true,
          assignedTo: true,
        },
      });

      logger.info({
        conversationId: conversation.id,
        contactId,
        previousStatus: 'CLOSED',
        closedAt: recentClosed.lastMessageAt,
      }, 'Reopened recently closed conversation for outbound message');

      return { conversation: conversation as any, isNew: false };
    }

    // 3. Criar nova conversa
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

    return { conversation: conversation as any, isNew: true };
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
   * Remover atribuição de conversa (desatribuir)
   */
  async unassignConversation(conversationId: string, tenantId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId: null,
        status: 'OPEN',
      },
      include: {
        contact: true,
        assignedTo: true,
      },
    });

    logger.info({ conversationId, tenantId }, 'Conversation unassigned');

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
      const statusStats: Record<string, number> = {
        BOT_HANDLING: 0,
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
      const active = (statusStats.OPEN ?? 0) + (statusStats.IN_PROGRESS ?? 0) + (statusStats.WAITING ?? 0);

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
    hotelUnit?: string; // Unidade hoteleira (Ilhabela, Campos do Jordão, etc)
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
        source: data.source,
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

  /**
   * Arquivar conversa
   */
  async archiveConversation(conversationId: string, tenantId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'ARCHIVED' as ConversationStatus,
        closedAt: new Date(),
      },
    });

    logger.info({ conversationId }, 'Conversation archived');

    return updated;
  }

  /**
   * Excluir conversa permanentemente
   */
  async deleteConversation(conversationId: string, tenantId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Deletar em cascata: messages, escalations, tags relation
    await prisma.$transaction([
      // Deletar escalations associados
      prisma.escalation.deleteMany({
        where: { conversationId },
      }),
      // Deletar mensagens
      prisma.message.deleteMany({
        where: { conversationId },
      }),
      // Deletar a conversa (tags são desconectadas automaticamente por ser M:N)
      prisma.conversation.delete({
        where: { id: conversationId },
      }),
    ]);

    logger.info({ conversationId, tenantId }, 'Conversation deleted permanently');

    return { success: true, id: conversationId };
  }
}

export const conversationService = new ConversationService();
