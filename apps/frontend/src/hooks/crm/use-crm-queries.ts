/**
 * CRM TanStack Query hooks — centralizes query keys and common patterns.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '@/services/crm/api'
import type {
  CrmDoctype,
  CrmListParams,
  CrmKanbanParams,
  UpdateLeadData,
  UpdateDealData,
  MarkDealLostData,
} from '@/types/crm'
import { toast } from 'sonner'

// ============================================
// QUERY KEYS
// ============================================

export const crmKeys = {
  all: ['crm'] as const,

  // Leads
  leads: () => [...crmKeys.all, 'leads'] as const,
  leadList: (params?: CrmListParams) => [...crmKeys.leads(), 'list', params] as const,
  leadKanban: (params?: CrmKanbanParams) => [...crmKeys.leads(), 'kanban', params] as const,
  leadDetail: (id: string) => [...crmKeys.leads(), id] as const,

  // Deals
  deals: () => [...crmKeys.all, 'deals'] as const,
  dealList: (params?: CrmListParams) => [...crmKeys.deals(), 'list', params] as const,
  dealKanban: (params?: CrmKanbanParams) => [...crmKeys.deals(), 'kanban', params] as const,
  dealDetail: (id: string) => [...crmKeys.deals(), id] as const,

  // Contacts
  contacts: () => [...crmKeys.all, 'contacts'] as const,
  contactList: (params?: CrmListParams) => [...crmKeys.contacts(), 'list', params] as const,
  contactDetail: (id: string) => [...crmKeys.contacts(), id] as const,

  // Organizations
  organizations: () => [...crmKeys.all, 'organizations'] as const,
  organizationList: (params?: CrmListParams) => [...crmKeys.organizations(), 'list', params] as const,
  organizationDetail: (id: string) => [...crmKeys.organizations(), id] as const,

  // Tasks
  tasks: () => [...crmKeys.all, 'tasks'] as const,
  taskList: (params?: CrmListParams) => [...crmKeys.tasks(), 'list', params] as const,

  // Notes
  notes: () => [...crmKeys.all, 'notes'] as const,
  noteList: (params?: CrmListParams) => [...crmKeys.notes(), 'list', params] as const,

  // Call Logs
  callLogs: () => [...crmKeys.all, 'call-logs'] as const,
  callLogList: (params?: CrmListParams) => [...crmKeys.callLogs(), 'list', params] as const,

  // Activities (per entity)
  activities: (doctype: CrmDoctype, docname: string) =>
    [...crmKeys.all, 'activities', doctype, docname] as const,

  // Comments (per entity)
  comments: (doctype: CrmDoctype, docname: string) =>
    [...crmKeys.all, 'comments', doctype, docname] as const,

  // Notifications
  notifications: () => [...crmKeys.all, 'notifications'] as const,
  notificationCount: () => [...crmKeys.notifications(), 'count'] as const,

  // Settings / Lookups
  leadStatuses: () => [...crmKeys.all, 'settings', 'lead-statuses'] as const,
  dealStatuses: () => [...crmKeys.all, 'settings', 'deal-statuses'] as const,
  sources: () => [...crmKeys.all, 'settings', 'sources'] as const,
  industries: () => [...crmKeys.all, 'settings', 'industries'] as const,
  territories: () => [...crmKeys.all, 'settings', 'territories'] as const,
  lostReasons: () => [...crmKeys.all, 'settings', 'lost-reasons'] as const,
  products: () => [...crmKeys.all, 'settings', 'products'] as const,
} as const

// ============================================
// LOOKUP HOOKS (reused across pages)
// ============================================

export function useLeadStatuses() {
  return useQuery({
    queryKey: crmKeys.leadStatuses(),
    queryFn: () => crmApi.settings.statuses.listLead(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

export function useDealStatuses() {
  return useQuery({
    queryKey: crmKeys.dealStatuses(),
    queryFn: () => crmApi.settings.statuses.listDeal(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSources() {
  return useQuery({
    queryKey: crmKeys.sources(),
    queryFn: () => crmApi.settings.lookups.sources(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useIndustries() {
  return useQuery({
    queryKey: crmKeys.industries(),
    queryFn: () => crmApi.settings.lookups.industries(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTerritories() {
  return useQuery({
    queryKey: crmKeys.territories(),
    queryFn: () => crmApi.settings.lookups.territories(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLostReasons() {
  return useQuery({
    queryKey: crmKeys.lostReasons(),
    queryFn: () => crmApi.settings.lookups.lostReasons(),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })
}

// ============================================
// LEAD HOOKS
// ============================================

export function useLeadDetail(id: string) {
  return useQuery({
    queryKey: crmKeys.leadDetail(id),
    queryFn: () => crmApi.leads.get(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeadData }) =>
      crmApi.leads.update(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: crmKeys.leadDetail(id) })
      qc.invalidateQueries({ queryKey: crmKeys.leads() })
      toast.success('Lead atualizado')
    },
    onError: () => toast.error('Erro ao atualizar lead'),
  })
}

export function useConvertLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crmApi.leads.convert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.leads() })
      qc.invalidateQueries({ queryKey: crmKeys.deals() })
      toast.success('Lead convertido em negociacao')
    },
    onError: () => toast.error('Erro ao converter lead'),
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crmApi.leads.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.leads() })
      toast.success('Lead removido')
    },
    onError: () => toast.error('Erro ao remover lead'),
  })
}

// ============================================
// DEAL HOOKS
// ============================================

export function useDealDetail(id: string) {
  return useQuery({
    queryKey: crmKeys.dealDetail(id),
    queryFn: () => crmApi.deals.get(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useUpdateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealData }) =>
      crmApi.deals.update(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: crmKeys.dealDetail(id) })
      qc.invalidateQueries({ queryKey: crmKeys.deals() })
      toast.success('Negociacao atualizada')
    },
    onError: () => toast.error('Erro ao atualizar negociacao'),
  })
}

export function useMarkDealWon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crmApi.deals.markWon(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.deals() })
      toast.success('Negociacao marcada como ganha!')
    },
    onError: () => toast.error('Erro ao marcar como ganha'),
  })
}

export function useMarkDealLost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: MarkDealLostData }) =>
      crmApi.deals.markLost(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.deals() })
      toast.success('Negociacao marcada como perdida')
    },
    onError: () => toast.error('Erro ao marcar como perdida'),
  })
}

export function useDeleteDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crmApi.deals.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.deals() })
      toast.success('Negociacao removida')
    },
    onError: () => toast.error('Erro ao remover negociacao'),
  })
}

// ============================================
// ACTIVITIES & COMMENTS
// ============================================

export function useActivities(doctype: CrmDoctype, docname: string) {
  return useQuery({
    queryKey: crmKeys.activities(doctype, docname),
    queryFn: () => crmApi.activities.list(doctype, docname),
    select: (res) => res.data,
    enabled: !!docname,
  })
}

export function useComments(doctype: CrmDoctype, docname: string) {
  return useQuery({
    queryKey: crmKeys.comments(doctype, docname),
    queryFn: () => crmApi.comments.list(doctype, docname),
    select: (res) => res.data,
    enabled: !!docname,
  })
}

export function useCreateComment(doctype: CrmDoctype, docname: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => crmApi.comments.create(doctype, docname, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crmKeys.comments(doctype, docname) })
      qc.invalidateQueries({ queryKey: crmKeys.activities(doctype, docname) })
      toast.success('Comentario adicionado')
    },
    onError: () => toast.error('Erro ao adicionar comentario'),
  })
}

// ============================================
// NOTIFICATIONS
// ============================================

export function useNotificationCount() {
  return useQuery({
    queryKey: crmKeys.notificationCount(),
    queryFn: () => crmApi.notifications.unreadCount(),
    select: (res) => res.data.count,
    refetchInterval: 60_000,
  })
}
