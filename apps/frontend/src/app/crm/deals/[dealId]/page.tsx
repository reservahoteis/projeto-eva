'use client'

// Usage: /crm/deals/[dealId]
// Full-page Deal detail view with tabbed content, deal value header, and info side panel.
// Includes Mark Won (with confetti animation) and Mark Lost (with reason dialog) actions.

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { ActivityTimeline } from '@/components/crm/activity-timeline'
import { SidePanelInfo } from '@/components/crm/side-panel-info'
import type { FieldDefinition } from '@/components/crm/side-panel-info'
import {
  ArrowLeft,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Handshake,
  Plus,
  FileText,
  ListTodo,
  Phone,
  Mail,
  Activity,
  ChevronRight,
  Trophy,
  XCircle,
  DollarSign,
  TrendingUp,
  Check,
  X,
  Clock,
  AlertTriangle,
  Building2,
  User,
  Package,
  CalendarDays,
} from 'lucide-react'
import type {
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
  LostReason,
  MarkDealLostData,
} from '@/types/crm'

// ============================================
// CONFETTI ANIMATION (Won celebration)
// ============================================

function ConfettiPiece({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="fixed pointer-events-none rounded-sm z-[9999]"
      style={{
        width: '8px',
        height: '12px',
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

function useConfetti(active: boolean) {
  const [pieces, setPieces] = useState<React.CSSProperties[]>([])

  useEffect(() => {
    if (!active) return

    const colors = [
      '#4f46e5', '#7c3aed', '#2563eb', '#059669',
      '#d97706', '#dc2626', '#0891b2', '#c026d3',
    ]

    const generated = Array.from({ length: 60 }).map(() => ({
      left: `${Math.random() * 100}vw`,
      top: '-20px',
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      transform: `rotate(${Math.random() * 360}deg)`,
      animation: `confettiFall ${1.5 + Math.random() * 2}s ease-in forwards`,
      animationDelay: `${Math.random() * 0.8}s`,
    }))

    setPieces(generated)
    const timer = setTimeout(() => setPieces([]), 4000)
    return () => clearTimeout(timer)
  }, [active])

  return pieces
}

// ============================================
// NOTES TAB (shared logic, same as lead but for Deal)
// ============================================

interface NotesTabProps {
  dealId: string
}

function NotesTab({ dealId }: NotesTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-notes', 'Deal', dealId],
    queryFn: () =>
      crmApi.notes.list({
        filters: { reference_doctype: 'Deal', reference_docname: dealId },
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
      queryClient.invalidateQueries({ queryKey: ['crm-notes', 'Deal', dealId] })
    },
    onError: () => toast.error('Erro ao criar nota'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.notes.delete(id),
    onSuccess: () => {
      toast.success('Nota excluída')
      queryClient.invalidateQueries({ queryKey: ['crm-notes', 'Deal', dealId] })
    },
    onError: () => toast.error('Erro ao excluir nota'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-medium"
          style={{ color: 'var(--ink-gray-7)' }}
        >
          Notas {data && `(${data.length})`}
        </h3>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs text-white"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Adicionar nota
        </Button>
      </div>

      {showForm && (
        <div
          className="rounded-xl p-4 space-y-3 animate-slideUp"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
          }}
        >
          <Input
            placeholder="Título da nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          />
          <Textarea
            placeholder="Conteúdo da nota..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="text-sm min-h-[100px] resize-none"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="h-8 text-xs"
              style={{ color: 'var(--ink-gray-5)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
                e.currentTarget.style.color = 'var(--ink-gray-9)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ''
                e.currentTarget.style.color = 'var(--ink-gray-5)'
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() =>
                createMutation.mutate({
                  title: title || 'Nota',
                  content,
                  reference_doctype: 'Deal' as CrmDoctype,
                  reference_docname: dealId,
                })
              }
              disabled={!content.trim() || createMutation.isPending}
              className="h-8 text-xs text-white"
              style={{ backgroundColor: '#2563EB' }}
            >
              {createMutation.isPending ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> : <Check className="w-3 h-3 mr-1.5" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 w-full rounded-xl"
              style={{ backgroundColor: 'var(--surface-gray-2)' }}
            />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <FileText className="w-8 h-8" style={{ color: 'var(--ink-gray-4)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>Nenhuma nota ainda</p>
        </div>
      )}

      {data?.map((note: Note) => (
        <div
          key={note.id}
          className="group rounded-xl p-4 space-y-2 transition-colors"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--outline-gray-2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--outline-gray-1)'
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium" style={{ color: 'var(--ink-gray-9)' }}>{note.title}</h4>
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
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--ink-gray-7)' }}>{note.content}</p>
          {note.created_by && (
            <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
              {note.created_by.name} &middot;{' '}
              {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
  dealId: string
}

function TasksTab({ dealId }: TasksTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium')
  const [formDueDate, setFormDueDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-tasks', 'Deal', dealId],
    queryFn: () =>
      crmApi.tasks.list({
        filters: { reference_doctype: 'Deal', reference_docname: dealId },
      }),
    select: (res) => res.data.data,
  })

  const createMutation = useMutation({
    mutationFn: (d: CreateTaskData) => crmApi.tasks.create(d),
    onSuccess: () => {
      toast.success('Tarefa criada')
      setFormTitle('')
      setFormDueDate('')
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['crm-tasks', 'Deal', dealId] })
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      crmApi.tasks.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-tasks', 'Deal', dealId] }),
    onError: () => toast.error('Erro ao atualizar tarefa'),
  })

  const PRIORITY_COLORS: Record<TaskPriority, string> = {
    Low: 'var(--ink-gray-5)',
    Medium: 'var(--ink-amber-3)',
    High: 'var(--ink-red-3)',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: 'var(--ink-gray-7)' }}>
          Tarefas {data && `(${data.length})`}
        </h3>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs text-white"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Adicionar tarefa
        </Button>
      </div>

      {showForm && (
        <div
          className="rounded-xl p-4 space-y-3 animate-slideUp"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
          }}
        >
          <Input
            placeholder="Título da tarefa"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="text-sm"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskPriority)}>
              <SelectTrigger
                className="text-sm"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                  color: 'var(--ink-gray-8)',
                }}
              >
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
              style={{
                backgroundColor: 'var(--surface-white)',
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-8)',
              }}
              aria-label="Data de vencimento"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="h-8 text-xs"
              style={{ color: 'var(--ink-gray-5)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
                e.currentTarget.style.color = 'var(--ink-gray-9)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ''
                e.currentTarget.style.color = 'var(--ink-gray-5)'
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() =>
                createMutation.mutate({
                  title: formTitle,
                  priority: formPriority,
                  due_date: formDueDate || undefined,
                  status: 'Todo',
                  reference_doctype: 'Deal' as CrmDoctype,
                  reference_docname: dealId,
                })
              }
              disabled={!formTitle.trim() || createMutation.isPending}
              className="h-8 text-xs text-white"
              style={{ backgroundColor: '#2563EB' }}
            >
              {createMutation.isPending ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> : <Check className="w-3 h-3 mr-1.5" />}
              Criar tarefa
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 w-full rounded-xl"
              style={{ backgroundColor: 'var(--surface-gray-2)' }}
            />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <ListTodo className="w-8 h-8" style={{ color: 'var(--ink-gray-4)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>Nenhuma tarefa ainda</p>
        </div>
      )}

      {data?.map((task: Task) => (
        <div
          key={task.id}
          className="flex items-center gap-3 rounded-xl p-3 transition-colors"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-1)')}
        >
          <button
            onClick={() => updateMutation.mutate({ id: task.id, status: task.status === 'Done' ? 'Todo' : 'Done' })}
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              task.status === 'Done' ? 'bg-emerald-500 border-emerald-500' : ''
            )}
            style={task.status !== 'Done' ? { borderColor: 'var(--outline-gray-3)' } : {}}
            aria-label={task.status === 'Done' ? 'Marcar como pendente' : 'Marcar como feito'}
          >
            {task.status === 'Done' && <Check className="w-3 h-3 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <p
              className={cn('text-sm font-medium', task.status === 'Done' ? 'line-through' : '')}
              style={{ color: task.status === 'Done' ? 'var(--ink-gray-5)' : 'var(--ink-gray-9)' }}
            >
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: PRIORITY_COLORS[task.priority] }}>
                {task.priority === 'Low' ? 'Baixa' : task.priority === 'Medium' ? 'Média' : 'Alta'}
              </span>
              {task.due_date && (
                <>
                  <span className="text-xs" style={{ color: 'var(--outline-gray-3)' }}>&middot;</span>
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--ink-gray-5)' }}>
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
  dealId: string
}

function CallsTab({ dealId }: CallsTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [callType, setCallType] = useState<CallLogType>('Outbound')
  const [callStatus, setCallStatus] = useState<CallLogStatus>('Completed')
  const [callNote, setCallNote] = useState('')
  const [callDuration, setCallDuration] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-calls', 'Deal', dealId],
    queryFn: () =>
      crmApi.callLogs.list({
        filters: { reference_doctype: 'Deal', reference_docname: dealId },
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
      queryClient.invalidateQueries({ queryKey: ['crm-calls', 'Deal', dealId] })
    },
    onError: () => toast.error('Erro ao registrar chamada'),
  })

  const STATUS_COLORS: Record<CallLogStatus, string> = {
    Completed: 'var(--ink-green-3)',
    'No Answer': 'var(--ink-amber-3)',
    Busy: 'var(--ink-amber-3)',
    Failed: 'var(--ink-red-3)',
    Voicemail: 'var(--ink-blue-3)',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: 'var(--ink-gray-7)' }}>
          Chamadas {data && `(${data.length})`}
        </h3>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs text-white"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Registrar chamada
        </Button>
      </div>

      {showForm && (
        <div
          className="rounded-xl p-4 space-y-3 animate-slideUp"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Select value={callType} onValueChange={(v) => setCallType(v as CallLogType)}>
              <SelectTrigger
                className="text-sm"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                <SelectItem value="Outbound">Saída</SelectItem>
                <SelectItem value="Inbound">Entrada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={callStatus} onValueChange={(v) => setCallStatus(v as CallLogStatus)}>
              <SelectTrigger
                className="text-sm"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                  color: 'var(--ink-gray-8)',
                }}
              >
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
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          />
          <Textarea
            placeholder="Observações da chamada..."
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            className="text-sm min-h-[80px] resize-none"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="h-8 text-xs"
              style={{ color: 'var(--ink-gray-5)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
                e.currentTarget.style.color = 'var(--ink-gray-9)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ''
                e.currentTarget.style.color = 'var(--ink-gray-5)'
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() =>
                createMutation.mutate({
                  type: callType,
                  status: callStatus,
                  duration: callDuration ? Number(callDuration) : undefined,
                  note: callNote || undefined,
                  reference_doctype: 'Deal' as CrmDoctype,
                  reference_docname: dealId,
                })
              }
              disabled={createMutation.isPending}
              className="h-8 text-xs text-white"
              style={{ backgroundColor: '#2563EB' }}
            >
              {createMutation.isPending ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> : <Check className="w-3 h-3 mr-1.5" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 w-full rounded-xl"
              style={{ backgroundColor: 'var(--surface-gray-2)' }}
            />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Phone className="w-8 h-8" style={{ color: 'var(--ink-gray-4)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>Nenhuma chamada registrada</p>
        </div>
      )}

      {data?.map((call: CallLog) => (
        <div
          key={call.id}
          className="rounded-xl p-3 transition-colors"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--outline-gray-1)')}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-gray-5)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--ink-gray-9)' }}>
                {call.type === 'Outbound' ? 'Saída' : 'Entrada'}
              </span>
              <span className="text-xs" style={{ color: STATUS_COLORS[call.status] }}>{call.status}</span>
            </div>
            {call.duration && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--ink-gray-5)' }}>
                <Clock className="w-3 h-3" />
                {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
          {call.note && (
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--ink-gray-7)' }}>{call.note}</p>
          )}
          <p className="text-xs mt-1" style={{ color: 'var(--ink-gray-5)' }}>
            {format(new Date(call.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      ))}
    </div>
  )
}

// ============================================
// PRODUCTS TAB (placeholder - shows linked products)
// ============================================

function ProductsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Package className="w-10 h-10" style={{ color: 'var(--ink-gray-4)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-7)' }}>Produtos vinculados</p>
      <p className="text-xs text-center max-w-xs" style={{ color: 'var(--ink-gray-5)' }}>
        A vinculação de produtos a negociações estará disponível em uma versão futura
      </p>
    </div>
  )
}

// ============================================
// MARK LOST DIALOG
// ============================================

interface MarkLostDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: MarkDealLostData) => void
  isPending: boolean
  dealName: string
}

function MarkLostDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  dealName,
}: MarkLostDialogProps) {
  const [selectedReasonId, setSelectedReasonId] = useState('')
  const [detail, setDetail] = useState('')

  const { data: reasons } = useQuery({
    queryKey: ['crm-lost-reasons'],
    queryFn: () => crmApi.settings.lookups.lostReasons(),
    select: (res) => res.data,
    enabled: open,
  })

  const handleConfirm = () => {
    onConfirm({
      lost_reason_id: selectedReasonId || undefined,
      lost_detail: detail || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{
          backgroundColor: 'var(--surface-white)',
          border: '1px solid var(--outline-gray-1)',
          color: 'var(--ink-gray-9)',
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ color: 'var(--ink-gray-9)' }}
          >
            <XCircle className="w-5 h-5 text-rose-500" />
            Marcar como perdida
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--ink-gray-5)' }}>
            Informe o motivo da perda de{' '}
            <span className="font-medium" style={{ color: 'var(--ink-gray-8)' }}>{dealName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--ink-gray-7)' }}>
              Motivo da perda
            </label>
            <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
              <SelectTrigger
                className="text-sm"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                <SelectValue placeholder="Selecionar motivo (opcional)" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--surface-white)',
                  borderColor: 'var(--outline-gray-1)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                {reasons?.map((r: LostReason) => (
                  <SelectItem key={r.id} value={r.id} className="text-sm">
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--ink-gray-7)' }}>
              Detalhes adicionais
            </label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Descreva o motivo da perda..."
              className="text-sm min-h-[80px] resize-none"
              style={{
                backgroundColor: 'var(--surface-white)',
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-8)',
              }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            style={{ color: 'var(--ink-gray-5)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
              e.currentTarget.style.color = 'var(--ink-gray-9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = ''
              e.currentTarget.style.color = 'var(--ink-gray-5)'
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-rose-600 hover:bg-rose-500 text-white"
          >
            {isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            Marcar como perdida
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// DEAL VALUE DISPLAY
// ============================================

function formatDealValue(value: number | null, currency: string): string {
  if (value === null || value === undefined) return '—'
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString('pt-BR')}`
  }
}

// ============================================
// MAIN PAGE
// ============================================

// Add confetti keyframe to document once
if (typeof document !== 'undefined') {
  const styleId = 'confetti-keyframes'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes confettiFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }
}

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const dealId = params.dealId as string

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMarkLostDialog, setShowMarkLostDialog] = useState(false)
  const [showWonCelebration, setShowWonCelebration] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameEdit, setNameEdit] = useState('')

  const confettiPieces = useConfetti(showWonCelebration)

  // Fetch deal
  const {
    data: dealResponse,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['crm-deal', dealId],
    queryFn: () => crmApi.deals.get(dealId),
    select: (res) => res.data,
  })

  const deal = dealResponse

  // Fetch deal statuses
  const { data: statusOptions } = useQuery({
    queryKey: ['crm-deal-statuses'],
    queryFn: () => crmApi.settings.statuses.listDeal(),
    select: (res) =>
      res.data.map((s) => ({ value: s.id, label: s.label, color: s.color })),
  })

  // Update deal mutation
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof crmApi.deals.update>[1]) =>
      crmApi.deals.update(dealId, data),
    onSuccess: () => {
      toast.success('Negociação atualizada')
      queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
    },
    onError: () => toast.error('Erro ao atualizar negociação'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => crmApi.deals.delete(dealId),
    onSuccess: () => {
      toast.success('Negociação excluída')
      router.push('/crm/deals')
    },
    onError: () => toast.error('Erro ao excluir negociação'),
  })

  // Mark Won mutation
  const markWonMutation = useMutation({
    mutationFn: () => crmApi.deals.markWon(dealId),
    onSuccess: () => {
      toast.success('Negociação ganha!')
      setShowWonCelebration(true)
      setTimeout(() => setShowWonCelebration(false), 4000)
      queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
    },
    onError: () => toast.error('Erro ao marcar como ganha'),
  })

  // Mark Lost mutation
  const markLostMutation = useMutation({
    mutationFn: (data: MarkDealLostData) => crmApi.deals.markLost(dealId, data),
    onSuccess: () => {
      toast.success('Negociação marcada como perdida')
      setShowMarkLostDialog(false)
      queryClient.invalidateQueries({ queryKey: ['crm-deal', dealId] })
    },
    onError: () => toast.error('Erro ao marcar como perdida'),
  })

  // Field update handler
  const handleFieldUpdate = (field: string, value: unknown) => {
    if (field === 'status') {
      const statusVal = value as { id?: string } | null
      if (statusVal?.id) updateMutation.mutate({ status_id: statusVal.id })
      return
    }
    updateMutation.mutate({ [field]: value })
  }

  // Side panel fields
  const sidePanelFields: FieldDefinition[] = [
    { key: 'organization_name', label: 'Organização', type: 'text', editable: true, group: 'Informações', icon: Building2 },
    { key: 'lead_name', label: 'Contato', type: 'text', editable: true, group: 'Informações', icon: User },
    { key: 'email', label: 'Email', type: 'email', editable: true, group: 'Informações', icon: Mail },
    { key: 'mobile_no', label: 'Celular', type: 'phone', editable: true, group: 'Informações', icon: Phone },
    { key: 'deal_value', label: 'Valor', type: 'currency', editable: true, group: 'Negociação', icon: DollarSign },
    { key: 'probability', label: 'Probabilidade (%)', type: 'number', editable: true, group: 'Negociação', icon: TrendingUp },
    { key: 'expected_closure_date', label: 'Previsão de fechamento', type: 'date', editable: true, group: 'Negociação', icon: CalendarDays },
    {
      key: 'status',
      label: 'Status',
      type: 'badge',
      editable: true,
      options: statusOptions ?? [],
      group: 'Pipeline',
    },
    { key: 'deal_owner', label: 'Responsável', type: 'user', editable: false, group: 'Pipeline' },
  ]

  const sidePanelData: Record<string, unknown> = deal
    ? {
        organization_name: deal.organization_name,
        lead_name: deal.lead_name,
        email: deal.email,
        mobile_no: deal.mobile_no,
        deal_value: deal.deal_value,
        probability: deal.probability,
        expected_closure_date: deal.expected_closure_date,
        status: deal.status,
        deal_owner: deal.deal_owner,
      }
    : {}

  // Determine won/lost state from status
  const isWon = deal?.status?.status_type === 'Won'
  const isLost = deal?.status?.status_type === 'Lost'
  const dealName = deal?.organization_name ?? deal?.lead_name ?? `Negociação ${dealId}`

  // ---- LOADING STATE ----
  if (isLoading) {
    return (
      <div
        className="h-full flex flex-col"
        style={{ backgroundColor: 'var(--surface-gray-1)' }}
      >
        <div
          className="border-b px-6 py-4 flex items-center gap-4"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-1)',
          }}
        >
          <div
            className="h-8 w-8 rounded-lg"
            style={{ backgroundColor: 'var(--surface-gray-2)' }}
          />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-6 space-y-4">
            <div className="h-10 w-full max-w-md rounded-xl" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-full rounded-xl" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            ))}
          </div>
          <div
            className="hidden lg:block w-80 border-l p-4 space-y-3"
            style={{ borderColor: 'var(--outline-gray-1)' }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 w-full rounded-lg" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---- ERROR STATE ----
  if (isError || !deal) {
    return (
      <div
        className="h-full flex flex-col items-center justify-center gap-4 p-8"
        style={{ backgroundColor: 'var(--surface-gray-1)' }}
      >
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="font-medium" style={{ color: 'var(--ink-gray-7)' }}>
          Não foi possível carregar a negociação
        </p>
        <Button
          variant="ghost"
          onClick={() => refetch()}
          style={{ color: 'var(--ink-blue-3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-blue-2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push('/crm/deals')}
          style={{ color: 'var(--ink-gray-5)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
            e.currentTarget.style.color = 'var(--ink-gray-9)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = ''
            e.currentTarget.style.color = 'var(--ink-gray-5)'
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Negociações
        </Button>
      </div>
    )
  }

  const statusColor = deal.status?.color ?? '#94a3b8'

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--surface-gray-1)' }}
    >
      {/* Confetti overlay */}
      {confettiPieces.map((style, i) => (
        <ConfettiPiece key={i} style={style} />
      ))}

      {/* Won celebration banner */}
      {showWonCelebration && (
        <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 pointer-events-none">
          <div
            className="rounded-2xl px-6 py-3 flex items-center gap-3 animate-slideUp shadow-lg"
            style={{
              backgroundColor: 'var(--surface-green-2)',
              border: '1px solid var(--ink-green-3)',
            }}
          >
            <Trophy className="w-5 h-5" style={{ color: 'var(--ink-green-3)' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--ink-green-3)' }}>
              Parabens! Negociacao ganha!
            </span>
          </div>
        </div>
      )}

      {/* ---- HEADER ---- */}
      <header
        className="flex-shrink-0 border-b px-4 lg:px-6 py-3"
        style={{
          backgroundColor: 'var(--surface-white)',
          borderColor: 'var(--outline-gray-1)',
        }}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs mb-2" aria-label="Breadcrumb">
          <button
            onClick={() => router.push('/crm/deals')}
            className="transition-colors"
            style={{ color: 'var(--ink-gray-5)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-8)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-5)')}
          >
            Negociações
          </button>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-4)' }} />
          <span className="truncate max-w-[200px]" style={{ color: 'var(--ink-gray-7)' }}>
            {dealName}
          </span>
        </nav>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-8 w-8 p-0 flex-shrink-0"
            style={{ color: 'var(--ink-gray-5)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
              e.currentTarget.style.color = 'var(--ink-gray-9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = ''
              e.currentTarget.style.color = 'var(--ink-gray-5)'
            }}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Deal icon with won/lost styling */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={
              isWon
                ? { backgroundColor: 'var(--surface-green-2)', border: '1px solid var(--ink-green-3)' }
                : isLost
                ? { backgroundColor: 'var(--surface-red-2)', border: '1px solid var(--ink-red-3)' }
                : { backgroundColor: 'var(--surface-blue-2)', border: '1px solid var(--ink-blue-3)' }
            }
          >
            <Handshake
              className="w-5 h-5"
              style={{
                color: isWon
                  ? 'var(--ink-green-3)'
                  : isLost
                  ? 'var(--ink-red-3)'
                  : 'var(--ink-blue-3)',
              }}
            />
          </div>

          {/* Deal name (inline editable) */}
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameEdit}
                  onChange={(e) => setNameEdit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateMutation.mutate({ organization_name: nameEdit })
                      setIsEditingName(false)
                    }
                    if (e.key === 'Escape') setIsEditingName(false)
                  }}
                  autoFocus
                  className="h-8 text-base font-semibold w-64"
                  style={{
                    backgroundColor: 'var(--surface-white)',
                    borderColor: 'var(--outline-gray-2)',
                    color: 'var(--ink-gray-9)',
                  }}
                  aria-label="Nome da negociação"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    updateMutation.mutate({ organization_name: nameEdit })
                    setIsEditingName(false)
                  }}
                  className="h-8 text-white text-xs px-3"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingName(false)}
                  className="h-8 text-xs px-2"
                  style={{ color: 'var(--ink-gray-5)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
                    e.currentTarget.style.color = 'var(--ink-gray-9)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = ''
                    e.currentTarget.style.color = 'var(--ink-gray-5)'
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="text-base lg:text-lg font-semibold leading-tight cursor-pointer transition-colors"
                  style={{ color: 'var(--ink-gray-9)', fontWeight: 600 }}
                  onClick={() => {
                    setNameEdit(dealName)
                    setIsEditingName(true)
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-7)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-9)')}
                  title="Clique para editar"
                >
                  {dealName}
                </h1>
                {/* Naming series */}
                <span className="text-xs hidden sm:inline" style={{ color: 'var(--ink-gray-5)' }}>
                  {deal.naming_series}
                </span>
                {/* Status badge */}
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                  style={{
                    backgroundColor: statusColor + '22',
                    color: statusColor,
                    border: `1px solid ${statusColor}44`,
                  }}
                  aria-label={`Status: ${deal.status?.label}`}
                >
                  {deal.status?.label ?? 'Sem status'}
                </span>
                {/* Deal value */}
                {deal.deal_value !== null && (
                  <span
                    className="text-sm font-semibold hidden sm:inline"
                    style={{ color: 'var(--ink-green-3)' }}
                  >
                    {formatDealValue(deal.deal_value, deal.currency)}
                  </span>
                )}
                {/* Probability */}
                {deal.probability !== null && (
                  <span
                    className="text-xs hidden md:inline flex items-center gap-1"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    <TrendingUp className="w-3 h-3 inline" />
                    {deal.probability}%
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mark Won */}
            {!isWon && !isLost && (
              <Button
                size="sm"
                onClick={() => markWonMutation.mutate()}
                disabled={markWonMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs hidden sm:flex"
              >
                {markWonMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Trophy className="w-3.5 h-3.5 mr-1.5" />
                )}
                Ganhar
              </Button>
            )}

            {/* Mark Lost */}
            {!isWon && !isLost && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowMarkLostDialog(true)}
                className="h-8 text-xs hidden sm:flex"
                style={{
                  border: '1px solid var(--ink-red-3)',
                  color: 'var(--ink-red-3)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-red-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Perder
              </Button>
            )}

            {/* More actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  style={{ color: 'var(--ink-gray-5)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)'
                    e.currentTarget.style.color = 'var(--ink-gray-9)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = ''
                    e.currentTarget.style.color = 'var(--ink-gray-5)'
                  }}
                  aria-label="Mais ações"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-ios-xs"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  border: '1px solid var(--outline-gray-1)',
                  color: 'var(--ink-gray-8)',
                }}
              >
                <DropdownMenuItem
                  onClick={() => {
                    setNameEdit(dealName)
                    setIsEditingName(true)
                  }}
                  className="cursor-pointer"
                  style={{ color: 'var(--ink-gray-7)' }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar nome
                </DropdownMenuItem>
                {!isWon && !isLost && (
                  <>
                    <DropdownMenuItem
                      onClick={() => markWonMutation.mutate()}
                      className="cursor-pointer sm:hidden"
                      style={{ color: 'var(--ink-green-3)' }}
                    >
                      <Trophy className="mr-2 h-4 w-4" />
                      Marcar como ganha
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowMarkLostDialog(true)}
                      className="cursor-pointer sm:hidden"
                      style={{ color: 'var(--ink-red-3)' }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Marcar como perdida
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator style={{ backgroundColor: 'var(--outline-gray-1)' }} />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="cursor-pointer"
                  style={{ color: 'var(--ink-red-3)' }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir negociação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ---- BODY ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 min-w-0">
          <Tabs defaultValue="activity" className="h-full">
            <TabsList
              className="rounded-xl p-1 mb-6 flex-wrap h-auto gap-1"
              style={{
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--outline-gray-1)',
              }}
            >
              <TabsTrigger
                value="activity"
                className="rounded-lg text-xs px-3 py-1.5 data-[state=active]:shadow-none transition-colors"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                <Activity className="w-3.5 h-3.5 mr-1.5" />
                Atividade
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="rounded-lg text-xs px-3 py-1.5 data-[state=active]:shadow-none transition-colors"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Notas
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="rounded-lg text-xs px-3 py-1.5 data-[state=active]:shadow-none transition-colors"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                <ListTodo className="w-3.5 h-3.5 mr-1.5" />
                Tarefas
              </TabsTrigger>
              <TabsTrigger
                value="calls"
                className="rounded-lg text-xs px-3 py-1.5 data-[state=active]:shadow-none transition-colors"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                <Phone className="w-3.5 h-3.5 mr-1.5" />
                Chamadas
              </TabsTrigger>
              <TabsTrigger
                value="products"
                className="rounded-lg text-xs px-3 py-1.5 data-[state=active]:shadow-none transition-colors"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Produtos
              </TabsTrigger>
              <TabsTrigger
                value="emails"
                className="rounded-lg text-xs px-3 py-1.5 data-[state=active]:shadow-none transition-colors"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                Emails
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-0">
              <ActivityTimeline doctype="Deal" docname={dealId} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <NotesTab dealId={dealId} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0">
              <TasksTab dealId={dealId} />
            </TabsContent>

            <TabsContent value="calls" className="mt-0">
              <CallsTab dealId={dealId} />
            </TabsContent>

            <TabsContent value="products" className="mt-0">
              <ProductsTab />
            </TabsContent>

            <TabsContent value="emails" className="mt-0">
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Mail className="w-10 h-10" style={{ color: 'var(--ink-gray-4)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-7)' }}>Emails em breve</p>
                <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                  Integração de emails será adicionada em uma versão futura
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {/* Side panel */}
        <aside
          className="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 border-l overflow-y-auto"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-1)',
          }}
        >
          {/* Side panel header */}
          <div
            className="flex items-center gap-3 px-4 py-4 border-b"
            style={{ borderColor: 'var(--outline-gray-1)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={
                isWon
                  ? { backgroundColor: 'var(--surface-green-2)', border: '1px solid var(--ink-green-3)' }
                  : isLost
                  ? { backgroundColor: 'var(--surface-red-2)', border: '1px solid var(--ink-red-3)' }
                  : { backgroundColor: 'var(--surface-blue-2)', border: '1px solid var(--ink-blue-3)' }
              }
            >
              <Handshake
                className="w-5 h-5"
                style={{
                  color: isWon
                    ? 'var(--ink-green-3)'
                    : isLost
                    ? 'var(--ink-red-3)'
                    : 'var(--ink-blue-3)',
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink-gray-9)' }}>
                {dealName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {deal.deal_value !== null && (
                  <p className="text-xs font-semibold" style={{ color: 'var(--ink-green-3)' }}>
                    {formatDealValue(deal.deal_value, deal.currency)}
                  </p>
                )}
                {deal.probability !== null && (
                  <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                    {deal.probability}% prob.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Won/Lost state banner */}
          {(isWon || isLost) && (
            <div
              className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={
                isWon
                  ? {
                      backgroundColor: 'var(--surface-green-2)',
                      border: '1px solid var(--ink-green-3)',
                    }
                  : {
                      backgroundColor: 'var(--surface-red-2)',
                      border: '1px solid var(--ink-red-3)',
                    }
              }
            >
              {isWon ? (
                <Trophy
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--ink-green-3)' }}
                />
              ) : (
                <XCircle
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--ink-red-3)' }}
                />
              )}
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold"
                  style={{ color: isWon ? 'var(--ink-green-3)' : 'var(--ink-red-3)' }}
                >
                  {isWon ? 'Negociação ganha' : 'Negociação perdida'}
                </p>
                {isLost && deal.lost_reason && (
                  <p className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>
                    Motivo: {deal.lost_reason.name}
                  </p>
                )}
                {isLost && deal.lost_detail && (
                  <p className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>
                    {deal.lost_detail}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Expected closure date highlight */}
          {deal.expected_closure_date && !isWon && !isLost && (
            <div
              className="mx-4 mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                backgroundColor: 'var(--surface-gray-1)',
                border: '1px solid var(--outline-gray-1)',
              }}
            >
              <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-gray-5)' }} />
              <div>
                <p
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: 'var(--ink-gray-5)' }}
                >
                  Previsão
                </p>
                <p className="text-xs font-medium" style={{ color: 'var(--ink-gray-8)' }}>
                  {format(new Date(deal.expected_closure_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
          )}

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
      <MarkLostDialog
        open={showMarkLostDialog}
        onClose={() => setShowMarkLostDialog(false)}
        onConfirm={(data) => markLostMutation.mutate(data)}
        isPending={markLostMutation.isPending}
        dealName={dealName}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={(o) => !o && setShowDeleteDialog(false)}>
        <AlertDialogContent
          className="max-w-md"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            color: 'var(--ink-gray-9)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ink-gray-9)' }}>
              Excluir negociação
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja excluir{' '}
              <span className="font-medium" style={{ color: 'var(--ink-gray-8)' }}>{dealName}</span>?
              Todas as atividades, notas e tarefas associadas também serão removidas.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowDeleteDialog(false)}
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--outline-gray-2)',
                color: 'var(--ink-gray-7)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-500 text-white border-0"
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
