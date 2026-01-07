'use client';

import { usePathname } from 'next/navigation';
import { ConversationListSidebar } from '@/components/chat/conversation-list-sidebar';

/**
 * Layout para área de conversas
 *
 * Mantém o sidebar SEMPRE montado para:
 * - Preservar scroll position
 * - Evitar re-renders desnecessários
 * - Transição instantânea tipo WhatsApp Web
 */
export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Extrair ID da conversa da URL
  const conversationIdMatch = pathname.match(/\/dashboard\/conversations\/([^/]+)/);
  const activeConversationId = conversationIdMatch?.[1];

  // Detectar se estamos na página de chat (tem ID) ou kanban (sem ID)
  const isInChatView = !!activeConversationId;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT: Conversation List Sidebar - SEMPRE montado quando em chat view */}
      {isInChatView && (
        <div className="hidden lg:block flex-shrink-0">
          <ConversationListSidebar activeConversationId={activeConversationId} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
