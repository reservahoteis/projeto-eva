'use client';

import { Message, MessageStatus, MessageType } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean; // Primeira mensagem do grupo
  groupedWithNext: boolean; // Mensagem consecutiva do mesmo remetente
  contactName?: string;
  contactAvatar?: string;
}

export function MessageBubble({
  message,
  isOwnMessage,
  showAvatar,
  groupedWithNext,
  contactName,
  contactAvatar
}: MessageBubbleProps) {
  const bubbleColor = isOwnMessage ? 'bg-[#d9fdd3]' : 'bg-white';
  const alignment = isOwnMessage ? 'ml-auto' : 'mr-auto';

  // Border radius dinâmico para criar efeito de agrupamento
  const getBorderRadius = () => {
    if (groupedWithNext) {
      return isOwnMessage ? 'rounded-tl-lg rounded-bl-lg rounded-br-lg rounded-tr-sm' : 'rounded-tr-lg rounded-br-lg rounded-bl-lg rounded-tl-sm';
    }
    return 'rounded-lg';
  };

  const StatusIcon = () => {
    if (!isOwnMessage) return null;

    if (message.status === MessageStatus.READ) {
      return <CheckCheck className="w-4 h-4 text-[#53bdeb]" />;
    }
    if (message.status === MessageStatus.DELIVERED) {
      return <CheckCheck className="w-4 h-4 text-[#667781]" />;
    }
    if (message.status === MessageStatus.SENT) {
      return <Check className="w-4 h-4 text-[#667781]" />;
    }
    if (message.status === MessageStatus.PENDING) {
      return (
        <svg className="w-4 h-4 text-[#667781] animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    }
    if (message.status === MessageStatus.FAILED) {
      return (
        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className={cn('flex items-end gap-2 max-w-[65%] mb-1', alignment)}>
      {!isOwnMessage && (
        <>
          {showAvatar ? (
            <img
              src={contactAvatar || '/avatar-placeholder.png'}
              alt={contactName || 'Contact'}
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-8 flex-shrink-0" />
          )}
        </>
      )}

      <div
        className={cn(
          bubbleColor,
          getBorderRadius(),
          'shadow-sm px-3 py-2 relative min-w-[60px]'
        )}
        style={{
          boxShadow: '0 1px 0.5px rgba(0,0,0,.13)'
        }}
      >
        {/* Message Content */}
        {message.type === MessageType.TEXT && (
          <p
            className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap"
            style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
          >
            {message.content}
          </p>
        )}

        {message.type === MessageType.IMAGE && (
          <div>
            {message.mediaUrl && (
              <img
                src={message.mediaUrl}
                alt="Imagem"
                className="rounded-lg max-w-full mb-1 cursor-pointer hover:opacity-90 transition-opacity"
              />
            )}
            {message.content && (
              <p className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap mt-1">
                {message.content}
              </p>
            )}
          </div>
        )}

        {message.type === MessageType.DOCUMENT && (
          <div className="flex items-center gap-2 py-1">
            <div className="bg-[#f0f2f5] p-2 rounded-full">
              <Paperclip className="h-5 w-5 text-[#54656f]" />
            </div>
            <div className="flex-1 min-w-0">
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] text-[#027eb5] hover:underline truncate block"
              >
                {message.content || 'Documento'}
              </a>
              <p className="text-[12px] text-[#667781]">{message.mediaType || 'Arquivo'}</p>
            </div>
          </div>
        )}

        {message.type === MessageType.AUDIO && (
          <div className="flex items-center gap-2 min-w-[200px]">
            <audio controls className="w-full h-8" style={{ maxWidth: '100%' }}>
              <source src={message.mediaUrl} type="audio/mpeg" />
            </audio>
          </div>
        )}

        {message.type === MessageType.VIDEO && (
          <div>
            {message.mediaUrl && (
              <video
                controls
                className="rounded-lg max-w-full mb-1"
                style={{ maxHeight: '300px' }}
              >
                <source src={message.mediaUrl} type="video/mp4" />
              </video>
            )}
            {message.content && (
              <p className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap mt-1">
                {message.content}
              </p>
            )}
          </div>
        )}

        {/* Timestamp and Status */}
        <div className="flex items-center gap-1 justify-end mt-1 min-w-[60px]">
          <span
            className="text-[11px] text-[#667781]"
            style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
          >
            {format(new Date(message.createdAt), 'HH:mm', { locale: ptBR })}
          </span>
          <StatusIcon />
        </div>
      </div>
    </div>
  );
}
