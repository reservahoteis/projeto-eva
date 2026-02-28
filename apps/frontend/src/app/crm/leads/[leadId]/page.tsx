'use client'

// Usage: /crm/leads/[leadId]
// Full-page Lead detail view with tabbed content and info side panel.

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { getInitials } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ActivityTimeline } from '@/components/crm/activity-timeline'
import { SidePanelInfo } from '@/components/crm/side-panel-info'
import type { FieldDefinition } from '@/components/crm/side-panel-info'
import {
  ArrowLeft,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Target,
  Handshake,
  Plus,
  FileText,
  ListTodo,
  Phone,
  Mail,
  Activity,
  ChevronRight,
  AlertTriangle,
  Check,
  Clock,
  Building2,
  User,
  Globe,
} from 'lucide-react'
import type {
  Lead,
  Note,
  Task,
  CallLog,
  CrmDoctype,
  CreateNoteData,
  CreateTaskData,
  CreateCallLogData,
  TaskPriority,
  TaskStatus,
  CallLogType,
  CallLogStatus,
} from '@/types/crm'

// ============================================
// HELPERS
// ============================================

function getFullName(lead: Lead): string {
  return [lead.first_name, lead.middle_name, lead.last_name].filter(Boolean).join(' ')
}

// ============================================
// NOTES TAB
// ============================================

interface NotesTabProps {
  leadId: string
}

function NotesTab({ leadId }: NotesTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-notes', 'Lead', leadId],
    queryFn: () =>
      crmApi.notes.list({
        filters: { reference_doctype: 'Lead', reference_docname: leadId },
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
      queryClient.invalidateQueries({ queryKey: ['crm-notes', 'Lead', leadId] })
    },
    onError: () => toast.error('Erro ao criar nota'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.notes.delete(id),
    onSuccess: () => {
      toast.success('Nota excluída')
      queryClient.invalidateQueries({ queryKey: ['crm-notes', 'Lead', leadId] })
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
            placeholder="Título da nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm"
            style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}
          />
          <Textarea
            placeholder="Conteúdo da nota..."
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
                  reference_doctype: 'Lead' as CrmDoctype,
                  reference_docname: leadId,
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
              onClick={() => deleteMutation.mutate(note.id)}
              disabled={deleteMutation.isPending}
              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
              style={{ color: 'var(--ink-gray-5)' }}
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
              {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================
// TASKS TAB
// ============================================

interface TasksTabProps {
  leadId: string
}

function TasksTab({ leadId }: TasksTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium')
  const [formDueDate, setFormDueDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-tasks', 'Lead', leadId],
    queryFn: () =>
      crmApi.tasks.list({
        filters: { reference_doctype: 'Lead', reference_docname: leadId },
      }),
    select: (res) => res.data.data,
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateTaskData) => crmApi.tasks.create(d),
    onSuccess: () => {
      toast.success('Tarefa criada')
      setFormTitle('')
      setFormPriority('Medium')
      setFormDueDate('')
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['crm-tasks', 'Lead', leadId] })
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      crmApi.tasks.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks', 'Lead', leadId] })
    },
    onError: () => toast.error('Erro ao atualizar tarefa'),
  })

  const PRIORITY_BADGE: Record<TaskPriority, { bg: string; color: string; label: string }> = {
    Low: { bg: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)', label: 'Baixa' },
    Medium: { bg: 'var(--surface-amber-2)', color: 'var(--ink-amber-3)', label: 'Média' },
    High: { bg: 'var(--surface-red-2)', color: 'var(--ink-red-3)', label: 'Alta' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink-gray-5)' }}>
          Tarefas {data && `(${data.length})`}
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
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar tarefa
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
            placeholder="Título da tarefa"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="text-sm"
            style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={formPriority}
              onValueChange={(v) => setFormPriority(v as TaskPriority)}
            >
              <SelectTrigger className="text-sm" style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}>
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Baixa</SelectItem>
                <SelectItem value="Medium">Média</SelectItem>
                <SelectItem value="High">Alta</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="text-sm"
              style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}
              aria-label="Data de vencimento"
            />
          </div>
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
                  title: formTitle,
                  priority: formPriority,
                  due_date: formDueDate || undefined,
                  status: 'Todo',
                  reference_doctype: 'Lead' as CrmDoctype,
                  reference_docname: leadId,
                })
              }
              disabled={!formTitle.trim() || createMutation.isPending}
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
                opacity: !formTitle.trim() || createMutation.isPending ? 0.5 : 1,
              }}
            >
              {createMutation.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Criar tarefa
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <ListTodo className="w-8 h-8" style={{ color: 'var(--ink-gray-4)' }} />
          <p style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>Nenhuma tarefa ainda</p>
        </div>
      )}

      {data?.map((task: Task) => (
        <div
          key={task.id}
          className="flex items-center gap-3"
          style={{
            borderRadius: '8px',
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            padding: '12px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-1)')}
        >
          <button
            onClick={() =>
              updateMutation.mutate({
                id: task.id,
                status: task.status === 'Done' ? 'Todo' : 'Done',
              })
            }
            className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              backgroundColor: task.status === 'Done' ? 'var(--ink-green-3)' : 'transparent',
              borderColor: task.status === 'Done' ? 'var(--ink-green-3)' : 'var(--outline-gray-2)',
            }}
            aria-label={task.status === 'Done' ? 'Marcar como pendente' : 'Marcar como feito'}
          >
            {task.status === 'Done' && <Check className="w-3 h-3 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: task.status === 'Done' ? 'var(--ink-gray-4)' : 'var(--ink-gray-8)',
                textDecoration: task.status === 'Done' ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  backgroundColor: PRIORITY_BADGE[task.priority].bg,
                  color: PRIORITY_BADGE[task.priority].color,
                  borderRadius: '999px',
                  padding: '2px 8px',
                }}
              >
                {PRIORITY_BADGE[task.priority].label}
              </span>
              {task.due_date && (
                <>
                  <span style={{ color: 'var(--outline-gray-2)', fontSize: '11px' }}>&middot;</span>
                  <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--ink-gray-5)' }}>
                    <Clock className="w-3 h-3" />
                    {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// CALLS TAB
// ============================================

interface CallsTabProps {
  leadId: string
}

function CallsTab({ leadId }: CallsTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [callType, setCallType] = useState<CallLogType>('Outbound')
  const [callStatus, setCallStatus] = useState<CallLogStatus>('Completed')
  const [callNote, setCallNote] = useState('')
  const [callDuration, setCallDuration] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-calls', 'Lead', leadId],
    queryFn: () =>
      crmApi.callLogs.list({
        filters: { reference_doctype: 'Lead', reference_docname: leadId },
      }),
    select: (res) => res.data.data,
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateCallLogData) => crmApi.callLogs.create(d),
    onSuccess: () => {
      toast.success('Chamada registrada')
      setCallNote('')
      setCallDuration('')
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['crm-calls', 'Lead', leadId] })
    },
    onError: () => toast.error('Erro ao registrar chamada'),
  })

  const STATUS_BADGE: Record<CallLogStatus, { bg: string; color: string }> = {
    Completed: { bg: 'var(--surface-green-2)', color: 'var(--ink-green-3)' },
    'No Answer': { bg: 'var(--surface-amber-2)', color: 'var(--ink-amber-3)' },
    Busy: { bg: 'var(--surface-amber-2)', color: 'var(--ink-amber-3)' },
    Failed: { bg: 'var(--surface-red-2)', color: 'var(--ink-red-3)' },
    Voicemail: { bg: 'var(--surface-blue-2)', color: 'var(--ink-blue-3)' },
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink-gray-5)' }}>
          Chamadas {data && `(${data.length})`}
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
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Registrar chamada
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
          <div className="grid grid-cols-2 gap-3">
            <Select value={callType} onValueChange={(v) => setCallType(v as CallLogType)}>
              <SelectTrigger className="text-sm" style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Outbound">Saída</SelectItem>
                <SelectItem value="Inbound">Entrada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={callStatus} onValueChange={(v) => setCallStatus(v as CallLogStatus)}>
              <SelectTrigger className="text-sm" style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Completed">Completada</SelectItem>
                <SelectItem value="No Answer">Sem resposta</SelectItem>
                <SelectItem value="Busy">Ocupado</SelectItem>
                <SelectItem value="Failed">Falhou</SelectItem>
                <SelectItem value="Voicemail">Correio de voz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            placeholder="Duração (segundos)"
            value={callDuration}
            onChange={(e) => setCallDuration(e.target.value)}
            className="text-sm"
            style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-8)' }}
          />
          <Textarea
            placeholder="Observações da chamada..."
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            className="text-sm min-h-[80px] resize-none"
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
                  type: callType,
                  status: callStatus,
                  duration: callDuration ? Number(callDuration) : undefined,
                  note: callNote || undefined,
                  reference_doctype: 'Lead' as CrmDoctype,
                  reference_docname: leadId,
                })
              }
              disabled={createMutation.isPending}
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
                opacity: createMutation.isPending ? 0.5 : 1,
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
            <Skeleton key={i} className="h-16 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Phone className="w-8 h-8" style={{ color: 'var(--ink-gray-4)' }} />
          <p style={{ color: 'var(--ink-gray-5)', fontSize: '13px' }}>Nenhuma chamada registrada</p>
        </div>
      )}

      {data?.map((call: CallLog) => (
        <div
          key={call.id}
          style={{
            borderRadius: '8px',
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            padding: '12px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-1)')}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-gray-5)' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink-gray-8)' }}>
                {call.type === 'Outbound' ? 'Saída' : 'Entrada'}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  backgroundColor: STATUS_BADGE[call.status].bg,
                  color: STATUS_BADGE[call.status].color,
                  borderRadius: '999px',
                  padding: '2px 8px',
                }}
              >
                {call.status}
              </span>
            </div>
            {call.duration && (
              <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--ink-gray-5)' }}>
                <Clock className="w-3 h-3" />
                {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {call.note && (
            <p className="mt-2 leading-relaxed" style={{ fontSize: '13px', color: 'var(--ink-gray-8)' }}>
              {call.note}
            </p>
          )}
          <p className="mt-1" style={{ fontSize: '11px', color: 'var(--ink-gray-5)' }}>
            {format(new Date(call.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      ))}
    </div>
  )
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
          <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>Converter em Negociação</AlertDialogTitle>
          <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
            Isso converterá o lead <span style={{ fontWeight: 500, color: 'var(--ink-gray-8)' }}>{leadName}</span> em uma
            negociação. Um contato também será criado automaticamente. Esta ação não pode ser desfeita.
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
// MAIN PAGE
// ============================================

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const leadId = params.leadId as string

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameEdit, setNameEdit] = useState('')

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
      toast.success('Lead excluído')
      router.push('/crm/leads')
    },
    onError: () => toast.error('Erro ao excluir lead'),
  })

  // Convert mutation
  const convertMutation = useMutation({
    mutationFn: () => crmApi.leads.convert(leadId),
    onSuccess: (res) => {
      toast.success('Lead convertido em negociação!')
      router.push(`/crm/deals/${res.data.deal_id}`)
    },
    onError: () => toast.error('Erro ao converter lead'),
  })

  // Inline name save
  const handleNameSave = () => {
    if (!nameEdit.trim()) return
    const parts = nameEdit.trim().split(/\s+/)
    const first = parts[0] ?? ''
    const last = parts.length > 1 ? parts.slice(1).join(' ') : undefined
    updateMutation.mutate({ first_name: first, last_name: last })
    setIsEditingName(false)
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
    { key: 'organization_name', label: 'Organização', type: 'text', editable: true, group: 'Organização', icon: Building2 },
    { key: 'website', label: 'Website', type: 'url', editable: true, group: 'Organização', icon: Globe },
    { key: 'no_of_employees', label: 'Nº de funcionários', type: 'number', editable: true, group: 'Organização' },
    { key: 'annual_revenue', label: 'Receita anual', type: 'currency', editable: true, group: 'Organização' },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      editable: true,
      options: statusOptions ?? [],
      group: 'Pipeline',
    },
    { key: 'lead_owner', label: 'Responsável', type: 'user', editable: false, group: 'Pipeline' },
    { key: 'sla_status', label: 'SLA', type: 'text', editable: false, group: 'SLA' },
  ]

  // Build side panel data object with flat values
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
        <p style={{ color: 'var(--ink-gray-8)', fontWeight: 500 }}>Não foi possível carregar o lead</p>
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-blue-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
      <header
        className="flex-shrink-0 px-4 lg:px-6 py-3"
        style={{ borderBottom: '1px solid var(--outline-gray-1)', backgroundColor: 'var(--surface-white)' }}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 mb-2" aria-label="Breadcrumb">
          <button
            onClick={() => router.push('/crm/leads')}
            style={{ fontSize: '12px', color: 'var(--ink-gray-5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-8)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-5)')}
          >
            Leads
          </button>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-4)' }} />
          <span
            className="truncate max-w-[200px]"
            style={{ fontSize: '12px', color: 'var(--ink-gray-8)' }}
          >
            {fullName}
          </span>
        </nav>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
            style={{ color: 'var(--ink-gray-5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Lead icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--surface-blue-2)', border: '1px solid #CCE7FF' }}
          >
            <Target className="w-5 h-5" style={{ color: 'var(--ink-blue-3)' }} />
          </div>

          {/* Lead name (inline editable) */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameEdit}
                  onChange={(e) => setNameEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave()
                    if (e.key === 'Escape') setIsEditingName(false)
                  }}
                  autoFocus
                  className="h-8 w-64 text-base font-semibold"
                  style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-9)' }}
                  aria-label="Nome do lead"
                />
                <button
                  onClick={handleNameSave}
                  className="h-8 flex items-center justify-center px-3 rounded-lg"
                  style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="h-8 flex items-center justify-center px-2 rounded-lg"
                  style={{ color: 'var(--ink-gray-5)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="leading-tight cursor-pointer"
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--ink-gray-9)',
                  }}
                  onClick={() => {
                    setNameEdit(fullName)
                    setIsEditingName(true)
                  }}
                  title="Clique para editar"
                >
                  {fullName}
                </h1>
                {/* Naming series */}
                <span className="hidden sm:inline" style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                  {lead.naming_series}
                </span>
                {/* Status badge */}
                <span
                  className="inline-flex items-center flex-shrink-0"
                  style={{
                    backgroundColor: statusColor + '22',
                    color: statusColor,
                    border: `1px solid ${statusColor}44`,
                    borderRadius: '999px',
                    padding: '2px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  aria-label={`Status: ${lead.status?.label}`}
                >
                  {lead.status?.label ?? 'Sem status'}
                </span>
                {/* Converted badge */}
                {lead.converted && (
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
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Convert to Deal */}
            {!lead.converted && (
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
            )}

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ color: 'var(--ink-gray-5)', background: 'transparent', border: '1px solid var(--outline-gray-2)', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  aria-label="Mais ações"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setNameEdit(fullName)
                    setIsEditingName(true)
                  }}
                  className="cursor-pointer"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar nome
                </DropdownMenuItem>
                {!lead.converted && (
                  <DropdownMenuItem
                    onClick={() => setShowConvertDialog(true)}
                    className="cursor-pointer sm:hidden"
                  >
                    <Handshake className="mr-2 h-4 w-4" />
                    Converter em Deal
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="cursor-pointer"
                  style={{ color: 'var(--ink-red-3)' }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ---- BODY ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 min-w-0" style={{ backgroundColor: 'var(--surface-white)' }}>
          {/* Tab nav — Frappe Espresso flat tabs */}
          <Tabs defaultValue="activity" className="h-full">
            <TabsList
              className="flex-wrap h-auto gap-0 p-0 mb-6 rounded-none"
              style={{
                backgroundColor: 'transparent',
                borderBottom: '1px solid var(--outline-gray-1)',
              }}
            >
              {[
                { value: 'activity', icon: Activity, label: 'Atividade' },
                { value: 'notes', icon: FileText, label: 'Notas' },
                { value: 'tasks', icon: ListTodo, label: 'Tarefas' },
                { value: 'calls', icon: Phone, label: 'Chamadas' },
                { value: 'emails', icon: Mail, label: 'Emails' },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="relative rounded-none px-3 py-2 data-[state=active]:shadow-none data-[state=active]:bg-transparent"
                  style={{
                    fontSize: '13px',
                    fontWeight: 420,
                    color: 'var(--ink-gray-5)',
                    borderBottom: '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                  data-active-style="color: var(--ink-gray-9); border-bottom-color: var(--ink-gray-9);"
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="activity" className="mt-0">
              <ActivityTimeline doctype="Lead" docname={leadId} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <NotesTab leadId={leadId} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0">
              <TasksTab leadId={leadId} />
            </TabsContent>

            <TabsContent value="calls" className="mt-0">
              <CallsTab leadId={leadId} />
            </TabsContent>

            <TabsContent value="emails" className="mt-0">
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Mail className="w-10 h-10" style={{ color: 'var(--ink-gray-4)' }} />
                <p style={{ color: 'var(--ink-gray-8)', fontSize: '13px', fontWeight: 500 }}>Emails em breve</p>
                <p style={{ color: 'var(--ink-gray-5)', fontSize: '12px' }}>Integração de emails será adicionada em uma versão futura</p>
              </div>
            </TabsContent>
          </Tabs>
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
              Todas as atividades, notas e tarefas associadas também serão removidas.
              Esta ação não pode ser desfeita.
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
