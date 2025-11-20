'use client';

interface TypingIndicatorProps {
  name: string;
}

export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start mb-2">
      <div
        className="bg-white rounded-lg px-4 py-3 shadow-sm max-w-[65%]"
        style={{
          boxShadow: '0 1px 0.5px rgba(0,0,0,.13)',
          borderRadius: '7.5px'
        }}
      >
        <div className="flex items-center gap-3">
          {/* Animated Dots */}
          <div className="flex gap-1">
            <div
              className="w-2 h-2 bg-[#667781] rounded-full animate-bounce"
              style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
            />
            <div
              className="w-2 h-2 bg-[#667781] rounded-full animate-bounce"
              style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
            />
            <div
              className="w-2 h-2 bg-[#667781] rounded-full animate-bounce"
              style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
            />
          </div>

          <span
            className="text-[13px] text-[#667781]"
            style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
          >
            {name} está digitando...
          </span>
        </div>
      </div>
    </div>
  );
}
