'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { messageService } from '@/services/message.service';
import { ChatInterface } from '@/components/tenant/chat-interface';
import { ContactSidebar } from '@/components/tenant/contact-sidebar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSocketContext } from '@/contexts/socket-context';
import { useEffect } from 'react';
import { Message } from '@/types';

interface ConversationPageProps {
  params: {
    id: string;
  };
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { on, off, subscribeToConversation, unsubscribeFromConversation, isConnected } = useSocketContext();

  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', params.id],
    queryFn: () => conversationService.getById(params.id),
  });

  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', params.id],
    queryFn: () => messageService.list(params.id, { limit: 100 }),
  });

  // Subscribe to real-time events for this conversation
  useEffect(() => {
    if (!isConnected || !params.id) return;

    console.log('Subscribing to conversation:', params.id);
    subscribeToConversation(params.id);

    // Handle new messages - PADRÃO WHATSAPP WEB
    const handleNewMessage = (data: any) => {
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
        params.id;

      console.log('📍 Conversation ID resolved to:', messageConversationId, 'vs current:', params.id);

      // Only process messages for this conversation
      if (messageConversationId === params.id && message) {
        console.log('✅ MESSAGE IS FOR THIS CONVERSATION - UPDATING UI NOW!');

        // PADRÃO WHATSAPP: Atualizar cache IMEDIATAMENTE
        const cacheUpdated = queryClient.setQueryData(
          ['messages', params.id],
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

        // FORÇAR RE-RENDER: Invalidar query das mensagens (não da conversa!)
        console.log('🔄 Forcing UI update by invalidating messages query');
        queryClient.invalidateQueries({
          queryKey: ['messages', params.id],
          exact: true
        });

        // Also update conversation's lastMessage
        if (conversation) {
          queryClient.setQueryData(['conversation', params.id], (oldData: any) => {
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

    // Handle conversation updates
    const handleConversationUpdate = (data: { conversation: any }) => {
      if (data.conversation.id === params.id) {
        console.log('Conversation updated:', data);
        queryClient.setQueryData(['conversation', params.id], data.conversation);
      }
    };

    // Handle message status updates
    const handleMessageStatus = (data: { messageId: string; status: string }) => {
      console.log('Message status update:', data);

      // Update message status in cache
      queryClient.setQueryData(['messages', params.id], (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          data: oldData.data.map((msg: Message) =>
            msg.id === data.messageId ? { ...msg, status: data.status } : msg
          )
        };
      });
    };

    // Register event listeners
    on('message:new', handleNewMessage);
    on('conversation:updated', handleConversationUpdate);
    on('message:status', handleMessageStatus);

    // Cleanup
    return () => {
      console.log('Unsubscribing from conversation:', params.id);
      unsubscribeFromConversation(params.id);
      off('message:new', handleNewMessage);
      off('conversation:updated', handleConversationUpdate);
      off('message:status', handleMessageStatus);
    };
  }, [isConnected, params.id, on, off, subscribeToConversation, unsubscribeFromConversation, queryClient]);

  // Refetch messages when connection is restored
  useEffect(() => {
    if (isConnected) {
      refetchMessages();
    }
  }, [isConnected, refetchMessages]);

  if (conversationLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!conversation) {
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

  return (
    <div className="flex h-screen">
      {/* Back Button (Mobile) */}
      <div className="lg:hidden absolute top-4 left-4 z-10">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat Interface */}
      <div className="flex-1">
        <ChatInterface
          conversation={conversation}
          messages={messagesData?.data || []}
          onMessageSent={() => {
            // Messages will be refetched automatically
          }}
        />
      </div>

      {/* Contact Sidebar */}
      <ContactSidebar conversation={conversation} />
    </div>
  );
}
