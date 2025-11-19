// ============================================
// TYPE COMPATIBILITY CHECK
// ============================================

// Backend Types (from Prisma)
type BackendMessage = {
  id: string;
  tenantId: string;
  conversationId: string;
  whatsappMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "LOCATION" | "STICKER" | "TEMPLATE" | "INTERACTIVE";
  content: string;
  metadata: any;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  sentById: string | null;
  timestamp: Date;
  createdAt: Date;
  // updatedAt não existe no Prisma schema para Message
};

// Backend Response (from message.service.v2.ts)
type BackendListMessagesResult = {
  data: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    contactId?: string; // Added by service
    userId?: string; // Added by service (sentById)
    whatsappMessageId: string | null;
    direction: "INBOUND" | "OUTBOUND";
    type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "LOCATION" | "STICKER" | "TEMPLATE" | "INTERACTIVE";
    content: string;
    mediaUrl?: string; // Extracted from metadata
    mediaType?: string; // Extracted from metadata
    metadata: any;
    status: "SENT" | "DELIVERED" | "READ" | "FAILED";
    sentById: string | null;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date; // Service uses createdAt as updatedAt
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// Frontend Types (from types/index.ts)
enum FrontendMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT', // DIFERENTE! Frontend tem CONTACT, backend tem STICKER
  STICKER = 'STICKER',
  TEMPLATE = 'TEMPLATE',
  // FALTANDO: INTERACTIVE no frontend
}

enum FrontendMessageStatus {
  PENDING = 'PENDING', // DIFERENTE! Frontend tem PENDING, backend não tem
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

enum FrontendMessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

type FrontendMessage = {
  id: string;
  tenantId: string;
  conversationId: string;
  contactId: string; // PROBLEMA! Frontend espera sempre, backend retorna opcional
  userId?: string;
  user?: any; // User object
  direction: FrontendMessageDirection;
  type: FrontendMessageType;
  status: FrontendMessageStatus;
  content?: string; // Frontend tem content opcional
  mediaUrl?: string;
  mediaType?: string;
  whatsappMessageId?: string; // Frontend tem opcional, backend retorna string | null
  metadata?: Record<string, any>;
  createdAt: string; // PROBLEMA! Frontend espera string, backend retorna Date
  updatedAt: string; // PROBLEMA! Frontend espera string, backend retorna Date
};

type FrontendPaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number; // OK! Alinhado
  };
};

// ============================================
// INCOMPATIBILIDADES ENCONTRADAS
// ============================================

/*
1. MESSAGE TYPE ENUM:
   - Frontend tem "CONTACT", backend tem apenas no Prisma mas não usa
   - Backend tem "INTERACTIVE", frontend não tem

2. MESSAGE STATUS ENUM:
   - Frontend tem "PENDING", backend não tem (mas usa SENT como inicial)

3. CAMPOS DE DATA:
   - Backend retorna Date objects
   - Frontend espera strings ISO
   - Campos: createdAt, updatedAt, timestamp

4. CAMPO contactId:
   - Backend: opcional (contactId?: string)
   - Frontend: obrigatório (contactId: string)

5. CAMPO whatsappMessageId:
   - Backend: string | null
   - Frontend: string | undefined

6. CAMPO content:
   - Backend: sempre string (obrigatório)
   - Frontend: string opcional (content?: string)

7. CAMPO timestamp:
   - Backend tem e retorna
   - Frontend não tem no tipo Message

8. CONVERSÃO DE DATAS:
   - Backend deveria converter Date para string ISO antes de retornar

9. FORMATO DO RESPONSE:
   - Backend: ListMessagesResult (custom)
   - Frontend: PaginatedResponse<Message>
   - Estrutura está OK, mas tipos internos divergem
*/