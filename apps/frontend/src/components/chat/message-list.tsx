'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Message, MessageDirection } from '@/types';
import { MessageBubble } from './message-bubble';
import { DateDivider } from './date-divider';
import { TypingIndicator } from './typing-indicator';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
  isTyping?: boolean;
  contactName: string;
  contactAvatar?: string;
}

export function MessageList({ messages, isTyping, contactName, contactAvatar }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom('smooth');
    }
  }, [messages, isAtBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show button if scrolled up more than 300px from bottom
    setShowScrollButton(distanceFromBottom > 300);

    // Update isAtBottom state (within 100px of bottom)
    setIsAtBottom(distanceFromBottom < 100);
  };

  // [P0-2 FIX] Memoize groupedMessages to prevent expensive recalculation on every render
  // This reduces unnecessary Date parsing and array operations
  const groupedMessages = useMemo(() => {
    return messages.reduce((acc, message, index) => {
      const prevMessage = messages[index - 1];
      const nextMessage = messages[index + 1];

      // Check if we need a date divider
      const showDateDivider = !prevMessage ||
        new Date(message.createdAt).toDateString() !== new Date(prevMessage.createdAt).toDateString();

      // Check if this message should show avatar (first in group)
      const showAvatar = !prevMessage ||
        prevMessage.direction !== message.direction ||
        new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 5 * 60 * 1000; // 5 minutes

      // Check if grouped with next message
      const groupedWithNext = nextMessage &&
        nextMessage.direction === message.direction &&
        new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime() < 5 * 60 * 1000;

      return [
        ...acc,
        {
          message,
          showDateDivider,
          showAvatar,
          groupedWithNext: !!groupedWithNext
        }
      ];
    }, [] as Array<{
      message: Message;
      showDateDivider: boolean;
      showAvatar: boolean;
      groupedWithNext: boolean;
    }>);
  }, [messages]); // Only recalculate when messages array changes

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto px-4 py-3"
      style={{
        backgroundColor: '#e5ddd5',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d7db' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p
              className="text-[14px] text-[#667781]"
              style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
            >
              Nenhuma mensagem ainda
            </p>
            <p
              className="text-[13px] text-[#8696a0] mt-1"
              style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
            >
              Envie uma mensagem para iniciar a conversa
            </p>
          </div>
        </div>
      ) : (
        <>
          {groupedMessages.map(({ message, showDateDivider, showAvatar, groupedWithNext }) => (
            <div key={message.id} className="w-full">
              {showDateDivider && (
                <DateDivider date={new Date(message.createdAt)} />
              )}
              <MessageBubble
                message={message}
                isOwnMessage={message.direction === MessageDirection.OUTBOUND}
                showAvatar={showAvatar}
                groupedWithNext={groupedWithNext}
                contactName={contactName}
                contactAvatar={contactAvatar}
              />
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <TypingIndicator name={contactName} />
          )}
        </>
      )}

      <div ref={messagesEndRef} />

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className={cn(
            "sticky bottom-4 left-full -translate-x-16 w-11 h-11 rounded-full",
            "bg-white shadow-lg flex items-center justify-center",
            "text-[#54656f] hover:text-[#111b21]",
            "transition-all duration-300 hover:scale-110",
            "z-10"
          )}
          style={{
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
          title="Rolar para baixo"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
