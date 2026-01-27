'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { messageService } from '@/services/message.service';
import { ContactSidebar } from '@/components/tenant/contact-sidebar';
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { useRouter } from 'next/navigation';
import { useSocketContext } from '@/contexts/socket-context';
import { useEffect, useState, useRef } from 'react';
import { Message, MessageType, UserRole } from '@/types';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/layout/protected-route';

interface ConversationPageProps {
  params: {
    id: string;
  };
}

function ConversationPageContent({ params }: ConversationPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { on, off, subscribeToConversation, unsubscribeFromConversation, isConnected, sendTypingStatus, isUserTyping, setActiveConversationId: setSocketActiveConversationId } = useSocketContext();
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Usar params.id diretamente - mais simples e confiável
  const conversationId = params.id;

  // [P0-3 FIX] Use refs for stable handler references to prevent memory leaks
  // This avoids re-registering Socket.IO handlers on every render
  const handlersRef = useRef({
    handleNewMessage: null as any,
    handleConversationUpdate: null as any,
    handleMessageStatus: null as any,
  });

  // Fetch conversation data - staleTime evita refetches desnecessários
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationService.getById(conversationId),
    staleTime: 30000, // 30 seconds - avoid refetch for recently viewed conversations
    enabled: !!conversationId,
  });

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messageService.list(conversationId, { limit: 100 }),
    staleTime: 30000, // 30 seconds - avoid refetch for recently viewed conversations
    enabled: !!conversationId,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messageService.send({
        conversationId,
        type: MessageType.TEXT,
        content,
      }),
    onSuccess: () => {
      toast.success('Mensagem enviada!');
    },
    onError: () => {
      toast.error('Erro ao enviar mensagem');
    },
  });

  // Mark conversation as read when opening (only if has unread messages)
  useEffect(() => {
    if (!conversationId || !conversation) return;

    // Only mark as read if there are unread messages
    if (conversation.unreadCount === 0) return;

    const timeoutId = setTimeout(async () => {
      try {
        await conversationService.markAsRead(conversationId);
        // Update the conversations list cache to reflect unread count = 0
        queryClient.setQueryData(['conversations'], (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((conv: any) =>
              conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
            ),
          };
        });
      } catch (error) {
        // Silently ignore errors - not critical
        console.error('Error marking conversation as read:', error);
      }
    }, 500); // Wait 500ms before marking as read to avoid rapid navigation issues

    return () => clearTimeout(timeoutId);
  }, [conversationId, conversation?.unreadCount, queryClient]);

  // [P0-3 FIX] Initialize stable handlers in a separate effect
  useEffect(() => {
    // Create stable handler references that don't change between renders
    handlersRef.current.handleNewMessage = (data: any) => {
      console.log('🔵 SOCKET EVENT - message:new:', {
        fullData: data,
        dataKeys: Object.keys(data),
        hasMessage: !!data.message,
        hasConversation: !!data.conversation,
        messageId: data.message?.id,
        messageConversationId: data.message?.conversationId,
        conversationId: data.conversation?.id,
        currentPageId: params.id,
        timestamp: new Date().toISOString()
      });

      // Backend envia: { message: {...}, conversation: {...} }
      const message = data.message;
      const conversation = data.conversation;

      // Determinar o ID da conversa de várias fontes possíveis
      const messageConversationId =
        message?.conversationId ||
        conversation?.id ||
        data.conversationId ||
        conversationId;

      console.log('📍 Conversation ID resolved to:', messageConversationId, 'vs current:', conversationId);

      // Only process messages for this conversation
      if (messageConversationId === conversationId && message) {
        console.log('✅ MESSAGE IS FOR THIS CONVERSATION - UPDATING UI NOW!');

        // PADRÃO WHATSAPP: Atualizar cache IMEDIATAMENTE
        queryClient.setQueryData(
          ['messages', conversationId],
          (oldData: any) => {
            console.log('📦 Current cache state:', {
              hasOldData: !!oldData,
              messageCount: oldData?.data?.length || 0
            });

            if (!oldData) {
              console.log('🆕 Creating new cache with first message');
              return {
                data: [message],
                pagination: { page: 1, limit: 100, total: 1 }
              };
            }

            // Check if message already exists
            const messageExists = oldData.data?.some((msg: Message) => msg.id === message.id);
            if (messageExists) {
              console.log('⚠️ Message already exists, skipping duplicate');
              return oldData;
            }

            // Add new message to the END (most recent)
            const updatedData = {
              ...oldData,
              data: [...(oldData.data || []), message]
            };

            console.log('✅ CACHE UPDATED! Messages:', oldData.data?.length, '→', updatedData.data.length);
            return updatedData;
          }
        );

        // [PERFORMANCE] Remove invalidateQueries - já atualizamos o cache com setQueryData
        // Invalidar aqui causa refetch desnecessário e perda de performance
        // console.log('🔄 Cache updated - no invalidation needed');

        // Also update conversation's lastMessage
        if (conversation) {
          queryClient.setQueryData(['conversation', conversationId], (oldData: any) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              lastMessage: message,
              updatedAt: message.createdAt || new Date().toISOString()
            };
          });
        }

        console.log('✅ UI UPDATE COMPLETE - Message should appear now!');
      } else {
        console.log('⚠️ Message for different conversation or no message data:', {
          messageConversationId,
          currentId: params.id,
          hasMessage: !!message
        });
      }
    };

    handlersRef.current.handleConversationUpdate = (data: { conversation: any }) => {
      // Validar se conversation existe e tem id
      if (!data?.conversation?.id) {
        console.warn('Invalid conversation update data:', data);
        return;
      }

      if (data.conversation.id === conversationId) {
        console.log('Conversation updated:', data);

        // [FIX] Safety guard: merge com cache existente para evitar undefined
        // Isso previne o crash ao alternar IA rapidamente
        queryClient.setQueryData(['conversation', conversationId], (old: any) => {
          if (!old) return data.conversation; // Se não há cache, usa novo
          return { ...old, ...data.conversation }; // Merge seguro
        });
      }
    };

    handlersRef.current.handleMessageStatus = (data: { messageId: string; status: string }) => {
      console.log('Message status update:', data);

      // Update message status in cache
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          data: oldData.data.map((msg: Message) =>
            msg.id === data.messageId ? { ...msg, status: data.status } : msg
          )
        };
      });
    };
  }, [conversationId, queryClient]);

  // [P0-3 FIX] Subscribe to real-time events with stable handler references
  // This prevents memory leaks by ensuring handlers are properly cleaned up
  useEffect(() => {
    if (!isConnected || !conversationId) return;

    console.log('Subscribing to conversation:', conversationId);
    subscribeToConversation(conversationId);

    // Create wrapper functions that call the stable handlers
    const newMessageWrapper = (data: any) => handlersRef.current.handleNewMessage?.(data);
    const conversationUpdateWrapper = (data: any) => handlersRef.current.handleConversationUpdate?.(data);
    const messageStatusWrapper = (data: any) => handlersRef.current.handleMessageStatus?.(data);

    // Register event listeners with wrapper functions
    on('message:new', newMessageWrapper);
    on('conversation:updated', conversationUpdateWrapper);
    on('message:status', messageStatusWrapper);

    // Cleanup - GUARANTEED to remove the exact same function references
    return () => {
      console.log('Unsubscribing from conversation:', conversationId);
      unsubscribeFromConversation(conversationId);
      off('message:new', newMessageWrapper);
      off('conversation:updated', conversationUpdateWrapper);
      off('message:status', messageStatusWrapper);
    };
  }, [isConnected, conversationId, on, off, subscribeToConversation, unsubscribeFromConversation]);

  // Refetch messages when connection is restored
  useEffect(() => {
    if (isConnected) {
      refetchMessages();
    }
  }, [isConnected, refetchMessages]);

  // Handle sending messages
  const handleSendMessage = (content: string) => {
    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTypingStatus(conversationId, false);
    setIsTyping(false);

    sendMutation.mutate(content);
  };

  // Handle typing indicator
  const handleTypingChange = (typing: boolean) => {
    setIsTyping(typing);
    sendTypingStatus(conversationId, typing);
  };

  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        sendTypingStatus(conversationId, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track active conversation to suppress notifications for open chats
  useEffect(() => {
    setSocketActiveConversationId(conversationId);

    // Clear active conversation when leaving this page
    return () => {
      setSocketActiveConversationId(null);
    };
  }, [conversationId, setSocketActiveConversationId]);

  // Loading state - mostrar enquanto carrega
  const isLoading = conversationLoading || messagesLoading;

  // Mostrar loading enquanto carrega a conversa
  if (isLoading || !conversation) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f0f2f5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00a884] mx-auto mb-4"></div>
          <p className="text-sm text-[#667781]">Carregando conversa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Chat Area - respects right sidebar space */}
      <div className="flex-1 flex flex-col min-w-0 relative whatsapp-chat-bg xl:mr-[320px]">
        {/* WhatsApp background pattern */}
        <div className="absolute inset-0 whatsapp-chat-pattern" />

        {/* Chat Header - Fixed at top */}
        <div className="flex-shrink-0 relative z-10">
          <ChatHeader
            conversation={conversation}
            isOnline={false}
            isTyping={isUserTyping(conversationId)}
            isConnected={isConnected}
            onBack={() => router.push('/dashboard/conversations')}
          />
        </div>

        {/* Message List - Takes remaining space */}
        <div className="flex-1 overflow-hidden relative z-10">
          <MessageList
            messages={messagesData?.data || []}
            isTyping={isUserTyping(conversationId)}
            contactName={conversation.contact.name || conversation.contact.phoneNumber}
            contactAvatar={conversation.contact.profilePictureUrl}
          />
        </div>

        {/* Chat Input - Fixed at bottom */}
        <div className="flex-shrink-0 relative z-10">
          <ChatInput
            onSendMessage={handleSendMessage}
            onTypingChange={handleTypingChange}
            disabled={!isConnected}
            isLoading={sendMutation.isPending}
          />
        </div>
      </div>

      {/* RIGHT: Contact Sidebar - Fixed position */}
      <div className="hidden xl:block fixed right-0 top-0 h-full w-[320px] z-20">
        <ContactSidebar
          conversation={conversation}
          onIaLockChange={(locked) => {
            queryClient.setQueryData(['conversation', conversationId], (old: any) => ({
              ...old,
              iaLocked: locked,
            }));
          }}
          onArchive={() => {
            router.push('/dashboard/conversations');
          }}
          onDelete={() => {
            router.push('/dashboard/conversations');
          }}
        />
      </div>
    </div>
  );
}

// Wrap with ProtectedRoute - SALES pode acessar para atender oportunidades
export default function ConversationPage({ params }: ConversationPageProps) {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HEAD, UserRole.ATTENDANT, UserRole.SALES]}>
      <ConversationPageContent params={params} />
    </ProtectedRoute>
  );
}
