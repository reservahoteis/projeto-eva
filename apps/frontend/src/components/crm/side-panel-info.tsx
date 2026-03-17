'use client'

// Usage:
// <SidePanelInfo fields={leadFields} data={lead} onUpdate={handleUpdate} loading={isLoading} />
// Renders a grouped list of fields with inline editing support.
// Each field can be of type: text | email | phone | url | number | currency | select | date | badge | user | textarea

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'currency'
  | 'select'
  | 'date'
  | 'badge'
  | 'user'
  | 'textarea'

export interface SelectOption {
  value: string
  label: string
  color?: string
}

export interface FieldDefinition {
  key: string
  label: string
  type: FieldType
  editable?: boolean
  options?: SelectOption[]
  placeholder?: string
  icon?: React.ElementType
  group?: string
}

export interface SidePanelInfoProps {
  fields: FieldDefinition[]
  data: Record<string, unknown>
  onUpdate: (field: string, value: unknown) => void
  loading?: boolean
  title?: string
}

// ============================================
// HELPERS
// ============================================

function formatFieldValue(field: FieldDefinition, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'

  switch (field.type) {
    case 'date':
      try {
        return format(new Date(value as string), 'dd/MM/yyyy', { locale: ptBR })
      } catch {
        return String(value)
      }
    case 'currency':
      try {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Number(value))
      } catch {
        return String(value)
      }
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(Number(value))
    case 'phone':
    case 'email':
    case 'url':
    case 'text':
    case 'textarea':
    default:
      return String(value)
  }
}

function getSlaStatusStyle(status: string): React.CSSProperties {
  if (!status) return { color: 'var(--ink-gray-4)' }
  const lower = status.toLowerCase()
  if (lower.includes('breached') || lower.includes('vencida'))
    return { color: 'var(--ink-red-3)' }
  if (lower.includes('warning') || lower.includes('alerta'))
    return { color: 'var(--ink-amber-3)' }
  if (lower.includes('fulfilled') || lower.includes('cumprida'))
    return { color: 'var(--ink-green-3)' }
  return { color: 'var(--ink-gray-4)' }
}

// ============================================
// INLINE EDIT FIELD
// ============================================

interface InlineEditFieldProps {
  field: FieldDefinition
  value: unknown
  onSave: (value: unknown) => void
}

function InlineEditField({ field, value, onSave }: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(
    value !== null && value !== undefined ? String(value) : ''
  )

  const handleSave = () => {
    let parsed: unknown = draft
    if (field.type === 'number' || field.type === 'currency') {
      const num = parseFloat(draft.replace(/[^0-9.-]/g, ''))
      parsed = isNaN(num) ? null : num
    }
    onSave(parsed === '' ? null : parsed)
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(value !== null && value !== undefined ? String(value) : '')
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && field.type !== 'textarea') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (!field.editable) {
    return (
      <span
        className="text-sm"
        style={{ color: 'var(--ink-gray-8)' }}
      >
        {formatFieldValue(field, value)}
      </span>
    )
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1.5 text-sm text-left w-full transition-colors"
        style={{ color: 'var(--ink-gray-8)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-9)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-8)')}
        aria-label={`Editar ${field.label}`}
      >
        <span className="flex-1 min-w-0 truncate">
          {formatFieldValue(field, value)}
        </span>
        <Edit2
          className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--ink-gray-4)' }}
        />
      </button>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="flex items-center gap-1.5">
        <Select
          value={draft}
          onValueChange={(v) => {
            setDraft(v)
            onSave(v)
            setEditing(false)
          }}
        >
          <SelectTrigger
            className="h-7 text-xs border focus:ring-1"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          >
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          >
            {field.options.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-xs"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={handleCancel}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--ink-gray-4)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-6)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-4)')}
          aria-label="Cancelar edicao"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="text-xs min-h-[80px] resize-none border focus:ring-1"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
            color: 'var(--ink-gray-8)',
          }}
          placeholder={field.placeholder}
          aria-label={`Editar ${field.label}`}
        />
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={handleCancel}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--ink-gray-4)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-6)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-4)')}
            aria-label="Cancelar"
          >
            <X className="w-3 h-3" />
          </button>
          <button
            onClick={handleSave}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--ink-green-3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-green-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-green-3)')}
            aria-label="Salvar"
          >
            <Check className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="h-7 text-xs border focus:ring-1"
        style={{
          backgroundColor: 'var(--surface-white)',
          borderColor: 'var(--outline-gray-2)',
          color: 'var(--ink-gray-8)',
        }}
        placeholder={field.placeholder}
        aria-label={`Editar ${field.label}`}
      />
      <button
        onClick={handleCancel}
        className="p-1 rounded flex-shrink-0 transition-colors"
        style={{ color: 'var(--ink-gray-4)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-6)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-4)')}
        aria-label="Cancelar"
      >
        <X className="w-3 h-3" />
      </button>
      <button
        onClick={handleSave}
        className="p-1 rounded flex-shrink-0 transition-colors"
        style={{ color: 'var(--ink-green-3)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-green-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-green-3)')}
        aria-label="Salvar"
      >
        <Check className="w-3 h-3" />
      </button>
    </div>
  )
}

// ============================================
// BADGE FIELD (status)
// ============================================

interface BadgeFieldProps {
  field: FieldDefinition
  value: unknown
  onSave: (value: unknown) => void
}

function BadgeField({ field, value, onSave }: BadgeFieldProps) {
  const [editing, setEditing] = useState(false)

  const statusObj = value as { id?: string; label?: string; color?: string } | null
  const label = statusObj?.label ?? '—'
  const color = statusObj?.color ?? '#94a3b8'

  if (!field.editable) {
    return (
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: color + '22', color: color, border: `1px solid ${color}44` }}
      >
        {label}
      </span>
    )
  }

  if (editing && field.options) {
    return (
      <div className="flex items-center gap-1.5">
        <Select
          value={statusObj?.id ?? ''}
          onValueChange={(v) => {
            const opt = field.options?.find((o) => o.value === v)
            if (opt) {
              onSave({ id: opt.value, label: opt.label, color: opt.color })
            }
            setEditing(false)
          }}
        >
          <SelectTrigger
            className="h-7 text-xs border focus:ring-1"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          >
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          >
            {field.options.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-xs"
              >
                <div className="flex items-center gap-2">
                  {opt.color && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => setEditing(false)}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--ink-gray-4)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-6)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-4)')}
          aria-label="Cancelar"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5"
      aria-label={`Editar ${field.label}`}
    >
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: color + '22', color: color, border: `1px solid ${color}44` }}
      >
        {label}
      </span>
      <Edit2
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--ink-gray-4)' }}
      />
    </button>
  )
}

// ============================================
// USER FIELD (avatar + name)
// ============================================

interface UserFieldProps {
  value: unknown
}

function UserField({ value }: UserFieldProps) {
  const user = value as { id?: string; name?: string; avatar_url?: string | null } | null
  if (!user) return <span className="text-sm" style={{ color: 'var(--ink-gray-4)' }}>—</span>

  return (
    <div className="flex items-center gap-2">
      <Avatar className="w-5 h-5 flex-shrink-0">
        <AvatarImage src={user.avatar_url ?? undefined} alt={user.name ?? ''} />
        <AvatarFallback
          className="text-[9px]"
          style={{
            backgroundColor: 'var(--surface-blue-2)',
            color: 'var(--ink-blue-3)',
          }}
        >
          {getInitials(user.name ?? '')}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm truncate" style={{ color: 'var(--ink-gray-8)' }}>
        {user.name ?? '—'}
      </span>
    </div>
  )
}

// ============================================
// SINGLE FIELD ROW
// ============================================

interface FieldRowProps {
  field: FieldDefinition
  value: unknown
  onUpdate: (key: string, value: unknown) => void
}

function FieldRow({ field, value, onUpdate }: FieldRowProps) {
  const Icon = field.icon

  const renderValue = () => {
    if (field.type === 'badge') {
      return (
        <BadgeField
          field={field}
          value={value}
          onSave={(v) => onUpdate(field.key, v)}
        />
      )
    }

    if (field.type === 'user') {
      return <UserField value={value} />
    }

    // SLA field special render
    if (field.key === 'sla_status') {
      const slaStr = value as string | null
      const slaStyle = getSlaStatusStyle(slaStr ?? '')
      return (
        <div className="flex items-center gap-1.5">
          {slaStr?.toLowerCase().includes('breached') || slaStr?.toLowerCase().includes('vencida') ? (
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--ink-red-3)' }} />
          ) : (
            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-4)' }} />
          )}
          <span className="text-sm" style={slaStyle}>
            {slaStr ?? '—'}
          </span>
        </div>
      )
    }

    return (
      <InlineEditField
        field={field}
        value={value}
        onSave={(v) => onUpdate(field.key, v)}
      />
    )
  }

  return (
    <div
      className="flex flex-col gap-1 py-2.5 last:border-0"
      style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" style={{ color: 'var(--ink-gray-4)' }} />}
        <span
          className="text-xs uppercase tracking-wide font-medium"
          style={{ color: 'var(--ink-gray-5)' }}
        >
          {field.label}
        </span>
      </div>
      <div className="pl-0">{renderValue()}</div>
    </div>
  )
}

// ============================================
// GROUP SECTION (collapsible)
// ============================================

interface GroupSectionProps {
  label: string
  fields: FieldDefinition[]
  data: Record<string, unknown>
  onUpdate: (key: string, value: unknown) => void
  collapsible?: boolean
  defaultCollapsed?: boolean
}

function GroupSection({
  label,
  fields,
  data,
  onUpdate,
  collapsible = false,
  defaultCollapsed = false,
}: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div>
      <button
        onClick={() => collapsible && setCollapsed((v) => !v)}
        className={cn(
          'flex items-center justify-between w-full py-2',
          collapsible && 'cursor-pointer'
        )}
        aria-expanded={collapsible ? !collapsed : undefined}
        disabled={!collapsible}
      >
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--ink-gray-5)' }}
        >
          {label}
        </span>
        {collapsible &&
          (collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-4)' }} />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-4)' }} />
          ))}
      </button>

      {!collapsed && (
        <div>
          {fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={data[field.key]}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SidePanelInfo({
  fields,
  data,
  onUpdate,
  loading = false,
  title,
}: SidePanelInfoProps) {
  // Group fields by their 'group' property
  const groups = fields.reduce<Record<string, FieldDefinition[]>>((acc, field) => {
    const groupKey = field.group ?? 'Informacoes'
    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey]!.push(field)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true" aria-label="Carregando informacoes">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            <Skeleton className="h-5 w-full" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <aside
      className="w-full"
      aria-label={title ?? 'Informacoes do registro'}
    >
      {title && (
        <div className="px-4 pt-4 pb-2">
          <h2
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--ink-gray-5)' }}
          >
            {title}
          </h2>
        </div>
      )}

      <div className="px-4">
        {Object.entries(groups).map(([groupLabel, groupFields], idx) => (
          <div key={groupLabel} className={idx > 0 ? 'pt-3' : ''}>
            <GroupSection
              label={groupLabel}
              fields={groupFields}
              data={data}
              onUpdate={onUpdate}
              collapsible={idx > 0}
              defaultCollapsed={false}
            />
            {idx < Object.keys(groups).length - 1 && (
              <div style={{ height: 1, backgroundColor: 'var(--outline-gray-1)', marginTop: 12 }} />
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
