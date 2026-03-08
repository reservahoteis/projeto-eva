'use client'

// Usage: /crm/leads/[leadId]
// Contact detail view with tabs (activity, data, notes, channels).
// Loads contact from Express backend via contactService.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactService } from '@/services/contact.service'
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
import { DetailTabs, CHANNEL_TABS, useDetailTabs } from '@/components/crm/detail-tabs'
import { ActivityTimeline } from '@/components/crm/activity-timeline'
import { SidePanelInfo } from '@/components/crm/side-panel-info'
import type { FieldDefinition } from '@/components/crm/side-panel-info'
import {
  NotesTab,
  DataTab,
  ChannelTab,
} from '@/components/crm/tabs'
import type { DataField } from '@/components/crm/tabs'
import type { TabConfig } from '@/components/crm/detail-tabs'
import {
  RefreshCw,
  Target,
  ArrowLeft,
  AlertTriangle,
  Trash2,
  User,
  Mail,
  Phone,
  Building2,
  Activity,
  Database,
  FileText,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import type { Contact } from '@/types'

// ============================================
// HELPERS
// ============================================

function getDisplayName(contact: Contact): string {
  if (contact.firstName || contact.lastName) {
    return `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
  }
  return contact.name ?? contact.phoneNumber
}

// ============================================
// DATA FIELDS CONFIG
// ============================================

const DATA_FIELDS: DataField[] = [
  { key: 'firstName', label: 'Nome', type: 'text' },
  { key: 'lastName', label: 'Sobrenome', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phoneNumber', label: 'Telefone', type: 'phone' },
  { key: 'companyName', label: 'Empresa', type: 'text' },
  { key: 'designation', label: 'Cargo', type: 'text' },
  { key: 'channel', label: 'Canal', type: 'text' },
]

// ============================================
// TABS CONFIG
// ============================================

const CONTACT_CONTENT_TABS: TabConfig[] = [
  { value: 'activity', label: 'Atividade', icon: Activity },
  { value: 'data', label: 'Dados', icon: Database },
  { value: 'notes', label: 'Notas', icon: FileText },
]

const ALL_TABS: TabConfig[] = [
  ...CONTACT_CONTENT_TABS,
  ...CHANNEL_TABS,
]

// ============================================
// MAIN PAGE
// ============================================

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN'

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { activeTab, setActiveTab } = useDetailTabs('activity')

  // Fetch contact from Express backend
  const {
    data: contact,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['contact', leadId],
    queryFn: () => contactService.getById(leadId),
  })

  // Update contact mutation
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof contactService.update>[1]) =>
      contactService.update(leadId, data),
    onSuccess: () => {
      toast.success('Contato atualizado')
      queryClient.invalidateQueries({ queryKey: ['contact', leadId] })
    },
    onError: () => toast.error('Erro ao atualizar contato'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => contactService.delete(leadId),
    onSuccess: () => {
      toast.success('Contato excluido')
      queryClient.invalidateQueries({ queryKey: ['contacts-list'] })
      router.push('/crm/leads')
    },
    onError: () => toast.error('Erro ao excluir contato'),
  })

  // Inline name save
  const handleNameEdit = (newName: string) => {
    const parts = newName.trim().split(/\s+/)
    const firstName = parts[0] ?? ''
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    updateMutation.mutate({ firstName, lastName })
  }

  // Side panel field update handler
  const handleFieldUpdate = (field: string, value: unknown) => {
    updateMutation.mutate({ [field]: value })
  }

  // Side panel field definitions
  const sidePanelFields: FieldDefinition[] = [
    { key: 'firstName', label: 'Nome', type: 'text', editable: true, group: 'Contato', icon: User },
    { key: 'lastName', label: 'Sobrenome', type: 'text', editable: true, group: 'Contato', icon: User },
    { key: 'email', label: 'Email', type: 'email', editable: true, group: 'Contato', icon: Mail },
    { key: 'phoneNumber', label: 'Telefone', type: 'phone', editable: false, group: 'Contato', icon: Phone },
    { key: 'companyName', label: 'Empresa', type: 'text', editable: true, group: 'Organizacao', icon: Building2 },
    { key: 'designation', label: 'Cargo', type: 'text', editable: true, group: 'Organizacao' },
    { key: 'channel', label: 'Canal', type: 'text', editable: false, group: 'Info' },
  ]

  // Build side panel data
  const sidePanelData: Record<string, unknown> = contact
    ? {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phoneNumber: contact.phoneNumber,
        companyName: contact.companyName,
        designation: contact.designation,
        channel: contact.channel,
      }
    : {}

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
  if (isError || !contact) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8" style={{ backgroundColor: 'var(--surface-white)' }}>
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--ink-amber-3)' }} />
        <p style={{ color: 'var(--ink-gray-8)', fontWeight: 500 }}>Nao foi possivel carregar o contato</p>
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

  const fullName = getDisplayName(contact)

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--surface-white)' }}>
      {/* ---- HEADER ---- */}
      <DetailHeader
        breadcrumbLabel="Leads"
        breadcrumbHref="/crm/leads"
        entityName={fullName}
        icon={Target}
        iconColor="var(--ink-blue-3)"
        iconBg="var(--surface-blue-2)"
        onNameEdit={handleNameEdit}
        onDelete={canDelete ? () => setShowDeleteDialog(true) : undefined}
      />

      {/* ---- BODY ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content with tabs */}
        <main className="flex-1 overflow-hidden min-w-0 flex flex-col">
          <DetailTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={ALL_TABS}
          >
            <div className="p-4 lg:p-6">
              {/* Content tabs */}
              {activeTab === 'activity' && (
                <ActivityTimeline doctype="Contact" docname={leadId} />
              )}
              {activeTab === 'data' && (
                <DataTab fields={DATA_FIELDS} data={sidePanelData} />
              )}
              {activeTab === 'notes' && (
                <NotesTab doctype="Contact" docname={leadId} />
              )}

              {/* Channel tabs */}
              {activeTab === 'whatsapp' && (
                <ChannelTab channel="whatsapp" phoneNumber={contact.phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'messenger' && (
                <ChannelTab channel="messenger" phoneNumber={contact.phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'instagram' && (
                <ChannelTab channel="instagram" phoneNumber={contact.phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'imessage' && (
                <ChannelTab channel="imessage" phoneNumber={contact.phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'booking' && (
                <ChannelTab channel="booking" phoneNumber={contact.phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'airbnb' && (
                <ChannelTab channel="airbnb" phoneNumber={contact.phoneNumber} entityName={fullName} />
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
              <AvatarImage src={contact.profilePictureUrl ?? undefined} alt={fullName} />
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
              {contact.companyName && (
                <p className="truncate" style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                  {contact.companyName}
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

      {/* ---- DELETE DIALOG ---- */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(o) => !o && setShowDeleteDialog(false)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Excluir contato</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja excluir{' '}
              <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{fullName}</span>?
              Todas as conversas e mensagens associadas tambem serao removidas.
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
