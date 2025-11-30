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
  phoneNumber: string;       // Corrigido: era "phone"
  name?: string;             // Corrigido: agora opcional
  email?: string;
  profilePictureUrl?: string; // Corrigido: era "avatar"
  metadata?: Record<string, any>; // Corrigido: era "customFields"
  createdAt: string;
  updatedAt: string;
  // Campos computados do backend:
  _count?: {
    conversations: number;
  };
  lastConversation?: {
    id: string;
    lastMessageAt: string;
  };
  conversationsCount?: number;
  lastConversationAt?: string | null;
}

// ============================================
// CONVERSATION
// ============================================

/**
 * Status de conversas - DEVE estar sincronizado com backend Prisma schema
 * @see deploy-backend/prisma/schema.prisma (linhas 205-211)
 *
 * IMPORTANTE: NÃO adicionar/remover status sem atualizar backend primeiro
 */
export enum ConversationStatus {
  BOT_HANDLING = 'BOT_HANDLING', // Sendo atendida pela IA (não aparece no Kanban)
  OPEN = 'OPEN',                 // Nova conversa, aguardando atendimento humano
  IN_PROGRESS = 'IN_PROGRESS',   // Atendente está conversando ativamente
  WAITING = 'WAITING',           // Aguardando resposta do cliente
  CLOSED = 'CLOSED',             // Conversa finalizada
}

export interface Conversation {
  id: string;
  tenantId: string;
  contactId: string;
  contact: Contact;
  assignedToId?: string;
  assignedTo?: User;
  status: ConversationStatus;
  priority?: ConversationPriority;
  source?: string;
  // Controle de IA
  iaLocked: boolean;
  iaLockedAt?: string;
  iaLockedBy?: string;
  lastMessageAt: string;
  lastMessage?: Message;
  unreadCount: number;
  tags: Tag[];
  escalation?: Escalation;
  createdAt: string;
  updatedAt: string;
}

export enum ConversationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
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
// ESCALATION
// ============================================

export enum EscalationReason {
  USER_REQUESTED = 'USER_REQUESTED',
  AI_UNABLE = 'AI_UNABLE',
  COMPLEX_QUERY = 'COMPLEX_QUERY',
  COMPLAINT = 'COMPLAINT',
  SALES_OPPORTUNITY = 'SALES_OPPORTUNITY',
  URGENCY = 'URGENCY',
  OTHER = 'OTHER',
}

export enum EscalationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
}

export interface Escalation {
  id: string;
  tenantId: string;
  conversationId: string;
  reason: EscalationReason;
  reasonDetail?: string;
  hotelUnit?: string;
  aiContext?: Record<string, any>;
  status: EscalationStatus;
  attendedById?: string;
  attendedAt?: string;
  createdAt: string;
  resolvedAt?: string;
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
