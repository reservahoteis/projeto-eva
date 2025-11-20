# RELATÓRIO DE AUDITORIA: FRONTEND KANBAN E COMPATIBILIDADE BOT_HANDLING

**Data:** 2025-11-20
**Sistema:** CRM WhatsApp SaaS Multi-Tenant
**Escopo:** Validação de Filtros Kanban + Compatibilidade BOT_HANDLING
**Auditor:** Claude Code (Frontend Developer Specialist)

---

## RESUMO EXECUTIVO

**STATUS GERAL:** ❌ **SISTEMA NÃO ESTÁ PREPARADO PARA BOT_HANDLING**

**IMPACTO:** ALTO - Adicionar BOT_HANDLING ao enum causará quebras de UI e lógica de filtros inadequada

**AÇÃO REQUERIDA:** Correções obrigatórias antes de deploy em produção

---

## 🔴 PROBLEMA CRÍTICO #1: DIVERGÊNCIA DE ENUMS

### Backend (Prisma) vs Frontend (TypeScript)

**Backend Schema:**
```prisma
enum ConversationStatus {
  OPEN
  IN_PROGRESS
  WAITING
  CLOSED
}
```

**Frontend Types:**
```typescript
export enum ConversationStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',      // ❌ Não existe no backend!
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',    // ❌ Não existe no backend!
  CLOSED = 'CLOSED',
}
```

**PROBLEMAS:**
1. ❌ Frontend tem `PENDING` - backend NÃO tem
2. ❌ Frontend tem `RESOLVED` - backend NÃO tem
3. ❌ Backend tem `WAITING` - frontend NÃO tem
4. ❌ Frontend NÃO tem `BOT_HANDLING`

---

## 🔴 PROBLEMA CRÍTICO #2: FILTRO "TODAS" RETORNA BOT_HANDLING

**Arquivo:** `apps/frontend/src/app/dashboard/conversations/page.tsx`

```typescript
// Linha 17-24: NÃO FILTRA BOT_HANDLING!
const { data: conversations } = useQuery({
  queryKey: ['conversations', selectedStatus],
  queryFn: () =>
    conversationService.list({
      status: selectedStatus === 'all' ? undefined : selectedStatus,
      limit: 100,
    }),
});
```

**ANÁLISE:**
- ❌ Se `selectedStatus === 'all'`, chama API SEM filtro `status`
- ❌ Retorna TODAS as conversas, incluindo BOT_HANDLING
- ❌ Kanban mostrará conversas BOT_HANDLING erroneamente

**RISCO:** **CRÍTICO** - Conversas gerenciadas por IA aparecerão no Kanban humano

---

## 🔴 PROBLEMA CRÍTICO #3: KANBAN COLUMNS HARDCODED

**Arquivo:** `apps/frontend/src/components/tenant/kanban-board.tsx`

```typescript
// Linha 17-22: COLUNAS COM STATUS ERRADOS
const columns = [
  { id: ConversationStatus.OPEN, title: 'Abertas', color: 'border-yellow-500' },
  { id: ConversationStatus.PENDING, title: 'Pendentes', color: 'border-orange-500' },  // ❌
  { id: ConversationStatus.IN_PROGRESS, title: 'Em Andamento', color: 'border-blue-500' },
  { id: ConversationStatus.RESOLVED, title: 'Resolvidas', color: 'border-green-500' },  // ❌
];
```

**PROBLEMAS:**
- ❌ `PENDING` e `RESOLVED` não existem no backend!
- ❌ Falta coluna `WAITING` que existe no backend
- ❌ Conversas `BOT_HANDLING` aparecerão em "Nenhuma conversa"

---

## ✅ DIAGNÓSTICO: SOCKET.IO REAL-TIME

### O SISTEMA ESTÁ CORRETO - PROBLEMA PROVÁVEL É BACKEND

**EVIDÊNCIAS:**

1. ✅ Socket conecta e registra listeners
2. ✅ Listener `message:new` registrado corretamente
3. ✅ Cache invalidation implementado
4. ✅ Subscription a conversas implementada

### POSSÍVEIS CAUSAS DO PROBLEMA "MENSAGENS NÃO APARECEM"

1. Backend não emite `message:new` corretamente
2. Room não está sendo joinado
3. TenantId/ConversationId incorretos
4. Evento chega mas payload está incorreto

**RECOMENDAÇÃO:** Investigar logs do backend ao enviar mensagem

---

## 🔧 CÓDIGO CORRIGIDO

### CORREÇÃO 1: Types Frontend

**Arquivo:** `apps/frontend/src/types/index.ts`

```typescript
export enum ConversationStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  CLOSED = 'CLOSED',
  BOT_HANDLING = 'BOT_HANDLING', // ← IA está gerenciando
}

// Type guard para status visíveis no Kanban
export const KANBAN_VISIBLE_STATUS: ConversationStatus[] = [
  ConversationStatus.OPEN,
  ConversationStatus.IN_PROGRESS,
  ConversationStatus.WAITING,
];

export function isKanbanVisible(status: ConversationStatus): boolean {
  return KANBAN_VISIBLE_STATUS.includes(status);
}
```

### CORREÇÃO 2: Kanban Columns

**Arquivo:** `apps/frontend/src/components/tenant/kanban-board.tsx`

```typescript
const columns = [
  { id: ConversationStatus.OPEN, title: 'Abertas', color: 'border-yellow-500' },
  { id: ConversationStatus.IN_PROGRESS, title: 'Em Andamento', color: 'border-blue-500' },
  { id: ConversationStatus.WAITING, title: 'Aguardando Cliente', color: 'border-orange-500' },
];

const getConversationsForColumn = (status: ConversationStatus) => {
  return optimisticConversations.filter((conv) =>
    conv.status === status && isKanbanVisible(conv.status)
  );
};
```

### CORREÇÃO 3: Filtro de Status

**Arquivo:** `apps/frontend/src/app/dashboard/conversations/page.tsx`

```typescript
const { data: conversations, isLoading, refetch } = useQuery({
  queryKey: ['conversations', selectedStatus],
  queryFn: () => {
    // Se "all", retornar apenas status visíveis no Kanban
    const statusFilter = selectedStatus === 'all'
      ? KANBAN_VISIBLE_STATUS.join(',')  // "OPEN,IN_PROGRESS,WAITING"
      : selectedStatus;

    return conversationService.list({
      status: statusFilter,
      limit: 100,
    });
  },
});
```

### CORREÇÃO 4: Tabs Corretas

```typescript
<Tabs value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
  <TabsList>
    <TabsTrigger value="all">Todas</TabsTrigger>
    <TabsTrigger value={ConversationStatus.OPEN}>Abertas</TabsTrigger>
    <TabsTrigger value={ConversationStatus.IN_PROGRESS}>Em Andamento</TabsTrigger>
    <TabsTrigger value={ConversationStatus.WAITING}>Aguardando</TabsTrigger>
  </TabsList>
</Tabs>
```

### CORREÇÃO 5: Backend - Filtro Múltiplo

**Arquivo:** `deploy-backend/src/services/conversation.service.ts`

```typescript
if (params.status) {
  // Suportar CSV: "OPEN,IN_PROGRESS,WAITING"
  if (params.status.includes(',')) {
    where.status = {
      in: params.status.split(',') as ConversationStatus[],
    };
  } else {
    where.status = params.status as ConversationStatus;
  }
}
```

---

## 📋 PLANO DE TESTES

### TESTE 1: BOT_HANDLING não aparece no Kanban

```sql
-- Criar conversa BOT_HANDLING
UPDATE conversations SET status = 'BOT_HANDLING' WHERE id = 'xxx';
```

**Passos:**
1. Abrir `/dashboard/conversations`
2. Verificar que conversa NÃO aparece

**Expected:** ✅ Conversa invisível

### TESTE 2: Transição BOT_HANDLING → OPEN

```sql
UPDATE conversations SET status = 'OPEN' WHERE id = 'xxx';
```

**Expected:** ✅ Conversa aparece na coluna "Abertas" SEM F5

### TESTE 3: Mensagens em Tempo Real

```bash
POST https://api.botreserva.com.br/api/conversations/{id}/messages
{
  "type": "TEXT",
  "content": "Teste real-time"
}
```

**Expected:** ✅ Mensagem aparece instantaneamente

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### FRONTEND
- [ ] Atualizar `types/index.ts` com enum correto
- [ ] Adicionar `KANBAN_VISIBLE_STATUS` e `isKanbanVisible()`
- [ ] Corrigir colunas do Kanban (OPEN, IN_PROGRESS, WAITING)
- [ ] Corrigir tabs de filtro
- [ ] Implementar filtro múltiplo na API call
- [ ] Adicionar listener `conversation:updated`

### BACKEND
- [ ] Atualizar service para suportar filtro múltiplo
- [ ] Verificar Socket.io emit `message:new`
- [ ] Verificar `socket.join(conversationId)`

### QA
- [ ] Teste: BOT_HANDLING não aparece no Kanban
- [ ] Teste: Transição BOT_HANDLING → OPEN
- [ ] Teste: Mensagens aparecem sem F5

---

## 🎯 CONCLUSÃO

**STATUS:** ❌ Sistema NÃO está pronto

**APÓS CORREÇÕES:** ✅ Sistema 100% compatível

**TEMPO ESTIMADO:** 2-3 horas frontend + 1 hora backend

---

**FIM DA AUDITORIA FRONTEND KANBAN**
