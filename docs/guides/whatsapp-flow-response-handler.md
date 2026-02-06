# WhatsApp Flow Response Handler (nfm_reply)

**Status:** ✅ Implementado
**Data:** 06/02/2026
**Versão:** 1.0.0

---

## Visão Geral

Handler para processar respostas de WhatsApp Flows no webhook worker. Quando um usuário completa um formulário via WhatsApp Flow, o sistema recebe uma mensagem do tipo `interactive` com subtipo `nfm_reply`.

## Arquivos Modificados

### 1. Validator (whatsapp-webhook.validator.ts)

**Adicionado:**
- Schema `NfmReplySchema` para validação Zod
- Type guard `isNfmReply()` para detecção de mensagens

```typescript
// Schema
const NfmReplySchema = z.object({
  nfm_reply: z.object({
    response_json: z.string(),
    body: z.string().optional(),
    name: z.string(),
  }),
});

// Type Guard
export function isNfmReply(message: WhatsAppMessage): boolean {
  return message.type === 'interactive' &&
         !!message.interactive &&
         'nfm_reply' in message.interactive;
}
```

### 2. Worker (process-incoming-message.worker.ts)

**Adicionado:**
- Metadata interface para `nfmReply`
- Handler na função `extractMessageData()`
- Função `handleFlowResponse()` para processamento pós-save

**Metadata Interface:**
```typescript
interface MediaMessageMetadata {
  // ... campos existentes
  nfmReply?: {
    flowName: string;
    flowToken?: string;
    responseData: Record<string, unknown>;
    conversationId?: string;
  };
}
```

---

## Fluxo de Processamento

### 1. Recepção do Webhook

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511999999999",
          "id": "wamid.xxxxx",
          "timestamp": "1699999999",
          "type": "interactive",
          "interactive": {
            "type": "nfm_reply",
            "nfm_reply": {
              "response_json": "{\"nome\":\"João Silva\",\"email\":\"joao@example.com\"}",
              "body": "Sent",
              "name": "guest_registration"
            }
          },
          "context": {
            "id": "booking_a1b2c3d4-e5f6-7890-abcd-ef1234567890_1699999999000"
          }
        }]
      }
    }]
  }]
}
```

### 2. Validação (Zod)

- Payload validado contra `WhatsAppWebhookSchema`
- Campo `interactive` validado como `NfmReplySchema`

### 3. Extração de Dados (extractMessageData)

```typescript
// Parse response_json
const responseData = JSON.parse(nfmReply.response_json);

// Extrair conversationId do flowToken (padrão: booking_{conversationId}_{timestamp})
const flowTokenMatch = message.context?.id?.match(/^booking_([a-f0-9-]{36})_\d+$/);
const conversationId = flowTokenMatch?.[1];

// Criar metadata
return {
  type: MessageType.INTERACTIVE,
  content: `[Flow completo: ${nfmReply.name}] - ${fieldCount} campo(s) preenchido(s)`,
  metadata: {
    nfmReply: {
      flowName: nfmReply.name,
      flowToken: message.context?.id,
      responseData,
      conversationId,
    }
  },
  shouldDownload: false,
};
```

### 4. Salvar Mensagem (Prisma)

```typescript
const savedMessage = await prisma.message.create({
  data: {
    tenantId,
    conversationId: conversation.id,
    whatsappMessageId: message.id,
    direction: 'INBOUND',
    type: MessageType.INTERACTIVE,
    content: `[Flow completo: guest_registration] - 5 campo(s) preenchido(s)`,
    metadata: {
      nfmReply: {
        flowName: "guest_registration",
        flowToken: "booking_a1b2c3d4-e5f6-7890-abcd-ef1234567890_1699999999000",
        conversationId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        responseData: {
          nome: "João Silva",
          email: "joao@example.com",
          telefone: "5511999999999"
        }
      }
    },
    status: 'DELIVERED',
    timestamp: new Date(parseInt(message.timestamp) * 1000),
  },
});
```

### 5. Atualizar Conversa Alvo (handleFlowResponse)

Se o `flowToken` contém um `conversationId`:

```typescript
// Atualizar conversa referenciada no flowToken
await prisma.conversation.update({
  where: {
    id: nfmReply.conversationId,
    tenantId, // Validação de segurança
  },
  data: {
    lastMessageAt: new Date(),
    status: 'IN_PROGRESS',
  },
});
```

### 6. Emitir Eventos Socket.io

```typescript
const io = getSocketIO();

// Evento para room da conversa específica
io.to(`conversation:${conversationId}`).emit('conversation:update', {
  conversationId,
  updates: {
    lastMessageAt: new Date(),
    status: 'IN_PROGRESS',
  },
});

// Evento para room do tenant
io.to(`tenant:${tenantId}`).emit('conversation:update', {
  conversationId,
  updates: {
    lastMessageAt: new Date(),
    status: 'IN_PROGRESS',
  },
});
```

---

## Flow Token Pattern

### Padrão Recomendado

```typescript
// Criar flowToken ao enviar flow
const flowToken = `booking_${conversationId}_${Date.now()}`;

// Exemplo:
// "booking_a1b2c3d4-e5f6-7890-abcd-ef1234567890_1699999999000"
```

### Regex de Extração

```typescript
const pattern = /^booking_([a-f0-9-]{36})_\d+$/;
const match = flowToken.match(pattern);
const conversationId = match?.[1]; // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Validação

- Prefixo: `booking_`
- ConversationId: UUID v4 (36 caracteres)
- Timestamp: Unix timestamp em ms
- Separador: `_`

---

## Casos de Uso

### 1. Cadastro de Hóspede

**Cenário:**
Atendente envia flow de cadastro para cliente durante conversa de reserva.

**Fluxo:**
1. Atendente clica em "Enviar Cadastro" na conversa `conv-123`
2. Sistema envia flow com `flowToken = "booking_conv-123_1699999999"`
3. Cliente preenche formulário no WhatsApp
4. Webhook recebe nfm_reply
5. Worker processa e atualiza conversa `conv-123`
6. Frontend atualiza em tempo real via Socket.io

### 2. Feedback Pós-Hospedagem

**Cenário:**
Sistema envia flow de feedback automaticamente após checkout.

**Fluxo:**
1. Cron job detecta checkout
2. Sistema cria nova conversa `conv-456` (tipo: feedback)
3. Sistema envia flow com `flowToken = "booking_conv-456_1699999999"`
4. Cliente responde
5. Worker atualiza conversa `conv-456` com dados do feedback

### 3. Reserva Direta (sem conversa prévia)

**Cenário:**
Cliente recebe link de flow via campanha de marketing.

**Fluxo:**
1. Cliente abre flow diretamente (sem conversa prévia)
2. Sistema envia flow sem flowToken ou com token genérico
3. Cliente preenche
4. Worker cria nova conversa e salva mensagem
5. Atendente vê nova conversa com dados do flow

---

## Logs Estruturados

### Sucesso

```
INFO: Processing WhatsApp Flow response
  tenantId: "tenant-123"
  conversationId: "current-conv-id"
  flowName: "guest_registration"
  flowToken: "booking_target-conv-id_1699999999"
  extractedConversationId: "target-conv-id"
  fieldsCount: 5

INFO: Flow response references different conversation, updating target conversation
  currentConversationId: "current-conv-id"
  targetConversationId: "target-conv-id"

INFO: WhatsApp Flow response processed successfully
  responseData: { nome: "João Silva", email: "joao@example.com", ... }
```

### Erro de Parse

```
WARN: Failed to parse nfm_reply response_json
  messageId: "wamid.xxxxx"
  error: "Unexpected token in JSON at position 10"
  rawJson: "{invalid json"
```

### Erro de Atualização

```
ERROR: Failed to handle flow response
  conversationId: "target-conv-id"
  flowName: "guest_registration"
  error: "Record to update not found"
```

---

## Segurança

### Multi-Tenant Isolation

- Sempre validar `tenantId` ao atualizar conversa alvo
- Usar `findFirst` com filtro `tenantId` em vez de `findUnique`
- Nunca confiar apenas no conversationId sem validar tenant

```typescript
await prisma.conversation.update({
  where: {
    id: conversationId,
    tenantId, // 🔒 CRÍTICO para segurança multi-tenant
  },
  data: { ... }
});
```

### Validação de FlowToken

- Pattern matching com regex estrito
- Validar formato UUID v4 do conversationId
- Logar tentativas de manipulação

---

## Error Handling

### 1. Parse Error (response_json inválido)

```typescript
let responseData: Record<string, unknown> = {};
try {
  responseData = JSON.parse(nfmReply.response_json);
} catch (parseError) {
  logger.warn({
    messageId: message.id,
    error: parseError.message,
    rawJson: nfmReply.response_json,
  }, 'Failed to parse nfm_reply response_json');
  // Continua processamento com responseData vazio
}
```

### 2. Conversa Não Encontrada

```typescript
try {
  await prisma.conversation.update({
    where: { id: conversationId, tenantId },
    data: { ... }
  });
} catch (error) {
  if (error.code === 'P2025') {
    logger.warn('Target conversation not found, skipping update');
  } else {
    throw error; // Re-throw para retry
  }
}
```

### 3. Socket.io Emit Failure

```typescript
try {
  io.to(`conversation:${conversationId}`).emit('conversation:update', ...);
} catch (socketError) {
  logger.warn({ error: socketError }, 'Failed to emit flow response events');
  // Não bloqueia processamento
}
```

---

## Testes Manuais

### 1. Criar Flow de Teste

```bash
curl -X POST "http://localhost:3000/api/v1/whatsapp-flows" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_flow",
    "flowJson": { ... },
    "categories": ["LEAD_GENERATION"]
  }'
```

### 2. Enviar Flow com FlowToken

```bash
curl -X POST "http://localhost:3000/api/v1/whatsapp-flows/send" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "5511999999999",
    "flowId": "FLOW_ID",
    "flowToken": "booking_CONVERSATION_ID_1699999999",
    "ctaText": "Preencher Cadastro"
  }'
```

### 3. Simular Webhook (curl)

```bash
curl -X POST "http://localhost:3000/webhooks/whatsapp" \
  -H "X-Hub-Signature-256: sha256=SIGNATURE" \
  -H "X-Tenant-Slug: tenant-slug" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5511999999999",
            "id": "wamid.test123",
            "timestamp": "1699999999",
            "type": "interactive",
            "interactive": {
              "type": "nfm_reply",
              "nfm_reply": {
                "response_json": "{\"nome\":\"João Silva\",\"email\":\"joao@test.com\"}",
                "body": "Sent",
                "name": "test_flow"
              }
            },
            "context": {
              "id": "booking_CONVERSATION_ID_1699999999"
            }
          }]
        }
      }]
    }]
  }'
```

### 4. Verificar no Banco

```sql
-- Verificar mensagem salva
SELECT
  id,
  type,
  content,
  metadata->'nfmReply'->>'flowName' as flow_name,
  metadata->'nfmReply'->'responseData' as response_data,
  "createdAt"
FROM messages
WHERE type = 'INTERACTIVE'
  AND metadata->>'nfmReply' IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 5;

-- Verificar conversa atualizada
SELECT
  id,
  status,
  "lastMessageAt"
FROM conversations
WHERE id = 'CONVERSATION_ID';
```

---

## Próximos Passos

1. ✅ Implementado: Handler básico de nfm_reply
2. ✅ Implementado: Extração de conversationId do flowToken
3. ✅ Implementado: Atualização da conversa alvo
4. ✅ Implementado: Eventos Socket.io
5. 🔄 TODO: Testes unitários
6. 🔄 TODO: Endpoint REST para consultar responses
7. 🔄 TODO: UI no frontend para visualizar dados do flow
8. 🔄 TODO: Validação de schema dos dados recebidos
9. 🔄 TODO: Webhook de validação de flows (data_exchange endpoint)

---

## Referências

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Webhook Payload Examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)
- [WHATSAPP-FLOWS-SERVICE.md](../api/WHATSAPP-FLOWS-SERVICE.md)
- [WHATSAPP-WEBHOOK-GUIDE.md](../api/WHATSAPP-WEBHOOK-GUIDE.md)

---

**Última atualização:** 06/02/2026
**Versão:** 1.0.0
**Status:** ✅ Production-Ready
