# 📋 CONTEXTO COMPLETO DA SESSÃO - 20/11/2025

**Propósito deste documento:** Documentar TUDO que foi feito até agora para continuar trabalho em nova sessão com agentes especializados.

---

## 🎯 OBJETIVO PRINCIPAL DO PROJETO

### **O QUE É O PROJETO**

Sistema CRM WhatsApp SaaS Multi-Tenant para rede de hotéis **Smart Hotéis Reserva** com arquitetura híbrida **IA + Humano**.

### **ARQUITETURA HÍBRIDA - O DIFERENCIAL**

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENTE (WhatsApp)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  N8N - AGENTE IA (OpenAI)                    │
│  • Resolve 80% das conversas automaticamente                │
│  • Workflows: MARCIO IA CONVERSACIONAL                      │
│  • Contexto: Reservas, check-in, dúvidas, etc               │
└────────────┬────────────────────────────┬───────────────────┘
             │                            │
             │ 80% RESOLVIDO             │ 20% ESCALONA
             │ (Fechado)                 │ (Para humano)
             ▼                            ▼
        [Finalizado]          ┌──────────────────────────────┐
                              │   CRM - ATENDENTE HUMANO     │
                              │  • Kanban Board              │
                              │  • Chat em tempo real        │
                              │  • Envia para WhatsApp API   │
                              └──────────────────────────────┘
```

**FLUXO DE STATUS:**
```
BOT_HANDLING (IA atendendo - NÃO aparece no Kanban)
      ↓
   OPEN (Escalado para humano - APARECE no Kanban)
      ↓
IN_PROGRESS (Atendente conversando)
      ↓
  WAITING (Aguardando resposta do cliente)
      ↓
  CLOSED (Finalizado)
```

### **STACK TECNOLÓGICO**

**Backend:**
- Node.js 20.11.0 LTS
- TypeScript 5.3.3
- Express 4.18.2
- Prisma 5.9.1 (ORM)
- PostgreSQL 16.1
- Socket.io 4.x (tempo real)
- Zod 3.22.4 (validação)
- Deploy: VPS Docker (api.botreserva.com.br)

**Frontend:**
- Next.js 14.1 (App Router)
- React 18.2
- TypeScript 5.3.3
- React Query (TanStack Query)
- Socket.io-client 4.x
- Tailwind CSS
- Deploy: Vercel (botreserva.com.br)

**IA & Automação:**
- N8N (workflows)
- OpenAI API (GPT-4)
- WhatsApp Business API (Meta v21.0)

**Infraestrutura:**
- VPS: 72.61.39.235 (Ubuntu 24.04)
- SSL: Let's Encrypt (HTTPS ativo)
- Docker + Docker Compose
- GitHub Actions (CI/CD)

---

## 📊 STATUS ATUAL DO PROJETO

### ✅ **O QUE ESTÁ 100% FUNCIONANDO**

#### Backend (api.botreserva.com.br)
- ✅ Multi-tenant architecture (isolamento por tenantId)
- ✅ Autenticação JWT
- ✅ Endpoints REST completos
- ✅ WhatsApp Business API integration
- ✅ Socket.io server configurado
- ✅ Database schema Prisma (com gaps identificados)
- ✅ Deploy automático VPS via GitHub Actions
- ✅ HTTPS com certificado válido

#### Frontend (botreserva.com.br)
- ✅ Autenticação (login/logout)
- ✅ Kanban board de conversas
- ✅ Chat interface
- ✅ Socket.io client conectado
- ✅ React Query para cache
- ✅ Deploy Vercel automático
- ✅ HTTPS

#### Integrações
- ✅ WhatsApp Business API configurada
- ✅ Webhooks WhatsApp recebendo mensagens
- ✅ N8N workflows criados (8 arquivos JSON)

### ⚠️ **O QUE ESTÁ PARCIALMENTE FUNCIONANDO**

#### Socket.io Real-Time
- ✅ Conexão estabelecida
- ✅ Autenticação JWT via Socket.io
- ✅ Rooms configuradas (tenant, conversation, user)
- ✅ Event listeners registrados
- ❌ **Mensagens NÃO aparecem sem F5** (bug principal a resolver)
- ⚠️ Bug 400 no POST /api/conversations/:id/messages (CORRIGIDO localmente, aguardando deploy)

#### Deploy Pipeline
- ✅ GitHub Actions configurado
- ✅ Deploy automático funciona
- ⚠️ Último commit (b6867c6) esperando confirmação de deploy

### ❌ **O QUE NÃO ESTÁ FUNCIONANDO / NÃO EXISTE**

#### Integração N8N → CRM
- ❌ **BLOQUEADOR:** Enum `ConversationStatus` sem valor `BOT_HANDLING`
- ❌ **BLOQUEADOR:** Endpoint POST /api/conversations não aceita `contactPhoneNumber`
- ❌ **IMPORTANTE:** Campo `source` ausente em Conversation
- ❌ N8N não consegue criar conversa sem aparecer no Kanban
- ❌ Função `notificar_atendente` do N8N ainda envia link WhatsApp (não chama CRM)

#### Real-Time Messaging
- ❌ Mensagens enviadas via API não aparecem automaticamente no chat
- ❌ Precisa F5 para ver mensagens novas
- ❌ Socket.io event `message:new` não atualiza UI

---

## 🔥 HISTÓRICO DO QUE FOI FEITO (SESSÕES ANTERIORES)

### **Sessão 19/11/2025 (Dia anterior)**

#### Problemas Enfrentados:
1. ❌ Socket.io não funcionava
2. ❌ Mensagens com erro de serialização de Date
3. ❌ Frontend não atualizava sem F5
4. ❌ Múltiplas tentativas de "agora vai funcionar" sem sucesso

#### Soluções Implementadas:
1. ✅ Corrigido serialização Date → ISO strings em message.service.v2.ts
2. ✅ Configurado Socket.io com JWT auth
3. ✅ Criado WORK_LOG_2025-11-19.md documentando tudo
4. ⚠️ Socket.io conecta mas mensagens não aparecem ainda

### **Sessão 20/11/2025 (HOJE) - Parte 1**

#### 1. Tentativas de Fix Socket.io Real-Time

**Problema:** Mensagens enviadas via API não aparecem sem F5

**Tentativas:**
- Deploy #1: Ajustes no Socket.io event handlers ❌
- Deploy #2: Union types para backward compatibility ❌
- Deploy #3: Mais ajustes ❌
- Deploy #4: Verificação de listeners ❌
- Deploy #5: Debug logs ❌

**Descoberta:** `removeConsole: true` no next.config.mjs estava removendo TODOS os console.logs no build de produção, impossibilitando debug.

**Fix:** Desabilitado `removeConsole` temporariamente ✅

**Resultado:** Console.logs apareceram, mas mensagens ainda não atualizam automaticamente.

#### 2. Descoberta do Bug 400

**Erro:** POST /api/conversations/:id/messages retornava 400 Bad Request

**Causa:** Validator `sendMessageSchema` esperava `conversationId` no body, mas a rota RESTful (`/:conversationId/messages`) já passa o ID no URL.

**Fix Aplicado:** (commit b6867c6)
```typescript
// ANTES (ERRADO)
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(), // ❌ Vem do URL, não do body
  content: z.string(),
});

// DEPOIS (CORRETO)
export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Conteúdo é obrigatório').max(4096),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']).optional(),
  metadata: z.record(z.any()).optional(),
  // ✅ conversationId REMOVIDO - vem do route param
});
```

**Status:** Código commitado, aguardando deploy completar.

#### 3. REVELAÇÃO IMPORTANTE - Arquitetura Híbrida IA + Humano

**Momento chave:** Usuário revelou que o projeto NÃO é apenas um CRM, mas sim:

> "NÓS TEMOS UM AGENTE DE ATENDIMENTO COM IA NO N8N. A IA RESOLVE 80% DAS CONVERSAS. O CRM RECEBE APENAS AS CONVERSAS QUE A IA ESCALONA."

Isso mudou COMPLETAMENTE o entendimento do projeto.

**Implicações:**
- N8N precisa criar conversas com status `BOT_HANDLING`
- Conversas `BOT_HANDLING` NÃO podem aparecer no Kanban
- Apenas conversas `OPEN`, `IN_PROGRESS`, `WAITING` aparecem no Kanban
- Database schema atual NÃO suporta isso (GAP CRÍTICO)

#### 4. Análise dos Workflows N8N

**Arquivos analisados:**
- `fluxo-n8n/MARCIO - IA CONVERSACIONAL.json` (2811 linhas)
- `fluxo-n8n/EXT - MARCIO IA COMERCIAL.json` (1570 linhas)
- `fluxo-n8n/EXT - MARCIO IA HOSPEDE.json` (1048 linhas)
- 5 outros workflows

**Descoberta:** N8N tem função `notificar_atendente` que atualmente envia link WhatsApp:
```javascript
// ATUAL (ERRADO)
https://wa.me/5511973178256

// DEVERIA SER (CORRETO)
POST https://api.botreserva.com.br/api/conversations
{
  contactPhoneNumber: "5511999999999",
  status: "BOT_HANDLING",
  source: "n8n",
  metadata: {
    flowId: "MARCIO - IA CONVERSACIONAL",
    escalationReason: "user_requested_human"
  }
}
```

#### 5. Mudança de Filosofia de Desenvolvimento

**Usuário estabeleceu novo padrão:**

> "EU QUERO QUE FAÇAMOS UM TRABALHO DOÍDO, CUSTOSO, MAS QUE VÁ PODER PROSSEGUIR COM CLAREZA DE QUE ESTÁ NO ESTÁGIO CERTO COM 100% DE CERTEZA."

> "QUALIDADE EM PRIMEIRO LUGAR - Não deu certo? Busca uma alternativa definitiva e que vá de fato resolver mantendo o padrão de alta qualidade de codigo."

**Mandatos:**
1. ✅ Auditar projeto completo antes de prosseguir ("pente fino")
2. ✅ Cada componente 100% validado antes do próximo
3. ✅ Usar agentes especializados apropriados
4. ❌ NUNCA mais "solução rápida" ou "gambiarra temporária"
5. ✅ Padrão enterprise (Google/Meta/Microsoft)
6. ✅ Comparação: Construir casa - cada "tijolo" deve estar sólido

#### 6. Criação do PRODUCTION_ROADMAP.md

**Arquivo criado:** PRODUCTION_ROADMAP.md

**Conteúdo:**
- Estado atual do sistema (o que funciona vs. o que está quebrado)
- Épicos e Tasks detalhadas
- Acceptance Criteria objetivos
- Testes de validação executáveis
- Definition of Done
- Quality Gates
- Regras inegociáveis

**Estrutura das Tasks:**
```markdown
#### TASK X.X: [Nome]
**Responsabilidade:** [DevOps/Backend/Frontend]
**Prioridade:** 🔴 CRÍTICA / 🟡 ALTA / 🟢 MÉDIA

##### Acceptance Criteria
- [ ] AC1: [Critério testável]
- [ ] AC2: [Critério testável]

##### Testes de Validação
```bash
# Test 1: [Nome]
curl ...
# Esperado: [Resultado]
```

##### Definition of Done
✅ Todos os Acceptance Criteria passam
✅ Todos os testes de validação passam
✅ Sem erros nos logs
```

#### 7. Auditoria do Database Schema

**Arquivo criado:** AUDIT_DATABASE_SCHEMA.md

**Gaps Identificados:**

##### GAP #1: ConversationStatus sem `BOT_HANDLING` 🔴 BLOQUEADOR

**Problema:** Enum não tem valor para IA atendendo

**Enum ATUAL:**
```prisma
enum ConversationStatus {
  OPEN        // Nova conversa, aguardando atendimento
  IN_PROGRESS // Atendente está conversando
  WAITING     // Aguardando resposta do cliente
  CLOSED      // Finalizada
}
```

**Enum NECESSÁRIO:**
```prisma
enum ConversationStatus {
  BOT_HANDLING // ← NOVO: IA atendendo (NÃO aparece no Kanban)
  OPEN         // Escalado para humano (aparece no Kanban)
  IN_PROGRESS  // Atendente está conversando
  WAITING      // Aguardando resposta do cliente
  CLOSED       // Finalizada
}
```

**Impact:**
- N8N NÃO pode criar conversa sem aparecer no Kanban
- TODAS as conversas da IA apareceriam para atendente
- Sistema ficaria inviável (atendente seria spamado)

**Migration SQL:**
```sql
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'BOT_HANDLING' BEFORE 'OPEN';
```

##### GAP #2: Campo `source` ausente em Conversation 🟡 IMPORTANTE

**Problema:** Não dá pra rastrear origem da conversa (n8n, manual, webhook)

**Schema ATUAL:**
```prisma
model Conversation {
  id       String @id @default(uuid())
  tenantId String

  contactId    String
  assignedToId String?
  status       ConversationStatus @default(OPEN)
  priority     Priority @default(MEDIUM)

  lastMessageAt DateTime @default(now())
  createdAt     DateTime @default(now())
  closedAt      DateTime?

  metadata Json?  // ← Existe mas não é suficiente

  // FALTA: source String?
}
```

**Schema NECESSÁRIO:**
```prisma
model Conversation {
  // ... campos existentes ...

  source String? // "n8n", "manual", "webhook", "whatsapp"
  metadata Json?
}
```

**Impact:**
- Dificulta analytics (quantas conversas vieram do N8N vs manual)
- Debugging complicado
- Não é bloqueador mas é best practice

**Migration SQL:**
```sql
ALTER TABLE "conversations" ADD COLUMN "source" TEXT;
CREATE INDEX IF NOT EXISTS "idx_conversations_source" ON "conversations"("tenantId", "source");
```

##### ✅ O QUE ESTÁ CORRETO

- ✅ Multi-tenant isolation (todos models têm tenantId)
- ✅ Foreign keys com onDelete: Cascade
- ✅ Unique constraints respeitam multi-tenancy
- ✅ Índices incluem tenantId
- ✅ Model Tenant com todos campos WhatsApp Business API
- ✅ Model Contact com constraint @@unique([tenantId, phoneNumber])
- ✅ Model Message completo
- ✅ Campo metadata Json? existe em Conversation e Message

#### 8. Instalação de Agentes Especializados

**Usuário solicitou:** Instalar agentes em português para auditoria profunda

**Comando executado:**
```bash
npx @anthropic-ai/claude-code agents install \
  database-architect \
  database-optimization \
  database-optimizer \
  database-admin \
  neon-database-architect \
  neon-expert \
  neon-auth-specialist
```

**Resultado:** ✅ 7 agentes instalados em `.claude/agents/`

**Agentes totais instalados:** 47+ agentes

**Problema encontrado:** Agentes instalados mas NÃO disponíveis na sessão atual do Task tool.

**Lista de agentes disponíveis no Task tool:**
- general-purpose
- statusline-setup
- Explore
- Plan
- claude-code-guide
- incident-responder
- ui-ux-designer
- fullstack-developer
- typescript-pro
- frontend-developer
- test-engineer
- error-detective
- devops-engineer
- test-automator
- security-engineer
- data-engineer
- security-auditor
- compliance-specialist
- performance-engineer
- backend-architect ✅ (Disponível)
- penetration-tester
- api-security-audit
- mcp-testing-engineer

**Agentes instalados localmente mas NÃO disponíveis:**
- database-architect ❌
- database-optimization ❌
- database-optimizer ❌
- database-admin ❌
- neon-database-architect ❌
- neon-expert ❌
- neon-auth-specialist ❌
- E mais 40+ agentes...

#### 9. Tentativas de Acionar Agentes

**Tentativa 1:** Task tool com subagent_type='database-architect'
- ❌ Erro: "Agent type 'database-architect' not found"

**Tentativa 2:** Task tool com subagent_type='backend-architect'
- ⏸️ Interrompido pelo usuário (queria especificamente database-architect)

**Tentativa 3:** Task tool com subagent_type='general-purpose' para orquestrar
- ⏸️ Interrompido pelo usuário

**Decisão do usuário:**
> "faz o seguinte então. Documente tudo o que fizemos, documente o objetivo do projeto, documente tudo que fizemos até chegar aqui, tudo o que precisa ser feito. Eu fecho essa sessão depois disso e inicio outra pra acionar os agentes instalados."

---

## 🎯 O QUE PRECISA SER FEITO (PRÓXIMA SESSÃO)

### **PRIORIDADE 1: AUDITORIAS COM AGENTES ESPECIALIZADOS** 🔴

#### Auditoria 1: Database Schema
**Agente:** `database-architect`

**Missão:**
- Validar multi-tenancy (todos models com tenantId?)
- Validar todos os enums (ConversationStatus, MessageStatus, Direction, MessageType, Priority, Role)
- Validar relacionamentos e cascades
- Validar índices (otimizados? missing? desnecessários?)
- Validar campos críticos (Tenant, Contact, Conversation, Message)
- Confirmar GAP #1 (BOT_HANDLING) e GAP #2 (source)
- Propor migrations SQL definitivas
- Identificar riscos não óbvios
- Nota de qualidade /10

**Arquivos:**
- `deploy-backend/prisma/schema.prisma`

#### Auditoria 2: API Endpoints
**Agente:** `backend-architect`

**Missão:**
- Validar POST /api/conversations
  - Aceita contactPhoneNumber?
  - Cria Contact automaticamente?
  - Aceita status BOT_HANDLING?
  - Aceita campo source?
  - Aceita metadata?
- Validar PATCH /api/conversations/:id
  - Permite atualizar status?
  - Permite BOT_HANDLING → OPEN?
- Validar GET /api/conversations
  - Filtro ?status=OPEN exclui BOT_HANDLING?
  - Paginação funciona?
- Validar GET /api/conversations/:id/messages
  - Bug 400 corrigido em produção?
- Validar POST /api/conversations/:id/messages
  - Validator correto deployed?
  - Socket.io event emitido?
- Identificar endpoints faltando
- Propor código necessário
- Testes curl para validação

**Arquivos:**
- `deploy-backend/src/routes/*.ts`
- `deploy-backend/src/validators/*.ts`
- `deploy-backend/src/services/*.ts`
- `deploy-backend/src/controllers/*.ts`

#### Auditoria 3: TypeScript Types
**Agente:** `typescript-pro`

**Missão:**
- Validar consistência entre Prisma Client types e Zod schemas
- Validar types em Services
- Validar types em Controllers
- Validar types em Routes
- Identificar type mismatches
- Propor correções

**Arquivos:**
- `deploy-backend/src/**/*.ts`
- `node_modules/.prisma/client/index.d.ts` (após migration)

#### Auditoria 4: Frontend Kanban Filters
**Agente:** `frontend-developer`

**Missão:**
- Validar filtro de status no Kanban
- Garantir que GET /api/conversations?status=OPEN exclui BOT_HANDLING
- Validar UI não quebra com novo status
- Propor ajustes necessários

**Arquivos:**
- `apps/frontend/src/app/(dashboard)/conversations/page.tsx`
- `apps/frontend/src/hooks/useConversations.ts`
- `apps/frontend/src/types/conversation.ts`

### **PRIORIDADE 2: APLICAR MIGRATIONS** 🔴

#### Migration 1: Add BOT_HANDLING (BLOQUEADOR)

**Arquivo:** `deploy-backend/prisma/migrations/001_add_bot_handling_status.sql`

```sql
-- ====================================================
-- MIGRATION: 001_add_bot_handling_status.sql
-- Data: 2025-11-20
-- Descrição: Adicionar BOT_HANDLING ao enum ConversationStatus
-- ====================================================

BEGIN;

-- Step 1: Adicionar valor ao enum
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'BOT_HANDLING' BEFORE 'OPEN';

COMMIT;
```

**Executar:**
```bash
# 1. Aplicar migration no PostgreSQL
psql $DATABASE_URL -f deploy-backend/prisma/migrations/001_add_bot_handling_status.sql

# 2. Atualizar Prisma schema
# Editar deploy-backend/prisma/schema.prisma:
enum ConversationStatus {
  BOT_HANDLING
  OPEN
  IN_PROGRESS
  WAITING
  CLOSED
}

# 3. Gerar Prisma Client
cd deploy-backend
npx prisma generate

# 4. Validar
psql $DATABASE_URL -c "SELECT enum_range(NULL::\"ConversationStatus\");"
# Esperado: {BOT_HANDLING,OPEN,IN_PROGRESS,WAITING,CLOSED}
```

#### Migration 2: Add source field (IMPORTANTE)

**Arquivo:** `deploy-backend/prisma/migrations/002_add_conversation_source.sql`

```sql
-- ====================================================
-- MIGRATION: 002_add_conversation_source.sql
-- Data: 2025-11-20
-- Descrição: Adicionar campo source para rastrear origem
-- ====================================================

BEGIN;

-- Step 1: Adicionar coluna
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Step 2: Popular dados existentes (opcional)
UPDATE "conversations"
SET "source" = 'legacy'
WHERE "source" IS NULL;

-- Step 3: Criar índice (opcional - para analytics)
CREATE INDEX IF NOT EXISTS "idx_conversations_source"
  ON "conversations"("tenantId", "source");

COMMIT;
```

**Executar:**
```bash
# 1. Aplicar migration
psql $DATABASE_URL -f deploy-backend/prisma/migrations/002_add_conversation_source.sql

# 2. Atualizar Prisma schema
# Editar deploy-backend/prisma/schema.prisma:
model Conversation {
  // ... campos existentes ...
  source String?
  metadata Json?
  // ...
}

# 3. Gerar Prisma Client
npx prisma generate

# 4. Validar
psql $DATABASE_URL -c "\d conversations" | grep source
# Esperado: source | text |
```

### **PRIORIDADE 3: ATUALIZAR VALIDATORS** 🟡

#### Validator: conversation.validator.ts

**Arquivo:** `deploy-backend/src/validators/conversation.validator.ts`

**Adicionar:**
```typescript
import { z } from 'zod';

// Schema para criar conversa (usado pelo N8N)
export const createConversationSchema = z.object({
  contactPhoneNumber: z.string().regex(/^\d{10,15}$/, 'Telefone inválido'),
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional().default('OPEN'),
  source: z.enum(['n8n', 'manual', 'webhook', 'whatsapp']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema para atualizar conversa
export const updateConversationSchema = z.object({
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema para listar conversas
export const listConversationsSchema = z.object({
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
  assignedToId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  source: z.enum(['n8n', 'manual', 'webhook', 'whatsapp']).optional(),
  limit: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)).optional(),
  page: z.string().regex(/^\d+$/).transform(val => parseInt(val, 10)).pipe(z.number().int().min(1)).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
```

### **PRIORIDADE 4: ATUALIZAR SERVICES** 🟡

#### Service: conversation.service.ts

**Arquivo:** `deploy-backend/src/services/conversation.service.ts`

**Adicionar método createConversationFromPhone:**
```typescript
async createConversationFromPhone(
  tenantId: string,
  data: {
    contactPhoneNumber: string;
    status?: 'BOT_HANDLING' | 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'CLOSED';
    source?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    metadata?: any;
  }
): Promise<Conversation> {
  // 1. Buscar ou criar contato
  let contact = await prisma.contact.findUnique({
    where: {
      tenantId_phoneNumber: {
        tenantId,
        phoneNumber: data.contactPhoneNumber,
      },
    },
  });

  if (!contact) {
    // Criar contato automaticamente
    contact = await prisma.contact.create({
      data: {
        tenantId,
        phoneNumber: data.contactPhoneNumber,
        name: data.contactPhoneNumber, // Placeholder - N8N pode atualizar depois
      },
    });
  }

  // 2. Criar conversa
  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      contactId: contact.id,
      status: data.status || 'OPEN',
      source: data.source,
      priority: data.priority || 'MEDIUM',
      metadata: data.metadata,
    },
    include: {
      contact: true,
      assignedTo: true,
    },
  });

  return conversation;
}
```

### **PRIORIDADE 5: ATUALIZAR ROUTES** 🟡

#### Route: conversations.ts

**Arquivo:** `deploy-backend/src/routes/conversations.ts`

**Adicionar rota POST /api/conversations:**
```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/tenant.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createConversationSchema, updateConversationSchema, listConversationsSchema } from '../validators/conversation.validator';
import { ConversationController } from '../controllers/conversation.controller';

const router = Router();
const controller = new ConversationController();

// POST /api/conversations - Criar conversa (usado pelo N8N)
router.post(
  '/',
  authenticate,
  tenantContext,
  validate(createConversationSchema),
  controller.createFromPhone.bind(controller)
);

// PATCH /api/conversations/:id - Atualizar conversa
router.patch(
  '/:id',
  authenticate,
  tenantContext,
  validate(updateConversationSchema),
  controller.update.bind(controller)
);

// GET /api/conversations - Listar conversas (com filtros)
router.get(
  '/',
  authenticate,
  tenantContext,
  validate(listConversationsSchema, 'query'),
  controller.list.bind(controller)
);

// ... outras rotas ...

export default router;
```

### **PRIORIDADE 6: VERIFICAR DEPLOY DO FIX 400** 🔴

**Commit:** b6867c6

**Arquivo modificado:** `deploy-backend/src/validators/message.validator.ts`

**Verificação necessária:**
```bash
# 1. Verificar status do deploy no GitHub Actions
# https://github.com/fredcast/projeto-eva/actions

# 2. Testar endpoint em produção
curl -X POST https://api.botreserva.com.br/api/conversations/c220fbae-a594-4c03-994d-a116fa9a917d/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: hoteis-reserva" \
  -d '{
    "type": "TEXT",
    "content": "Teste após deploy"
  }'

# Esperado: 201 Created (não mais 400)
```

### **PRIORIDADE 7: RESOLVER SOCKET.IO REAL-TIME** 🔴

**Problema:** Mensagens enviadas via API não aparecem sem F5

**Hipótese atual:** Socket.io event `message:new` está sendo emitido mas frontend não está processando corretamente.

**Investigação necessária:**
1. Verificar se evento está sendo emitido no backend
2. Verificar se evento está sendo recebido no frontend
3. Verificar se React Query está invalidando cache
4. Verificar se UI está re-renderizando

**Arquivos para analisar:**
- `deploy-backend/src/services/message.service.v2.ts` (emissão do evento)
- `apps/frontend/src/hooks/useSocket.ts` (listener do evento)
- `apps/frontend/src/hooks/useMessages.ts` (React Query invalidation)
- `apps/frontend/src/app/(dashboard)/conversations/[id]/page.tsx` (UI rendering)

### **PRIORIDADE 8: ATUALIZAR N8N WORKFLOWS** 🟡

**Workflow principal:** `fluxo-n8n/MARCIO - IA CONVERSACIONAL.json`

**Função a modificar:** `notificar_atendente`

**Mudança necessária:**

```javascript
// ANTES (ATUAL)
const whatsappLink = `https://wa.me/5511973178256`;
// Envia link WhatsApp para atendente

// DEPOIS (CORRETO)
const apiEndpoint = 'https://api.botreserva.com.br/api/conversations';
const payload = {
  contactPhoneNumber: $json.from, // Número do cliente
  status: 'OPEN', // BOT_HANDLING → OPEN (escalona para humano)
  source: 'n8n',
  metadata: {
    flowId: 'MARCIO - IA CONVERSACIONAL',
    unidade: $json.unidade || 'Campos do Jordão',
    escalationReason: 'user_requested_human',
    aiSummary: $json.conversationSummary,
    aiContext: $json.context,
  },
};

// HTTP Request Node para criar conversa no CRM
const response = await fetch(apiEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.CRM_API_TOKEN}`,
    'x-tenant-slug': 'hoteis-reserva',
  },
  body: JSON.stringify(payload),
});

const conversation = await response.json();
console.log('Conversa criada no CRM:', conversation.id);
```

**Outros workflows que podem precisar ajuste:**
- `EXT - MARCIO IA COMERCIAL.json`
- `EXT - MARCIO IA HOSPEDE.json`
- `EXT - MARCIO RESPOSTAS MENUS BOTÕES.json`

---

## 📋 CHECKLIST DE VALIDAÇÃO COMPLETA

### **Após Migrations:**

```bash
# ✅ Test 1: Verificar enum atualizado
psql $DATABASE_URL -c "SELECT enum_range(NULL::\"ConversationStatus\");"
# Esperado: {BOT_HANDLING,OPEN,IN_PROGRESS,WAITING,CLOSED}

# ✅ Test 2: Verificar campo source existe
psql $DATABASE_URL -c "\d conversations" | grep source
# Esperado: source | text |

# ✅ Test 3: Verificar índice source
psql $DATABASE_URL -c "\d conversations" | grep idx_conversations_source
# Esperado: "idx_conversations_source" btree (tenantId, source)
```

### **Após Atualizar Validators/Services/Routes:**

```bash
# ✅ Test 4: Criar conversa via N8N (BOT_HANDLING)
curl -X POST https://api.botreserva.com.br/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: hoteis-reserva" \
  -d '{
    "contactPhoneNumber": "5511999999999",
    "status": "BOT_HANDLING",
    "source": "n8n",
    "metadata": {
      "flowId": "MARCIO - IA CONVERSACIONAL",
      "unidade": "Campos do Jordão"
    }
  }'
# Esperado: 201 Created { id: "uuid", status: "BOT_HANDLING", ... }

# ✅ Test 5: Verificar filtro Kanban exclui BOT_HANDLING
curl "https://api.botreserva.com.br/api/conversations?status=OPEN" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: hoteis-reserva"
# Esperado: Array de conversas (sem BOT_HANDLING)

# ✅ Test 6: Escalonar conversa (BOT_HANDLING → OPEN)
curl -X PATCH https://api.botreserva.com.br/api/conversations/{ID} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: hoteis-reserva" \
  -d '{"status": "OPEN"}'
# Esperado: 200 OK { id: "uuid", status: "OPEN", ... }

# ✅ Test 7: Verificar conversa aparece no Kanban após escalonamento
curl "https://api.botreserva.com.br/api/conversations?status=OPEN" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: hoteis-reserva"
# Esperado: Array incluindo a conversa escalada

# ✅ Test 8: Enviar mensagem via API
curl -X POST https://api.botreserva.com.br/api/conversations/{ID}/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: hoteis-reserva" \
  -d '{
    "type": "TEXT",
    "content": "Teste Socket.io"
  }'
# Esperado: 201 Created (não 400)

# ✅ Test 9: Verificar mensagem aparece sem F5
# Abrir botreserva.com.br no navegador
# Enviar mensagem via curl
# Verificar se aparece automaticamente (sem F5)
# Esperado: Mensagem aparece em tempo real
```

---

## 🔧 ARQUIVOS IMPORTANTES

### **Documentação:**
- `README.md` - Overview do projeto
- `DOCUMENTACAO-DEFINITIVA.md` - Documentação completa
- `ARQUITETURA-IDEAL.md` - Boas práticas
- `PRODUCTION_ROADMAP.md` - Roadmap com tasks detalhadas ✅ CRIADO HOJE
- `AUDIT_DATABASE_SCHEMA.md` - Auditoria do schema ✅ CRIADO HOJE
- `WORK_LOG_2025-11-19.md` - Log da sessão anterior
- `CONTEXTO_SESSAO_2025-11-20.md` - Este documento ✅ CRIADO AGORA

### **Backend (deploy-backend/):**
- `prisma/schema.prisma` - Database schema (GAP: BOT_HANDLING, source)
- `src/validators/message.validator.ts` - CORRIGIDO (conversationId removido)
- `src/validators/conversation.validator.ts` - PRECISA CRIAR
- `src/services/conversation.service.ts` - PRECISA ADICIONAR createFromPhone
- `src/services/message.service.v2.ts` - Emite Socket.io events
- `src/routes/conversations.ts` - PRECISA ADICIONAR POST /api/conversations
- `src/config/socket.ts` - Socket.io configurado

### **Frontend (apps/frontend/):**
- `next.config.mjs` - removeConsole desabilitado
- `src/hooks/useSocket.ts` - Socket.io client
- `src/hooks/useMessages.ts` - React Query
- `src/app/(dashboard)/conversations/page.tsx` - Kanban
- `src/app/(dashboard)/conversations/[id]/page.tsx` - Chat

### **N8N:**
- `fluxo-n8n/MARCIO - IA CONVERSACIONAL.json` - Workflow principal
- `fluxo-n8n/EXT - MARCIO IA COMERCIAL.json`
- `fluxo-n8n/EXT - MARCIO IA HOSPEDE.json`
- Outros 5 workflows

### **Deploy:**
- `.github/workflows/deploy-production.yml` - GitHub Actions
- `deploy.ps1` / `deploy.sh` - Scripts de deploy

---

## 🚨 BLOQUEADORES CRÍTICOS

### **BLOQUEADOR #1: Enum ConversationStatus**
- ❌ Não tem valor `BOT_HANDLING`
- ❌ N8N não pode criar conversa sem aparecer no Kanban
- ❌ Sistema inviável sem isso

**Solução:** Migration 001 (já documentada acima)

### **BLOQUEADOR #2: Endpoint POST /api/conversations**
- ❌ Não aceita `contactPhoneNumber` no body
- ❌ Não cria Contact automaticamente
- ❌ Não aceita status `BOT_HANDLING`

**Solução:** Implementar validator + service + route (já documentada acima)

### **BLOQUEADOR #3: Deploy do Fix 400**
- ⚠️ Commit b6867c6 feito mas não confirmado em produção
- ⚠️ Pode ainda estar retornando 400

**Solução:** Verificar GitHub Actions e testar endpoint

---

## 🎯 PRÓXIMOS PASSOS (ORDEM DE EXECUÇÃO)

### **FASE 1: AUDITORIAS (USAR AGENTES)** 🔴 PRIORIDADE MÁXIMA

1. ✅ Iniciar nova sessão Claude Code
2. ✅ Acionar agente `database-architect`
   - Auditar `deploy-backend/prisma/schema.prisma`
   - Confirmar gaps e propor migrations definitivas
3. ✅ Acionar agente `backend-architect`
   - Auditar toda API (validators, services, routes, controllers)
   - Identificar endpoints faltando
   - Propor código necessário
4. ✅ Acionar agente `typescript-pro`
   - Validar consistência de tipos
   - Identificar type mismatches
5. ✅ Acionar agente `frontend-developer`
   - Validar filtros do Kanban
   - Garantir UI não quebra com BOT_HANDLING

### **FASE 2: MIGRATIONS** 🔴 CRÍTICO

6. ✅ Aplicar Migration 001 (BOT_HANDLING)
7. ✅ Atualizar Prisma schema
8. ✅ Gerar Prisma Client
9. ✅ Validar com psql
10. ✅ Aplicar Migration 002 (source)
11. ✅ Atualizar Prisma schema
12. ✅ Gerar Prisma Client
13. ✅ Validar com psql

### **FASE 3: IMPLEMENTAÇÕES** 🟡 ALTA

14. ✅ Criar/atualizar conversation.validator.ts
15. ✅ Atualizar conversation.service.ts (método createFromPhone)
16. ✅ Atualizar conversations.ts route
17. ✅ Commit e push
18. ✅ Aguardar deploy GitHub Actions

### **FASE 4: TESTES END-TO-END** 🟡 ALTA

19. ✅ Testar POST /api/conversations (N8N flow)
20. ✅ Testar PATCH /api/conversations/:id (escalonamento)
21. ✅ Testar GET /api/conversations?status=OPEN (filtro Kanban)
22. ✅ Testar POST /api/conversations/:id/messages (fix 400)
23. ✅ Testar Socket.io real-time (mensagem sem F5)

### **FASE 5: INTEGRAÇÃO N8N** 🟢 MÉDIA

24. ✅ Atualizar função `notificar_atendente` nos workflows N8N
25. ✅ Testar escalação IA → Humano end-to-end
26. ✅ Validar conversa aparece no Kanban apenas quando escalada

---

## 💡 INSIGHTS IMPORTANTES

### **1. Padrão de Qualidade Estabelecido**

Usuário quer **padrão enterprise** (Google/Meta/Microsoft):
- ✅ Cada componente 100% validado antes de prosseguir
- ✅ Usar agentes especializados apropriados
- ❌ NUNCA "solução rápida" ou "gambiarra"
- ✅ Auditorias completas ("pente fino")
- ✅ Código definitivo, não experimental

### **2. Analogia da Construção**

Usuário comparou desenvolvimento a construir uma casa:
> "Cada tijolo deve estar sólido antes de colocar o próximo"

**Aplicado ao projeto:**
- Database schema = fundação (DEVE estar 100% antes de API)
- API endpoints = estrutura (DEVE estar 100% antes de integração)
- Integrações = acabamentos (só depois da estrutura sólida)

### **3. Problema do "Agora Vai Funcionar"**

Usuário está cansado do padrão:
1. Achar um erro
2. "Agora vai funcionar"
3. Deploy
4. Não funciona
5. Repeat

**Novo padrão:**
1. Auditar tudo primeiro
2. Identificar TODOS os gaps
3. Planejar solução definitiva
4. Implementar com qualidade
5. Validar completamente
6. Deploy com confiança

### **4. Importância dos Agentes Especializados**

Usuário insistiu MUITO em usar agentes especializados:
> "NÃO CARALHO!!!!!!!!!! Não é possivel que você não consiga acionar eles. Dê um jeito de acionar, inicie uma outra sessão sei la, mas dê um jeito de acioná-lo. Isso é inegociavel"

**Por quê?**
- Cada agente tem expertise específica
- Auditorias mais profundas e profissionais
- Identificam problemas que análise genérica não vê
- Qualidade enterprise requer especialização

---

## 🔑 VARIÁVEIS DE AMBIENTE IMPORTANTES

### **Backend (.env.production):**
```env
DATABASE_URL=postgresql://crm_user:***@localhost:5432/crm_whatsapp_saas
JWT_SECRET=***
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

WHATSAPP_PHONE_NUMBER_ID=***
WHATSAPP_ACCESS_TOKEN=EAAMhZCMo...  # Atualizado hoje
WHATSAPP_BUSINESS_ACCOUNT_ID=***
WHATSAPP_WEBHOOK_VERIFY_TOKEN=***
WHATSAPP_APP_SECRET=***

NODE_ENV=production
PORT=3001
```

### **Frontend (.env.production):**
```env
NEXT_PUBLIC_API_URL=https://api.botreserva.com.br
NEXT_PUBLIC_WS_URL=https://api.botreserva.com.br
```

### **N8N (a configurar):**
```env
CRM_API_URL=https://api.botreserva.com.br
CRM_API_TOKEN=***  # Gerar token JWT para N8N
CRM_TENANT_SLUG=hoteis-reserva
```

---

## 📞 INFORMAÇÕES DE DEPLOY

### **VPS:**
- IP: 72.61.39.235
- OS: Ubuntu 24.04
- Acesso: SSH via GitHub Actions
- Path: `/var/www/crm-backend` (ou conforme VPS_PATH secret)

### **URLs:**
- Backend API: https://api.botreserva.com.br
- Frontend: https://botreserva.com.br
- Health Check: https://api.botreserva.com.br/api/health

### **GitHub:**
- Repo: https://github.com/fredcast/projeto-eva
- Actions: https://github.com/fredcast/projeto-eva/actions
- Último commit: b6867c6 (fix validator message)

### **Vercel:**
- Frontend auto-deploy em cada push para master
- Environment: Production
- Build time: ~2-3 minutos

---

## 🎓 LIÇÕES APRENDIDAS

### **1. Entender o Projeto Completamente Primeiro**

Passou 90% da sessão tentando fixes sem entender que o projeto é **IA + Humano híbrido**, não apenas um CRM.

**Lição:** Perguntar sobre arquitetura e fluxos logo no início.

### **2. Não Fazer Suposições Sobre Database Schema**

Assumiu que o schema estava completo sem validar se suportava os casos de uso reais (N8N integration).

**Lição:** Auditar schema antes de implementar features que dependem dele.

### **3. Deploy Rápido ≠ Deploy Correto**

Múltiplos deploys tentando fixes sem validar a causa raiz.

**Lição:** Investigar completamente antes de deployar. Um deploy bem pensado > 10 deploys rápidos.

### **4. Importância de Documentação Contínua**

Este documento foi criado porque a sessão anterior não tinha contexto suficiente documentado.

**Lição:** Documentar em tempo real, não apenas no final.

### **5. Agentes Especializados São Necessários**

Tentativa de fazer auditoria manualmente não atingiu o nível de qualidade enterprise que o usuário demanda.

**Lição:** Usar ferramentas certas (agentes) para o trabalho certo (auditorias profundas).

---

## ✅ RESUMO PARA NOVA SESSÃO

### **Contexto em 3 frases:**
1. CRM WhatsApp SaaS Multi-Tenant com arquitetura híbrida IA (N8N 80%) + Humano (CRM 20%)
2. Database schema tem 2 gaps críticos que bloqueiam integração N8N
3. Preciso usar agentes especializados para auditar tudo antes de prosseguir

### **Primeira ação na nova sessão:**
```
Acionar agente database-architect para auditar deploy-backend/prisma/schema.prisma
e confirmar gaps identificados + propor migrations definitivas.
```

### **Objetivo final:**
Sistema 100% funcional com:
- ✅ N8N criando conversas com status BOT_HANDLING (não aparecem no Kanban)
- ✅ N8N escalando conversas para OPEN (aparecem no Kanban)
- ✅ Atendentes vendo apenas conversas escaladas
- ✅ Mensagens em tempo real via Socket.io (sem F5)
- ✅ API endpoints completos e validados
- ✅ Qualidade enterprise (Google/Meta/Microsoft)

---

## 📌 ARQUIVOS CRIADOS HOJE

1. `PRODUCTION_ROADMAP.md` ✅
2. `AUDIT_DATABASE_SCHEMA.md` ✅
3. `CONTEXTO_SESSAO_2025-11-20.md` ✅ (este arquivo)

## 📌 COMMITS HOJE

1. Commit b6867c6: "fix: corrigir validator message - remover conversationId do body"
   - Arquivo: deploy-backend/src/validators/message.validator.ts
   - Status deploy: ⚠️ Aguardando confirmação

---

**FIM DO DOCUMENTO**

**Data:** 20/11/2025
**Hora:** [timestamp atual]
**Próxima ação:** Fechar sessão e iniciar nova para acionar agentes especializados
