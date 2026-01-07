import { create } from 'zustand';

interface ChatState {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

/**
 * Chat Store - Gerencia estado do chat sem navegação de página
 *
 * PROPÓSITO:
 * - Trocar conversas sem router.push() (SPA-like)
 * - Manter scroll da sidebar preservado
 * - Transição instantânea entre conversas
 * - Compatível com shallow routing do Next.js
 *
 * PADRÃO: WhatsApp Web - nunca recarrega a lista, apenas troca conteúdo
 */
export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
}));
