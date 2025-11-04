// ============================================
// USER & AUTH
// ============================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  ATTENDANT = 'ATTENDANT',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface User {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ============================================
// TENANT
// ============================================

export enum TenantStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum TenantPlan {
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  plan: TenantPlan;
  status: TenantStatus;
  maxUsers: number;
  maxContacts: number;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  isWhatsappConnected: boolean;
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    contacts: number;
    conversations: number;
  };
}

// ============================================
// CONTACT
// ============================================

export interface Contact {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  notes?: string;
  tags: Tag[];
  customFields?: Record<string, any>;
  lastInteractionAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CONVERSATION
// ============================================

export enum ConversationStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface Conversation {
  id: string;
  tenantId: string;
  contactId: string;
  contact: Contact;
  assignedToId?: string;
  assignedTo?: User;
  status: ConversationStatus;
  lastMessageAt: string;
  lastMessage?: Message;
  unreadCount: number;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// MESSAGE
// ============================================

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT',
  STICKER = 'STICKER',
  TEMPLATE = 'TEMPLATE',
}

export enum MessageStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string;
  userId?: string;
  user?: User;
  direction: MessageDirection;
  type: MessageType;
  status: MessageStatus;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  whatsappMessageId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// TAG
// ============================================

export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: string;
}

// ============================================
// WEBHOOK
// ============================================

export enum WebhookEventType {
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  MESSAGE_STATUS = 'MESSAGE_STATUS',
}

export interface WebhookEvent {
  id: string;
  tenantId: string;
  type: WebhookEventType;
  payload: Record<string, any>;
  processed: boolean;
  createdAt: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: any;
}
