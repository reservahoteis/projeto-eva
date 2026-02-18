-- 010: Add per-channel N8N webhook URLs to Tenant
-- Permite fluxos N8N separados por canal (Messenger, Instagram)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Tenant' AND column_name = 'n8nWebhookUrlMessenger'
  ) THEN
    ALTER TABLE "Tenant" ADD COLUMN "n8nWebhookUrlMessenger" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Tenant' AND column_name = 'n8nWebhookUrlInstagram'
  ) THEN
    ALTER TABLE "Tenant" ADD COLUMN "n8nWebhookUrlInstagram" TEXT;
  END IF;
END $$;
