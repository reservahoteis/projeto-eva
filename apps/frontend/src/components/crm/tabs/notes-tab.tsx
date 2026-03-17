'use client'

// Shared Notes tab — parametrized by doctype/docname.
// Used in Lead, Deal, Contact, Organization detail pages.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Plus, FileText, Check, RefreshCw, Trash2 } from 'lucide-react'
import type { Note, CrmDoctype, CreateNoteData } from '@/types/crm'

interface NotesTabProps {
  doctype: CrmDoctype
  docname: string
}

export function NotesTab({ doctype, docname }: NotesTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['crm-notes', doctype, docname],
    queryFn: () =>
      crmApi.notes.list({
        filters: { reference_doctype: doctype, reference_docname: docname },
      }),
    select: (res) => res.data.data,
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateNoteData) => crmApi.notes.create(d),
    onSuccess: () => {
      toast.success('Nota criada')
      setTitle('')
      setContent('')
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['crm-notes', doctype, docname] })
    },
    onError: () => toast.error('Erro ao criar nota'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.notes.delete(id),
    onSuccess: () => {
      toast.success('Nota excluida')
      queryClient.invalidateQueries({ queryKey: ['crm-notes', doctype, docname] })
    },
    onError: () => toast.error('Erro ao excluir nota'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink-gray-5)' }}>
          Notas {data && `(${data.length})`}
        </h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            backgroundColor: 'var(--surface-gray-7)',
            color: '#fff',
            borderRadius: '8px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar nota
        </button>
      </div>

      {showForm && (
        <div
          style={{
            borderRadius: '8px',
            backgroundColor: 'var(--surface-gray-1)',
            border: '1px solid var(--outline-gray-1)',
            padding: '16px',
          }}
          className="space-y-3"
        >
          <Input
            placeholder="Titulo da nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm"
            style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}
          />
          <Textarea
            placeholder="Conteudo da nota..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="text-sm min-h-[100px] resize-none"
            style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              style={{
                border: '1px solid var(--outline-gray-2)',
                color: 'var(--ink-gray-8)',
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '12px',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancelar
            </button>
            <button
              onClick={() =>
                createMutation.mutate({
                  title: title || 'Nota',
                  content,
                  reference_doctype: doctype,
                  reference_docname: docname,
                })
              }
              disabled={!content.trim() || createMutation.isPending}
              style={{
                backgroundColor: 'var(--surface-gray-7)',
                color: '#fff',
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                border: 'none',
                opacity: !content.trim() || createMutation.isPending ? 0.5 : 1,
              }}
            >
              {createMutation.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Salvar
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <FileText className="w-8 h-8" style={{ color: 'var(--ink-gray-4)' }} />
          <p style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>Nenhuma nota ainda</p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Excluir nota</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja excluir esta nota? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              style={{ border: '1px solid var(--outline-gray-2)', color: 'var(--ink-gray-8)', backgroundColor: 'transparent', borderRadius: '8px' }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget)
                setDeleteTarget(null)
              }}
              disabled={deleteMutation.isPending}
              style={{ backgroundColor: 'var(--surface-red-2)', color: 'var(--ink-red-3)', borderRadius: '8px', border: 'none' }}
            >
              {deleteMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {data?.map((note: Note) => (
        <div
          key={note.id}
          className="group"
          style={{
            borderRadius: '8px',
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            padding: '16px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-1)')}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink-gray-9)' }}>{note.title}</h4>
            <button
              onClick={() => setDeleteTarget(note.id)}
              disabled={deleteMutation.isPending}
              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
              style={{ color: 'var(--ink-gray-5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-red-3)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-5)')}
              aria-label="Excluir nota"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <p
            className="whitespace-pre-wrap leading-relaxed mt-1"
            style={{ fontSize: '13px', color: 'var(--ink-gray-8)' }}
          >
            {note.content}
          </p>
          {note.created_by && (
            <p className="mt-2" style={{ fontSize: '11px', color: 'var(--ink-gray-5)' }}>
              {note.created_by.name} &middot;{' '}
              {format(new Date(note.created_at), "dd/MM/yyyy 'as' HH:mm", {
                locale: ptBR,
              })}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
