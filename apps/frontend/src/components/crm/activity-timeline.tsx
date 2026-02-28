'use client'

// Usage:
// <ActivityTimeline doctype="Lead" docname="LEAD-0001" />
// <ActivityTimeline doctype="Deal" docname="DEAL-0001" />
// Renders a unified activity feed with comment authoring capability.
// Espresso Design System — light theme, clean

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import { getInitials } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  Phone,
  ListTodo,
  Mail,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Send,
  X,
  Activity,
  MessagesSquare,
} from 'lucide-react'
import type { ActivityType, CrmDoctype, Activity as ActivityT, Comment } from '@/types/crm'

// ============================================
// ACTIVITY TYPE CONFIG — Espresso colors
// ============================================

interface ActivityConfig {
  icon: React.ElementType
  color: string
  bg: string
  border: string
  label: string
}

const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  note: {
    icon: FileText,
    color: 'var(--ink-blue-3)',
    bg: 'var(--surface-blue-2)',
    border: 'var(--ink-blue-3)',
    label: 'Nota',
  },
  call: {
    icon: Phone,
    color: 'var(--ink-green-3)',
    bg: 'var(--surface-green-2)',
    border: 'var(--ink-green-3)',
    label: 'Chamada',
  },
  task: {
    icon: ListTodo,
    color: '#6846E3',
    bg: '#F3F0FF',
    border: '#6846E3',
    label: 'Tarefa',
  },
  email: {
    icon: Mail,
    color: 'var(--ink-amber-3)',
    bg: 'var(--surface-amber-2)',
    border: 'var(--ink-amber-3)',
    label: 'Email',
  },
  whatsapp: {
    icon: MessagesSquare,
    color: 'var(--ink-green-3)',
    bg: 'var(--surface-green-2)',
    border: 'var(--ink-green-3)',
    label: 'WhatsApp',
  },
  status_change: {
    icon: ArrowRight,
    color: '#E79913',
    bg: '#FFF7D3',
    border: '#E79913',
    label: 'Mudança de status',
  },
  assignment: {
    icon: Activity,
    color: '#3BBDE5',
    bg: '#E6F4FF',
    border: '#3BBDE5',
    label: 'Atribuição',
  },
  comment: {
    icon: MessageSquare,
    color: 'var(--ink-gray-5)',
    bg: 'var(--surface-gray-2)',
    border: 'var(--outline-gray-2)',
    label: 'Comentário',
  },
}

// ============================================
// TIMELINE ITEM SKELETON
// ============================================

function TimelineItemSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-48" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
        <Skeleton className="h-3 w-full" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
        <Skeleton className="h-3 w-2/3" style={{ backgroundColor: 'var(--surface-gray-2)' }} />
      </div>
    </div>
  )
}

// ============================================
// ACTIVITY ITEM
// ============================================

interface ActivityItemProps {
  activity: ActivityT
  isLast: boolean
}

function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const [expanded, setExpanded] = useState(false)
  const config = ACTIVITY_CONFIG[activity.type] ?? ACTIVITY_CONFIG.comment
  const Icon = config.icon

  const hasLongContent = activity.content && activity.content.length > 200
  const displayContent =
    hasLongContent && !expanded
      ? activity.content!.slice(0, 200) + '...'
      : activity.content

  const relativeTime = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
    locale: ptBR,
  })

  const fullTime = format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  })

  return (
    <div className="flex gap-3 group">
      {/* Timeline connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: config.bg,
            border: `1px solid ${config.border}`,
          }}
          aria-hidden="true"
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        {!isLast && (
          <div
            className="w-px flex-1 mt-1 min-h-[24px]"
            style={{ backgroundColor: 'var(--outline-gray-1)' }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Author avatar */}
            {activity.created_by && (
              <Avatar className="w-5 h-5 flex-shrink-0">
                <AvatarImage
                  src={activity.created_by.avatar_url ?? undefined}
                  alt={activity.created_by.name}
                />
                <AvatarFallback
                  className="text-[9px]"
                  style={{ backgroundColor: 'var(--surface-blue-2)', color: 'var(--ink-blue-3)' }}
                >
                  {getInitials(activity.created_by.name)}
                </AvatarFallback>
              </Avatar>
            )}
            <span className="text-sm font-medium" style={{ color: 'var(--ink-gray-9)' }}>
              {activity.title}
            </span>
          </div>
          <time
            dateTime={activity.created_at}
            title={fullTime}
            className="text-xs flex-shrink-0 whitespace-nowrap"
            style={{ color: 'var(--ink-gray-4)' }}
          >
            {relativeTime}
          </time>
        </div>

        {/* Author name */}
        {activity.created_by && (
          <p className="text-xs mt-0.5 ml-7" style={{ color: 'var(--ink-gray-5)' }}>
            {activity.created_by.name}
          </p>
        )}

        {/* Content */}
        {displayContent && (
          <div className="mt-2 ml-7">
            <p
              className="text-sm whitespace-pre-wrap break-words leading-relaxed"
              style={{ color: 'var(--ink-gray-8)' }}
            >
              {displayContent}
            </p>
            {hasLongContent && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 flex items-center gap-1 text-xs transition-colors"
                style={{ color: 'var(--ink-blue-3)' }}
                aria-expanded={expanded}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Ver menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Ver mais
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// COMMENT ITEM (editable)
// ============================================

interface CommentItemProps {
  comment: Comment
  currentUserId?: string
  onEdit: (id: string, content: string) => void
  onDelete: (id: string) => void
  isDeleting: boolean
}

function CommentItem({
  comment,
  currentUserId,
  onEdit,
  onDelete,
  isDeleting,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)
  const isAuthor = currentUserId && comment.created_by?.id === currentUserId

  const relativeTime = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: ptBR,
  })

  const handleSaveEdit = () => {
    if (!editContent.trim()) return
    onEdit(comment.id, editContent)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(comment.content)
    setIsEditing(false)
  }

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--surface-gray-2)',
            border: '1px solid var(--outline-gray-2)',
          }}
        >
          <MessageSquare className="w-4 h-4" style={{ color: 'var(--ink-gray-5)' }} />
        </div>
      </div>

      <div className="flex-1 pb-4 min-w-0">
        <div
          className="rounded-lg p-3"
          style={{
            backgroundColor: 'var(--surface-gray-1)',
            border: '1px solid var(--outline-gray-1)',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Avatar className="w-5 h-5 flex-shrink-0">
                <AvatarImage
                  src={comment.created_by?.avatar_url ?? undefined}
                  alt={comment.created_by?.name ?? 'Usuário'}
                />
                <AvatarFallback
                  className="text-[9px]"
                  style={{ backgroundColor: 'var(--surface-blue-2)', color: 'var(--ink-blue-3)' }}
                >
                  {getInitials(comment.created_by?.name ?? 'U')}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium" style={{ color: 'var(--ink-gray-9)' }}>
                {comment.created_by?.name ?? 'Usuário'}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
                {relativeTime}
              </span>
            </div>

            {isAuthor && !isEditing && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--ink-gray-5)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-8)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-5)')}
                  aria-label="Editar comentário"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(comment.id)}
                  disabled={isDeleting}
                  className="p-1 rounded transition-colors disabled:opacity-50"
                  style={{ color: 'var(--ink-gray-5)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-red-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-5)')}
                  aria-label="Excluir comentário"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="text-sm min-h-[80px] resize-none"
                style={{
                  backgroundColor: 'var(--surface-white)',
                  border: '1px solid var(--outline-gray-2)',
                  color: 'var(--ink-gray-8)',
                }}
                aria-label="Editar comentário"
              />
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7 text-xs"
                  style={{ color: 'var(--ink-gray-5)' }}
                >
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim()}
                  className="h-7 text-xs"
                  style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff', borderRadius: '8px' }}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm whitespace-pre-wrap break-words leading-relaxed"
              style={{ color: 'var(--ink-gray-8)' }}
            >
              {comment.content}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// ADD COMMENT FORM
// ============================================

interface AddCommentFormProps {
  doctype: CrmDoctype
  docname: string
  onSuccess: () => void
}

function AddCommentForm({ doctype, docname, onSuccess }: AddCommentFormProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mutation = useMutation({
    mutationFn: () => crmApi.comments.create(doctype, docname, content),
    onSuccess: () => {
      setContent('')
      toast.success('Comentário adicionado')
      onSuccess()
    },
    onError: () => {
      toast.error('Erro ao adicionar comentário')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    mutation.mutate()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-3 mb-6"
      aria-label="Adicionar comentário"
    >
      <div className="flex-1 space-y-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escrever um comentário... (Ctrl+Enter para enviar)"
          className="text-sm min-h-[80px] resize-none rounded-lg"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-2)',
            color: 'var(--ink-gray-8)',
          }}
          aria-label="Conteúdo do comentário"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
            Ctrl+Enter para enviar
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || mutation.isPending}
            className="h-8 text-xs"
            style={{ backgroundColor: 'var(--surface-gray-7)', color: '#fff', borderRadius: '8px' }}
          >
            {mutation.isPending ? (
              <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <Send className="w-3 h-3 mr-1.5" />
            )}
            Comentar
          </Button>
        </div>
      </div>
    </form>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ActivityTimelineProps {
  doctype: CrmDoctype
  docname: string
  currentUserId?: string
}

export function ActivityTimeline({
  doctype,
  docname,
  currentUserId,
}: ActivityTimelineProps) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  // Fetch activities
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    isError: activitiesError,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: ['crm-activities', doctype, docname, page],
    queryFn: () =>
      crmApi.activities.list(doctype, docname, {
        page,
        page_size: PAGE_SIZE,
        order_by: 'created_at',
        order_direction: 'desc',
      }),
    select: (res) => res.data,
  })

  // Fetch comments
  const {
    data: commentsData,
    isLoading: commentsLoading,
    refetch: _refetchComments,
  } = useQuery({
    queryKey: ['crm-comments', doctype, docname],
    queryFn: () => crmApi.comments.list(doctype, docname),
    select: (res) => res.data,
  })

  // Edit comment mutation
  const editCommentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      crmApi.comments.update(id, content),
    onSuccess: () => {
      toast.success('Comentário atualizado')
      queryClient.invalidateQueries({ queryKey: ['crm-comments', doctype, docname] })
    },
    onError: () => {
      toast.error('Erro ao atualizar comentário')
    },
  })

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => crmApi.comments.delete(id),
    onSuccess: () => {
      toast.success('Comentário excluído')
      queryClient.invalidateQueries({ queryKey: ['crm-comments', doctype, docname] })
    },
    onError: () => {
      toast.error('Erro ao excluir comentário')
    },
  })

  const handleCommentAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['crm-comments', doctype, docname] })
  }

  const activities = activitiesData?.data ?? []
  const comments = commentsData?.data ?? []
  const totalActivities = activitiesData?.total_count ?? 0
  const hasMore = page * PAGE_SIZE < totalActivities

  const isLoading = activitiesLoading || commentsLoading

  if (activitiesError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
          Erro ao carregar atividades
        </p>
        <button
          onClick={() => refetchActivities()}
          className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors"
          style={{ color: 'var(--ink-blue-3)' }}
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-0" role="feed" aria-label="Timeline de atividades">
      {/* Add comment form */}
      <AddCommentForm
        doctype={doctype}
        docname={docname}
        onSuccess={handleCommentAdded}
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <TimelineItemSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activities.length === 0 && comments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--surface-gray-2)',
              border: '1px solid var(--outline-gray-1)',
            }}
          >
            <Activity className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-5)' }}>
            Nenhuma atividade ainda
          </p>
          <p className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
            As atividades aparecerão aqui conforme o registro for atualizado
          </p>
        </div>
      )}

      {/* Comments at top */}
      {!isLoading &&
        comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            onEdit={(id, content) => editCommentMutation.mutate({ id, content })}
            onDelete={(id) => deleteCommentMutation.mutate(id)}
            isDeleting={deleteCommentMutation.isPending}
          />
        ))}

      {/* Activities */}
      {!isLoading &&
        activities.map((activity, index) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isLast={index === activities.length - 1 && !hasMore}
          />
        ))}

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors"
            style={{ color: 'var(--ink-gray-5)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-gray-8)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-gray-5)')}
          >
            <ChevronDown className="w-4 h-4" />
            Carregar mais atividades
          </button>
        </div>
      )}
    </div>
  )
}
