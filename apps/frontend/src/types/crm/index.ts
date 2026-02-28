// ============================================
// CRM - TypeScript Types
// Matches crm-core backend schemas exactly
// ============================================

// ============================================
// ENUM / UNION TYPES
// ============================================

export type LeadStatusType = 'Open' | 'Ongoing' | 'OnHold' | 'Lost'
export type DealStatusType = 'Open' | 'Ongoing' | 'OnHold' | 'Won' | 'Lost'
export type TaskPriority = 'Low' | 'Medium' | 'High'
export type TaskStatus = 'Backlog' | 'Todo' | 'In Progress' | 'Done' | 'Canceled'
export type ViewType = 'list' | 'kanban' | 'group_by'
export type CrmDoctype =
  | 'Lead'
  | 'Deal'
  | 'Contact'
  | 'Organization'
  | 'Task'
  | 'Note'
  | 'CallLog'

export type CallLogType = 'Inbound' | 'Outbound'
export type CallLogStatus =
  | 'Completed'
  | 'No Answer'
  | 'Busy'
  | 'Failed'
  | 'Voicemail'

export type ActivityType =
  | 'note'
  | 'call'
  | 'task'
  | 'email'
  | 'whatsapp'
  | 'status_change'
  | 'assignment'
  | 'comment'

export type NotificationType =
  | 'assignment'
  | 'mention'
  | 'status_change'
  | 'task_due'
  | 'deal_won'
  | 'deal_lost'

// ============================================
// LOOKUP / REFERENCE TYPES
// ============================================

export interface LeadStatus {
  id: string
  label: string
  color: string
  status_type: LeadStatusType | null
  position: number
}

export interface DealStatus {
  id: string
  label: string
  color: string
  status_type: DealStatusType | null
  position: number
  probability: number | null
}

export interface LeadSource {
  id: string
  name: string
}

export interface Industry {
  id: string
  name: string
}

export interface Territory {
  id: string
  name: string
  parent_id: string | null
}

export interface LostReason {
  id: string
  name: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  unit_price: number | null
  currency: string
}

// ============================================
// EMBED TYPES (nested references)
// ============================================

export interface UserEmbed {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

export interface OrganizationEmbed {
  id: string
  organization_name: string
  logo_url: string | null
  website: string | null
}

// ============================================
// MAIN ENTITY TYPES
// ============================================

export interface Lead {
  id: string
  tenant_id: string
  naming_series: string
  first_name: string
  middle_name: string | null
  last_name: string | null
  lead_name: string
  email: string | null
  mobile_no: string | null
  phone: string | null
  website: string | null
  job_title: string | null
  organization_name: string | null
  image_url: string | null
  status: LeadStatus
  source: LeadSource | null
  industry: Industry | null
  territory: Territory | null
  lead_owner: UserEmbed | null
  organization: OrganizationEmbed | null
  no_of_employees: number | null
  annual_revenue: number | null
  currency: string
  converted: boolean
  sla_status: string | null
  created_at: string
  updated_at: string
}

/**
 * Lightweight Lead for list views — fewer fields for performance
 */
export interface LeadListItem {
  id: string
  naming_series: string
  lead_name: string
  first_name: string
  last_name: string | null
  email: string | null
  mobile_no: string | null
  organization_name: string | null
  status: LeadStatus
  source: LeadSource | null
  lead_owner: UserEmbed | null
  converted: boolean
  currency: string
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  tenant_id: string
  naming_series: string
  organization_name: string | null
  lead_name: string | null
  email: string | null
  mobile_no: string | null
  status: DealStatus
  deal_owner: UserEmbed | null
  deal_value: number | null
  probability: number | null
  expected_closure_date: string | null
  currency: string
  lost_reason: LostReason | null
  lost_detail: string | null
  created_at: string
  updated_at: string
}

export interface DealListItem {
  id: string
  naming_series: string
  organization_name: string | null
  lead_name: string | null
  email: string | null
  status: DealStatus
  deal_owner: UserEmbed | null
  deal_value: number | null
  probability: number | null
  expected_closure_date: string | null
  currency: string
  created_at: string
  updated_at: string
}

export interface CrmContact {
  id: string
  tenant_id: string
  salutation: string | null
  first_name: string
  last_name: string | null
  full_name: string
  email: string | null
  mobile_no: string | null
  phone: string | null
  company_name: string | null
  designation: string | null
  image_url: string | null
  industry: Industry | null
  territory: Territory | null
  organization: OrganizationEmbed | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  tenant_id: string
  organization_name: string
  logo_url: string | null
  website: string | null
  no_of_employees: number | null
  annual_revenue: number | null
  currency: string
  industry: Industry | null
  territory: Territory | null
  address: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  tenant_id: string
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_to: UserEmbed | null
  created_by: UserEmbed | null
  due_date: string | null
  reference_doctype: CrmDoctype | null
  reference_docname: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  tenant_id: string
  title: string
  content: string
  reference_doctype: CrmDoctype | null
  reference_docname: string | null
  created_by: UserEmbed | null
  created_at: string
  updated_at: string
}

export interface CallLog {
  id: string
  tenant_id: string
  caller: string | null
  receiver: string | null
  type: CallLogType
  status: CallLogStatus
  duration: number | null
  start_time: string | null
  end_time: string | null
  recording_url: string | null
  note: string | null
  telephony_medium: string | null
  reference_doctype: CrmDoctype | null
  reference_docname: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  type: ActivityType
  title: string
  content: string | null
  created_by: UserEmbed | null
  created_at: string
  metadata: Record<string, unknown> | null
}

export interface Comment {
  id: string
  tenant_id: string
  content: string
  reference_doctype: CrmDoctype
  reference_docname: string
  created_by: UserEmbed | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  from_user: UserEmbed | null
  notification_type: NotificationType
  message: string
  reference_doctype: CrmDoctype | null
  reference_docname: string | null
  read: boolean
  created_at: string
}

export interface ViewSettings {
  id: string
  tenant_id: string
  doctype: CrmDoctype
  view_type: ViewType
  label: string
  columns_json: string | null
  rows_json: string | null
  filters_json: string | null
  order_by: string | null
  is_default: boolean
  is_public: boolean
  is_standard: boolean
  created_by: UserEmbed | null
  created_at: string
  updated_at: string
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface CrmPaginatedResponse<T> {
  data: T[]
  total_count: number
  page: number
  page_size: number
}

export interface KanbanColumn<T> {
  column_value: string | null
  column_id: string | null
  color: string | null
  position: number | null
  count: number
  data: T[]
}

export interface KanbanResponse<T> {
  columns: KanbanColumn<T>[]
  total_count: number
}

export interface GroupByBucket<T> {
  group_value: string | null
  group_id: string | null
  count: number
  data: T[]
}

export interface GroupByResponse<T> {
  buckets: GroupByBucket<T>[]
  total_count: number
}

// ============================================
// QUERY PARAMS TYPES
// ============================================

export interface CrmListParams {
  page?: number
  page_size?: number
  search?: string
  order_by?: string
  order_direction?: 'asc' | 'desc'
  filters?: Record<string, string | number | boolean | null>
}

export interface CrmKanbanParams {
  group_by_field?: string
  search?: string
  filters?: Record<string, string | number | boolean | null>
}

export interface CrmGroupByParams {
  group_by_field: string
  page?: number
  page_size?: number
  search?: string
  filters?: Record<string, string | number | boolean | null>
}

// ============================================
// FORM / MUTATION DATA TYPES
// ============================================

export interface CreateLeadData {
  first_name: string
  middle_name?: string
  last_name?: string
  email?: string
  mobile_no?: string
  phone?: string
  website?: string
  job_title?: string
  organization_name?: string
  status_id?: string
  source_id?: string
  industry_id?: string
  territory_id?: string
  lead_owner_id?: string
  organization_id?: string
  no_of_employees?: number
  annual_revenue?: number
  currency?: string
}

export interface UpdateLeadData extends Partial<CreateLeadData> {}

export interface CreateDealData {
  organization_name?: string
  lead_name?: string
  email?: string
  mobile_no?: string
  status_id?: string
  deal_owner_id?: string
  deal_value?: number
  probability?: number
  expected_closure_date?: string
  currency?: string
}

export interface UpdateDealData extends Partial<CreateDealData> {}

export interface CreateContactData {
  salutation?: string
  first_name: string
  last_name?: string
  email?: string
  mobile_no?: string
  phone?: string
  company_name?: string
  designation?: string
  industry_id?: string
  territory_id?: string
  organization_id?: string
}

export interface UpdateContactData extends Partial<CreateContactData> {}

export interface CreateOrganizationData {
  organization_name: string
  website?: string
  no_of_employees?: number
  annual_revenue?: number
  currency?: string
  industry_id?: string
  territory_id?: string
  address?: string
  phone?: string
  email?: string
}

export interface UpdateOrganizationData extends Partial<CreateOrganizationData> {}

export interface CreateTaskData {
  title: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  assigned_to_id?: string
  due_date?: string
  reference_doctype?: CrmDoctype
  reference_docname?: string
}

export interface UpdateTaskData extends Partial<CreateTaskData> {}

export interface CreateNoteData {
  title: string
  content: string
  reference_doctype?: CrmDoctype
  reference_docname?: string
}

export interface UpdateNoteData extends Partial<CreateNoteData> {}

export interface CreateCallLogData {
  caller?: string
  receiver?: string
  type: CallLogType
  status: CallLogStatus
  duration?: number
  start_time?: string
  end_time?: string
  recording_url?: string
  note?: string
  telephony_medium?: string
  reference_doctype?: CrmDoctype
  reference_docname?: string
}

export interface UpdateCallLogData extends Partial<CreateCallLogData> {}

export interface MarkDealLostData {
  lost_reason_id?: string
  lost_detail?: string
}

export interface ReorderStatusData {
  items: Array<{ id: string; position: number }>
}
