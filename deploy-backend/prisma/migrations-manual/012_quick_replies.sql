-- ============================================================
-- Migration 012: Quick Replies (Respostas Rapidas)
-- Created: 2026-02-26
-- Purpose: Respostas pre-configuradas para atendentes via /comando no chat
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quick_replies') THEN

    CREATE TABLE quick_replies (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "tenantId"    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title         VARCHAR(100) NOT NULL,
      shortcut      VARCHAR(50) NOT NULL,
      content       TEXT NOT NULL,
      category      VARCHAR(50),
      "order"       INTEGER NOT NULL DEFAULT 0,
      "isActive"    BOOLEAN NOT NULL DEFAULT true,
      "createdById" TEXT REFERENCES users(id) ON DELETE SET NULL,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT uq_quick_replies_tenant_shortcut UNIQUE ("tenantId", shortcut)
    );

    CREATE INDEX idx_quick_replies_tenant ON quick_replies ("tenantId");
    CREATE INDEX idx_quick_replies_tenant_active ON quick_replies ("tenantId", "isActive");

    RAISE NOTICE 'Created quick_replies table';
  ELSE
    RAISE NOTICE 'quick_replies table already exists, skipping';
  END IF;
END $$;

-- ============================================================
-- Seed: Respostas rapidas padrao para tenants existentes
-- ============================================================
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    IF NOT EXISTS (SELECT 1 FROM quick_replies WHERE "tenantId" = t.id LIMIT 1) THEN

      INSERT INTO quick_replies ("tenantId", title, shortcut, content, category, "order") VALUES
      (t.id, 'Pet Ilhabela', 'petilha',
       E'Os hóspedes com pets de pequeno e médio porte (com exceção das raças pitbull, rottweiler e Bull terrier que não aceitamos) são bem-vindos nas Suítes Jardim com Banheira e Suíte Varanda Street, que tem um espaço exclusivo e cobramos uma taxa de 150,00 fixo por pet (limite de 2 pets por suíte). É proibido o pet ficar solto na Reserva assim evitamos que ele se perca e que, caso faça cocô, você possa ver e recolher, contribuindo para a manutenção do nosso espaço. Possuímos um ponto de saquinho a disposição em cada ala. Caso você opte por deixar o pet sozinho na suíte por pouco tempo, para nós não há problema, mas caso o ambiente novo seja estímulo para latidos, indicamos que leve o animalzinho com você. Assim, garantimos o bem-estar dele e a tranquilidade dos demais hóspedes.',
       'Politicas', 1),

      (t.id, 'Pet Todas Unidades', 'pettodas',
       E'Os hóspedes com pets de pequeno e médio porte (com exceção das raças pitbull, rottweiler e Bull terrier que não aceitamos) são bem-vindos. Cobramos uma taxa de 150,00 fixo por pet (limite de 2 pets por suíte). É proibido o pet ficar solto na Reserva assim evitamos que ele se perca e que, caso faça cocô, você possa ver e recolher, contribuindo para a manutenção do nosso espaço. Possuímos um ponto de saquinho a disposição em cada ala. Caso você opte por deixar o pet sozinho na cabana por pouco tempo, para nós não há problema, mas caso o ambiente novo seja estímulo para latidos, indicamos que leve o animalzinho com você. Assim, garantimos o bem-estar dele e a tranquilidade dos demais hóspedes.',
       'Politicas', 2),

      (t.id, 'Check-in e Check-out', 'checkin',
       E'Check-in a partir das 15h e Check out até 12h. A chegada no hotel só é permitida a partir das 15h. Não temos maleiro pra guardar as bagagens. 🙏',
       'Informacoes', 3),

      (t.id, 'Orçamento', 'orcamento',
       E'Para que possamos efetuar o seu orçamento e gerar o link preciso das seguintes informações: Datas check-in e checkout, quantidade de pessoas, crianças com idade e se tem Pet',
       'Vendas', 4),

      (t.id, 'Tarifas', 'tarifas',
       E'Importante - Não trabalhamos com tarifas fixas. Os valores podem sofrer alteração automaticamente conforme período e demanda. 🙏😉',
       'Informacoes', 5);

      RAISE NOTICE 'Seeded quick replies for tenant %', t.id;
    END IF;
  END LOOP;
END $$;
