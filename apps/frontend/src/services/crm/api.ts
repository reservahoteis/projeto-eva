// ============================================
// CRM API Client
// All CRM endpoints pointed at crm-core service
// ============================================

import api from '@/lib/axios'
import type {
  Lead,
  LeadListItem,
  Deal,
  DealListItem,
  CrmContact,
  Organization,
  Task,
  Note,
  CallLog,
  Activity,
  Comment,
  Notification,
  ViewSettings,
  LeadStatus,
  DealStatus,
  LeadSource,
  Industry,
  Territory,
  LostReason,
  Product,
  CrmPaginatedResponse,
  KanbanResponse,
  GroupByResponse,
  CrmListParams,
  CrmKanbanParams,
  CrmGroupByParams,
  CreateLeadData,
  UpdateLeadData,
  CreateDealData,
  UpdateDealData,
  CreateContactData,
  UpdateContactData,
  CreateOrganizationData,
  UpdateOrganizationData,
  CreateTaskData,
  UpdateTaskData,
  CreateNoteData,
  UpdateNoteData,
  CreateCallLogData,
  UpdateCallLogData,
  MarkDealLostData,
  ReorderStatusData,
  CrmDoctype,
} from '@/types/crm'

// Base path for all CRM API calls
// This points to the crm-core microservice via the main API gateway
const CRM = '/api/v1' as const

// ============================================
// LEADS
// ============================================

const leads = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<LeadListItem>>(`${CRM}/leads`, { params }),

  kanban: (params?: CrmKanbanParams) =>
    api.get<KanbanResponse<LeadListItem>>(`${CRM}/leads`, {
      params: { ...params, view_type: 'kanban', column_field: 'status_id' },
    }),

  groupBy: (params: CrmGroupByParams) =>
    api.get<GroupByResponse<LeadListItem>>(`${CRM}/leads`, {
      params: { ...params, view_type: 'group_by' },
    }),

  get: (id: string) =>
    api.get<Lead>(`${CRM}/leads/${id}`),

  create: (data: CreateLeadData) =>
    api.post<Lead>(`${CRM}/leads`, data),

  update: (id: string, data: UpdateLeadData) =>
    api.put<Lead>(`${CRM}/leads/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/leads/${id}`),

  convert: (id: string) =>
    api.post<{ deal_id: string; contact_id: string }>(`${CRM}/leads/${id}/convert`),

  assign: (id: string, userId: string) =>
    api.post(`${CRM}/leads/${id}/assign`, { user_id: userId }),

  unassign: (id: string, userId: string) =>
    api.delete(`${CRM}/leads/${id}/assign`, { data: { user_id: userId } }),

  bulkDelete: (ids: string[]) =>
    api.post(`${CRM}/leads/bulk-delete`, { ids }),

  bulkAssign: (ids: string[], userId: string) =>
    api.post(`${CRM}/leads/bulk-assign`, { ids, user_id: userId }),
}

// ============================================
// DEALS
// ============================================

const deals = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<DealListItem>>(`${CRM}/deals`, { params }),

  kanban: (params?: CrmKanbanParams) =>
    api.get<KanbanResponse<DealListItem>>(`${CRM}/deals`, {
      params: { ...params, view_type: 'kanban', column_field: 'status_id' },
    }),

  groupBy: (params: CrmGroupByParams) =>
    api.get<GroupByResponse<DealListItem>>(`${CRM}/deals`, {
      params: { ...params, view_type: 'group_by' },
    }),

  get: (id: string) =>
    api.get<Deal>(`${CRM}/deals/${id}`),

  create: (data: CreateDealData) =>
    api.post<Deal>(`${CRM}/deals`, data),

  update: (id: string, data: UpdateDealData) =>
    api.put<Deal>(`${CRM}/deals/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/deals/${id}`),

  markWon: (id: string) =>
    api.post(`${CRM}/deals/${id}/mark-won`),

  markLost: (id: string, data?: MarkDealLostData) =>
    api.post(`${CRM}/deals/${id}/mark-lost`, data),

  assign: (id: string, userId: string) =>
    api.post(`${CRM}/deals/${id}/assign`, { user_id: userId }),

  unassign: (id: string, userId: string) =>
    api.delete(`${CRM}/deals/${id}/assign`, { data: { user_id: userId } }),

  bulkDelete: (ids: string[]) =>
    api.post(`${CRM}/deals/bulk-delete`, { ids }),

  bulkAssign: (ids: string[], userId: string) =>
    api.post(`${CRM}/deals/bulk-assign`, { ids, user_id: userId }),
}

// ============================================
// CONTACTS (CRM contacts - distinct from WhatsApp contacts)
// ============================================

const contacts = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<CrmContact>>(`${CRM}/contacts`, { params }),

  groupBy: (params: CrmGroupByParams) =>
    api.get<GroupByResponse<CrmContact>>(`${CRM}/contacts`, {
      params: { ...params, view_type: 'group_by' },
    }),

  get: (id: string) =>
    api.get<CrmContact>(`${CRM}/contacts/${id}`),

  create: (data: CreateContactData) =>
    api.post<CrmContact>(`${CRM}/contacts`, data),

  update: (id: string, data: UpdateContactData) =>
    api.put<CrmContact>(`${CRM}/contacts/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/contacts/${id}`),

  deals: (id: string, params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<DealListItem>>(`${CRM}/contacts/${id}/deals`, { params }),

  bulkDelete: (ids: string[]) =>
    api.post(`${CRM}/contacts/bulk-delete`, { ids }),
}

// ============================================
// ORGANIZATIONS
// ============================================

const organizations = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<Organization>>(`${CRM}/organizations`, { params }),

  groupBy: (params: CrmGroupByParams) =>
    api.get<GroupByResponse<Organization>>(`${CRM}/organizations`, {
      params: { ...params, view_type: 'group_by' },
    }),

  get: (id: string) =>
    api.get<Organization>(`${CRM}/organizations/${id}`),

  create: (data: CreateOrganizationData) =>
    api.post<Organization>(`${CRM}/organizations`, data),

  update: (id: string, data: UpdateOrganizationData) =>
    api.put<Organization>(`${CRM}/organizations/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/organizations/${id}`),

  deals: (id: string, params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<DealListItem>>(`${CRM}/organizations/${id}/deals`, { params }),

  contacts: (id: string, params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<CrmContact>>(`${CRM}/organizations/${id}/contacts`, { params }),

  bulkDelete: (ids: string[]) =>
    api.post(`${CRM}/organizations/bulk-delete`, { ids }),
}

// ============================================
// TASKS
// ============================================

const tasks = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<Task>>(`${CRM}/tasks`, { params }),

  get: (id: string) =>
    api.get<Task>(`${CRM}/tasks/${id}`),

  create: (data: CreateTaskData) =>
    api.post<Task>(`${CRM}/tasks`, data),

  update: (id: string, data: UpdateTaskData) =>
    api.put<Task>(`${CRM}/tasks/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/tasks/${id}`),

  bulkDelete: (ids: string[]) =>
    api.post(`${CRM}/tasks/bulk-delete`, { ids }),
}

// ============================================
// NOTES
// ============================================

const notes = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<Note>>(`${CRM}/notes`, { params }),

  get: (id: string) =>
    api.get<Note>(`${CRM}/notes/${id}`),

  create: (data: CreateNoteData) =>
    api.post<Note>(`${CRM}/notes`, data),

  update: (id: string, data: UpdateNoteData) =>
    api.put<Note>(`${CRM}/notes/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/notes/${id}`),

  bulkDelete: (ids: string[]) =>
    api.post(`${CRM}/notes/bulk-delete`, { ids }),
}

// ============================================
// CALL LOGS
// ============================================

const callLogs = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<CallLog>>(`${CRM}/call-logs`, { params }),

  get: (id: string) =>
    api.get<CallLog>(`${CRM}/call-logs/${id}`),

  create: (data: CreateCallLogData) =>
    api.post<CallLog>(`${CRM}/call-logs`, data),

  update: (id: string, data: UpdateCallLogData) =>
    api.put<CallLog>(`${CRM}/call-logs/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/call-logs/${id}`),
}

// ============================================
// ACTIVITIES (read-only timeline)
// ============================================

const activities = {
  list: (doctype: CrmDoctype, docname: string, params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<Activity>>(`${CRM}/activities`, {
      params: { reference_doctype: doctype, reference_docname: docname, ...params },
    }),
}

// ============================================
// COMMENTS
// ============================================

const comments = {
  list: (doctype: CrmDoctype, docname: string, params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<Comment>>(`${CRM}/comments`, {
      params: { reference_doctype: doctype, reference_docname: docname, ...params },
    }),

  create: (doctype: CrmDoctype, docname: string, content: string) =>
    api.post<Comment>(`${CRM}/comments`, {
      reference_doctype: doctype,
      reference_docname: docname,
      content,
    }),

  update: (id: string, content: string) =>
    api.put<Comment>(`${CRM}/comments/${id}`, { content }),

  delete: (id: string) =>
    api.delete(`${CRM}/comments/${id}`),
}

// ============================================
// NOTIFICATIONS
// ============================================

const notifications = {
  list: (params?: CrmListParams) =>
    api.get<CrmPaginatedResponse<Notification>>(`${CRM}/notifications`, { params }),

  unreadCount: () =>
    api.get<{ count: number }>(`${CRM}/notifications/unread-count`),

  markRead: (id: string) =>
    api.put(`${CRM}/notifications/${id}/read`),

  markAllRead: () =>
    api.put(`${CRM}/notifications/mark-all-read`),
}

// ============================================
// VIEWS
// ============================================

const views = {
  list: (doctype: CrmDoctype) =>
    api.get<ViewSettings[]>(`${CRM}/views`, { params: { doctype } }),

  create: (data: Partial<ViewSettings>) =>
    api.post<ViewSettings>(`${CRM}/views`, data),

  update: (id: string, data: Partial<ViewSettings>) =>
    api.put<ViewSettings>(`${CRM}/views/${id}`, data),

  delete: (id: string) =>
    api.delete(`${CRM}/views/${id}`),
}

// ============================================
// SETTINGS - Statuses, Lookups, Products
// ============================================

const settings = {
  statuses: {
    listLead: () =>
      api.get<LeadStatus[]>(`${CRM}/settings/statuses/lead`),

    listDeal: () =>
      api.get<DealStatus[]>(`${CRM}/settings/statuses/deal`),

    createLead: (data: Partial<LeadStatus>) =>
      api.post<LeadStatus>(`${CRM}/settings/statuses/lead`, data),

    createDeal: (data: Partial<DealStatus>) =>
      api.post<DealStatus>(`${CRM}/settings/statuses/deal`, data),

    updateLead: (id: string, data: Partial<LeadStatus>) =>
      api.put<LeadStatus>(`${CRM}/settings/statuses/lead/${id}`, data),

    updateDeal: (id: string, data: Partial<DealStatus>) =>
      api.put<DealStatus>(`${CRM}/settings/statuses/deal/${id}`, data),

    deleteLead: (id: string) =>
      api.delete(`${CRM}/settings/statuses/lead/${id}`),

    deleteDeal: (id: string) =>
      api.delete(`${CRM}/settings/statuses/deal/${id}`),

    reorderLead: (data: ReorderStatusData) =>
      api.put(`${CRM}/settings/statuses/lead/reorder`, data),

    reorderDeal: (data: ReorderStatusData) =>
      api.put(`${CRM}/settings/statuses/deal/reorder`, data),
  },

  lookups: {
    sources: () =>
      api.get<LeadSource[]>(`${CRM}/settings/lookups/sources`),

    industries: () =>
      api.get<Industry[]>(`${CRM}/settings/lookups/industries`),

    territories: () =>
      api.get<Territory[]>(`${CRM}/settings/lookups/territories`),

    lostReasons: () =>
      api.get<LostReason[]>(`${CRM}/settings/lookups/lost-reasons`),

    createSource: (name: string) =>
      api.post<LeadSource>(`${CRM}/settings/lookups/sources`, { name }),

    createIndustry: (name: string) =>
      api.post<Industry>(`${CRM}/settings/lookups/industries`, { name }),

    createTerritory: (name: string, parent_id?: string) =>
      api.post<Territory>(`${CRM}/settings/lookups/territories`, { name, parent_id }),

    createLostReason: (name: string) =>
      api.post<LostReason>(`${CRM}/settings/lookups/lost-reasons`, { name }),

    deleteSource: (id: string) =>
      api.delete(`${CRM}/settings/lookups/sources/${id}`),

    deleteIndustry: (id: string) =>
      api.delete(`${CRM}/settings/lookups/industries/${id}`),

    deleteTerritory: (id: string) =>
      api.delete(`${CRM}/settings/lookups/territories/${id}`),

    deleteLostReason: (id: string) =>
      api.delete(`${CRM}/settings/lookups/lost-reasons/${id}`),
  },

  products: {
    list: (params?: CrmListParams) =>
      api.get<CrmPaginatedResponse<Product>>(`${CRM}/settings/products`, { params }),

    create: (data: Partial<Product>) =>
      api.post<Product>(`${CRM}/settings/products`, data),

    update: (id: string, data: Partial<Product>) =>
      api.put<Product>(`${CRM}/settings/products/${id}`, data),

    delete: (id: string) =>
      api.delete(`${CRM}/settings/products/${id}`),
  },
}

// ============================================
// USERS (CRM user management)
// ============================================

const users = {
  list: (params?: CrmListParams) =>
    api.get(`${CRM}/users`, { params }),

  get: (id: string) =>
    api.get(`${CRM}/users/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post(`${CRM}/users`, data),

  update: (id: string, data: Record<string, unknown>) =>
    api.put(`${CRM}/users/${id}`, data),

  deactivate: (id: string) =>
    api.put(`${CRM}/users/${id}/deactivate`),
}

// ============================================
// MAIN EXPORT
// ============================================

export const crmApi = {
  leads,
  deals,
  contacts,
  organizations,
  tasks,
  notes,
  callLogs,
  activities,
  comments,
  notifications,
  views,
  settings,
  users,
}

export default crmApi
