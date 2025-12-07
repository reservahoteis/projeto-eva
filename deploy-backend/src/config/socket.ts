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
  // SECURITY FIX [SEC-002]: Validar FRONTEND_URL obrigatoriamente - nunca usar wildcard
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error(
      'SECURITY ERROR: FRONTEND_URL environment variable is required. ' +
      'CORS wildcard (*) is not allowed for Socket.io connections with credentials.'
    );
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendUrl, // SECURITY: Origem explicita, sem fallback wildcard
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

    // Entrar na room de admins (TENANT_ADMIN vê todas as conversas)
    if (socket.tenantId && socket.user?.role === 'TENANT_ADMIN') {
      const adminsRoom = `tenant:${socket.tenantId}:admins`;
      socket.join(adminsRoom);
      logger.info({
        socketId: socket.id,
        tenantId: socket.tenantId,
        role: socket.user.role,
        adminsRoom,
      }, 'Socket joined admins room (TENANT_ADMIN)');
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
 * CORREÇÃO 3: Filtrar por unidade hoteleira - atendentes só veem conversas da sua unidade
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

  // Obter hotelUnit da conversa
  const hotelUnit = conversation?.hotelUnit;

  // Emitir para ADMINS do tenant (tenant room geral - eles sempre veem tudo)
  // Os clientes que são ATTENDANT vão filtrar no frontend pelo hotelUnit
  // Mas para otimizar, vamos emitir para rooms específicas:

  // 1. Emitir para room de admins do tenant (TENANT_ADMIN vê todas as conversas)
  io.to(`tenant:${tenantId}:admins`).emit('message:new', payload);

  // 2. Se conversa tem hotelUnit, emitir para room da unidade específica
  // Atendentes só veem conversas que já têm unidade definida
  if (hotelUnit) {
    io.to(`tenant:${tenantId}:unit:${hotelUnit}`).emit('message:new', payload);
    logger.debug({ tenantId, hotelUnit, conversationId }, 'Emitted to unit room');
  }

  // Emitir conversation:updated para atualizar lista de conversas
  // Mesma lógica: admins veem todas, atendentes só da sua unidade
  io.to(`tenant:${tenantId}:admins`).emit('conversation:updated', {
    conversationId,
    conversation,
    lastMessage: message,
    lastMessageAt: message.timestamp,
  });

  if (hotelUnit) {
    io.to(`tenant:${tenantId}:unit:${hotelUnit}`).emit('conversation:updated', {
      conversationId,
      conversation,
      lastMessage: message,
      lastMessageAt: message.timestamp,
    });
  }

  logger.info(
    {
      tenantId,
      conversationId,
      messageId: message.id,
      hasConversation: !!conversation,
      direction: message.direction,
      hotelUnit: hotelUnit || 'none',
    },
    '✅ Socket.io event [message:new] emitted to conversation, admins, and unit rooms'
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
 * - admins room (TENANT_ADMIN vê todas as conversas)
 * - unit room (ATTENDANT vê apenas conversas da sua unidade - só se hotelUnit definido)
 */
export function emitNewConversation(tenantId: string, conversation: any): void {
  if (!io) return;

  const payload = { conversation };

  // 1. Emitir para room de admins (TENANT_ADMIN vê todas)
  io.to(`tenant:${tenantId}:admins`).emit('conversation:new', payload);

  // 2. Se conversa tem unidade, emitir para a sala da unidade
  // Atendentes SÓ recebem conversas que já têm hotelUnit definido
  if (conversation.hotelUnit) {
    const unitRoom = `tenant:${tenantId}:unit:${conversation.hotelUnit}`;
    io.to(unitRoom).emit('conversation:new', payload);
    logger.info({
      tenantId,
      conversationId: conversation.id,
      hotelUnit: conversation.hotelUnit,
      unitRoom,
    }, 'New conversation emitted to admins AND unit rooms');
  } else {
    logger.info({
      tenantId,
      conversationId: conversation.id,
    }, 'New conversation emitted to admins room only (no hotelUnit - attendants will NOT see this)');
  }
}

/**
 * Emitir evento de atualização de conversa
 * @param hotelUnit - Opcional: se fornecido, emite também para a room da unidade
 */
export function emitConversationUpdate(tenantId: string, conversationId: string, updates: any, hotelUnit?: string): void {
  if (!io) return;

  const payload = {
    conversationId,
    updates,
  };

  // 1. Emitir para room de admins (sempre)
  io.to(`tenant:${tenantId}:admins`).emit('conversation:updated', payload);

  // 2. Se hotelUnit fornecido, emitir para room da unidade
  if (hotelUnit) {
    io.to(`tenant:${tenantId}:unit:${hotelUnit}`).emit('conversation:updated', payload);
  }

  // 3. Emitir para a conversa específica também (para quem está com o chat aberto)
  io.to(`conversation:${conversationId}`).emit('conversation:updated', payload);

  logger.debug(
    {
      tenantId,
      conversationId,
      updates,
      hotelUnit: hotelUnit || 'none',
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
