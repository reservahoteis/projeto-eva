# 🚀 SEQUÊNCIA DE DEPLOY COMPLETA - INTEGRAÇÃO N8N

**Data:** 2025-11-20
**Objetivo:** Deploy da funcionalidade BOT_HANDLING + Endpoint POST /api/conversations
**Padrão:** Enterprise-Grade - Zero Downtime

---

## 📋 OVERVIEW DO FLUXO

```
┌─────────────────────────────────────────────────────────────┐
│                    SEQUÊNCIA DE DEPLOY                       │
└─────────────────────────────────────────────────────────────┘

1. DESENVOLVIMENTO LOCAL
   ├── Atualizar Prisma Schema
   ├── Criar migrations SQL
   ├── Implementar código backend
   └── Testar localmente

2. COMMIT & PUSH GITHUB
   ├── git add .
   ├── git commit -m "..."
   └── git push origin master

3. DEPLOY AUTOMÁTICO
   ├── GitHub Actions detecta push
   ├── Deploy Backend → VPS (via SSH)
   └── Deploy Frontend → Vercel

4. AGUARDAR DEPLOYS
   ├── Verificar GitHub Actions (backend)
   └── Verificar Vercel Dashboard (frontend)

5. APLICAR MIGRATIONS NA VPS
   ├── SSH na VPS
   ├── Executar migrations SQL
   └── Validar com psql

6. VALIDAÇÃO FINAL
   ├── Testes curl endpoints
   ├── Testar UI frontend
   └── Monitorar logs
```

---

## FASE 1: DESENVOLVIMENTO LOCAL (30 min)

### Step 1.1: Atualizar Prisma Schema

**Arquivo:** `deploy-backend/prisma/schema.prisma`

```prisma
enum ConversationStatus {
  BOT_HANDLING // ← ADICIONAR esta linha
  OPEN
  IN_PROGRESS
  WAITING
  CLOSED
}

model Conversation {
  // ... campos existentes ...

  source String? // ← ADICIONAR este campo

  // ... resto do model ...

  // ✅ ADICIONAR ÍNDICES
  @@index([tenantId, status, assignedToId, lastMessageAt])
  @@index([tenantId, source])
  @@index([tenantId, createdAt])
}
```

### Step 1.2: Criar Migrations SQL

**Criar pasta:** `deploy-backend/prisma/migrations-manual/`

**Arquivo 1:** `001_add_bot_handling_status.sql`
```sql
-- Copiar conteúdo do arquivo AUDIT_DATABASE_SCHEMA_COMPLETE.md
-- Migration 001: Add BOT_HANDLING Status
```

**Arquivo 2:** `002_add_conversation_source.sql`
```sql
-- Copiar conteúdo do arquivo AUDIT_DATABASE_SCHEMA_COMPLETE.md
-- Migration 002: Add Conversation Source Field
```

### Step 1.3: Implementar Código Backend

#### Arquivo 1: `deploy-backend/src/validators/conversation.validator.ts`

```typescript
// ADICIONAR NO FINAL DO ARQUIVO:

export const createConversationSchema = z.object({
  contactPhoneNumber: z.string()
    .min(10, 'Número de telefone deve ter no mínimo 10 dígitos')
    .max(15, 'Número de telefone deve ter no máximo 15 dígitos')
    .regex(/^\d+$/, 'Número de telefone deve conter apenas dígitos'),

  status: z.enum([
    'BOT_HANDLING',
    'OPEN',
    'IN_PROGRESS',
    'WAITING',
    'CLOSED'
  ]).optional().default('OPEN'),

  source: z.enum(['n8n', 'manual', 'webhook', 'whatsapp']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
  metadata: z.record(z.any()).optional(),
  assignedToId: z.string().uuid().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

// ATUALIZAR SCHEMAS EXISTENTES (adicionar BOT_HANDLING):
export const listConversationsSchema = z.object({
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
  // ... resto igual
});

export const updateConversationSchema = z.object({
  status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
  // ... resto igual
});
```

#### Arquivo 2: `deploy-backend/src/services/conversation.service.ts`

```typescript
// ADICIONAR NO FINAL DA CLASSE (antes do fechamento):

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
  // 1. Buscar Contact
  let contact = await prisma.contact.findFirst({
    where: {
      tenantId: data.tenantId,
      phoneNumber: data.contactPhoneNumber,
    },
  });

  // 2. Criar Contact se não existir
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId: data.tenantId,
        phoneNumber: data.contactPhoneNumber,
      },
    });

    logger.info({
      contactId: contact.id,
      phoneNumber: data.contactPhoneNumber,
      tenantId: data.tenantId,
    }, 'Contact created automatically');
  }

  // 3. Validar assignedToId se fornecido
  if (data.assignedToId) {
    const user = await prisma.user.findFirst({
      where: {
        id: data.assignedToId,
        tenantId: data.tenantId,
        status: 'ACTIVE',
      },
    });

    if (!user) {
      throw new NotFoundError('Atendente não encontrado');
    }
  }

  // 4. Criar Conversation
  const conversation = await prisma.conversation.create({
    data: {
      tenantId: data.tenantId,
      contactId: contact.id,
      status: data.status || 'OPEN',
      priority: data.priority || 'MEDIUM',
      // @ts-ignore - Campo source pode não existir ainda
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
      tags: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });

  logger.info({
    conversationId: conversation.id,
    status: conversation.status,
    source: data.source,
  }, 'Conversation created from phone');

  // 5. Socket.io (apenas se não for BOT_HANDLING)
  if (conversation.status !== 'BOT_HANDLING') {
    try {
      const { emitNewConversation } = await import('@/config/socket');
      emitNewConversation(data.tenantId, conversation);
    } catch (error) {
      logger.warn({ error }, 'Failed to emit Socket.io event');
    }
  }

  return conversation;
}

// ATUALIZAR listConversations para suportar filtro múltiplo:
async listConversations(params: ListConversationsParams) {
  const where: Prisma.ConversationWhereInput = {
    tenantId: params.tenantId,
  };

  // ✅ ADICIONAR: Suporte a filtro múltiplo (CSV)
  if (params.status) {
    if (params.status.includes(',')) {
      where.status = {
        in: params.status.split(',') as ConversationStatus[],
      };
    } else {
      where.status = params.status as ConversationStatus;
    }
  }

  // ... resto do código continua igual
}
```

#### Arquivo 3: `deploy-backend/src/controllers/conversation.controller.ts`

```typescript
// ADICIONAR IMPORT:
import type {
  CreateConversationInput, // ← ADICIONAR
  // ... outros imports existentes
} from '@/validators/conversation.validator';

// ADICIONAR MÉTODO (antes de getStats):
async create(req: Request, res: Response) {
  try {
    const data = req.body as CreateConversationInput;

    if (!req.tenantId) {
      return res.status(400).json({
        error: 'Tenant ID não encontrado',
        hint: 'Envie o header X-Tenant-Slug',
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
      status: conversation.status,
      source: data.source,
    }, 'Conversation created via API');

    return res.status(201).json(conversation);
  } catch (error) {
    logger.error({ error, body: req.body }, 'Erro ao criar conversa');

    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Erro interno' });
  }
}
```

#### Arquivo 4: `deploy-backend/src/routes/conversation.routes.ts`

```typescript
// ADICIONAR IMPORT:
import {
  createConversationSchema, // ← ADICIONAR
  // ... outros imports existentes
} from '@/validators/conversation.validator';

// ADICIONAR ROTA (DEPOIS de GET / e ANTES de GET /:id):

// GET /api/conversations/stats
router.get('/stats', conversationController.getStats.bind(conversationController));

// GET /api/conversations
router.get('/', validate(listConversationsSchema, 'query'), conversationController.list.bind(conversationController));

// ✅ ADICIONAR AQUI:
// POST /api/conversations
router.post(
  '/',
  validate(createConversationSchema),
  conversationController.create.bind(conversationController)
);

// GET /api/conversations/:id
router.get('/:id', conversationController.getById.bind(conversationController));

// ... resto continua igual
```

### Step 1.4: Testar Localmente (Opcional)

```bash
cd deploy-backend

# Build TypeScript
npm run build

# Verificar erros de compilação
npx tsc --noEmit

# Se tudo OK, prosseguir para commit
```

---

## FASE 2: COMMIT & PUSH (5 min)

### Step 2.1: Git Add & Commit

```bash
cd c:\Users\55489\Desktop\projeto-hoteis-reserva

# Add todos os arquivos modificados
git add .

# Commit com mensagem descritiva
git commit -m "feat: adicionar endpoint POST /api/conversations para integração N8N

BACKEND:
- Adicionar enum BOT_HANDLING ao ConversationStatus
- Adicionar campo source em Conversation (n8n, manual, webhook)
- Criar createConversationSchema validator com BOT_HANDLING
- Criar ConversationService.createFromPhone() - busca/cria Contact automaticamente
- Criar ConversationController.create() com error handling
- Adicionar rota POST /api/conversations
- Atualizar listConversations para suportar filtro múltiplo (CSV)
- Migrations SQL: 001_add_bot_handling_status.sql, 002_add_conversation_source.sql

FEATURES:
- N8N pode criar conversas com status BOT_HANDLING via API
- Conversas BOT_HANDLING não aparecem no Kanban (filtradas)
- Socket.io não emite evento para status BOT_HANDLING
- Suporte a escalação: BOT_HANDLING → OPEN
- Contact criado automaticamente se não existir (via phoneNumber)
- Campo source rastreia origem (n8n, manual, webhook)

BREAKING CHANGES: Nenhuma
- Backward compatible (novos valores enum opcionais)
- Migrations adicionam dados, não removem

Refs: AUDIT_DATABASE_SCHEMA_COMPLETE.md, AUDIT_API_ENDPOINTS_COMPLETE.md
"
```

### Step 2.2: Push para GitHub

```bash
git push origin master
```

**Output esperado:**
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
Delta compression using up to Y threads
Compressing objects: 100% (Z/Z), done.
Writing objects: 100% (W/W), V bytes | ... MiB/s, done.
Total W (delta U), reused T (delta S), pack-reused 0
remote: Resolving deltas: 100% (U/U), completed with R local objects.
To https://github.com/fredcast/projeto-eva.git
   b6867c6..NOVO_SHA  master -> master
```

---

## FASE 3: AGUARDAR DEPLOYS AUTOMÁTICOS (10-15 min)

### Step 3.1: Monitorar GitHub Actions (Backend VPS)

**URL:** https://github.com/fredcast/projeto-eva/actions

**O que esperar:**
```
✅ Workflow: Deploy to Production
├── Checkout code
├── Setup Node.js
├── Install dependencies (npm ci)
├── Build TypeScript (npm run build)
├── Deploy to VPS via SSH
│   ├── Copy files to /var/www/crm-backend (ou path configurado)
│   ├── PM2 restart backend
│   └── Verify health check
└── ✅ Deploy successful
```

**Tempo estimado:** 5-8 minutos

**Como verificar:**
1. Abrir https://github.com/fredcast/projeto-eva/actions
2. Clicar no workflow mais recente
3. Aguardar todos os steps ficarem verdes ✅
4. Se falhar ❌, clicar no step com erro para ver logs

### Step 3.2: Monitorar Vercel (Frontend)

**URL:** https://vercel.com/seu-projeto/deployments

**O que esperar:**
```
✅ Building
├── Install dependencies
├── Build Next.js (npm run build)
└── Optimize assets

✅ Deploying
├── Upload to CDN
└── Assign domain

✅ Ready
└── https://botreserva.com.br
```

**Tempo estimado:** 2-3 minutos

**Como verificar:**
1. Abrir https://vercel.com/
2. Ir em Projects → seu-projeto → Deployments
3. Aguardar status "Ready" (verde)
4. Se falhar, clicar em "View Function Logs"

---

## FASE 4: APLICAR MIGRATIONS NA VPS (10 min)

⚠️ **IMPORTANTE:** Só executar DEPOIS que GitHub Actions terminar com sucesso!

### Step 4.1: SSH na VPS

```bash
ssh root@72.61.39.235
```

### Step 4.2: Navegar até pasta do projeto

```bash
cd /var/www/crm-backend
# OU o path que está configurado no VPS_PATH do GitHub Actions
```

### Step 4.3: Verificar deploy bem-sucedido

```bash
# Verificar se código novo está lá
cat package.json | grep version

# Verificar se processo está rodando
pm2 status

# Verificar logs recentes
pm2 logs backend --lines 50
```

### Step 4.4: Aplicar Migration 001 (BOT_HANDLING)

```bash
# Executar migration SQL
docker exec -i crm-postgres psql -U crm_user -d crm_whatsapp_saas < prisma/migrations-manual/001_add_bot_handling_status.sql

# OU se PostgreSQL não estiver em Docker:
psql -U crm_user -d crm_whatsapp_saas < prisma/migrations-manual/001_add_bot_handling_status.sql
```

**Output esperado:**
```
BEGIN
NOTICE:  ConversationStatus values: BOT_HANDLING, OPEN, IN_PROGRESS, WAITING, CLOSED
COMMIT
```

### Step 4.5: Validar Migration 001

```bash
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'ConversationStatus'::regtype
ORDER BY enumsortorder;
"
```

**Output esperado:**
```
   enumlabel
----------------
 BOT_HANDLING
 OPEN
 IN_PROGRESS
 WAITING
 CLOSED
(5 rows)
```

### Step 4.6: Aplicar Migration 002 (source field)

```bash
docker exec -i crm-postgres psql -U crm_user -d crm_whatsapp_saas < prisma/migrations-manual/002_add_conversation_source.sql
```

**Output esperado:**
```
BEGIN
NOTICE:  Total conversations: 123
NOTICE:  Marked as legacy: 123
NOTICE:  Migration completed successfully
COMMIT
```

### Step 4.7: Validar Migration 002

```bash
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "\d conversations" | grep source
```

**Output esperado:**
```
 source                  | text                        |
```

```bash
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "
SELECT indexname FROM pg_indexes WHERE tablename = 'conversations' AND indexname LIKE '%source%';
"
```

**Output esperado:**
```
          indexname
------------------------------
 idx_conversations_source
 idx_conversations_status_source
(2 rows)
```

### Step 4.8: Gerar Prisma Client atualizado

```bash
cd /var/www/crm-backend
npx prisma generate
```

**Output esperado:**
```
✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
```

### Step 4.9: Restart Backend

```bash
pm2 restart backend

# Verificar se subiu corretamente
pm2 status

# Verificar logs
pm2 logs backend --lines 30
```

**Output esperado em pm2 logs:**
```
Server started on port 3001
Database connected
Socket.io initialized
```

### Step 4.10: Sair da VPS

```bash
exit
```

---

## FASE 5: VALIDAÇÃO FINAL (15 min)

### Step 5.1: Health Check

```bash
curl https://api.botreserva.com.br/health
```

**Expected:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T...",
  "uptime": 123
}
```

### Step 5.2: Testar Endpoint POST /api/conversations

⚠️ **IMPORTANTE:** Substituir `SEU_JWT_TOKEN` por token real

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
```json
{
  "id": "uuid-gerado",
  "tenantId": "...",
  "contactId": "...",
  "status": "BOT_HANDLING",
  "source": "n8n",
  "priority": "MEDIUM",
  "metadata": { "flowId": "...", "unidade": "..." },
  "contact": {
    "id": "...",
    "phoneNumber": "5511999999999",
    "name": null,
    "profilePictureUrl": null
  },
  "assignedTo": null,
  "tags": [],
  "createdAt": "...",
  "lastMessageAt": "..."
}
```

### Step 5.3: Testar Filtro Kanban (não deve retornar BOT_HANDLING)

```bash
curl "https://api.botreserva.com.br/api/conversations?status=OPEN" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "X-Tenant-Slug: hoteis-reserva"
```

**Expected:** Array de conversas (sem status BOT_HANDLING)

### Step 5.4: Testar Escalação (BOT_HANDLING → OPEN)

```bash
# Usar ID da conversa criada no Step 5.2
CONVERSATION_ID="uuid-da-conversa-criada"

curl -X PATCH "https://api.botreserva.com.br/api/conversations/$CONVERSATION_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN" \
  -H "X-Tenant-Slug: hoteis-reserva" \
  -d '{"status": "OPEN"}'
```

**Expected:** `200 OK`
```json
{
  "id": "uuid",
  "status": "OPEN",
  ...
}
```

### Step 5.5: Verificar Frontend (Kanban)

1. Abrir https://botreserva.com.br/dashboard/conversations
2. Login com credenciais
3. Verificar:
   - ✅ Conversa BOT_HANDLING NÃO aparece no Kanban
   - ✅ Após PATCH para OPEN, conversa APARECE na coluna "Abertas"
   - ✅ Sem erros no console (F12)

### Step 5.6: Monitorar Logs (5 minutos)

```bash
# SSH na VPS novamente
ssh root@72.61.39.235

# Monitorar logs em tempo real
pm2 logs backend --lines 100

# Procurar por:
# ✅ "Conversation created from phone"
# ✅ "Contact created automatically"
# ❌ Erros de Prisma
# ❌ Erros de validação
```

**Se encontrar erros:**
- Copiar stack trace completo
- Verificar se migration foi aplicada corretamente
- Verificar se Prisma Client foi regenerado

---

## 🚨 TROUBLESHOOTING

### Problema 1: GitHub Actions falha no build

**Sintoma:** Workflow fica vermelho ❌ no step "Build"

**Solução:**
```bash
# Verificar logs do GitHub Actions
# Se erro TypeScript:
cd deploy-backend
npx tsc --noEmit

# Corrigir erros localmente
# Commit + push novamente
```

### Problema 2: Migration falha com "enum value already exists"

**Sintoma:** `ERROR: enum label "BOT_HANDLING" already exists`

**Solução:**
```bash
# Migration 001 usa "IF NOT EXISTS", então é safe re-executar
# Apenas ignore o erro se valor já existe

# Validar manualmente:
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'ConversationStatus'::regtype;
"
```

### Problema 3: Endpoint retorna 404

**Sintoma:** `curl POST /api/conversations → 404 Not Found`

**Solução:**
```bash
# Verificar se PM2 reiniciou após deploy
ssh root@72.61.39.235
pm2 status

# Se processo parado:
pm2 restart backend

# Verificar logs de startup:
pm2 logs backend --lines 50
```

### Problema 4: Endpoint retorna 400 "Tenant ID não encontrado"

**Sintoma:** `{"error": "Tenant ID não encontrado"}`

**Solução:**
```bash
# Certifique-se de enviar header X-Tenant-Slug
curl -H "X-Tenant-Slug: hoteis-reserva" ...

# OU verificar se tenant existe:
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "
SELECT slug FROM tenants;
"
```

### Problema 5: Prisma erro "Field source does not exist"

**Sintoma:** `Error: Unknown field 'source'`

**Solução:**
```bash
# Migration 002 não foi aplicada OU Prisma Client não foi regenerado
ssh root@72.61.39.235
cd /var/www/crm-backend

# Aplicar migration 002 novamente
docker exec -i crm-postgres psql -U crm_user -d crm_whatsapp_saas < prisma/migrations-manual/002_add_conversation_source.sql

# Regenerar Prisma Client
npx prisma generate

# Restart
pm2 restart backend
```

---

## ✅ CHECKLIST FINAL

### PRÉ-DEPLOY
- [ ] Código backend implementado (4 arquivos)
- [ ] Migrations SQL criadas (2 arquivos)
- [ ] Prisma schema atualizado
- [ ] Build local sem erros TypeScript
- [ ] Git commit com mensagem descritiva
- [ ] Git push para master

### PÓS-DEPLOY
- [ ] GitHub Actions verde ✅
- [ ] Vercel deploy completo ✅
- [ ] SSH na VPS realizado
- [ ] Migration 001 aplicada
- [ ] Migration 001 validada
- [ ] Migration 002 aplicada
- [ ] Migration 002 validada
- [ ] Prisma Client regenerado
- [ ] Backend reiniciado (PM2)
- [ ] Health check passou

### VALIDAÇÃO
- [ ] POST /api/conversations → 201 Created
- [ ] GET /api/conversations?status=OPEN → Sem BOT_HANDLING
- [ ] PATCH status BOT_HANDLING → OPEN funciona
- [ ] Frontend Kanban não mostra BOT_HANDLING
- [ ] Logs sem erros críticos

---

## 🎯 PRÓXIMO PASSO: INTEGRAÇÃO N8N

Após validação bem-sucedida, você pode configurar o N8N para chamar o endpoint:

```javascript
// N8N - HTTP Request Node
POST https://api.botreserva.com.br/api/conversations

Headers:
  Content-Type: application/json
  Authorization: Bearer {{$env.CRM_API_TOKEN}}
  X-Tenant-Slug: hoteis-reserva

Body:
{
  "contactPhoneNumber": "{{$json.from}}",
  "status": "BOT_HANDLING",
  "source": "n8n",
  "metadata": {
    "flowId": "MARCIO - IA CONVERSACIONAL",
    "unidade": "{{$json.unidade}}"
  }
}
```

---

**FIM DA SEQUÊNCIA DE DEPLOY**

**Tempo Total Estimado:** 70-85 minutos
- Desenvolvimento: 30 min
- Commit/Push: 5 min
- Aguardar deploys: 15 min
- Aplicar migrations: 10 min
- Validação: 15 min
- Buffer: 10 min
