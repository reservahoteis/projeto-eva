-- =============================================
-- CRM Core Dev Database Seed
-- Populates crm_core_dev with production-aligned data
-- =============================================

BEGIN;

-- Clean existing data (order matters for FK constraints)
TRUNCATE TABLE deal_products, lead_products, deal_contacts,
  status_change_logs, notifications, data_imports,
  assignments, call_logs, communications, comments, notes, tasks,
  deals, leads, contacts, organizations,
  service_days, service_level_priorities, service_level_agreements,
  assignment_rules, products, lost_reasons, territories, industries,
  lead_sources, deal_statuses, lead_statuses,
  users, tenants
CASCADE;

-- =============================================
-- 1. TENANT (matches production)
-- =============================================
INSERT INTO tenants (id, name, slug, plan, status, currency, timezone)
VALUES (
  '916ca70a-0428-47f8-98a3-0f791e42f292',
  'Hoteis Reserva',
  'hoteis-reserva',
  'PRO',
  'ACTIVE',
  'BRL',
  'America/Sao_Paulo'
);

-- =============================================
-- 2. USERS (matches production IDs)
-- =============================================
-- password_hash = bcrypt hash of 'Admin@123'
INSERT INTO users (id, tenant_id, email, password_hash, name, role, status) VALUES
('de44c083-59e6-4ef9-abe7-8f7195b58786', NULL, 'admin@botreserva.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Super Admin', 'SUPER_ADMIN', 'ACTIVE'),
('26523add-0ec0-4e13-b682-681ca35a41db', '916ca70a-0428-47f8-98a3-0f791e42f292', 'tech@hoteisreserva.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Tainan Head Tech', 'TENANT_ADMIN', 'ACTIVE'),
('e2fa0275-f24a-4d39-922a-457dd1531854', '916ca70a-0428-47f8-98a3-0f791e42f292', 'jsalge82@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Joao Salge', 'TENANT_ADMIN', 'ACTIVE'),
('53bd16d5-ae7e-4138-9bbf-ce5ec0374d66', '916ca70a-0428-47f8-98a3-0f791e42f292', 'grazielereservacampos@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Graziele Head Campos', 'HEAD', 'ACTIVE'),
('40a7c913-0eb4-4463-9f5d-1b62c77a159f', '916ca70a-0428-47f8-98a3-0f791e42f292', 'contato@3ian.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Vinicius almeida', 'TENANT_ADMIN', 'ACTIVE'),
('2df7ee91-4797-41bd-a0cb-7a2c93cfb62e', '916ca70a-0428-47f8-98a3-0f791e42f292', 'ilhabela@hoteisreserva.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Gustavo Bonim', 'HEAD', 'ACTIVE'),
('c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '916ca70a-0428-47f8-98a3-0f791e42f292', 'central@hoteisreserva.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Cassio Franco', 'SALES', 'ACTIVE'),
('80bf6f47-e35c-4670-8108-944ab8482e5a', '916ca70a-0428-47f8-98a3-0f791e42f292', 'thiagopedrosa.mkt@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Thiago Pedrosa Mkt', 'HEAD', 'ACTIVE'),
('c8e17f9a-7a5a-49fa-b6b5-d2b4eb2708fb', '916ca70a-0428-47f8-98a3-0f791e42f292', 'campos@hoteisreserva.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Head Campos', 'HEAD', 'ACTIVE'),
('49e5563f-0d52-4258-b6e0-2920278896c6', '916ca70a-0428-47f8-98a3-0f791e42f292', 'admin@hoteisreserva.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Administrador Hoteis Reserva', 'TENANT_ADMIN', 'ACTIVE'),
('3831c12c-e13a-49a3-862b-1aa098ca017d', '916ca70a-0428-47f8-98a3-0f791e42f292', 'rm@hoteisreserva.com.br', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'RM Caio', 'TENANT_ADMIN', 'ACTIVE'),
('c76ea9d2-edcb-40c9-a191-fed3e2d25a31', '916ca70a-0428-47f8-98a3-0f791e42f292', 'reserva.bonin@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Luiz Gustavo Head Ilhabela', 'ATTENDANT', 'ACTIVE'),
('bf972e37-5a6d-4720-8b64-10d7565de29b', '916ca70a-0428-47f8-98a3-0f791e42f292', 'paulareservaihabela@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Paula Maya Head Camburi', 'HEAD', 'ACTIVE'),
('c3e921e0-037f-4ef7-ab7e-60e24c19f491', '916ca70a-0428-47f8-98a3-0f791e42f292', 'headredereserva@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Mariana Maya', 'TENANT_ADMIN', 'ACTIVE'),
('6a230247-4810-4f5e-8a15-1b2a6685c944', '916ca70a-0428-47f8-98a3-0f791e42f292', 'vinicius.mansao@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Teste Vendas', 'SALES', 'ACTIVE'),
('47de0513-fc6e-4b26-84f9-d20a9dba1f2e', '916ca70a-0428-47f8-98a3-0f791e42f292', 'marcioffranco@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Marcio Franco', 'TENANT_ADMIN', 'ACTIVE'),
('dfa6e1b5-6946-4bfb-bbaf-7e0d44dca90f', '916ca70a-0428-47f8-98a3-0f791e42f292', 'reservascentral11@gmail.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Simone Central', 'SALES', 'ACTIVE'),
('d0c1d5b6-ce28-416e-bc8c-6fdccd760ee6', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Eduardosindelar@icloud.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Eduardo Head SAP', 'HEAD', 'ACTIVE'),
('84f6a0eb-6c1c-4dcd-b574-b0ba3357bf9e', '916ca70a-0428-47f8-98a3-0f791e42f292', 'vinicius.quadros@icloud.com', '$2b$10$xKqYZ7Z7Z7Z7Z7Z7Z7Z7ZuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Head Teste', 'HEAD', 'ACTIVE');

-- =============================================
-- 3. LEAD STATUSES
-- =============================================
INSERT INTO lead_statuses (id, tenant_id, label, color, status_type, position) VALUES
('a0000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Novo', '#blue', 'Open', 0),
('a0000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Contato Realizado', '#orange', 'Ongoing', 1),
('a0000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Qualificado', '#green', 'Ongoing', 2),
('a0000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Interessado', '#purple', 'Ongoing', 3),
('a0000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Negociando', '#yellow', 'Ongoing', 4),
('a0000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Convertido', '#green', 'OnHold', 5),
('a0000001-0000-0000-0000-000000000007', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Perdido', '#red', 'Lost', 6);

-- =============================================
-- 4. DEAL STATUSES
-- =============================================
INSERT INTO deal_statuses (id, tenant_id, label, color, status_type, position, probability) VALUES
('b0000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Proposta Enviada', '#blue', 'Open', 0, 20),
('b0000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Em Negociacao', '#orange', 'Ongoing', 1, 40),
('b0000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Revisao Contrato', '#yellow', 'Ongoing', 2, 60),
('b0000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Aguardando Pagamento', '#purple', 'Ongoing', 3, 80),
('b0000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Fechado (Ganho)', '#green', 'Won', 4, 100),
('b0000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Perdido', '#red', 'Lost', 5, 0);

-- =============================================
-- 5. LEAD SOURCES
-- =============================================
INSERT INTO lead_sources (id, tenant_id, name) VALUES
('c0000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'WhatsApp'),
('c0000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Instagram'),
('c0000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Facebook'),
('c0000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Site'),
('c0000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Indicacao'),
('c0000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Booking.com'),
('c0000001-0000-0000-0000-000000000007', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Airbnb'),
('c0000001-0000-0000-0000-000000000008', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Google Ads');

-- =============================================
-- 6. INDUSTRIES
-- =============================================
INSERT INTO industries (id, tenant_id, name) VALUES
('d0000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Hospedagem'),
('d0000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Turismo'),
('d0000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Eventos'),
('d0000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Gastronomia'),
('d0000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Agencia de Viagens'),
('d0000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Corporativo');

-- =============================================
-- 7. TERRITORIES
-- =============================================
INSERT INTO territories (id, tenant_id, name, parent_id) VALUES
('e0000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Brasil', NULL),
('e0000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sao Paulo', 'e0000001-0000-0000-0000-000000000001'),
('e0000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Rio de Janeiro', 'e0000001-0000-0000-0000-000000000001'),
('e0000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Litoral Norte SP', 'e0000001-0000-0000-0000-000000000002'),
('e0000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Ilhabela', 'e0000001-0000-0000-0000-000000000004'),
('e0000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Campos do Jordao', 'e0000001-0000-0000-0000-000000000002');

-- =============================================
-- 8. LOST REASONS
-- =============================================
INSERT INTO lost_reasons (id, tenant_id, name) VALUES
('f0000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Preco elevado'),
('f0000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Concorrente'),
('f0000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sem disponibilidade'),
('f0000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Desistiu da viagem'),
('f0000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sem resposta'),
('f0000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Outro destino');

-- =============================================
-- 9. PRODUCTS
-- =============================================
INSERT INTO products (id, tenant_id, name, code, rate, description) VALUES
('10000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Suite Standard', 'STD', 450.00, 'Suite standard com vista parcial'),
('10000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Suite Premium', 'PRM', 750.00, 'Suite premium com vista para o mar'),
('10000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Suite Master', 'MST', 1200.00, 'Suite master com jacuzzi privativa'),
('10000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Cafe da Manha', 'BKF', 85.00, 'Cafe da manha completo por pessoa');

-- =============================================
-- 10. ORGANIZATIONS
-- =============================================
INSERT INTO organizations (id, tenant_id, organization_name, website, no_of_employees, annual_revenue, industry_id, territory_id) VALUES
('20000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Pousada Mar Azul', 'https://marazzul.com.br', '11-50', 2500000.00, 'd0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000005'),
('20000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Hotel Serra Encantada', 'https://serraencantada.com.br', '51-200', 8000000.00, 'd0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000006'),
('20000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Agencia Turismo Total', 'https://turismototal.com.br', '11-50', 1500000.00, 'd0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002'),
('20000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Eventos Premium SP', 'https://eventospremium.com.br', '11-50', 3000000.00, 'd0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000002');

-- =============================================
-- 11. CONTACTS
-- =============================================
INSERT INTO contacts (id, tenant_id, salutation, first_name, last_name, full_name, email, mobile_no, phone, company_name, designation, industry_id, territory_id) VALUES
('30000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sr.', 'Carlos', 'Oliveira', 'Sr. Carlos Oliveira', 'carlos@marazzul.com.br', '+5512991234567', NULL, 'Pousada Mar Azul', 'Gerente Geral', 'd0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000005'),
('30000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sra.', 'Ana', 'Santos', 'Sra. Ana Santos', 'ana@serraencantada.com.br', '+5512992345678', NULL, 'Hotel Serra Encantada', 'Diretora Comercial', 'd0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000006'),
('30000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sr.', 'Pedro', 'Lima', 'Sr. Pedro Lima', 'pedro@turismototal.com.br', '+5511993456789', NULL, 'Agencia Turismo Total', 'Proprietario', 'd0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002'),
('30000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sra.', 'Mariana', 'Costa', 'Sra. Mariana Costa', 'mariana@eventospremium.com.br', '+5511994567890', NULL, 'Eventos Premium SP', 'CEO', 'd0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000002'),
('30000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sr.', 'Roberto', 'Ferreira', 'Sr. Roberto Ferreira', 'roberto.ferreira@gmail.com', '+5511995678901', NULL, NULL, 'Viajante', NULL, NULL),
('30000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sra.', 'Julia', 'Mendes', 'Sra. Julia Mendes', 'julia.mendes@hotmail.com', '+5521996789012', NULL, NULL, NULL, NULL, 'e0000001-0000-0000-0000-000000000003'),
('30000001-0000-0000-0000-000000000007', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sr.', 'Fernando', 'Souza', 'Sr. Fernando Souza', 'fernando.souza@empresa.com', '+5511997890123', NULL, 'Empresa XYZ', 'Diretor RH', 'd0000001-0000-0000-0000-000000000006', 'e0000001-0000-0000-0000-000000000002'),
('30000001-0000-0000-0000-000000000008', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Sra.', 'Camila', 'Rodrigues', 'Sra. Camila Rodrigues', 'camila.rodrigues@gmail.com', '+5512998901234', NULL, NULL, NULL, NULL, 'e0000001-0000-0000-0000-000000000005');

-- =============================================
-- 12. LEADS
-- =============================================
INSERT INTO leads (id, tenant_id, naming_series, first_name, last_name, lead_name, email, mobile_no, organization_name, status_id, source_id, industry_id, territory_id, lead_owner_id, created_by_id) VALUES
('40000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-001', 'Ricardo', 'Almeida', 'Ricardo Almeida', 'ricardo.almeida@gmail.com', '+5511991111111', NULL, 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', NULL, 'e0000001-0000-0000-0000-000000000005', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '26523add-0ec0-4e13-b682-681ca35a41db'),
('40000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-002', 'Fernanda', 'Barbosa', 'Fernanda Barbosa', 'fernanda.barbosa@hotmail.com', '+5511992222222', NULL, 'a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002', NULL, 'e0000001-0000-0000-0000-000000000002', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '26523add-0ec0-4e13-b682-681ca35a41db'),
('40000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-003', 'Lucas', 'Pereira', 'Lucas Pereira', 'lucas.pereira@empresa.com', '+5521993333333', 'Corporativo ABC', 'a0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000006', 'e0000001-0000-0000-0000-000000000003', '53bd16d5-ae7e-4138-9bbf-ce5ec0374d66', '26523add-0ec0-4e13-b682-681ca35a41db'),
('40000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-004', 'Beatriz', 'Nunes', 'Beatriz Nunes', 'beatriz.nunes@gmail.com', '+5512994444444', NULL, 'a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', NULL, 'e0000001-0000-0000-0000-000000000005', '2df7ee91-4797-41bd-a0cb-7a2c93cfb62e', '26523add-0ec0-4e13-b682-681ca35a41db'),
('40000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-005', 'Marcos', 'Silva', 'Marcos Silva', 'marcos.silva@agencia.com', '+5511995555555', 'Agencia Turismo Total', 'a0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000005', 'd0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '40a7c913-0eb4-4463-9f5d-1b62c77a159f'),
('40000001-0000-0000-0000-000000000006', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-006', 'Isabela', 'Rocha', 'Isabela Rocha', 'isabela.rocha@gmail.com', '+5512996666666', NULL, 'a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000003', NULL, 'e0000001-0000-0000-0000-000000000005', NULL, '40a7c913-0eb4-4463-9f5d-1b62c77a159f'),
('40000001-0000-0000-0000-000000000007', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-007', 'Gustavo', 'Martins', 'Gustavo Martins', 'gustavo.martins@hotel.com', '+5511997777777', 'Hotel Praia Bela', 'a0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000008', 'd0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000004', '53bd16d5-ae7e-4138-9bbf-ce5ec0374d66', '40a7c913-0eb4-4463-9f5d-1b62c77a159f'),
('40000001-0000-0000-0000-000000000008', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-008', 'Larissa', 'Campos', 'Larissa Campos', 'larissa.campos@outlook.com', '+5521998888888', NULL, 'a0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000001', NULL, 'e0000001-0000-0000-0000-000000000003', NULL, '40a7c913-0eb4-4463-9f5d-1b62c77a159f'),
('40000001-0000-0000-0000-000000000009', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-009', 'Thiago', 'Araujo', 'Thiago Araujo', 'thiago.araujo@corporativo.com', '+5511999999999', 'Grupo Corporativo X', 'a0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000004', 'd0000001-0000-0000-0000-000000000006', 'e0000001-0000-0000-0000-000000000002', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '26523add-0ec0-4e13-b682-681ca35a41db'),
('40000001-0000-0000-0000-000000000010', '916ca70a-0428-47f8-98a3-0f791e42f292', 'LEAD-2026-010', 'Patricia', 'Moraes', 'Patricia Moraes', 'patricia.moraes@gmail.com', '+5512990000000', NULL, 'a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002', NULL, 'e0000001-0000-0000-0000-000000000006', '2df7ee91-4797-41bd-a0cb-7a2c93cfb62e', '26523add-0ec0-4e13-b682-681ca35a41db');

-- =============================================
-- 13. DEALS
-- =============================================
INSERT INTO deals (id, tenant_id, naming_series, organization_id, status_id, deal_owner_id, contact_id, deal_value, currency, expected_closure_date, first_name, last_name, lead_name, email, mobile_no, organization_name, source_id, territory_id, created_by_id) VALUES
('50000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'DEAL-2026-001', '20000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000002', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '30000001-0000-0000-0000-000000000001', 15000.00, 'BRL', '2026-03-15', 'Carlos', 'Oliveira', 'Carlos Oliveira', 'carlos@marazzul.com.br', '+5512991234567', 'Pousada Mar Azul', 'c0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000005', '26523add-0ec0-4e13-b682-681ca35a41db'),
('50000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'DEAL-2026-002', '20000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000001', '53bd16d5-ae7e-4138-9bbf-ce5ec0374d66', '30000001-0000-0000-0000-000000000002', 45000.00, 'BRL', '2026-04-01', 'Ana', 'Santos', 'Ana Santos', 'ana@serraencantada.com.br', '+5512992345678', 'Hotel Serra Encantada', 'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000006', '40a7c913-0eb4-4463-9f5d-1b62c77a159f'),
('50000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'DEAL-2026-003', '20000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000003', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '30000001-0000-0000-0000-000000000004', 28000.00, 'BRL', '2026-03-20', 'Mariana', 'Costa', 'Mariana Costa', 'mariana@eventospremium.com.br', '+5511994567890', 'Eventos Premium SP', 'c0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000002', '26523add-0ec0-4e13-b682-681ca35a41db'),
('50000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'DEAL-2026-004', NULL, 'b0000001-0000-0000-0000-000000000004', '2df7ee91-4797-41bd-a0cb-7a2c93cfb62e', '30000001-0000-0000-0000-000000000007', 8500.00, 'BRL', '2026-03-10', 'Fernando', 'Souza', 'Fernando Souza', 'fernando.souza@empresa.com', '+5511997890123', NULL, 'c0000001-0000-0000-0000-000000000008', 'e0000001-0000-0000-0000-000000000002', '40a7c913-0eb4-4463-9f5d-1b62c77a159f'),
('50000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'DEAL-2026-005', '20000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000005', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '30000001-0000-0000-0000-000000000003', 12000.00, 'BRL', '2026-02-28', 'Pedro', 'Lima', 'Pedro Lima', 'pedro@turismototal.com.br', '+5511993456789', 'Agencia Turismo Total', 'c0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000002', '26523add-0ec0-4e13-b682-681ca35a41db');

-- =============================================
-- 14. DEAL_CONTACTS
-- =============================================
INSERT INTO deal_contacts (deal_id, contact_id, is_primary) VALUES
('50000001-0000-0000-0000-000000000001', '30000001-0000-0000-0000-000000000001', true),
('50000001-0000-0000-0000-000000000002', '30000001-0000-0000-0000-000000000002', true),
('50000001-0000-0000-0000-000000000003', '30000001-0000-0000-0000-000000000004', true),
('50000001-0000-0000-0000-000000000004', '30000001-0000-0000-0000-000000000007', true),
('50000001-0000-0000-0000-000000000005', '30000001-0000-0000-0000-000000000003', true);

-- =============================================
-- 15. NOTES
-- =============================================
INSERT INTO notes (id, tenant_id, title, content, reference_doctype, reference_docname, created_by_id) VALUES
('60000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Preferencias do hospede', 'Carlos prefere quartos no andar superior com vista para o mar. Alergia a amendoim - informar cozinha.', 'Contact', '30000001-0000-0000-0000-000000000001', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4'),
('60000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Reuniao com Ana', 'Ana quer fechar pacote de 20 suites para evento corporativo em abril. Solicita desconto de 15%.', 'Deal', '50000001-0000-0000-0000-000000000002', '53bd16d5-ae7e-4138-9bbf-ce5ec0374d66'),
('60000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Follow-up Marcos', 'Marcos confirmou interesse em parceria para grupos de turismo. Enviar proposta ate sexta.', 'Lead', '40000001-0000-0000-0000-000000000005', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4'),
('60000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Negociacao hotel Praia Bela', 'Gustavo quer incluir servico de transfer no pacote. Verificar disponibilidade com operacional.', 'Lead', '40000001-0000-0000-0000-000000000007', '53bd16d5-ae7e-4138-9bbf-ce5ec0374d66'),
('60000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Evento Premium SP', 'Mariana precisa de espaco para 150 pessoas + 30 quartos. Data: 15 a 17 de marco.', 'Deal', '50000001-0000-0000-0000-000000000003', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4');

-- =============================================
-- 16. TASKS
-- =============================================
INSERT INTO tasks (id, tenant_id, title, description, priority, status, assigned_to_id, due_date, reference_doctype, reference_docname, created_by_id) VALUES
('70000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Enviar proposta comercial', 'Enviar proposta com valores atualizados para Pousada Mar Azul', 'High', 'Todo', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '2026-03-05', 'Deal', '50000001-0000-0000-0000-000000000001', '26523add-0ec0-4e13-b682-681ca35a41db'),
('70000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Ligar para Fernanda', 'Follow-up da visita ao Instagram. Verificar interesse em pacote familia.', 'Medium', 'Backlog', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '2026-03-03', 'Lead', '40000001-0000-0000-0000-000000000002', '26523add-0ec0-4e13-b682-681ca35a41db'),
('70000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Preparar contrato evento', 'Montar contrato para evento Mariana Costa - 150 pax + 30 quartos', 'High', 'In Progress', '53bd16d5-ae7e-4138-9bbf-ce5ec0374d66', '2026-03-08', 'Deal', '50000001-0000-0000-0000-000000000003', '40a7c913-0eb4-4463-9f5d-1b62c77a159f'),
('70000001-0000-0000-0000-000000000004', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Confirmar disponibilidade Ilhabela', 'Checar suites disponiveis para semana de 10 a 14 de marco', 'Low', 'Todo', '2df7ee91-4797-41bd-a0cb-7a2c93cfb62e', '2026-03-07', 'Deal', '50000001-0000-0000-0000-000000000004', '26523add-0ec0-4e13-b682-681ca35a41db'),
('70000001-0000-0000-0000-000000000005', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Atualizar precos site', 'Atualizar valores da alta temporada no site e no material de vendas', 'Medium', 'Done', '80bf6f47-e35c-4670-8108-944ab8482e5a', '2026-02-25', NULL, NULL, '26523add-0ec0-4e13-b682-681ca35a41db');

-- =============================================
-- 17. CALL LOGS
-- =============================================
INSERT INTO call_logs (id, tenant_id, caller, receiver, type, status, duration, note, reference_doctype, reference_docname) VALUES
('80000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Cassio Franco', 'Carlos Oliveira', 'Outgoing', 'Completed', 480, 'Discutiu valores do pacote 2026. Carlos quer desconto para 5+ noites.', 'Deal', '50000001-0000-0000-0000-000000000001'),
('80000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Ana Santos', 'Graziele Head Campos', 'Incoming', 'Completed', 1200, 'Ana ligou para confirmar datas do evento. Precisa resposta ate quarta.', 'Deal', '50000001-0000-0000-0000-000000000002'),
('80000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Cassio Franco', 'Marcos Silva', 'Outgoing', 'Missed', 0, NULL, 'Lead', '40000001-0000-0000-0000-000000000005');

-- =============================================
-- 18. COMMENTS
-- =============================================
INSERT INTO comments (id, tenant_id, content, reference_doctype, reference_docname, created_by_id) VALUES
('90000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Excelente lead! Vamos priorizar esse contato.', 'Lead', '40000001-0000-0000-0000-000000000001', '26523add-0ec0-4e13-b682-681ca35a41db'),
('90000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Proposta enviada por email. Aguardando retorno.', 'Deal', '50000001-0000-0000-0000-000000000001', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4'),
('90000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Cliente convertido com sucesso! Deal criado.', 'Lead', '40000001-0000-0000-0000-000000000009', '26523add-0ec0-4e13-b682-681ca35a41db');

-- =============================================
-- 19. ASSIGNMENTS
-- =============================================
INSERT INTO assignments (id, tenant_id, doctype, docname, assigned_to_id, assigned_by_id, status) VALUES
('a1000001-0000-0000-0000-000000000001', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Lead', '40000001-0000-0000-0000-000000000001', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '26523add-0ec0-4e13-b682-681ca35a41db', 'Open'),
('a1000001-0000-0000-0000-000000000002', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Deal', '50000001-0000-0000-0000-000000000001', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4', '26523add-0ec0-4e13-b682-681ca35a41db', 'Open'),
('a1000001-0000-0000-0000-000000000003', '916ca70a-0428-47f8-98a3-0f791e42f292', 'Deal', '50000001-0000-0000-0000-000000000002', '53bd16d5-ae7e-4138-9bbf-ce5ec0374d66', '40a7c913-0eb4-4463-9f5d-1b62c77a159f', 'Open');

-- =============================================
-- 20. STATUS CHANGE LOGS
-- =============================================
INSERT INTO status_change_logs (id, entity_type, entity_id, from_status, to_status, changed_by_id) VALUES
('b1000001-0000-0000-0000-000000000001', 'Lead', '40000001-0000-0000-0000-000000000009', 'Negociando', 'Convertido', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4'),
('b1000001-0000-0000-0000-000000000002', 'Deal', '50000001-0000-0000-0000-000000000005', 'Em Negociacao', 'Fechado (Ganho)', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4'),
('b1000001-0000-0000-0000-000000000003', 'Lead', '40000001-0000-0000-0000-000000000002', 'Novo', 'Contato Realizado', 'c296ee53-30fc-4f8a-acf6-a4d4116c00a4');

COMMIT;
