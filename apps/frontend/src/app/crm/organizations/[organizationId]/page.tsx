'use client'

// Usage: /crm/organizations/[organizationId]
// Full-page Organization detail view with Frappe-style header, tabbed content (including channels),
// and info side panel. Includes linked deals and contacts tabs, edit dialog, and stats.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { crmKeys } from '@/hooks/crm/use-crm-queries'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
  Mail,
  Phone,
  Building2,
  Globe,
  MapPin,
  Users,
  Handshake,
  DollarSign,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import type { Organization, DealListItem, CrmContact, UpdateOrganizationData } from '@/types/crm'

// ============================================
// EDIT DIALOG
// ============================================

function EditOrgDialog({
  open,
  onOpenChange,
  org,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  org: Organization
  onSave: (data: UpdateOrganizationData) => void
  saving: boolean
}) {
  const [formData, setFormData] = useState<UpdateOrganizationData>({
    organization_name: org.organization_name,
    website: org.website ?? '',
    email: org.email ?? '',
    phone: org.phone ?? '',
    address: org.address ?? '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const fields = [
    { key: 'organization_name', label: 'Nome', required: true },
    { key: 'website', label: 'Website' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Telefone' },
    { key: 'address', label: 'Endereco' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="rounded-xl border max-w-md"
        style={{ backgroundColor: 'var(--surface-white)', borderColor: 'var(--outline-gray-2)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Editar Organizacao
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

const formatCurrency = (value: number | null, currency = 'BRL') =>
  value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value) : '-'

function DealsListContent({ orgId }: { orgId: string }) {
  const router = useRouter()
  const { data: dealsData, isLoading } = useQuery({
    queryKey: [...crmKeys.organizationDetail(orgId), 'deals'],
    queryFn: () => crmApi.organizations.deals(orgId),
    select: (res) => res.data,
    enabled: !!orgId,
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
    return <EmptyState icon={Handshake} title="Nenhuma negociacao" description="Esta organizacao nao tem negociacoes." />
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
              <TableCell className="py-2.5 pl-4 text-sm font-medium" style={{ color: 'var(--ink-gray-8)' }}>{deal.naming_series}</TableCell>
              <TableCell className="py-2.5"><StatusBadge label={deal.status.label} color={deal.status.color} /></TableCell>
              <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>{formatCurrency(deal.deal_value, deal.currency)}</TableCell>
              <TableCell className="py-2.5"><UserAvatar user={deal.deal_owner} size="sm" showName /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================
// CONTACTS LIST (inline tab content)
// ============================================

function ContactsListContent({ orgId }: { orgId: string }) {
  const router = useRouter()
  const { data: contactsData, isLoading } = useQuery({
    queryKey: [...crmKeys.organizationDetail(orgId), 'contacts'],
    queryFn: () => crmApi.organizations.contacts(orgId),
    select: (res) => res.data,
    enabled: !!orgId,
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

  if (!contactsData?.data?.length) {
    return <EmptyState icon={Users} title="Nenhum contato" description="Esta organizacao nao tem contatos vinculados." />
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--surface-white)', borderColor: 'var(--outline-gray-1)' }}>
      <Table>
        <TableHeader>
          <TableRow className="border-b" style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}>
            <TableHead className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Nome</TableHead>
            <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Email</TableHead>
            <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Telefone</TableHead>
            <TableHead className="py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-gray-5)' }}>Cargo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contactsData.data.map((contact: CrmContact) => (
            <TableRow
              key={contact.id}
              className="border-b cursor-pointer transition-colors"
              style={{ borderColor: 'var(--outline-gray-1)' }}
              onClick={() => router.push(`/crm/contacts/${contact.id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              <TableCell className="py-2.5 pl-4 text-sm font-medium" style={{ color: 'var(--ink-gray-8)' }}>{contact.full_name}</TableCell>
              <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                {contact.email || <span style={{ color: 'var(--ink-gray-4)' }}>-</span>}
              </TableCell>
              <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                {contact.mobile_no || contact.phone || <span style={{ color: 'var(--ink-gray-4)' }}>-</span>}
              </TableCell>
              <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                {contact.designation || <span style={{ color: 'var(--ink-gray-4)' }}>-</span>}
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
  { key: 'organization_name', label: 'Nome', type: 'text' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Telefone', type: 'phone' },
  { key: 'no_of_employees', label: 'Funcionarios', type: 'number' },
  { key: 'annual_revenue', label: 'Receita anual', type: 'currency' },
  { key: 'address', label: 'Endereco', type: 'text' },
]

// ============================================
// CUSTOM TABS
// ============================================

const ENTITY_TABS: TabConfig[] = [
  { value: 'deals', label: 'Negociacoes', icon: Handshake },
  { value: 'contacts', label: 'Contatos', icon: Users },
]

// ============================================
// MAIN PAGE
// ============================================

export default function OrganizationDetailPage() {
  const { organizationId } = useParams<{ organizationId: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuth()

  // RBAC: only SUPER_ADMIN and TENANT_ADMIN can delete
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN'

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { activeTab, setActiveTab } = useDetailTabs('activity')

  // Fetch organization
  const {
    data: org,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: crmKeys.organizationDetail(organizationId),
    queryFn: () => crmApi.organizations.get(organizationId),
    select: (res) => res.data,
    enabled: !!organizationId,
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrganizationData) => crmApi.organizations.update(organizationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.organizationDetail(organizationId) })
      toast.success('Organizacao atualizada')
      setEditDialogOpen(false)
    },
    onError: () => toast.error('Erro ao atualizar'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => crmApi.organizations.delete(organizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.organizations() })
      toast.success('Organizacao removida')
      router.push('/crm/organizations')
    },
    onError: () => toast.error('Erro ao remover'),
  })

  // Inline name edit
  const handleNameEdit = (newName: string) => {
    updateMutation.mutate({ organization_name: newName })
  }

  // Field update handler
  const handleFieldUpdate = (field: string, value: unknown) => {
    updateMutation.mutate({ [field]: value } as UpdateOrganizationData)
  }

  // Side panel fields
  const sidePanelFields: FieldDefinition[] = [
    { key: 'website', label: 'Website', type: 'url', editable: true, group: 'Informacoes', icon: Globe },
    { key: 'email', label: 'Email', type: 'email', editable: true, group: 'Informacoes', icon: Mail },
    { key: 'phone', label: 'Telefone', type: 'phone', editable: true, group: 'Informacoes', icon: Phone },
    { key: 'no_of_employees', label: 'Funcionarios', type: 'number', editable: true, group: 'Detalhes', icon: Users },
    { key: 'annual_revenue', label: 'Receita anual', type: 'currency', editable: true, group: 'Detalhes', icon: DollarSign },
    { key: 'industry_name', label: 'Industria', type: 'text', editable: false, group: 'Detalhes', icon: Building2 },
    { key: 'territory_name', label: 'Territorio', type: 'text', editable: false, group: 'Detalhes', icon: MapPin },
    { key: 'address', label: 'Endereco', type: 'text', editable: true, group: 'Detalhes', icon: MapPin },
  ]

  const sidePanelData: Record<string, unknown> = org
    ? {
        website: org.website,
        email: org.email,
        phone: org.phone,
        no_of_employees: org.no_of_employees,
        annual_revenue: org.annual_revenue,
        industry_name: org.industry?.name,
        territory_name: org.territory?.name,
        address: org.address,
        organization_name: org.organization_name,
      }
    : {}

  // All tabs
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
  if (isError || !org) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8" style={{ backgroundColor: 'var(--surface-white)' }}>
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--ink-amber-3)' }} />
        <p style={{ color: 'var(--ink-gray-8)', fontWeight: 500 }}>Nao foi possivel carregar a organizacao</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2"
          style={{ color: 'var(--ink-blue-3)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
        <button
          onClick={() => router.push('/crm/organizations')}
          className="inline-flex items-center gap-2"
          style={{ color: 'var(--ink-gray-5)', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Organizacoes
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-white)' }}>
      {/* ---- HEADER ---- */}
      <DetailHeader
        breadcrumbLabel="Organizacoes"
        breadcrumbHref="/crm/organizations"
        entityName={org.organization_name}
        icon={Building2}
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
              {activeTab === 'deals' && <DealsListContent orgId={organizationId} />}
              {activeTab === 'contacts' && <ContactsListContent orgId={organizationId} />}

              {/* Content tabs */}
              {activeTab === 'activity' && <ActivityTimeline doctype="Organization" docname={organizationId} />}
              {activeTab === 'emails' && <EmailsTab />}
              {activeTab === 'comments' && <CommentsTab doctype="Organization" docname={organizationId} />}
              {activeTab === 'data' && <DataTab fields={DATA_FIELDS} data={sidePanelData} />}
              {activeTab === 'tasks' && <TasksTab doctype="Organization" docname={organizationId} />}
              {activeTab === 'notes' && <NotesTab doctype="Organization" docname={organizationId} />}
              {activeTab === 'attachments' && <AttachmentsTab />}

              {/* Channel tabs */}
              {activeTab === 'whatsapp' && <ChannelTab channel="whatsapp" phoneNumber={org.phone} entityName={org.organization_name} />}
              {activeTab === 'messenger' && <ChannelTab channel="messenger" phoneNumber={org.phone} entityName={org.organization_name} />}
              {activeTab === 'instagram' && <ChannelTab channel="instagram" phoneNumber={org.phone} entityName={org.organization_name} />}
              {activeTab === 'imessage' && <ChannelTab channel="imessage" phoneNumber={org.phone} entityName={org.organization_name} />}
              {activeTab === 'booking' && <ChannelTab channel="booking" phoneNumber={org.phone} entityName={org.organization_name} />}
              {activeTab === 'airbnb' && <ChannelTab channel="airbnb" phoneNumber={org.phone} entityName={org.organization_name} />}
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
            {org.logo_url && /^https?:\/\//i.test(org.logo_url) ? (
              <img
                src={org.logo_url}
                alt={org.organization_name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                style={{ border: '1px solid var(--outline-gray-1)' }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0"
                style={{ backgroundColor: 'var(--surface-blue-2)', color: 'var(--ink-blue-3)' }}
              >
                {org.organization_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-gray-9)' }}>
                {org.organization_name}
              </p>
              {org.website && /^https?:\/\//i.test(org.website) && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline truncate block"
                  style={{ color: 'var(--ink-blue-3)', marginTop: '1px' }}
                >
                  {org.website}
                </a>
              )}
            </div>
          </div>

          <SidePanelInfo fields={sidePanelFields} data={sidePanelData} onUpdate={handleFieldUpdate} loading={isLoading} />
        </aside>
      </div>

      {/* ---- DIALOGS ---- */}
      <EditOrgDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        org={org}
        onSave={(data) => updateMutation.mutate(data)}
        saving={updateMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Excluir organizacao</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Esta acao nao pode ser desfeita.{' '}
              <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{org.organization_name}</span>{' '}
              sera removida permanentemente.
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
