'use client';

import { useState } from 'react';
import { Message, MessageStatus, MessageType } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, Paperclip, X, Download, ZoomIn, ZoomOut, List, LayoutGrid, FileText, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WhatsAppListMessage } from './WhatsAppListMessage';
import { WhatsAppCarouselMessage } from './WhatsAppCarouselMessage';

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const bubbleColor = isOwnMessage ? 'bg-[#d9fdd3]' : 'bg-white';
  const alignment = isOwnMessage ? 'ml-auto' : 'mr-auto';

  // Obter mediaUrl do campo direto ou do metadata
  const mediaUrl = message.mediaUrl || (message.metadata as any)?.mediaUrl;
  const caption = (message.metadata as any)?.caption;

  const handleDownload = () => {
    if (!mediaUrl) return;
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = `imagem_${message.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
  const resetZoom = () => setZoom(1);

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
    <div className={cn('flex items-end gap-2 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] mb-1', alignment)}>
      {!isOwnMessage && (
        <>
          {showAvatar ? (
            <Avatar className="w-8 h-8 flex-shrink-0">
              {contactAvatar && (
                <AvatarImage src={contactAvatar} alt={contactName || 'Contato'} />
              )}
              <AvatarFallback className="bg-[#00a884] text-white text-xs font-medium">
                {getInitials(contactName || '')}
              </AvatarFallback>
            </Avatar>
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
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt="Imagem"
                className="rounded-lg max-w-full max-h-[300px] mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  setLightboxOpen(true);
                  resetZoom();
                }}
              />
            ) : (
              <div className="bg-[#f0f2f5] p-4 rounded-lg text-center text-[#667781]">
                <span className="text-sm">Imagem não disponível</span>
              </div>
            )}
            {(caption || (message.content && !message.content.match(/^[a-zA-Z0-9]+$/))) && (
              <p className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap mt-1">
                {caption || message.content}
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
              {mediaUrl ? (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-[#027eb5] hover:underline truncate block"
                  download
                >
                  {(message.metadata as any)?.filename || 'Documento'}
                </a>
              ) : (
                <span className="text-[14px] text-[#667781]">Documento não disponível</span>
              )}
              <p className="text-[12px] text-[#667781]">{(message.metadata as any)?.mimeType || 'Arquivo'}</p>
            </div>
          </div>
        )}

        {message.type === MessageType.AUDIO && (
          <div className="flex items-center gap-2 min-w-[150px] sm:min-w-[200px]">
            {mediaUrl ? (
              <audio controls className="w-full h-8 max-w-full">
                <source src={mediaUrl} type={(message.metadata as any)?.mimeType || 'audio/ogg'} />
                Seu navegador não suporta áudio.
              </audio>
            ) : (
              <div className="bg-[#f0f2f5] p-3 rounded-lg text-center text-[#667781] w-full">
                <span className="text-sm">Áudio não disponível</span>
              </div>
            )}
          </div>
        )}

        {message.type === MessageType.VIDEO && (
          <div>
            {mediaUrl ? (
              <video
                controls
                className="rounded-lg max-w-full max-h-[300px] mb-1"
              >
                <source src={mediaUrl} type={(message.metadata as any)?.mimeType || 'video/mp4'} />
                Seu navegador não suporta vídeo.
              </video>
            ) : (
              <div className="bg-[#f0f2f5] p-4 rounded-lg text-center text-[#667781]">
                <span className="text-sm">Vídeo não disponível</span>
              </div>
            )}
            {(caption || (message.content && !message.content.match(/^[a-zA-Z0-9]+$/))) && (
              <p className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap mt-1">
                {caption || message.content}
              </p>
            )}
          </div>
        )}

        {/* INTERACTIVE - Botões ou Listas */}
        {message.type === MessageType.INTERACTIVE && (
          <div>
            {/* Renderizar botões */}
            {(message.metadata as any)?.interactiveType === 'buttons' && (
              <div>
                {/* Texto principal da mensagem */}
                {message.content && (
                  <p className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap mb-2">
                    {message.content}
                  </p>
                )}
                <div className="space-y-1 mt-2">
                  {(message.metadata as any)?.title && (
                    <p className="text-[13px] font-medium text-[#111b21] mb-1">
                      {(message.metadata as any)?.title}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {((message.metadata as any)?.buttons || []).map((btn: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1.5 text-[13px] text-[#027eb5] bg-[#e7f3ff] rounded-full border border-[#027eb5]/20"
                      >
                        {btn.title || btn.label || btn.text}
                      </span>
                    ))}
                  </div>
                  {(message.metadata as any)?.footer && (
                    <p className="text-[11px] text-[#667781] mt-1">
                      {(message.metadata as any)?.footer}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Renderizar lista - WhatsApp style */}
            {(message.metadata as any)?.interactiveType === 'list' && (
              <WhatsAppListMessage
                header={(message.metadata as any)?.header}
                body={message.content || ''}
                footer={(message.metadata as any)?.footer}
                buttonLabel={(message.metadata as any)?.buttonLabel || 'Ver opções'}
                sections={(message.metadata as any)?.sections || []}
                isOwnMessage={isOwnMessage}
              />
            )}
          </div>
        )}

        {/* TEMPLATE - Templates pré-aprovados */}
        {message.type === MessageType.TEMPLATE && (
          <div>
            {/* Debug: log template metadata */}
            {console.log('🎠 TEMPLATE MESSAGE:', {
              type: message.type,
              metadata: message.metadata,
              templateType: (message.metadata as any)?.templateType,
              hasCards: !!(message.metadata as any)?.cards,
              cardsLength: (message.metadata as any)?.cards?.length,
            })}
            {/* Carousel Template - Exibir cards com navegação horizontal */}
            {/* Detectar carrossel por: templateType === 'carousel' OU templateName contém 'carousel' */}
            {(
              ((message.metadata as any)?.templateType === 'carousel' && (message.metadata as any)?.cards?.length > 0) ||
              ((message.metadata as any)?.templateName?.toLowerCase().includes('carousel') && (message.metadata as any)?.cards?.length > 0)
            ) ? (
              <WhatsAppCarouselMessage
                cards={(message.metadata as any)?.cards || []}
                templateName={(message.metadata as any)?.templateName}
                isOwnMessage={isOwnMessage}
              />
            ) : (
              /* Template normal (não carousel) */
              <div>
                {/* Ícone e nome do template */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-[#e7f3ff] p-1.5 rounded">
                    <FileText className="w-4 h-4 text-[#027eb5]" />
                  </div>
                  <span className="text-[12px] text-[#667781]">
                    Template: {(message.metadata as any)?.templateName || 'Mensagem automática'}
                  </span>
                </div>

                {/* Conteúdo do template */}
                {message.content && (
                  <p className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap">
                    {message.content}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timestamp and Status */}
        <div className="flex items-center gap-1 justify-end mt-1 min-w-[60px]">
          <span
            className="text-[11px] text-[#667781]"
            style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
          >
            {(() => {
              const date = new Date(message.createdAt);
              return !date || isNaN(date.getTime()) ? '--:--' : format(date, 'HH:mm', { locale: ptBR });
            })()}
          </span>
          <StatusIcon />
        </div>
      </div>

      {/* Lightbox Modal para Imagens */}
      {lightboxOpen && mediaUrl && message.type === MessageType.IMAGE && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Toolbar */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Diminuir zoom"
            >
              <ZoomOut className="w-5 h-5 text-white" />
            </button>
            <span className="text-white text-sm min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-5 h-5 text-white" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ml-2"
              title="Baixar imagem"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors ml-2"
              title="Fechar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Imagem */}
          <div
            className="max-w-[90vw] max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={mediaUrl}
              alt="Imagem ampliada"
              className="transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />
          </div>

          {/* Caption */}
          {caption && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg max-w-[80vw]">
              <p className="text-white text-sm text-center">{caption}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
