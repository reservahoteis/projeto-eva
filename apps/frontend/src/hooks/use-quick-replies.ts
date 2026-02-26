import { useState, useCallback, useMemo, KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { quickReplyService } from '@/services/quick-reply.service';
import type { QuickReply } from '@/types';

interface UseQuickRepliesReturn {
  isOpen: boolean;
  filteredReplies: QuickReply[];
  selectedIndex: number;
  filterText: string;
  handleInputChange: (value: string, cursorPosition: number) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => QuickReply | null;
  close: () => void;
}

/**
 * Hook para o popup de respostas rapidas ativado via slash-command no chat.
 *
 * Usage:
 *   const qr = useQuickReplies();
 *   // In input onChange: qr.handleInputChange(value, e.target.selectionStart ?? value.length)
 *   // In input onKeyDown: const selected = qr.handleKeyDown(e); if (selected) applyReply(selected)
 *   // Render: {qr.isOpen && <QuickReplyPopup replies={qr.filteredReplies} ... />}
 */
export function useQuickReplies(): UseQuickRepliesReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Busca todas as respostas rapidas ativas, com cache de 5 minutos
  const { data } = useQuery({
    queryKey: ['quick-replies', 'active'],
    queryFn: async () => {
      const response = await quickReplyService.list({ isActive: true });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,   // 10 minutos no cache
  });

  const allReplies = data ?? [];

  // Filtra por shortcut ou title, correspondendo ao texto apos a /
  const filteredReplies = useMemo(() => {
    if (!filterText) {
      return allReplies
        .filter((r) => r.isActive)
        .sort((a, b) => a.order - b.order);
    }

    const lower = filterText.toLowerCase();
    return allReplies
      .filter(
        (r) =>
          r.isActive &&
          (r.shortcut.toLowerCase().includes(lower) ||
            r.title.toLowerCase().includes(lower))
      )
      .sort((a, b) => a.order - b.order);
  }, [allReplies, filterText]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFilterText('');
    setSelectedIndex(0);
  }, []);

  /**
   * Detecta se o usuario digitou / e extrai o texto de filtro.
   * A / deve estar no inicio da mensagem ou logo apos um espaco.
   * O filtro nao pode conter espacos (cada palavra seria um novo token).
   */
  const handleInputChange = useCallback(
    (value: string, cursorPosition: number) => {
      // Pega somente o texto antes do cursor
      const textBeforeCursor = value.substring(0, cursorPosition);

      // Encontra o ultimo / antes do cursor que esteja no inicio ou apos espaco
      const slashMatch = textBeforeCursor.match(/(^|\s)\/(\S*)$/);

      if (slashMatch) {
        const filter = slashMatch[2] ?? '';
        setFilterText(filter);
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        if (isOpen) {
          close();
        }
      }
    },
    [isOpen, close]
  );

  /**
   * Navegacao por teclado no popup:
   * - ArrowDown: proximo item
   * - ArrowUp: item anterior
   * - Enter ou Tab: seleciona item atual e retorna o QuickReply
   * - Escape: fecha o popup
   *
   * Retorna o QuickReply selecionado (Enter/Tab) ou null para outros casos.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): QuickReply | null => {
      if (!isOpen || filteredReplies.length === 0) {
        return null;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredReplies.length - 1 ? prev + 1 : 0
        );
        return null;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredReplies.length - 1
        );
        return null;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const selected = filteredReplies[selectedIndex];
        if (selected) {
          e.preventDefault();
          close();
          return selected;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return null;
      }

      return null;
    },
    [isOpen, filteredReplies, selectedIndex, close]
  );

  return {
    isOpen,
    filteredReplies,
    selectedIndex,
    filterText,
    handleInputChange,
    handleKeyDown,
    close,
  };
}
