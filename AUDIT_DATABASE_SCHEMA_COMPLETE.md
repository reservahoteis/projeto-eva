# 🔍 AUDITORIA COMPLETA DO DATABASE SCHEMA PRISMA
**CRM WhatsApp SaaS Multi-Tenant - Arquitetura Híbrida IA + Humano**

**Data:** 2025-11-20
**Auditor:** Backend System Architect (Claude Code)
**Padrão de Qualidade:** Enterprise-Grade (Google/Meta/Microsoft)
**Arquivo Auditado:** `deploy-backend/prisma/schema.prisma`

---

## 📋 SUMÁRIO EXECUTIVO

### Nota de Qualidade: **7.5/10**

**Pontos Fortes:**
- ✅ Multi-tenancy bem implementado
- ✅ Relacionamentos consistentes com cascades apropriados
- ✅ Unique constraints respeitam multi-tenancy
- ✅ Índices incluem tenantId onde necessário
- ✅ Models de auditoria (AuditLog, WebhookEvent) presentes

**Gaps Críticos Identificados:**
- 🔴 **2 BLOQUEADORES** impedem integração N8N
- 🟡 **5 IMPORTANTES** afetam robustez e analytics
- 🟢 **3 NICE-TO-HAVE** melhorariam qualidade

**Comparação com Padrões Enterprise:**
- Google/Meta/Microsoft teriam: 9.0-9.5/10
- Schema atual: 7.5/10
- **Gap:** Faltam 1.5-2.0 pontos de qualidade

---

## 🔴 GAP #1 CONFIRMADO: BOT_HANDLING AUSENTE (BLOQUEADOR)

**Impacto:** **BLOQUEADOR CRÍTICO**

**Arquitetura Atual do Projeto:**
```
N8N (IA) → 80% conversas resolvidas automaticamente
            ↓
         BOT_HANDLING (NÃO EXISTE NO ENUM!)
            ↓
         OPEN (Escalado para humano - aparece no Kanban)
```

**Problema:**
1. N8N precisa criar conversas com status `BOT_HANDLING`
2. Enum atual NÃO tem esse valor
3. N8N é forçado a usar `OPEN`
4. **RESULTADO:** TODAS as conversas da IA aparecem no Kanban do atendente
5. **CONSEQUÊNCIA:** Sistema inviável (spam de conversas)

**Schema Necessário:**
```prisma
enum ConversationStatus {
  BOT_HANDLING // ← NOVO: IA atendendo (NÃO aparece no Kanban)
  OPEN         // Escalado para humano (aparece no Kanban)
  IN_PROGRESS  // Atendente está conversando
  WAITING      // Aguardando resposta do cliente
  CLOSED       // Finalizada
}
```

**Severity:** 🔴 **BLOQUEADOR** - Sistema não funciona sem isso

---

## 🟡 GAP #2 CONFIRMADO: CAMPO SOURCE AUSENTE (IMPORTANTE)

**Impacto:** **IMPORTANTE (NÃO BLOQUEADOR MAS CRÍTICO PARA ANALYTICS)**

**Problema:**
```typescript
// N8N cria conversa
POST /api/conversations
{
  "contactPhoneNumber": "5511999999999",
  "status": "BOT_HANDLING",
  // ❌ source? Como rastrear origem?
}

// Atendente cria manualmente
POST /api/conversations
{
  "contactId": "uuid",
  // ❌ source? Como diferenciar de N8N?
}
```

**Sem campo `source`:**
- ❌ Não dá pra saber quantas conversas vieram do N8N vs manual
- ❌ Analytics quebrados (qual canal gera mais conversas?)
- ❌ Debugging difícil (essa conversa veio de onde?)
- ❌ Billing complicado (cobrar diferente por canal?)

**Schema Necessário:**
```prisma
model Conversation {
  source String?  // "n8n", "manual", "webhook", "whatsapp_direct"

  @@index([tenantId, source])  // Para analytics
}
```

**Severity:** 🟡 **IMPORTANTE** - Crítico para analytics e debugging

---

## 6️⃣ MIGRATIONS SQL

### Migration 001: Add BOT_HANDLING Status

**Arquivo:** `deploy-backend/prisma/migrations/001_add_bot_handling_status.sql`

```sql
-- ====================================================================
-- MIGRATION: 001_add_bot_handling_status.sql
-- Data: 2025-11-20
-- Autor: Backend Architect Audit
-- Descrição: Adicionar status BOT_HANDLING ao enum ConversationStatus
--            para suportar arquitetura híbrida IA (N8N) + Humano (CRM)
-- ====================================================================

BEGIN;

-- Step 1: Adicionar novo valor ao enum ANTES de OPEN
-- IMPORTANTE: Enum values são ordenados, BOT_HANDLING deve vir primeiro
ALTER TYPE "ConversationStatus"
  ADD VALUE IF NOT EXISTS 'BOT_HANDLING' BEFORE 'OPEN';

-- Step 2: Verificar enum atualizado (log)
DO $$
DECLARE
  enum_values TEXT;
BEGIN
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
  INTO enum_values
  FROM pg_enum
  WHERE enumtypid = 'ConversationStatus'::regtype;

  RAISE NOTICE 'ConversationStatus values: %', enum_values;
END$$;

COMMIT;

-- ====================================================================
-- ROLLBACK STRATEGY (MANUAL - não pode ser automatizado)
-- ====================================================================
-- PostgreSQL NÃO permite remover valores de enum se estiverem em uso.
--
-- Para rollback:
-- 1. Verificar se há conversas com status BOT_HANDLING:
--    SELECT COUNT(*) FROM conversations WHERE status = 'BOT_HANDLING';
--
-- 2. Se COUNT > 0, converter para OPEN:
--    UPDATE conversations SET status = 'OPEN' WHERE status = 'BOT_HANDLING';
--
-- 3. Recriar enum sem BOT_HANDLING:
--    ALTER TYPE "ConversationStatus" RENAME TO "ConversationStatus_old";
--    CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED');
--    ALTER TABLE conversations ALTER COLUMN status TYPE "ConversationStatus" USING status::text::"ConversationStatus";
--    DROP TYPE "ConversationStatus_old";
--
-- ⚠️ WARNING: Rollback é DESTRUTIVO e pode causar downtime.
-- ====================================================================

-- ====================================================================
-- VALIDAÇÃO PÓS-MIGRATION
-- ====================================================================
-- Executar após migration:
--
-- Test 1: Verificar enum completo
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'ConversationStatus'::regtype ORDER BY enumsortorder;
-- Esperado: BOT_HANDLING, OPEN, IN_PROGRESS, WAITING, CLOSED
--
-- Test 2: Criar conversa de teste
-- INSERT INTO conversations (id, "tenantId", "contactId", status, priority)
-- VALUES (gen_random_uuid(), '3ad64831-b32a-42b6-a58d-5a90277571b1',
--         (SELECT id FROM contacts LIMIT 1), 'BOT_HANDLING', 'MEDIUM');
-- Esperado: 1 row inserted
--
-- Test 3: Query by status
-- SELECT id, status FROM conversations WHERE status = 'BOT_HANDLING';
-- Esperado: Retorna a conversa criada no Test 2
--
-- Test 4: Atualizar status (escalação IA → Humano)
-- UPDATE conversations SET status = 'OPEN' WHERE status = 'BOT_HANDLING';
-- Esperado: Status atualizado com sucesso
-- ====================================================================
```

---

### Migration 002: Add Conversation Source Field

**Arquivo:** `deploy-backend/prisma/migrations/002_add_conversation_source.sql`

```sql
-- ====================================================================
-- MIGRATION: 002_add_conversation_source.sql
-- Data: 2025-11-20
-- Autor: Backend Architect Audit
-- Descrição: Adicionar campo 'source' à tabela conversations para
--            rastrear origem (n8n, manual, webhook, whatsapp_direct)
-- ====================================================================

BEGIN;

-- Step 1: Adicionar coluna source (nullable)
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Step 2: Popular dados existentes com valor 'legacy'
-- IMPORTANTE: Fazer ANTES de criar índice (performance)
UPDATE "conversations"
SET "source" = 'legacy'
WHERE "source" IS NULL;

-- Step 3: Adicionar comentário na coluna (documentação no schema)
COMMENT ON COLUMN "conversations"."source" IS
  'Origem da conversa: n8n (IA), manual (atendente), webhook (Meta), whatsapp_direct (QR code)';

-- Step 4: Criar índice composto para analytics
-- ORDEM: tenantId primeiro (sempre filtra por tenant), source depois
CREATE INDEX IF NOT EXISTS "idx_conversations_source"
  ON "conversations"("tenantId", "source");

-- Step 5: Criar índice adicional para queries de status + source
-- EXEMPLO: Conversas OPEN vindas do N8N
CREATE INDEX IF NOT EXISTS "idx_conversations_status_source"
  ON "conversations"("tenantId", "status", "source");

-- Step 6: Adicionar constraint CHECK (validação de valores)
-- IMPORTANTE: Garante apenas valores permitidos
ALTER TABLE "conversations"
  ADD CONSTRAINT "chk_conversation_source"
  CHECK ("source" IN ('n8n', 'manual', 'webhook', 'whatsapp_direct', 'legacy'));

-- Step 7: Estatísticas da migration
DO $$
DECLARE
  total_rows INT;
  legacy_rows INT;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM conversations;
  SELECT COUNT(*) INTO legacy_rows FROM conversations WHERE source = 'legacy';

  RAISE NOTICE 'Total conversations: %', total_rows;
  RAISE NOTICE 'Marked as legacy: %', legacy_rows;
  RAISE NOTICE 'Migration completed successfully';
END$$;

COMMIT;

-- ====================================================================
-- ROLLBACK STRATEGY
-- ====================================================================
-- BEGIN;
--
-- -- Step 1: Remover índices
-- DROP INDEX IF EXISTS "idx_conversations_source";
-- DROP INDEX IF EXISTS "idx_conversations_status_source";
--
-- -- Step 2: Remover constraint
-- ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "chk_conversation_source";
--
-- -- Step 3: Remover coluna
-- ALTER TABLE "conversations" DROP COLUMN IF EXISTS "source";
--
-- COMMIT;
-- ====================================================================

-- ====================================================================
-- VALIDAÇÃO PÓS-MIGRATION
-- ====================================================================
-- Test 1: Verificar coluna criada
-- \d conversations
-- Esperado: Coluna "source" tipo "text"
--
-- Test 2: Verificar dados populados
-- SELECT source, COUNT(*) FROM conversations GROUP BY source;
-- Esperado: legacy | <número>
--
-- Test 3: Verificar índices
-- \d conversations
-- Esperado: idx_conversations_source e idx_conversations_status_source
--
-- Test 4: Testar INSERT com novo campo
-- INSERT INTO conversations (id, "tenantId", "contactId", status, source)
-- VALUES (gen_random_uuid(), '...', '...', 'BOT_HANDLING', 'n8n');
-- Esperado: 1 row inserted
--
-- Test 5: Testar constraint (deve FALHAR)
-- INSERT INTO conversations (id, "tenantId", "contactId", status, source)
-- VALUES (gen_random_uuid(), '...', '...', 'OPEN', 'invalid_source');
-- Esperado: ERROR: new row violates check constraint "chk_conversation_source"
--
-- Test 6: Analytics query
-- SELECT source, status, COUNT(*)
-- FROM conversations
-- WHERE "tenantId" = '...'
-- GROUP BY source, status;
-- Esperado: Usa índice idx_conversations_status_source
-- ====================================================================
```

---

## 📊 ÍNDICES CRÍTICOS IDENTIFICADOS

### Índices Faltando (Performance)

**GAP #5: Índice para "Conversas Não Atribuídas"**

```prisma
@@index([tenantId, status, assignedToId, lastMessageAt])
// ✅ Otimiza query "não atribuídas"
```

**GAP #6: Índice para Analytics de Criação**

```prisma
model Conversation {
  @@index([tenantId, createdAt])  // ✅ Para relatórios
}
```

---

## 🎯 PRISMA SCHEMA ATUALIZADO COMPLETO

```prisma
// ============================================
// CONVERSATION - ATUALIZADO
// ✅ MUDANÇAS: BOT_HANDLING status, source field
// ============================================

model Conversation {
  id       String @id @default(uuid())
  tenantId String

  contactId    String
  assignedToId String?
  status       ConversationStatus @default(OPEN)
  priority     Priority           @default(MEDIUM)

  // ✅ NOVO: Rastreamento de origem
  source String? // "n8n", "manual", "webhook", "whatsapp_direct"

  lastMessageAt DateTime @default(now())
  createdAt     DateTime @default(now())
  closedAt      DateTime?

  metadata Json?

  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  contact    Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  assignedTo User?     @relation(fields: [assignedToId], references: [id], onDelete: SetNull)
  messages   Message[]
  tags       Tag[]

  // ✅ ÍNDICES OTIMIZADOS
  @@index([tenantId, status, lastMessageAt])
  @@index([tenantId, status, assignedToId, lastMessageAt]) // ✅ NOVO: Query "não atribuídas"
  @@index([tenantId, assignedToId])
  @@index([tenantId, contactId])
  @@index([tenantId, source]) // ✅ NOVO: Analytics por origem
  @@index([tenantId, createdAt]) // ✅ NOVO: Relatórios de criação
  @@map("conversations")
}

// ✅ ATUALIZADO: Adicionado BOT_HANDLING
enum ConversationStatus {
  BOT_HANDLING // ✅ NOVO: IA atendendo (NÃO aparece no Kanban)
  OPEN         // Escalado para humano (aparece no Kanban)
  IN_PROGRESS  // Atendente está conversando
  WAITING      // Aguardando resposta do cliente
  CLOSED       // Finalizada
}
```

---

## 🔑 COMANDOS DE VALIDAÇÃO

### Pós-Migration 001 (BOT_HANDLING)

```bash
# Test 1: Verificar enum completo
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'ConversationStatus'::regtype
ORDER BY enumsortorder;
"

# Esperado:
#    enumlabel
# ----------------
#  BOT_HANDLING
#  OPEN
#  IN_PROGRESS
#  WAITING
#  CLOSED
# (5 rows)
```

### Pós-Migration 002 (source)

```bash
# Test 1: Verificar coluna criada
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "\d conversations" | grep source

# Esperado:
#  source | text |

# Test 2: Verificar constraint CHECK
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'conversations'::regclass AND contype = 'c';
"

# Esperado:
# chk_conversation_source | (source = ANY (ARRAY['n8n'::text, 'manual'::text, ...]))
```

---

## ✅ CONCLUSÃO

### Nota Final: **7.5/10**

**Para atingir 9.0-9.5/10 (Enterprise-Grade):**
1. ✅ Aplicar migrations 001 e 002 (BOT_HANDLING + source)
2. ✅ Adicionar índices faltando (#5, #6)
3. ✅ Implementar soft delete em Contact
4. ✅ Adicionar campos SLA (firstResponseAt, resolvedAt)
5. ✅ Implementar optimistic locking (version field)
6. ✅ Configurar PgBouncer (connection pooling)

**Próximos Passos Imediatos:**
1. 🔴 **URGENTE:** Aplicar Migration 001 (BOT_HANDLING)
2. 🟡 **IMPORTANTE:** Aplicar Migration 002 (source field)
3. 🟡 **IMPORTANTE:** Atualizar schema.prisma com mudanças
4. 🟡 **IMPORTANTE:** Executar `npx prisma generate`
5. 🟡 **IMPORTANTE:** Deploy backend atualizado

---

**FIM DA AUDITORIA DATABASE SCHEMA**
