'use client';

import { useQuery } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { Conversation, ConversationStatus } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare, Bot, Building2 } from 'lucide-react';
import { cn, getInitials, formatTime } from '@/lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocketContext } from '@/contexts/socket-context';
import { useChatStore } from '@/stores/chat-store';

interface ConversationListSidebarProps {
  activeConversationId?: string;
}

export function ConversationListSidebar({ activeConversationId }: ConversationListSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { on, off, isConnected } = useSocketContext();
  const { setActiveConversationId } = useChatStore();

  // Ref to preserve scroll position - agora funciona NATIVAMENTE pois componente nunca desmonta
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // [P1-1 FIX] Disable aggressive polling since Socket.IO provides real-time updates
  // This eliminates redundant API calls and reduces server load
  const { data: conversationsData, refetch } = useQuery({
    queryKey: ['conversations-sidebar'],
    queryFn: () => conversationService.list({ limit: 50 }),
    refetchInterval: false, // Disabled - Socket.IO handles real-time updates
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  // Save scroll position before updates
  const saveScrollPosition = () => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
  };

  // Restore scroll position after updates
  const restoreScrollPosition = () => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current;
    }
  };

  // Real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const handleNewConversation = () => {
      saveScrollPosition();
      refetch().then(() => {
        // Restore scroll position after refetch completes
        requestAnimationFrame(restoreScrollPosition);
      });
    };

    const handleConversationUpdate = () => {
      saveScrollPosition();
      refetch().then(() => {
        requestAnimationFrame(restoreScrollPosition);
      });
    };

    const handleNewMessage = () => {
      saveScrollPosition();
      refetch().then(() => {
        requestAnimationFrame(restoreScrollPosition);
      });
    };

    on('conversation:new', handleNewConversation);
    on('conversation:updated', handleConversationUpdate);
    on('message:new', handleNewMessage);

    return () => {
      off('conversation:new', handleNewConversation);
      off('conversation:updated', handleConversationUpdate);
      off('message:new', handleNewMessage);
    };
  }, [isConnected, on, off, refetch]);

  const conversations = conversationsData?.data || [];

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.contact.name?.toLowerCase().includes(searchLower) ||
      conv.contact.phoneNumber?.includes(searchQuery)
    );
  });

  // Sort: unread first, then by lastMessageAt
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    // Unread first
    if ((a.unreadCount || 0) > 0 && (b.unreadCount || 0) === 0) return -1;
    if ((a.unreadCount || 0) === 0 && (b.unreadCount || 0) > 0) return 1;
    // Then by last message time
    return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
  });

  // [SPA-LIKE] Trocar conversa via Zustand - SEM router.push
  // RESULTADO: Scroll NUNCA reseta, transição INSTANTÂNEA (padrão WhatsApp)
  const handleSelectConversation = useCallback((conversationId: string) => {
    // Atualizar estado - Layout fará shallow routing
    setActiveConversationId(conversationId);
    // Scroll é preservado NATURALMENTE (componente não desmonta)
  }, [setActiveConversationId]);

  // Track scroll position on scroll events
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      scrollPositionRef.current = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const getStatusColor = (status: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.OPEN:
        return 'bg-yellow-500';
      case ConversationStatus.IN_PROGRESS:
        return 'bg-blue-500';
      case ConversationStatus.WAITING:
        return 'bg-purple-500';
      case ConversationStatus.CLOSED:
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="w-[320px] lg:w-[360px] h-full flex flex-col bg-white border-r border-[#d1d7db]">
      {/* Header */}
      <div className="h-[59px] bg-[#f0f2f5] border-b border-[#d1d7db] px-4 flex items-center">
        <h2 className="text-[16px] font-medium text-[#111b21]">Conversas</h2>
      </div>

      {/* Search */}
      <div className="p-2 bg-[#f0f2f5]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#54656f]" />
          <Input
            placeholder="Pesquisar ou começar uma nova conversa"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-none rounded-lg text-[13px] h-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <MessageSquare className="h-12 w-12 text-[#8696a0] mb-3" />
            <p className="text-[14px] text-[#667781]">
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa'}
            </p>
          </div>
        ) : (
          sortedConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              onClick={() => handleSelectConversation(conversation.id)}
              statusColor={getStatusColor(conversation.status)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  statusColor: string;
}

function ConversationItem({ conversation, isActive, onClick, statusColor }: ConversationItemProps) {
  const lastMessageContent = conversation.lastMessage?.content || '';
  const truncatedMessage = lastMessageContent.length > 45
    ? lastMessageContent.substring(0, 45) + '...'
    : lastMessageContent;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b border-[#e9edef]',
        isActive ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          {conversation.contact.profilePictureUrl && (
            <AvatarImage
              src={conversation.contact.profilePictureUrl}
              alt={conversation.contact.name || 'Contato'}
            />
          )}
          <AvatarFallback className="bg-[#00a884] text-white text-sm font-medium">
            {getInitials(conversation.contact.name || conversation.contact.phoneNumber)}
          </AvatarFallback>
        </Avatar>
        {/* Status indicator */}
        <div className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', statusColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[16px] font-normal text-[#111b21] truncate">
            {conversation.contact.name || conversation.contact.phoneNumber}
          </span>
          <span className="text-[12px] text-[#667781] flex-shrink-0 ml-2">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {/* IA indicator */}
            {conversation.iaLocked && (
              <Bot className="h-4 w-4 text-red-500 flex-shrink-0" />
            )}
            <span className="text-[14px] text-[#667781] truncate">
              {truncatedMessage || '[Sem mensagens]'}
            </span>
          </div>

          {/* Unread badge */}
          {(conversation.unreadCount || 0) > 0 && (
            <Badge className="ml-2 h-5 min-w-[20px] px-1.5 bg-[#25d366] hover:bg-[#25d366] text-white text-[11px] font-medium rounded-full">
              {conversation.unreadCount}
            </Badge>
          )}
        </div>

        {/* Hotel Unit Tag */}
        {conversation.hotelUnit && (
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200">
              <Building2 className="h-2.5 w-2.5 mr-0.5" />
              {conversation.hotelUnit}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
