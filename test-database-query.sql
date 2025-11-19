-- ===========================================
-- TESTE DE MENSAGENS NO BANCO DE DADOS
-- ===========================================

-- 1. VERIFICAR SE A CONVERSA EXISTE
SELECT
    id,
    "tenantId",
    "contactId",
    status,
    "assignedToId",
    "lastMessageAt",
    "createdAt"
FROM conversations
WHERE id = 'c220fbae-a594-4c03-994d-a116fa9a917d';

-- 2. BUSCAR CONTATO DA CONVERSA
SELECT
    c.id as contact_id,
    c.name,
    c."phoneNumber",
    c."tenantId"
FROM conversations conv
JOIN contacts c ON conv."contactId" = c.id
WHERE conv.id = 'c220fbae-a594-4c03-994d-a116fa9a917d';

-- 3. CONTAR MENSAGENS DA CONVERSA
SELECT COUNT(*) as total_messages
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d';

-- 4. LISTAR TODAS AS MENSAGENS DA CONVERSA
SELECT
    id,
    "tenantId",
    "conversationId",
    "whatsappMessageId",
    direction,
    type,
    status,
    content,
    metadata,
    "sentById",
    timestamp,
    "createdAt"
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d'
ORDER BY timestamp DESC;

-- 5. VERIFICAR SE HÁ PROBLEMAS COM TENANT_ID
SELECT
    m.id,
    m."tenantId" as message_tenant,
    c."tenantId" as conversation_tenant,
    m.content,
    m.direction,
    m.timestamp
FROM messages m
JOIN conversations c ON m."conversationId" = c.id
WHERE m."conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d';

-- 6. BUSCAR MENSAGENS COM QUERY EXATA DO BACKEND (SEM tenantId no WHERE)
SELECT
    id,
    "tenantId",
    "conversationId",
    "whatsappMessageId",
    direction,
    type,
    content,
    metadata,
    status,
    "sentById",
    timestamp,
    "createdAt"
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d'
ORDER BY timestamp DESC
LIMIT 50;

-- 7. ANÁLISE: VERIFICAR SE TODAS AS MENSAGENS TÊM O MESMO TENANT_ID
SELECT
    "tenantId",
    COUNT(*) as count
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d'
GROUP BY "tenantId";

-- 8. DEBUG: VER ESTRUTURA COMPLETA DE UMA MENSAGEM
SELECT *
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d'
LIMIT 1;