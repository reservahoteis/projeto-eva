'use client'

import { usePathname } from 'next/navigation'
import { CrmConversationList } from '@/components/crm/crm-conversation-list'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { UserRole } from '@/types'

export default function CrmConversationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const conversationIdMatch = pathname.match(/\/crm\/conversations\/([^/]+)/)
  const activeConversationId = conversationIdMatch?.[1]
  const isInChatView = !!activeConversationId

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HEAD, UserRole.ATTENDANT, UserRole.SALES]}>
      <div className="flex h-full overflow-hidden">
        {/* Conversation list — hidden on mobile when chat is open */}
        <div
          className={
            isInChatView
              ? 'hidden lg:block lg:w-[320px] flex-shrink-0 h-full'
              : 'w-full lg:w-[320px] flex-shrink-0 h-full'
          }
          style={{ borderRight: '1px solid var(--outline-gray-1)' }}
        >
          <CrmConversationList activeConversationId={activeConversationId} />
        </div>

        {/* Chat area or empty state */}
        <div
          className={
            !isInChatView
              ? 'hidden lg:flex flex-1 min-w-0'
              : 'flex-1 min-w-0'
          }
        >
          {children}
        </div>
      </div>
    </ProtectedRoute>
  )
}
