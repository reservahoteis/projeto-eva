import { prisma } from '@/config/database';
import { NotFoundError, ForbiddenError } from '@/utils/errors';
import { ConversationStatus, Priority, Role } from '@prisma/client';
import logger from '@/config/logger';

interface ListConversationsParams {
  tenantId: string;
  userId?: string;
  userRole?: Role;
  status?: ConversationStatus;
  priority?: Priority;
  assignedToId?: string;
  search?: string;
  page?: number;
  limit?: number;
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

    // Filtrar por status
    if (params.status) {
      where.status = params.status;
    }

    // Filtrar por priority
    if (params.priority) {
      where.priority = params.priority;
    }

    // Filtrar por atendente atribuído
    if (params.assignedToId) {
      where.assignedToId = params.assignedToId;
    }

    // Se não é admin, mostrar apenas conversas do atendente
    if (params.userRole === 'ATTENDANT' && params.userId) {
      where.assignedToId = params.userId;
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

    // Contar mensagens não lidas por conversa
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            direction: 'INBOUND',
            status: { not: 'READ' },
          },
        });

        return {
          ...conv,
          lastMessage: conv.messages[0] || null,
          messages: undefined, // Remover array de messages
          unreadCount,
        };
      })
    );

    return {
      data: conversationsWithUnread,
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
    status: ConversationStatus,
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
        status,
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
}

export const conversationService = new ConversationService();
