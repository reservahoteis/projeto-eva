'use client'

// Shared detail page tab bar — matches Frappe CRM tab layout.
// Tabs include content tabs (Activity, Emails, Comments, Data, Tasks, Notes, Attachments)
// and channel tabs (WhatsApp, Messenger, Instagram, iMessage, Booking, Airbnb).
// Clicking a channel opens the conversation inline.

import { useState } from 'react'
import {
  Activity,
  Mail,
  MessageSquare,
  Database,
  ListTodo,
  FileText,
  Paperclip,
  MessageCircle,
  Instagram,
  Apple,
  BedDouble,
  Plane,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

export interface TabConfig {
  /** Unique tab key */
  value: string
  /** Display label */
  label: string
  /** Lucide icon component */
  icon: React.ElementType
  /** Optional badge count (e.g. unread messages) */
  badge?: number
  /** Whether this tab is a channel (renders differently) */
  isChannel?: boolean
  /** Whether tab is disabled */
  disabled?: boolean
}

export interface DetailTabsProps {
  /** Active tab value */
  activeTab: string
  /** Callback when tab changes */
  onTabChange: (value: string) => void
  /** Tab configurations */
  tabs: TabConfig[]
  /** Tab content — rendered below the tab bar */
  children: React.ReactNode
}

// ============================================
// DEFAULT TABS — use as starting point, pages can customize
// ============================================

/** Standard content tabs (no channels) */
export const CONTENT_TABS: TabConfig[] = [
  { value: 'activity', label: 'Activity', icon: Activity },
  { value: 'emails', label: 'Emails', icon: Mail },
  { value: 'comments', label: 'Comentarios', icon: MessageSquare },
  { value: 'data', label: 'Dados', icon: Database },
  { value: 'tasks', label: 'Tarefas', icon: ListTodo },
  { value: 'notes', label: 'Notas', icon: FileText },
  { value: 'attachments', label: 'Anexos', icon: Paperclip },
]

/** Channel tabs — each represents a messaging channel */
export const CHANNEL_TABS: TabConfig[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, isChannel: true },
  { value: 'messenger', label: 'Messenger', icon: MessageSquare, isChannel: true },
  { value: 'instagram', label: 'Instagram', icon: Instagram, isChannel: true },
  { value: 'imessage', label: 'iMessage', icon: Apple, isChannel: true },
  { value: 'booking', label: 'Booking', icon: BedDouble, isChannel: true },
  { value: 'airbnb', label: 'Airbnb', icon: Plane, isChannel: true },
]

/** All tabs combined */
export const ALL_TABS: TabConfig[] = [...CONTENT_TABS, ...CHANNEL_TABS]

// ============================================
// TAB BAR COMPONENT
// ============================================

export function DetailTabs({ activeTab, onTabChange, tabs, children }: DetailTabsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — scrollable horizontally on small screens */}
      <div
        className="flex-shrink-0 overflow-x-auto scrollbar-none"
        style={{
          borderBottom: '1px solid var(--outline-gray-1)',
          backgroundColor: 'var(--surface-white)',
        }}
      >
        <div role="tablist" aria-label="Abas de conteudo" className="flex items-center px-4 lg:px-6 gap-0 min-w-max">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value
            const Icon = tab.icon

            return (
              <button
                key={tab.value}
                onClick={() => !tab.disabled && onTabChange(tab.value)}
                disabled={tab.disabled}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                  tab.disabled && 'opacity-40 cursor-not-allowed',
                )}
                style={{
                  color: isActive ? 'var(--ink-gray-9)' : 'var(--ink-gray-5)',
                  background: 'transparent',
                  border: 'none',
                  cursor: tab.disabled ? 'not-allowed' : 'pointer',
                  marginBottom: '-1px',
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !tab.disabled) {
                    e.currentTarget.style.color = 'var(--ink-gray-7)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !tab.disabled) {
                    e.currentTarget.style.color = 'var(--ink-gray-5)'
                  }
                }}
                aria-selected={isActive}
                role="tab"
              >
                <Icon
                  className="w-3.5 h-3.5"
                  style={{
                    color: isActive
                      ? tab.isChannel
                        ? getChannelColor(tab.value)
                        : 'var(--ink-gray-8)'
                      : 'var(--ink-gray-4)',
                  }}
                />
                <span>{tab.label}</span>

                {/* Badge */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-semibold"
                    style={{
                      backgroundColor: tab.isChannel
                        ? getChannelColor(tab.value)
                        : 'var(--ink-gray-5)',
                      color: '#fff',
                    }}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}

                {/* Active underline indicator */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t"
                    style={{
                      backgroundColor: tab.isChannel
                        ? getChannelColor(tab.value)
                        : 'var(--ink-gray-9)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}

// ============================================
// CHANNEL COLORS
// ============================================

function getChannelColor(channel: string): string {
  switch (channel) {
    case 'whatsapp':
      return '#25D366'
    case 'messenger':
      return '#0084FF'
    case 'instagram':
      return '#E4405F'
    case 'imessage':
      return '#34C759'
    case 'booking':
      return '#003580'
    case 'airbnb':
      return '#FF5A5F'
    default:
      return 'var(--ink-gray-5)'
  }
}

// ============================================
// CONVENIENCE HOOK: manage active tab state
// ============================================

export function useDetailTabs(defaultTab: string = 'activity') {
  const [activeTab, setActiveTab] = useState(defaultTab)
  return { activeTab, setActiveTab }
}
