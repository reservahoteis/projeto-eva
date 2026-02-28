'use client'

// Faithful recreation of Frappe CRM EmptyState.vue
import { type LucideIcon, Inbox } from 'lucide-react'

interface EmptyStateProps {
  name?: string
  icon?: LucideIcon
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  name,
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20">
      <Icon
        className="h-12 w-12 mb-4"
        style={{ color: 'var(--ink-gray-3)' }}
      />
      <p
        className="text-lg font-medium"
        style={{ color: 'var(--ink-gray-5)' }}
      >
        {title || `Nenhum ${name || 'item'} encontrado`}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--ink-gray-4)' }}>
        {description || 'Crie um novo para começar'}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 crm-btn crm-btn--primary text-sm"
          style={{
            backgroundColor: 'var(--surface-gray-7)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
