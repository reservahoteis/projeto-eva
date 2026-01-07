'use client';

import { ConversationListSidebar } from '@/components/chat/conversation-list-sidebar';
import { useChatStore } from '@/stores/chat-store';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Conversations Layout - Mantém sidebar SEMPRE montada
 *
 * ARQUITETURA SPA-LIKE:
 * - Sidebar NUNCA desmonta (preserva scroll naturalmente)
 * - Mudança de conversa via Zustand (sem router.push)
 * - Shallow routing para atualizar URL sem reload
 * - Transição INSTANTÂNEA (padrão WhatsApp Web)
 *
 * PERFORMANCE:
 * - Zero remontagens desnecessárias
 * - Scroll position preservado nativamente
 * - Sem tela branca entre conversas
 */
export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeConversationId, setActiveConversationId } = useChatStore();

  // Sincronizar URL com estado Zustand na montagem inicial
  useEffect(() => {
    const match = pathname.match(/\/conversations\/([^\/]+)/);
    if (match && match[1]) {
      const urlConversationId = match[1];
      if (urlConversationId !== activeConversationId) {
        setActiveConversationId(urlConversationId);
      }
    } else {
      // Rota /conversations sem ID - limpar estado
      setActiveConversationId(null);
    }
  }, [pathname, setActiveConversationId, activeConversationId]);

  // Atualizar URL quando conversa muda (shallow routing)
  useEffect(() => {
    if (!activeConversationId) return;

    const currentMatch = pathname.match(/\/conversations\/([^\/]+)/);
    const currentId = currentMatch?.[1];

    // Só atualizar URL se for diferente do atual
    if (currentId !== activeConversationId) {
      // Shallow routing - muda URL sem reload
      router.replace(`/dashboard/conversations/${activeConversationId}`, { scroll: false });
    }
  }, [activeConversationId, pathname, router]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT: Sidebar - SEMPRE montada (nunca desmonta) */}
      <div className="hidden lg:block flex-shrink-0">
        <ConversationListSidebar activeConversationId={activeConversationId || undefined} />
      </div>

      {/* RIGHT: Conteúdo da conversa */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
