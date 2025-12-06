'use client';

import { useState } from 'react';
import { List, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ListSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

interface WhatsAppListMessageProps {
  header?: string;
  body: string;
  footer?: string;
  buttonLabel: string;
  sections: ListSection[];
  isOwnMessage: boolean;
}

/**
 * WhatsApp List Message Component
 * Replicates the exact iOS WhatsApp design for interactive list messages
 *
 * Design specifications (WhatsApp iOS 2024/2025):
 * - Border radius: 16px for cards, 8px for list items
 * - Colors:
 *   - List button: #00a884 (WhatsApp green)
 *   - Text: #111b21 (primary), #667781 (secondary)
 *   - Backgrounds: #ffffff (card), #f0f2f5 (list items)
 * - Shadows: subtle, layered
 * - Typography: System font stack (San Francisco on iOS, Segoe UI on Windows)
 */
export function WhatsAppListMessage({
  header,
  body,
  footer,
  buttonLabel,
  sections,
  isOwnMessage
}: WhatsAppListMessageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const bubbleColor = isOwnMessage ? 'bg-[#d9fdd3]' : 'bg-white';

  return (
    <>
      {/* Main message card */}
      <div className={cn('w-full', bubbleColor)}>
        {/* Header (optional) */}
        {header && (
          <div className="px-3 pt-2 pb-1">
            <p
              className="text-[15px] font-semibold text-[#111b21]"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
            >
              {header}
            </p>
          </div>
        )}

        {/* Body text */}
        <div className="px-3 py-2">
          <p
            className="text-[14px] text-[#111b21] break-words whitespace-pre-wrap leading-[1.4]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
          >
            {body}
          </p>
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className="px-3 pb-2">
            <p
              className="text-[12px] text-[#667781] leading-[1.3]"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
            >
              {footer}
            </p>
          </div>
        )}

        {/* List button - WhatsApp style */}
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg",
              "border border-[#00a884] bg-white",
              "text-[#00a884] font-medium text-[14px]",
              "hover:bg-[#f0f2f5] active:bg-[#e5ddd5]",
              "transition-colors duration-150",
              "shadow-sm"
            )}
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
            }}
          >
            <List className="w-4 h-4" />
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>

      {/* List modal - WhatsApp iOS bottom sheet style */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          onClick={() => setIsModalOpen(false)}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            style={{
              animation: 'fadeIn 0.2s ease-out'
            }}
          />

          {/* Modal content - bottom sheet on mobile, centered card on desktop */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full sm:w-[90%] sm:max-w-[460px]",
              "bg-white rounded-t-[20px] sm:rounded-[20px]",
              "max-h-[85vh] sm:max-h-[75vh]",
              "flex flex-col",
              "shadow-2xl"
            )}
            style={{
              animation: 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
              boxShadow: '0 -2px 20px rgba(0,0,0,0.15), 0 4px 40px rgba(0,0,0,0.2)'
            }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9edef]">
              <h3
                className="text-[17px] font-semibold text-[#111b21]"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
              >
                {header || 'Selecione uma opção'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-[#f0f2f5] active:bg-[#e5ddd5] transition-colors"
              >
                <X className="w-5 h-5 text-[#667781]" />
              </button>
            </div>

            {/* Scrollable list content */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {sections.map((section, sectionIdx) => (
                <div key={sectionIdx} className="mb-3 last:mb-0">
                  {/* Section title */}
                  {section.title && (
                    <div className="px-3 py-2">
                      <p
                        className="text-[13px] font-medium text-[#667781] uppercase tracking-wide"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
                      >
                        {section.title}
                      </p>
                    </div>
                  )}

                  {/* List items */}
                  <div className="space-y-1">
                    {section.rows.map((row, rowIdx) => (
                      <div
                        key={row.id || rowIdx}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 rounded-lg",
                          "bg-[#f7f8fa] hover:bg-[#e9edef] active:bg-[#d1d7db]",
                          "transition-colors duration-150 cursor-pointer",
                          "border border-transparent hover:border-[#d1d7db]"
                        )}
                        onClick={() => {
                          // In real app, this would trigger selection action
                          console.log('Selected:', row.id, row.title);
                          setIsModalOpen(false);
                        }}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p
                            className="text-[15px] font-medium text-[#111b21] truncate"
                            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
                          >
                            {row.title}
                          </p>
                          {row.description && (
                            <p
                              className="text-[13px] text-[#667781] mt-0.5 line-clamp-2"
                              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
                            >
                              {row.description}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#8696a0] flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (min-width: 640px) {
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        }
      `}</style>
    </>
  );
}
