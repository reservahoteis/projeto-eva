'use client'

// Faithful to Frappe CRM TaskPriorityIcon — Espresso design
import { ArrowUp, ArrowRight, ArrowDown } from 'lucide-react'
import type { TaskPriority } from '@/types/crm'

type PriorityConfigEntry = { bg: string; text: string; icon: typeof ArrowUp; label: string }

const priorityConfigDefault: PriorityConfigEntry = {
  bg: 'var(--surface-gray-2)',
  text: 'var(--ink-gray-6)',
  icon: ArrowDown,
  label: 'Baixa',
}

const priorityConfig: Record<string, PriorityConfigEntry> = {
  High: {
    bg: 'var(--surface-red-2)',
    text: 'var(--ink-red-3)',
    icon: ArrowUp,
    label: 'Alta',
  },
  Medium: {
    bg: 'var(--surface-amber-2)',
    text: 'var(--ink-amber-3)',
    icon: ArrowRight,
    label: 'Média',
  },
  Low: priorityConfigDefault,
}

interface PriorityBadgeProps {
  priority: TaskPriority | string
  size?: 'sm' | 'md'
  className?: string
}

export function PriorityBadge({ priority, size = 'sm', className }: PriorityBadgeProps) {
  const config: PriorityConfigEntry = priorityConfig[priority] ?? priorityConfigDefault
  const Icon = config.icon

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        borderRadius: '999px',
        fontSize: size === 'sm' ? '12px' : '13px',
        fontWeight: 500,
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      <Icon style={{ width: size === 'sm' ? '12px' : '14px', height: size === 'sm' ? '12px' : '14px' }} />
      {config.label}
    </span>
  )
}
