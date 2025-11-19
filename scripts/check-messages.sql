-- Verificar mensagens da conversa específica
-- Conversation ID: c220fbae-a594-4c03-994d-a116fa9a917d

-- 1. Verificar se a conversa existe
SELECT
  id,
  "tenantId",
  "contactId",
  status,
  "lastMessageAt",
  "createdAt"
FROM conversations
WHERE id = 'c220fbae-a594-4c03-994d-a116fa9a917d';

-- 2. Verificar mensagens da conversa
SELECT
  m.id,
  m."tenantId",
  m."conversationId",
  m.direction,
  m.type,
  m.content,
  m.status,
  m."sentById",
  m.timestamp,
  m."createdAt"
FROM messages m
WHERE m."conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d'
ORDER BY m.timestamp ASC;

-- 3. Contar total de mensagens
SELECT COUNT(*) as total_messages
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d';

-- 4. Verificar tenant da conversa
SELECT
  c.id as conversation_id,
  c."tenantId",
  t.name as tenant_name,
  t.slug as tenant_slug
FROM conversations c
JOIN tenants t ON c."tenantId" = t.id
WHERE c.id = 'c220fbae-a594-4c03-994d-a116fa9a917d';

-- 5. Debug: Verificar estrutura da tabela messages
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;