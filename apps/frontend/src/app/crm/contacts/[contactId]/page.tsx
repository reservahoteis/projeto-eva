'use client'

// Usage: /crm/contacts/[contactId]
// Full-page Contact detail view with Frappe-style header, tabbed content (including channels),
// and info side panel. Includes linked deals tab and edit dialog.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { crmKeys } from '@/hooks/crm/use-crm-queries'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/crm/status-badge'
import { UserAvatar } from '@/components/crm/user-avatar'
import { EmptyState } from '@/components/crm/empty-state'
import { DetailHeader } from '@/components/crm/detail-header'
import { DetailTabs, CONTENT_TABS, CHANNEL_TABS, useDetailTabs } from '@/components/crm/detail-tabs'
import type { TabConfig } from '@/components/crm/detail-tabs'
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
  ArrowLeft,
  AlertTriangle,
  Trash2,
  User,
  Mail,
  Phone,
  Building2,
  Globe,
  MapPin,
  Briefcase,
  Handshake,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import type { CrmContact, DealListItem, UpdateContactData } from '@/types/crm'

// ============================================
// EDIT DIALOG
// ============================================

function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: CrmContact
  onSave: (data: UpdateContactData) => void
  saving: boolean
}) {
  const [formData, setFormData] = useState<UpdateContactData>({
    first_name: contact.first_name,
    last_name: contact.last_name ?? '',
    email: contact.email ?? '',
    mobile_no: contact.mobile_no ?? '',
    phone: contact.phone ?? '',
    company_name: contact.company_name ?? '',
    designation: contact.designation ?? '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const fields = [
    { key: 'first_name', label: 'Nome', required: true },
    { key: 'last_name', label: 'Sobrenome' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'mobile_no', label: 'Celular' },
    { key: 'phone', label: 'Telefone' },
    { key: 'company_name', label: 'Empresa' },
    { key: 'designation', label: 'Cargo' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-xl border max-w-md"
        style={{ backgroundColor: 'var(--surface-white)', borderColor: 'var(--outline-gray-2)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Editar Contato
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label
                className="block mb-1"
                style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink-gray-5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                {field.label}{' '}
                {field.required && <span style={{ color: 'var(--ink-red-3)' }}>*</span>}
              </label>
              <Input
                type={field.type || 'text'}
                value={(formData as Record<string, string>)[field.key] || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="h-8 text-sm rounded border"
                style={{ backgroundColor: 'var(--surface-white)', borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}
                required={field.required}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded text-sm transition-colors"
              style={{ border: '1px solid var(--outline-gray-2)', color: 'var(--ink-gray-7)', backgroundColor: 'var(--surface-white)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 rounded text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// DEALS LIST (inline tab content)
// ============================================

function DealsListContent({ contactId }: { contactId: string }) {
  const router = useRouter()
  const { data: dealsData, isLoading } = useQuery({
    queryKey: [...crmKeys.contactDetail(contactId), 'deals'],
    queryFn: () => crmApi.contacts.deals(contactId),
    select: (res) => res.data,
    enabled: !!contactId,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
        ))}
      </div>
    )
  }

  if (!dealsData?.data?.length) {
    return <EmptyState icon={Handshake} title="Nenhuma negociacao vinculada" description="Este contato ainda nao tem negociacoes." />
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--surface-white)', borderColor: 'var(--outline-gray-1)' }}>
      <Table>
        <TableHeader>
          <TableRow className="border-b" style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}>
            <TableHead className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Negociacao</TableHead>
            <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Status</TableHead>
            <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Valor</TableHead>
            <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Responsavel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dealsData.data.map((deal: DealListItem) => (
            <TableRow
              key={deal.id}
              className="border-b cursor-pointer transition-colors"
              style={{ borderColor: 'var(--outline-gray-1)' }}
              onClick={() => router.push(`/crm/deals/${deal.id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              <TableCell className="py-2.5 pl-4 text-sm font-medium" style={{ color: 'var(--ink-gray-8)' }}>
                {deal.organization_name || deal.naming_series}
              </TableCell>
              <TableCell className="py-2.5">
                <StatusBadge label={deal.status.label} color={deal.status.color} />
              </TableCell>
              <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                {deal.deal_value
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: deal.currency || 'BRL' }).format(deal.deal_value)
                  : '-'}
              </TableCell>
              <TableCell className="py-2.5">
                <UserAvatar user={deal.deal_owner} size="sm" showName />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================
// DATA FIELDS CONFIG
// ============================================

const DATA_FIELDS: DataField[] = [
  { key: 'first_name', label: 'Nome', type: 'text' },
  { key: 'last_name', label: 'Sobrenome', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'mobile_no', label: 'Celular', type: 'phone' },
  { key: 'phone', label: 'Telefone', type: 'phone' },
  { key: 'company_name', label: 'Empresa', type: 'text' },
  { key: 'designation', label: 'Cargo', type: 'text' },
  { key: 'organization_name', label: 'Organizacao', type: 'text' },
]

// ============================================
// CUSTOM TABS
// ============================================

const ENTITY_TABS: TabConfig[] = [
  { value: 'deals', label: 'Negociacoes', icon: Handshake },
]

// ============================================
// MAIN PAGE
// ============================================

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuth()

  // RBAC: only SUPER_ADMIN and TENANT_ADMIN can delete
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN'

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { activeTab, setActiveTab } = useDetailTabs('activity')

  // Fetch contact
  const {
    data: contact,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: crmKeys.contactDetail(contactId),
    queryFn: () => crmApi.contacts.get(contactId),
    select: (res) => res.data,
    enabled: !!contactId,
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateContactData) => crmApi.contacts.update(contactId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.contactDetail(contactId) })
      toast.success('Contato atualizado')
      setEditDialogOpen(false)
    },
    onError: () => toast.error('Erro ao atualizar contato'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => crmApi.contacts.delete(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.contacts() })
      toast.success('Contato removido')
      router.push('/crm/contacts')
    },
    onError: () => toast.error('Erro ao remover contato'),
  })

  // Inline name edit
  const handleNameEdit = (newName: string) => {
    const parts = newName.trim().split(/\s+/)
    const first = parts[0] ?? ''
    const last = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    updateMutation.mutate({ first_name: first, last_name: last })
  }

  // Field update handler
  const handleFieldUpdate = (field: string, value: unknown) => {
    updateMutation.mutate({ [field]: value } as UpdateContactData)
  }

  // Side panel fields
  const sidePanelFields: FieldDefinition[] = [
    { key: 'first_name', label: 'Nome', type: 'text', editable: true, group: 'Contato', icon: User },
    { key: 'last_name', label: 'Sobrenome', type: 'text', editable: true, group: 'Contato', icon: User },
    { key: 'email', label: 'Email', type: 'email', editable: true, group: 'Contato', icon: Mail },
    { key: 'mobile_no', label: 'Celular', type: 'phone', editable: true, group: 'Contato', icon: Phone },
    { key: 'phone', label: 'Telefone', type: 'phone', editable: true, group: 'Contato', icon: Phone },
    { key: 'company_name', label: 'Empresa', type: 'text', editable: true, group: 'Trabalho', icon: Building2 },
    { key: 'designation', label: 'Cargo', type: 'text', editable: true, group: 'Trabalho', icon: Briefcase },
    { key: 'organization_name', label: 'Organizacao', type: 'text', editable: false, group: 'Trabalho', icon: Building2 },
    { key: 'industry_name', label: 'Industria', type: 'text', editable: false, group: 'Detalhes', icon: Globe },
    { key: 'territory_name', label: 'Territorio', type: 'text', editable: false, group: 'Detalhes', icon: MapPin },
  ]

  const sidePanelData: Record<string, unknown> = contact
    ? {
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        mobile_no: contact.mobile_no,
        phone: contact.phone,
        company_name: contact.company_name,
        designation: contact.designation,
        organization_name: contact.organization?.organization_name,
        industry_name: contact.industry?.name,
        territory_name: contact.territory?.name,
      }
    : {}

  // All tabs: entity-specific + content + channels
  const allTabs = [...ENTITY_TABS, ...CONTENT_TABS, ...CHANNEL_TABS]

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
  if (isError || !contact) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8" style={{ backgroundColor: 'var(--surface-white)' }}>
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--ink-amber-3)' }} />
        <p style={{ color: 'var(--ink-gray-8)', fontWeight: 500 }}>Nao foi possivel carregar o contato</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2"
          style={{ color: 'var(--ink-blue-3)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
        <button
          onClick={() => router.push('/crm/contacts')}
          className="inline-flex items-center gap-2"
          style={{ color: 'var(--ink-gray-5)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Contatos
        </button>
      </div>
    )
  }

  const fullName = contact.full_name ?? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
  const phoneNumber = contact.mobile_no ?? contact.phone

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-white)' }}>
      {/* ---- HEADER ---- */}
      <DetailHeader
        breadcrumbLabel="Contatos"
        breadcrumbHref="/crm/contacts"
        entityName={fullName}
        icon={User}
        iconColor="var(--ink-blue-3)"
        iconBg="var(--surface-blue-2)"
        onNameEdit={handleNameEdit}
        onDelete={canDelete ? () => setDeleteDialogOpen(true) : undefined}
      />

      {/* ---- BODY ---- */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden min-w-0 flex flex-col">
          <DetailTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={allTabs}>
            <div className="p-4 lg:p-6">
              {/* Entity-specific tabs */}
              {activeTab === 'deals' && <DealsListContent contactId={contactId} />}

              {/* Content tabs */}
              {activeTab === 'activity' && <ActivityTimeline doctype="Contact" docname={contactId} />}
              {activeTab === 'emails' && <EmailsTab />}
              {activeTab === 'comments' && <CommentsTab doctype="Contact" docname={contactId} />}
              {activeTab === 'data' && <DataTab fields={DATA_FIELDS} data={sidePanelData} />}
              {activeTab === 'tasks' && <TasksTab doctype="Contact" docname={contactId} />}
              {activeTab === 'notes' && <NotesTab doctype="Contact" docname={contactId} />}
              {activeTab === 'attachments' && <AttachmentsTab />}

              {/* Channel tabs */}
              {activeTab === 'whatsapp' && <ChannelTab channel="whatsapp" phoneNumber={phoneNumber} entityName={fullName} />}
              {activeTab === 'messenger' && <ChannelTab channel="messenger" phoneNumber={phoneNumber} entityName={fullName} />}
              {activeTab === 'instagram' && <ChannelTab channel="instagram" phoneNumber={phoneNumber} entityName={fullName} />}
              {activeTab === 'imessage' && <ChannelTab channel="imessage" phoneNumber={phoneNumber} entityName={fullName} />}
              {activeTab === 'booking' && <ChannelTab channel="booking" phoneNumber={phoneNumber} entityName={fullName} />}
              {activeTab === 'airbnb' && <ChannelTab channel="airbnb" phoneNumber={phoneNumber} entityName={fullName} />}
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
              <AvatarFallback
                style={{ backgroundColor: 'var(--surface-blue-2)', color: 'var(--ink-blue-3)', fontSize: '13px', fontWeight: 600 }}
              >
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-gray-9)' }}>
                {fullName}
              </p>
              {contact.designation && (
                <p className="truncate" style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                  {contact.designation}
                  {contact.company_name ? ` em ${contact.company_name}` : ''}
                </p>
              )}
            </div>
          </div>

          <SidePanelInfo fields={sidePanelFields} data={sidePanelData} onUpdate={handleFieldUpdate} loading={isLoading} />
        </aside>
      </div>

      {/* ---- DIALOGS ---- */}
      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
        onSave={(data) => updateMutation.mutate(data)}
        saving={updateMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Excluir contato</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Esta acao nao pode ser desfeita. O contato{' '}
              <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{fullName}</span>{' '}
              sera removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
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
