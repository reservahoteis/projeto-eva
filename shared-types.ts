// ============================================
// SHARED TYPES - API CONTRACT
// Tipos compartilhados entre frontend e backend
// ============================================

// ============================================
// ENUMS - Valores exatos do banco de dados
// ============================================

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  LOCATION = 'LOCATION',
  STICKER = 'STICKER',
  TEMPLATE = 'TEMPLATE',
  INTERACTIVE = 'INTERACTIVE',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum ConversationStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  CLOSED = 'CLOSED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  ATTENDANT = 'ATTENDANT',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// ============================================
// API RESPONSE TYPES
// O que o backend REALMENTE retorna
// ============================================

export interface MessageApiResponse {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string; // Sempre preenchido pelo backend
  userId?: string; // sentById mapeado para userId
  whatsappMessageId: string | null;
  direction: MessageDirection;
  type: MessageType;
  status: MessageStatus;
  content: string;
  mediaUrl?: string; // Extraído do metadata
  mediaType?: string; // Extraído do metadata
  metadata: Record<string, any> | null;
  sentById: string | null;
  timestamp: string; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ConversationApiResponse {
  id: string;
  tenantId: string;
  contactId: string;
  contact: ContactApiResponse;
  assignedToId: string | null;
  assignedTo?: UserApiResponse;
  status: ConversationStatus;
  priority: Priority;
  lastMessageAt: string; // ISO string
  lastMessage?: MessageApiResponse;
  unreadCount: number;
  tags: TagApiResponse[];
  createdAt: string; // ISO string
  closedAt: string | null; // ISO string
}

export interface ContactApiResponse {
  id: string;
  tenantId: string;
  phoneNumber: string;
  name: string | null;
  profilePictureUrl: string | null;
  email: string | null;
  metadata: Record<string, any> | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface UserApiResponse {
  id: string;
  tenantId: string | null;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  lastLogin: string | null; // ISO string
}

export interface TagApiResponse {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: string; // ISO string
}

// ============================================
// PAGINATED RESPONSE
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

// ============================================
// REQUEST TYPES
// O que o frontend envia
// ============================================

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, any>;
}

export interface ListMessagesParams {
  page?: number;
  limit?: number;
  before?: string;
  after?: string;
}

export interface ListConversationsParams {
  page?: number;
  limit?: number;
  status?: ConversationStatus;
  priority?: Priority;
  assignedToId?: string;
  search?: string;
}

export interface UpdateConversationRequest {
  status?: ConversationStatus;
  priority?: Priority;
  assignedToId?: string;
  tagIds?: string[];
}

// ============================================
// TYPE GUARDS
// Para validação em runtime
// ============================================

export function isMessageType(value: string): value is MessageType {
  return Object.values(MessageType).includes(value as MessageType);
}

export function isMessageStatus(value: string): value is MessageStatus {
  return Object.values(MessageStatus).includes(value as MessageStatus);
}

export function isConversationStatus(value: string): value is ConversationStatus {
  return Object.values(ConversationStatus).includes(value as ConversationStatus);
}