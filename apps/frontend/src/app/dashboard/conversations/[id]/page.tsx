'use client';

import { useQuery } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { messageService } from '@/services/message.service';
import { ChatInterface } from '@/components/tenant/chat-interface';
import { ContactSidebar } from '@/components/tenant/contact-sidebar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ConversationPageProps {
  params: {
    id: string;
  };
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const router = useRouter();

  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation', params.id],
    queryFn: () => conversationService.getById(params.id),
    refetchInterval: 5000, // Refetch every 5s for new messages
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', params.id],
    queryFn: () => messageService.list(params.id, { limit: 100 }),
    refetchInterval: 5000,
  });

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
