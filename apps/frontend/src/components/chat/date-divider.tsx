'use client';

import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DateDividerProps {
  date: Date;
}

export function DateDivider({ date }: DateDividerProps) {
  const getDateLabel = () => {
    if (isToday(date)) {
      return 'HOJE';
    }
    if (isYesterday(date)) {
      return 'ONTEM';
    }
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }).toUpperCase();
  };

  return (
    <div className="flex items-center justify-center my-4">
      <div
        className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-md shadow-sm"
        style={{ boxShadow: '0 1px 0.5px rgba(0,0,0,.13)' }}
      >
        <span
          className="text-[12px] font-medium text-[#54656f]"
          style={{ fontFamily: 'Segoe UI, Helvetica Neue, sans-serif' }}
        >
          {getDateLabel()}
        </span>
      </div>
    </div>
  );
}
