'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/use-debounce'
import { crmApi } from '@/services/crm/api'
import { crmKeys } from '@/hooks/crm/use-crm-queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  CheckSquare,
  LayoutList,
  Columns,
  CalendarDays,
  Link2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Task, TaskPriority, TaskStatus, CreateTaskData, UpdateTaskData } from '@/types/crm'

// ============================================
// CONSTANTS
// ============================================

const TASK_STATUSES: Array<{
  value: TaskStatus
  label: string
  color: string
  indicator: string
}> = [
  { value: 'Backlog', label: 'Backlog', color: '#999999', indicator: 'indicator-gray' },
  { value: 'Todo', label: 'A Fazer', color: '#007BE0', indicator: 'indicator-blue' },
  { value: 'In Progress', label: 'Em Andamento', color: '#DB7706', indicator: 'indicator-orange' },
  { value: 'Done', label: 'Concluido', color: '#278F5E', indicator: 'indicator-green' },
  { value: 'Canceled', label: 'Cancelado', color: '#E03636', indicator: 'indicator-red' },
]

const TASK_PRIORITIES: Array<{
  value: TaskPriority
  label: string
  color: string
  bgColor: string
}> = [
  { value: 'Low', label: 'Baixa', color: '#999999', bgColor: 'var(--surface-gray-2)' },
  { value: 'Medium', label: 'Media', color: '#DB7706', bgColor: 'var(--surface-amber-2)' },
  { value: 'High', label: 'Alta', color: '#E03636', bgColor: 'var(--surface-red-2)' },
]

// ============================================
// HELPERS
// ============================================

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0] ?? '').substring(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

function getStatusConfig(status: TaskStatus) {
  return TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0]!
}

function getPriorityConfig(priority: TaskPriority) {
  return TASK_PRIORITIES.find((p) => p.value === priority) ?? TASK_PRIORITIES[0]!
}

function isOverdue(task: Task): boolean {
  if (!task.due_date) return false
  if (task.status === 'Done' || task.status === 'Canceled') return false
  return isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Hoje'
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
}

// ============================================
// STATUS ICON (TaskStatusIcon)
// ============================================

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  const iconClass = 'w-4 h-4 flex-shrink-0'
  switch (status) {
    case 'Backlog':
      return <Circle className={iconClass} style={{ color: '#999999' }} />
    case 'Todo':
      return <Circle className={iconClass} style={{ color: '#007BE0' }} />
    case 'In Progress':
      return <Loader2 className={iconClass} style={{ color: '#DB7706' }} />
    case 'Done':
      return <CheckCircle2 className={iconClass} style={{ color: '#278F5E' }} />
    case 'Canceled':
      return <XCircle className={iconClass} style={{ color: '#E03636' }} />
  }
}

// ============================================
// PRIORITY ICON (TaskPriorityIcon)
// ============================================

function TaskPriorityIcon({ priority }: { priority: TaskPriority }) {
  const iconClass = 'w-3.5 h-3.5 flex-shrink-0'
  switch (priority) {
    case 'Low':
      return <ArrowDown className={iconClass} style={{ color: '#999999' }} />
    case 'Medium':
      return <ArrowRight className={iconClass} style={{ color: '#DB7706' }} />
    case 'High':
      return <ArrowUp className={iconClass} style={{ color: '#E03636' }} />
  }
}

// ============================================
// AVATAR (assigned_to)
// ============================================

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
// VIEW SWITCHER
// ============================================

interface ViewSwitcherProps {
  current: 'list' | 'kanban'
  onChange: (v: 'list' | 'kanban') => void
}

function ViewSwitcher({ current, onChange }: ViewSwitcherProps) {
  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded border"
      style={{ borderColor: 'var(--outline-gray-2)', backgroundColor: 'var(--surface-gray-2)' }}
    >
      {([
        { type: 'list' as const, Icon: LayoutList, label: 'Lista' },
        { type: 'kanban' as const, Icon: Columns, label: 'Kanban' },
      ] as const).map(({ type, Icon, label }) => (
        <button
          key={type}
          onClick={() => onChange(type)}
          aria-label={label}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors"
          style={
            current === type
              ? {
                  backgroundColor: 'var(--surface-white)',
                  color: 'var(--ink-gray-8)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                }
              : { color: 'var(--ink-gray-5)' }
          }
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ============================================
// TASK KANBAN CARD
// ============================================

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

function TaskKanbanCard({ task, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const priority = getPriorityConfig(task.priority)
  const overdue = isOverdue(task)

  return (
    <div
      className="rounded-lg border p-3 cursor-pointer transition-colors"
      style={{
        borderColor: overdue ? 'var(--ink-red-3)' : 'var(--outline-gray-1)',
        backgroundColor: 'var(--surface-white)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--surface-white)'
      }}
      onClick={() => onEdit(task)}
    >
      {/* Title + actions */}
      <div className="flex items-start gap-2 mb-2">
        <p
          className="text-sm font-medium flex-1 line-clamp-2"
          style={{ color: 'var(--ink-gray-8)' }}
        >
          {task.title}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              aria-label="Acoes"
            >
              <MoreHorizontal className="h-3.5 w-3.5" style={{ color: 'var(--ink-gray-5)' }} />
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
            {TASK_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s.value}
                className="text-xs cursor-pointer gap-2"
                style={{ color: 'var(--ink-gray-7)' }}
                onClick={() => onStatusChange(task, s.value)}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator style={{ backgroundColor: 'var(--outline-gray-1)' }} />
            <DropdownMenuItem
              className="text-sm cursor-pointer"
              style={{ color: 'var(--ink-red-3)' }}
              onClick={() => onDelete(task)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Priority badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <TaskPriorityIcon priority={task.priority} />
        <span className="text-xs" style={{ color: priority.color }}>
          {priority.label}
        </span>
        {overdue && (
          <span
            className="ml-auto text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--surface-red-2)', color: 'var(--ink-red-3)' }}
          >
            Atrasada
          </span>
        )}
      </div>

      {/* Due date */}
      {task.due_date && (
        <div
          className="flex items-center gap-1 text-xs mb-1"
          style={{ color: overdue ? 'var(--ink-red-3)' : 'var(--ink-gray-5)' }}
        >
          <CalendarDays className="w-3 h-3 flex-shrink-0" />
          <span>{formatDueDate(task.due_date)}</span>
        </div>
      )}

      {/* Reference */}
      {task.reference_docname && (
        <div className="flex items-center gap-1 text-xs mb-1" style={{ color: 'var(--ink-gray-5)' }}>
          <Link2 className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{task.reference_docname}</span>
        </div>
      )}

      {/* Assigned to */}
      {task.assigned_to && (
        <div className="flex items-center gap-1.5 mt-2">
          {(() => {
            const palette = getAvatarPalette(task.assigned_to.id)
            return (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                style={{ backgroundColor: palette.bg, color: palette.text }}
              >
                {getInitials(task.assigned_to.name)}
              </div>
            )
          })()}
          <span className="text-xs truncate" style={{ color: 'var(--ink-gray-5)' }}>
            {task.assigned_to.name}
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================
// KANBAN COLUMN
// ============================================

interface KanbanColProps {
  status: (typeof TASK_STATUSES)[number]
  tasks: Task[]
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  onAdd: (status: TaskStatus) => void
}

function KanbanCol({ status, tasks, onEdit, onDelete, onStatusChange, onAdd }: KanbanColProps) {
  return (
    <div className="flex-shrink-0 w-64">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
        <span className="text-xs font-semibold flex-1" style={{ color: 'var(--ink-gray-7)' }}>
          {status.label}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
        >
          {tasks.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAdd(status.value)}
          aria-label={`Nova tarefa em ${status.label}`}
        >
          <Plus className="h-3 w-3" style={{ color: 'var(--ink-gray-5)' }} />
        </Button>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskKanbanCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
          />
        ))}
        {tasks.length === 0 && (
          <div
            className="rounded-lg border-2 border-dashed p-6 text-center"
            style={{ borderColor: 'var(--outline-gray-2)' }}
          >
            <p className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
              Sem tarefas
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// LIST SKELETON
// ============================================

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="border-b" style={{ borderColor: 'var(--outline-gray-1)' }}>
          <TableCell className="py-2.5 pl-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-48" />
            </div>
          </TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-5 w-20 rounded" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-5 w-16 rounded" /></TableCell>
          <TableCell className="py-2.5 hidden md:table-cell"><Skeleton className="h-5 w-5 rounded-full" /></TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell className="py-2.5 hidden xl:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell className="py-2.5 pr-4"><Skeleton className="h-6 w-6 rounded ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ============================================
// KANBAN SKELETON
// ============================================

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-5 pt-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-64">
          <Skeleton className="h-5 w-28 mb-3 rounded" />
          <div className="space-y-2">
            {Array.from({ length: i === 2 ? 3 : i === 0 ? 2 : 1 }).map((_, j) => (
              <Skeleton key={j} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// TASK FORM
// ============================================

interface TaskFormProps {
  initialData?: Partial<CreateTaskData>
  onSubmit: (data: CreateTaskData) => void
  onCancel: () => void
  isLoading: boolean
  submitLabel: string
}

function TaskForm({ initialData, onSubmit, onCancel, isLoading, submitLabel }: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [priority, setPriority] = useState<TaskPriority>(initialData?.priority ?? 'Medium')
  const [status, setStatus] = useState<TaskStatus>(initialData?.status ?? 'Todo')
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? '')
  const [assignedTo, setAssignedTo] = useState(initialData?.assigned_to_id ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('O titulo e obrigatorio.')
      return
    }
    onSubmit({
      title: title.trim(),
      priority,
      status,
      due_date: dueDate || undefined,
      assigned_to_id: assignedTo || undefined,
    })
  }

  const inputStyle = {
    borderColor: 'var(--outline-gray-2)',
    backgroundColor: 'var(--surface-white)',
    color: 'var(--ink-gray-8)',
  }

  const labelStyle = { color: 'var(--ink-gray-6)' }

  const selectContentStyle = {
    backgroundColor: 'var(--surface-white)',
    borderColor: 'var(--outline-gray-2)',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>
          Titulo *
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titulo da tarefa"
          className="h-8 text-sm rounded border"
          style={inputStyle}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={labelStyle}>
            Prioridade
          </Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger className="h-8 text-sm rounded border" style={inputStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg border shadow-md" style={selectContentStyle}>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium" style={labelStyle}>
            Status
          </Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
            <SelectTrigger className="h-8 text-sm rounded border" style={inputStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg border shadow-md" style={selectContentStyle}>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>
          Vencimento
        </Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8 text-sm rounded border"
          style={inputStyle}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium" style={labelStyle}>
          Responsavel (ID)
        </Label>
        <Input
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          placeholder="UUID do usuario"
          className="h-8 text-sm rounded border"
          style={inputStyle}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 px-3 text-sm rounded border"
          style={{ borderColor: 'var(--outline-gray-2)', color: 'var(--ink-gray-7)' }}
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

const PAGE_SIZE = 20

export default function TasksPage() {
  const queryClient = useQueryClient()

  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | null>(null)
  const [filterPriority, setFilterPriority] = useState<TaskPriority | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createInitialStatus, setCreateInitialStatus] = useState<TaskStatus>('Todo')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  const debouncedSearch = useDebounce(search, 350)

  // ============================================
  // QUERIES
  // ============================================

  const listParams = {
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch || undefined,
    order_by: 'created_at',
    order_direction: 'desc' as const,
    filters: {
      ...(filterStatus ? { status: filterStatus } : {}),
      ...(filterPriority ? { priority: filterPriority } : {}),
    },
  }

  const listQuery = useQuery({
    queryKey: crmKeys.taskList(listParams),
    queryFn: () => crmApi.tasks.list(listParams),
    placeholderData: keepPreviousData,
    select: (res) => res.data,
    enabled: view === 'list',
  })

  const kanbanQuery = useQuery({
    queryKey: [...crmKeys.tasks(), 'kanban-flat', debouncedSearch, filterPriority],
    queryFn: () =>
      crmApi.tasks.list({
        page: 1,
        page_size: 200,
        search: debouncedSearch || undefined,
        filters: filterPriority ? { priority: filterPriority } : {},
      }),
    select: (res) => res.data,
    enabled: view === 'kanban',
  })

  const tasks = listQuery.data?.data ?? []
  const totalCount = listQuery.data?.total_count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Group tasks by status for kanban
  const kanbanTasks = kanbanQuery.data?.data ?? []
  const tasksByStatus = TASK_STATUSES.reduce(
    (acc, s) => {
      acc[s.value] = kanbanTasks.filter((t) => t.status === s.value)
      return acc
    },
    {} as Record<TaskStatus, Task[]>
  )

  // ============================================
  // MUTATIONS
  // ============================================

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskData) => crmApi.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks() })
      setIsCreateOpen(false)
      toast.success('Tarefa criada.')
    },
    onError: () => toast.error('Erro ao criar tarefa.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskData }) =>
      crmApi.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks() })
      setEditingTask(null)
      toast.success('Tarefa atualizada.')
    },
    onError: () => toast.error('Erro ao atualizar tarefa.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks() })
      setDeletingTask(null)
      toast.success('Tarefa removida.')
    },
    onError: () => toast.error('Erro ao remover tarefa.'),
  })

  // ============================================
  // HANDLERS
  // ============================================

  const handleStatusChange = useCallback(
    (task: Task, status: TaskStatus) => {
      updateMutation.mutate({ id: task.id, data: { status } })
    },
    [updateMutation]
  )

  const handleCreateInColumn = useCallback((status: TaskStatus) => {
    setCreateInitialStatus(status)
    setIsCreateOpen(true)
  }, [])

  const isLoading = view === 'list' ? listQuery.isLoading : kanbanQuery.isLoading

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
            Tarefas
          </h1>
          {view === 'list' && !listQuery.isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {totalCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ViewSwitcher current={view} onChange={setView} />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => queryClient.invalidateQueries({ queryKey: crmKeys.tasks() })}
            disabled={isLoading}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
              style={{ color: 'var(--ink-gray-5)' }}
            />
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setCreateInitialStatus('Todo')
              setIsCreateOpen(true)
            }}
            style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff' }}
            className="h-7 text-xs hover:opacity-90 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* ---- View Controls Bar ---- */}
      <div
        className="flex items-center gap-3 px-5 py-2 border-b flex-shrink-0 flex-wrap"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        <div className="relative max-w-xs w-full sm:w-auto">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <Input
            type="search"
            placeholder="Buscar tarefas..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-8 h-7 text-xs border rounded w-56"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          />
        </div>

        {/* Status filter */}
        <Select
          value={filterStatus ?? '__none__'}
          onValueChange={(v) => {
            setFilterStatus(v === '__none__' ? null : (v as TaskStatus))
            setPage(1)
          }}
        >
          <SelectTrigger
            className="h-7 text-xs border rounded w-36"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-7)',
            }}
          >
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent
            className="rounded-lg border shadow-md"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
            }}
          >
            <SelectItem value="__none__">Todos os status</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority filter */}
        <Select
          value={filterPriority ?? '__none__'}
          onValueChange={(v) => {
            setFilterPriority(v === '__none__' ? null : (v as TaskPriority))
            setPage(1)
          }}
        >
          <SelectTrigger
            className="h-7 text-xs border rounded w-36"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-7)',
            }}
          >
            <SelectValue placeholder="Todas as prioridades" />
          </SelectTrigger>
          <SelectContent
            className="rounded-lg border shadow-md"
            style={{
              backgroundColor: 'var(--surface-white)',
              borderColor: 'var(--outline-gray-2)',
            }}
          >
            <SelectItem value="__none__">Todas as prioridades</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  {p.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---- LIST VIEW ---- */}
      {view === 'list' && (
        <div className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1">
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
                    className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Titulo
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Status
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Prioridade
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden md:table-cell"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Responsavel
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Vencimento
                  </TableHead>
                  <TableHead
                    className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden xl:table-cell"
                    style={{ color: 'var(--ink-gray-5)' }}
                  >
                    Modificado
                  </TableHead>
                  <TableHead className="py-2 pr-4 w-10" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {listQuery.isLoading ? (
                  <ListSkeleton />
                ) : listQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-20 text-center">
                      <p className="text-sm mb-2" style={{ color: 'var(--ink-gray-5)' }}>
                        Erro ao carregar tarefas.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() =>
                          queryClient.invalidateQueries({ queryKey: crmKeys.tasks() })
                        }
                        style={{ color: 'var(--ink-blue-3)' }}
                      >
                        Tentar novamente
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-20 text-center">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                        style={{ backgroundColor: 'var(--surface-gray-2)' }}
                      >
                        <CheckSquare className="w-5 h-5" style={{ color: 'var(--ink-gray-4)' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-8)' }}>
                        Sem tarefas
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--ink-gray-5)' }}>
                        {debouncedSearch || filterStatus || filterPriority
                          ? 'Nenhuma tarefa corresponde aos filtros'
                          : 'Crie a primeira tarefa'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => {
                    const statusCfg = getStatusConfig(task.status)
                    const priorityCfg = getPriorityConfig(task.priority)
                    const overdue = isOverdue(task)

                    return (
                      <TableRow
                        key={task.id}
                        className="border-b cursor-pointer transition-colors"
                        style={{ borderColor: 'var(--outline-gray-1)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = ''
                        }}
                        onClick={() => setEditingTask(task)}
                      >
                        {/* title */}
                        <TableCell className="py-2.5 pl-4">
                          <div className="flex items-center gap-2">
                            <TaskStatusIcon status={task.status} />
                            <span
                              className={cn(
                                'text-sm font-medium truncate max-w-[280px]',
                                task.status === 'Done' && 'line-through'
                              )}
                              style={{
                                color:
                                  task.status === 'Done' || task.status === 'Canceled'
                                    ? 'var(--ink-gray-5)'
                                    : 'var(--ink-gray-8)',
                              }}
                            >
                              {task.title}
                            </span>
                            {task.reference_docname && (
                              <Link2
                                className="w-3 h-3 flex-shrink-0"
                                style={{ color: 'var(--ink-gray-4)' }}
                              />
                            )}
                          </div>
                        </TableCell>

                        {/* status */}
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: statusCfg.color }}
                            />
                            <span className="text-xs" style={{ color: 'var(--ink-gray-6)' }}>
                              {statusCfg.label}
                            </span>
                          </div>
                        </TableCell>

                        {/* priority */}
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <TaskPriorityIcon priority={task.priority} />
                            <span className="text-xs" style={{ color: priorityCfg.color }}>
                              {priorityCfg.label}
                            </span>
                          </div>
                        </TableCell>

                        {/* assigned_to */}
                        <TableCell className="py-2.5 hidden md:table-cell">
                          {task.assigned_to ? (
                            (() => {
                              const palette = getAvatarPalette(task.assigned_to.id)
                              return (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                                    style={{ backgroundColor: palette.bg, color: palette.text }}
                                    title={task.assigned_to.name}
                                  >
                                    {getInitials(task.assigned_to.name)}
                                  </div>
                                  <span
                                    className="text-xs truncate max-w-[100px]"
                                    style={{ color: 'var(--ink-gray-6)' }}
                                  >
                                    {task.assigned_to.name}
                                  </span>
                                </div>
                              )
                            })()
                          ) : (
                            <span className="text-sm" style={{ color: 'var(--ink-gray-4)' }}>
                              —
                            </span>
                          )}
                        </TableCell>

                        {/* due_date */}
                        <TableCell className="py-2.5 hidden lg:table-cell">
                          {task.due_date ? (
                            <span
                              className="text-xs"
                              style={{ color: overdue ? 'var(--ink-red-3)' : 'var(--ink-gray-5)' }}
                              title={format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            >
                              {overdue ? (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {formatDueDate(task.due_date)}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDueDate(task.due_date)}
                                </span>
                              )}
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
                            className="text-xs"
                            style={{ color: 'var(--ink-gray-5)' }}
                            title={format(new Date(task.updated_at), "dd/MM/yyyy 'as' HH:mm", {
                              locale: ptBR,
                            })}
                          >
                            {formatDistanceToNow(new Date(task.updated_at), {
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
                                onClick={() => setDeletingTask(task)}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-2.5 border-t flex-shrink-0"
              style={{
                borderColor: 'var(--outline-gray-1)',
                backgroundColor: 'var(--surface-gray-1)',
              }}
            >
              <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de{' '}
                {totalCount}
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
        </div>
      )}

      {/* ---- KANBAN VIEW ---- */}
      {view === 'kanban' && (
        <div className="flex-1 overflow-auto">
          {kanbanQuery.isLoading ? (
            <KanbanSkeleton />
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-6 px-5 pt-5 min-h-full">
              {TASK_STATUSES.map((status) => (
                <KanbanCol
                  key={status.value}
                  status={status}
                  tasks={tasksByStatus[status.value] ?? []}
                  onEdit={setEditingTask}
                  onDelete={setDeletingTask}
                  onStatusChange={handleStatusChange}
                  onAdd={handleCreateInColumn}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
              Nova Tarefa
            </DialogTitle>
          </DialogHeader>
          <TaskForm
            initialData={{ status: createInitialStatus }}
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isPending}
            submitLabel="Criar Tarefa"
          />
        </DialogContent>
      </Dialog>

      {/* ---- Edit Dialog ---- */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent
          className="max-w-lg rounded-xl border shadow-lg"
          style={{
            backgroundColor: 'var(--surface-white)',
            borderColor: 'var(--outline-gray-2)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
              Editar Tarefa
            </DialogTitle>
          </DialogHeader>
          {editingTask && (
            <TaskForm
              initialData={{
                title: editingTask.title,
                priority: editingTask.priority,
                status: editingTask.status,
                due_date: editingTask.due_date ?? undefined,
                assigned_to_id: editingTask.assigned_to?.id,
              }}
              onSubmit={(data) =>
                updateMutation.mutate({ id: editingTask.id, data: data as UpdateTaskData })
              }
              onCancel={() => setEditingTask(null)}
              isLoading={updateMutation.isPending}
              submitLabel="Salvar"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirm ---- */}
      <AlertDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
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
              Remover tarefa
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
              Tem certeza que deseja remover{' '}
              <strong style={{ color: 'var(--ink-gray-8)' }}>{deletingTask?.title}</strong>? Esta
              acao nao pode ser desfeita.
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
              onClick={() => deletingTask && deleteMutation.mutate(deletingTask.id)}
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
