import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import jwt from 'jsonwebtoken';

// ============================================
// Types
// ============================================

export interface SocketUser {
  userId: string;
  tenantId: string | null; // Pode ser null para SUPER_ADMIN
  name?: string;
  email?: string;
  role?: string;
  hotelUnit?: string | null; // Unidade hoteleira do atendente
}

export interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
  tenantId?: string | null; // Pode ser null para SUPER_ADMIN
}

// ============================================
// Socket.io Server Instance
// ============================================

let io: SocketIOServer | null = null;

/**
 * Inicializar Socket.io server
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  logger.info('Socket.io server initialized');

  // Middleware de autenticação
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      // Obter token do handshake
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        logger.warn({ socketId: socket.id }, 'Socket connection without token');
        return next(new Error('Authentication token required'));
      }

      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
        tenantId: string;
      };

      // Buscar usuário no banco (incluindo hotelUnit para filtro por unidade)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          email: true,
          tenantId: true,
          role: true,
          hotelUnit: true,
        },
      });

      if (!user) {
        logger.warn({ userId: decoded.userId }, 'Socket connection with invalid user');
        return next(new Error('User not found'));
      }

      // Adicionar user ao socket (type-safe)
      socket.user = {
        userId: user.id,
        tenantId: user.tenantId, // Aceita null para SUPER_ADMIN
        name: user.name || undefined,
        email: user.email,
        role: user.role,
        hotelUnit: (user as any).hotelUnit || null, // Unidade do atendente
      };
      socket.tenantId = user.tenantId; // Aceita null para SUPER_ADMIN

      logger.info(
        {
          socketId: socket.id,
          userId: user.id,
          tenantId: user.tenantId,
          role: user.role,
          hotelUnit: (user as any).hotelUnit,
        },
        'Socket authenticated'
      );

      next();
    } catch (error) {
      logger.error({ error, socketId: socket.id }, 'Socket authentication error');
      next(new Error('Authentication failed'));
    }
  });

  // Event handlers
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(
      {
        socketId: socket.id,
        userId: socket.user?.userId,
        tenantId: socket.tenantId,
      },
      'Client connected'
    );

    // Entrar na room do tenant (para broadcast por tenant)
    if (socket.tenantId) {
      socket.join(`tenant:${socket.tenantId}`);
      logger.debug({ socketId: socket.id, tenantId: socket.tenantId }, 'Socket joined tenant room');
    }

    // Entrar na room da unidade hoteleira (para ATTENDANT filtrar por unidade)
    if (socket.tenantId && socket.user?.hotelUnit && socket.user?.role === 'ATTENDANT') {
      const unitRoom = `tenant:${socket.tenantId}:unit:${socket.user.hotelUnit}`;
      socket.join(unitRoom);
      logger.info({
        socketId: socket.id,
        tenantId: socket.tenantId,
        hotelUnit: socket.user.hotelUnit,
        unitRoom,
      }, 'Socket joined hotel unit room');
    }

    // Entrar na room do usuário (para notificações diretas)
    if (socket.user?.userId) {
      socket.join(`user:${socket.user.userId}`);
      logger.debug({ socketId: socket.id, userId: socket.user.userId }, 'Socket joined user room');
    }

    // Event: Entrar em uma conversa específica
    socket.on('conversation:join', (data: { conversationId: string } | string): void => {
      // CORREÇÃO: Aceitar tanto objeto quanto string para backward compatibility
      const conversationId = typeof data === 'string' ? data : data.conversationId;

      if (!conversationId) {
        socket.emit('error', { message: 'conversationId is required' });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      logger.info(
        {
          socketId: socket.id,
          conversationId,
          userId: socket.user?.userId,
        },
        '✅ Socket joined conversation room - FRONTEND IS NOW SUBSCRIBED'
      );

      socket.emit('conversation:joined', { conversationId });
    });

    // Event: Sair de uma conversa específica
    socket.on('conversation:leave', (data: { conversationId: string } | string): void => {
      // CORREÇÃO: Aceitar tanto objeto quanto string para backward compatibility
      const conversationId = typeof data === 'string' ? data : data.conversationId;

      if (!conversationId) {
        socket.emit('error', { message: 'conversationId is required' });
        return;
      }

      socket.leave(`conversation:${conversationId}`);
      logger.debug(
        {
          socketId: socket.id,
          conversationId,
          userId: socket.user?.userId,
        },
        'Socket left conversation room'
      );

      socket.emit('conversation:left', { conversationId });
    });

    // Event: Typing indicator (cliente está digitando)
    socket.on('conversation:typing', (data: { conversationId: string; isTyping: boolean }): void => {
      if (!data.conversationId) {
        socket.emit('error', { message: 'conversationId is required' });
        return;
      }

      // Broadcast para outros usuários na mesma conversa
      socket.to(`conversation:${data.conversationId}`).emit('conversation:typing', {
        conversationId: data.conversationId,
        userId: socket.user?.userId,
        userName: socket.user?.name,
        isTyping: data.isTyping,
      });

      logger.debug(
        {
          conversationId: data.conversationId,
          userId: socket.user?.userId,
          isTyping: data.isTyping,
        },
        'Typing indicator'
      );
    });

    // Event: Marcar mensagens como lidas
    socket.on('messages:mark-read', async (data: { messageIds: string[] }): Promise<void> => {
      try {
        if (!data.messageIds || data.messageIds.length === 0) {
          socket.emit('error', { message: 'messageIds is required' });
          return;
        }

        logger.debug(
          {
            userId: socket.user?.userId,
            messageIds: data.messageIds,
          },
          'Mark messages as read'
        );

        // Emitir confirmação
        socket.emit('messages:marked-read', { messageIds: data.messageIds });
      } catch (error) {
        logger.error({ error, userId: socket.user?.userId }, 'Error marking messages as read');
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Event: Ping/Pong para keep-alive
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Event: Disconnect
    socket.on('disconnect', (reason) => {
      logger.info(
        {
          socketId: socket.id,
          userId: socket.user?.userId,
          tenantId: socket.tenantId,
          reason,
        },
        'Client disconnected'
      );
    });

    // Event: Error
    socket.on('error', (error) => {
      logger.error(
        {
          socketId: socket.id,
          userId: socket.user?.userId,
          error,
        },
        'Socket error'
      );
    });
  });

  return io;
}

/**
 * Obter instância do Socket.io
 */
export function getSocketIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocketIO first.');
  }
  return io;
}

// ============================================
// Event Emitters (chamados pelos workers)
// ============================================

/**
 * Emitir evento de nova mensagem
 * CORREÇÃO: Adicionar conversation como parâmetro para payload completo
 * CORREÇÃO 2: Emitir para tenant room também (para Kanban e notificações globais)
 */
export function emitNewMessage(
  tenantId: string,
  conversationId: string,
  message: any,
  conversation?: any
): void {
  if (!io) return;

  const payload = {
    message,           // data.message
    conversation,      // data.conversation
    conversationId,    // data.conversationId (fallback)
  };

  // Emitir para a conversa específica (para quem está com o chat aberto)
  io.to(`conversation:${conversationId}`).emit('message:new', payload);

  // NOVO: Emitir para todos do tenant (para Kanban, lista de conversas, notificações)
  io.to(`tenant:${tenantId}`).emit('message:new', payload);

  // Emitir conversation:updated para atualizar lista de conversas
  io.to(`tenant:${tenantId}`).emit('conversation:updated', {
    conversationId,
    conversation,
    lastMessage: message,
    lastMessageAt: message.timestamp,
  });

  logger.info(
    {
      tenantId,
      conversationId,
      messageId: message.id,
      hasConversation: !!conversation,
      direction: message.direction,
    },
    '✅ Socket.io event [message:new] emitted to conversation AND tenant rooms'
  );
}

/**
 * Emitir evento de atualização de status de mensagem
 */
export function emitMessageStatusUpdate(
  tenantId: string,
  conversationId: string,
  messageId: string,
  status: string
): void {
  if (!io) {
    logger.warn({ tenantId, conversationId, messageId, status }, 'Socket.io not initialized, cannot emit status update');
    return;
  }

  // Emitir para todos na conversa
  io.to(`conversation:${conversationId}`).emit('message:status', {
    conversationId,
    messageId,
    status,
  });

  logger.info(
    {
      tenantId,
      conversationId,
      messageId,
      status,
    },
    '✅ Socket.io event [message:status] emitted to conversation room'
  );
}

/**
 * Emitir evento de nova conversa
 * Emite para:
 * - tenant room (TENANT_ADMIN vê todas)
 * - unit room (ATTENDANT vê apenas da sua unidade)
 */
export function emitNewConversation(tenantId: string, conversation: any): void {
  if (!io) return;

  // Emitir para todos do tenant (TENANT_ADMIN vê todas)
  io.to(`tenant:${tenantId}`).emit('conversation:new', {
    conversation,
  });

  // Se conversa tem unidade, emitir também para a sala da unidade
  // Isso permite que atendentes recebam apenas conversas da sua unidade
  if (conversation.hotelUnit) {
    const unitRoom = `tenant:${tenantId}:unit:${conversation.hotelUnit}`;
    io.to(unitRoom).emit('conversation:new', {
      conversation,
    });
    logger.info({
      tenantId,
      conversationId: conversation.id,
      hotelUnit: conversation.hotelUnit,
      unitRoom,
    }, 'New conversation event emitted to tenant AND unit rooms');
  } else {
    logger.debug({
      tenantId,
      conversationId: conversation.id,
    }, 'New conversation event emitted to tenant room only (no hotelUnit)');
  }
}

/**
 * Emitir evento de atualização de conversa
 */
export function emitConversationUpdate(tenantId: string, conversationId: string, updates: any): void {
  if (!io) return;

  // Emitir para todos do tenant
  io.to(`tenant:${tenantId}`).emit('conversation:updated', {
    conversationId,
    updates,
  });

  logger.debug(
    {
      tenantId,
      conversationId,
      updates,
    },
    'Conversation update event emitted'
  );
}

/**
 * Emitir notificação para usuário específico
 */
export function emitUserNotification(userId: string, notification: any): void {
  if (!io) return;

  // Emitir apenas para o usuário específico
  io.to(`user:${userId}`).emit('notification', notification);

  logger.debug(
    {
      userId,
      notification,
    },
    'User notification emitted'
  );
}

/**
 * Emitir evento de contato criado
 */
export function emitContactCreated(tenantId: string, contact: any): void {
  if (!io) return;

  // Emitir para todos do tenant
  io.to(`tenant:${tenantId}`).emit('contact:created', { contact });

  logger.debug(
    {
      tenantId,
      contactId: contact.id,
      phoneNumber: contact.phoneNumber,
    },
    'Contact created event emitted'
  );
}

/**
 * Emitir evento de contato atualizado
 */
export function emitContactUpdated(tenantId: string, contact: any): void {
  if (!io) return;

  // Emitir para todos do tenant
  io.to(`tenant:${tenantId}`).emit('contact:updated', { contact });

  logger.debug(
    {
      tenantId,
      contactId: contact.id,
    },
    'Contact updated event emitted'
  );
}

/**
 * Emitir evento de contato deletado
 */
export function emitContactDeleted(tenantId: string, contactId: string): void {
  if (!io) return;

  // Emitir para todos do tenant
  io.to(`tenant:${tenantId}`).emit('contact:deleted', { contactId });

  logger.debug(
    {
      tenantId,
      contactId,
    },
    'Contact deleted event emitted'
  );
}

/**
 * Obter estatísticas de conexões
 */
export async function getSocketStats(): Promise<{
  totalConnections: number;
  connectionsByTenant: Record<string, number>;
}> {
  if (!io) {
    return {
      totalConnections: 0,
      connectionsByTenant: {},
    };
  }

  const sockets = await io.fetchSockets();
  const totalConnections = sockets.length;

  // Contar por tenant
  const connectionsByTenant: Record<string, number> = {};
  for (const socket of sockets) {
    const authSocket = socket as any as AuthenticatedSocket;
    if (authSocket.tenantId) {
      connectionsByTenant[authSocket.tenantId] = (connectionsByTenant[authSocket.tenantId] || 0) + 1;
    }
  }

  return {
    totalConnections,
    connectionsByTenant,
  };
}
