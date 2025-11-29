# 🔍 Debug - Mensagem Não Apareceu

## Checklist de Verificação

### 1. Webhook está configurado no Meta?
- [ ] URL webhook configurada: https://api.botreserva.com.br/webhooks/whatsapp
- [ ] Verify token correto
- [ ] Subscribed fields: messages, message_status

### 2. Você enviou como?
- [ ] Via painel Meta "Send message"
- [ ] Via curl/API
- [ ] Para qual número enviou?

### 3. Verificar no DBeaver

Execute estas queries para ver se a mensagem chegou:

```sql
-- Ver últimas mensagens
SELECT
  id,
  "whatsappMessageId",
  content,
  "from",
  type,
  "createdAt"
FROM messages
WHERE "tenantId" = (SELECT id FROM tenants WHERE slug = 'hoteis-reserva')
ORDER BY "createdAt" DESC
LIMIT 10;

-- Ver conversações
SELECT
  id,
  "contactId",
  status,
  "lastMessageAt",
  "createdAt"
FROM conversations
WHERE "tenantId" = (SELECT id FROM tenants WHERE slug = 'hoteis-reserva')
ORDER BY "createdAt" DESC
LIMIT 10;

-- Ver contatos
SELECT
  id,
  name,
  phone,
  "createdAt"
FROM contacts
WHERE "tenantId" = (SELECT id FROM tenants WHERE slug = 'hoteis-reserva')
ORDER BY "createdAt" DESC
LIMIT 10;

-- Ver eventos de webhook
SELECT
  id,
  source,
  event,
  payload,
  processed,
  error,
  "createdAt"
FROM "webhookEvent"
WHERE "tenantId" = (SELECT id FROM tenants WHERE slug = 'hoteis-reserva')
ORDER BY "createdAt" DESC
LIMIT 10;
```

### 4. Verificar logs do backend

Se você tiver acesso SSH, rode:
```bash
ssh root@72.61.39.235 "docker logs crm-backend --tail 100 | grep -i 'webhook\|message'"
```

## Possíveis Causas

1. **Webhook não configurado no Meta**
   - Solução: Configurar webhook no painel Meta

2. **Mensagem enviada para número errado**
   - Número de teste: +1 555 639 8497
   - Precisa enviar PARA o CRM, não DO CRM

3. **Frontend não está carregando conversações**
   - Abrir console (F12) e ver erros
   - Ver se a API `/api/conversations` está respondendo

4. **Socket.io não conectado**
   - Ver no console se há conexão WebSocket

## Me passa:

1. Você configurou o webhook no Meta? (Sim/Não)
2. Como você enviou a mensagem?
3. Execute as queries SQL acima e me passa os resultados
4. Tem algum erro no console do navegador (F12)?
