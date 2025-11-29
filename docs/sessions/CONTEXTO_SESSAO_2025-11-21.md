# 📋 CONTEXTO DA SESSÃO - 21 de Novembro de 2025

## 🎯 Objetivo da Sessão
Resolver mensagens tempo real + Ajustar layout WhatsApp UI

---

## 📊 Estado Atual do Sistema

### ✅ O QUE ESTÁ FUNCIONANDO
1. **Database Schema**
   - ✅ Enum BOT_HANDLING ativo (Migration 001 aplicada)
   - ✅ Campo source com índices (Migration 002 aplicada)
   - ✅ 3 conversas marcadas como 'legacy'

2. **Backend API**
   - ✅ Endpoint POST /api/conversations implementado
   - ✅ Service createFromPhone() criado (auto-cria Contact)
   - ✅ Validator createConversationSchema ativo
   - ✅ Socket.io não emite para status BOT_HANDLING

3. **WhatsApp Web UI**
   - ✅ 7 componentes criados (message-bubble, chat-header, chat-input, etc)
   - ✅ Design 100% fiel ao WhatsApp Web
   - ✅ Auto-scroll implementado
   - ✅ Status indicators (checkmarks)
   - ✅ Date dividers ("HOJE", "ONTEM")
   - ✅ Agrupamento de mensagens (<5min)

4. **Build & Deploy**
   - ✅ TypeScript build limpo (0 erros, 0 warnings)
   - ✅ Commit 971063f enviado para GitHub
   - ✅ Deploy Vercel em produção

### ❌ O QUE NÃO ESTÁ FUNCIONANDO

#### 🔴 PROBLEMA CRÍTICO #1: Mensagens Tempo Real
**Sintoma:** Mensagens não aparecem sem atualizar página (F5)

**Diagnóstico:**
- Socket.io: ✅ Conecta
- Listeners: ✅ Registrados
- Backend emit: ❓ Desconhecido (não testado)
- Payload: ✅ Código corrigido (conversation incluído)

**Causa Provável:**
- Backend NÃO está emitindo eventos `message:new` ao enviar mensagem
- OU payload ainda está incorreto na produção
- OU event listener não está sendo acionado

**Próximo Passo:**
1. Verificar logs backend ao enviar mensagem
2. Confirmar se evento está sendo emitido
3. Adicionar listener `conversation:updated` se necessário
4. Considerar Redis pub/sub se multi-server

#### 🟡 PROBLEMA MÉDIO #2: Layout Mensagens Próprias
**Sintoma:** Mensagens enviadas por mim aparecem no meio da tela

**Esperado:** WhatsApp Web alinha mensagens próprias próximas à borda direita

**Causa:** CSS `max-w-[65%] ml-auto` não está funcionando corretamente

**Arquivo:** `apps/frontend/src/components/chat/message-bubble.tsx` linha 70

**Próximo Passo:**
- Ajustar container flex
- Testar com `justify-end` no parent
- Validar em diferentes tamanhos de tela

---

## 🗂️ Arquivos Relevantes

### Backend - Socket.io
```
deploy-backend/src/config/socket.ts
  - emitNewMessage() - linha 89 (corrigido, tem conversation param)
  - emitMessageStatusUpdate() - linha 105
  - emitNewConversation() - linha 121
  - emitConversationUpdate() - linha 136

deploy-backend/src/queues/workers/process-outgoing-message.worker.ts
  - Linha 158-193: emitNewMessage com conversation object

deploy-backend/src/queues/workers/process-incoming-message.worker.ts
  - Linha 80-119: emitNewMessage com conversation object

deploy-backend/src/controllers/message.controller.ts
  - send() method - enfileira mensagem
```

### Frontend - Chat Components
```
apps/frontend/src/app/dashboard/conversations/[id]/page.tsx
  - Socket.io listeners (linha 58-85)
  - message:new handler
  - conversation:join/leave

apps/frontend/src/components/chat/message-bubble.tsx
  - Linha 26-27: bubbleColor e alignment
  - Linha 70: Container com ml-auto (PROBLEMA)

apps/frontend/src/components/chat/message-list.tsx
  - Auto-scroll logic
  - Message grouping
```

### Logs & Scripts
```
test-send-message-api.js - Script para testar API
test-realtime-fix.sh - Script bash para teste
```

---

## 🔧 Configuração VPS

**Host:** 72.61.39.235
**User:** root
**Arquitetura:** Docker Compose

**Containers:**
```bash
crm-backend   # Node.js backend
crm-postgres  # PostgreSQL 16
crm-redis     # Redis
```

**Comandos Úteis:**
```bash
# Ver logs backend
ssh root@72.61.39.235 "docker logs crm-backend -f --tail 100"

# Executar comando no backend
ssh root@72.61.39.235 "docker exec crm-backend <comando>"

# Reiniciar backend
ssh root@72.61.39.235 "docker restart crm-backend"

# Acessar PostgreSQL
ssh root@72.61.39.235 "docker exec -it crm-postgres psql -U crm_user -d crm_whatsapp_saas"

# Ver queries SQL
ssh root@72.61.39.235 "docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c 'SELECT * FROM conversations LIMIT 5;'"
```

---

## 📚 Relatórios de Auditoria (Referência)

Criados em 20/11/2025 por agentes especializados:

1. **AUDIT_DATABASE_SCHEMA_COMPLETE.md**
   - Nota: 7.5/10 → 9.0/10 (após correções)
   - Identificou falta de BOT_HANDLING e source
   - Migrations SQL completas

2. **AUDIT_API_ENDPOINTS_COMPLETE.md**
   - Status: 88% → 100% (após implementação)
   - POST /api/conversations documentado
   - Testes curl incluídos

3. **AUDIT_FRONTEND_KANBAN_COMPLETE.md**
   - Divergência enum frontend vs backend
   - Filtro "Todas" retorna BOT_HANDLING erroneamente
   - Correções necessárias (ainda pendente)

4. **SOCKET_REALTIME_FIX_COMPLETE.md**
   - Diagnóstico: payload incompleto
   - Correção: adicionar conversation object
   - Status: código corrigido, não testado

---

## 🎯 Tarefas Prioritárias para Hoje (21/11)

### 🔥 CRÍTICO
- [ ] **Diagnosticar mensagens tempo real**
  - SSH na VPS
  - Ver logs ao enviar mensagem
  - Confirmar evento `message:new` emitido
  - Validar payload completo
  - Testar listener `conversation:updated`

### 🟡 ALTA
- [ ] **Corrigir layout mensagens próprias**
  - Ajustar CSS em message-bubble.tsx
  - Alinhar próximo à borda direita
  - Testar em mobile/desktop

### 📋 MÉDIA (se houver tempo)
- [ ] Testar endpoint POST /api/conversations (após Meta aprovar)
- [ ] Sincronizar enum frontend (remover PENDING/RESOLVED)
- [ ] Implementar filtro múltiplo Kanban

---

## 🔑 Credenciais & IDs

**Tenant ID:**
```
916ca70a-0428-47f8-98a3-0f791e42f292
```

**Conversation ID de Teste:**
```
c220fbae-a594-4c03-994d-a116fa9a917d
```

**JWT Token:**
- Expira em 15 minutos
- Armazenado em localStorage como `accessToken`
- Renovar se necessário

**URLs:**
- Frontend: https://www.botreserva.com.br
- Backend: https://api.botreserva.com.br
- VPS: 72.61.39.235

---

## 📝 Histórico Recente (Últimos 3 Dias)

### 19/11/2025
- Socket.io conexão implementada
- Problema: cache Vercel (removeConsole)
- Solução: Desabilitar removeConsole temporariamente

### 20/11/2025
- 4 auditorias completas (agentes especializados)
- Migrations aplicadas (BOT_HANDLING + source)
- Endpoint POST /api/conversations implementado
- WhatsApp Web UI replicado (7 componentes)
- Correção Socket.io payload (conversation object)
- **Problema:** Mensagens tempo real AINDA não funciona

### 21/11/2025 (HOJE)
- **Meta:** Resolver mensagens tempo real
- **Meta:** Ajustar layout mensagens próprias

---

## 🎓 Lições Importantes

1. **Docker vs PM2:**
   - Backend está em Docker, não PM2
   - Sempre usar `docker exec crm-backend`

2. **Socket.io Payload:**
   - Frontend precisa objeto `conversation` completo
   - Não apenas conversationId

3. **CSS WhatsApp:**
   - Agrupamento de mensagens com border-radius dinâmico
   - max-w-[65%] para evitar mensagens muito largas
   - Background: #e5ddd5 com pattern SVG

4. **Prisma Migrations:**
   - Manual SQL para mudanças de enum
   - `npx prisma generate` após migration
   - Restart backend necessário

---

## 💡 Dicas de Debug

### Backend Logs
```bash
# Ver logs em tempo real
ssh root@72.61.39.235 "docker logs crm-backend -f --tail 100"

# Procurar por "message:new" nos logs
ssh root@72.61.39.235 "docker logs crm-backend --tail 1000 | grep 'message:new'"

# Procurar por "emitNewMessage"
ssh root@72.61.39.235 "docker logs crm-backend --tail 1000 | grep 'emitNewMessage'"
```

### Frontend Console
```javascript
// No DevTools Console
window.socket // Verificar instância Socket.io
window.socket.connected // true se conectado
window.socket.id // ID da conexão

// Ver todos os listeners
window.socket._callbacks // Object com todos os eventos
```

### PostgreSQL Queries
```sql
-- Ver conversas recentes
SELECT id, status, source, "contactId", "createdAt"
FROM conversations
WHERE "tenantId" = '916ca70a-0428-47f8-98a3-0f791e42f292'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Ver mensagens de uma conversa
SELECT id, content, direction, status, "createdAt"
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d'
ORDER BY "createdAt" DESC
LIMIT 20;

-- Verificar enum ConversationStatus
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'ConversationStatus'
ORDER BY enumsortorder;
```

---

## 🚀 Quick Start para Debug

### 1. Abrir 3 Terminais

**Terminal 1 - Backend Logs:**
```bash
ssh root@72.61.39.235 "docker logs crm-backend -f --tail 100"
```

**Terminal 2 - Frontend Dev:**
```bash
cd apps/frontend
npm run dev
```

**Terminal 3 - Comandos:**
```bash
# Disponível para executar comandos
```

### 2. Abrir 2 Browsers

**Browser 1:** https://www.botreserva.com.br/dashboard/conversations/c220fbae-a594-4c03-994d-a116fa9a917d

**Browser 2:** Console DevTools aberto (F12)

### 3. Testar Envio de Mensagem

1. Digitar mensagem no chat input
2. Clicar em Send
3. **Terminal 1:** Verificar se aparece log "emitNewMessage"
4. **Browser 2:** Verificar se dispara event listener "message:new"
5. Verificar se mensagem aparece SEM F5

---

## 📊 Success Criteria

### ✅ Mensagens Tempo Real Funcionando
- [ ] Enviar mensagem no Browser 1
- [ ] Mensagem aparece INSTANTANEAMENTE (sem F5)
- [ ] Logs backend mostram "emitNewMessage"
- [ ] Console frontend mostra "🔔 Nova mensagem recebida"
- [ ] Cache React Query atualizado automaticamente

### ✅ Layout Correto
- [ ] Mensagens próprias alinhadas próximo à borda direita
- [ ] Espaçamento máximo 35% da tela (max-w-[65%])
- [ ] Visual idêntico ao WhatsApp Web
- [ ] Funciona em mobile e desktop

---

## 🔗 Links Importantes

**GitHub Repo:**
https://github.com/fredcast/projeto-eva

**Documentação WhatsApp API:**
https://developers.facebook.com/docs/whatsapp/cloud-api

**Socket.io Docs:**
https://socket.io/docs/v4/

**Prisma Docs:**
https://www.prisma.io/docs

---

**Última Atualização:** 20/11/2025 18:15
**Próxima Sessão:** 21/11/2025
**Prioridade #1:** Resolver mensagens tempo real
**Prioridade #2:** Ajustar layout mensagens próprias
