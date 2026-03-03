'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { conversationService } from '@/services/conversation.service'
import { Conversation, ConversationStatus } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, MessageSquare, Bot, Building2 } from 'lucide-react'
import { getInitials, formatTime } from '@/lib/utils'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocketContext } from '@/contexts/socket-context'
import Link from 'next/link'

interface CrmConversationListProps {
  activeConversationId?: string
}

const STATUS_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: ConversationStatus.OPEN, label: 'Aberto' },
  { key: ConversationStatus.IN_PROGRESS, label: 'Em andamento' },
  { key: ConversationStatus.WAITING, label: 'Aguardando' },
  { key: ConversationStatus.CLOSED, label: 'Fechado' },
] as const

export function CrmConversationList({ activeConversationId }: CrmConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { on, off, isConnected } = useSocketContext()
  const queryClient = useQueryClient()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef<number>(0)

  const { data: conversationsData, refetch } = useQuery({
    queryKey: ['conversations-sidebar'],
    queryFn: () => conversationService.list({ limit: 50 }),
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  const saveScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop
    }
  }, [])

  const restoreScrollPosition = useCallback(() => {
    if (scrollContainerRef.current && scrollPositionRef.current > 0) {
      scrollContainerRef.current.scrollTop = scrollPositionRef.current
    }
  }, [])

  // Real-time updates via Socket.io
  useEffect(() => {
    if (!isConnected) return

    const handleUpdate = () => {
      saveScrollPosition()
      refetch().then(() => {
        requestAnimationFrame(restoreScrollPosition)
      })
    }

    on('conversation:new', handleUpdate)
    on('conversation:updated', handleUpdate)
    on('message:new', handleUpdate)

    return () => {
      off('conversation:new', handleUpdate)
      off('conversation:updated', handleUpdate)
      off('message:new', handleUpdate)
    }
  }, [isConnected, on, off, refetch, saveScrollPosition, restoreScrollPosition])

  // Track scroll position
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      scrollPositionRef.current = container.scrollTop
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const conversations = conversationsData?.data || []

  // Filter by search + status
  const filteredConversations = conversations.filter((conv) => {
    if (statusFilter !== 'all' && conv.status !== statusFilter) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      conv.contact.name?.toLowerCase().includes(q) ||
      conv.contact.phoneNumber?.includes(searchQuery)
    )
  })

  // Sort: unread first, then by lastMessageAt
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if ((a.unreadCount || 0) > 0 && (b.unreadCount || 0) === 0) return -1
    if ((a.unreadCount || 0) === 0 && (b.unreadCount || 0) > 0) return 1
    return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
  })

  // Prefetch on hover
  const prefetchConversation = useCallback((conversationId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['conversation', conversationId],
      queryFn: () => conversationService.getById(conversationId),
      staleTime: 30000,
    })
  }, [queryClient])

  const getStatusDot = (status: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.OPEN:
        return 'var(--yellow-500, #eab308)'
      case ConversationStatus.IN_PROGRESS:
        return 'var(--blue-500, #3b82f6)'
      case ConversationStatus.WAITING:
        return 'var(--purple-500, #a855f7)'
      case ConversationStatus.CLOSED:
        return 'var(--ink-gray-4, #8d99a6)'
      default:
        return 'var(--ink-gray-4, #8d99a6)'
    }
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ backgroundColor: 'var(--surface-white, #fff)' }}>
      {/* Header — Frappe LayoutHeader pattern */}
      <div
        className="flex h-[46px] items-center justify-between px-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
      >
        <h2
          className="text-lg font-semibold leading-none"
          style={{ color: 'var(--ink-gray-9)' }}
        >
          Conversas
        </h2>
        {conversations.length > 0 && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--surface-gray-2)',
              color: 'var(--ink-gray-6)',
            }}
          >
            {conversations.length}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--outline-gray-1)' }}>
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <input
            type="text"
            placeholder="Pesquisar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md py-1.5 pl-8 pr-3 text-sm outline-none transition-colors"
            style={{
              backgroundColor: 'var(--surface-gray-1)',
              color: 'var(--ink-gray-8)',
              border: '1px solid var(--outline-gray-1)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--outline-gray-3)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--outline-gray-1)'
            }}
          />
        </div>
      </div>

      {/* Status filter pills */}
      <div
        className="flex gap-1 overflow-x-auto px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: statusFilter === filter.key ? 'var(--surface-selected)' : 'transparent',
              color: statusFilter === filter.key ? 'var(--ink-gray-9)' : 'var(--ink-gray-5)',
              boxShadow: statusFilter === filter.key
                ? '0px 0px 1px rgba(0,0,0,0.45), 0px 1px 2px rgba(0,0,0,0.1)'
                : undefined,
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <MessageSquare
              className="h-10 w-10 mb-3"
              style={{ color: 'var(--ink-gray-4)' }}
            />
            <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa'}
            </p>
          </div>
        ) : (
          sortedConversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              onMouseEnter={() => prefetchConversation(conversation.id)}
              statusDotColor={getStatusDot(conversation.status)}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ConversationCardProps {
  conversation: Conversation
  isActive: boolean
  onMouseEnter?: () => void
  statusDotColor: string
}

function ConversationCard({ conversation, isActive, onMouseEnter, statusDotColor }: ConversationCardProps) {
  const lastMessageContent = conversation.lastMessage?.content || ''
  const truncated = lastMessageContent.length > 45
    ? lastMessageContent.substring(0, 45) + '...'
    : lastMessageContent

  return (
    <Link
      href={`/crm/conversations/${conversation.id}`}
      prefetch={true}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
      style={{
        backgroundColor: isActive ? 'var(--surface-selected)' : undefined,
        borderBottom: '1px solid var(--outline-gray-1)',
      }}
      onMouseOver={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
      }}
      onMouseOut={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = ''
      }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          {conversation.contact.profilePictureUrl && (
            <AvatarImage
              src={conversation.contact.profilePictureUrl}
              alt={conversation.contact.name || 'Contato'}
            />
          )}
          <AvatarFallback
            className="text-xs font-medium"
            style={{
              backgroundColor: 'var(--surface-gray-3)',
              color: 'var(--ink-gray-7)',
            }}
          >
            {getInitials(conversation.contact.name || conversation.contact.phoneNumber)}
          </AvatarFallback>
        </Avatar>
        {/* Status dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor: statusDotColor,
            border: '2px solid var(--surface-white, #fff)',
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className="text-sm font-medium truncate"
            style={{ color: 'var(--ink-gray-9)' }}
          >
            {conversation.contact.name || conversation.contact.phoneNumber}
          </span>
          <span
            className="text-[11px] flex-shrink-0 ml-2"
            style={{ color: 'var(--ink-gray-5)' }}
          >
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {conversation.iaLocked && (
              <Bot className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
            )}
            <span
              className="text-xs truncate"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              {truncated || '[Sem mensagens]'}
            </span>
          </div>

          {(conversation.unreadCount || 0) > 0 && (
            <span
              className="ml-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
              style={{ backgroundColor: 'var(--blue-500, #3b82f6)' }}
            >
              {conversation.unreadCount}
            </span>
          )}
        </div>

        {/* Hotel unit tag */}
        {conversation.hotelUnit && (
          <div className="flex items-center gap-1 mt-1">
            <span
              className="inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium"
              style={{
                backgroundColor: 'var(--surface-gray-2)',
                color: 'var(--ink-gray-6)',
              }}
            >
              <Building2 className="h-2.5 w-2.5 mr-0.5" />
              {conversation.hotelUnit}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
