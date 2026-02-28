'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { crmKeys } from '@/hooks/crm/use-crm-queries'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserAvatar } from '@/components/crm/user-avatar'
import { StatusBadge } from '@/components/crm/status-badge'
import { EmptyState } from '@/components/crm/empty-state'
import {
  ArrowLeft,
  Edit,
  Trash2,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Briefcase,
  MapPin,
  Globe,
  Handshake,
  FileText,
  MessageSquare,
  ListTodo,
  PhoneCall,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CrmContact, DealListItem, UpdateContactData } from '@/types/crm'

// Espresso avatar palette — deterministic color per contact id
const AVATAR_PALETTE = [
  { bg: '#E6F4FF', text: '#007BE0' },
  { bg: '#E4FAEB', text: '#278F5E' },
  { bg: '#FFF7D3', text: '#DB7706' },
  { bg: '#FFE7E7', text: '#E03636' },
  { bg: '#F3F0FF', text: '#6846E3' },
] as const

function getAvatarPalette(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]
}

export default function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'deals' | 'activities' | 'notes'>('deals')

  // Fetch contact
  const { data: contact, isLoading, error } = useQuery({
    queryKey: crmKeys.contactDetail(contactId),
    queryFn: () => crmApi.contacts.get(contactId),
    select: (res) => res.data,
    enabled: !!contactId,
  })

  // Fetch linked deals
  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: [...crmKeys.contactDetail(contactId), 'deals'],
    queryFn: () => crmApi.contacts.deals(contactId),
    select: (res) => res.data,
    enabled: !!contactId && activeTab === 'deals',
  })

  // Fetch activities
  const { data: activitiesData } = useQuery({
    queryKey: crmKeys.activities('Contact', contactId),
    queryFn: () => crmApi.activities.list('Contact', contactId),
    select: (res) => res.data,
    enabled: !!contactId && activeTab === 'activities',
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

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" style={{ backgroundColor: 'var(--surface-white)' }}>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <EmptyState
        title="Contato nao encontrado"
        description="O contato solicitado nao existe ou foi removido."
        actionLabel="Voltar"
        onAction={() => router.push('/crm/contacts')}
      />
    )
  }

  const tabs = [
    { id: 'deals' as const, label: 'Negociacoes', icon: Handshake },
    { id: 'activities' as const, label: 'Atividades', icon: ListTodo },
    { id: 'notes' as const, label: 'Notas', icon: FileText },
  ]

  const infoFields = [
    { label: 'Email', value: contact.email, icon: Mail },
    { label: 'Celular', value: contact.mobile_no, icon: Phone },
    { label: 'Telefone', value: contact.phone, icon: PhoneCall },
    { label: 'Empresa', value: contact.company_name, icon: Building2 },
    { label: 'Cargo', value: contact.designation, icon: Briefcase },
    { label: 'Organizacao', value: contact.organization?.organization_name, icon: Building2 },
    { label: 'Industria', value: contact.industry?.name, icon: Globe },
    { label: 'Territorio', value: contact.territory?.name, icon: MapPin },
  ]

  const avatarPalette = getAvatarPalette(contact.id ?? contact.full_name ?? 'c')

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-white)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b"
        style={{
          backgroundColor: 'var(--surface-white)',
          borderColor: 'var(--outline-gray-1)',
        }}
      >
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/crm/contacts')}
              className="flex items-center justify-center w-7 h-7 rounded transition-colors"
              style={{ color: 'var(--ink-gray-5)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              aria-label="Voltar para contatos"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                style={{ backgroundColor: avatarPalette.bg, color: avatarPalette.text }}
              >
                {contact.full_name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div>
                <h1
                  className="font-semibold leading-tight"
                  style={{ fontSize: '15px', color: 'var(--ink-gray-9)' }}
                >
                  {contact.full_name}
                </h1>
                {contact.designation && (
                  <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)', marginTop: '1px' }}>
                    {contact.designation}
                    {contact.company_name ? ` em ${contact.company_name}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors"
              style={{
                border: '1px solid var(--outline-gray-2)',
                color: 'var(--ink-gray-8)',
                backgroundColor: 'var(--surface-white)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-white)')}
            >
              <Edit className="w-3.5 h-3.5" />
              Editar
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-7 h-7 rounded transition-colors"
                  style={{ color: 'var(--ink-gray-5)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  aria-label="Mais acoes"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 rounded-lg border shadow-md"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                }}
              >
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-sm cursor-pointer"
                  style={{ color: 'var(--ink-red-3)' }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Excluir contato
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main area */}
          <div className="lg:col-span-2 space-y-5">
            {/* Tabs — Frappe-style underline tabs */}
            <div
              className="flex items-center gap-0 border-b"
              style={{ borderColor: 'var(--outline-gray-1)' }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative"
                    style={{
                      color: isActive ? 'var(--ink-gray-9)' : 'var(--ink-gray-5)',
                      borderBottom: isActive ? '2px solid var(--ink-gray-9)' : '2px solid transparent',
                      marginBottom: '-1px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'var(--ink-gray-8)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'var(--ink-gray-5)'
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'deals' && (
              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                }}
              >
                {dealsLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : !dealsData?.data?.length ? (
                  <EmptyState
                    icon={Handshake}
                    title="Nenhuma negociacao vinculada"
                    description="Este contato ainda nao tem negociacoes."
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
                          className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-gray-5)' }}
                        >
                          Negociacao
                        </TableHead>
                        <TableHead
                          className="py-2 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-gray-5)' }}
                        >
                          Status
                        </TableHead>
                        <TableHead
                          className="py-2 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-gray-5)' }}
                        >
                          Valor
                        </TableHead>
                        <TableHead
                          className="py-2 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-gray-5)' }}
                        >
                          Responsavel
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dealsData.data.map((deal: DealListItem) => (
                        <TableRow
                          key={deal.id}
                          className="border-b cursor-pointer transition-colors"
                          style={{ borderColor: 'var(--outline-gray-1)' }}
                          onClick={() => router.push(`/crm/deals/${deal.id}`)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = ''
                          }}
                        >
                          <TableCell
                            className="py-2.5 pl-4 text-sm font-medium"
                            style={{ color: 'var(--ink-gray-8)' }}
                          >
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
                )}
              </div>
            )}

            {activeTab === 'activities' && (
              <div
                className="rounded-lg border p-6"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                }}
              >
                {!activitiesData?.data?.length ? (
                  <EmptyState
                    icon={ListTodo}
                    title="Nenhuma atividade"
                    description="Atividades aparecerão aqui quando houver interacoes."
                  />
                ) : (
                  <div className="space-y-3">
                    {activitiesData.data.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex gap-3 p-3 rounded-lg transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'var(--surface-blue-2)' }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ink-blue-3)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm" style={{ color: 'var(--ink-gray-8)' }}>
                            {activity.title}
                          </p>
                          {activity.content && (
                            <p
                              className="text-xs truncate mt-0.5"
                              style={{ color: 'var(--ink-gray-5)' }}
                            >
                              {activity.content}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {activity.created_by && (
                              <UserAvatar user={activity.created_by} size="sm" showName />
                            )}
                            <span className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
                              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div
                className="rounded-lg border p-6"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                }}
              >
                <EmptyState
                  icon={FileText}
                  title="Nenhuma nota"
                  description="Adicione notas sobre este contato."
                />
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* Info card */}
            <div
              className="rounded-lg border overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-gray-1)',
                borderColor: 'var(--outline-gray-1)',
              }}
            >
              <div
                className="px-4 py-3 border-b"
                style={{ borderColor: 'var(--outline-gray-1)' }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--ink-gray-5)',
                  }}
                >
                  Informacoes
                </span>
              </div>
              <div className="px-4 py-3 divide-y" style={{ borderColor: 'var(--outline-gray-1)' }}>
                {infoFields.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="py-2.5 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3" style={{ color: 'var(--ink-gray-4)' }} />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: 'var(--ink-gray-5)',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    <span
                      className="truncate pl-0"
                      style={{ fontSize: '14px', color: value ? 'var(--ink-gray-8)' : 'var(--ink-gray-4)' }}
                    >
                      {value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dates card */}
            <div
              className="rounded-lg border overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-gray-1)',
                borderColor: 'var(--outline-gray-1)',
              }}
            >
              <div
                className="px-4 py-3 border-b"
                style={{ borderColor: 'var(--outline-gray-1)' }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--ink-gray-5)',
                  }}
                >
                  Datas
                </span>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>Criado</span>
                  <span style={{ fontSize: '13px', color: 'var(--ink-gray-8)' }}>
                    {formatDistanceToNow(new Date(contact.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>Atualizado</span>
                  <span style={{ fontSize: '13px', color: 'var(--ink-gray-8)' }}>
                    {formatDistanceToNow(new Date(contact.updated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditContactDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contact={contact}
        onSave={(data) => updateMutation.mutate(data)}
        saving={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
              Excluir contato?
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-sm"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Esta acao nao pode ser desfeita. O contato{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>&quot;{contact.full_name}&quot;</strong>{' '}
              sera removido permanentemente.
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
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-sm h-8 px-3 rounded text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--ink-red-3)' }}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

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
                {field.required && (
                  <span style={{ color: 'var(--ink-red-3)' }}>*</span>
                )}
              </label>
              <Input
                type={field.type || 'text'}
                value={(formData as Record<string, string>)[field.key] || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="h-8 text-sm rounded border"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                }}
                required={field.required}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center px-3 py-1.5 rounded text-sm transition-colors"
              style={{
                border: '1px solid var(--outline-gray-2)',
                color: 'var(--ink-gray-7)',
                backgroundColor: 'var(--surface-white)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-white)')}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: 'var(--surface-gray-7)',
                color: '#fff',
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
