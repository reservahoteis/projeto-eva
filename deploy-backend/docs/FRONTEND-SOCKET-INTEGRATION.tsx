/**
 * EXEMPLO DE INTEGRAÇÃO SOCKET.IO NO FRONTEND (REACT/NEXT.JS)
 *
 * Este arquivo demonstra como integrar Socket.io no frontend
 * para receber atualizações em tempo real do Kanban
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify'; // ou seu sistema de notificação

// ====================================================
// HOOK CUSTOMIZADO PARA SOCKET.IO
// ====================================================

interface UseSocketOptions {
  onNewMessage?: (data: any) => void;
  onConversationUpdate?: (data: any) => void;
  onStatusUpdate?: (data: any) => void;
  onTyping?: (data: any) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    // Obter token do localStorage ou context
    const token = localStorage.getItem('token');

    if (!token) {
      setConnectionError('Token não encontrado');
      return;
    }

    // Conectar ao Socket.io
    const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3333', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ====================================================
    // EVENT LISTENERS
    // ====================================================

    // Conexão estabelecida
    socket.on('connect', () => {
      console.log('✅ Socket.io conectado:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
      toast.success('Conexão em tempo real estabelecida');
    });

    // Conexão perdida
    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.io desconectado:', reason);
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        // Servidor forçou desconexão, tentar reconectar
        socket.connect();
      }
    });

    // Erro de conexão
    socket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão Socket.io:', error.message);
      setConnectionError(error.message);

      if (error.message.includes('Authentication')) {
        toast.error('Erro de autenticação. Faça login novamente.');
        // Redirecionar para login se necessário
      }
    });

    // ====================================================
    // EVENTOS DE MENSAGEM
    // ====================================================

    // Nova mensagem
    socket.on('message:new', (data) => {
      console.log('📨 Nova mensagem:', data);

      // Tocar som de notificação
      playNotificationSound();

      // Mostrar notificação
      showNotification({
        title: 'Nova mensagem',
        body: `${data.message.contact.name || data.message.contact.phoneNumber}: ${data.message.content}`,
      });

      // Callback customizado
      options.onNewMessage?.(data);
    });

    // Status de mensagem atualizado
    socket.on('message:status-update', (data) => {
      console.log('📊 Status atualizado:', data);
      options.onStatusUpdate?.(data);
    });

    // ====================================================
    // EVENTOS DE CONVERSA
    // ====================================================

    // Conversa atualizada
    socket.on('conversation:updated', (data) => {
      console.log('🔄 Conversa atualizada:', data);
      options.onConversationUpdate?.(data);
    });

    // Nova conversa
    socket.on('conversation:new', (data) => {
      console.log('💬 Nova conversa:', data);

      // Mostrar notificação
      toast.info('Nova conversa iniciada');

      // Atualizar lista de conversas
      options.onConversationUpdate?.(data);
    });

    // ====================================================
    // EVENTOS DE TYPING
    // ====================================================

    // Alguém está digitando
    socket.on('conversation:typing', (data) => {
      console.log('⌨️ Digitando:', data);
      options.onTyping?.(data);
    });

    // ====================================================
    // KEEP ALIVE
    // ====================================================

    // Ping/Pong para manter conexão ativa
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);

    socket.on('pong', () => {
      console.log('⏱️ Pong - Conexão ativa');
    });

    // ====================================================
    // CLEANUP
    // ====================================================

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ====================================================
  // MÉTODOS PÚBLICOS
  // ====================================================

  // Entrar em uma conversa
  const joinConversation = useCallback((conversationId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('conversation:join', conversationId);
      console.log('📌 Entrando na conversa:', conversationId);
    }
  }, []);

  // Sair de uma conversa
  const leaveConversation = useCallback((conversationId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('conversation:leave', conversationId);
      console.log('📤 Saindo da conversa:', conversationId);
    }
  }, []);

  // Enviar indicador de digitação
  const sendTypingIndicator = useCallback((conversationId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('conversation:typing', { conversationId, isTyping });
    }
  }, []);

  // Marcar mensagens como lidas
  const markMessagesAsRead = useCallback((messageIds: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('messages:mark-read', { messageIds });
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    joinConversation,
    leaveConversation,
    sendTypingIndicator,
    markMessagesAsRead,
  };
}

// ====================================================
// COMPONENTE EXEMPLO - KANBAN COM SOCKET.IO
// ====================================================

export function KanbanWithSocket() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});

  const {
    isConnected,
    connectionError,
    joinConversation,
    leaveConversation,
    sendTypingIndicator,
  } = useSocket({
    // Nova mensagem recebida
    onNewMessage: (data) => {
      // Atualizar conversa específica
      setConversations(prev =>
        prev.map(conv =>
          conv.id === data.conversationId
            ? { ...conv, lastMessage: data.message, unreadCount: conv.unreadCount + 1 }
            : conv
        )
      );
    },

    // Conversa atualizada
    onConversationUpdate: (data) => {
      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.id === data.conversationId);

        if (existingIndex >= 0) {
          // Atualizar conversa existente
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...data.updates,
            lastMessageAt: data.lastMessageAt,
          };
          return updated;
        } else {
          // Adicionar nova conversa
          return [...prev, data.conversation];
        }
      });
    },

    // Indicador de digitação
    onTyping: (data) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.conversationId]: data.isTyping
          ? [...(prev[data.conversationId] || []), data.userName]
          : (prev[data.conversationId] || []).filter(u => u !== data.userName)
      }));
    },
  });

  // Exemplo de input com debounce para typing indicator
  const handleInputChange = useCallback(
    debounce((conversationId: string, value: string) => {
      sendTypingIndicator(conversationId, value.length > 0);
    }, 500),
    [sendTypingIndicator]
  );

  return (
    <div className="kanban-container">
      {/* Indicador de conexão */}
      <div className="connection-status">
        {isConnected ? (
          <span className="connected">🟢 Conectado</span>
        ) : (
          <span className="disconnected">🔴 Desconectado</span>
        )}
        {connectionError && (
          <span className="error">{connectionError}</span>
        )}
      </div>

      {/* Colunas do Kanban */}
      <div className="kanban-columns">
        {['OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED'].map(status => (
          <div key={status} className="kanban-column">
            <h3>{status}</h3>

            {conversations
              .filter(c => c.status === status)
              .map(conversation => (
                <div
                  key={conversation.id}
                  className="conversation-card"
                  onClick={() => joinConversation(conversation.id)}
                >
                  {/* Avatar e nome */}
                  <div className="contact-info">
                    <img src={conversation.contact.avatar} />
                    <span>{conversation.contact.name}</span>
                  </div>

                  {/* Última mensagem */}
                  <div className="last-message">
                    {conversation.lastMessage?.content}
                  </div>

                  {/* Indicador de digitação */}
                  {typingUsers[conversation.id]?.length > 0 && (
                    <div className="typing-indicator">
                      {typingUsers[conversation.id].join(', ')} está digitando...
                    </div>
                  )}

                  {/* Contador de não lidas */}
                  {conversation.unreadCount > 0 && (
                    <div className="unread-badge">
                      {conversation.unreadCount}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="timestamp">
                    {formatTimestamp(conversation.lastMessageAt)}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ====================================================
// FUNÇÕES AUXILIARES
// ====================================================

// Tocar som de notificação
function playNotificationSound() {
  const audio = new Audio('/sounds/notification.mp3');
  audio.play().catch(console.error);
}

// Mostrar notificação do navegador
function showNotification({ title, body }: { title: string; body: string }) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/logo.png',
      badge: '/badge.png',
    });
  }
}

// Formatar timestamp
function formatTimestamp(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('pt-BR');
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}