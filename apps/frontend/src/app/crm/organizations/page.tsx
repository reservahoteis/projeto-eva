'use client'

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/use-debounce'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Trash2,
  RefreshCw,
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Organization, CrmListParams } from '@/types/crm'

// ============================================
// HELPERS
// ============================================

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return (words[0] ?? '').substring(0, 2).toUpperCase()
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase()
}

const LOGO_PALETTE = [
  { bg: '#E6F4FF', text: '#007BE0' },
  { bg: '#E4FAEB', text: '#278F5E' },
  { bg: '#FFF7D3', text: '#DB7706' },
  { bg: '#FFE7E7', text: '#E03636' },
  { bg: '#F3F0FF', text: '#6846E3' },
] as const

function getLogoPalette(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return LOGO_PALETTE[Math.abs(hash) % LOGO_PALETTE.length] ?? LOGO_PALETTE[0]
}

// ============================================
// ORG LOGO AVATAR
// ============================================

interface OrgAvatarProps {
  logoUrl?: string | null
  name: string
  id: string
  size?: 'sm' | 'md'
}

function OrgAvatar({ logoUrl, name, id, size = 'sm' }: OrgAvatarProps) {
  const palette = getLogoPalette(id)
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={cn(dim, 'rounded object-contain flex-shrink-0')}
        style={{ border: '1px solid var(--outline-gray-1)', padding: '2px' }}
      />
    )
  }
  return (
    <div
      className={cn(
        dim,
        'rounded flex items-center justify-center font-semibold flex-shrink-0',
        size === 'sm' ? 'text-[9px]' : 'text-xs'
      )}
      style={{ backgroundColor: palette.bg, color: palette.text }}
    >
      {getInitials(name)}
    </div>
  )
}

// ============================================
// SKELETON
// ============================================

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableRow key={i} className="border-b" style={{ borderColor: 'var(--outline-gray-1)' }}>
          <TableCell className="py-2.5 pl-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded flex-shrink-0" />
              <Skeleton className="h-4 w-40" />
            </div>
          </TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-32 hidden lg:block" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-24 hidden lg:block" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-20 hidden xl:block" /></TableCell>
          <TableCell className="py-2.5 pr-4"><Skeleton className="h-6 w-6 rounded ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  searching: boolean
  query: string
}

function EmptyState({ searching, query }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--surface-gray-2)' }}
      >
        <Building2 className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
        {searching ? 'Nenhuma organizacao encontrada' : 'Sem organizacoes'}
      </p>
      <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
        {searching
          ? `Nenhum resultado para "${query}"`
          : 'Adicione a primeira organizacao para comecar'}
      </p>
    </div>
  )
}

// ============================================
// MAIN PAGE
// ============================================

const PAGE_SIZE = 20

export default function OrganizationsPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState('organization_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null)

  const debouncedSearch = useDebounce(search, 350)

  // ============================================
  // QUERY
  // ============================================

  const params: CrmListParams = {
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch || undefined,
    order_by: sortField,
    order_direction: sortDir,
  }

  const listQuery = useQuery({
    queryKey: crmKeys.organizationList(params),
    queryFn: () => crmApi.organizations.list(params),
    placeholderData: keepPreviousData,
    select: (res) => res.data,
  })

  const orgs = listQuery.data?.data ?? []
  const totalCount = listQuery.data?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // ============================================
  // MUTATIONS
  // ============================================

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.organizations.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.organizations() })
      setDeletingOrg(null)
      toast.success('Organizacao removida.')
    },
    onError: () => toast.error('Erro ao remover organizacao.'),
  })

  // ============================================
  // HANDLERS
  // ============================================

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDir('asc')
      }
      setPage(1)
    },
    [sortField]
  )

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <span className="opacity-30 ml-1">↕</span>
    return (
      <span className="ml-1" style={{ color: 'var(--ink-blue-3)' }}>
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full">
      {/* ---- Page Header ---- */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Organizacoes
          </h1>
          {!listQuery.isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {totalCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => queryClient.invalidateQueries({ queryKey: crmKeys.organizations() })}
            disabled={listQuery.isFetching}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', listQuery.isFetching && 'animate-spin')}
              style={{ color: 'var(--ink-gray-5)' }}
            />
          </Button>

          <Button
            size="sm"
            style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
            className="h-7 text-xs hover:opacity-90 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Organizacao
          </Button>
        </div>
      </div>

      {/* ---- View Controls Bar ---- */}
      <div
        className="flex items-center gap-3 px-5 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        <div className="relative max-w-xs w-full">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <Input
            type="search"
            placeholder="Buscar organizacoes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-7 text-xs border rounded"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow
              className="border-b"
              style={{
                borderColor: 'var(--outline-gray-1)',
                backgroundColor: 'var(--surface-gray-1)',
              }}
            >
              {/* organization_name */}
              <TableHead
                className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
                onClick={() => handleSort('organization_name')}
              >
                Organizacao <SortIcon field="organization_name" />
              </TableHead>

              {/* website */}
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Website
              </TableHead>

              {/* industry */}
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Setor
              </TableHead>

              {/* modified */}
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hidden xl:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
                onClick={() => handleSort('updated_at')}
              >
                Modificado <SortIcon field="updated_at" />
              </TableHead>

              <TableHead className="py-2 pr-4 w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {listQuery.isLoading ? (
              <TableSkeleton />
            ) : listQuery.isError ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center">
                  <p className="text-sm mb-2" style={{ color: 'var(--ink-gray-5)' }}>
                    Erro ao carregar organizacoes.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() =>
                      queryClient.invalidateQueries({ queryKey: crmKeys.organizations() })
                    }
                    style={{ color: 'var(--ink-blue-3)' }}
                  >
                    Tentar novamente
                  </Button>
                </TableCell>
              </TableRow>
            ) : orgs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState searching={!!debouncedSearch} query={debouncedSearch} />
                </TableCell>
              </TableRow>
            ) : (
              orgs.map((org) => (
                <TableRow
                  key={org.id}
                  className="border-b cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--outline-gray-1)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = ''
                  }}
                >
                  {/* organization_name — logo avatar + label */}
                  <TableCell className="py-2.5 pl-4">
                    <div className="flex items-center gap-2">
                      <OrgAvatar
                        logoUrl={org.logo_url}
                        name={org.organization_name}
                        id={org.id}
                        size="sm"
                      />
                      <span
                        className="text-sm font-medium truncate max-w-[200px]"
                        style={{ color: 'var(--ink-gray-8)' }}
                      >
                        {org.organization_name}
                      </span>
                    </div>
                  </TableCell>

                  {/* website */}
                  <TableCell className="py-2.5 hidden lg:table-cell">
                    {org.website ? (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm hover:underline"
                        style={{ color: 'var(--ink-blue-3)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">
                          {org.website.replace(/^https?:\/\//, '')}
                        </span>
                      </a>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--ink-gray-4)' }}>
                        —
                      </span>
                    )}
                  </TableCell>

                  {/* industry */}
                  <TableCell className="py-2.5 hidden lg:table-cell">
                    {org.industry ? (
                      <span
                        className="inline-flex items-center text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'var(--surface-gray-2)',
                          color: 'var(--ink-gray-6)',
                        }}
                      >
                        {org.industry.name}
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--ink-gray-4)' }}>
                        —
                      </span>
                    )}
                  </TableCell>

                  {/* modified */}
                  <TableCell className="py-2.5 hidden xl:table-cell">
                    <span
                      className="text-sm"
                      style={{ color: 'var(--ink-gray-5)' }}
                      title={format(new Date(org.updated_at), "dd/MM/yyyy 'as' HH:mm", {
                        locale: ptBR,
                      })}
                    >
                      {formatDistanceToNow(new Date(org.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </TableCell>

                  {/* actions */}
                  <TableCell className="py-2.5 pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Acoes"
                        >
                          <MoreHorizontal
                            className="h-4 w-4"
                            style={{ color: 'var(--ink-gray-5)' }}
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-40 rounded-lg border shadow-md"
                        style={{
                          backgroundColor: 'var(--surface-white)',
                          borderColor: 'var(--outline-gray-2)',
                        }}
                      >
                        <DropdownMenuSeparator
                          style={{ backgroundColor: 'var(--outline-gray-1)' }}
                        />
                        <DropdownMenuItem
                          className="text-sm cursor-pointer"
                          style={{ color: 'var(--ink-red-3)' }}
                          onClick={() => setDeletingOrg(org)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Pagina anterior"
            >
              <ChevronLeft className="h-4 w-4" style={{ color: 'var(--ink-gray-6)' }} />
            </Button>
            <span className="text-xs px-2" style={{ color: 'var(--ink-gray-6)' }}>
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Proxima pagina"
            >
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--ink-gray-6)' }} />
            </Button>
          </div>
        </div>
      )}

      {/* ---- Delete Confirm ---- */}
      <AlertDialog open={!!deletingOrg} onOpenChange={(open) => !open && setDeletingOrg(null)}>
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
              Remover organizacao
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja remover{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>
                {deletingOrg?.organization_name}
              </strong>
              ? Esta acao nao pode ser desfeita.
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
              onClick={() => deletingOrg && deleteMutation.mutate(deletingOrg.id)}
              disabled={deleteMutation.isPending}
              className="text-sm h-8 px-3 rounded text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--ink-red-3)' }}
            >
              {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
