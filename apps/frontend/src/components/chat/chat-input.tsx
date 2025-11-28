'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Smile, Paperclip, Mic, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function ChatInput({ onSendMessage, onTypingChange, disabled, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!message.trim() || disabled || isLoading) return;

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    onTypingChange?.(false);

    onSendMessage(message.trim());
    setMessage('');
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Typing indicator logic
    if (value.length > 0 && onTypingChange) {
      onTypingChange(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing after 2 seconds
      typingTimeoutRef.current = setTimeout(() => {
        onTypingChange(false);
      }, 2000);
    } else if (value.length === 0 && onTypingChange) {
      onTypingChange(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="h-[62px] bg-[#f0f2f5] px-2 sm:px-4 flex items-center gap-1 sm:gap-2">
      {/* Emoji Button - Hidden on very small screens */}
      <button
        type="button"
        className="hidden sm:block text-[#54656f] hover:text-[#111b21] transition-colors p-2"
        title="Emoji"
        disabled={disabled}
      >
        <Smile className="w-6 h-6" />
      </button>

      {/* Attachment Button */}
      <button
        type="button"
        className="text-[#54656f] hover:text-[#111b21] transition-colors p-2 rotate-45"
        title="Anexar arquivo"
        disabled={disabled}
      >
        <Paperclip className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-1 sm:gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem"
          disabled={disabled || isLoading}
          className={cn(
            "flex-1 h-10 px-3 sm:px-4 py-2 bg-white rounded-lg text-[14px] sm:text-[15px] text-[#111b21] placeholder:text-[#667781]",
            "border-none outline-none focus:outline-none",
            "disabled:bg-gray-100 disabled:cursor-not-allowed"
          )}
          style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
        />

        {message.trim() ? (
          <button
            type="submit"
            disabled={disabled || isLoading}
            className={cn(
              "text-[#54656f] hover:text-[#111b21] transition-colors p-2",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Enviar"
          >
            <Send className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        ) : (
          <button
            type="button"
            className="text-[#54656f] hover:text-[#111b21] transition-colors p-2"
            title="Mensagem de voz"
            disabled={disabled}
          >
            <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </form>
    </div>
  );
}
