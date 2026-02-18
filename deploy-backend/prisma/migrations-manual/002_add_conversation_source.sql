-- =====================================================
-- Migration: 002_add_conversation_source.sql
-- Description: Adicionar campo source à tabela conversations
-- Author: System
-- Date: 2025-11-20
-- =====================================================

-- PASSO 1: Adicionar coluna source (se não existir)
ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "source" VARCHAR(50);

-- PASSO 2: Comentário na coluna para documentação
COMMENT ON COLUMN "conversations"."source" IS 'Origem da conversa: n8n, manual, webhook, whatsapp';

-- PASSO 3: Criar índices para otimizar queries por source
-- Índice simples para filtrar por source
CREATE INDEX IF NOT EXISTS "idx_conversations_source"
ON "conversations" ("tenantId", "source")
WHERE "source" IS NOT NULL;

-- Índice composto para queries complexas com source
CREATE INDEX IF NOT EXISTS "idx_conversations_tenant_source_created"
ON "conversations" ("tenantId", "source", "createdAt" DESC);

-- PASSO 4: Atualizar conversas existentes com source default (opcional)
-- Descomente se quiser definir um valor default para registros existentes
-- UPDATE "conversations"
-- SET "source" = 'manual'
-- WHERE "source" IS NULL
-- AND "createdAt" < '2025-11-20'::timestamp;

-- PASSO 5: Adicionar constraint CHECK para validar valores (opcional)
-- Garante que apenas valores válidos sejam inseridos
DO $$
BEGIN
    -- Remove constraint se existir (para idempotência)
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'conversations_source_check'
    ) THEN
        ALTER TABLE "conversations" DROP CONSTRAINT "conversations_source_check";
    END IF;

    -- Adiciona constraint
    ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_source_check"
    CHECK ("source" IN ('n8n', 'manual', 'webhook', 'whatsapp', 'whatsapp_direct') OR "source" IS NULL);
END $$;

-- PASSO 6: Criar índice para queries de análise por source
-- Útil para dashboards e relatórios
CREATE INDEX IF NOT EXISTS "idx_conversations_stats_by_source"
ON "conversations" ("tenantId", "source", "status", "createdAt")
WHERE "source" IS NOT NULL;

-- ESTATÍSTICAS ÚTEIS (executar após migration):
-- Contagem por source:
-- SELECT source, COUNT(*) as total
-- FROM conversations
-- GROUP BY source
-- ORDER BY total DESC;

-- Conversas do N8N por status:
-- SELECT status, COUNT(*) as total
-- FROM conversations
-- WHERE source = 'n8n'
-- GROUP BY status;

-- ROLLBACK (se necessário):
-- ALTER TABLE "conversations" DROP COLUMN IF EXISTS "source";
-- DROP INDEX IF EXISTS "idx_conversations_source";
-- DROP INDEX IF EXISTS "idx_conversations_tenant_source_created";
-- DROP INDEX IF EXISTS "idx_conversations_stats_by_source";

-- COMENTÁRIOS IMPORTANTES:
-- 1. Campo source é VARCHAR(50) para flexibilidade futura
-- 2. Campo é nullable para backward compatibility
-- 3. Índices são parciais (WHERE source IS NOT NULL) para eficiência
-- 4. Constraint CHECK garante integridade dos dados
-- 5. Migration é IDEMPOTENTE - pode ser executada múltiplas vezes