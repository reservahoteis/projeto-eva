'use client'

// Usage: /crm/contacts/[contactId]
// Contact detail view backed by Express /api/contacts — replaces CRM Core reads.
// Shows real conversations from Express + info side panel with Express Contact fields.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactService } from '@/services/contact.service'
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
  ChannelTab,
} from '@/components/crm/tabs'
import type { DataField } from '@/components/crm/tabs'
import {
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Contact, Conversation, ConversationStatus } from '@/types'

// ============================================
// LOCAL TYPES
// ============================================

// Conversations returned by the contact endpoint include _count.messages
// instead of the unreadCount field used in the global conversations list.
type ContactConversation = Conversation & {
  channel: string
  _count: { messages: number }
}

// ============================================
// QUERY KEYS
// ============================================

const expressContactKeys = {
  all: ['express-contacts'] as const,
  detail: (id: string) => ['express-contacts', id] as const,
  conversations: (id: string) => ['express-contacts', id, 'conversations'] as const,
}

// ============================================
// STATUS BADGE
// ============================================

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: '#E4FAEB', text: '#278F5E', label: 'Aberta' },
  IN_PROGRESS: { bg: '#E6F4FF', text: '#007BE0', label: 'Em andamento' },
  BOT_HANDLING: { bg: '#F3F0FF', text: '#6846E3', label: 'Bot' },
  WAITING: { bg: '#FFF7D3', text: '#DB7706', label: 'Aguardando' },
  CLOSED: { bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-5)', label: 'Fechada' },
  ARCHIVED: { bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-4)', label: 'Arquivada' },
}

function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const style = STATUS_STYLES[status] ?? { bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-5)', label: status }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}

// ============================================
// CONVERSATIONS TAB
// ============================================

function ConversationsTab({ contactId }: { contactId: string }) {
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: expressContactKeys.conversations(contactId),
    queryFn: () => contactService.getConversations(contactId, { limit: 50 }),
    enabled: !!contactId,
  })

  const conversations = data?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-12 w-full rounded-lg"
            style={{ backgroundColor: 'var(--surface-gray-2)' }}
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <AlertTriangle className="w-6 h-6" style={{ color: 'var(--ink-amber-3)' }} />
        <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
          Nao foi possivel carregar as conversas.
        </p>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <MessageSquare className="w-8 h-8" style={{ color: 'var(--ink-gray-3)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-6)' }}>
          Nenhuma conversa encontrada
        </p>
        <p className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
          Este contato ainda nao iniciou conversas.
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ backgroundColor: 'var(--surface-white)', borderColor: 'var(--outline-gray-1)' }}
    >
      <Table>
        <TableHeader>
          <TableRow
            className="border-b"
            style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
          >
            <TableHead
              className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Canal
            </TableHead>
            <TableHead
              className="py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Status
            </TableHead>
            <TableHead
              className="py-2 text-[11px] font-semibold uppercase tracking-wider text-right hidden md:table-cell"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Mensagens
            </TableHead>
            <TableHead
              className="py-2 text-[11px] font-semibold uppercase tracking-wider hidden lg:table-cell"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Atendente
            </TableHead>
            <TableHead
              className="py-2 text-[11px] font-semibold uppercase tracking-wider hidden xl:table-cell"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Ultima mensagem
            </TableHead>
            <TableHead className="py-2 pr-4 w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(conversations as ContactConversation[]).map((conv) => (
            <TableRow
              key={conv.id}
              className="border-b cursor-pointer transition-colors"
              style={{ borderColor: 'var(--outline-gray-1)' }}
              onClick={() => router.push(`/dashboard/conversations/${conv.id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              <TableCell className="py-2.5 pl-4">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--ink-gray-7)' }}
                >
                  {conv.channel ?? 'WHATSAPP'}
                </span>
              </TableCell>
              <TableCell className="py-2.5">
                <ConversationStatusBadge status={conv.status} />
              </TableCell>
              <TableCell className="py-2.5 text-right hidden md:table-cell">
                <span className="text-sm tabular-nums" style={{ color: 'var(--ink-gray-6)' }}>
                  {(conv._count?.messages ?? 0) > 0 ? (
                    <span
                      className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: 'var(--ink-blue-3)' }}
                    >
                      {conv._count.messages}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-gray-4)' }}>0</span>
                  )}
                </span>
              </TableCell>
              <TableCell className="py-2.5 hidden lg:table-cell">
                <span className="text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                  {conv.assignedTo?.name ?? (
                    <span style={{ color: 'var(--ink-gray-4)' }}>—</span>
                  )}
                </span>
              </TableCell>
              <TableCell className="py-2.5 hidden xl:table-cell">
                <span
                  className="text-sm"
                  style={{ color: 'var(--ink-gray-5)' }}
                  title={format(new Date(conv.lastMessageAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                >
                  {formatDistanceToNow(new Date(conv.lastMessageAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </TableCell>
              <TableCell className="py-2.5 pr-4">
                <ExternalLink
                  className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100"
                  style={{ color: 'var(--ink-gray-5)' }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ============================================
// EDIT DIALOG
// ============================================

interface EditContactFormData {
  phoneNumber?: string
  firstName?: string
  lastName?: string
  email?: string
  companyName?: string
  designation?: string
}

function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact
  onSave: (data: EditContactFormData) => void
  saving: boolean
}) {
  const [formData, setFormData] = useState<EditContactFormData>({
    phoneNumber: contact.phoneNumber,
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    email: contact.email ?? '',
    companyName: contact.companyName ?? '',
    designation: contact.designation ?? '',
  })

  const fields: Array<{ key: keyof EditContactFormData; label: string; type?: string; required?: boolean; disabled?: boolean; hint?: string }> = [
    { key: 'phoneNumber', label: 'Telefone', required: true, disabled: true, hint: 'Telefone nao pode ser alterado' },
    { key: 'firstName', label: 'Nome' },
    { key: 'lastName', label: 'Sobrenome' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'companyName', label: 'Empresa' },
    { key: 'designation', label: 'Cargo' },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

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
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--ink-gray-5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {field.label}{' '}
                {field.required && <span style={{ color: 'var(--ink-red-3)' }}>*</span>}
              </label>
              <Input
                type={field.type ?? 'text'}
                value={(formData[field.key] as string) ?? ''}
                onChange={(e) =>
                  !field.disabled &&
                  setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className="h-8 text-sm rounded border"
                style={{
                  backgroundColor: field.disabled ? 'var(--surface-gray-1)' : 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                  color: field.disabled ? 'var(--ink-gray-5)' : 'var(--ink-gray-8)',
                  cursor: field.disabled ? 'not-allowed' : undefined,
                }}
                disabled={field.disabled}
                title={field.hint}
                required={field.required}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded text-sm transition-colors"
              style={{
                border: '1px solid var(--outline-gray-2)',
                color: 'var(--ink-gray-7)',
                backgroundColor: 'var(--surface-white)',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 rounded text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: 'var(--surface-gray-7)',
                color: '#fff',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
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
// DATA FIELDS CONFIG
// ============================================

const DATA_FIELDS: DataField[] = [
  { key: 'phoneNumber', label: 'Telefone', type: 'phone' },
  { key: 'firstName', label: 'Nome', type: 'text' },
  { key: 'lastName', label: 'Sobrenome', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'companyName', label: 'Empresa', type: 'text' },
  { key: 'designation', label: 'Cargo', type: 'text' },
]

// ============================================
// CUSTOM TABS
// ============================================

const ENTITY_TABS: TabConfig[] = [
  { value: 'conversations', label: 'Conversas', icon: MessageSquare },
]

// Content tabs excluding emails and attachments (CRM Core only)
const FILTERED_CONTENT_TABS = CONTENT_TABS.filter(
  (t) => !['emails', 'attachments'].includes(t.value)
)

// ============================================
// MAIN PAGE
// ============================================

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { user } = useAuth()

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN'

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { activeTab, setActiveTab } = useDetailTabs('conversations')

  // Fetch contact from Express
  const {
    data: contact,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: expressContactKeys.detail(contactId),
    queryFn: () => contactService.getById(contactId),
    enabled: !!contactId,
  })

  // Update mutation — Express PATCH /api/contacts/:id
  const updateMutation = useMutation({
    mutationFn: (data: EditContactFormData) => {
      return contactService.update(contactId, {
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        email: data.email || undefined,
        companyName: data.companyName || undefined,
        designation: data.designation || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expressContactKeys.detail(contactId) })
      toast.success('Contato atualizado')
      setEditDialogOpen(false)
    },
    onError: () => toast.error('Erro ao atualizar contato'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => contactService.delete(contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['express-contacts'] })
      toast.success('Contato removido')
      router.push('/crm/contacts')
    },
    onError: () => toast.error('Erro ao remover contato'),
  })

  // Inline name edit
  const handleNameEdit = (newName: string) => {
    const parts = newName.trim().split(/\s+/)
    const firstName = parts[0] ?? ''
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    updateMutation.mutate({ firstName, lastName })
  }

  // All tabs: conversations first, then content (filtered), then channels
  const allTabs = [...ENTITY_TABS, ...FILTERED_CONTENT_TABS, ...CHANNEL_TABS]

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
      <div
        className="h-full flex flex-col items-center justify-center gap-4 p-8"
        style={{ backgroundColor: 'var(--surface-white)' }}
      >
        <AlertTriangle className="w-10 h-10" style={{ color: 'var(--ink-amber-3)' }} />
        <p style={{ color: 'var(--ink-gray-8)', fontWeight: 500 }}>
          Nao foi possivel carregar o contato
        </p>
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
          onClick={() => router.push('/crm/contacts')}
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
          Voltar para Contatos
        </button>
      </div>
    )
  }

  // Derive display name from Express Contact fields
  const fullName =
    contact.firstName || contact.lastName
      ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim()
      : contact.name ?? contact.phoneNumber

  const phoneNumber = contact.phoneNumber

  // Side panel fields definition
  const sidePanelFields: FieldDefinition[] = [
    { key: 'phoneNumber', label: 'Telefone', type: 'phone', editable: false, group: 'Contato', icon: Phone },
    { key: 'email', label: 'Email', type: 'email', editable: true, group: 'Contato', icon: Mail },
    { key: 'companyName', label: 'Empresa', type: 'text', editable: true, group: 'Trabalho', icon: Building2 },
    { key: 'designation', label: 'Cargo', type: 'text', editable: true, group: 'Trabalho', icon: Briefcase },
    { key: 'createdAt', label: 'Criado em', type: 'date', editable: false, group: 'Detalhes', icon: Calendar },
  ]

  const sidePanelData: Record<string, unknown> = {
    phoneNumber: contact.phoneNumber,
    email: contact.email,
    companyName: contact.companyName,
    designation: contact.designation,
    createdAt: contact.createdAt
      ? format(new Date(contact.createdAt), "dd/MM/yyyy", { locale: ptBR })
      : undefined,
  }

  const sidePanelUpdateHandler = (field: string, value: unknown) => {
    updateMutation.mutate({ [field]: value } as EditContactFormData)
  }

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
              {/* Conversations tab — primary tab */}
              {activeTab === 'conversations' && (
                <ConversationsTab contactId={contactId} />
              )}

              {/* Content tabs */}
              {activeTab === 'activity' && (
                <ActivityTimeline doctype="Contact" docname={contactId} />
              )}
              {activeTab === 'comments' && (
                <CommentsTab doctype="Contact" docname={contactId} />
              )}
              {activeTab === 'data' && (
                <DataTab fields={DATA_FIELDS} data={sidePanelData} />
              )}
              {activeTab === 'tasks' && (
                <TasksTab doctype="Contact" docname={contactId} />
              )}
              {activeTab === 'notes' && (
                <NotesTab doctype="Contact" docname={contactId} />
              )}

              {/* Channel tabs */}
              {activeTab === 'whatsapp' && (
                <ChannelTab channel="whatsapp" phoneNumber={phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'messenger' && (
                <ChannelTab channel="messenger" phoneNumber={phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'instagram' && (
                <ChannelTab channel="instagram" phoneNumber={phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'imessage' && (
                <ChannelTab channel="imessage" phoneNumber={phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'booking' && (
                <ChannelTab channel="booking" phoneNumber={phoneNumber} entityName={fullName} />
              )}
              {activeTab === 'airbnb' && (
                <ChannelTab channel="airbnb" phoneNumber={phoneNumber} entityName={fullName} />
              )}
            </div>
          </DetailTabs>
        </main>

        {/* ---- SIDE PANEL ---- */}
        <aside
          className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-gray-1)', borderLeft: '1px solid var(--outline-gray-1)' }}
        >
          {/* Side panel header */}
          <div
            className="flex items-center gap-3 px-4 py-4"
            style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
          >
            <Avatar className="w-10 h-10 flex-shrink-0">
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
              {contact.designation && (
                <p className="truncate" style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                  {contact.designation}
                  {contact.companyName ? ` em ${contact.companyName}` : ''}
                </p>
              )}
              <p
                className="truncate font-mono"
                style={{ fontSize: '11px', color: 'var(--ink-gray-4)', marginTop: '2px' }}
              >
                {contactService.formatPhoneNumber(contact.phoneNumber)}
              </p>
            </div>
          </div>

          {/* Conversation count summary */}
          {contact._count && (
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--outline-gray-1)' }}
            >
              <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-4)' }} />
              <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                {contact._count.conversations} conversa{contact._count.conversations !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <SidePanelInfo
            fields={sidePanelFields}
            data={sidePanelData}
            onUpdate={sidePanelUpdateHandler}
            loading={isLoading}
          />
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
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>
              Excluir contato
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Esta acao nao pode ser desfeita. O contato{' '}
              <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{fullName}</span>{' '}
              sera removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
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
