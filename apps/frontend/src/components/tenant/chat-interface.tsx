'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { messageService } from '@/services/message.service';
import { Conversation, Message, MessageDirection, MessageType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Image as ImageIcon, Phone, MoreHorizontal } from 'lucide-react';
import { getInitials, formatTime, formatPhoneNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSocketContext } from '@/contexts/socket-context';

interface ChatInterfaceProps {
  conversation: Conversation;
  messages: Message[];
  onMessageSent: () => void;
}

export function ChatInterface({ conversation, messages, onMessageSent }: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { sendTypingStatus, isUserTyping, isConnected } = useSocketContext();

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

    // Stop typing indicator when sending
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTypingStatus(conversation.id, false);
    setIsTyping(false);

    sendMutation.mutate(messageText.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    // Handle typing indicator
    if (isConnected && e.target.value.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        sendTypingStatus(conversation.id, true);
      }

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendTypingStatus(conversation.id, false);
      }, 2000);
    } else if (isTyping && e.target.value.length === 0) {
      setIsTyping(false);
      sendTypingStatus(conversation.id, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount and cleanup typing on unmount
  useEffect(() => {
    inputRef.current?.focus();

    // Cleanup typing status on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        sendTypingStatus(conversation.id, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-xs text-muted-foreground">
              {isConnected ? "Online" : "Offline"}
            </span>
          </div>
          {getStatusBadge()}
          {conversation.assignedTo && (
            <Badge variant="outline">Atribuído: {conversation.assignedTo.name?.split(' ')[0] || 'N/A'}</Badge>
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
          <>
            {messages.map((message) => {
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
            })}

            {/* Typing Indicator */}
            {isUserTyping(conversation.id) && (
              <div className="flex justify-start">
                <div className="chat-bubble bg-white rounded-lg px-4 py-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <MoreHorizontal className="h-4 w-4 animate-pulse" />
                    <span className="text-sm text-muted-foreground">
                      {conversation.contact.name} está digitando...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
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
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
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
