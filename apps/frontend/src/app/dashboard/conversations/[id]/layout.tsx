'use client';

import { ConversationListSidebar } from '@/components/chat/conversation-list-sidebar';
import { useParams } from 'next/navigation';

/**
 * Layout do Chat - Mantém sidebar SEMPRE montada
 * Isso preserva o scroll naturalmente ao trocar de conversa
 */
export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const activeConversationId = params?.id as string | undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* LEFT: Sidebar - SEMPRE montada */}
      <div className="hidden lg:block flex-shrink-0 border-r border-[#d1d7db]">
        <ConversationListSidebar activeConversationId={activeConversationId} />
      </div>

      {/* CENTER + RIGHT: Chat content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
