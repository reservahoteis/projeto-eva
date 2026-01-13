'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Conversation } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, MoreVertical, User, Clock, CheckCircle2, Archive, Trash2 } from 'lucide-react';
import { getInitials, formatTime } from '@/lib/utils';
import { conversationService } from '@/services/conversation.service';
import { toast } from 'sonner';

interface ConversationCardProps {
  conversation: Conversation;
  onUpdate: () => void;
}

export function ConversationCard({ conversation, onUpdate }: ConversationCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = async () => {
    setIsLoading(true);
    try {
      await conversationService.close(conversation.id);
      toast.success('Conversa fechada!');
      onUpdate();
    } catch (error) {
      toast.error('Erro ao fechar conversa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      await conversationService.archive(conversation.id);
      toast.success('Conversa arquivada!');
      onUpdate();
    } catch (error) {
      toast.error('Erro ao arquivar conversa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.')) {
      return;
    }
    setIsLoading(true);
    try {
      await conversationService.delete(conversation.id);
      toast.success('Conversa excluída!');
      onUpdate();
    } catch (error) {
      toast.error('Erro ao excluir conversa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChat = () => {
    router.push(`/dashboard/conversations/${conversation.id}`);
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleOpenChat}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0">
              {conversation.contact.profilePictureUrl && (
                <AvatarImage src={conversation.contact.profilePictureUrl} alt={conversation.contact.name || 'Contato'} />
              )}
              <AvatarFallback className="bg-whatsapp-green text-white">
                {getInitials(conversation.contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{conversation.contact.name}</p>
              <p className="text-sm text-muted-foreground truncate">{conversation.contact.phoneNumber}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenChat}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Abrir chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClose} disabled={isLoading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Fechar conversa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive} disabled={isLoading}>
                <Archive className="mr-2 h-4 w-4" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} disabled={isLoading} className="text-red-600 focus:text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Last Message */}
        {conversation.lastMessage && (
          <div className="text-sm text-muted-foreground line-clamp-2">
            {conversation.lastMessage.content || '[Mídia]'}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs gap-1">
          <div className="flex items-center gap-1 text-muted-foreground flex-shrink-0">
            <User className="h-3 w-3" />
            <span>{conversation.assignedTo?.name?.split(' ')[0] || 'N/A'}</span>
          </div>

          {/* Hotel Unit Badge */}
          {conversation.hotelUnit && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200 whitespace-nowrap">
              {conversation.hotelUnit}
            </Badge>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatTime(conversation.lastMessageAt)}</span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive();
                }}
                disabled={isLoading}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="Arquivar"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={isLoading}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Unread Badge */}
        {conversation.unreadCount > 0 && (
          <Badge variant="destructive" className="absolute top-2 right-2">
            {conversation.unreadCount}
          </Badge>
        )}

      </CardContent>
    </Card>
  );
}
