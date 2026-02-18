-- Migration: Add SALES role and opportunity fields
-- Date: 2026-01-23
-- Description:
--   1. Add SALES value to Role enum for sales team
--   2. Add isOpportunity and opportunityAt columns to conversations
--      for tracking sales opportunities from follow-up campaigns

-- =============================================
-- PART 1: Add SALES to Role enum (idempotent)
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
        AND enumlabel = 'SALES'
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'SALES';
    END IF;
END
$$;

-- =============================================
-- PART 2: Add opportunity fields to conversations
-- =============================================

-- Add isOpportunity column (default false)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "isOpportunity" BOOLEAN DEFAULT false;

-- Add opportunityAt timestamp column
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "opportunityAt" TIMESTAMP;

-- Create index for efficient opportunity queries
CREATE INDEX IF NOT EXISTS "conversations_tenantId_isOpportunity_opportunityAt_idx"
    ON conversations ("tenantId", "isOpportunity", "opportunityAt");

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON COLUMN conversations."isOpportunity" IS 'true = conversa é uma oportunidade de venda (cliente não converteu no follow-up)';
COMMENT ON COLUMN conversations."opportunityAt" IS 'Data/hora em que a conversa foi marcada como oportunidade';
