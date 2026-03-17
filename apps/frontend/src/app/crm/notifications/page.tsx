'use client'

/**
 * CRM Notifications Page — Espresso Design
 * Matches Frappe CRM Notifications panel
 */

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { crmApi } from '@/services/crm/api'
import { LayoutHeader } from '@/components/crm/layout-header'
import { ViewBreadcrumbs } from '@/components/crm/view-breadcrumbs'
import { EmptyState } from '@/components/crm/empty-state'
import { UserAvatar } from '@/components/crm/user-avatar'

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['crm-notifications'],
    queryFn: () => crmApi.notifications.list(),
    select: (res) => res.data,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => crmApi.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['crm-notifications-count'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => crmApi.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['crm-notifications-count'] })
    },
  })

  const notifications = data?.data || []

  return (
    <div className="flex flex-col h-full">
      <LayoutHeader
        left={<ViewBreadcrumbs items={[{ label: 'Notificações' }]} />}
        right={
          notifications.length > 0 ? (
            <button
              onClick={() => markAllRead.mutate()}
              className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors"
              style={{
                color: 'var(--ink-gray-8)',
                border: '1px solid var(--outline-gray-2)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--ink-gray-4)' }}>
            Carregando...
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState name="notificações" icon={Bell} />
        ) : (
          <div>
            {notifications.map((notif: any) => (
              <div
                key={notif.id}
                className="flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid var(--surface-gray-2)',
                  backgroundColor: notif.read ? undefined : 'var(--surface-blue-2)',
                }}
                onMouseEnter={(e) => {
                  if (notif.read) e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
                }}
                onMouseLeave={(e) => {
                  if (notif.read) e.currentTarget.style.backgroundColor = ''
                }}
                onClick={() => !notif.read && markRead.mutate(notif.id)}
              >
                <UserAvatar
                  label={notif.from_user_name || 'Sistema'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '14px', color: 'var(--ink-gray-9)', fontWeight: notif.read ? 420 : 500 }}>
                    {notif.message}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)', marginTop: '2px' }}>
                    {notif.created_at
                      ? formatDistanceToNow(new Date(notif.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })
                      : ''}
                  </p>
                </div>
                {!notif.read && (
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--ink-blue-3)',
                      flexShrink: 0,
                      marginTop: '6px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
