# RELATÓRIO DE AUDITORIA COMPLETA - API REST

**Data:** 2025-11-20
**Sistema:** CRM WhatsApp SaaS Multi-Tenant
**Escopo:** Integração N8N + API REST
**Auditor:** Claude Code (Backend System Architect)

---

## SUMÁRIO EXECUTIVO

**Status Geral:** 🟡 **88% COMPLETO** (Bloqueador: Falta endpoint POST /api/conversations)

| Componente | Status | Ação Requerida |
|------------|--------|----------------|
| Validators | 🟡 75% | Criar `createConversationSchema` |
| Services | 🟡 80% | Criar `createFromPhone()` |
| Controllers | ❌ 60% | Criar método `create()` |
| Routes | ❌ 60% | Adicionar POST /api/conversations |
| Middlewares | ✅ 100% | Nenhuma |
| Socket.io | ✅ 100% | Nenhuma |

---

## 🔴 BLOQUEADORES IDENTIFICADOS

### 1. VALIDATOR: createConversationSchema AUSENTE

**Arquivo:** `deploy-backend/src/validators/conversation.validator.ts`

```typescript
// ❌ FALTA CRIAR
export const createConversationSchema = z.object({
  contactPhoneNumber: z.string()
    .min(10, 'Número inválido')
    .regex(/^\d+$/, 'Apenas dígitos'),
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
  source: z.enum(['n8n', 'manual', 'webhook', 'whatsapp']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  metadata: z.record(z.any()).optional(),
  assignedToId: z.string().uuid().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
```

### 2. SERVICE: createFromPhone() AUSENTE

**Arquivo:** `deploy-backend/src/services/conversation.service.ts`

```typescript
/**
 * Criar conversa a partir de phoneNumber (para N8N)
 * Busca ou cria Contact automaticamente
 */
async createFromPhone(data: {
  tenantId: string;
  contactPhoneNumber: string;
  status?: ConversationStatus;
  source?: string;
  priority?: Priority;
  metadata?: any;
  assignedToId?: string;
}) {
  // 1. Buscar Contact por phoneNumber + tenantId
  let contact = await prisma.contact.findFirst({
    where: {
      tenantId: data.tenantId,
      phoneNumber: data.contactPhoneNumber,
    },
  });

  // 2. Se não existir, criar Contact
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId: data.tenantId,
        phoneNumber: data.contactPhoneNumber,
      },
    });

    logger.info({ contactId: contact.id, phoneNumber: data.contactPhoneNumber },
      'Contact created automatically');
  }

  // 3. Criar Conversation
  const conversation = await prisma.conversation.create({
    data: {
      tenantId: data.tenantId,
      contactId: contact.id,
      status: data.status || 'OPEN',
      priority: data.priority || 'MEDIUM',
      source: data.source,
      metadata: data.metadata,
      assignedToId: data.assignedToId,
      lastMessageAt: new Date(),
    },
    include: {
      contact: {
        select: {
          id: true,
          phoneNumber: true,
          name: true,
          profilePictureUrl: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  logger.info({
    conversationId: conversation.id,
    contactId: contact.id,
    status: conversation.status,
    source: conversation.source,
  }, 'Conversation created from phone number');

  // 4. Emitir evento Socket.io (apenas se status != BOT_HANDLING)
  if (conversation.status !== 'BOT_HANDLING') {
    const { emitNewConversation } = await import('@/config/socket');
    emitNewConversation(data.tenantId, conversation);
  }

  return conversation;
}
```

### 3. CONTROLLER: create() AUSENTE

**Arquivo:** `deploy-backend/src/controllers/conversation.controller.ts`

```typescript
/**
 * POST /api/conversations
 * Criar conversa a partir de phoneNumber (para N8N)
 */
async create(req: Request, res: Response) {
  try {
    const data = req.body as CreateConversationInput;

    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Tenant ID não encontrado',
        hint: 'Certifique-se de enviar o header X-Tenant-Slug',
      });
    }

    const conversation = await conversationService.createFromPhone({
      tenantId: req.tenantId,
      contactPhoneNumber: data.contactPhoneNumber,
      status: data.status,
      source: data.source,
      priority: data.priority,
      metadata: data.metadata,
      assignedToId: data.assignedToId,
    });

    logger.info({
      conversationId: conversation.id,
      contactPhoneNumber: data.contactPhoneNumber,
      tenantId: req.tenantId,
      status: conversation.status,
      source: data.source,
    }, 'Conversation created via API');

    return res.status(201).json(conversation);
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      body: req.body,
      tenantId: req.tenantId,
    }, 'Erro ao criar conversa');

    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Erro interno ao criar conversa' });
  }
}
```

### 4. ROUTE: POST /api/conversations AUSENTE

**Arquivo:** `deploy-backend/src/routes/conversation.routes.ts`

```typescript
// ADICIONAR IMPORTS
import { createConversationSchema } from '@/validators/conversation.validator';

// ADICIONAR ROTA (DEPOIS DE GET / E ANTES DE GET /:id)
router.post(
  '/',
  validate(createConversationSchema),
  conversationController.create.bind(conversationController)
);
```

---

## ✅ O QUE ESTÁ CORRETO

### message.validator.ts - BUG CORRIGIDO

**Status:** ✅ **100% CORRETO** (commit b6867c6)

```typescript
// ✅ CORRETO: conversationId vem do route param, não do body
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4096),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  metadata: z.record(z.any()).optional(),
});
```

### Socket.io Configuration

**Status:** ✅ **100% CORRETO**

```typescript
✅ emitNewMessage()
✅ emitMessageStatusUpdate()
✅ emitNewConversation()
✅ emitConversationUpdate()
✅ JWT authentication
✅ Rooms: tenant:{id}, user:{id}, conversation:{id}
```

---

## 📋 TESTES CURL PARA VALIDAÇÃO

### Teste 1: Criar conversa BOT_HANDLING (N8N)

```bash
curl -X POST https://api.botreserva.com.br/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "X-Tenant-Slug: hoteis-reserva" \
  -d '{
    "contactPhoneNumber": "5511999999999",
    "status": "BOT_HANDLING",
    "source": "n8n",
    "priority": "MEDIUM",
    "metadata": {
      "flowId": "MARCIO - IA CONVERSACIONAL",
      "unidade": "Campos do Jordão"
    }
  }'
```

**Expected:** `201 Created`

### Teste 2: Verificar filtro Kanban

```bash
curl "https://api.botreserva.com.br/api/conversations?status=OPEN" \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-Slug: hoteis-reserva"
```

**Expected:** Array sem conversas BOT_HANDLING

### Teste 3: Escalar conversa

```bash
curl -X PATCH "https://api.botreserva.com.br/api/conversations/{ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-Slug: hoteis-reserva" \
  -d '{"status": "OPEN"}'
```

**Expected:** `200 OK` + conversa aparece no Kanban

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ Aplicar migration BOT_HANDLING
2. ✅ Atualizar Prisma schema
3. ✅ Implementar código fornecido (4 arquivos)
4. ✅ Deploy em produção
5. ✅ Executar testes curl

**Tempo Estimado:** 50 minutos total

---

**FIM DA AUDITORIA API ENDPOINTS**
