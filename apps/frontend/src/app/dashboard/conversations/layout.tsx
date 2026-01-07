'use client';

import { ConversationListSidebar } from '@/components/chat/conversation-list-sidebar';
import { useParams } from 'next/navigation';

/**
 * Conversations Layout - Mantém sidebar SEMPRE montada
 *
 * ARQUITETURA:
 * - Sidebar NUNCA desmonta (preserva scroll naturalmente)
 * - Navegação via router.push padrão do Next.js
 * - Simples e confiável
 */
export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const activeConversationId = params?.id as string | undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT: Sidebar - SEMPRE montada (nunca desmonta) */}
      <div className="hidden lg:block flex-shrink-0">
        <ConversationListSidebar activeConversationId={activeConversationId} />
      </div>

      {/* RIGHT: Conteúdo da conversa */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
