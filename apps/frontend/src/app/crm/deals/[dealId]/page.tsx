'use client'

// Usage: /crm/deals/[dealId]
// Full-page Deal detail view with Frappe-style header, tabbed content (including channels),
// info side panel, Mark Won (confetti animation), and Mark Lost (reason dialog) actions.

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { getInitials } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DetailHeader } from '@/components/crm/detail-header'
import { DetailTabs, CONTENT_TABS, CHANNEL_TABS, useDetailTabs } from '@/components/crm/detail-tabs'
import { ActivityTimeline } from '@/components/crm/activity-timeline'
import { SidePanelInfo } from '@/components/crm/side-panel-info'
import type { FieldDefinition } from '@/components/crm/side-panel-info'
import {
  NotesTab,
  TasksTab,
  CommentsTab,
  DataTab,
  EmailsTab,
  AttachmentsTab,
  ChannelTab,
} from '@/components/crm/tabs'
import type { DataField } from '@/components/crm/tabs'
import {
  RefreshCw,
  Handshake,
  ArrowLeft,
  AlertTriangle,
  Trash2,
  Trophy,
  XCircle,
  DollarSign,
  TrendingUp,
  CalendarDays,
  User,
  Mail,
  Phone,
  Building2,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import type { LostReason, MarkDealLostData } from '@/types/crm'

// ============================================
// CONFETTI ANIMATION (Won celebration)
// ============================================

function ConfettiPiece({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="fixed pointer-events-none rounded-sm z-[9999]"
      style={{ width: '8px', height: '12px', ...style }}
      aria-hidden="true"
    />
  )
}

function useConfetti(active: boolean) {
  const [pieces, setPieces] = useState<React.CSSProperties[]>([])

  useEffect(() => {
    if (!active) return

    const colors = [
      '#4f46e5', '#7c3aed', '#2563eb', '#059669',
      '#d97706', '#dc2626', '#0891b2', '#c026d3',
    ]

    const generated = Array.from({ length: 60 }).map(() => ({
      left: `${Math.random() * 100}vw`,
      top: '-20px',
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      transform: `rotate(${Math.random() * 360}deg)`,
      animation: `confettiFall ${1.5 + Math.random() * 2}s ease-in forwards`,
      animationDelay: `${Math.random() * 0.8}s`,
    }))

    setPieces(generated)
    const timer = setTimeout(() => setPieces([]), 4000)
    return () => clearTimeout(timer)
  }, [active])

  return pieces
}

// Confetti keyframe injection hook — safely inserts CSS inside React lifecycle
function useConfettiKeyframes() {
  useEffect(() => {
    const styleId = 'confetti-keyframes'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes confettiFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }, [])
}

// ============================================
// MARK LOST DIALOG
// ============================================

interface MarkLostDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: MarkDealLostData) => void
  isPending: boolean
  dealName: string
}

function MarkLostDialog({ open, onClose, onConfirm, isPending, dealName }: MarkLostDialogProps) {
  const [selectedReasonId, setSelectedReasonId] = useState('')
  const [detail, setDetail] = useState('')

  const { data: reasons } = useQuery({
    queryKey: ['crm-lost-reasons'],
    queryFn: () => crmApi.settings.lookups.lostReasons(),
    select: (res) => res.data,
    enabled: open,
  })

  const handleConfirm = () => {
    onConfirm({
      lost_reason_id: selectedReasonId || undefined,
      lost_detail: detail || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{
          backgroundColor: 'var(--surface-white)',
          border: '1px solid var(--outline-gray-1)',
          color: 'var(--ink-gray-9)',
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--ink-gray-9)' }}>
            <XCircle className="w-5 h-5 text-rose-500" />
            Marcar como perdida
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--ink-gray-5)' }}>
            Informe o motivo da perda de{' '}
            <span className="font-medium" style={{ color: 'var(--ink-gray-8)' }}>{dealName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--ink-gray-7)' }}>
              Motivo da perda
            </label>
            <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
              <SelectTrigger
                className="text-sm"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                <SelectValue placeholder="Selecionar motivo (opcional)" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                {reasons?.map((r: LostReason) => (
                  <SelectItem key={r.id} value={r.id} className="text-sm">
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--ink-gray-7)' }}>
              Detalhes adicionais
            </label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Descreva o motivo da perda..."
              className="text-sm min-h-[80px] resize-none"
              style={{
                backgroundColor: 'var(--surface-white)',
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-8)',
              }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              border: '1px solid var(--outline-gray-2)',
              color: 'var(--ink-gray-7)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#e11d48', border: 'none', cursor: isPending ? 'not-allowed' : 'pointer' }}
          >
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Marcar como perdida
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// HELPERS
// ============================================

function formatDealValue(value: number | null, currency: string): string {
  if (value === null || value === undefined) return '\u2014'
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('pt-BR')}`
  }
}

// ============================================
// DATA FIELDS CONFIG
// ============================================

const DATA_FIELDS: DataField[] = [
  { key: 'organization_name', label: 'Organizacao', type: 'text' },
  { key: 'lead_name', label: 'Contato', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'mobile_no', label: 'Celular', type: 'phone' },
  { key: 'deal_value', label: 'Valor', type: 'currency' },
  { key: 'probability', label: 'Probabilidade', type: 'number' },
  { key: 'expected_closure_date', label: 'Previsao de fechamento', type: 'date' },
]

// ============================================
// MAIN PAGE
// ============================================

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const wonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Inject confetti CSS keyframes
  useConfettiKeyframes()

  // RBAC: only SUPER_ADMIN and TENANT_ADMIN can delete
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN'

  // Cleanup won celebration timer on unmount
  useEffect(() => {
    return () => {
      if (wonTimerRef.current) clearTimeout(wonTimerRef.current)
    }
  }, [])

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMarkLostDialog, setShowMarkLostDialog] = useState(false)
  const [showWonCelebration, setShowWonCelebration] = useState(false)
  const { activeTab, setActiveTab } = useDetailTabs('activity')

  const confettiPieces = useConfetti(showWonCelebration)

  // Fetch deal
  const {
    data: dealResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['crm-deal', dealId],
    queryFn: () => crmApi.deals.get(dealId),
    select: (res) => res.data,
  })

  const deal = dealResponse

  // Fetch deal statuses
  const { data: statusOptions } = useQuery({
    queryKey: ['crm-deal-statuses'],
    queryFn: () => crmApi.settings.statuses.listDeal(),
    select: (res) =>
      res.data.map((s) => ({ value: s.id, label: s.label, color: s.color })),
  })

  // Update deal mutation
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof crmApi.deals.update>[1]) =>
      crmApi.deals.update(dealId, data),
    onSuccess: () => {
      toast.success('Negociacao atualizada')
      queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
    },
    onError: () => toast.error('Erro ao atualizar negociacao'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => crmApi.deals.delete(dealId),
    onSuccess: () => {
      toast.success('Negociacao excluida')
      router.push('/crm/deals')
    },
    onError: () => toast.error('Erro ao excluir negociacao'),
  })

  // Mark Won mutation
  const markWonMutation = useMutation({
    mutationFn: () => crmApi.deals.markWon(dealId),
    onSuccess: () => {
      toast.success('Negociacao ganha!')
      setShowWonCelebration(true)
      wonTimerRef.current = setTimeout(() => setShowWonCelebration(false), 4000)
      queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
    },
    onError: () => toast.error('Erro ao marcar como ganha'),
  })

  // Mark Lost mutation
  const markLostMutation = useMutation({
    mutationFn: (data: MarkDealLostData) => crmApi.deals.markLost(dealId, data),
    onSuccess: () => {
      toast.success('Negociacao marcada como perdida')
      setShowMarkLostDialog(false)
      queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
    },
    onError: () => toast.error('Erro ao marcar como perdida'),
  })

  // Inline name save
  const handleNameEdit = (newName: string) => {
    updateMutation.mutate({ organization_name: newName })
  }

  // Field update handler
  const handleFieldUpdate = (field: string, value: unknown) => {
    if (field === 'status') {
      const statusVal = value as { id?: string } | null
      if (statusVal?.id) updateMutation.mutate({ status_id: statusVal.id })
      return
    }
    updateMutation.mutate({ [field]: value })
  }

  // Side panel fields
  const sidePanelFields: FieldDefinition[] = [
    { key: 'organization_name', label: 'Organizacao', type: 'text', editable: true, group: 'Informacoes', icon: Building2 },
    { key: 'lead_name', label: 'Contato', type: 'text', editable: true, group: 'Informacoes', icon: User },
    { key: 'email', label: 'Email', type: 'email', editable: true, group: 'Informacoes', icon: Mail },
    { key: 'mobile_no', label: 'Celular', type: 'phone', editable: true, group: 'Informacoes', icon: Phone },
    { key: 'deal_value', label: 'Valor', type: 'currency', editable: true, group: 'Negociacao', icon: DollarSign },
    { key: 'probability', label: 'Probabilidade (%)', type: 'number', editable: true, group: 'Negociacao', icon: TrendingUp },
    { key: 'expected_closure_date', label: 'Previsao de fechamento', type: 'date', editable: true, group: 'Negociacao', icon: CalendarDays },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      editable: true,
      options: statusOptions ?? [],
      group: 'Pipeline',
    },
    { key: 'deal_owner', label: 'Responsavel', type: 'user', editable: false, group: 'Pipeline' },
  ]

  const sidePanelData: Record<string, unknown> = deal
    ? {
        organization_name: deal.organization_name,
        lead_name: deal.lead_name,
        email: deal.email,
        mobile_no: deal.mobile_no,
        deal_value: deal.deal_value,
        probability: deal.probability,
        expected_closure_date: deal.expected_closure_date,
        status: deal.status,
        deal_owner: deal.deal_owner,
      }
    : {}

  // Won/Lost state
  const isWon = deal?.status?.status_type === 'Won'
  const isLost = deal?.status?.status_type === 'Lost'
  const dealName = deal?.organization_name ?? deal?.lead_name ?? `Negociacao ${dealId}`

  // Dynamic icon colors
  const iconColor = isWon ? 'var(--ink-green-3)' : isLost ? 'var(--ink-red-3)' : 'var(--ink-blue-3)'
  const iconBg = isWon ? 'var(--surface-green-2)' : isLost ? 'var(--surface-red-2)' : 'var(--surface-blue-2)'

  const allTabs = [...CONTENT_TABS, ...CHANNEL_TABS]

  // ---- LOADING STATE ----
  if (isLoading) {
    return (
      <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--surface-white)' }}>
        <div className="px-6 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid var(--outline-gray-1)' }}>
          <Skeleton className="h-8 w-8 rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            <Skeleton className="h-4 w-24" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-10 w-full max-w-md rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            ))}
          </div>
          <div className="hidden lg:block w-80 p-4 space-y-3" style={{ borderLeft: '1px solid var(--outline-gray-1)' }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- ERROR STATE ----
  if (isError || !deal) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8" style={{ backgroundColor: 'var(--surface-white)' }}>
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--ink-amber-3)' }} />
        <p style={{ color: 'var(--ink-gray-8)', fontWeight: 500 }}>Nao foi possivel carregar a negociacao</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2"
          style={{ color: 'var(--ink-blue-3)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
        <button
          onClick={() => router.push('/crm/deals')}
          className="inline-flex items-center gap-2"
          style={{ color: 'var(--ink-gray-5)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Negociacoes
        </button>
      </div>
    )
  }

  const statusColor = deal.status?.color ?? '#94a3b8'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-white)' }}>
      {/* Confetti overlay */}
      {confettiPieces.map((style, i) => (
        <ConfettiPiece key={i} style={style} />
      ))}

      {/* Won celebration banner */}
      {showWonCelebration && (
        <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 pointer-events-none">
          <div
            className="rounded-2xl px-6 py-3 flex items-center gap-3 animate-slideUp shadow-lg"
            style={{ backgroundColor: 'var(--surface-green-2)', border: '1px solid var(--ink-green-3)' }}
          >
            <Trophy className="w-5 h-5" style={{ color: 'var(--ink-green-3)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--ink-green-3)' }}>
              Parabens! Negociacao ganha!
            </span>
          </div>
        </div>
      )}

      {/* ---- HEADER ---- */}
      <DetailHeader
        breadcrumbLabel="Negociacoes"
        breadcrumbHref="/crm/deals"
        entityName={dealName}
        namingSeries={deal.naming_series}
        icon={Handshake}
        iconColor={iconColor}
        iconBg={iconBg}
        statusBadge={deal.status ? { label: deal.status.label, color: statusColor } : undefined}
        onNameEdit={handleNameEdit}
        extraBadges={
          <>
            {deal.deal_value !== null && (
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-green-3)' }}>
                {formatDealValue(deal.deal_value, deal.currency)}
              </span>
            )}
            {deal.probability !== null && (
              <span className="hidden md:inline-flex items-center gap-1" style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                <TrendingUp className="w-3 h-3" />
                {deal.probability}%
              </span>
            )}
          </>
        }
        actions={
          !isWon && !isLost ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => markWonMutation.mutate()}
                disabled={markWonMutation.isPending}
                className="inline-flex items-center gap-1.5 h-8"
                style={{
                  backgroundColor: '#059669',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: markWonMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: markWonMutation.isPending ? 0.7 : 1,
                }}
              >
                {markWonMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trophy className="w-3.5 h-3.5" />
                )}
                Ganhar
              </button>
              <button
                onClick={() => setShowMarkLostDialog(true)}
                className="inline-flex items-center gap-1.5 h-8"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--ink-red-3)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: '1px solid var(--ink-red-3)',
                  cursor: 'pointer',
                }}
              >
                <XCircle className="w-3.5 h-3.5" />
                Perder
              </button>
            </div>
          ) : undefined
        }
        onDelete={canDelete ? () => setShowDeleteDialog(true) : undefined}
      />

      {/* ---- BODY ---- */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden min-w-0 flex flex-col">
          <DetailTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={allTabs}>
            <div className="p-4 lg:p-6">
              {activeTab === 'activity' && <ActivityTimeline doctype="Deal" docname={dealId} />}
              {activeTab === 'emails' && <EmailsTab />}
              {activeTab === 'comments' && <CommentsTab doctype="Deal" docname={dealId} />}
              {activeTab === 'data' && <DataTab fields={DATA_FIELDS} data={sidePanelData} />}
              {activeTab === 'tasks' && <TasksTab doctype="Deal" docname={dealId} />}
              {activeTab === 'notes' && <NotesTab doctype="Deal" docname={dealId} />}
              {activeTab === 'attachments' && <AttachmentsTab />}

              {activeTab === 'whatsapp' && <ChannelTab channel="whatsapp" phoneNumber={deal.mobile_no} entityName={dealName} />}
              {activeTab === 'messenger' && <ChannelTab channel="messenger" phoneNumber={deal.mobile_no} entityName={dealName} />}
              {activeTab === 'instagram' && <ChannelTab channel="instagram" phoneNumber={deal.mobile_no} entityName={dealName} />}
              {activeTab === 'imessage' && <ChannelTab channel="imessage" phoneNumber={deal.mobile_no} entityName={dealName} />}
              {activeTab === 'booking' && <ChannelTab channel="booking" phoneNumber={deal.mobile_no} entityName={dealName} />}
              {activeTab === 'airbnb' && <ChannelTab channel="airbnb" phoneNumber={deal.mobile_no} entityName={dealName} />}
            </div>
          </DetailTabs>
        </main>

        {/* Side panel */}
        <aside
          className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-gray-1)', borderLeft: '1px solid var(--outline-gray-1)' }}
        >
          {/* Side panel header */}
          <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '1px solid var(--outline-gray-1)' }}>
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarFallback style={{ backgroundColor: iconBg, color: iconColor, fontSize: '13px', fontWeight: 600 }}>
                {getInitials(dealName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-gray-9)' }}>
                {dealName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {deal.deal_value !== null && (
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink-green-3)' }}>
                    {formatDealValue(deal.deal_value, deal.currency)}
                  </p>
                )}
                {deal.probability !== null && (
                  <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                    {deal.probability}% prob.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Won/Lost state banner */}
          {(isWon || isLost) && (
            <div
              className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={
                isWon
                  ? { backgroundColor: 'var(--surface-green-2)', border: '1px solid var(--ink-green-3)' }
                  : { backgroundColor: 'var(--surface-red-2)', border: '1px solid var(--ink-red-3)' }
              }
            >
              {isWon ? (
                <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-green-3)' }} />
              ) : (
                <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-red-3)' }} />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: isWon ? 'var(--ink-green-3)' : 'var(--ink-red-3)' }}>
                  {isWon ? 'Negociacao ganha' : 'Negociacao perdida'}
                </p>
                {isLost && deal.lost_reason && (
                  <p className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>Motivo: {deal.lost_reason.name}</p>
                )}
                {isLost && deal.lost_detail && (
                  <p className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>{deal.lost_detail}</p>
                )}
              </div>
            </div>
          )}

          {/* Expected closure date */}
          {deal.expected_closure_date && !isWon && !isLost && (
            <div
              className="mx-4 mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--outline-gray-1)' }}
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-gray-5)' }} />
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ink-gray-5)' }}>Previsao</p>
                <p className="text-xs font-medium" style={{ color: 'var(--ink-gray-8)' }}>
                  {format(new Date(deal.expected_closure_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
          )}

          <SidePanelInfo fields={sidePanelFields} data={sidePanelData} onUpdate={handleFieldUpdate} loading={isLoading} />
        </aside>
      </div>

      {/* ---- DIALOGS ---- */}
      <MarkLostDialog
        open={showMarkLostDialog}
        onClose={() => setShowMarkLostDialog(false)}
        onConfirm={(data) => markLostMutation.mutate(data)}
        isPending={markLostMutation.isPending}
        dealName={dealName}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={(o) => !o && setShowDeleteDialog(false)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Excluir negociacao</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja excluir{' '}
              <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{dealName}</span>?
              Todas as atividades, notas e tarefas associadas tambem serao removidas.
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowDeleteDialog(false)}
              style={{ border: '1px solid var(--outline-gray-2)', color: 'var(--ink-gray-8)', backgroundColor: 'transparent', borderRadius: '8px' }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              style={{ backgroundColor: 'var(--surface-red-2)', color: 'var(--ink-red-3)', borderRadius: '8px', border: 'none' }}
            >
              {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
