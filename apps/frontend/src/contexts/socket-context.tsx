'use client';

import { createContext, useContext, useEffect, ReactNode, useState, useCallback, useRef } from 'react';
import { useSocket, SocketEvents } from '@/hooks/useSocket';
import { useAuth } from './auth-context';
import { toast } from 'sonner';
import { Message, Conversation } from '@/types';

interface SocketContextData {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  emit: (event: string, data?: any, callback?: (...args: any[]) => void) => boolean;
  on: <K extends keyof SocketEvents>(
    event: K | string,
    handler: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => void;
  off: <K extends keyof SocketEvents>(
    event: K | string,
    handler?: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => void;
  once: <K extends keyof SocketEvents>(
    event: K | string,
    handler: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => void;
  subscribeToConversation: (conversationId: string) => void;
  unsubscribeFromConversation: (conversationId: string) => void;
  sendTypingStatus: (conversationId: string, isTyping: boolean) => void;
  messageQueue: MessageQueueItem[];
  typingUsers: Map<string, Set<string>>;
  onlineUsers: Set<string>;
  isUserTyping: (conversationId: string) => boolean;
  getTypingUsers: (conversationId: string) => string[];
  isUserOnline: (userId: string) => boolean;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

interface MessageQueueItem {
  id: string;
  conversationId: string;
  content: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  timestamp: number;
  retries: number;
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const subscribedConversations = useRef<Set<string>>(new Set());
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const {
    isConnected,
    connectionStatus,
    error,
    emit: socketEmit,
    on,
    off,
    once
  } = useSocket({
    enabled: isAuthenticated,
    tenantSlug: user?.tenantId ? 'hoteis-reserva' : undefined // Usando um valor padrão por enquanto
  });

  // Enhanced emit with retry logic for message queue
  const emit = useCallback((event: string, data?: any, callback?: (...args: any[]) => void): boolean => {
    const success = socketEmit(event, data, callback);

    // If it's a message event and failed, add to queue
    if (!success && event === 'message:send' && data) {
      const queueItem: MessageQueueItem = {
        id: `msg-${Date.now()}-${Math.random()}`,
        conversationId: data.conversationId,
        content: data.content || data.message,
        status: 'pending',
        timestamp: Date.now(),
        retries: 0
      };

      setMessageQueue(prev => [...prev, queueItem]);
      console.log('Message queued for retry:', queueItem);
    }

    return success;
  }, [socketEmit]);

  // Subscribe to a conversation room
  const subscribeToConversation = useCallback((conversationId: string) => {
    console.log('🔔 SUBSCRIBE INICIADO:', conversationId);

    if (!conversationId) {
      console.error('❌ conversationId está undefined!');
      return;
    }

    if (subscribedConversations.current.has(conversationId)) {
      console.warn('⚠️ Já está subscrito:', conversationId);
      return;
    }

    console.log('📤 Emitindo conversation:join com payload:', { conversationId });
    // CORREÇÃO CRÍTICA: Backend espera objeto { conversationId }, não string!
    const success = emit('conversation:join', { conversationId });
    console.log('📡 Resultado do emit:', success ? '✅ Sucesso' : '❌ Falhou');

    if (success) {
      subscribedConversations.current.add(conversationId);
      console.log('✅ SUBSCRITO COM SUCESSO:', conversationId);
      console.log('📊 Total de conversas subscritas:', subscribedConversations.current.size);
    } else {
      console.error('❌ FALHA AO SUBSCREVER:', conversationId);
    }
  }, [emit]);

  // Unsubscribe from a conversation room
  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    console.log('🔕 UNSUBSCRIBE INICIADO:', conversationId);

    if (!conversationId) {
      console.error('❌ conversationId está undefined ao fazer unsubscribe!');
      return;
    }

    if (!subscribedConversations.current.has(conversationId)) {
      console.warn('⚠️ Não estava subscrito:', conversationId);
      return;
    }

    console.log('📤 Emitindo conversation:leave com payload:', { conversationId });
    // CORREÇÃO CRÍTICA: Backend espera objeto { conversationId }, não string!
    const success = emit('conversation:leave', { conversationId });
    console.log('📡 Resultado do emit leave:', success ? '✅ Sucesso' : '❌ Falhou');

    if (success) {
      subscribedConversations.current.delete(conversationId);
      console.log('✅ DESSUBSCRITO COM SUCESSO:', conversationId);
      console.log('📊 Total de conversas subscritas restantes:', subscribedConversations.current.size);
    } else {
      console.error('❌ FALHA AO DESSUBSCREVER:', conversationId);
    }
  }, [emit]);

  // Send typing status with debounce
  const sendTypingStatus = useCallback((conversationId: string, isTyping: boolean) => {
    // Clear existing timer for this conversation
    const existingTimer = typingTimers.current.get(conversationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      typingTimers.current.delete(conversationId);
    }

    if (isTyping) {
      // Send typing status immediately
      emit('user:typing', {
        conversationId,
        isTyping: true
      });

      // Auto-stop typing after 3 seconds
      const timer = setTimeout(() => {
        emit('user:typing', {
          conversationId,
          isTyping: false
        });
        typingTimers.current.delete(conversationId);
      }, 3000);

      typingTimers.current.set(conversationId, timer);
    } else {
      // Stop typing immediately
      emit('user:typing', {
        conversationId,
        isTyping: false
      });
    }
  }, [emit]);

  const isUserTyping = useCallback((conversationId: string) => {
    return (typingUsers.get(conversationId)?.size || 0) > 0;
  }, [typingUsers]);

  const getTypingUsers = useCallback((conversationId: string) => {
    return Array.from(typingUsers.get(conversationId) || []);
  }, [typingUsers]);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  // Process message queue when reconnected
  useEffect(() => {
    if (isConnected && messageQueue.length > 0) {
      console.log('Processing message queue:', messageQueue.length, 'messages');

      messageQueue.forEach(item => {
        if (item.status === 'pending' || item.status === 'failed') {
          // Update status to sending
          setMessageQueue(prev =>
            prev.map(msg =>
              msg.id === item.id ? { ...msg, status: 'sending' } : msg
            )
          );

          // Try to send the message
          const success = socketEmit('message:send', {
            conversationId: item.conversationId,
            content: item.content,
            queueId: item.id
          });

          if (success) {
            // Remove from queue if sent successfully
            setMessageQueue(prev => prev.filter(msg => msg.id !== item.id));
          } else {
            // Mark as failed and increment retry count
            setMessageQueue(prev =>
              prev.map(msg =>
                msg.id === item.id
                  ? { ...msg, status: 'failed', retries: msg.retries + 1 }
                  : msg
              )
            );
          }
        }
      });
    }
  }, [isConnected, messageQueue, socketEmit]);

  useEffect(() => {
    if (!isConnected) return;

    // Listen for new messages
    const handleNewMessage = (data: { message: Message; conversation: Conversation }) => {
      console.log('🔵🔵🔵 EVENTO message:new RECEBIDO NO SOCKET-CONTEXT:', {
        fullData: data,
        messageId: data.message?.id,
        conversationId: data.message?.conversationId || data.conversation?.id,
        content: data.message?.content?.substring(0, 50),
        hasMessage: !!data.message,
        hasConversation: !!data.conversation,
        messageDirection: data.message?.direction,
        timestamp: new Date().toISOString(),
        subscribedConversations: Array.from(subscribedConversations.current),
        isSubscribed: subscribedConversations.current.has(data.message?.conversationId || data.conversation?.id)
      });

      // Show notification for inbound messages ONLY if chat is NOT open
      const messageConversationId = data.message?.conversationId || data.conversation?.id;
      const isChatOpen = activeConversationId === messageConversationId;

      if (data.message.direction === 'INBOUND' && !isChatOpen) {
        // Play notification sound if available
        try {
          const audio = new Audio('/sounds/notification.mp3');
          audio.play().catch(console.error);
        } catch (error) {
          console.error('Error playing notification sound:', error);
        }

        toast.success(`Nova mensagem de ${data.conversation.contact.name}`, {
          description: data.message.content || '[Mídia]',
          duration: 5000,
          position: 'top-right'
        });
      }
    };

    // Listen for conversation updates
    const handleConversationUpdate = (data: { conversation: Conversation }) => {
      console.log('🔄 Conversation updated:', data);
    };

    // Handle typing events
    const handleTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      console.log('⌨️ Typing indicator:', data);
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        const conversationTypers = newMap.get(data.conversationId) || new Set();

        if (data.isTyping) {
          conversationTypers.add(data.userId);
        } else {
          conversationTypers.delete(data.userId);
        }

        if (conversationTypers.size === 0) {
          newMap.delete(data.conversationId);
        } else {
          newMap.set(data.conversationId, conversationTypers);
        }

        return newMap;
      });
    };

    // Handle online/offline events
    const handleUserOnline = (data: { userId: string }) => {
      console.log('🟢 User online:', data.userId);
      setOnlineUsers(prev => new Set(prev).add(data.userId));
    };

    const handleUserOffline = (data: { userId: string }) => {
      console.log('🔴 User offline:', data.userId);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    };

    // Handle message status updates
    const handleMessageStatus = (data: { messageId: string; status: string }) => {
      console.log('📬 Message status:', data);
    };

    // Register all event listeners
    console.log('🎯 REGISTRANDO LISTENERS DE EVENTOS DO SOCKET.IO');
    on('message:new', handleNewMessage);
    on('conversation:updated', handleConversationUpdate);
    on('user:typing', handleTyping);
    on('user:online', handleUserOnline);
    on('user:offline', handleUserOffline);
    on('message:status', handleMessageStatus);
    console.log('✅ TODOS OS LISTENERS REGISTRADOS COM SUCESSO');

    // Cleanup
    return () => {
      off('message:new', handleNewMessage);
      off('conversation:updated', handleConversationUpdate);
      off('user:typing', handleTyping);
      off('user:online', handleUserOnline);
      off('user:offline', handleUserOffline);
      off('message:status', handleMessageStatus);
    };
  }, [isConnected, on, off, activeConversationId]);

  // Clean up old messages from queue (older than 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      setMessageQueue(prev =>
        prev.filter(msg => msg.timestamp > fiveMinutesAgo || msg.status === 'sending')
      );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clear all typing timers
      typingTimers.current.forEach(timer => clearTimeout(timer));
      typingTimers.current.clear();

      // Unsubscribe from all conversations
      subscribedConversations.current.forEach(conversationId => {
        // CORREÇÃO: Usar 'conversation:leave' ao invés de 'conversation:unsubscribe'
        emit('conversation:leave', { conversationId });
      });
      subscribedConversations.current.clear();
    };
  }, [emit]);

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        connectionStatus,
        error,
        emit,
        on,
        off,
        once,
        subscribeToConversation,
        unsubscribeFromConversation,
        sendTypingStatus,
        messageQueue,
        typingUsers,
        onlineUsers,
        isUserTyping,
        getTypingUsers,
        isUserOnline,
        activeConversationId,
        setActiveConversationId
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }

  return context;
}