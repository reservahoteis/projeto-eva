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
  tenantId: string;
  name?: string;
  email?: string;
}

export interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
  tenantId?: string;
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

      // Buscar usuário no banco
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          email: true,
          tenantId: true,
        },
      });

      if (!user) {
        logger.warn({ userId: decoded.userId }, 'Socket connection with invalid user');
        return next(new Error('User not found'));
      }

      // Adicionar user ao socket
      socket.user = {
        userId: user.id,
        tenantId: user.tenantId,
        name: user.name || undefined,
        email: user.email,
      };
      socket.tenantId = user.tenantId;

      logger.info(
        {
          socketId: socket.id,
          userId: user.id,
          tenantId: user.tenantId,
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

    // Entrar na room do usuário (para notificações diretas)
    if (socket.user?.userId) {
      socket.join(`user:${socket.user.userId}`);
      logger.debug({ socketId: socket.id, userId: socket.user.userId }, 'Socket joined user room');
    }

    // Event: Entrar em uma conversa específica
    socket.on('conversation:join', (conversationId: string) => {
      if (!conversationId) {
        return socket.emit('error', { message: 'conversationId is required' });
      }

      socket.join(`conversation:${conversationId}`);
      logger.debug(
        {
          socketId: socket.id,
          conversationId,
          userId: socket.user?.userId,
        },
        'Socket joined conversation room'
      );

      socket.emit('conversation:joined', { conversationId });
    });

    // Event: Sair de uma conversa específica
    socket.on('conversation:leave', (conversationId: string) => {
      if (!conversationId) {
        return socket.emit('error', { message: 'conversationId is required' });
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
    socket.on('conversation:typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (!data.conversationId) {
        return socket.emit('error', { message: 'conversationId is required' });
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
    socket.on('messages:mark-read', async (data: { messageIds: string[] }) => {
      try {
        if (!data.messageIds || data.messageIds.length === 0) {
          return socket.emit('error', { message: 'messageIds is required' });
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
 */
export function emitNewMessage(tenantId: string, conversationId: string, message: any): void {
  if (!io) return;

  // Emitir para todos na conversa
  io.to(`conversation:${conversationId}`).emit('message:new', {
    conversationId,
    message,
  });

  // Emitir para todos do tenant (para atualizar lista de conversas)
  io.to(`tenant:${tenantId}`).emit('conversation:updated', {
    conversationId,
    lastMessage: message,
    lastMessageAt: message.timestamp,
  });

  logger.debug(
    {
      tenantId,
      conversationId,
      messageId: message.id,
    },
    'New message event emitted'
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
  if (!io) return;

  // Emitir para todos na conversa
  io.to(`conversation:${conversationId}`).emit('message:status-update', {
    conversationId,
    messageId,
    status,
  });

  logger.debug(
    {
      tenantId,
      conversationId,
      messageId,
      status,
    },
    'Message status update event emitted'
  );
}

/**
 * Emitir evento de nova conversa
 */
export function emitNewConversation(tenantId: string, conversation: any): void {
  if (!io) return;

  // Emitir para todos do tenant
  io.to(`tenant:${tenantId}`).emit('conversation:new', {
    conversation,
  });

  logger.debug(
    {
      tenantId,
      conversationId: conversation.id,
    },
    'New conversation event emitted'
  );
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
