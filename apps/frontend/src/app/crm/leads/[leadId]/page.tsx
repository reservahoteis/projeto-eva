'use client'

// Usage: /crm/leads/[leadId]
// Full-page Lead detail view with Frappe-style header, tabbed content (including channels),
// and info side panel.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  Target,
  Handshake,
  ArrowLeft,
  AlertTriangle,
  Trash2,
  User,
  Mail,
  Phone,
  Building2,
  Globe,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import type { Lead } from '@/types/crm'

// ============================================
// HELPERS
// ============================================

function getFullName(lead: Lead): string {
  return [lead.first_name, lead.middle_name, lead.last_name].filter(Boolean).join(' ')
}

// ============================================
// CONVERT DIALOG
// ============================================

interface ConvertDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
  leadName: string
}

function ConvertDialog({ open, onClose, onConfirm, isPending, leadName }: ConvertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Converter em Negociacao</AlertDialogTitle>
          <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
            Isso convertera o lead <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{leadName}</span> em uma
            negociacao. Um contato tambem sera criado automaticamente. Esta acao nao pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onClose}
            style={{
              border: '1px solid var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
              backgroundColor: 'transparent',
              borderRadius: '8px',
            }}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            style={{
              backgroundColor: 'var(--surface-gray-7)',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
            }}
          >
            {isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Handshake className="w-4 h-4 mr-2" />
            )}
            Converter
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================
// DATA FIELDS CONFIG
// ============================================

const DATA_FIELDS: DataField[] = [
  { key: 'first_name', label: 'Primeiro nome', type: 'text' },
  { key: 'last_name', label: 'Sobrenome', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'mobile_no', label: 'Celular', type: 'phone' },
  { key: 'phone', label: 'Telefone', type: 'phone' },
  { key: 'job_title', label: 'Cargo', type: 'text' },
  { key: 'organization_name', label: 'Organizacao', type: 'text' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'no_of_employees', label: 'Funcionarios', type: 'number' },
  { key: 'annual_revenue', label: 'Receita anual', type: 'currency' },
]

// ============================================
// MAIN PAGE
// ============================================

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // RBAC: only SUPER_ADMIN and TENANT_ADMIN can delete/convert
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN'
  const canConvert = user?.role !== 'SALES' && user?.role !== 'ATTENDANT'

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const { activeTab, setActiveTab } = useDetailTabs('activity')

  // Fetch lead
  const {
    data: leadResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['crm-lead', leadId],
    queryFn: () => crmApi.leads.get(leadId),
    select: (res) => res.data,
  })

  const lead = leadResponse

  // Fetch statuses for inline status edit
  const { data: statusOptions } = useQuery({
    queryKey: ['crm-lead-statuses'],
    queryFn: () => crmApi.settings.statuses.listLead(),
    select: (res) =>
      res.data.map((s) => ({ value: s.id, label: s.label, color: s.color })),
  })

  // Update lead mutation
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof crmApi.leads.update>[1]) =>
      crmApi.leads.update(leadId, data),
    onSuccess: () => {
      toast.success('Lead atualizado')
      queryClient.invalidateQueries({ queryKey: ['crm-lead', leadId] })
    },
    onError: () => toast.error('Erro ao atualizar lead'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => crmApi.leads.delete(leadId),
    onSuccess: () => {
      toast.success('Lead excluido')
      router.push('/crm/leads')
    },
    onError: () => toast.error('Erro ao excluir lead'),
  })

  // Convert mutation
  const convertMutation = useMutation({
    mutationFn: () => crmApi.leads.convert(leadId),
    onSuccess: (res) => {
      toast.success('Lead convertido em negociacao!')
      router.push(`/crm/deals/${res.data.deal_id}`)
    },
    onError: () => toast.error('Erro ao converter lead'),
  })

  // Inline name save
  const handleNameEdit = (newName: string) => {
    const parts = newName.trim().split(/\s+/)
    const first = parts[0] ?? ''
    const last = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    updateMutation.mutate({ first_name: first, last_name: last })
  }

  // Side panel field update handler
  const handleFieldUpdate = (field: string, value: unknown) => {
    if (field === 'status') {
      const statusVal = value as { id?: string } | null
      if (statusVal?.id) updateMutation.mutate({ status_id: statusVal.id })
      return
    }
    if (field === 'source') {
      const val = value as { id?: string } | null
      if (val?.id) updateMutation.mutate({ source_id: val.id })
      return
    }
    if (field === 'industry') {
      const val = value as { id?: string } | null
      if (val?.id) updateMutation.mutate({ industry_id: val.id })
      return
    }
    updateMutation.mutate({ [field]: value })
  }

  // Side panel field definitions
  const sidePanelFields: FieldDefinition[] = [
    { key: 'first_name', label: 'Primeiro nome', type: 'text', editable: true, group: 'Contato', icon: User },
    { key: 'last_name', label: 'Sobrenome', type: 'text', editable: true, group: 'Contato', icon: User },
    { key: 'email', label: 'Email', type: 'email', editable: true, group: 'Contato', icon: Mail },
    { key: 'mobile_no', label: 'Celular', type: 'phone', editable: true, group: 'Contato', icon: Phone },
    { key: 'phone', label: 'Telefone', type: 'phone', editable: true, group: 'Contato', icon: Phone },
    { key: 'job_title', label: 'Cargo', type: 'text', editable: true, group: 'Contato' },
    { key: 'organization_name', label: 'Organizacao', type: 'text', editable: true, group: 'Organizacao', icon: Building2 },
    { key: 'website', label: 'Website', type: 'url', editable: true, group: 'Organizacao', icon: Globe },
    { key: 'no_of_employees', label: 'Funcionarios', type: 'number', editable: true, group: 'Organizacao' },
    { key: 'annual_revenue', label: 'Receita anual', type: 'currency', editable: true, group: 'Organizacao' },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      editable: true,
      options: statusOptions ?? [],
      group: 'Pipeline',
    },
    { key: 'lead_owner', label: 'Responsavel', type: 'user', editable: false, group: 'Pipeline' },
    { key: 'sla_status', label: 'SLA', type: 'text', editable: false, group: 'SLA' },
  ]

  // Build side panel data
  const sidePanelData: Record<string, unknown> = lead
    ? {
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        mobile_no: lead.mobile_no,
        phone: lead.phone,
        job_title: lead.job_title,
        organization_name: lead.organization_name,
        website: lead.website,
        no_of_employees: lead.no_of_employees,
        annual_revenue: lead.annual_revenue,
        status: lead.status,
        lead_owner: lead.lead_owner,
        sla_status: lead.sla_status,
      }
    : {}

  // All tabs config
  const allTabs = [
    ...CONTENT_TABS,
    ...CHANNEL_TABS,
  ]

  // ---- LOADING STATE ----
  if (isLoading) {
    return (
      <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--surface-white)' }}>
        <div
          className="px-6 py-4 flex items-center gap-4"
          style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
        >
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
          <div
            className="hidden lg:block w-80 p-4 space-y-3"
            style={{ borderLeft: '1px solid var(--outline-gray-1)' }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- ERROR STATE ----
  if (isError || !lead) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8" style={{ backgroundColor: 'var(--surface-white)' }}>
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--ink-amber-3)' }} />
        <p style={{ color: 'var(--ink-gray-8)', fontWeight: 500 }}>Nao foi possivel carregar o lead</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2"
          style={{
            color: 'var(--ink-blue-3)',
            fontSize: '13px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
        <button
          onClick={() => router.push('/crm/leads')}
          className="inline-flex items-center gap-2"
          style={{
            color: 'var(--ink-gray-5)',
            fontSize: '13px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Leads
        </button>
      </div>
    )
  }

  const fullName = getFullName(lead)
  const statusColor = lead.status?.color ?? '#7C7C7C'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-white)' }}>
      {/* ---- HEADER ---- */}
      <DetailHeader
        breadcrumbLabel="Leads"
        breadcrumbHref="/crm/leads"
        entityName={fullName}
        namingSeries={lead.naming_series}
        icon={Target}
        iconColor="var(--ink-blue-3)"
        iconBg="var(--surface-blue-2)"
        statusBadge={lead.status ? { label: lead.status.label, color: statusColor } : undefined}
        onNameEdit={handleNameEdit}
        extraBadges={
          lead.converted ? (
            <span
              style={{
                backgroundColor: 'var(--surface-green-2)',
                color: 'var(--ink-green-3)',
                borderRadius: '999px',
                padding: '2px 10px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              Convertido
            </span>
          ) : undefined
        }
        actions={
          !lead.converted && canConvert ? (
            <button
              onClick={() => setShowConvertDialog(true)}
              className="hidden sm:inline-flex items-center gap-1.5 h-8"
              style={{
                backgroundColor: 'var(--surface-gray-7)',
                color: '#fff',
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Handshake className="w-3.5 h-3.5" />
              Converter
            </button>
          ) : undefined
        }
        onDelete={canDelete ? () => setShowDeleteDialog(true) : undefined}
      />

      {/* ---- BODY ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content with tabs */}
        <main className="flex-1 overflow-hidden min-w-0 flex flex-col">
          <DetailTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={allTabs}
          >
            <div className="p-4 lg:p-6">
              {/* Content tabs */}
              {activeTab === 'activity' && (
                <ActivityTimeline doctype="Lead" docname={leadId} />
              )}
              {activeTab === 'emails' && <EmailsTab />}
              {activeTab === 'comments' && (
                <CommentsTab doctype="Lead" docname={leadId} />
              )}
              {activeTab === 'data' && (
                <DataTab fields={DATA_FIELDS} data={sidePanelData} />
              )}
              {activeTab === 'tasks' && (
                <TasksTab doctype="Lead" docname={leadId} />
              )}
              {activeTab === 'notes' && (
                <NotesTab doctype="Lead" docname={leadId} />
              )}
              {activeTab === 'attachments' && <AttachmentsTab />}

              {/* Channel tabs */}
              {activeTab === 'whatsapp' && (
                <ChannelTab channel="whatsapp" phoneNumber={lead.mobile_no ?? lead.phone} entityName={fullName} />
              )}
              {activeTab === 'messenger' && (
                <ChannelTab channel="messenger" phoneNumber={lead.mobile_no ?? lead.phone} entityName={fullName} />
              )}
              {activeTab === 'instagram' && (
                <ChannelTab channel="instagram" phoneNumber={lead.mobile_no ?? lead.phone} entityName={fullName} />
              )}
              {activeTab === 'imessage' && (
                <ChannelTab channel="imessage" phoneNumber={lead.mobile_no ?? lead.phone} entityName={fullName} />
              )}
              {activeTab === 'booking' && (
                <ChannelTab channel="booking" phoneNumber={lead.mobile_no ?? lead.phone} entityName={fullName} />
              )}
              {activeTab === 'airbnb' && (
                <ChannelTab channel="airbnb" phoneNumber={lead.mobile_no ?? lead.phone} entityName={fullName} />
              )}
            </div>
          </DetailTabs>
        </main>

        {/* Side panel */}
        <aside
          className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 overflow-y-auto"
          style={{
            backgroundColor: 'var(--surface-gray-1)',
            borderLeft: '1px solid var(--outline-gray-1)',
          }}
        >
          {/* Side panel header */}
          <div
            className="flex items-center gap-3 px-4 py-4"
            style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
          >
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={lead.image_url ?? undefined} alt={fullName} />
              <AvatarFallback
                style={{
                  backgroundColor: 'var(--surface-blue-2)',
                  color: 'var(--ink-blue-3)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p
                className="truncate"
                style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-gray-9)' }}
              >
                {fullName}
              </p>
              {lead.organization_name && (
                <p className="truncate" style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                  {lead.organization_name}
                </p>
              )}
            </div>
          </div>

          {/* Side panel fields */}
          <SidePanelInfo
            fields={sidePanelFields}
            data={sidePanelData}
            onUpdate={handleFieldUpdate}
            loading={isLoading}
          />
        </aside>
      </div>

      {/* ---- DIALOGS ---- */}
      <ConvertDialog
        open={showConvertDialog}
        onClose={() => setShowConvertDialog(false)}
        onConfirm={() => convertMutation.mutate()}
        isPending={convertMutation.isPending}
        leadName={fullName}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={(o) => !o && setShowDeleteDialog(false)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja excluir{' '}
              <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{fullName}</span>?
              Todas as atividades, notas e tarefas associadas tambem serao removidas.
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowDeleteDialog(false)}
              style={{
                border: '1px solid var(--outline-gray-2)',
                color: 'var(--ink-gray-8)',
                backgroundColor: 'transparent',
                borderRadius: '8px',
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              style={{
                backgroundColor: 'var(--surface-red-2)',
                color: 'var(--ink-red-3)',
                borderRadius: '8px',
                border: 'none',
              }}
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
