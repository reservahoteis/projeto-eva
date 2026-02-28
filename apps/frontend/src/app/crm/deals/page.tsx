'use client'

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/use-debounce'
import { crmApi } from '@/services/crm/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuLabel,
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
  Handshake,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  LayoutList,
  Columns,
  Group,
  ArrowUpDown,
  Filter,
  X,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { DealListItem, ViewType } from '@/types/crm'

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

function formatCurrency(value: number | null, currency = 'BRL'): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '4px',
        borderRadius: '10px',
        backgroundColor: 'var(--surface-gray-2)',
        border: '1px solid var(--outline-gray-1)',
      }}
    >
      {views.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          aria-label={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
            backgroundColor: current === type ? 'var(--surface-white)' : 'transparent',
            color: current === type ? 'var(--ink-gray-9)' : 'var(--ink-gray-5)',
            boxShadow: current === type ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ============================================
// PROBABILITY INDICATOR
// ============================================

function ProbabilityBar({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--ink-gray-4)', fontSize: '12px' }}>—</span>

  const color =
    value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          flex: 1,
          height: '6px',
          borderRadius: '9999px',
          backgroundColor: 'var(--surface-gray-2)',
          overflow: 'hidden',
          maxWidth: '60px',
        }}
      >
        <div
          style={{ width: `${value}%`, height: '100%', borderRadius: '9999px', backgroundColor: color, transition: 'all 0.3s' }}
        />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 500, color }}>{value}%</span>
    </div>
  )
}

// ============================================
// KANBAN COLUMN
// ============================================

interface KanbanColumnProps {
  label: string
  color: string
  count: number
  deals: DealListItem[]
  onEdit: (deal: DealListItem) => void
  onDelete: (deal: DealListItem) => void
}

function KanbanColumn({ label, color, count, deals, onEdit, onDelete }: KanbanColumnProps) {
  const totalValue = deals.reduce((sum, d) => sum + (d.deal_value ?? 0), 0)

  return (
    <div style={{ flexShrink: 0, width: '288px' }}>
      {/* Column Header */}
      <div style={{ marginBottom: '12px', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, backgroundColor: color }}
          />
          <span style={{ fontWeight: 600, color: 'var(--ink-gray-9)', fontSize: '13px' }}>{label}</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--ink-gray-5)',
              backgroundColor: 'var(--surface-gray-2)',
              padding: '2px 8px',
              borderRadius: '9999px',
            }}
          >
            {count}
          </span>
        </div>
        {totalValue > 0 && (
          <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)', marginTop: '4px', paddingLeft: '18px' }}>
            {formatCurrency(totalValue)}
          </p>
        )}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {deals.map((deal) => (
          <KanbanCard
            key={deal.id}
            deal={deal}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}

        {deals.length === 0 && (
          <div
            style={{
              border: '2px dashed var(--outline-gray-2)',
              borderRadius: '10px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '12px', color: 'var(--ink-gray-4)' }}>Sem negociações</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface KanbanCardProps {
  deal: DealListItem
  onEdit: (deal: DealListItem) => void
  onDelete: (deal: DealListItem) => void
}

function KanbanCard({ deal, onEdit, onDelete }: KanbanCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '10px',
        padding: '16px',
        cursor: 'pointer',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--ink-gray-9)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {deal.organization_name ?? deal.lead_name ?? 'Sem nome'}
          </p>
          {deal.email && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--ink-gray-5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '2px',
              }}
            >
              {deal.email}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              style={{
                height: '24px',
                width: '24px',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.15s',
              }}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--outline-gray-1)',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }}
          >
            <DropdownMenuItem onClick={() => onEdit(deal)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              style={{ color: '#dc2626' }}
              onClick={() => onDelete(deal)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {deal.deal_value !== null && (
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <DollarSign style={{ width: '12px', height: '12px', color: '#10b981', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>
            {formatCurrency(deal.deal_value, deal.currency)}
          </span>
        </div>
      )}

      {deal.probability !== null && (
        <div style={{ marginTop: '8px' }}>
          <ProbabilityBar value={deal.probability} />
        </div>
      )}

      {deal.expected_closure_date && (
        <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)', marginTop: '8px' }}>
          Fechamento: {format(new Date(deal.expected_closure_date), 'dd/MM/yyyy')}
        </p>
      )}
    </div>
  )
}

// ============================================
// LIST SKELETON
// ============================================

function ListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px' }}>
          <Skeleton
            style={{ height: '36px', width: '36px', borderRadius: '10px', flexShrink: 0, backgroundColor: 'var(--surface-gray-2)' }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton style={{ height: '14px', width: '192px', backgroundColor: 'var(--surface-gray-2)' }} />
            <Skeleton style={{ height: '12px', width: '128px', backgroundColor: 'var(--surface-gray-2)' }} />
          </div>
          <Skeleton style={{ height: '22px', width: '96px', borderRadius: '9999px', backgroundColor: 'var(--surface-gray-2)' }} />
          <Skeleton className="hidden lg:block" style={{ height: '14px', width: '80px', backgroundColor: 'var(--surface-gray-2)' }} />
          <Skeleton style={{ height: '32px', width: '32px', borderRadius: '8px', backgroundColor: 'var(--surface-gray-2)' }} />
        </div>
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
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: active ? '1px solid #10b981' : '1px solid var(--outline-gray-2)',
        backgroundColor: active
          ? 'rgba(16, 185, 129, 0.1)'
          : hovered
          ? 'var(--surface-gray-2)'
          : 'var(--surface-white)',
        color: active ? '#059669' : hovered ? 'var(--ink-gray-8)' : 'var(--ink-gray-5)',
      }}
    >
      {label}
    </button>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function DealsPage() {
  const queryClient = useQueryClient()

  const [view, setView] = useState<ViewType>('list')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealListItem | null>(null)
  const [deletingDeal, setDeletingDeal] = useState<DealListItem | null>(null)
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const debouncedSearch = useDebounce(search, 400)
  const PAGE_SIZE = 20

  // ============================================
  // QUERIES
  // ============================================

  const listQuery = useQuery({
    queryKey: ['crm-deals-list', page, debouncedSearch, sortField, sortDir, activeFilter],
    queryFn: () =>
      crmApi.deals.list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        order_by: sortField,
        order_direction: sortDir,
        filters: activeFilter ? { status_type: activeFilter } : undefined,
      }),
    placeholderData: keepPreviousData,
    enabled: view === 'list',
    select: (res: Awaited<ReturnType<typeof crmApi.deals.list>>) => res.data,
  })

  const kanbanQuery = useQuery({
    queryKey: ['crm-deals-kanban', debouncedSearch],
    queryFn: () =>
      crmApi.deals.kanban({ search: debouncedSearch || undefined }),
    enabled: view === 'kanban',
    select: (res: Awaited<ReturnType<typeof crmApi.deals.kanban>>) => res.data,
  })

  const groupByQuery = useQuery({
    queryKey: ['crm-deals-groupby', debouncedSearch],
    queryFn: () =>
      crmApi.deals.groupBy({
        group_by_field: 'deal_owner_id',
        search: debouncedSearch || undefined,
      }),
    enabled: view === 'group_by',
    select: (res: Awaited<ReturnType<typeof crmApi.deals.groupBy>>) => res.data,
  })

  // ============================================
  // MUTATIONS
  // ============================================

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deals.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals-list'] })
      queryClient.invalidateQueries({ queryKey: ['crm-deals-kanban'] })
      setDeletingDeal(null)
      toast.success('Negociação removida com sucesso.')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Erro ao remover negociação.')
    },
  })

  const markWonMutation = useMutation({
    mutationFn: (id: string) => crmApi.deals.markWon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals-list'] })
      queryClient.invalidateQueries({ queryKey: ['crm-deals-kanban'] })
      toast.success('Negociação marcada como ganha.')
    },
    onError: () => toast.error('Erro ao marcar como ganha.'),
  })

  const markLostMutation = useMutation({
    mutationFn: (id: string) => crmApi.deals.markLost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals-list'] })
      queryClient.invalidateQueries({ queryKey: ['crm-deals-kanban'] })
      toast.success('Negociação marcada como perdida.')
    },
    onError: () => toast.error('Erro ao marcar como perdida.'),
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

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-deals-list'] })
    queryClient.invalidateQueries({ queryKey: ['crm-deals-kanban'] })
    queryClient.invalidateQueries({ queryKey: ['crm-deals-groupby'] })
  }

  const quickFilters: Array<{ label: string; value: string | null }> = [
    { label: 'Todos', value: null },
    { label: 'Abertos', value: 'Open' },
    { label: 'Em andamento', value: 'Ongoing' },
    { label: 'Em espera', value: 'OnHold' },
    { label: 'Ganhos', value: 'Won' },
    { label: 'Perdidos', value: 'Lost' },
  ]

  const isLoading =
    (view === 'list' && listQuery.isLoading) ||
    (view === 'kanban' && kanbanQuery.isLoading) ||
    (view === 'group_by' && groupByQuery.isLoading)

  // ============================================
  // STATS CARDS
  // ============================================

  const statsCards = [
    {
      title: 'TOTAL DE NEGÓCIOS',
      value: listQuery.data?.total_count ?? '—',
      icon: Handshake,
      iconBg: '#2563EB',
    },
    {
      title: 'EM ANDAMENTO',
      value: '—',
      icon: TrendingUp,
      iconBg: '#f97316',
    },
    {
      title: 'GANHOS',
      value: '—',
      icon: Trophy,
      iconBg: '#10b981',
    },
    {
      title: 'PERDIDOS',
      value: '—',
      icon: XCircle,
      iconBg: '#8b5cf6',
    },
  ]

  // ============================================
  // RENDER
  // ============================================

  return (
    <div
      style={{
        padding: '24px',
        minHeight: '100vh',
        backgroundColor: 'var(--surface-gray-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--ink-gray-9)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Negociações
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--ink-gray-5)', marginTop: '2px' }}>
            Acompanhe seus deals e pipeline de vendas
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="hidden sm:block">
            <ViewSwitcher current={view} onChange={setView} />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={refetch}
            disabled={isLoading}
            style={{
              border: '1px solid var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-7)',
            }}
            aria-label="Atualizar"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            style={{
              backgroundColor: '#2563EB',
              color: '#ffffff',
              border: 'none',
              fontWeight: 500,
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Nova Negociação</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
        }}
        className="lg:grid-cols-4"
      >
        {statsCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              style={{
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--outline-gray-1)',
                borderRadius: '10px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--ink-gray-5)',
                      letterSpacing: '0.08em',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {stat.title}
                  </p>
                  <p
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: 'var(--ink-gray-9)',
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: stat.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: '#ffffff' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main Content Card */}
      <div
        style={{
          backgroundColor: 'var(--surface-white)',
          border: '1px solid var(--outline-gray-1)',
          borderRadius: '10px',
          padding: '20px',
        }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-gray-4)',
                  width: '16px',
                  height: '16px',
                }}
              />
              <Input
                type="search"
                placeholder="Buscar por empresa, lead, email..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                style={{
                  paddingLeft: '40px',
                  height: '36px',
                  backgroundColor: 'var(--surface-white)',
                  border: '1px solid var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
            </div>
            <div className="sm:hidden">
              <ViewSwitcher current={view} onChange={setView} />
            </div>
            {view === 'list' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSort('deal_value')}
                style={{
                  border: '1px solid var(--outline-gray-2)',
                  backgroundColor: 'var(--surface-white)',
                  color: 'var(--ink-gray-7)',
                  fontSize: '13px',
                  display: 'none',
                }}
                className="sm:flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Ordenar
              </Button>
            )}
          </div>

          {/* Quick filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <Filter style={{ width: '14px', height: '14px', color: 'var(--ink-gray-4)', flexShrink: 0 }} />
            {quickFilters.map(({ label, value }) => (
              <QuickFilterChip
                key={label}
                label={label}
                active={activeFilter === value}
                onClick={() => {
                  setActiveFilter((prev: string | null) => (prev === value ? null : value))
                  setPage(1)
                }}
              />
            ))}
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  color: 'var(--ink-gray-5)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink-gray-9)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-gray-5)' }}
              >
                <X style={{ width: '12px', height: '12px' }} />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* ====== LIST VIEW ====== */}
        {view === 'list' && (
          <>
            {isLoading ? (
              <ListSkeleton />
            ) : listQuery.isError ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ color: 'var(--ink-gray-5)', marginBottom: '12px' }}>Erro ao carregar negociações.</p>
                <Button variant="link" onClick={refetch}>
                  Tentar novamente
                </Button>
              </div>
            ) : !listQuery.data?.data.length ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <Handshake
                  style={{
                    width: '48px',
                    height: '48px',
                    color: 'var(--ink-gray-4)',
                    margin: '0 auto 12px',
                    opacity: 0.4,
                    display: 'block',
                  }}
                />
                <p style={{ fontWeight: 500, color: 'var(--ink-gray-9)' }}>
                  {debouncedSearch ? 'Nenhuma negociação encontrada' : 'Nenhuma negociação cadastrada'}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--ink-gray-5)', marginTop: '4px' }}>
                  {debouncedSearch
                    ? `Sem resultados para "${debouncedSearch}"`
                    : 'Comece criando a primeira negociação'}
                </p>
                {!debouncedSearch && (
                  <Button
                    style={{
                      marginTop: '16px',
                      backgroundColor: '#2563EB',
                      color: '#ffffff',
                      border: 'none',
                    }}
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Negociação
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div
                  className="hidden md:block"
                  style={{
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid var(--outline-gray-1)',
                  }}
                >
                  <Table>
                    <TableHeader>
                      <TableRow style={{ backgroundColor: 'var(--surface-gray-2)', borderBottom: '1px solid var(--outline-gray-1)' }}>
                        <TableHead
                          style={{
                            color: 'var(--ink-gray-5)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('organization_name')}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink-gray-9)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-gray-5)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Negociação
                            <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                          </div>
                        </TableHead>
                        <TableHead style={{ color: 'var(--ink-gray-5)', fontSize: '12px', fontWeight: 600 }}>
                          Status
                        </TableHead>
                        <TableHead
                          style={{
                            color: 'var(--ink-gray-5)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('deal_value')}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink-gray-9)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-gray-5)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Valor
                            <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                          </div>
                        </TableHead>
                        <TableHead
                          className="hidden lg:table-cell"
                          style={{ color: 'var(--ink-gray-5)', fontSize: '12px', fontWeight: 600 }}
                        >
                          Probabilidade
                        </TableHead>
                        <TableHead
                          className="hidden xl:table-cell"
                          style={{ color: 'var(--ink-gray-5)', fontSize: '12px', fontWeight: 600 }}
                        >
                          Responsável
                        </TableHead>
                        <TableHead
                          className="hidden lg:table-cell"
                          style={{
                            color: 'var(--ink-gray-5)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleSort('expected_closure_date')}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink-gray-9)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-gray-5)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Fechamento
                            <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                          </div>
                        </TableHead>
                        <TableHead
                          style={{
                            color: 'var(--ink-gray-5)',
                            fontSize: '12px',
                            fontWeight: 600,
                            textAlign: 'right',
                          }}
                        >
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listQuery.data.data.map((deal) => (
                        <TableRow
                          key={deal.id}
                          style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
                        >
                          <TableCell>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '10px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#10b981',
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  flexShrink: 0,
                                }}
                              >
                                {getInitials(deal.organization_name ?? deal.lead_name ?? 'N/A')}
                              </div>
                              <div>
                                <p style={{ fontWeight: 500, fontSize: '13px', color: 'var(--ink-gray-9)' }}>
                                  {deal.organization_name ?? deal.lead_name ?? 'Sem nome'}
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                                  {deal.naming_series}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                border: 'none',
                                backgroundColor: `${getStatusColor(deal.status.color)}18`,
                                color: getStatusColor(deal.status.color),
                              }}
                            >
                              {deal.status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#10b981' }}>
                              {formatCurrency(deal.deal_value, deal.currency)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <ProbabilityBar value={deal.probability} />
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {deal.deal_owner ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#10b981',
                                    fontWeight: 600,
                                    fontSize: '10px',
                                    flexShrink: 0,
                                  }}
                                >
                                  {getInitials(deal.deal_owner.name)}
                                </div>
                                <span
                                  style={{
                                    fontSize: '13px',
                                    color: 'var(--ink-gray-7)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '100px',
                                  }}
                                >
                                  {deal.deal_owner.name}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--ink-gray-4)', fontSize: '13px' }}>Não atribuído</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell" style={{ fontSize: '13px', color: 'var(--ink-gray-5)' }}>
                            {deal.expected_closure_date
                              ? format(new Date(deal.expected_closure_date), 'dd/MM/yyyy')
                              : '—'}
                          </TableCell>
                          <TableCell style={{ textAlign: 'right' }}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  style={{ color: 'var(--ink-gray-5)' }}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                style={{
                                  backgroundColor: 'var(--surface-white)',
                                  border: '1px solid var(--outline-gray-1)',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                }}
                              >
                                <DropdownMenuLabel style={{ color: 'var(--ink-gray-5)', fontSize: '12px' }}>
                                  Ações
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator style={{ backgroundColor: 'var(--outline-gray-1)' }} />
                                <DropdownMenuItem
                                  onClick={() => setEditingDeal(deal)}
                                  style={{ color: 'var(--ink-gray-8)' }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => markWonMutation.mutate(deal.id)}
                                  disabled={deal.status.status_type === 'Won'}
                                  style={{ color: 'var(--ink-gray-8)' }}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" style={{ color: '#10b981' }} />
                                  Marcar como Ganho
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => markLostMutation.mutate(deal.id)}
                                  disabled={deal.status.status_type === 'Lost'}
                                  style={{ color: 'var(--ink-gray-8)' }}
                                >
                                  <XCircle className="mr-2 h-4 w-4" style={{ color: '#ef4444' }} />
                                  Marcar como Perdido
                                </DropdownMenuItem>
                                <DropdownMenuSeparator style={{ backgroundColor: 'var(--outline-gray-1)' }} />
                                <DropdownMenuItem
                                  style={{ color: '#dc2626' }}
                                  onClick={() => setDeletingDeal(deal)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {listQuery.data.data.map((deal) => (
                    <div
                      key={deal.id}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: '1px solid var(--outline-gray-1)',
                        backgroundColor: 'var(--surface-white)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#10b981',
                              fontWeight: 600,
                              fontSize: '13px',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(deal.organization_name ?? deal.lead_name ?? 'N/A')}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontWeight: 500,
                                fontSize: '13px',
                                color: 'var(--ink-gray-9)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {deal.organization_name ?? deal.lead_name ?? 'Sem nome'}
                            </p>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', marginTop: '2px' }}>
                              {formatCurrency(deal.deal_value, deal.currency)}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              style={{ flexShrink: 0, height: '32px', width: '32px', color: 'var(--ink-gray-5)' }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            style={{
                              backgroundColor: 'var(--surface-white)',
                              border: '1px solid var(--outline-gray-1)',
                              borderRadius: '8px',
                              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                            }}
                          >
                            <DropdownMenuItem
                              onClick={() => setEditingDeal(deal)}
                              style={{ color: 'var(--ink-gray-8)' }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              style={{ color: '#dc2626' }}
                              onClick={() => setDeletingDeal(deal)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid var(--outline-gray-1)',
                        }}
                      >
                        <Badge
                          variant="secondary"
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            border: 'none',
                            backgroundColor: `${getStatusColor(deal.status.color)}18`,
                            color: getStatusColor(deal.status.color),
                          }}
                        >
                          {deal.status.label}
                        </Badge>
                        <ProbabilityBar value={deal.probability} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {listQuery.data.total_count > PAGE_SIZE && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '20px',
                      paddingTop: '16px',
                      borderTop: '1px solid var(--outline-gray-1)',
                    }}
                  >
                    <p style={{ fontSize: '13px', color: 'var(--ink-gray-5)' }}>
                      Mostrando {listQuery.data.data.length} de {listQuery.data.total_count}{' '}
                      negociações
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        style={{
                          border: '1px solid var(--outline-gray-2)',
                          backgroundColor: 'var(--surface-white)',
                          color: 'var(--ink-gray-7)',
                          fontSize: '13px',
                        }}
                      >
                        Anterior
                      </Button>
                      <span style={{ fontSize: '13px', color: 'var(--ink-gray-5)', padding: '0 8px' }}>
                        {page} / {Math.ceil(listQuery.data.total_count / PAGE_SIZE)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p: number) => p + 1)}
                        disabled={page >= Math.ceil(listQuery.data.total_count / PAGE_SIZE)}
                        style={{
                          border: '1px solid var(--outline-gray-2)',
                          backgroundColor: 'var(--surface-white)',
                          color: 'var(--ink-gray-7)',
                          fontSize: '13px',
                        }}
                      >
                        Próximo
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
          <>
            {kanbanQuery.isLoading ? (
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ flexShrink: 0, width: '288px' }}>
                    <Skeleton
                      style={{
                        height: '28px',
                        width: '160px',
                        borderRadius: '9999px',
                        marginBottom: '12px',
                        backgroundColor: 'var(--surface-gray-2)',
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Array.from({ length: 3 }).map((_, j) => (
                        <Skeleton
                          key={j}
                          style={{
                            height: '128px',
                            width: '100%',
                            borderRadius: '10px',
                            backgroundColor: 'var(--surface-gray-2)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : kanbanQuery.isError ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '80px 0',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)' }}>
                  Erro ao carregar o Kanban.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  overflowX: 'auto',
                  paddingBottom: '16px',
                  minHeight: '400px',
                }}
              >
                {kanbanQuery.data?.columns.map((col) => (
                  <KanbanColumn
                    key={col.column_id ?? 'no-status'}
                    label={col.column_value ?? 'Sem status'}
                    color={col.color ?? '#94a3b8'}
                    count={col.count}
                    deals={col.data}
                    onEdit={setEditingDeal}
                    onDelete={setDeletingDeal}
                  />
                ))}
                {!kanbanQuery.data?.columns?.length && (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--ink-gray-5)',
                    }}
                  >
                    <p>Nenhuma negociação para exibir</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ====== GROUP BY VIEW ====== */}
        {view === 'group_by' && (
          <>
            {groupByQuery.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    style={{
                      height: '80px',
                      width: '100%',
                      borderRadius: '10px',
                      backgroundColor: 'var(--surface-gray-2)',
                    }}
                  />
                ))}
              </div>
            ) : groupByQuery.isError ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '80px 0',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)' }}>
                  Erro ao carregar agrupamento.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {groupByQuery.data?.buckets?.map((bucket) => (
                  <div
                    key={bucket.group_id ?? 'ungrouped'}
                    style={{
                      border: '1px solid var(--outline-gray-1)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 20px',
                        backgroundColor: 'var(--surface-gray-1)',
                        borderBottom: '1px solid var(--outline-gray-1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Group style={{ width: '16px', height: '16px', color: 'var(--ink-gray-4)' }} />
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink-gray-9)' }}>
                          {bucket.group_value ?? 'Sem responsável'}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: 'var(--surface-gray-2)',
                          color: 'var(--ink-gray-5)',
                          border: 'none',
                          fontSize: '12px',
                        }}
                      >
                        {bucket.count}
                      </Badge>
                    </div>
                    <div>
                      {bucket.data.slice(0, 5).map((deal) => (
                        <div
                          key={deal.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '12px 20px',
                            borderBottom: '1px solid var(--outline-gray-1)',
                            transition: 'background-color 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: '13px',
                                fontWeight: 500,
                                color: 'var(--ink-gray-9)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {deal.organization_name ?? deal.lead_name ?? 'Sem nome'}
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                              {deal.naming_series}
                            </p>
                          </div>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#10b981',
                              flexShrink: 0,
                            }}
                          >
                            {formatCurrency(deal.deal_value, deal.currency)}
                          </span>
                          <Badge
                            variant="secondary"
                            style={{
                              fontSize: '12px',
                              border: 'none',
                              flexShrink: 0,
                              backgroundColor: `${getStatusColor(deal.status.color)}18`,
                              color: getStatusColor(deal.status.color),
                            }}
                          >
                            {deal.status.label}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!groupByQuery.data?.buckets?.length && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '48px 0',
                      color: 'var(--ink-gray-5)',
                    }}
                  >
                    Nenhuma negociação para agrupar.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ====== CREATE DIALOG ====== */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          style={{
            maxWidth: '512px',
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            borderRadius: '12px',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--ink-gray-9)', fontWeight: 600 }}>
              Nova Negociação
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>
              Preencha os dados para criar uma nova negociação.
            </DialogDescription>
          </DialogHeader>
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-gray-5)' }}>
            <Handshake
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 12px',
                opacity: 0.3,
                display: 'block',
                color: 'var(--ink-gray-4)',
              }}
            />
            <p style={{ fontSize: '13px' }}>Formulário de criação em construção.</p>
            <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--ink-gray-4)' }}>
              O componente DealForm será implementado na próxima sprint.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              variant="outline"
              style={{
                border: '1px solid var(--outline-gray-2)',
                backgroundColor: 'var(--surface-white)',
                color: 'var(--ink-gray-7)',
              }}
              onClick={() => setIsCreateOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== EDIT DIALOG ====== */}
      <Dialog open={!!editingDeal} onOpenChange={(open: boolean) => !open && setEditingDeal(null)}>
        <DialogContent
          style={{
            maxWidth: '512px',
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            borderRadius: '12px',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--ink-gray-9)', fontWeight: 600 }}>
              Editar Negociação
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>
              Atualize as informações de{' '}
              {editingDeal?.organization_name ?? editingDeal?.lead_name ?? 'esta negociação'}.
            </DialogDescription>
          </DialogHeader>
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-gray-5)' }}>
            <Edit
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 12px',
                opacity: 0.3,
                display: 'block',
                color: 'var(--ink-gray-4)',
              }}
            />
            <p style={{ fontSize: '13px' }}>Formulário de edição em construção.</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              variant="outline"
              style={{
                border: '1px solid var(--outline-gray-2)',
                backgroundColor: 'var(--surface-white)',
                color: 'var(--ink-gray-7)',
              }}
              onClick={() => setEditingDeal(null)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE ALERT ====== */}
      <AlertDialog
        open={!!deletingDeal}
        onOpenChange={(open: boolean) => !open && setDeletingDeal(null)}
      >
        <AlertDialogContent
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            borderRadius: '12px',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)', fontWeight: 600 }}>
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>
              Tem certeza que deseja remover a negociação{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>
                {deletingDeal?.organization_name ?? deletingDeal?.lead_name ?? ''}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{
                border: '1px solid var(--outline-gray-2)',
                backgroundColor: 'var(--surface-white)',
                color: 'var(--ink-gray-7)',
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDeal && deleteMutation.mutate(deletingDeal.id)}
              disabled={deleteMutation.isPending}
              style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none' }}
            >
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
