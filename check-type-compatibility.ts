/**
 * Verificação de Compatibilidade de Tipos Frontend/Backend
 */

// ============================================
// TIPOS DO BACKEND (message.service.v2.ts)
// ============================================

interface BackendListMessagesResult {
  data: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    contactId: string;         // SEMPRE string (não opcional)
    userId?: string;            // opcional (convertido de sentById)
    whatsappMessageId: string | null;
    direction: 'INBOUND' | 'OUTBOUND';
    type: string;
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    metadata: any;
    status: string;
    sentById: string | null;
    timestamp: Date;            // Date object
    createdAt: Date;            // Date object
    updatedAt: Date;            // Date object
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// TIPOS DO FRONTEND (types/index.ts)
// ============================================

interface FrontendMessage {
  id: string;
  conversationId: string;
  content: string;
  type: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  timestamp: string;          // ISO string esperado
  sentById?: string;
  from?: string;
  to?: string;
  mediaUrl?: string;
  mediaType?: string;
  metadata?: any;
  createdAt: string;          // ISO string esperado
  updatedAt: string;          // ISO string esperado
}

interface FrontendPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// ANÁLISE DE COMPATIBILIDADE
// ============================================

console.log("================================================");
console.log("ANÁLISE DE COMPATIBILIDADE DE TIPOS");
console.log("================================================\n");

// 1. Estrutura da resposta
console.log("1. ESTRUTURA DA RESPOSTA:");
console.log("  ✅ Backend retorna: { data: Array, pagination: {...} }");
console.log("  ✅ Frontend espera: { data: Array, pagination: {...} }");
console.log("  ✅ Estruturas são compatíveis\n");

// 2. Campos da mensagem
console.log("2. CAMPOS DA MENSAGEM:");
console.log("  ⚠️  PROBLEMAS IDENTIFICADOS:");
console.log("  - Backend envia 'timestamp' como Date object");
console.log("  - Frontend espera 'timestamp' como string ISO");
console.log("  - Backend envia 'createdAt' como Date object");
console.log("  - Frontend espera 'createdAt' como string ISO");
console.log("  - Backend envia 'updatedAt' como Date object");
console.log("  - Frontend espera 'updatedAt' como string ISO\n");

console.log("3. CAMPOS EXTRAS/FALTANTES:");
console.log("  - Backend envia 'contactId' (sempre presente)");
console.log("  - Frontend não tem 'contactId' no tipo Message");
console.log("  - Backend envia 'userId' (opcional)");
console.log("  - Frontend não tem 'userId' no tipo Message");
console.log("  - Frontend espera 'from' e 'to' (opcionais)");
console.log("  - Backend não envia 'from' e 'to'\n");

// ============================================
// SOLUÇÃO NECESSÁRIA
// ============================================

console.log("================================================");
console.log("SOLUÇÃO NECESSÁRIA");
console.log("================================================\n");

console.log("❌ PROBLEMA PRINCIPAL:");
console.log("O backend está retornando Date objects mas o frontend espera strings ISO.\n");

console.log("✅ CORREÇÃO NO BACKEND (message.service.v2.ts linha 186-190):");
console.log(`
  return {
    ...
    timestamp: msg.timestamp.toISOString(),  // Converter para ISO string
    createdAt: msg.createdAt.toISOString(),  // Converter para ISO string
    updatedAt: msg.createdAt.toISOString(),  // Converter para ISO string
  };
`);

console.log("\n✅ CORREÇÃO ALTERNATIVA - Serialização JSON:");
console.log("O Express deveria automaticamente converter Date para ISO string");
console.log("ao fazer res.json(). Se não está fazendo, pode ser um problema");
console.log("de configuração do Express ou do middleware de serialização.\n");

// ============================================
// TESTE DE CONVERSÃO
// ============================================

console.log("================================================");
console.log("TESTE DE CONVERSÃO");
console.log("================================================\n");

const testDate = new Date();
console.log("Date object:", testDate);
console.log("toISOString():", testDate.toISOString());
console.log("JSON.stringify():", JSON.stringify({ date: testDate }));

// Simular resposta do backend
const backendResponse: BackendListMessagesResult = {
  data: [{
    id: "msg-1",
    tenantId: "tenant-1",
    conversationId: "conv-1",
    contactId: "contact-1",
    userId: "user-1",
    whatsappMessageId: "wa-123",
    direction: "INBOUND",
    type: "TEXT",
    content: "Test message",
    status: "DELIVERED",
    sentById: null,
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: null
  }],
  pagination: {
    page: 1,
    limit: 50,
    total: 1,
    totalPages: 1
  }
};

console.log("\nSimulação de serialização JSON:");
console.log(JSON.stringify(backendResponse, null, 2));