-- Migration: Add HEAD value to Role enum
-- Date: 2026-01-22
-- Description: Add HEAD role for supervisors who can see all conversations but cannot manage users

-- Verificar se o valor já existe antes de adicionar (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
        AND enumlabel = 'HEAD'
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'HEAD' AFTER 'TENANT_ADMIN';
    END IF;
END
$$;

COMMENT ON TYPE "Role" IS 'SUPER_ADMIN=Sistema, TENANT_ADMIN=Admin do hotel, HEAD=Supervisor, ATTENDANT=Atendente';
