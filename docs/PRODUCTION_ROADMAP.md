# 🏗️ PRODUCTION ROADMAP - CRM WhatsApp SaaS
**Padrão: Enterprise-Grade Development (Google/Meta/Microsoft)**

---

## 📊 ESTADO ATUAL DO SISTEMA

### ✅ CAMADAS 100% FUNCIONAIS

#### 1. DATABASE LAYER
- [x] Schema Prisma multi-tenant definido
- [x] Migrations aplicadas em produção
- [x] Índices otimizados criados
- [x] Foreign keys configuradas
- **Status:** ✅ PRONTO PARA PRODUÇÃO

#### 2. AUTHENTICATION & AUTHORIZATION
- [x] JWT authentication implementado
- [x] Middleware de autenticação funcionando
- [x] Multi-tenant isolation via `x-tenant-slug`
- [x] Token refresh (15min expiration)
- **Status:** ✅ PRONTO PARA PRODUÇÃO

#### 3. SOCKET.IO INFRASTRUCTURE
- [x] Socket.io server inicializado
- [x] Autenticação JWT no handshake
- [x] Rooms por tenant/conversa/usuário
- [x] Event handlers registrados
- [x] Frontend conectado e autenticado
- **Status:** ✅ PRONTO PARA PRODUÇÃO

---

### ⚠️ CAMADAS COM GAPS CRÍTICOS

#### 1. MESSAGE API ENDPOINT
**Status:** 🔴 BLOQUEADO - Erro 400 em produção

**Gap Identificado:**
- Validator local corrigido (commit `b6867c6`)
- Deploy VPS pendente (código antigo ainda ativo)
- Validator ainda exige `conversationId` no body

**Impact:**
- Impossível enviar mensagens via API
- Socket.io não dispara eventos
- Sistema não funciona end-to-end

**Root Cause:**
```
LOCAL:  sendMessageSchema = { content, type, metadata }  ✅
PROD:   sendMessageSchema = { conversationId, content, type, metadata }  ❌
```

#### 2. REAL-TIME MESSAGE DELIVERY
**Status:** 🟡 PARCIALMENTE IMPLEMENTADO

**Funcionando:**
- [x] Backend emite `message:new` (código implementado)
- [x] Frontend escuta `message:new` (listener registrado)

**Não Testado:**
- [ ] API aceita payload correto
- [ ] Socket.io recebe evento quando mensagem criada
- [ ] Frontend invalida React Query cache
- [ ] UI atualiza sem F5

---

## 🎯 ÉPICOS E TASKS

### ÉPICO 1: MESSAGE SENDING END-TO-END ⚡ CRÍTICO

**Objetivo:** Usuário envia mensagem e ela aparece em tempo real sem F5

---

#### TASK 1.1: Garantir Deploy do Validator Fix
**Responsabilidade:** DevOps/Backend
**Prioridade:** 🔴 CRÍTICA
**Bloqueio:** Bloqueia TODAS as tasks seguintes

##### Input (Pré-requisitos)
- [x] Commit `b6867c6` existe no Git
- [x] GitHub Actions workflow configurado
- [x] VPS com Docker acessível via SSH

##### Output (Deliverables)
- [ ] Backend em produção rodando código do commit `b6867c6`
- [ ] Validator aceita payload sem `conversationId`
- [ ] Health check retorna versão atualizada

##### Contrato de Interface
**Endpoint:** `POST /api/conversations/:conversationId/messages`

**Request esperado:**
```json
{
  "type": "TEXT",
  "content": "Mensagem de teste"
}
```

**Response esperado (201 Created):**
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "tenantId": "uuid",
  "type": "TEXT",
  "content": "Mensagem de teste",
  "direction": "OUTBOUND",
  "status": "SENT",
  "timestamp": "2025-11-20T02:00:00.000Z",
  "createdAt": "2025-11-20T02:00:00.000Z"
}
```

##### Acceptance Criteria
- [ ] **AC1:** cURL para endpoint retorna 201 (não 400)
- [ ] **AC2:** Response JSON contém todos os campos obrigatórios
- [ ] **AC3:** Mensagem salva no banco de dados
- [ ] **AC4:** `GET /api/conversations/:id/messages` retorna mensagem criada

##### Testes de Validação
```bash
# Test 1: Health check
curl https://api.botreserva.com.br/api/health
# Esperado: {"status":"ok","version":"b6867c6"}

# Test 2: Send message
curl -X POST https://api.botreserva.com.br/api/conversations/UUID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: hoteis-reserva" \
  -d '{"type":"TEXT","content":"Test"}'
# Esperado: HTTP 201 + JSON completo

# Test 3: Verify in database
# SQL: SELECT * FROM messages WHERE content = 'Test' ORDER BY "createdAt" DESC LIMIT 1;
# Esperado: 1 linha retornada
```

##### Rollback Plan
**Se deploy falhar:**
1. Verificar logs: `docker compose logs backend --tail=100`
2. Trigger rollback via GitHub Actions workflow
3. Ou manual: `docker tag deploy-backend_backend:backup-YYYYMMDD deploy-backend_backend:latest`

**Workaround temporário (NÃO RECOMENDADO):**
- Adicionar `conversationId` de volta ao payload do frontend
- DEVE ser removido após deploy correto

##### Definition of Done
✅ Todos os 4 Acceptance Criteria passam
✅ Todos os 3 testes de validação passam
✅ Sem erros nos logs do backend
✅ Health check retorna versão correta

---

#### TASK 1.2: Validar Socket.io Event Emission
**Responsabilidade:** Backend
**Prioridade:** 🔴 CRÍTICA
**Depende de:** TASK 1.1

##### Input (Pré-requisitos)
- [x] TASK 1.1 concluída (API aceita mensagens)
- [x] Socket.io server rodando
- [x] Função `emitNewMessage()` implementada

##### Output (Deliverables)
- [ ] Backend emite evento `message:new` quando mensagem criada via API
- [ ] Evento contém payload correto
- [ ] Todos os clientes na sala recebem evento

##### Contrato de Interface
**Event Name:** `message:new`

**Payload emitido:**
```typescript
{
  conversationId: string;
  message: {
    id: string;
    type: MessageType;
    content: string;
    direction: Direction;
    status: MessageStatus;
    timestamp: string; // ISO 8601
    sentById?: string;
  }
}
```

**Rooms que recebem:**
- `conversation:${conversationId}` - Todos na conversa específica
- `tenant:${tenantId}` - Evento `conversation:updated` para atualizar lista

##### Acceptance Criteria
- [ ] **AC1:** Evento emitido imediatamente após `message.create()`
- [ ] **AC2:** Payload contém todos os campos obrigatórios
- [ ] **AC3:** Timestamp em formato ISO 8601
- [ ] **AC4:** Logs do backend mostram `"New message event emitted"`

##### Testes de Validação
```bash
# Test 1: Enable debug logs
# No backend, verificar: logger.debug({ conversationId, messageId }, 'New message event emitted')

# Test 2: Monitor Socket.io traffic
# Usar ferramenta: https://socket.io/docs/v4/admin-ui/
# Ou logs do frontend console

# Test 3: Send message via API + check logs
curl -X POST [URL] ... && docker logs crm-backend --tail=20 | grep "New message event emitted"
# Esperado: Log aparece com conversationId correto
```

##### Arquivos Envolvidos
- `deploy-backend/src/config/socket.ts:271-295` - Função `emitNewMessage()`
- `deploy-backend/src/services/message.service.v2.ts` - Chamada após criar mensagem

##### Definition of Done
✅ Todos os 4 Acceptance Criteria passam
✅ Logs mostram evento emitido
✅ Payload validado via Socket.io Inspector
✅ Documentação atualizada em `SOCKET_EVENTS.md`

---

#### TASK 1.3: Validar Frontend Socket.io Reception
**Responsabilidade:** Frontend
**Prioridade:** 🔴 CRÍTICA
**Depende de:** TASK 1.2

##### Input (Pré-requisitos)
- [x] TASK 1.2 concluída (Backend emite eventos)
- [x] Socket.io client conectado
- [x] Listener `message:new` registrado

##### Output (Deliverables)
- [ ] Frontend recebe evento `message:new`
- [ ] Listener executa callback correto
- [ ] Console mostra log `🔵🔵🔵 EVENTO message:new RECEBIDO`

##### Contrato de Interface
**Listener registrado em:**
`apps/frontend/src/contexts/socket-context.tsx:91-102`

**Callback esperado:**
```typescript
socket.on('message:new', (data: { conversationId: string; message: Message }) => {
  console.log('🔵🔵🔵 EVENTO message:new RECEBIDO', data);

  // Invalidar cache do React Query
  queryClient.invalidateQueries({
    queryKey: ['messages', data.conversationId]
  });

  // Disparar callback customizado (se existir)
  onNewMessage?.(data);
});
```

##### Acceptance Criteria
- [ ] **AC1:** Console mostra log azul quando mensagem enviada
- [ ] **AC2:** `data.conversationId` corresponde à conversa aberta
- [ ] **AC3:** `data.message` contém objeto completo
- [ ] **AC4:** Timestamp da mensagem é recente (< 5 segundos)

##### Testes de Validação
```javascript
// Test 1: Abrir console no navegador em botreserva.com.br
// Test 2: Enviar mensagem via UI ou API
// Test 3: Verificar logs aparecem em ordem:

// Esperado:
// 1. "📤📤📤 EMIT SOCKET.IO: {event: 'user:typing'}"
// 2. Request headers para POST /messages
// 3. "🔵🔵🔵 EVENTO message:new RECEBIDO {conversationId: '...', message: {...}}"
// 4. Mensagem aparece na UI SEM apertar F5
```

##### Definition of Done
✅ Todos os 4 Acceptance Criteria passam
✅ Log azul aparece no console
✅ Payload validado contém campos corretos
✅ Evento recebido em < 500ms após envio

---

#### TASK 1.4: Validar React Query Cache Invalidation
**Responsabilidade:** Frontend
**Prioridade:** 🟡 ALTA
**Depende de:** TASK 1.3

##### Input (Pré-requisitos)
- [x] TASK 1.3 concluída (Evento recebido)
- [x] React Query configurado
- [x] Query key `['messages', conversationId]` definida

##### Output (Deliverables)
- [ ] React Query invalida cache automaticamente
- [ ] useQuery re-fetcha mensagens
- [ ] UI atualiza sem F5

##### Contrato de Interface
**Query Key:** `['messages', conversationId]`

**Invalidation call:**
```typescript
queryClient.invalidateQueries({
  queryKey: ['messages', conversationId]
});
```

**Expected behavior:**
1. Cache marcado como stale
2. useQuery detecta stale
3. Re-fetch automático disparado
4. UI re-renderiza com nova mensagem

##### Acceptance Criteria
- [ ] **AC1:** DevTools React Query mostra cache invalidado
- [ ] **AC2:** Network tab mostra GET /messages após evento
- [ ] **AC3:** Nova mensagem aparece na lista
- [ ] **AC4:** Scroll automático para última mensagem

##### Testes de Validação
```javascript
// Test 1: Abrir React Query DevTools
// https://tanstack.com/query/latest/docs/devtools

// Test 2: Verificar estado da query antes e depois
// Antes: status: 'success', dataUpdatedAt: TIMESTAMP_1
// Após evento: status: 'loading' → 'success', dataUpdatedAt: TIMESTAMP_2

// Test 3: Verificar Network tab
// Esperado: GET /api/conversations/UUID/messages após evento Socket.io
```

##### Arquivos Envolvidos
- `apps/frontend/src/hooks/useMessages.ts` - Query hook
- `apps/frontend/src/contexts/socket-context.tsx` - Invalidation call
- `apps/frontend/src/components/MessageList.tsx` - UI component

##### Definition of Done
✅ Todos os 4 Acceptance Criteria passam
✅ React Query DevTools mostra invalidação
✅ UI atualiza em < 1 segundo
✅ Sem flicker ou loading states visíveis

---

#### TASK 1.5: End-to-End Integration Test
**Responsabilidade:** QA/FullStack
**Prioridade:** 🔴 CRÍTICA
**Depende de:** TASK 1.4

##### Input (Pré-requisitos)
- [x] TODAS as tasks anteriores concluídas
- [x] Frontend e Backend em produção

##### Output (Deliverables)
- [ ] Script automatizado de teste E2E
- [ ] Teste passa 100% das vezes
- [ ] Documentação de como executar

##### Teste Completo
```bash
#!/bin/bash
# test-message-realtime.sh

CONVERSATION_ID="c220fbae-a594-4c03-994d-a116fa9a917d"
TOKEN="[VALID_JWT_TOKEN]"

echo "=== TESTE E2E: MENSAGEM EM TEMPO REAL ==="

# Step 1: Send message via API
echo "1. Enviando mensagem via API..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.botreserva.com.br/api/conversations/${CONVERSATION_ID}/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-tenant-slug: hoteis-reserva" \
  -d "{\"type\":\"TEXT\",\"content\":\"E2E Test $(date +%s)\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" != "201" ]; then
  echo "❌ FALHA: API retornou $HTTP_CODE"
  echo "$BODY"
  exit 1
fi

echo "✅ API retornou 201"

MESSAGE_ID=$(echo "$BODY" | jq -r '.id')
echo "Message ID: $MESSAGE_ID"

# Step 2: Verify in database
echo "2. Verificando mensagem no banco..."
# (Executar via psql ou DBeaver)

# Step 3: Verify Socket.io event (manual via browser console)
echo "3. Verificar no browser console:"
echo "   - Abrir https://www.botreserva.com.br/dashboard/conversations/${CONVERSATION_ID}"
echo "   - Verificar log: 🔵🔵🔵 EVENTO message:new RECEBIDO"
echo "   - Mensagem deve aparecer automaticamente"

echo ""
echo "✅ TESTE E2E COMPLETO"
```

##### Acceptance Criteria
- [ ] **AC1:** Script executa sem erros
- [ ] **AC2:** API retorna 201 Created
- [ ] **AC3:** Mensagem salva no banco
- [ ] **AC4:** Evento Socket.io recebido no frontend
- [ ] **AC5:** UI atualiza sem F5
- [ ] **AC6:** Tempo total < 3 segundos

##### Definition of Done
✅ Script criado e documentado
✅ Todos os 6 Acceptance Criteria passam
✅ Teste executado 5x seguidas com sucesso
✅ README atualizado com instruções

---

### ÉPICO 2: WHATSAPP INTEGRATION 🟢 IMPORTANTE

**Objetivo:** Receber mensagens reais do WhatsApp e exibir no CRM

#### TASK 2.1: Atualizar WhatsApp Access Token
**Prioridade:** 🟡 ALTA
**Status:** ⏸️ EM PAUSA (aguardando ÉPICO 1)

#### TASK 2.2: Testar Webhook de Mensagens
**Prioridade:** 🟡 ALTA
**Status:** ⏸️ EM PAUSA

#### TASK 2.3: Validar Fluxo WhatsApp → CRM
**Prioridade:** 🟡 ALTA
**Status:** ⏸️ EM PAUSA

---

### ÉPICO 3: PRODUCTION HARDENING 🔵 NORMAL

**Objetivo:** Sistema pronto para carga e observabilidade

#### TASK 3.1: Implementar Logging Service
**Prioridade:** 🔵 NORMAL
**Status:** ⏸️ EM PAUSA

**Opções:**
- Sentry.io (errors + performance)
- LogRocket (session replay)
- DataDog (APM completo)

#### TASK 3.2: Re-habilitar removeConsole
**Prioridade:** 🔵 NORMAL
**Status:** ⏸️ EM PAUSA

**Depende de:** TASK 3.1

#### TASK 3.3: Configurar Monitoring & Alerts
**Prioridade:** 🔵 NORMAL
**Status:** ⏸️ EM PAUSA

---

## 🚦 EXECUTION PLAN

### FASE 1: CRITICAL PATH (AGORA)
1. ✅ **TASK 1.1:** Deploy do validator fix - **1-2 horas**
2. ✅ **TASK 1.2:** Validar Socket.io emission - **30 min**
3. ✅ **TASK 1.3:** Validar frontend reception - **30 min**
4. ✅ **TASK 1.4:** Validar React Query - **1 hora**
5. ✅ **TASK 1.5:** Teste E2E - **1 hora**

**Total estimado:** 4-5 horas
**Meta:** Sistema funcionando 100% hoje

### FASE 2: WHATSAPP INTEGRATION (DIA 21/11)
1. TASK 2.1, 2.2, 2.3
**Total estimado:** 3-4 horas

### FASE 3: PRODUCTION READY (DIA 22/11)
1. TASK 3.1, 3.2, 3.3
**Total estimado:** 4-6 horas

---

## 📋 QUALITY GATES

### GATE 1: CODE REVIEW
- [ ] TypeScript sem erros
- [ ] ESLint sem warnings
- [ ] Prettier formatado
- [ ] Testes unitários passam

### GATE 2: INTEGRATION TEST
- [ ] API retorna status corretos
- [ ] Socket.io emite/recebe eventos
- [ ] Database persistence validada

### GATE 3: E2E TEST
- [ ] Fluxo completo funciona
- [ ] Performance < 3s end-to-end
- [ ] Sem memory leaks

### GATE 4: PRODUCTION READY
- [ ] Deploy via CI/CD
- [ ] Health checks passam
- [ ] Logs estruturados
- [ ] Monitoring ativo

---

## 🔴 REGRAS INEGOCIÁVEIS

1. **NÃO PULE TASKS** - Dependências devem ser respeitadas
2. **NÃO FAÇA WORKAROUNDS** - Solução definitiva ou nada
3. **NÃO ASSUMA QUE FUNCIONA** - Teste TUDO com evidências
4. **NÃO DEIXE DÍVIDA TÉCNICA** - Corrija agora ou documente como TASK
5. **NÃO COMMIT SEM TESTES** - Definition of Done é obrigatória

---

## 📊 PROGRESSO ATUAL

**ÉPICO 1:** █░░░░ 20% (TASK 1.1 em andamento)
**ÉPICO 2:** ░░░░░ 0% (Aguardando ÉPICO 1)
**ÉPICO 3:** ░░░░░ 0% (Aguardando ÉPICO 1)

**Overall:** █░░░░░░░░░ 10%

---

**Última atualização:** 2025-11-20 02:45 BRT
**Responsável:** Tech Lead (Claude Code)
**Status:** 🔴 BLOQUEADO aguardando deploy de `b6867c6`
