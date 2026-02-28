'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { crmKeys } from '@/hooks/crm/use-crm-queries'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatCard } from '@/components/crm/stat-card'
import { EmptyState } from '@/components/crm/empty-state'
import {
  Plus,
  Search,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CallLog, CreateCallLogData, CrmListParams } from '@/types/crm'

// ============================================
// CONSTANTS
// ============================================

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  Completed: { backgroundColor: 'var(--surface-green-2)', color: 'var(--ink-green-3)' },
  'No Answer': { backgroundColor: 'var(--surface-amber-2)', color: 'var(--ink-amber-3)' },
  Busy: { backgroundColor: 'var(--surface-amber-2)', color: 'var(--ink-amber-3)' },
  Failed: { backgroundColor: 'var(--surface-red-2)', color: 'var(--ink-red-3)' },
  Voicemail: { backgroundColor: 'var(--surface-blue-2)', color: 'var(--ink-blue-3)' },
}

const TYPE_ICON_STYLE: Record<string, { icon: typeof PhoneIncoming; color: string }> = {
  Inbound: { icon: PhoneIncoming, color: 'var(--ink-green-3)' },
  Outbound: { icon: PhoneOutgoing, color: 'var(--ink-blue-3)' },
}

const DEFAULT_TYPE_CONFIG: { icon: typeof PhoneIncoming; color: string } = {
  icon: PhoneOutgoing,
  color: 'var(--ink-blue-3)',
}

// ============================================
// HELPERS
// ============================================

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

// ============================================
// TABLE SKELETON
// ============================================

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="border-b" style={{ borderColor: 'var(--outline-gray-1)' }}>
          <TableCell className="py-2.5 pl-4">
            <Skeleton className="h-4 w-4 rounded-full" />
          </TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell className="py-2.5 hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="py-2.5 pr-4"><Skeleton className="h-6 w-6 rounded ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function CallLogsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const pageSize = 20

  const params: CrmListParams = {
    page,
    page_size: pageSize,
    search: search || undefined,
    filters: {
      ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    },
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: crmKeys.callLogList(params),
    queryFn: () => crmApi.callLogs.list(params),
    select: (res) => res.data,
    placeholderData: keepPreviousData,
  })

  // Stats query (all records)
  const { data: allData } = useQuery({
    queryKey: [...crmKeys.callLogs(), 'stats'],
    queryFn: () => crmApi.callLogs.list({ page_size: 100 }),
    select: (res) => res.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateCallLogData) => crmApi.callLogs.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.callLogs() })
      toast.success('Chamada registrada')
      setCreateDialogOpen(false)
    },
    onError: () => toast.error('Erro ao registrar chamada'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.callLogs.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.callLogs() })
      toast.success('Registro removido')
    },
    onError: () => toast.error('Erro ao remover'),
  })

  // Compute stats
  const stats = {
    total: allData?.total_count ?? 0,
    inbound: allData?.data?.filter((c) => c.type === 'Inbound').length ?? 0,
    outbound: allData?.data?.filter((c) => c.type === 'Outbound').length ?? 0,
    avgDuration: allData?.data?.length
      ? Math.round(
          allData.data.reduce((sum, c) => sum + (c.duration ?? 0), 0) /
            allData.data.filter((c) => c.duration).length || 1
        )
      : 0,
  }

  const totalPages = data ? Math.ceil(data.total_count / pageSize) : 0

  const selectContentStyle = {
    backgroundColor: 'var(--surface-white)',
    borderColor: 'var(--outline-gray-2)',
  }

  const filterTriggerStyle = {
    borderColor: 'var(--outline-gray-2)',
    backgroundColor: 'var(--surface-white)',
    color: 'var(--ink-gray-7)',
  }

  return (
    <div className="flex flex-col h-full">
      {/* ---- Page Header ---- */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Chamadas
          </h1>
          {!isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {data?.total_count ?? 0}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: crmKeys.callLogs() })}
            disabled={isFetching}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              style={{ color: 'var(--ink-gray-5)' }}
            />
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
            className="h-7 text-xs hover:opacity-90 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Registrar Chamada
          </Button>
        </div>
      </div>

      {/* ---- Stats ---- */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-5 py-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        <StatCard title="Total" value={stats.total} icon={PhoneCall} color="blue" loading={isLoading} />
        <StatCard title="Recebidas" value={stats.inbound} icon={PhoneIncoming} color="green" loading={isLoading} />
        <StatCard title="Realizadas" value={stats.outbound} icon={PhoneOutgoing} color="indigo" loading={isLoading} />
        <StatCard title="Duracao Media" value={formatDuration(stats.avgDuration)} icon={Clock} color="amber" loading={isLoading} />
      </div>

      {/* ---- View Controls Bar ---- */}
      <div
        className="flex items-center gap-3 px-5 py-2 border-b flex-shrink-0 flex-wrap"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        {/* Search */}
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <Input
            type="search"
            placeholder="Buscar por numero..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-7 text-xs border rounded w-52"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          />
        </div>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger
            className="h-7 text-xs border rounded w-36"
            style={filterTriggerStyle}
          >
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border shadow-md" style={selectContentStyle}>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="Inbound">Recebidas</SelectItem>
            <SelectItem value="Outbound">Realizadas</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger
            className="h-7 text-xs border rounded w-40"
            style={filterTriggerStyle}
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border shadow-md" style={selectContentStyle}>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="Completed">Completada</SelectItem>
            <SelectItem value="No Answer">Sem Resposta</SelectItem>
            <SelectItem value="Busy">Ocupado</SelectItem>
            <SelectItem value="Failed">Falhou</SelectItem>
            <SelectItem value="Voicemail">Correio de Voz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ---- Table ---- */}
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1">
          {isLoading ? (
            <Table>
              <TableBody>
                <TableSkeleton />
              </TableBody>
            </Table>
          ) : !data?.data?.length ? (
            <EmptyState
              icon={PhoneCall}
              title="Nenhuma chamada registrada"
              description="Registre chamadas para manter o historico."
              actionLabel="Registrar Chamada"
              onAction={() => setCreateDialogOpen(true)}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow
                  className="border-b"
                  style={{
                    borderColor: 'var(--outline-gray-1)',
                    backgroundColor: 'var(--surface-gray-1)',
                  }}
                >
                  <TableHead
                    className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap w-12"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Tipo
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    De
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Para
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Status
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden md:table-cell"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Duracao
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Data
                  </TableHead>
                  <TableHead className="py-2 pr-4 w-10" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.data.map((log: CallLog) => {
                  const typeConfig =
                    TYPE_ICON_STYLE[log.type as keyof typeof TYPE_ICON_STYLE] ??
                    DEFAULT_TYPE_CONFIG
                  const TypeIcon = typeConfig.icon
                  const statusStyle = STATUS_STYLE[log.status] ?? STATUS_STYLE.Failed

                  return (
                    <TableRow
                      key={log.id}
                      className="border-b transition-colors"
                      style={{ borderColor: 'var(--outline-gray-1)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ''
                      }}
                    >
                      {/* type icon */}
                      <TableCell className="py-2.5 pl-4">
                        <TypeIcon className="w-4 h-4" style={{ color: typeConfig.color }} />
                      </TableCell>

                      {/* caller */}
                      <TableCell className="py-2.5">
                        <span className="text-sm font-medium" style={{ color: 'var(--ink-gray-8)' }}>
                          {log.caller || (
                            <span style={{ color: 'var(--ink-gray-4)' }}>—</span>
                          )}
                        </span>
                      </TableCell>

                      {/* receiver */}
                      <TableCell className="py-2.5">
                        <span className="text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                          {log.receiver || (
                            <span style={{ color: 'var(--ink-gray-4)' }}>—</span>
                          )}
                        </span>
                      </TableCell>

                      {/* status badge */}
                      <TableCell className="py-2.5">
                        <span
                          className="inline-flex items-center text-xs font-medium px-2 py-0.5"
                          style={{ ...statusStyle, borderRadius: '999px' }}
                        >
                          {log.status}
                        </span>
                      </TableCell>

                      {/* duration */}
                      <TableCell className="py-2.5 hidden md:table-cell">
                        <span className="text-sm font-mono" style={{ color: 'var(--ink-gray-6)' }}>
                          {formatDuration(log.duration)}
                        </span>
                      </TableCell>

                      {/* date */}
                      <TableCell className="py-2.5 hidden lg:table-cell">
                        <span
                          className="text-sm"
                          style={{ color: 'var(--ink-gray-5)' }}
                          title={
                            log.start_time
                              ? format(new Date(log.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : undefined
                          }
                        >
                          {log.start_time
                            ? format(new Date(log.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : formatDistanceToNow(new Date(log.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                        </span>
                      </TableCell>

                      {/* delete action */}
                      <TableCell className="py-2.5 pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 hover:opacity-100 transition-opacity"
                          onClick={() => deleteMutation.mutate(log.id)}
                          aria-label="Remover registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--ink-red-3)' }} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ---- Pagination ---- */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-2.5 border-t flex-shrink-0"
            style={{
              borderColor: 'var(--outline-gray-1)',
              backgroundColor: 'var(--surface-gray-1)',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data?.total_count ?? 0)} de{' '}
              {data?.total_count ?? 0}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ color: 'var(--ink-gray-6)' }}
              >
                Anterior
              </Button>
              <span className="text-xs px-2" style={{ color: 'var(--ink-gray-6)' }}>
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ color: 'var(--ink-gray-6)' }}
              >
                Proximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Create Dialog ---- */}
      <CreateCallLogDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSave={(data) => createMutation.mutate(data)}
        saving={createMutation.isPending}
      />
    </div>
  )
}

// ============================================
// CREATE DIALOG
// ============================================

function CreateCallLogDialog({
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: CreateCallLogData) => void
  saving: boolean
}) {
  const [formData, setFormData] = useState<CreateCallLogData>({
    caller: '',
    receiver: '',
    type: 'Outbound',
    status: 'Completed',
    duration: undefined,
    note: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const inputStyle = {
    borderColor: 'var(--outline-gray-2)',
    backgroundColor: 'var(--surface-white)',
    color: 'var(--ink-gray-8)',
  }

  const labelStyle = { color: 'var(--ink-gray-6)' }

  const selectContentStyle = {
    backgroundColor: 'var(--surface-white)',
    borderColor: 'var(--outline-gray-2)',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            Registrar Chamada
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium block" style={labelStyle}>
                De
              </label>
              <Input
                value={formData.caller}
                onChange={(e) => setFormData((p) => ({ ...p, caller: e.target.value }))}
                className="h-8 text-sm rounded border"
                style={inputStyle}
                placeholder="Numero"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium block" style={labelStyle}>
                Para
              </label>
              <Input
                value={formData.receiver}
                onChange={(e) => setFormData((p) => ({ ...p, receiver: e.target.value }))}
                className="h-8 text-sm rounded border"
                style={inputStyle}
                placeholder="Numero"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium block" style={labelStyle}>
                Tipo
              </label>
              <Select
                value={formData.type}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, type: v as 'Inbound' | 'Outbound' }))
                }
              >
                <SelectTrigger className="h-8 text-sm rounded border" style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border shadow-md" style={selectContentStyle}>
                  <SelectItem value="Inbound">Recebida</SelectItem>
                  <SelectItem value="Outbound">Realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium block" style={labelStyle}>
                Status
              </label>
              <Select
                value={formData.status}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, status: v as CreateCallLogData['status'] }))
                }
              >
                <SelectTrigger className="h-8 text-sm rounded border" style={inputStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border shadow-md" style={selectContentStyle}>
                  <SelectItem value="Completed">Completada</SelectItem>
                  <SelectItem value="No Answer">Sem Resposta</SelectItem>
                  <SelectItem value="Busy">Ocupado</SelectItem>
                  <SelectItem value="Failed">Falhou</SelectItem>
                  <SelectItem value="Voicemail">Correio de Voz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium block" style={labelStyle}>
              Duracao (segundos)
            </label>
            <Input
              type="number"
              min={0}
              value={formData.duration ?? ''}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  duration: e.target.value ? parseInt(e.target.value) : undefined,
                }))
              }
              className="h-8 text-sm rounded border"
              style={inputStyle}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium block" style={labelStyle}>
              Observacao
            </label>
            <Input
              value={formData.note ?? ''}
              onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
              className="h-8 text-sm rounded border"
              style={inputStyle}
              placeholder="Anotacao sobre a chamada..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-sm rounded border"
              style={{
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-7)',
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="h-8 px-3 text-sm rounded text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--surface-gray-7)' }}
            >
              {saving ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
