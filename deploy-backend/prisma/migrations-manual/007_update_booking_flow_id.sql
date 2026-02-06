-- Migration: Update bookingFlowId with published flow ID
-- Date: 2026-02-06
-- Description: Set the bookingFlowId for the tenant to the published Flow ID
-- Flow: Orcamento_Hospedagem_v3 (ID: 3052481088276895)

-- Update all tenants with the published Flow ID
-- The flow is shared across all tenants in this setup
UPDATE tenants
SET "bookingFlowId" = '3052481088276895'
WHERE "bookingFlowId" IS NULL;

-- Verify the update
-- SELECT id, slug, "bookingFlowId" FROM tenants;
