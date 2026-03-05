-- 013: Adicionar campos de enriquecimento ao Contact
-- Permite unificar contatos CRM com contatos reais das conversas

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'firstName') THEN
    ALTER TABLE contacts ADD COLUMN "firstName" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'lastName') THEN
    ALTER TABLE contacts ADD COLUMN "lastName" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'companyName') THEN
    ALTER TABLE contacts ADD COLUMN "companyName" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'designation') THEN
    ALTER TABLE contacts ADD COLUMN "designation" TEXT;
  END IF;
END $$;
