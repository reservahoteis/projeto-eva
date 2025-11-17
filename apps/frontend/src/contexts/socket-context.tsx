'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from './auth-context';
import { toast } from 'sonner';
import { Message, Conversation } from '@/types';

interface SocketContextData {
  isConnected: boolean;
  error: string | null;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { isAuthenticated } = useAuth();
  const { isConnected, error, emit, on, off } = useSocket({
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isConnected) return;

    // Listen for new messages
    const handleNewMessage = (data: { message: Message; conversation: Conversation }) => {
      console.log('New message received:', data);

      // Show notification for inbound messages
      if (data.message.direction === 'INBOUND') {
        toast.info(`Nova mensagem de ${data.conversation.contact.name}`, {
          description: data.message.content || '[Mídia]',
          duration: 5000,
        });
      }
    };

    // Listen for conversation updates
    const handleConversationUpdate = (data: { conversation: Conversation }) => {
      console.log('Conversation updated:', data);
    };

    // Listen for typing indicators
    const handleTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      console.log('Typing indicator:', data);
    };

    on('message:new', handleNewMessage);
    on('conversation:update', handleConversationUpdate);
    on('typing', handleTyping);

    // Cleanup
    return () => {
      off('message:new', handleNewMessage);
      off('conversation:update', handleConversationUpdate);
      off('typing', handleTyping);
    };
  }, [isConnected, on, off]);

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        error,
        emit,
        on,
        off,
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