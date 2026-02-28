'use client'

// Channel tab — renders a messaging channel conversation inline in the detail page.
// Supported channels: WhatsApp, Messenger, Instagram (real data via phone lookup).
// Placeholder channels: iMessage, Booking, Airbnb (coming soon).
//
// The phone number bridge: CRM entity `mobile_no` <-> WhatsApp Contact `phoneNumber`.
// When a conversation is found, messages are rendered with real-time Socket.io updates.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { conversationService } from '@/services/conversation.service'
import { messageService } from '@/services/message.service'
import { useSocketContext } from '@/contexts/socket-context'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageCircle,
  MessageSquare,
  Instagram,
  Apple,
  BedDouble,
  Plane,
  Send,
  RefreshCw,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { MessageType } from '@/types'
import type { Message, Conversation } from '@/types'

// ============================================
// CHANNEL CONFIG
// ============================================

type ChannelType = 'whatsapp' | 'messenger' | 'instagram' | 'imessage' | 'booking' | 'airbnb'

interface ChannelConfig {
  label: string
  icon: React.ElementType
  color: string
  available: boolean
}

const CHANNEL_CONFIG: Record<ChannelType, ChannelConfig> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: '#25D366', available: true },
  messenger: { label: 'Messenger', icon: MessageSquare, color: '#0084FF', available: true },
  instagram: { label: 'Instagram', icon: Instagram, color: '#E4405F', available: true },
  imessage: { label: 'iMessage', icon: Apple, color: '#34C759', available: false },
  booking: { label: 'Booking', icon: BedDouble, color: '#003580', available: false },
  airbnb: { label: 'Airbnb', icon: Plane, color: '#FF5A5F', available: false },
}

// ============================================
// TYPES
// ============================================

interface ChannelTabProps {
  channel: ChannelType
  phoneNumber?: string | null
  entityName?: string
}

// ============================================
// MESSAGE BUBBLE (simplified for inline view)
// ============================================

function InlineMessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'OUTBOUND'
  const time = format(new Date(message.createdAt), 'HH:mm', { locale: ptBR })

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div
        className="max-w-[75%] rounded-lg px-3 py-1.5"
        style={{
          backgroundColor: isOutbound ? 'var(--surface-gray-7)' : 'var(--surface-gray-1)',
          color: isOutbound ? '#fff' : 'var(--ink-gray-9)',
          border: isOutbound ? 'none' : '1px solid var(--outline-gray-1)',
        }}
      >
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}
        {message.mediaUrl && !message.content && (
          <p className="text-sm italic" style={{ opacity: 0.7 }}>
            [Midia]
          </p>
        )}
        <p
          className="text-right mt-0.5"
          style={{
            fontSize: '10px',
            color: isOutbound ? 'rgba(255,255,255,0.7)' : 'var(--ink-gray-4)',
          }}
        >
          {time}
          {isOutbound && message.status === 'READ' && ' \u2713\u2713'}
          {isOutbound && message.status === 'DELIVERED' && ' \u2713\u2713'}
          {isOutbound && message.status === 'SENT' && ' \u2713'}
        </p>
      </div>
    </div>
  )
}

// ============================================
// DATE DIVIDER
// ============================================

function InlineDateDivider({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-3">
      <span
        className="px-3 py-0.5 rounded-full"
        style={{
          fontSize: '11px',
          color: 'var(--ink-gray-5)',
          backgroundColor: 'var(--surface-gray-1)',
          border: '1px solid var(--outline-gray-1)',
        }}
      >
        {date}
      </span>
    </div>
  )
}

// ============================================
// COMING SOON PLACEHOLDER
// ============================================

function ComingSoonPlaceholder({ channel }: { channel: ChannelType }) {
  const config = CHANNEL_CONFIG[channel]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: config.color + '15',
          border: `1px solid ${config.color}33`,
        }}
      >
        <Icon className="w-7 h-7" style={{ color: config.color }} />
      </div>
      <p style={{ color: 'var(--ink-gray-8)', fontSize: '14px', fontWeight: 500 }}>
        {config.label} em breve
      </p>
      <p style={{ color: 'var(--ink-gray-5)', fontSize: '12px', textAlign: 'center', maxWidth: '300px' }}>
        A integracao com {config.label} sera adicionada em uma versao futura
      </p>
    </div>
  )
}

// ============================================
// NO CONVERSATION STATE
// ============================================

function NoConversation({ channel, phoneNumber }: { channel: ChannelType; phoneNumber?: string | null }) {
  const config = CHANNEL_CONFIG[channel]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: config.color + '15',
          border: `1px solid ${config.color}33`,
        }}
      >
        <Icon className="w-7 h-7" style={{ color: config.color }} />
      </div>
      {phoneNumber ? (
        <>
          <p style={{ color: 'var(--ink-gray-8)', fontSize: '14px', fontWeight: 500 }}>
            Nenhuma conversa encontrada
          </p>
          <p style={{ color: 'var(--ink-gray-5)', fontSize: '12px', textAlign: 'center', maxWidth: '300px' }}>
            Nao ha conversa no {config.label} vinculada ao telefone{' '}
            <span style={{ fontWeight: 500, color: 'var(--ink-gray-7)' }}>{phoneNumber}</span>
          </p>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--ink-gray-8)', fontSize: '14px', fontWeight: 500 }}>
            Telefone nao informado
          </p>
          <p style={{ color: 'var(--ink-gray-5)', fontSize: '12px', textAlign: 'center', maxWidth: '300px' }}>
            Adicione um numero de telefone ao contato para ver as conversas do {config.label}
          </p>
        </>
      )}
    </div>
  )
}

// ============================================
// CONVERSATION VIEW (messages + input)
// ============================================

interface ConversationViewProps {
  conversation: Conversation
  channel: ChannelType
}

function ConversationView({ conversation, channel }: ConversationViewProps) {
  const queryClient = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const config = CHANNEL_CONFIG[channel]

  // Socket integration — destructure to get stable function references
  const { subscribeToConversation, unsubscribeFromConversation, on, off } = useSocketContext()

  // Subscribe to conversation room
  useEffect(() => {
    if (!conversation.id) return

    subscribeToConversation(conversation.id)
    return () => {
      unsubscribeFromConversation(conversation.id)
    }
  }, [conversation.id, subscribeToConversation, unsubscribeFromConversation])

  // Listen for new messages
  useEffect(() => {
    const handleNewMessage = () => {
      queryClient.invalidateQueries({
        queryKey: ['channel-messages', conversation.id],
      })
    }

    on('message:new', handleNewMessage)
    return () => {
      off('message:new', handleNewMessage)
    }
  }, [conversation.id, on, off, queryClient])

  // Fetch messages
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['channel-messages', conversation.id],
    queryFn: () => messageService.list(conversation.id, { page: 1, limit: 50 }),
    select: (res) => res.data,
    refetchInterval: 30000, // Fallback polling every 30s
  })

  const messages = messagesData ?? []

  // Send message
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messageService.send({
        conversationId: conversation.id,
        type: MessageType.TEXT,
        content,
      }),
    onSuccess: () => {
      setInputValue('')
      queryClient.invalidateQueries({ queryKey: ['channel-messages', conversation.id] })
    },
    onError: () => toast.error('Erro ao enviar mensagem'),
  })

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || sendMutation.isPending) return
    sendMutation.mutate(text)
  }, [inputValue, sendMutation])

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let currentDate = ''

  for (const msg of messages) {
    const msgDate = format(new Date(msg.createdAt), 'dd/MM/yyyy', { locale: ptBR })
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groupedMessages.push({ date: msgDate, messages: [] })
    }
    groupedMessages[groupedMessages.length - 1]?.messages.push(msg)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--outline-gray-1)',
          backgroundColor: 'var(--surface-gray-1)',
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: config.color + '15' }}
        >
          <config.icon className="w-3.5 h-3.5" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink-gray-8)' }}>
            {conversation.contact?.name ?? conversation.contact?.phoneNumber ?? 'Contato'}
          </p>
          {conversation.contact?.phoneNumber && (
            <p style={{ fontSize: '11px', color: 'var(--ink-gray-5)' }}>
              {conversation.contact.phoneNumber}
            </p>
          )}
        </div>
        <span
          className="px-2 py-0.5 rounded-full"
          style={{
            fontSize: '10px',
            fontWeight: 500,
            backgroundColor: config.color + '15',
            color: config.color,
          }}
        >
          {config.label}
        </span>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ backgroundColor: 'var(--surface-white)' }}
      >
        {messagesLoading ? (
          <div className="space-y-3">
            {(['45%', '65%', '55%', '70%'] as const).map((w, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <Skeleton
                  className="h-10 rounded-lg"
                  style={{
                    width: w,
                    backgroundColor: 'var(--surface-gray-2)',
                  }}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <MessageCircle className="w-8 h-8" style={{ color: 'var(--ink-gray-4)' }} />
            <p style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>
              Nenhuma mensagem ainda
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <InlineDateDivider date={group.date} />
                {group.messages.map((msg) => (
                  <InlineMessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-2"
        style={{
          borderTop: '1px solid var(--outline-gray-1)',
          backgroundColor: 'var(--surface-gray-1)',
        }}
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={`Mensagem via ${config.label}...`}
          className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-2)',
            color: 'var(--ink-gray-9)',
          }}
          disabled={sendMutation.isPending}
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || sendMutation.isPending}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity"
          style={{
            backgroundColor: config.color,
            color: '#fff',
            border: 'none',
            cursor: !inputValue.trim() || sendMutation.isPending ? 'not-allowed' : 'pointer',
            opacity: !inputValue.trim() || sendMutation.isPending ? 0.5 : 1,
          }}
          aria-label="Enviar mensagem"
        >
          {sendMutation.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================
// MAIN CHANNEL TAB
// ============================================

export function ChannelTab({ channel, phoneNumber }: ChannelTabProps) {
  const config = CHANNEL_CONFIG[channel]

  // If channel is not yet available, show placeholder
  if (!config.available) {
    return <ComingSoonPlaceholder channel={channel} />
  }

  // If no phone number, show empty state
  if (!phoneNumber) {
    return <NoConversation channel={channel} />
  }

  return <ChannelTabContent channel={channel} phoneNumber={phoneNumber} />
}

// Separated to use hooks conditionally
function ChannelTabContent({ channel, phoneNumber }: { channel: ChannelType; phoneNumber: string }) {
  // Search for conversation by phone number
  // Uses the conversations list endpoint with phone search
  const { data: conversationData, isLoading } = useQuery({
    queryKey: ['channel-conversation', channel, phoneNumber],
    queryFn: async () => {
      // Normalize phone — strip non-digits
      const normalizedPhone = phoneNumber.replace(/\D/g, '')
      const res = await conversationService.list({
        search: normalizedPhone,
        page: 1,
        limit: 1,
      })
      return res.data
    },
    select: (data) => {
      // Find the conversation matching this phone
      return data[0] ?? null
    },
    staleTime: 30000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--ink-gray-4)' }} />
        <p style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>
          Buscando conversa...
        </p>
      </div>
    )
  }

  if (!conversationData) {
    return <NoConversation channel={channel} phoneNumber={phoneNumber} />
  }

  return <ConversationView conversation={conversationData} channel={channel} />
}
