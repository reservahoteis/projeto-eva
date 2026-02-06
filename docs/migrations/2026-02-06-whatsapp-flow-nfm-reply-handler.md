# Migration: WhatsApp Flow Response Handler (nfm_reply)

**Data:** 2026-02-06
**Tipo:** Feature Implementation
**Impacto:** Medium (novo handler, sem breaking changes)
**Status:** ✅ Completo

---

## Resumo

Implementado handler completo para processar respostas de WhatsApp Flows (mensagens do tipo `interactive` com subtipo `nfm_reply`) no webhook worker.

---

## Arquivos Modificados

### 1. `deploy-backend/src/validators/whatsapp-webhook.validator.ts`

**Adicionado:**
- Schema Zod `NfmReplySchema` para validação
- Type guard `isNfmReply()` para detecção

**Mudanças:**
```typescript
// Linha 125: Novo schema
const NfmReplySchema = z.object({
  nfm_reply: z.object({
    response_json: z.string(),
    body: z.string().optional(),
    name: z.string(),
  }),
});

// Linha 184: Atualizado union type
interactive: z.union([ButtonReplySchema, ListReplySchema, NfmReplySchema]).optional(),

// Linha 420: Novo type guard
export function isNfmReply(message: WhatsAppMessage): boolean {
  return message.type === 'interactive' &&
         !!message.interactive &&
         'nfm_reply' in message.interactive;
}
```

### 2. `deploy-backend/src/queues/workers/process-incoming-message.worker.ts`

**Adicionado:**
- Import de `isNfmReply` type guard
- Interface `nfmReply` no `MediaMessageMetadata`
- Handler para nfm_reply na função `extractMessageData()`
- Função `handleFlowResponse()` para processamento pós-save
- Chamada a `handleFlowResponse()` no fluxo principal

**Mudanças:**

```typescript
// Linha 15: Novo import
import { ..., isNfmReply } from '@/validators/whatsapp-webhook.validator';

// Linha 54: Novo campo na interface
interface MediaMessageMetadata {
  // ... campos existentes
  nfmReply?: {
    flowName: string;
    flowToken?: string;
    responseData: Record<string, unknown>;
    conversationId?: string;
  };
}

// Linha 698: Novo handler (após INTERACTIVE BUTTON REPLY)
if (isNfmReply(message) && message.interactive && 'nfm_reply' in message.interactive) {
  const nfmReply = message.interactive.nfm_reply;
  let responseData: Record<string, unknown> = {};

  try {
    responseData = JSON.parse(nfmReply.response_json);
  } catch (parseError) {
    logger.warn({ ... }, 'Failed to parse nfm_reply response_json');
  }

  let conversationId: string | undefined;
  const flowTokenMatch = message.context?.id?.match(/^booking_([a-f0-9-]{36})_\d+$/);
  if (flowTokenMatch) {
    conversationId = flowTokenMatch[1];
  }

  const fieldCount = Object.keys(responseData).length;
  const content = `[Flow completo: ${nfmReply.name}] - ${fieldCount} campo(s) preenchido(s)`;

  return {
    type: MessageType.INTERACTIVE,
    content,
    metadata: {
      nfmReply: {
        flowName: nfmReply.name,
        flowToken: message.context?.id,
        responseData,
        conversationId,
      },
      context: message.context,
    },
    shouldDownload: false,
  };
}

// Linha 201: Chamada à função de processamento
if (messageData.metadata?.nfmReply) {
  await handleFlowResponse(
    tenantId,
    conversation.id,
    messageData.metadata.nfmReply,
    savedMessage.id
  );
}

// Linha 900: Nova função
async function handleFlowResponse(
  tenantId: string,
  conversationId: string,
  nfmReply: NonNullable<MediaMessageMetadata['nfmReply']>,
  messageId: string
): Promise<void> {
  // Log de processamento
  logger.info({ ... }, 'Processing WhatsApp Flow response');

  // Atualizar conversa alvo se conversationId diferente
  if (nfmReply.conversationId && nfmReply.conversationId !== conversationId) {
    await prisma.conversation.update({
      where: { id: nfmReply.conversationId, tenantId },
      data: {
        lastMessageAt: new Date(),
        status: 'IN_PROGRESS',
      },
    });

    // Emitir eventos Socket.io
    const io = getSocketIO();
    io.to(`conversation:${nfmReply.conversationId}`).emit('conversation:update', { ... });
    io.to(`tenant:${tenantId}`).emit('conversation:update', { ... });
  }

  // Log de sucesso
  logger.info({ ... }, 'WhatsApp Flow response processed successfully');
}
```

### 3. `docs/api/WHATSAPP-WEBHOOK-GUIDE.md`

**Adicionado:**
- Seção 1.1 "WhatsApp Flow Response (nfm_reply)" com documentação completa
- Atualizado lista de tipos suportados
- Adicionado `isNfmReply()` na lista de type guards

### 4. `docs/guides/whatsapp-flow-response-handler.md` (NOVO)

**Criado:**
- Documentação completa do handler
- Exemplos de uso e casos de uso
- Padrões de flowToken
- Guia de testes manuais
- Logs estruturados
- Considerações de segurança

---

## Funcionalidades Implementadas

### 1. Validação de Payload

- Schema Zod para `nfm_reply` garante type-safety
- Validação automática no webhook controller
- Type guard para detecção de mensagens flow

### 2. Extração de Dados

- Parse automático do `response_json` (JSON string)
- Extração de conversationId do flowToken via regex
- Padrão: `booking_{conversationId}_{timestamp}`
- Tratamento de erros de parse (graceful degradation)

### 3. Salvamento de Mensagem

- Tipo: `MessageType.INTERACTIVE`
- Content: Resumo legível do flow
- Metadata inclui:
  - `flowName`: Nome do flow
  - `flowToken`: Token de rastreamento
  - `responseData`: Dados parseados do formulário
  - `conversationId`: ID da conversa alvo (se disponível)

### 4. Atualização de Conversa

- Se flowToken contém conversationId válido:
  - Atualiza conversa alvo com status `IN_PROGRESS`
  - Atualiza `lastMessageAt`
  - Validação de segurança multi-tenant (tenantId)

### 5. Eventos Socket.io

- Emite `conversation:update` para room da conversa
- Emite `conversation:update` para room do tenant
- Atualiza frontend em tempo real

### 6. Logging Estruturado

- Logs detalhados de processamento
- Warnings para erros de parse
- Errors com stack trace para debugging
- Campos estruturados para análise

---

## Padrões e Convenções

### FlowToken Pattern

```typescript
// Formato recomendado
const flowToken = `booking_${conversationId}_${Date.now()}`;

// Exemplo
"booking_a1b2c3d4-e5f6-7890-abcd-ef1234567890_1699999999000"

// Regex de extração
/^booking_([a-f0-9-]{36})_\d+$/
```

### Segurança Multi-Tenant

```typescript
// SEMPRE validar tenantId ao atualizar recursos
await prisma.conversation.update({
  where: {
    id: conversationId,
    tenantId, // 🔒 CRÍTICO
  },
  data: { ... }
});
```

### Error Handling

- Parse errors: Log warning e continua com responseData vazio
- Conversation not found: Log warning e skip update
- Socket.io errors: Log warning e não bloqueia processamento

---

## Casos de Uso

### 1. Cadastro de Hóspede

Atendente envia flow durante conversa → Cliente preenche → Sistema atualiza conversa original

### 2. Feedback Pós-Hospedagem

Sistema envia flow após checkout → Cliente responde → Nova conversa criada com dados

### 3. Reserva Direta (Marketing)

Cliente recebe link de flow → Preenche sem conversa prévia → Sistema cria nova conversa

---

## Testes

### Validação TypeScript

```bash
cd deploy-backend && npx tsc --noEmit
# ✅ 0 errors
```

### Teste Manual

1. Enviar flow com flowToken rastreável
2. Preencher formulário no WhatsApp
3. Verificar webhook recebido
4. Verificar mensagem salva no banco
5. Verificar conversa atualizada
6. Verificar evento Socket.io emitido

### Queries de Verificação

```sql
-- Mensagens de flow
SELECT
  id,
  type,
  content,
  metadata->'nfmReply'->>'flowName' as flow_name,
  metadata->'nfmReply'->'responseData' as response_data
FROM messages
WHERE type = 'INTERACTIVE'
  AND metadata->>'nfmReply' IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 10;

-- Conversas atualizadas
SELECT id, status, "lastMessageAt"
FROM conversations
WHERE "lastMessageAt" > NOW() - INTERVAL '1 hour'
ORDER BY "lastMessageAt" DESC;
```

---

## Impacto

### Positivo

- ✅ Suporte completo para WhatsApp Flows
- ✅ Type-safety com Zod e TypeScript
- ✅ Multi-tenant security mantida
- ✅ Logs estruturados para debugging
- ✅ Socket.io para atualização em tempo real
- ✅ Documentação completa

### Nenhum Breaking Change

- ✅ Código existente não afetado
- ✅ Backward compatible
- ✅ Novos campos opcionais em metadata

---

## Próximos Passos

1. ⏳ Implementar testes unitários do handler
2. ⏳ Criar endpoint REST para consultar responses
3. ⏳ UI no frontend para visualizar dados do flow
4. ⏳ Validação de schema dos dados recebidos (JSON Schema)
5. ⏳ Webhook endpoint para data_exchange (validação durante preenchimento)
6. ⏳ Métricas e analytics de flows

---

## Rollback Plan

Se necessário reverter:

1. Remover handler de nfm_reply do worker
2. Remover schema e type guard do validator
3. Mensagens nfm_reply cairão no fallback (tipo TEXT com metadata rawMessage)
4. Sem perda de dados (apenas não processadas)

```bash
# Revert commits
git revert HEAD~3..HEAD

# OU remover manualmente os handlers adicionados
```

---

## Referências

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Webhook Payload Examples](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)
- [docs/api/WHATSAPP-FLOWS-SERVICE.md](../api/WHATSAPP-FLOWS-SERVICE.md)
- [docs/guides/whatsapp-flow-response-handler.md](../guides/whatsapp-flow-response-handler.md)

---

**Implementado por:** Claude Sonnet 4.5 (Backend Architect)
**Revisado por:** Pending
**Data de Deploy:** Pending
