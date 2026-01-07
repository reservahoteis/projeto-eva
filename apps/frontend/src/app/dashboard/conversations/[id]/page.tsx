'use client';

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { messageService } from '@/services/message.service';
import { ContactSidebar } from '@/components/tenant/contact-sidebar';
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useSocketContext } from '@/contexts/socket-context';
import { useEffect, useState, useRef } from 'react';
import { Message, MessageType } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useChatStore } from '@/stores/chat-store';

interface ConversationPageProps {
  params: {
    id: string;
  };
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { on, off, subscribeToConversation, unsubscribeFromConversation, isConnected, sendTypingStatus, isUserTyping, setActiveConversationId: setSocketActiveConversationId } = useSocketContext();
  const { activeConversationId } = useChatStore();
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Usar activeConversationId do Zustand se disponível, senão usar params.id
  // Isso permite transição instantânea mesmo antes do URL mudar
  const conversationId = activeConversationId || params.id;

  // [P0-3 FIX] Use refs for stable handler references to prevent memory leaks
  // This avoids re-registering Socket.IO handlers on every render
  const handlersRef = useRef({
    handleNewMessage: null as any,
    handleConversationUpdate: null as any,
    handleMessageStatus: null as any,
  });

  // [PERFORMANCE OPTIMIZATION] Use placeholderData to keep previous conversation
  // visible while loading the new one. This prevents blank screens during navigation.
  // staleTime of 30s avoids unnecessary refetches for recently viewed conversations.
  const { data: conversation, isLoading: conversationLoading, isFetching: conversationFetching, isPlaceholderData: isConversationStale } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationService.getById(conversationId),
    placeholderData: keepPreviousData,
    staleTime: 30000, // 30 seconds - avoid refetch for recently viewed conversations
    enabled: !!conversationId, // Só buscar se tiver ID
  });

  const { data: messagesData, isLoading: messagesLoading, isFetching: messagesFetching, isPlaceholderData: isMessagesStale, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messageService.list(conversationId, { limit: 100 }),
    placeholderData: keepPreviousData,
    staleTime: 30000, // 30 seconds - avoid refetch for recently viewed conversations
    enabled: !!conversationId, // Só buscar se tiver ID
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

  // [PERFORMANCE] Intelligent loading states:
  // - Only show fullscreen loading on INITIAL load (no cached data)
  // - If we have placeholder data, show it with an inline loading indicator
  // - Never show "not found" while actively fetching
  const isInitialLoading = (conversationLoading || messagesLoading) && !conversation && !messagesData;
  const isRefreshing = conversationFetching || messagesFetching;
  const showInlineLoader = isRefreshing && (isConversationStale || isMessagesStale);

  // Only show fullscreen loader on initial load (no data in cache)
  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only show "not found" if we're NOT fetching and genuinely have no data
  if (!conversation && !conversationFetching) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-medium">Conversa não encontrada</p>
          <Button onClick={() => router.push('/dashboard/conversations')} className="mt-4">
            Voltar para conversas
          </Button>
        </div>
      </div>
    );
  }

  // If we're still fetching but have no data at all, show loading
  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen min-w-0 relative whatsapp-chat-bg">
        {/* WhatsApp background pattern */}
        <div className="absolute inset-0 whatsapp-chat-pattern" />

        {/* Chat Header - Fixed at top */}
        <div className="flex-shrink-0 relative z-10">
          <div className="relative">
            <ChatHeader
              conversation={conversation}
              isOnline={false}
              isTyping={isUserTyping(conversationId)}
              isConnected={isConnected}
              onBack={() => router.push('/dashboard/conversations')}
            />
            {/* Inline loading indicator when refreshing conversation data */}
            {showInlineLoader && (
              <div className="absolute top-2 right-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-border flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Atualizando...</span>
              </div>
            )}
          </div>
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
      <div className="flex-shrink-0 sticky bottom-0 z-10">
        <ChatInput
          onSendMessage={handleSendMessage}
          onTypingChange={handleTypingChange}
          disabled={!isConnected}
          isLoading={sendMutation.isPending}
        />
      </div>

      {/* RIGHT: Contact Sidebar - Hidden on mobile, visible on xl+ */}
      <div className="hidden xl:absolute xl:block xl:right-0 xl:top-0 xl:h-full flex-shrink-0 z-20">
        <ContactSidebar
          conversation={conversation}
          onIaLockChange={(locked) => {
            // Update local conversation state
            queryClient.setQueryData(['conversation', conversationId], (old: any) => ({
              ...old,
              iaLocked: locked,
            }));
          }}
        />
      </div>
    </div>
  );
}
