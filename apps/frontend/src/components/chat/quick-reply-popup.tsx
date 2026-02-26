'use client';

/**
 * QuickReplyPopup
 *
 * Popup de respostas rapidas ativado via slash-command no chat.
 * Aparece acima do input quando o usuario digita /.
 *
 * Usage:
 *   <QuickReplyPopup
 *     replies={filteredReplies}
 *     selectedIndex={selectedIndex}
 *     filterText={filterText}
 *     onSelect={(reply) => applyReply(reply)}
 *   />
 */

import { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuickReply } from '@/types';

interface QuickReplyPopupProps {
  replies: QuickReply[];
  selectedIndex: number;
  filterText: string;
  onSelect: (reply: QuickReply) => void;
}

// Agrupa respostas por categoria mantendo ordem de insercao
function groupByCategory(replies: QuickReply[]): Map<string, QuickReply[]> {
  const groups = new Map<string, QuickReply[]>();

  for (const reply of replies) {
    const key = reply.category ?? 'Geral';
    const existing = groups.get(key);
    if (existing) {
      existing.push(reply);
    } else {
      groups.set(key, [reply]);
    }
  }

  return groups;
}

// Verifica se existem multiplas categorias distintas
function checkHasMultipleCategories(replies: QuickReply[]): boolean {
  if (replies.length === 0) return false;
  const firstCategory = replies[0]?.category ?? 'Geral';
  return replies.some((r) => (r.category ?? 'Geral') !== firstCategory);
}

// Constroi um Map de id -> indice global para correlacionar selectedIndex
function buildIndexMap(replies: QuickReply[]): Map<string, number> {
  const map = new Map<string, number>();
  replies.forEach((reply, index) => {
    map.set(reply.id, index);
  });
  return map;
}

export function QuickReplyPopup({
  replies,
  selectedIndex,
  filterText,
  onSelect,
}: QuickReplyPopupProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll para manter o item selecionado visivel
  useEffect(() => {
    if (selectedRef.current && listRef.current) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (replies.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Respostas rapidas"
        className="absolute bottom-full left-0 right-0 mb-1 mx-2 sm:mx-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
          <Zap className="w-4 h-4 text-[#00a884]" aria-hidden="true" />
          <span className="text-[12px] font-semibold text-[#667781] uppercase tracking-wide">
            Respostas Rapidas
          </span>
        </div>

        {/* Estado vazio */}
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] text-[#667781]">
            Nenhuma resposta rapida encontrada
            {filterText && (
              <>
                {' '}para{' '}
                <span className="font-mono font-medium text-[#111b21]">/{filterText}</span>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  const groups = groupByCategory(replies);
  const showCategories = checkHasMultipleCategories(replies);
  const indexMap = buildIndexMap(replies);

  return (
    <div
      role="listbox"
      aria-label="Respostas rapidas"
      aria-activedescendant={`quick-reply-item-${selectedIndex}`}
      className="absolute bottom-full left-0 right-0 mb-1 mx-2 sm:mx-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <Zap className="w-4 h-4 text-[#00a884]" aria-hidden="true" />
        <span className="text-[12px] font-semibold text-[#667781] uppercase tracking-wide">
          Respostas Rapidas
        </span>
        <span className="ml-auto text-[11px] text-[#667781]">
          {replies.length} {replies.length === 1 ? 'resultado' : 'resultados'}
        </span>
      </div>

      {/* Lista com scroll */}
      <div
        ref={listRef}
        className="max-h-[230px] overflow-y-auto overscroll-contain"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}
      >
        {Array.from(groups.entries()).map(([category, categoryReplies]) => (
          <div key={category}>
            {/* Cabecalho de categoria (so exibe quando ha multiplas categorias) */}
            {showCategories && (
              <div
                role="presentation"
                className="px-3 py-1 bg-[#f0f2f5] border-b border-gray-100"
              >
                <span className="text-[11px] font-semibold text-[#667781] uppercase tracking-wide">
                  {category}
                </span>
              </div>
            )}

            {/* Itens da categoria */}
            {categoryReplies.map((reply) => {
              const globalIndex = indexMap.get(reply.id) ?? 0;
              const isSelected = globalIndex === selectedIndex;

              return (
                <button
                  key={reply.id}
                  ref={isSelected ? selectedRef : undefined}
                  id={`quick-reply-item-${globalIndex}`}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => onSelect(reply)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-b-0',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-inset',
                    isSelected
                      ? 'bg-[#f0f2f5]'
                      : 'hover:bg-[#f0f2f5]/50'
                  )}
                >
                  {/* Icone de atalho — muda de cor quando selecionado */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex-shrink-0 mt-0.5 w-7 h-7 rounded flex items-center justify-center',
                      'text-[13px] font-mono font-bold',
                      isSelected
                        ? 'bg-[#00a884] text-white'
                        : 'bg-[#f0f2f5] text-[#667781]'
                    )}
                  >
                    /
                  </span>

                  {/* Titulo, atalho e preview do conteudo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium leading-tight truncate text-[#111b21]">
                        {reply.title}
                      </span>
                      <span className="flex-shrink-0 text-[11px] font-mono text-[#667781]">
                        /{reply.shortcut}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#667781] leading-tight mt-0.5 line-clamp-1">
                      {reply.content.length > 80
                        ? reply.content.substring(0, 80) + '...'
                        : reply.content}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer com dicas de atalhos de teclado */}
      <div
        role="presentation"
        className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-3"
      >
        <span className="text-[11px] text-[#667781]">
          <kbd className="font-mono bg-[#f0f2f5] px-1 rounded text-[10px]">↑↓</kbd>
          {' '}navegar
        </span>
        <span className="text-[11px] text-[#667781]">
          <kbd className="font-mono bg-[#f0f2f5] px-1 rounded text-[10px]">Enter</kbd>
          {' '}selecionar
        </span>
        <span className="text-[11px] text-[#667781]">
          <kbd className="font-mono bg-[#f0f2f5] px-1 rounded text-[10px]">Esc</kbd>
          {' '}fechar
        </span>
      </div>
    </div>
  );
}
