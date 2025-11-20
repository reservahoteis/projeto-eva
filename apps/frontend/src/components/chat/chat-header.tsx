'use client';

import { Conversation, ConversationStatus } from '@/types';
import { Search, MoreVertical, Phone, Video } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  conversation: Conversation;
  isOnline?: boolean;
  isTyping?: boolean;
  isConnected?: boolean;
}

export function ChatHeader({ conversation, isOnline, isTyping, isConnected }: ChatHeaderProps) {
  const getStatusBadge = () => {
    const variants = {
      [ConversationStatus.OPEN]: { label: 'Aberta', className: 'bg-yellow-100 text-yellow-800' },
      [ConversationStatus.PENDING]: { label: 'Pendente', className: 'bg-orange-100 text-orange-800' },
      [ConversationStatus.IN_PROGRESS]: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800' },
      [ConversationStatus.RESOLVED]: { label: 'Resolvida', className: 'bg-green-100 text-green-800' },
      [ConversationStatus.CLOSED]: { label: 'Fechada', className: 'bg-gray-100 text-gray-800' },
    };

    const status = variants[conversation.status];
    return (
      <Badge variant="outline" className={cn('text-xs', status.className)}>
        {status.label}
      </Badge>
    );
  };

  const getLastSeenText = () => {
    if (isTyping) return 'digitando...';
    if (isOnline) return 'online';
    if (conversation.lastMessageAt) {
      return `Últ. vez: ${format(new Date(conversation.lastMessageAt), "dd/MM 'às' HH:mm", { locale: ptBR })}`;
    }
    return 'offline';
  };

  return (
    <div className="h-[59px] bg-[#f0f2f5] border-b border-[#d1d7db] px-4 flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <img
            src={conversation.contact.avatar || '/avatar-placeholder.png'}
            alt={conversation.contact.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] border-2 border-[#f0f2f5] rounded-full" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2
            className="text-[16px] font-medium text-[#111b21] truncate"
            style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
          >
            {conversation.contact.name || conversation.contact.phone}
          </h2>
          <p
            className={cn(
              'text-[13px]',
              isTyping ? 'text-[#25d366]' : 'text-[#667781]'
            )}
            style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
          >
            {getLastSeenText()}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {/* Connection Status */}
        <div className="flex items-center gap-1 mr-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500"
          )} />
        </div>

        {/* Status Badge */}
        {getStatusBadge()}

        {/* Assigned User */}
        {conversation.assignedTo && (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
            {conversation.assignedTo.name?.split(' ')[0] || 'N/A'}
          </Badge>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-5 ml-3">
          <button
            className="text-[#54656f] hover:text-[#111b21] transition-colors"
            title="Chamada de vídeo"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            className="text-[#54656f] hover:text-[#111b21] transition-colors"
            title="Ligar"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            className="text-[#54656f] hover:text-[#111b21] transition-colors"
            title="Pesquisar"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            className="text-[#54656f] hover:text-[#111b21] transition-colors"
            title="Menu"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
