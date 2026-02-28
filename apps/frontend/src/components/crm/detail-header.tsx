'use client'

// Shared detail page header — faithful to Frappe CRM Deal.vue / Lead.vue header
// Renders breadcrumb, back button, entity icon, inline-editable name,
// naming series, status badge, assignee avatars, and right-side action slot.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import type { UserEmbed } from '@/types/crm'

// ============================================
// TYPES
// ============================================

interface StatusBadgeData {
  label: string
  color: string
}

export interface DetailHeaderProps {
  /** Parent list label, e.g. "Leads" */
  breadcrumbLabel: string
  /** Parent list href, e.g. "/crm/leads" */
  breadcrumbHref: string
  /** Entity display name, e.g. "Joao Silva" */
  entityName: string
  /** Naming series, e.g. "CRM-LEAD-2026-001" */
  namingSeries?: string
  /** Icon component for the entity */
  icon: React.ElementType
  /** Espresso CSS var for icon color */
  iconColor?: string
  /** Espresso CSS var for icon background */
  iconBg?: string
  /** Status badge */
  statusBadge?: StatusBadgeData
  /** Assignee avatars */
  assignees?: UserEmbed[]
  /** Callback for inline name edit. If undefined, name is not editable. */
  onNameEdit?: (newName: string) => void
  /** Extra badges (e.g. "Converted" for leads) */
  extraBadges?: React.ReactNode
  /** Right-side custom actions (e.g. Convert, Won/Lost buttons) */
  actions?: React.ReactNode
  /** Dropdown menu items for the "..." menu */
  menuItems?: React.ReactNode
  /** Whether data is loading */
  isLoading?: boolean
  /** Callback for delete action */
  onDelete?: () => void
  /** Callback for refresh */
  onRefresh?: () => void
}

// ============================================
// AVATAR PALETTE
// ============================================

const AVATAR_PALETTE = [
  { bg: '#E6F4FF', text: '#007BE0' },
  { bg: '#E4FAEB', text: '#278F5E' },
  { bg: '#FFF7D3', text: '#DB7706' },
  { bg: '#FFE7E7', text: '#E03636' },
  { bg: '#F3F0FF', text: '#6846E3' },
] as const

function getAvatarPalette(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0] ?? '').substring(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

// ============================================
// COMPONENT
// ============================================

export function DetailHeader({
  breadcrumbLabel,
  breadcrumbHref,
  entityName,
  namingSeries,
  icon: Icon,
  iconColor = 'var(--ink-blue-3)',
  iconBg = 'var(--surface-blue-2)',
  statusBadge,
  assignees,
  onNameEdit,
  extraBadges,
  actions,
  menuItems,
  onDelete,
}: DetailHeaderProps) {
  const router = useRouter()
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameEdit, setNameEdit] = useState('')

  const handleNameSave = () => {
    if (!nameEdit.trim() || !onNameEdit) return
    onNameEdit(nameEdit.trim())
    setIsEditingName(false)
  }

  const startEditing = () => {
    if (!onNameEdit) return
    setNameEdit(entityName)
    setIsEditingName(true)
  }

  return (
    <header
      className="flex-shrink-0 px-4 lg:px-6 py-3"
      style={{
        borderBottom: '1px solid var(--outline-gray-1)',
        backgroundColor: 'var(--surface-white)',
      }}
    >
      {/* Breadcrumb row */}
      <nav className="flex items-center gap-1.5 mb-2" aria-label="Breadcrumb">
        <button
          onClick={() => router.push(breadcrumbHref)}
          className="text-xs hover:underline"
          style={{
            color: 'var(--ink-gray-5)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-8)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-5)')}
        >
          {breadcrumbLabel}
        </button>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-4)' }} />
        <span
          className="truncate max-w-[200px] text-xs"
          style={{ color: 'var(--ink-gray-8)' }}
        >
          {entityName}
        </span>
      </nav>

      {/* Main header row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{
            color: 'var(--ink-gray-5)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Entity icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, border: `1px solid ${iconColor}33` }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>

        {/* Name (inline editable) */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameEdit}
                onChange={(e) => setNameEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave()
                  if (e.key === 'Escape') setIsEditingName(false)
                }}
                autoFocus
                className="h-8 w-64 text-base font-semibold"
                style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-9)' }}
                aria-label="Nome"
              />
              <button
                onClick={handleNameSave}
                className="h-8 flex items-center justify-center px-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--surface-gray-7)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="h-8 flex items-center justify-center px-2 rounded-lg"
                style={{
                  color: 'var(--ink-gray-5)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="leading-tight"
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--ink-gray-9)',
                  cursor: onNameEdit ? 'pointer' : 'default',
                }}
                onClick={startEditing}
                title={onNameEdit ? 'Clique para editar' : undefined}
              >
                {entityName}
              </h1>

              {/* Naming series */}
              {namingSeries && (
                <span
                  className="hidden sm:inline"
                  style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}
                >
                  {namingSeries}
                </span>
              )}

              {/* Status badge */}
              {statusBadge && (
                <span
                  className="inline-flex items-center flex-shrink-0"
                  style={{
                    backgroundColor: statusBadge.color + '22',
                    color: statusBadge.color,
                    border: `1px solid ${statusBadge.color}44`,
                    borderRadius: '999px',
                    padding: '2px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {statusBadge.label}
                </span>
              )}

              {/* Extra badges (Converted, etc.) */}
              {extraBadges}
            </div>
          )}
        </div>

        {/* Right side: assignees + actions + menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Assignee avatars */}
          {assignees && assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((user) => {
                const palette = getAvatarPalette(user.id)
                return (
                  <div
                    key={user.id}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ring-2 ring-white"
                    style={{ backgroundColor: palette.bg, color: palette.text }}
                    title={user.name}
                  >
                    {getInitials(user.name)}
                  </div>
                )
              })}
              {assignees.length > 3 && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium ring-2 ring-white"
                  style={{
                    backgroundColor: 'var(--surface-gray-2)',
                    color: 'var(--ink-gray-5)',
                  }}
                >
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Custom action buttons */}
          {actions}

          {/* Dropdown menu */}
          {(menuItems || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{
                    color: 'var(--ink-gray-5)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                  aria-label="Mais opcoes"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-lg border shadow-md"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                }}
              >
                {onNameEdit && (
                  <DropdownMenuItem
                    onClick={startEditing}
                    className="text-sm cursor-pointer"
                    style={{ color: 'var(--ink-gray-8)' }}
                  >
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Editar nome
                  </DropdownMenuItem>
                )}
                {menuItems}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-sm cursor-pointer"
                      style={{ color: 'var(--ink-red-3)' }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
