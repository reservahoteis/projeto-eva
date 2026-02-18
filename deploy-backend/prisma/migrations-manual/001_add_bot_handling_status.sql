-- =====================================================
-- Migration: 001_add_bot_handling_status.sql
-- Description: Adicionar status BOT_HANDLING ao enum ConversationStatus
-- Author: System
-- Date: 2025-11-20
-- =====================================================

-- PASSO 1: Verificar se o valor já existe (para idempotência)
DO $$
BEGIN
    -- Adiciona BOT_HANDLING apenas se não existir
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'BOT_HANDLING'
        AND enumtypid = (
            SELECT oid
            FROM pg_type
            WHERE typname = 'ConversationStatus'
        )
    ) THEN
        -- Adiciona o novo valor ao início do enum
        -- IMPORTANTE: 'BEFORE' permite inserir antes de um valor existente
        ALTER TYPE "ConversationStatus" ADD VALUE 'BOT_HANDLING' BEFORE 'OPEN';
    END IF;
END $$;

-- PASSO 2: Criar índice para otimizar queries de conversas BOT_HANDLING
-- Este índice é parcial, incluindo apenas conversas com status BOT_HANDLING
CREATE INDEX IF NOT EXISTS "idx_conversations_bot_handling"
ON "conversations" ("tenantId", "lastMessageAt" DESC)
WHERE "status" = 'BOT_HANDLING';

-- PASSO 3: Criar índice composto para filtros múltiplos com BOT_HANDLING
-- Útil para queries que filtram por múltiplos status incluindo BOT_HANDLING
CREATE INDEX IF NOT EXISTS "idx_conversations_multiple_status"
ON "conversations" ("tenantId", "status", "assignedToId", "lastMessageAt" DESC);

-- COMENTÁRIOS IMPORTANTES:
-- 1. Esta migration é IDEMPOTENTE - pode ser executada múltiplas vezes sem erro
-- 2. BOT_HANDLING é inserido ANTES de OPEN para manter ordem lógica
-- 3. Conversas com BOT_HANDLING NÃO devem aparecer no Kanban
-- 4. Índices otimizam queries para excluir/incluir BOT_HANDLING

-- VERIFICAÇÃO (executar após migration):
-- SELECT enumlabel FROM pg_enum
-- WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ConversationStatus')
-- ORDER BY enumsortorder;

-- ROLLBACK (se necessário - CUIDADO!):
-- Não é possível remover valores de enum em PostgreSQL
-- Seria necessário:
-- 1. Criar novo enum sem BOT_HANDLING
-- 2. Alterar coluna para usar novo enum
-- 3. Dropar enum antigo
-- 4. Renomear novo enum