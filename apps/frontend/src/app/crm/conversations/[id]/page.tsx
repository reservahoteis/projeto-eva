'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { conversationService } from '@/services/conversation.service'
import { messageService } from '@/services/message.service'
import { ContactSidebar } from '@/components/tenant/contact-sidebar'
import { ChatHeader } from '@/components/chat/chat-header'
import { MessageList } from '@/components/chat/message-list'
import { ChatInput } from '@/components/chat/chat-input'
import { useRouter } from 'next/navigation'
import { useSocketContext } from '@/contexts/socket-context'
import { useEffect, useState, useRef } from 'react'
import { Message, MessageType, UserRole } from '@/types'
import { toast } from 'sonner'
import { ProtectedRoute } from '@/components/layout/protected-route'

interface CrmConversationPageProps {
  params: { id: string }
}

function CrmConversationContent({ params }: CrmConversationPageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const {
    on, off,
    subscribeToConversation, unsubscribeFromConversation,
    isConnected, sendTypingStatus, isUserTyping,
    setActiveConversationId: setSocketActiveConversationId,
  } = useSocketContext()
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didMountRef = useRef(false)
  const conversationId = params.id

  // Stable handler refs (P0-3 fix)
  const handlersRef = useRef({
    handleNewMessage: null as ((data: any) => void) | null,
    handleConversationUpdate: null as ((data: any) => void) | null,
    handleMessageStatus: null as ((data: any) => void) | null,
  })

  const { data: conversation, isLoading: conversationLoading, isError: conversationError } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationService.getById(conversationId),
    staleTime: 30000,
    enabled: !!conversationId,
  })

  const { data: messagesData, isLoading: messagesLoading, isError: messagesError, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => messageService.list(conversationId, { limit: 100 }),
    staleTime: 30000,
    enabled: !!conversationId,
  })

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messageService.send({ conversationId, type: MessageType.TEXT, content }),
    onSuccess: () => toast.success('Mensagem enviada!'),
    onError: () => toast.error('Erro ao enviar mensagem'),
  })

  // Mark as read
  useEffect(() => {
    if (!conversationId || !conversation || conversation.unreadCount === 0) return
    const timeoutId = setTimeout(async () => {
      try {
        await conversationService.markAsRead(conversationId)
        queryClient.setQueryData(['conversations-sidebar'], (oldData: any) => {
          if (!oldData?.data) return oldData
          return {
            ...oldData,
            data: oldData.data.map((conv: any) =>
              conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
            ),
          }
        })
      } catch {}
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [conversationId, conversation?.unreadCount, queryClient])

  // Stable handlers
  useEffect(() => {
    handlersRef.current.handleNewMessage = (data: any) => {
      const message = data.message
      const conv = data.conversation
      const msgConvId = message?.conversationId || conv?.id || conversationId

      if (msgConvId === conversationId && message) {
        queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
          if (!oldData) return { data: [message], pagination: { page: 1, limit: 100, total: 1 } }
          if (oldData.data?.some((msg: Message) => msg.id === message.id)) return oldData
          return { ...oldData, data: [...(oldData.data || []), message] }
        })

        if (conv) {
          queryClient.setQueryData(['conversation', conversationId], (old: any) =>
            old ? { ...old, lastMessage: message, updatedAt: message.createdAt || new Date().toISOString() } : old
          )
        }

        if (message.direction === 'INBOUND') {
          conversationService.markAsRead(conversationId).catch(() => {})
          queryClient.setQueryData(['conversations-sidebar'], (oldData: any) => {
            if (!oldData?.data) return oldData
            return {
              ...oldData,
              data: oldData.data.map((c: any) =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
              ),
            }
          })
        }
      }
    }

    handlersRef.current.handleConversationUpdate = (data: { conversation: any }) => {
      if (!data?.conversation?.id) return
      if (data.conversation.id === conversationId) {
        queryClient.setQueryData(['conversation', conversationId], (old: any) =>
          old ? { ...old, ...data.conversation } : data.conversation
        )
      }
    }

    handlersRef.current.handleMessageStatus = (data: { messageId: string; status: string; errorInfo?: any }) => {
      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData) return oldData
        return {
          ...oldData,
          data: oldData.data.map((msg: Message) => {
            if (msg.id !== data.messageId) return msg
            const updated: any = { ...msg, status: data.status }
            if (data.status === 'FAILED' && data.errorInfo) {
              updated.metadata = { ...((msg.metadata as any) || {}), delivery: { error: data.errorInfo } }
            }
            return updated
          }),
        }
      })
    }
  }, [conversationId, queryClient])

  // Socket subscription
  useEffect(() => {
    if (!isConnected || !conversationId) return

    subscribeToConversation(conversationId)
    const newMsg = (data: any) => handlersRef.current.handleNewMessage?.(data)
    const convUpdate = (data: any) => handlersRef.current.handleConversationUpdate?.(data)
    const msgStatus = (data: any) => handlersRef.current.handleMessageStatus?.(data)

    on('message:new', newMsg)
    on('conversation:updated', convUpdate)
    on('message:status', msgStatus)

    return () => {
      unsubscribeFromConversation(conversationId)
      off('message:new', newMsg)
      off('conversation:updated', convUpdate)
      off('message:status', msgStatus)
    }
  }, [isConnected, conversationId, on, off, subscribeToConversation, unsubscribeFromConversation])

  // Refetch on reconnect (skip first mount)
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return }
    if (isConnected) refetchMessages()
  }, [isConnected, refetchMessages])

  const handleSendMessage = (content: string) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    sendTypingStatus(conversationId, false)
    setIsTyping(false)
    sendMutation.mutate(content)
  }

  const handleTypingChange = (typing: boolean) => {
    setIsTyping(typing)
    sendTypingStatus(conversationId, typing)
  }

  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (isTyping) sendTypingStatus(conversationId, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track active conversation
  useEffect(() => {
    setSocketActiveConversationId(conversationId)
    return () => setSocketActiveConversationId(null)
  }, [conversationId, setSocketActiveConversationId])

  const isLoading = conversationLoading || messagesLoading
  const isError = conversationError || messagesError

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center" style={{ backgroundColor: 'var(--surface-gray-1)' }}>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-7)' }}>Erro ao carregar conversa</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-gray-5)' }}>Verifique sua conexao e tente novamente</p>
          <button
            type="button"
            onClick={() => router.push('/crm/conversations')}
            className="mt-3 rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--surface-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !conversation) {
    return (
      <div className="flex h-full items-center justify-center" style={{ backgroundColor: 'var(--surface-gray-1)' }}>
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--ink-gray-5)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>Carregando conversa...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex flex-1 flex-col min-w-0 relative whatsapp-chat-bg xl:mr-[320px]">
        <div className="absolute inset-0 whatsapp-chat-pattern" />
        <div className="flex-shrink-0 relative z-10">
          <ChatHeader
            conversation={conversation}
            isOnline={false}
            isTyping={isUserTyping(conversationId)}
            isConnected={isConnected}
            onBack={() => router.push('/crm/conversations')}
          />
        </div>
        <div className="flex-1 overflow-hidden relative z-10">
          <MessageList
            messages={messagesData?.data || []}
            isTyping={isUserTyping(conversationId)}
            contactName={conversation.contact.name || conversation.contact.phoneNumber}
            contactAvatar={conversation.contact.profilePictureUrl}
          />
        </div>
        <div className="flex-shrink-0 relative z-10">
          <ChatInput
            onSendMessage={handleSendMessage}
            onTypingChange={handleTypingChange}
            disabled={!isConnected}
            isLoading={sendMutation.isPending}
          />
        </div>
      </div>

      {/* Contact sidebar */}
      <div className="hidden xl:block fixed right-0 top-0 h-full w-[320px] z-20">
        <ContactSidebar
          conversation={conversation}
          onIaLockChange={(locked) => {
            queryClient.setQueryData(['conversation', conversationId], (old: any) =>
              old ? { ...old, iaLocked: locked } : old
            )
          }}
          onArchive={() => router.push('/crm/conversations')}
          onDelete={() => router.push('/crm/conversations')}
        />
      </div>
    </div>
  )
}

export default function CrmConversationPage({ params }: CrmConversationPageProps) {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HEAD, UserRole.ATTENDANT, UserRole.SALES]}>
      <CrmConversationContent params={params} />
    </ProtectedRoute>
  )
}
