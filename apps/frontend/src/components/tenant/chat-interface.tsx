'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { messageService } from '@/services/message.service';
import { Conversation, Message, MessageDirection, MessageType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Image as ImageIcon, Phone } from 'lucide-react';
import { getInitials, formatTime, formatPhoneNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  conversation: Conversation;
  messages: Message[];
  onMessageSent: () => void;
}

export function ChatInterface({ conversation, messages, onMessageSent }: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messageService.send({
        conversationId: conversation.id,
        type: MessageType.TEXT,
        content,
      }),
    onSuccess: () => {
      setMessageText('');
      onMessageSent();
      toast.success('Mensagem enviada!');
    },
    onError: () => {
      toast.error('Erro ao enviar mensagem');
    },
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMutation.mutate(messageText.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getStatusBadge = () => {
    const variants = {
      OPEN: { label: 'Aberta', variant: 'warning' as const },
      PENDING: { label: 'Pendente', variant: 'warning' as const },
      IN_PROGRESS: { label: 'Em Andamento', variant: 'info' as const },
      RESOLVED: { label: 'Resolvida', variant: 'success' as const },
      CLOSED: { label: 'Fechada', variant: 'secondary' as const },
    };

    const status = variants[conversation.status];
    return <Badge variant={status.variant}>{status.label}</Badge>;
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-whatsapp-green text-white">
              {getInitials(conversation.contact.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{conversation.contact.name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{formatPhoneNumber(conversation.contact.phone)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {conversation.assignedTo && (
            <Badge variant="outline">Atribuído: {conversation.assignedTo.name.split(' ')[0]}</Badge>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-[#e5ddd5] p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map((message) => {
            const isSent = message.direction === MessageDirection.OUTBOUND;

            return (
              <div key={message.id} className={cn('flex', isSent ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'chat-bubble max-w-[70%] rounded-lg px-4 py-2 shadow-sm',
                    isSent ? 'bg-[#d9fdd3]' : 'bg-white'
                  )}
                >
                  {/* Message Content */}
                  {message.type === MessageType.TEXT && <p className="text-sm break-words">{message.content}</p>}

                  {message.type === MessageType.IMAGE && (
                    <div>
                      {message.content && <p className="text-sm mb-2">{message.content}</p>}
                      <img src={message.mediaUrl} alt="Imagem" className="rounded-lg max-w-full" />
                    </div>
                  )}

                  {message.type === MessageType.DOCUMENT && (
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                        {message.content || 'Documento'}
                      </a>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
                    {isSent && (
                      <span className="text-xs">
                        {message.status === 'READ' && '✓✓'}
                        {message.status === 'DELIVERED' && '✓✓'}
                        {message.status === 'SENT' && '✓'}
                        {message.status === 'PENDING' && '🕐'}
                        {message.status === 'FAILED' && '❌'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" title="Anexar arquivo">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" title="Enviar imagem">
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={sendMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMutation.isPending}
            variant="whatsapp"
            size="icon"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
