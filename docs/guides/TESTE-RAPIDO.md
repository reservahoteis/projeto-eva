# 🧪 Teste Rápido - Número de Teste Meta

## Credenciais de Teste

- **Test Number:** +1 555 XXX XXXX (obter no painel Meta)
- **Phone Number ID:** PHONE_NUMBER_ID (obter no painel Meta)
- **WABA ID:** WABA_ID (obter no painel Meta)
- **Access Token:** TOKEN_24H (gerar no painel Meta - expira em 24h)

## 1️⃣ Atualizar Banco (DBeaver)

```sql
UPDATE tenants
SET
  "whatsappPhoneNumberId" = 'SEU_PHONE_NUMBER_ID',
  "whatsappBusinessAccountId" = 'SEU_WABA_ID',
  "whatsappAccessToken" = 'SEU_ACCESS_TOKEN'
WHERE slug = 'hoteis-reserva';
```

## 2️⃣ Testar Envio de Mensagem (PowerShell/CMD)

```powershell
curl -X POST "https://graph.facebook.com/v21.0/SEU_PHONE_NUMBER_ID/messages" `
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"messaging_product":"whatsapp","to":"+15556398497","type":"text","text":{"body":"Teste do CRM"}}'
```

## 3️⃣ Testar Recebimento via Painel Meta

1. Acesse: https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business/wa-dev-console/

2. Na seção "Send and receive messages", clique em "Send message"

3. Digite qualquer mensagem e envie

4. A mensagem deve:
   - Chegar no webhook: https://api.botreserva.com.br/webhooks/whatsapp
   - Aparecer no banco de dados
   - Aparecer no Kanban do frontend

## 4️⃣ Verificar no Frontend

1. Acesse: https://www.botreserva.com.br/login

2. Login com suas credenciais de admin

3. Vá para "Conversas" e verifique se apareceu um card novo

## 5️⃣ Testar Socket.io (Tempo Real)

1. Deixe o frontend aberto na tela de conversas

2. Envie outra mensagem pelo painel da Meta

3. O card deve aparecer AUTOMATICAMENTE sem precisar recarregar a página

---

> ⚠️ **IMPORTANTE:** Nunca commite tokens ou senhas reais neste arquivo!
> Obtenha as credenciais diretamente do painel Meta Business.
