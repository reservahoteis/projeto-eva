-- Migration: Update bookingFlowId to v4
-- Date: 2026-02-06
-- Description: Atualizar Flow ID para versão 4 com campo children_count
-- Flow anterior: 3052481088276895
-- Flow novo: 1619040866184494

UPDATE tenants SET "bookingFlowId" = '1619040866184494';

-- Verify the update
-- SELECT id, slug, "bookingFlowId" FROM tenants;
