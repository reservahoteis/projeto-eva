-- Migration: Add n8nWebhookUrl to tenants table
-- Date: 2025-11-29
-- Description: Add column for N8N webhook URL to receive forwarded messages

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "n8nWebhookUrl" VARCHAR(500);

COMMENT ON COLUMN tenants."n8nWebhookUrl" IS 'URL do webhook N8N para receber mensagens do WhatsApp';
