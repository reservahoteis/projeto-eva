'use client';

import { useState } from 'react';
import { Conversation, ConversationStatus } from '@/types';
import { Search, MoreVertical, Phone, Video, ArrowLeft, Bot, BotOff, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, getInitials } from '@/lib/utils';
import { conversationService } from '@/services/conversation.service';
import { toast } from 'sonner';

interface ChatHeaderProps {
  conversation: Conversation;
  isOnline?: boolean;
  isTyping?: boolean;
  isConnected?: boolean;
  onBack?: () => void;
  onIaLockChange?: (locked: boolean) => void;
}

export function ChatHeader({ conversation, isOnline, isTyping, isConnected, onBack, onIaLockChange }: ChatHeaderProps) {
  const [isTogglingIaLock, setIsTogglingIaLock] = useState(false);

  const handleToggleIaLock = async () => {
    try {
      setIsTogglingIaLock(true);
      const newLockState = !conversation.iaLocked;
      await conversationService.toggleIaLock(conversation.id, newLockState);

      if (newLockState) {
        toast.success('IA desativada para esta conversa', {
          description: 'Somente atendentes humanos responderão',
        });
      } else {
        toast.success('IA reativada para esta conversa', {
          description: 'A IA voltará a responder mensagens',
        });
      }

      onIaLockChange?.(newLockState);
    } catch (error) {
      toast.error('Erro ao alterar status da IA');
      console.error('Error toggling IA lock:', error);
    } finally {
      setIsTogglingIaLock(false);
    }
  };

  const getStatusBadge = () => {
    const variants: Record<string, { label: string; className: string }> = {
      [ConversationStatus.OPEN]: { label: 'Aberta', className: 'bg-yellow-100 text-yellow-800' },
      [ConversationStatus.PENDING]: { label: 'Pendente', className: 'bg-orange-100 text-orange-800' },
      [ConversationStatus.IN_PROGRESS]: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800' },
      [ConversationStatus.RESOLVED]: { label: 'Resolvida', className: 'bg-green-100 text-green-800' },
      [ConversationStatus.CLOSED]: { label: 'Fechada', className: 'bg-gray-100 text-gray-800' },
      WAITING: { label: 'Aguardando', className: 'bg-purple-100 text-purple-800' },
    };

    const status = variants[conversation.status] || { label: 'Desconhecido', className: 'bg-gray-100 text-gray-800' };
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
    <div className="h-[59px] bg-[#f0f2f5] border-b border-[#d1d7db] px-2 sm:px-4 flex items-center justify-between">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {/* Back button for mobile */}
        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden p-2 -ml-1 text-[#54656f] hover:text-[#111b21] transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="relative flex-shrink-0">
          <Avatar className="w-10 h-10">
            {conversation.contact.profilePictureUrl && (
              <AvatarImage
                src={conversation.contact.profilePictureUrl}
                alt={conversation.contact.name || 'Contato'}
              />
            )}
            <AvatarFallback className="bg-[#00a884] text-white font-medium">
              {getInitials(conversation.contact.name || conversation.contact.phoneNumber)}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] border-2 border-[#f0f2f5] rounded-full" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2
            className="text-[16px] font-medium text-[#111b21] truncate"
            style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
          >
            {conversation.contact.name || conversation.contact.phoneNumber}
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

      <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4">
        {/* Connection Status */}
        <div className="flex items-center gap-1 mr-1 sm:mr-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500"
          )} />
        </div>

        {/* Status Badge - Hidden on very small screens */}
        <div className="hidden xs:block">
          {getStatusBadge()}
        </div>

        {/* IA Lock Status Badge */}
        {conversation.iaLocked && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <BotOff className="w-3 h-3 mr-1" />
            IA Off
          </Badge>
        )}

        {/* Assigned User - Hidden on mobile */}
        {conversation.assignedTo && (
          <Badge variant="outline" className="hidden sm:inline-flex text-xs bg-blue-50 text-blue-700">
            {conversation.assignedTo.name?.split(' ')[0] || 'N/A'}
          </Badge>
        )}

        {/* Action Buttons - Condensed on mobile */}
        <div className="flex items-center gap-3 sm:gap-5 ml-1 sm:ml-3">
          {/* IA Lock Toggle Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleIaLock}
                  disabled={isTogglingIaLock}
                  className={cn(
                    'p-2 h-auto transition-colors',
                    conversation.iaLocked
                      ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                      : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                  )}
                >
                  {isTogglingIaLock ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : conversation.iaLocked ? (
                    <BotOff className="w-5 h-5" />
                  ) : (
                    <Bot className="w-5 h-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{conversation.iaLocked ? 'Reativar IA' : 'Desativar IA'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            className="hidden sm:block text-[#54656f] hover:text-[#111b21] transition-colors"
            title="Chamada de vídeo"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            className="hidden sm:block text-[#54656f] hover:text-[#111b21] transition-colors"
            title="Ligar"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            className="hidden sm:block text-[#54656f] hover:text-[#111b21] transition-colors"
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
