-- Migration: Omnichannel Support
-- Date: 2026-02-18
-- Description: Adicionar suporte a Messenger e Instagram
-- IMPORTANTE: Rodar ANTES de deployar o novo codigo

-- =============================================
-- 1. Criar enum Channel
-- =============================================
DO $$ BEGIN
  CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'MESSENGER', 'INSTAGRAM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. Tabela contacts: adicionar channel e externalId
-- =============================================

-- Adicionar coluna channel (default WHATSAPP para dados existentes)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP';

-- Adicionar coluna externalId (inicialmente nullable para preencher)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- Preencher externalId com phoneNumber para contatos existentes (todos sao WhatsApp)
UPDATE contacts SET "externalId" = "phoneNumber" WHERE "externalId" IS NULL AND "phoneNumber" IS NOT NULL;

-- Para contatos sem phoneNumber (nao deveria existir, mas safety net)
UPDATE contacts SET "externalId" = id WHERE "externalId" IS NULL;

-- Agora tornar externalId NOT NULL
ALTER TABLE contacts ALTER COLUMN "externalId" SET NOT NULL;

-- Remover unique constraint antigo (tenantId, phoneNumber) se existir
-- O nome pode variar, tentar ambos os formatos comuns
DROP INDEX IF EXISTS "contacts_tenantId_phoneNumber_key";
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS "contacts_tenantId_phoneNumber_key";

-- Tornar phoneNumber opcional (pode ser NULL para Messenger/Instagram)
ALTER TABLE contacts ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- Criar novo unique constraint (tenantId, channel, externalId)
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenantId_channel_externalId_key"
  ON contacts ("tenantId", "channel", "externalId");

-- Index para buscas por canal
CREATE INDEX IF NOT EXISTS "contacts_tenantId_channel_externalId_idx"
  ON contacts ("tenantId", "channel", "externalId");

-- Manter index de phoneNumber para buscas WA
CREATE INDEX IF NOT EXISTS "contacts_tenantId_phoneNumber_idx"
  ON contacts ("tenantId", "phoneNumber");

-- =============================================
-- 3. Tabela conversations: adicionar channel
-- =============================================

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "channel" "Channel" NOT NULL DEFAULT 'WHATSAPP';

-- Index para queries por canal
CREATE INDEX IF NOT EXISTS "conversations_tenantId_channel_status_lastMessageAt_idx"
  ON conversations ("tenantId", "channel", "status", "lastMessageAt");

-- =============================================
-- 4. Tabela messages: renomear whatsappMessageId -> externalMessageId (se aplicavel)
-- =============================================

-- Verificar se coluna whatsappMessageId existe e renomear
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'whatsappMessageId'
  ) THEN
    ALTER TABLE messages RENAME COLUMN "whatsappMessageId" TO "externalMessageId";
  END IF;
END $$;

-- Se externalMessageId nao existe (caso ja tenha sido criado com esse nome), criar
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "externalMessageId" TEXT;

-- Garantir unique index em externalMessageId
CREATE UNIQUE INDEX IF NOT EXISTS "messages_externalMessageId_key"
  ON messages ("externalMessageId");

-- =============================================
-- 5. Tabela tenants: adicionar credenciais Messenger/Instagram, remover bookingFlowId
-- =============================================

-- Messenger
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "messengerPageId" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "messengerAccessToken" TEXT;

-- Instagram
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "instagramAccountId" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "instagramAccessToken" TEXT;

-- Remover bookingFlowId (WhatsApp Flows removido)
ALTER TABLE tenants DROP COLUMN IF EXISTS "bookingFlowId";

-- =============================================
-- 6. Verificacao
-- =============================================
-- Rodar apos a migration para verificar:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'contacts' ORDER BY ordinal_position;
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'conversations' ORDER BY ordinal_position;
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position;
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'tenants' AND column_name IN ('messengerPageId', 'instagramAccountId', 'bookingFlowId');
