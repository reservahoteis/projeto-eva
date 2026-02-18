-- Migration: Add bookingFlowId to tenants table
-- Date: 2026-02-06
-- Description: Add column for WhatsApp Flow ID used for booking/quote flow

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "bookingFlowId" TEXT;

COMMENT ON COLUMN tenants."bookingFlowId" IS 'ID do Flow de orcamento publicado na Meta (WhatsApp Flows)';
