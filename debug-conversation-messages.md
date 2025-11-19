# Debug - Mensagens não aparecem na conversa

## Informações:
- **URL Frontend:** https://www.botreserva.com.br/dashboard/conversations/c220fbae-a594-4c03-994d-a116fa9a917d
- **Conversation ID:** c220fbae-a594-4c03-994d-a116fa9a917d
- **Problema:** Mensagens não aparecem ao abrir conversa individual

## Testes para executar:

### 1. Verificar se a conversa existe no banco:
```sql
SELECT
  id,
  "contactId",
  status,
  "lastMessageAt",
  "createdAt",
  "tenantId"
FROM conversations
WHERE id = 'c220fbae-a594-4c03-994d-a116fa9a917d';
```

### 2. Verificar mensagens dessa conversa:
```sql
SELECT
  id,
  "conversationId",
  content,
  "from",
  type,
  direction,
  "createdAt"
FROM messages
WHERE "conversationId" = 'c220fbae-a594-4c03-994d-a116fa9a917d'
ORDER BY "createdAt" ASC;
```

### 3. Testar rota diretamente via curl:
```bash
# Pegar seu token do localStorage no navegador (F12 > Console):
# localStorage.getItem('accessToken')

curl -X GET "https://api.botreserva.com.br/api/conversations/c220fbae-a594-4c03-994d-a116fa9a917d/messages" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-tenant-slug: hoteis-reserva" \
  -H "Content-Type: application/json"
```

### 4. Verificar console do navegador:
- Abra F12
- Vá na aba "Network"
- Filtre por "messages"
- Abra a conversa
- Veja a requisição que foi feita
- Me passa: Status Code, Response, Request Headers

## Execute esses testes e me passa os resultados!
