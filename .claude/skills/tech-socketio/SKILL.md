---
name: tech-socketio
description: Melhores praticas Socket.io - Real-time, Rooms, Namespaces, Autenticacao
version: 1.0.0
---

# Socket.io - Melhores Praticas

## Setup Servidor

```typescript
import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

httpServer.listen(3001, () => {
  console.log('Socket.io server running on port 3001');
});
```

---

## Autenticacao

```typescript
import jwt from 'jsonwebtoken';

// Middleware de autenticacao
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      tenantId: string;
    };

    socket.data.userId = decoded.userId;
    socket.data.tenantId = decoded.tenantId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Apos autenticacao
io.on('connection', (socket) => {
  const { userId, tenantId } = socket.data;
  console.log(`User ${userId} connected`);

  // Entrar em rooms do tenant e usuario
  socket.join(`tenant:${tenantId}`);
  socket.join(`user:${userId}`);
});
```

---

## Eventos Basicos

```typescript
io.on('connection', (socket) => {
  // Receber evento do cliente
  socket.on('message:send', async (data, callback) => {
    try {
      const message = await saveMessage(data);

      // Emitir para todos na conversa
      io.to(`conversation:${data.conversationId}`).emit('message:new', message);

      // Callback de sucesso
      callback({ success: true, message });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Evento com acknowledgment
  socket.on('typing:start', (data) => {
    socket.to(`conversation:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId: socket.data.userId,
      isTyping: true,
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.data.userId} disconnected`);
  });
});
```

---

## Rooms

```typescript
io.on('connection', (socket) => {
  // Entrar em room de conversa
  socket.on('conversation:join', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
    socket.to(`conversation:${conversationId}`).emit('user:joined', {
      userId: socket.data.userId,
    });
  });

  // Sair de room
  socket.on('conversation:leave', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    socket.to(`conversation:${conversationId}`).emit('user:left', {
      userId: socket.data.userId,
    });
  });
});

// Emitir para room especifica (de qualquer lugar)
function notifyConversation(conversationId: string, event: string, data: any) {
  io.to(`conversation:${conversationId}`).emit(event, data);
}

// Emitir para tenant
function notifyTenant(tenantId: string, event: string, data: any) {
  io.to(`tenant:${tenantId}`).emit(event, data);
}

// Emitir para usuario especifico
function notifyUser(userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}
```

---

## Namespaces

```typescript
// Namespace para chat
const chatNamespace = io.of('/chat');

chatNamespace.use(authMiddleware);

chatNamespace.on('connection', (socket) => {
  socket.on('message', (data) => {
    chatNamespace.to(`conversation:${data.conversationId}`).emit('message', data);
  });
});

// Namespace para notificacoes
const notificationsNamespace = io.of('/notifications');

notificationsNamespace.use(authMiddleware);

notificationsNamespace.on('connection', (socket) => {
  socket.join(`user:${socket.data.userId}`);
});

// Emitir notificacao
function sendNotification(userId: string, notification: object) {
  notificationsNamespace.to(`user:${userId}`).emit('notification', notification);
}
```

---

## Tipagem com TypeScript

```typescript
// Tipos de eventos
interface ServerToClientEvents {
  'message:new': (message: Message) => void;
  'typing:update': (data: { conversationId: string; userId: string; isTyping: boolean }) => void;
  'user:joined': (data: { userId: string }) => void;
  'notification': (notification: Notification) => void;
}

interface ClientToServerEvents {
  'message:send': (data: SendMessageInput, callback: (response: ApiResponse<Message>) => void) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'conversation:join': (conversationId: string) => void;
  'conversation:leave': (conversationId: string) => void;
}

interface SocketData {
  userId: string;
  tenantId: string;
}

// Servidor tipado
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer);

// Socket tipado
io.on('connection', (socket) => {
  socket.data.userId; // string
  socket.emit('message:new', message); // Tipagem correta
});
```

---

## Cliente (React/Next.js)

```typescript
// hooks/useSocket.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL!;

export function useSocket(token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const emit = useCallback((event: string, data?: any) => {
    socket?.emit(event, data);
  }, [socket]);

  return { socket, isConnected, emit };
}
```

### Hook para Conversa
```typescript
// hooks/useConversationSocket.ts
export function useConversationSocket(conversationId: string | null) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('conversation:join', conversationId);

    socket.on('message:new', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('typing:update', ({ userId, isTyping }) => {
      setTypingUsers((prev) =>
        isTyping ? [...prev, userId] : prev.filter((id) => id !== userId)
      );
    });

    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.off('message:new');
      socket.off('typing:update');
    };
  }, [socket, conversationId]);

  const sendMessage = useCallback((content: string) => {
    socket?.emit('message:send', { conversationId, content }, (response) => {
      if (!response.success) {
        console.error('Failed to send message:', response.error);
      }
    });
  }, [socket, conversationId]);

  const startTyping = useCallback(() => {
    socket?.emit('typing:start', { conversationId });
  }, [socket, conversationId]);

  return { messages, typingUsers, sendMessage, startTyping, isConnected };
}
```

---

## Scaling com Redis Adapter

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));

// Agora eventos sao propagados entre multiplas instancias
```

---

## Broadcast de Servico Externo

```typescript
// Emitir de um servico/worker sem conexao direta
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

// Formato: socket.io-adapter#{namespace}#room#event
async function broadcastToRoom(room: string, event: string, data: any) {
  const channel = `socket.io#/#${room}#`;
  await redis.publish(channel, JSON.stringify([event, data]));
}

// Uso em webhook handler
app.post('/webhook/whatsapp', async (req, res) => {
  const message = await processWebhook(req.body);
  await broadcastToRoom(`conversation:${message.conversationId}`, 'message:new', message);
  res.sendStatus(200);
});
```

---

## Middleware de Logging

```typescript
io.use((socket, next) => {
  const originalEmit = socket.emit;
  socket.emit = function (...args) {
    console.log(`[EMIT] ${socket.data.userId} -> ${args[0]}`);
    return originalEmit.apply(this, args);
  };
  next();
});

io.on('connection', (socket) => {
  socket.onAny((event, ...args) => {
    console.log(`[RECV] ${socket.data.userId} <- ${event}`);
  });
});
```

---

## Tratamento de Erros

```typescript
io.on('connection', (socket) => {
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.data.userId}:`, error);
  });

  // Wrapper para handlers
  const safeHandler = (handler: Function) => async (...args: any[]) => {
    try {
      await handler(...args);
    } catch (error) {
      console.error('Socket handler error:', error);
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Internal error' });
      }
    }
  };

  socket.on('message:send', safeHandler(async (data, callback) => {
    const message = await sendMessage(data);
    callback({ success: true, data: message });
  }));
});
```

---

## Checklist

- [ ] Implementar autenticacao via middleware
- [ ] Usar rooms para segmentar comunicacao
- [ ] Tipar eventos com TypeScript
- [ ] Usar Redis adapter para scaling horizontal
- [ ] Implementar reconnection no cliente
- [ ] Usar acknowledgments para operacoes criticas
- [ ] Adicionar logging de eventos
- [ ] Tratar erros em todos handlers
