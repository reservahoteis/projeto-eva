'use client'

// Faithful recreation of Frappe CRM AppSidebar.vue
// Source: /tmp/frappe-crm/frontend/src/components/Layouts/AppSidebar.vue

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/auth-context'
import { useLocalStorage } from '@/hooks/use-local-storage'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard,
  Target,
  Handshake,
  Users,
  Building2,
  FileText,
  ListTodo,
  Calendar,
  PhoneCall,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  MessageSquare,
  HelpCircle,
} from 'lucide-react'
import { crmApi } from '@/services/crm/api'
import { LanguageSwitcher } from './language-switcher'

// Sidebar link definitions — labels are i18n keys resolved at render time
const sidebarLinkDefs: Array<{
  key: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  href: string
  exact?: boolean
}> = [
  { key: 'dashboard', icon: LayoutDashboard, href: '/crm', exact: true },
  { key: 'leads', icon: Target, href: '/crm/leads' },
  { key: 'deals', icon: Handshake, href: '/crm/deals' },
  { key: 'contacts', icon: Users, href: '/crm/contacts' },
  { key: 'organizations', icon: Building2, href: '/crm/organizations' },
  { key: 'notes', icon: FileText, href: '/crm/notes' },
  { key: 'tasks', icon: ListTodo, href: '/crm/tasks' },
  { key: 'calendar', icon: Calendar, href: '/crm/calendar' },
  { key: 'callLogs', icon: PhoneCall, href: '/crm/call-logs' },
]

// Hook for localStorage-backed collapse state (matches Frappe's useStorage)
function useCollapsed() {
  const [collapsed, setCollapsed] = useLocalStorage('crmSidebarCollapsed', false)
  return [collapsed, setCollapsed] as const
}

function SidebarLink({
  icon: Icon,
  label,
  href,
  exact,
  isCollapsed,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  href?: string
  exact?: boolean
  isCollapsed: boolean
  badge?: number
  onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = href
    ? exact
      ? pathname === href
      : pathname.startsWith(href)
    : false

  const content = (
    <button
      onClick={onClick}
      className="flex h-[30px] w-full cursor-pointer items-center rounded transition-all duration-300 ease-in-out focus:outline-none"
      style={{
        backgroundColor: isActive ? 'var(--surface-selected)' : undefined,
        boxShadow: isActive
          ? '0px 0px 1px rgba(0,0,0,0.45), 0px 1px 2px rgba(0,0,0,0.1)'
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = ''
      }}
    >
      <div
        className="flex w-full items-center justify-between transition-all duration-300 ease-in-out"
        style={{ padding: isCollapsed ? '4px 4px 4px 3px' : '7px 8px' }}
      >
        <div className="flex items-center truncate">
          <Icon
            className="h-4 w-4 flex-shrink-0"
            style={{ color: 'var(--ink-gray-8)' }}
          />
          <span
            className="flex-1 flex-shrink-0 truncate text-sm transition-all duration-300 ease-in-out"
            style={{
              color: 'var(--ink-gray-8)',
              marginLeft: isCollapsed ? 0 : '8px',
              width: isCollapsed ? 0 : 'auto',
              opacity: isCollapsed ? 0 : 1,
              overflow: isCollapsed ? 'hidden' : undefined,
            }}
          >
            {label}
          </span>
        </div>
        {!isCollapsed && badge !== undefined && badge > 0 && (
          <span
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--surface-gray-2)',
              color: 'var(--ink-gray-6)',
            }}
          >
            {badge}
          </span>
        )}
      </div>
    </button>
  )

  if (href) {
    const wrappedInLink = <Link href={href}>{content}</Link>
    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{wrappedInLink}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      )
    }
    return wrappedInLink
  }

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

export function CrmSidebar() {
  const { user, logout } = useAuth()
  const [isCollapsed, setIsCollapsed] = useCollapsed()
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const ta = useTranslations('auth')

  const { data: notifCount } = useQuery({
    queryKey: ['crm-notifications-count'],
    queryFn: () => crmApi.notifications.unreadCount(),
    refetchInterval: 60_000,
    staleTime: 30_000,
    select: (res) => res.data.count,
  })

  const unreadCount = notifCount ?? 0

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="relative flex h-full flex-col justify-between transition-all duration-300 ease-in-out"
        style={{ width: isCollapsed ? '48px' : '220px' }}
      >
        {/* UserDropdown / Brand area — matches UserDropdown.vue */}
        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-12 items-center rounded-md py-2 transition-all duration-300 ease-in-out"
                style={{
                  width: isCollapsed ? 'auto' : '100%',
                  padding: isCollapsed ? '8px 0' : '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isCollapsed) e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = ''
                }}
              >
                <div className="h-8 w-8 max-w-16 flex-shrink-0 rounded-lg overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="CRM"
                    width={32}
                    height={32}
                    className="object-contain"
                    priority
                  />
                </div>
                <div
                  className="flex flex-1 flex-col text-left truncate transition-all duration-300 ease-in-out"
                  style={{
                    marginLeft: isCollapsed ? 0 : '8px',
                    width: isCollapsed ? 0 : 'auto',
                    opacity: isCollapsed ? 0 : 1,
                    overflow: isCollapsed ? 'hidden' : undefined,
                  }}
                >
                  <div
                    className="text-sm font-medium leading-none truncate"
                    style={{ color: 'var(--ink-gray-9)' }}
                  >
                    CRM
                  </div>
                  <div
                    className="mt-1 text-xs leading-none truncate"
                    style={{ color: 'var(--ink-gray-7)' }}
                  >
                    {user?.name}
                  </div>
                </div>
                <div
                  className="transition-all duration-300 ease-in-out"
                  style={{
                    marginLeft: isCollapsed ? 0 : '8px',
                    width: isCollapsed ? 0 : 'auto',
                    opacity: isCollapsed ? 0 : 1,
                    overflow: isCollapsed ? 'hidden' : undefined,
                  }}
                >
                  <ChevronDown className="h-4 w-4" style={{ color: 'var(--ink-gray-5)' }} />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-56">
              <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--outline-gray-1)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-9)' }}>
                  {user?.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                  {user?.email}
                </p>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/crm/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  {tc('settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {tc('chat')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                {ta('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Navigation — matches AppSidebar.vue structure */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col">
            {/* Notifications */}
            <div className="mx-2 my-[1.5px]">
              <SidebarLink
                icon={Bell}
                label={t('notifications')}
                href="/crm/notifications"
                isCollapsed={isCollapsed}
                badge={unreadCount}
              />
            </div>
          </div>

          {/* Separator */}
          <div className="mx-2 my-1.5" />

          {/* All Views section */}
          <nav className="flex flex-col">
            {sidebarLinkDefs.map((link) => (
              <div key={link.key} className="mx-2 my-[1.5px]">
                <SidebarLink
                  icon={link.icon}
                  label={t(link.key)}
                  href={link.href}
                  exact={link.exact}
                  isCollapsed={isCollapsed}
                />
              </div>
            ))}
          </nav>
        </div>

        {/* Footer — language, help, collapse */}
        <div className="m-2 flex flex-col gap-1">
          <div className="mx-0 my-[1.5px]">
            <LanguageSwitcher collapsed={isCollapsed} />
          </div>
          <SidebarLink
            icon={HelpCircle}
            label={tc('help')}
            isCollapsed={isCollapsed}
            onClick={() => window.open('https://docs.hoteisreserva.com.br', '_blank', 'noopener,noreferrer')}
          />
          <SidebarLink
            icon={({ className }) => (
              <svg
                className={className}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isCollapsed ? 'rotateY(180deg)' : undefined,
                  transition: 'transform 0.3s ease-in-out',
                }}
              >
                <path d="M11 2L5 8l6 6" />
              </svg>
            )}
            label={isCollapsed ? tc('expand') : tc('collapse')}
            isCollapsed={isCollapsed}
            onClick={() => setIsCollapsed(!isCollapsed)}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}
