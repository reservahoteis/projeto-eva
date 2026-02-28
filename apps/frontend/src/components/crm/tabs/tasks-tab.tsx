'use client'

// Shared Tasks tab — parametrized by doctype/docname.
// Used in Lead, Deal, Contact, Organization detail pages.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, ListTodo, Check, RefreshCw, Clock } from 'lucide-react'
import type {
  Task,
  CrmDoctype,
  CreateTaskData,
  TaskPriority,
  TaskStatus,
} from '@/types/crm'

const PRIORITY_BADGE: Record<TaskPriority, { bg: string; color: string; label: string }> = {
  Low: { bg: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)', label: 'Baixa' },
  Medium: { bg: 'var(--surface-amber-2)', color: 'var(--ink-amber-3)', label: 'Media' },
  High: { bg: 'var(--surface-red-2)', color: 'var(--ink-red-3)', label: 'Alta' },
}

interface TasksTabProps {
  doctype: CrmDoctype
  docname: string
}

export function TasksTab({ doctype, docname }: TasksTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formPriority, setFormPriority] = useState<TaskPriority>('Medium')
  const [formDueDate, setFormDueDate] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['crm-tasks', doctype, docname],
    queryFn: () =>
      crmApi.tasks.list({
        filters: { reference_doctype: doctype, reference_docname: docname },
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
      queryClient.invalidateQueries({ queryKey: ['crm-tasks', doctype, docname] })
    },
    onError: () => toast.error('Erro ao criar tarefa'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      crmApi.tasks.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks', doctype, docname] })
    },
    onError: () => toast.error('Erro ao atualizar tarefa'),
  })

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
            border: 'none',
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
            placeholder="Titulo da tarefa"
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
                <SelectItem value="Medium">Media</SelectItem>
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
                  reference_doctype: doctype,
                  reference_docname: docname,
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
                border: 'none',
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
              cursor: 'pointer',
              padding: 0,
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
