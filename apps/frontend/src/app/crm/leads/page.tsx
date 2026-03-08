'use client'

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'
import { crmApi } from '@/services/crm/api'
import { contactService } from '@/services/contact.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Users,
  Target,
  TrendingUp,
  CheckCircle2,
  LayoutList,
  Columns,
  Group,
  ArrowUpDown,
  Mail,
  Phone,
  UserCheck,
  Filter,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import type { LeadListItem, ViewType } from '@/types/crm'
import type { Contact } from '@/types'

// ============================================
// HELPERS
// ============================================

function getStatusColor(color: string): string {
  return color || '#94a3b8'
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0] ?? '').substring(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

// Espresso-style deterministic avatar palette
const AVATAR_PALETTE = [
  { bg: '#E6F4FF', text: '#007BE0' }, // blue
  { bg: '#E4FAEB', text: '#278F5E' }, // green
  { bg: '#FFF7D3', text: '#DB7706' }, // amber
  { bg: '#FFE7E7', text: '#E03636' }, // red
  { bg: '#F3F0FF', text: '#6846E3' }, // purple
] as const

function getAvatarPalette(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]
}

function getDisplayName(contact: Contact): string {
  if (contact.firstName || contact.lastName) {
    return `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
  }
  return contact.name ?? contact.phoneNumber
}

// ============================================
// CHANNEL BADGE
// ============================================

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  MESSENGER: 'Messenger',
  INSTAGRAM: 'Instagram',
}

const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  WHATSAPP: { bg: '#E4FAEB', text: '#278F5E' },
  MESSENGER: { bg: '#E6F4FF', text: '#007BE0' },
  INSTAGRAM: { bg: '#FFE7E7', text: '#E03636' },
}

function ChannelBadge({ channel }: { channel?: string | null }) {
  if (!channel) return <span style={{ color: 'var(--ink-gray-4)' }}>—</span>
  const upper = channel.toUpperCase()
  const label = CHANNEL_LABELS[upper] ?? channel
  const colors = CHANNEL_COLORS[upper] ?? { bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-6)' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  )
}

// ============================================
// CONTACT AVATAR
// ============================================

function ContactAvatar({ imageUrl, name, id, size = 'sm' }: {
  imageUrl?: string | null
  name: string
  id: string
  size?: 'sm' | 'md'
}) {
  const palette = getAvatarPalette(id)
  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={cn(dim, 'rounded-full object-cover flex-shrink-0')}
      />
    )
  }
  return (
    <div
      className={cn(dim, 'rounded-full flex items-center justify-center font-semibold flex-shrink-0')}
      style={{ backgroundColor: palette.bg, color: palette.text }}
    >
      {getInitials(name)}
    </div>
  )
}

// ============================================
// CREATE CONTACT FORM
// ============================================

interface CreateContactFormData {
  phoneNumber: string
  firstName?: string
  lastName?: string
  email?: string
  companyName?: string
  designation?: string
}

function CreateContactForm({ onSubmit, onCancel, isLoading }: {
  onSubmit: (data: CreateContactFormData) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [designation, setDesignation] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phoneNumber.replace(/\D/g, '')
    if (!cleaned || cleaned.length < 10 || cleaned.length > 15) {
      toast.error('Telefone invalido. Use entre 10 e 15 digitos.')
      return
    }
    onSubmit({
      phoneNumber: cleaned,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      email: email.trim() || undefined,
      companyName: companyName.trim() || undefined,
      designation: designation.trim() || undefined,
    })
  }

  const inputStyle = {
    borderColor: 'var(--outline-gray-2)',
    backgroundColor: 'var(--surface-white)',
    color: 'var(--ink-gray-8)',
  }
  const labelStyle = { color: 'var(--ink-gray-6)' }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>Telefone *</Label>
        <Input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+55 11 99999-9999"
          className="h-8 text-sm rounded border"
          style={inputStyle}
          autoFocus
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={labelStyle}>Nome</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" className="h-8 text-sm rounded border" style={inputStyle} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={labelStyle}>Sobrenome</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sobrenome" className="h-8 text-sm rounded border" style={inputStyle} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="h-8 text-sm rounded border" style={inputStyle} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>Empresa</Label>
        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome da empresa" className="h-8 text-sm rounded border" style={inputStyle} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>Cargo</Label>
        <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Ex: Gerente de Vendas" className="h-8 text-sm rounded border" style={inputStyle} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 px-3 text-sm rounded border" style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-7)' }}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={isLoading} className="h-8 px-3 text-sm rounded text-white hover:opacity-90" style={{ backgroundColor: 'var(--surface-gray-7)' }}>
          {isLoading ? 'Criando...' : 'Criar Contato'}
        </Button>
      </div>
    </form>
  )
}

// ============================================
// VIEW SWITCHER
// ============================================

interface ViewSwitcherProps {
  current: ViewType
  onChange: (v: ViewType) => void
}

function ViewSwitcher({ current, onChange }: ViewSwitcherProps) {
  const views: Array<{ type: ViewType; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { type: 'list', icon: LayoutList, label: 'Lista' },
    { type: 'kanban', icon: Columns, label: 'Kanban' },
    { type: 'group_by', icon: Group, label: 'Agrupar' },
  ]

  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-lg"
      style={{ border: '1px solid var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
    >
      {views.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          aria-label={label}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: current === type ? 'var(--surface-white)' : 'transparent',
            color: current === type ? 'var(--ink-gray-9)' : 'var(--ink-gray-5)',
            boxShadow: current === type ? '0px 0px 1px rgba(0,0,0,0.15), 0px 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ============================================
// QUICK FILTER CHIP
// ============================================

interface QuickFilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function QuickFilterChip({ label, active, onClick }: QuickFilterChipProps) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap"
      style={{
        backgroundColor: active ? 'var(--surface-blue-2)' : 'var(--surface-gray-1)',
        color: active ? 'var(--ink-blue-3)' : 'var(--ink-gray-5)',
        border: active ? '1px solid #B3D9FF' : '1px solid var(--outline-gray-1)',
      }}
    >
      {label}
    </button>
  )
}

// ============================================
// KANBAN COLUMN
// ============================================

interface KanbanColumnProps {
  label: string
  color: string
  count: number
  leads: LeadListItem[]
  onEdit: (lead: LeadListItem) => void
  onDelete: (lead: LeadListItem) => void
}

function KanbanColumn({ label, color, count, leads, onEdit, onDelete }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-[272px]">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-semibold text-sm" style={{ color: 'var(--ink-gray-8)' }}>
          {label}
        </span>
        <span
          className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--surface-gray-2)',
            color: 'var(--ink-gray-5)',
          }}
        >
          {count}
        </span>
      </div>

      {/* Cards */}
      <div
        className="rounded-lg p-2 space-y-2 min-h-[200px]"
        style={{ backgroundColor: 'var(--surface-gray-1)' }}
      >
        {leads.map((lead) => {
          const palette = getAvatarPalette(lead.id)
          return (
            <div
              key={lead.id}
              className="rounded-lg p-3 cursor-pointer group"
              style={{
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--outline-gray-1)',
                boxShadow: '0px 0px 1px rgba(0,0,0,0.08), 0px 1px 2px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0px 0px 1px rgba(0,0,0,0.15), 0px 2px 6px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0px 0px 1px rgba(0,0,0,0.08), 0px 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--ink-gray-8)' }}>
                    {lead.lead_name}
                  </p>
                  {lead.organization_name && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--ink-gray-5)' }}>
                      {lead.organization_name}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      <MoreHorizontal className="h-3 w-3" style={{ color: 'var(--ink-gray-5)' }} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-40 rounded-lg border shadow-md"
                    style={{
                      backgroundColor: 'var(--surface-white)',
                      borderColor: 'var(--outline-gray-2)',
                    }}
                  >
                    <DropdownMenuItem
                      className="text-sm cursor-pointer"
                      style={{ color: 'var(--ink-gray-8)' }}
                      onClick={() => onEdit(lead)}
                    >
                      <Edit className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator style={{ backgroundColor: 'var(--outline-gray-1)' }} />
                    <DropdownMenuItem
                      className="text-sm cursor-pointer"
                      style={{ color: 'var(--ink-red-3)' }}
                      onClick={() => onDelete(lead)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-2.5 space-y-1">
                {lead.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ink-gray-4)' }} />
                    <span className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>
                      {lead.email}
                    </span>
                  </div>
                )}
                {lead.mobile_no && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ink-gray-4)' }} />
                    <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                      {lead.mobile_no}
                    </span>
                  </div>
                )}
              </div>

              {lead.lead_owner && (
                <div className="mt-2.5 flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                    style={{ backgroundColor: palette.bg, color: palette.text }}
                  >
                    {getInitials(lead.lead_owner.name)}
                  </div>
                  <span className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>
                    {lead.lead_owner.name}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {leads.length === 0 && (
          <div
            className="rounded-lg p-5 text-center"
            style={{ border: '1.5px dashed var(--outline-gray-2)' }}
          >
            <p className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
              Sem leads
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// TABLE SKELETON
// ============================================

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableRow key={i} className="border-b" style={{ borderColor: 'var(--outline-gray-1)' }}>
          <TableCell className="py-2.5 pl-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell className="py-2.5 hidden xl:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell className="py-2.5 pr-4"><Skeleton className="h-6 w-6 rounded ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ============================================
// STATS CARD
// ============================================

interface StatsCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  iconBg: string
  iconColor: string
}

function StatsCard({ title, value, icon: Icon, iconBg, iconColor }: StatsCardProps) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
          >
            {title}
          </p>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink-gray-9)' }}>
            {value}
          </p>
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function LeadsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()

  // UI state
  const [view, setView] = useState<ViewType>('list')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadListItem | null>(null)
  const [deletingLead, setDeletingLead] = useState<LeadListItem | null>(null)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const debouncedSearch = useDebounce(search, 400)

  const PAGE_SIZE = 20

  // ============================================
  // QUERIES
  // ============================================

  const listQuery = useQuery({
    queryKey: ['crm-leads-list', page, debouncedSearch, sortField, sortDir, activeFilter],
    queryFn: () =>
      crmApi.leads.list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        order_by: sortField,
        order_direction: sortDir,
        filters: activeFilter ? { status_type: activeFilter } : undefined,
      }),
    placeholderData: keepPreviousData,
    enabled: view === 'list',
    select: (res: Awaited<ReturnType<typeof crmApi.leads.list>>) => res.data,
  })

  const kanbanQuery = useQuery({
    queryKey: ['crm-leads-kanban', debouncedSearch, activeFilter],
    queryFn: () =>
      crmApi.leads.kanban({
        search: debouncedSearch || undefined,
      }),
    enabled: view === 'kanban',
    select: (res: Awaited<ReturnType<typeof crmApi.leads.kanban>>) => res.data,
  })

  const groupByQuery = useQuery({
    queryKey: ['crm-leads-groupby', debouncedSearch, activeFilter],
    queryFn: () =>
      crmApi.leads.groupBy({
        group_by_field: 'source_id',
        search: debouncedSearch || undefined,
      }),
    enabled: view === 'group_by',
    select: (res: Awaited<ReturnType<typeof crmApi.leads.groupBy>>) => res.data,
  })

  // Contacts query for list view
  const contactsListParams = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    sortBy: (sortField === 'lead_name' ? 'name' : sortField === 'created_at' ? 'createdAt' : 'updatedAt') as 'name' | 'createdAt' | 'updatedAt' | 'phoneNumber',
    sortOrder: sortDir,
  }

  const contactsQuery = useQuery({
    queryKey: ['contacts-list', contactsListParams],
    queryFn: () => contactService.list(contactsListParams),
    placeholderData: keepPreviousData,
    enabled: view === 'list',
  })

  const contacts = contactsQuery.data?.data ?? []
  const contactsTotalCount = contactsQuery.data?.pagination.total ?? 0
  const contactsTotalPages = contactsQuery.data?.pagination.totalPages ?? 0

  // ============================================
  // MUTATIONS
  // ============================================

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.leads.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads-list'] })
      queryClient.invalidateQueries({ queryKey: ['crm-leads-kanban'] })
      setDeletingLead(null)
      toast.success('Lead removido com sucesso.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Erro ao remover lead.')
    },
  })

  const deleteContactMutation = useMutation({
    mutationFn: (id: string) => contactService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts-list'] })
      toast.success('Contato removido com sucesso.')
    },
    onError: () => toast.error('Erro ao remover contato.'),
  })

  const createContactMutation = useMutation({
    mutationFn: (data: CreateContactFormData) =>
      contactService.create({
        phoneNumber: data.phoneNumber,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        email: data.email || undefined,
        companyName: data.companyName || undefined,
        designation: data.designation || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts-list'] })
      setIsCreateOpen(false)
      toast.success('Contato criado com sucesso.')
    },
    onError: () => toast.error('Erro ao criar contato.'),
  })

  // ============================================
  // HANDLERS
  // ============================================

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDir((d: 'asc' | 'desc') => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDir('asc')
      }
      setPage(1)
    },
    [sortField]
  )

  const handleFilterToggle = useCallback((filter: string | null) => {
    setActiveFilter((prev: string | null) => (prev === filter ? null : filter))
    setPage(1)
  }, [])

  const quickFilters: Array<{ label: string; value: string | null }> = [
    { label: 'Todos', value: null },
    { label: 'Abertos', value: 'Open' },
    { label: 'Em andamento', value: 'Ongoing' },
    { label: 'Em espera', value: 'OnHold' },
    { label: 'Perdidos', value: 'Lost' },
  ]

  // ============================================
  // STATS
  // ============================================

  const totalLeads = view === 'list' ? contactsTotalCount : (listQuery.data?.total_count ?? 0)
  const isLoading =
    (view === 'list' && contactsQuery.isLoading) ||
    (view === 'kanban' && kanbanQuery.isLoading) ||
    (view === 'group_by' && groupByQuery.isLoading)

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts-list'] })
    queryClient.invalidateQueries({ queryKey: ['crm-leads-kanban'] })
    queryClient.invalidateQueries({ queryKey: ['crm-leads-groupby'] })
  }

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1" />
    }
    return (
      <span className="ml-1 text-xs" style={{ color: 'var(--ink-blue-3)' }}>
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full">
      {/* ---- Page Header ---- */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Leads
          </h1>
          {!listQuery.isLoading && view === 'list' && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {totalLeads}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View Switcher */}
          <ViewSwitcher current={view} onChange={setView} />

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={refetch}
            disabled={isLoading}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
              style={{ color: 'var(--ink-gray-5)' }}
            />
          </Button>

          {/* Create Lead */}
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
            className="h-7 text-xs hover:opacity-90 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Novo Lead</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* ---- Stats Bar ---- */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        <StatsCard
          title="Total de Leads"
          value={totalLeads}
          icon={Target}
          iconBg="#E6F4FF"
          iconColor="#007BE0"
        />
        <StatsCard
          title="Em Andamento"
          value="—"
          icon={TrendingUp}
          iconBg="#FFF7D3"
          iconColor="#DB7706"
        />
        <StatsCard
          title="Convertidos"
          value="—"
          icon={CheckCircle2}
          iconBg="#E4FAEB"
          iconColor="#278F5E"
        />
        <StatsCard
          title="Atribuidos"
          value="—"
          icon={UserCheck}
          iconBg="#F3F0FF"
          iconColor="#6846E3"
        />
      </div>

      {/* ---- View Controls Bar ---- */}
      <div
        className="flex items-center gap-3 px-5 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-white)' }}
      >
        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <Input
            type="search"
            placeholder="Buscar por nome, email, empresa..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-7 text-xs border rounded"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          />
        </div>

        {/* Divider */}
        <div className="w-px h-4 flex-shrink-0" style={{ backgroundColor: 'var(--outline-gray-1)' }} />

        {/* Quick filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1">
          <Filter className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ink-gray-4)' }} />
          {quickFilters.map(({ label, value }) => (
            <QuickFilterChip
              key={label}
              label={label}
              active={activeFilter === value}
              onClick={() => handleFilterToggle(value)}
            />
          ))}
          {activeFilter && (
            <button
              onClick={() => setActiveFilter(null)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ---- Main Content ---- */}
      <div className="flex-1 overflow-auto">

        {/* ====== LIST VIEW (Contatos) ====== */}
        {view === 'list' && (
          <>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow
                    className="border-b"
                    style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
                  >
                    <TableHead className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Nome</TableHead>
                    <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Telefone</TableHead>
                    <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Email</TableHead>
                    <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--ink-gray-5)' }}>Empresa</TableHead>
                    <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--ink-gray-5)' }}>Canal</TableHead>
                    <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider hidden lg:table-cell text-right" style={{ color: 'var(--ink-gray-5)' }}>Conversas</TableHead>
                    <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider hidden xl:table-cell" style={{ color: 'var(--ink-gray-5)' }}>Ultima atividade</TableHead>
                    <TableHead className="py-2 pr-4 w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeleton />
                </TableBody>
              </Table>
            ) : contactsQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <p className="text-sm mb-2" style={{ color: 'var(--ink-gray-5)' }}>
                  Erro ao carregar contatos.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={refetch}
                  style={{ color: 'var(--ink-blue-3)' }}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'var(--surface-gray-2)' }}
                >
                  <Users className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
                  {debouncedSearch ? 'Nenhum contato encontrado' : 'Sem contatos'}
                </p>
                <p className="text-xs mb-5" style={{ color: 'var(--ink-gray-5)' }}>
                  {debouncedSearch
                    ? `Nenhum resultado para "${debouncedSearch}"`
                    : 'Adicione o primeiro contato para comecar'}
                </p>
                {!debouncedSearch && (
                  <Button
                    size="sm"
                    onClick={() => setIsCreateOpen(true)}
                    style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
                    className="hover:opacity-90"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Novo Contato
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow
                      className="border-b"
                      style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
                    >
                      <TableHead
                        className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                        style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
                        onClick={() => handleSort('lead_name')}
                      >
                        <span className="flex items-center">
                          Nome <SortIcon field="lead_name" />
                        </span>
                      </TableHead>
                      <TableHead
                        className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
                      >
                        Telefone
                      </TableHead>
                      <TableHead
                        className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
                      >
                        Email
                      </TableHead>
                      <TableHead
                        className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden md:table-cell"
                        style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
                      >
                        Empresa
                      </TableHead>
                      <TableHead
                        className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                        style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
                      >
                        Canal
                      </TableHead>
                      <TableHead
                        className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell text-right"
                        style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
                      >
                        Conversas
                      </TableHead>
                      <TableHead
                        className="py-2 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hidden xl:table-cell"
                        style={{ color: 'var(--ink-gray-5)', letterSpacing: '0.04em' }}
                        onClick={() => handleSort('created_at')}
                      >
                        <span className="flex items-center">
                          Ultima atividade <SortIcon field="created_at" />
                        </span>
                      </TableHead>
                      <TableHead className="py-2 pr-4 w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => {
                      const displayName = getDisplayName(contact)
                      const conversationCount = contact._count?.conversations ?? 0

                      return (
                        <TableRow
                          key={contact.id}
                          className="border-b cursor-pointer transition-colors group"
                          style={{ borderColor: 'var(--outline-gray-1)' }}
                          onClick={() => router.push(`/crm/leads/${contact.id}`)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = ''
                          }}
                        >
                          {/* Nome — Avatar + name */}
                          <TableCell className="py-2.5 pl-4">
                            <div className="flex items-center gap-2">
                              <ContactAvatar
                                imageUrl={contact.profilePictureUrl}
                                name={displayName}
                                id={contact.id}
                                size="md"
                              />
                              <span
                                className="text-sm font-medium truncate max-w-[180px]"
                                style={{ color: 'var(--ink-gray-8)' }}
                              >
                                {displayName}
                              </span>
                            </div>
                          </TableCell>

                          {/* Telefone */}
                          <TableCell className="py-2.5">
                            <span className="text-sm font-mono" style={{ color: 'var(--ink-gray-6)' }}>
                              {contactService.formatPhoneNumber(contact.phoneNumber)}
                            </span>
                          </TableCell>

                          {/* Email */}
                          <TableCell className="py-2.5">
                            {contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-sm hover:underline truncate max-w-[200px] block"
                                style={{ color: 'var(--ink-gray-6)' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {contact.email}
                              </a>
                            ) : (
                              <span className="text-sm" style={{ color: 'var(--ink-gray-4)' }}>—</span>
                            )}
                          </TableCell>

                          {/* Empresa */}
                          <TableCell className="py-2.5 hidden md:table-cell">
                            {contact.companyName ? (
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                                  style={{
                                    backgroundColor: 'var(--surface-gray-2)',
                                    color: 'var(--ink-gray-5)',
                                  }}
                                >
                                  {contact.companyName.substring(0, 2).toUpperCase()}
                                </div>
                                <span
                                  className="text-sm truncate max-w-[160px]"
                                  style={{ color: 'var(--ink-gray-6)' }}
                                >
                                  {contact.companyName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm" style={{ color: 'var(--ink-gray-4)' }}>—</span>
                            )}
                          </TableCell>

                          {/* Canal */}
                          <TableCell className="py-2.5 hidden lg:table-cell">
                            <ChannelBadge channel={contact.channel} />
                          </TableCell>

                          {/* Conversas */}
                          <TableCell className="py-2.5 hidden lg:table-cell text-right">
                            <span className="text-sm tabular-nums" style={{ color: 'var(--ink-gray-6)' }}>
                              {conversationCount > 0 ? conversationCount : (
                                <span style={{ color: 'var(--ink-gray-4)' }}>0</span>
                              )}
                            </span>
                          </TableCell>

                          {/* Ultima atividade */}
                          <TableCell className="py-2.5 hidden xl:table-cell">
                            <span
                              className="text-sm"
                              style={{ color: 'var(--ink-gray-5)' }}
                              title={contact.updatedAt ? format(new Date(contact.updatedAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR }) : ''}
                            >
                              {contact.updatedAt
                                ? formatDistanceToNow(new Date(contact.updatedAt), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })
                                : '—'}
                            </span>
                          </TableCell>

                          {/* Acoes */}
                          <TableCell className="py-2.5 pr-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Acoes"
                                >
                                  <MoreHorizontal
                                    className="h-4 w-4"
                                    style={{ color: 'var(--ink-gray-5)' }}
                                  />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-40 rounded-lg border shadow-md"
                                style={{
                                  backgroundColor: 'var(--surface-white)',
                                  borderColor: 'var(--outline-gray-2)',
                                }}
                              >
                                <DropdownMenuItem
                                  className="text-sm cursor-pointer"
                                  style={{ color: 'var(--ink-red-3)' }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteContactMutation.mutate(contact.id)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {contactsTotalPages > 1 && (
                  <div
                    className="flex items-center justify-between px-5 py-2.5 border-t flex-shrink-0"
                    style={{
                      borderColor: 'var(--outline-gray-1)',
                      backgroundColor: 'var(--surface-gray-1)',
                    }}
                  >
                    <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, contactsTotalCount)} de {contactsTotalCount}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-7 text-xs px-2.5"
                        style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-7)' }}
                      >
                        Anterior
                      </Button>
                      <span className="text-xs px-2" style={{ color: 'var(--ink-gray-5)' }}>
                        {page} / {contactsTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p: number) => Math.min(contactsTotalPages, p + 1))}
                        disabled={page >= contactsTotalPages}
                        className="h-7 text-xs px-2.5"
                        style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-7)' }}
                      >
                        Proximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ====== KANBAN VIEW ====== */}
        {view === 'kanban' && (
          <div className="p-5">
            {kanbanQuery.isLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[272px]">
                    <Skeleton className="h-6 w-32 rounded-full mb-3" />
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <Skeleton key={j} className="h-24 w-full rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : kanbanQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
                  Erro ao carregar o Kanban.
                </p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
                {kanbanQuery.data?.columns?.map((col) => (
                  <KanbanColumn
                    key={col.column_id ?? 'no-status'}
                    label={col.column_value ?? 'Sem status'}
                    color={col.color ?? '#94a3b8'}
                    count={col.count}
                    leads={col.data}
                    onEdit={setEditingLead}
                    onDelete={setDeletingLead}
                  />
                ))}
                {!kanbanQuery.data?.columns?.length && (
                  <div
                    className="flex-1 flex items-center justify-center"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    <p className="text-sm">Nenhum lead para exibir</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====== GROUP BY VIEW ====== */}
        {view === 'group_by' && (
          <div className="p-5">
            {groupByQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : groupByQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
                  Erro ao carregar agrupamento.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {groupByQuery.data?.buckets?.map((bucket) => (
                  <div
                    key={bucket.group_id ?? 'ungrouped'}
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--outline-gray-1)' }}
                  >
                    {/* Group header */}
                    <div
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ backgroundColor: 'var(--surface-gray-1)' }}
                    >
                      <div className="flex items-center gap-2">
                        <Group className="w-4 h-4" style={{ color: 'var(--ink-gray-4)' }} />
                        <span
                          className="font-semibold text-sm"
                          style={{ color: 'var(--ink-gray-8)' }}
                        >
                          {bucket.group_value ?? 'Sem origem'}
                        </span>
                      </div>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: 'var(--surface-gray-2)',
                          color: 'var(--ink-gray-5)',
                        }}
                      >
                        {bucket.count}
                      </span>
                    </div>

                    {/* Group rows */}
                    <div
                      className="divide-y"
                      style={{ borderColor: 'var(--outline-gray-1)' }}
                    >
                      {(bucket.data ?? []).slice(0, 5).map((lead) => {
                        const palette = getAvatarPalette(lead.id)
                        return (
                          <div
                            key={lead.id}
                            className="flex items-center gap-4 px-4 py-2.5 transition-colors"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = ''
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
                              style={{ backgroundColor: palette.bg, color: palette.text }}
                            >
                              {getInitials(lead.lead_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{ color: 'var(--ink-gray-8)' }}
                              >
                                {lead.lead_name}
                              </p>
                              {lead.email && (
                                <p className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>
                                  {lead.email}
                                </p>
                              )}
                            </div>
                            <span
                              className="inline-flex items-center text-xs font-medium px-2 py-0.5 flex-shrink-0"
                              style={{
                                backgroundColor: `${getStatusColor(lead.status.color)}18`,
                                color: getStatusColor(lead.status.color),
                                borderRadius: '999px',
                                border: `1px solid ${getStatusColor(lead.status.color)}30`,
                              }}
                            >
                              {lead.status.label}
                            </span>
                          </div>
                        )
                      })}
                      {bucket.count > 5 && (
                        <div className="px-4 py-2 text-center">
                          <button
                            className="text-xs transition-colors"
                            style={{ color: 'var(--ink-blue-3)' }}
                          >
                            Ver mais {bucket.count - 5} leads
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!groupByQuery.data?.buckets?.length && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
                      Nenhum lead para agrupar.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====== CREATE CONTACT DIALOG ====== */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          className="max-w-md rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-sm font-semibold"
              style={{ color: 'var(--ink-gray-9)' }}
            >
              Novo Contato
            </DialogTitle>
          </DialogHeader>
          <CreateContactForm
            onSubmit={(data) => createContactMutation.mutate(data)}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createContactMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ====== EDIT DIALOG ====== */}
      <Dialog open={!!editingLead} onOpenChange={(open: boolean) => !open && setEditingLead(null)}>
        <DialogContent
          className="max-w-lg rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-sm font-semibold"
              style={{ color: 'var(--ink-gray-9)' }}
            >
              Editar Lead
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Atualize as informacoes de {editingLead?.lead_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: 'var(--surface-gray-2)' }}
            >
              <Edit className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Formulario de edicao em construcao.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-sm px-3 rounded"
              style={{
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-7)',
                backgroundColor: 'var(--surface-white)',
              }}
              onClick={() => setEditingLead(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE ALERT ====== */}
      <AlertDialog
        open={!!deletingLead}
        onOpenChange={(open: boolean) => !open && setDeletingLead(null)}
      >
        <AlertDialogContent
          className="rounded-xl border shadow-lg max-w-sm"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-sm font-semibold"
              style={{ color: 'var(--ink-gray-9)' }}
            >
              Confirmar exclusao
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja remover o lead{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>{deletingLead?.lead_name}</strong>?
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="text-sm h-8 px-3 rounded border"
              style={{
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-7)',
                backgroundColor: 'var(--surface-white)',
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLead && deleteMutation.mutate(deletingLead.id)}
              disabled={deleteMutation.isPending}
              className="text-sm h-8 px-3 rounded text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--ink-red-3)' }}
            >
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
