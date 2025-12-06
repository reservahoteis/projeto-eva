'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CarouselCard {
  imageUrl?: string;
  bodyParams?: string[];
  buttonPayloads?: string[];
}

interface WhatsAppCarouselMessageProps {
  cards: CarouselCard[];
  templateName?: string;
  isOwnMessage: boolean;
}

/**
 * WhatsApp Carousel Message Component
 * Replicates the exact iOS WhatsApp design for carousel template messages
 *
 * Design specifications (WhatsApp iOS 2024/2025):
 * - Horizontal scrolling cards with snap-to-center
 * - Card dimensions: max-width 280px, image aspect ratio 1:1
 * - Border radius: 12px for cards, 8px for images
 * - Colors:
 *   - Card background: #ffffff
 *   - Button: #00a884 or #027eb5 (action buttons)
 *   - Navigation: subtle arrows with touch-friendly hit areas
 * - Smooth scroll behavior with momentum
 * - Pagination dots at bottom
 */
export function WhatsAppCarouselMessage({
  cards,
  templateName,
  isOwnMessage
}: WhatsAppCarouselMessageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Handle scroll to update current index
  const handleScroll = () => {
    if (!scrollContainerRef.current || isDragging) return;

    const container = scrollContainerRef.current;
    const cardWidth = container.children[0]?.clientWidth || 0;
    const scrollLeft = container.scrollLeft;
    const index = Math.round(scrollLeft / cardWidth);

    setCurrentIndex(index);
  };

  // Scroll to specific card
  const scrollToCard = (index: number) => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const cardWidth = container.children[0]?.clientWidth || 0;
    const scrollPosition = index * cardWidth;

    container.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });

    setCurrentIndex(index);
  };

  // Mouse/touch drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startXRef.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    scrollLeftRef.current = scrollContainerRef.current?.scrollLeft || 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;

    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
    const walk = (x - startXRef.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startXRef.current = e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0);
    scrollLeftRef.current = scrollContainerRef.current?.scrollLeft || 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;

    const x = e.touches[0].pageX - (scrollContainerRef.current.offsetLeft || 0);
    const walk = (x - startXRef.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    handleScroll();
  };

  // Snap to nearest card on scroll end
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    const handleScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const cardWidth = container.children[0]?.clientWidth || 0;
        const scrollLeft = container.scrollLeft;
        const index = Math.round(scrollLeft / cardWidth);
        scrollToCard(index);
      }, 100);
    };

    container.addEventListener('scroll', handleScrollEnd);
    return () => {
      container.removeEventListener('scroll', handleScrollEnd);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const bubbleColor = isOwnMessage ? 'bg-[#d9fdd3]' : 'bg-white';

  return (
    <div className={cn('w-full', bubbleColor, 'rounded-lg overflow-hidden')}>
      {/* Template name header (optional) */}
      {templateName && (
        <div className="px-3 pt-2 pb-1 bg-[#f0f2f5]/50">
          <p
            className="text-[11px] text-[#667781] uppercase tracking-wide"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
          >
            Carousel: {templateName}
          </p>
        </div>
      )}

      {/* Carousel container */}
      <div className="relative px-2 py-3">
        {/* Navigation arrows - desktop only */}
        {cards.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollToCard(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className={cn(
                "hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10",
                "w-8 h-8 items-center justify-center rounded-full",
                "bg-white/95 shadow-lg",
                "text-[#111b21] hover:bg-white",
                "transition-all duration-200",
                "disabled:opacity-0 disabled:pointer-events-none"
              )}
              style={{
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => scrollToCard(Math.min(cards.length - 1, currentIndex + 1))}
              disabled={currentIndex === cards.length - 1}
              className={cn(
                "hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10",
                "w-8 h-8 items-center justify-center rounded-full",
                "bg-white/95 shadow-lg",
                "text-[#111b21] hover:bg-white",
                "transition-all duration-200",
                "disabled:opacity-0 disabled:pointer-events-none"
              )}
              style={{
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Scrollable cards container */}
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onScroll={handleScroll}
          className={cn(
            "flex gap-3 overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide",
            "px-1 pb-1 pt-1",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{
            scrollBehavior: isDragging ? 'auto' : 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              className="flex-shrink-0 snap-center w-[280px] sm:w-[300px]"
            >
              {/* Card - WhatsApp style */}
              <div
                className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200"
                style={{
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)'
                }}
              >
                {/* Card image */}
                {card.imageUrl && (
                  <div className="relative w-full aspect-square bg-[#f0f2f5]">
                    <img
                      src={card.imageUrl}
                      alt={`Card ${index + 1}`}
                      className="w-full h-full object-cover"
                      draggable={false}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* Image overlay with card counter */}
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
                      <span
                        className="text-white text-[11px] font-medium"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
                      >
                        {index + 1} / {cards.length}
                      </span>
                    </div>
                  </div>
                )}

                {/* Card content */}
                <div className="p-4">
                  {/* Body text */}
                  {card.bodyParams && card.bodyParams[0] && (
                    <p
                      className="text-[14px] text-[#111b21] mb-3 line-clamp-3 leading-[1.4]"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
                    >
                      {card.bodyParams[0]}
                    </p>
                  )}

                  {/* Action buttons */}
                  {card.buttonPayloads && card.buttonPayloads.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {card.buttonPayloads.map((payload, btnIdx) => {
                        const isUrl = payload.startsWith('http') || payload.startsWith('?');

                        return (
                          <button
                            key={btnIdx}
                            type="button"
                            className={cn(
                              "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg",
                              "text-[13px] font-medium",
                              "transition-colors duration-150",
                              isUrl
                                ? "bg-[#027eb5] text-white hover:bg-[#026a99] active:bg-[#025580]"
                                : "bg-[#e7f3ff] text-[#027eb5] hover:bg-[#d0e8ff] active:bg-[#b8dcff] border border-[#027eb5]/20"
                            )}
                            style={{
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Button clicked:', payload);
                            }}
                          >
                            {isUrl ? (
                              <>
                                <ExternalLink className="w-4 h-4" />
                                <span>Ver mais</span>
                              </>
                            ) : (
                              <span>{payload}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination dots */}
        {cards.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3 pb-1">
            {cards.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollToCard(index)}
                className={cn(
                  "rounded-full transition-all duration-200",
                  index === currentIndex
                    ? "w-6 h-1.5 bg-[#00a884]"
                    : "w-1.5 h-1.5 bg-[#d1d7db] hover:bg-[#8696a0]"
                )}
                aria-label={`Go to card ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
