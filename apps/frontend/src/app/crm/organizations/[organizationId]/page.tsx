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
  Globe,
  MapPin,
  Users,
  Handshake,
  DollarSign,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Organization, DealListItem, CrmContact, UpdateOrganizationData } from '@/types/crm'

const formatCurrency = (value: number | null, currency = 'BRL') =>
  value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value) : '-'

// Espresso avatar palette — deterministic color per org id
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

export default function OrganizationDetailPage() {
  const { organizationId } = useParams<{ organizationId: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'deals' | 'contacts' | 'notes'>('deals')

  const { data: org, isLoading, error } = useQuery({
    queryKey: crmKeys.organizationDetail(organizationId),
    queryFn: () => crmApi.organizations.get(organizationId),
    select: (res) => res.data,
    enabled: !!organizationId,
  })

  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: [...crmKeys.organizationDetail(organizationId), 'deals'],
    queryFn: () => crmApi.organizations.deals(organizationId),
    select: (res) => res.data,
    enabled: !!organizationId && activeTab === 'deals',
  })

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: [...crmKeys.organizationDetail(organizationId), 'contacts'],
    queryFn: () => crmApi.organizations.contacts(organizationId),
    select: (res) => res.data,
    enabled: !!organizationId && activeTab === 'contacts',
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrganizationData) => crmApi.organizations.update(organizationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.organizationDetail(organizationId) })
      toast.success('Organizacao atualizada')
      setEditDialogOpen(false)
    },
    onError: () => toast.error('Erro ao atualizar'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => crmApi.organizations.delete(organizationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.organizations() })
      toast.success('Organizacao removida')
      router.push('/crm/organizations')
    },
    onError: () => toast.error('Erro ao remover'),
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" style={{ backgroundColor: 'var(--surface-white)' }}>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Skeleton className="h-64 w-full" /></div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (error || !org) {
    return (
      <EmptyState
        title="Organizacao nao encontrada"
        actionLabel="Voltar"
        onAction={() => router.push('/crm/organizations')}
      />
    )
  }

  const tabs = [
    { id: 'deals' as const, label: 'Negociacoes', icon: Handshake },
    { id: 'contacts' as const, label: 'Contatos', icon: Users },
    { id: 'notes' as const, label: 'Notas', icon: FileText },
  ]

  const infoFields = [
    { label: 'Website', value: org.website, icon: Globe },
    { label: 'Email', value: org.email, icon: Mail },
    { label: 'Telefone', value: org.phone, icon: Phone },
    { label: 'Funcionarios', value: org.no_of_employees?.toString(), icon: Users },
    { label: 'Receita Anual', value: formatCurrency(org.annual_revenue, org.currency), icon: DollarSign },
    { label: 'Industria', value: org.industry?.name, icon: Building2 },
    { label: 'Territorio', value: org.territory?.name, icon: MapPin },
    { label: 'Endereco', value: org.address, icon: MapPin },
  ]

  const avatarPalette = getAvatarPalette(org.id ?? org.organization_name ?? 'o')

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
              onClick={() => router.push('/crm/organizations')}
              className="flex items-center justify-center w-7 h-7 rounded transition-colors"
              style={{ color: 'var(--ink-gray-5)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              aria-label="Voltar para organizacoes"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              {/* Logo or initials avatar */}
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.organization_name}
                  className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                  style={{ border: '1px solid var(--outline-gray-1)' }}
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0"
                  style={{ backgroundColor: avatarPalette.bg, color: avatarPalette.text }}
                >
                  {org.organization_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1
                  className="font-semibold leading-tight"
                  style={{ fontSize: '15px', color: 'var(--ink-gray-9)' }}
                >
                  {org.organization_name}
                </h1>
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline"
                    style={{ color: 'var(--ink-blue-3)', marginTop: '1px', display: 'block' }}
                  >
                    {org.website}
                  </a>
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
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
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
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors"
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

            {/* Deals tab */}
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
                    title="Nenhuma negociacao"
                    description="Esta organizacao nao tem negociacoes."
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
                            {deal.naming_series}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <StatusBadge label={deal.status.label} color={deal.status.color} />
                          </TableCell>
                          <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                            {formatCurrency(deal.deal_value, deal.currency)}
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

            {/* Contacts tab */}
            {activeTab === 'contacts' && (
              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                }}
              >
                {contactsLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : !contactsData?.data?.length ? (
                  <EmptyState
                    icon={Users}
                    title="Nenhum contato"
                    description="Esta organizacao nao tem contatos vinculados."
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
                          Nome
                        </TableHead>
                        <TableHead
                          className="py-2 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-gray-5)' }}
                        >
                          Email
                        </TableHead>
                        <TableHead
                          className="py-2 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-gray-5)' }}
                        >
                          Telefone
                        </TableHead>
                        <TableHead
                          className="py-2 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: 'var(--ink-gray-5)' }}
                        >
                          Cargo
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contactsData.data.map((contact: CrmContact) => (
                        <TableRow
                          key={contact.id}
                          className="border-b cursor-pointer transition-colors"
                          style={{ borderColor: 'var(--outline-gray-1)' }}
                          onClick={() => router.push(`/crm/contacts/${contact.id}`)}
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
                            {contact.full_name}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                            {contact.email || (
                              <span style={{ color: 'var(--ink-gray-4)' }}>-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                            {contact.mobile_no || contact.phone || (
                              <span style={{ color: 'var(--ink-gray-4)' }}>-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                            {contact.designation || (
                              <span style={{ color: 'var(--ink-gray-4)' }}>-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {/* Notes tab */}
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
                  description="Adicione notas sobre esta organizacao."
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
              <div className="px-4 py-3">
                {infoFields.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="py-2.5 flex flex-col gap-0.5 border-b last:border-0"
                    style={{ borderColor: 'var(--outline-gray-1)' }}
                  >
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
                      className="truncate"
                      style={{
                        fontSize: '14px',
                        color: value && value !== '-' ? 'var(--ink-gray-8)' : 'var(--ink-gray-4)',
                      }}
                    >
                      {value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats card */}
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
                  Resumo
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-3 text-center"
                  style={{
                    backgroundColor: 'var(--surface-white)',
                    border: '1px solid var(--outline-gray-1)',
                  }}
                >
                  <p
                    className="font-bold"
                    style={{ fontSize: '22px', color: 'var(--ink-gray-9)' }}
                  >
                    {dealsData?.total_count ?? '—'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)', marginTop: '2px' }}>
                    Negociacoes
                  </p>
                </div>
                <div
                  className="rounded-lg p-3 text-center"
                  style={{
                    backgroundColor: 'var(--surface-white)',
                    border: '1px solid var(--outline-gray-1)',
                  }}
                >
                  <p
                    className="font-bold"
                    style={{ fontSize: '22px', color: 'var(--ink-gray-9)' }}
                  >
                    {contactsData?.total_count ?? '—'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)', marginTop: '2px' }}>
                    Contatos
                  </p>
                </div>
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
                    {formatDistanceToNow(new Date(org.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>Atualizado</span>
                  <span style={{ fontSize: '13px', color: 'var(--ink-gray-8)' }}>
                    {formatDistanceToNow(new Date(org.updated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditOrgDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        org={org}
        onSave={(data) => updateMutation.mutate(data)}
        saving={updateMutation.isPending}
      />

      {/* Delete */}
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
              Excluir organizacao?
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-sm"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Esta acao nao pode ser desfeita.{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>&quot;{org.organization_name}&quot;</strong>{' '}
              sera removida.
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
            Editar Organizacao
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
