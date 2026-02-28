'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/use-debounce'
import { crmApi } from '@/services/crm/api'
import { crmKeys } from '@/hooks/crm/use-crm-queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  StickyNote,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Note, CrmDoctype, CreateNoteData, UpdateNoteData } from '@/types/crm'

// ============================================
// CONSTANTS
// ============================================

const REFERENCE_DOCTYPES: Array<{ value: CrmDoctype; label: string }> = [
  { value: 'Lead', label: 'Lead' },
  { value: 'Deal', label: 'Negocio' },
  { value: 'Contact', label: 'Contato' },
  { value: 'Organization', label: 'Organizacao' },
]

// ============================================
// HELPERS
// ============================================

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0] ?? '').substring(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

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

// ============================================
// CARD SKELETON
// ============================================

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 px-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-56 rounded-lg border p-5 flex flex-col"
          style={{ borderColor: 'var(--outline-gray-1)' }}
        >
          <Skeleton className="h-5 w-3/4 mb-3" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="flex items-center gap-2 pt-3 border-t mt-3" style={{ borderColor: 'var(--outline-gray-1)' }}>
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// NOTE CARD
// ============================================

interface NoteCardProps {
  note: Note
  onDelete: (note: Note) => void
  onEdit: (note: Note) => void
}

function NoteCard({ note, onDelete, onEdit }: NoteCardProps) {
  const preview = stripHtml(note.content)
  const palette = note.created_by ? getAvatarPalette(note.created_by.id) : AVATAR_PALETTE[0]

  return (
    <div
      className={cn(
        'h-56 rounded-lg border shadow-sm px-5 py-4 flex flex-col cursor-pointer',
        'transition-colors'
      )}
      style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-white)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface-menu-bar)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface-white)'
      }}
      onClick={() => onEdit(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onEdit(note)}
      aria-label={`Nota: ${note.title}`}
    >
      {/* Header: title + dropdown */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <p
          className="text-lg font-medium line-clamp-1 flex-1"
          style={{ color: 'var(--ink-gray-9)' }}
        >
          {note.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
              }}
              aria-label="Opcoes da nota"
            >
              <MoreHorizontal className="h-4 w-4" style={{ color: 'var(--ink-gray-5)' }} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-36 rounded-lg border shadow-md"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
            }}
          >
            <DropdownMenuItem
              className="text-sm cursor-pointer"
              style={{ color: 'var(--ink-red-3)' }}
              onClick={(e) => {
                e.stopPropagation()
                onDelete(note)
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body: content preview */}
      <p
        className="flex-1 text-sm line-clamp-4 leading-relaxed overflow-hidden"
        style={{ color: 'var(--ink-gray-5)' }}
      >
        {preview || <span className="italic" style={{ color: 'var(--ink-gray-4)' }}>Sem conteudo</span>}
      </p>

      {/* Footer: user avatar + name + timeAgo */}
      <div
        className="flex items-center gap-2 pt-3 border-t mt-3 flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        {note.created_by ? (
          <>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-semibold text-[10px] flex-shrink-0"
              style={{ backgroundColor: palette.bg, color: palette.text }}
            >
              {getInitials(note.created_by.name)}
            </div>
            <span
              className="text-xs truncate flex-1"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              {note.created_by.name}
            </span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <span
          className="text-xs whitespace-nowrap flex-shrink-0"
          style={{ color: 'var(--ink-gray-4)' }}
          title={format(new Date(note.updated_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
        >
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ptBR })}
        </span>
      </div>
    </div>
  )
}

// ============================================
// NOTE FORM
// ============================================

interface NoteFormProps {
  initialData?: Partial<Note>
  onSubmit: (data: CreateNoteData | UpdateNoteData) => void
  onCancel: () => void
  isLoading: boolean
  submitLabel: string
}

function NoteForm({ initialData, onSubmit, onCancel, isLoading, submitLabel }: NoteFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [content, setContent] = useState(initialData?.content ?? '')
  const [refDoctype, setRefDoctype] = useState<CrmDoctype | ''>(
    initialData?.reference_doctype ?? ''
  )
  const [refDocname, setRefDocname] = useState(initialData?.reference_docname ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('O titulo e obrigatorio.')
      return
    }
    if (!content.trim()) {
      toast.error('O conteudo e obrigatorio.')
      return
    }
    onSubmit({
      title: title.trim(),
      content: content.trim(),
      reference_doctype: refDoctype || undefined,
      reference_docname: refDocname || undefined,
    })
  }

  const inputStyle = {
    borderColor: 'var(--outline-gray-2)',
    backgroundColor: 'var(--surface-white)',
    color: 'var(--ink-gray-8)',
  }

  const labelStyle = { color: 'var(--ink-gray-6)' }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>
          Titulo *
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titulo da nota"
          className="h-8 text-sm rounded border"
          style={inputStyle}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>
          Conteudo *
        </Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva o conteudo da nota..."
          className="text-sm rounded border resize-none min-h-[120px]"
          style={inputStyle}
          rows={5}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={labelStyle}>
            Tipo de referencia
          </Label>
          <Select
            value={refDoctype}
            onValueChange={(v) => setRefDoctype(v as CrmDoctype | '')}
          >
            <SelectTrigger
              className="h-8 text-sm rounded border"
              style={inputStyle}
            >
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent
              className="rounded-lg border shadow-md"
              style={{
                backgroundColor: 'var(--surface-white)',
                borderColor: 'var(--outline-gray-2)',
              }}
            >
              <SelectItem value="">Nenhum</SelectItem>
              {REFERENCE_DOCTYPES.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={labelStyle}>
            Nome da referencia
          </Label>
          <Input
            value={refDocname}
            onChange={(e) => setRefDocname(e.target.value)}
            placeholder="ex: LEAD-0001"
            className="h-8 text-sm rounded border"
            style={inputStyle}
            disabled={!refDoctype}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
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
          disabled={isLoading}
          className="h-8 px-3 text-sm rounded text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--surface-gray-7)' }}
        >
          {isLoading ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

// ============================================
// MAIN PAGE
// ============================================

export default function NotesPage() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filterDoctype, setFilterDoctype] = useState<CrmDoctype | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [deletingNote, setDeletingNote] = useState<Note | null>(null)

  const debouncedSearch = useDebounce(search, 350)

  // ============================================
  // QUERY
  // ============================================

  const notesQuery = useQuery({
    queryKey: crmKeys.noteList({
      search: debouncedSearch || undefined,
      filters: filterDoctype ? { reference_doctype: filterDoctype } : undefined,
    }),
    queryFn: () =>
      crmApi.notes.list({
        page: 1,
        page_size: 100,
        search: debouncedSearch || undefined,
        filters: filterDoctype ? { reference_doctype: filterDoctype } : undefined,
        order_by: 'updated_at',
        order_direction: 'desc',
      }),
    placeholderData: keepPreviousData,
    select: (res) => res.data,
  })

  const notes = notesQuery.data?.data ?? []
  const total = notesQuery.data?.total_count ?? 0

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: (data: CreateNoteData) => crmApi.notes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.notes() })
      setIsCreateOpen(false)
      toast.success('Nota criada.')
    },
    onError: () => toast.error('Erro ao criar nota.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteData }) =>
      crmApi.notes.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.notes() })
      setEditingNote(null)
      toast.success('Nota atualizada.')
    },
    onError: () => toast.error('Erro ao atualizar nota.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.notes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.notes() })
      setDeletingNote(null)
      toast.success('Nota removida.')
    },
    onError: () => toast.error('Erro ao remover nota.'),
  })

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
            Notas
          </h1>
          {!notesQuery.isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => queryClient.invalidateQueries({ queryKey: crmKeys.notes() })}
            disabled={notesQuery.isFetching}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', notesQuery.isFetching && 'animate-spin')}
              style={{ color: 'var(--ink-gray-5)' }}
            />
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
            className="h-7 text-xs hover:opacity-90 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Nota
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
            placeholder="Buscar notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs border rounded"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          />
        </div>

        {/* Filter by doctype */}
        <Select
          value={filterDoctype ?? ''}
          onValueChange={(v) => setFilterDoctype(v ? (v as CrmDoctype) : null)}
        >
          <SelectTrigger
            className="h-7 text-xs border rounded w-36"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-7)',
            }}
          >
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent
            className="rounded-lg border shadow-md"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
            }}
          >
            <SelectItem value="">Todos os tipos</SelectItem>
            {REFERENCE_DOCTYPES.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterDoctype || search) && (
          <button
            onClick={() => {
              setFilterDoctype(null)
              setSearch('')
            }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border"
            style={{
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-5)',
              backgroundColor: 'var(--surface-white)',
            }}
            aria-label="Limpar filtros"
          >
            <X className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      {/* ---- Notes Grid ---- */}
      <div className="flex-1 overflow-auto py-5">
        {notesQuery.isLoading ? (
          <CardSkeleton />
        ) : notesQuery.isError ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm mb-3" style={{ color: 'var(--ink-gray-5)' }}>
              Erro ao carregar notas.
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: crmKeys.notes() })}
              style={{ color: 'var(--ink-blue-3)' }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--surface-gray-2)' }}
            >
              <StickyNote className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
              {debouncedSearch || filterDoctype ? 'Nenhuma nota encontrada' : 'Sem notas'}
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--ink-gray-5)' }}>
              {debouncedSearch || filterDoctype
                ? 'Tente ajustar os filtros'
                : 'Crie a primeira nota para registrar informacoes importantes'}
            </p>
            {!debouncedSearch && !filterDoctype && (
              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
                className="hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nova Nota
              </Button>
            )}
          </div>
        ) : (
          // Notes.vue uses a CARD GRID: grid-cols-1 sm:grid-cols-4, gap-4, px-5
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 px-5">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={setEditingNote}
                onDelete={setDeletingNote}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- Create Dialog ---- */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          className="max-w-lg rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
              Nova Nota
            </DialogTitle>
          </DialogHeader>
          <NoteForm
            onSubmit={(data) => createMutation.mutate(data as CreateNoteData)}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isPending}
            submitLabel="Criar Nota"
          />
        </DialogContent>
      </Dialog>

      {/* ---- Edit Dialog ---- */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent
          className="max-w-lg rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
              Editar Nota
            </DialogTitle>
          </DialogHeader>
          {editingNote && (
            <NoteForm
              initialData={editingNote}
              onSubmit={(data) =>
                updateMutation.mutate({ id: editingNote.id, data: data as UpdateNoteData })
              }
              onCancel={() => setEditingNote(null)}
              isLoading={updateMutation.isPending}
              submitLabel="Salvar"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirm ---- */}
      <AlertDialog
        open={!!deletingNote}
        onOpenChange={(open) => !open && setDeletingNote(null)}
      >
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
              Excluir nota
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja excluir{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>
                &ldquo;{deletingNote?.title}&rdquo;
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
              onClick={() => deletingNote && deleteMutation.mutate(deletingNote.id)}
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
