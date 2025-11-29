# 🧪 Teste Rápido - Número de Teste Meta

## Credenciais de Teste
- **Test Number:** +1 555 639 8497
- **Phone Number ID:** 796628440207853
- **WABA ID:** 1350650163185836
- **Access Token:** EAAhLVq96CJ8BP38... (24h)

## 1️⃣ Atualizar Banco (DBeaver)

```sql
UPDATE tenants
SET
  "whatsappPhoneNumberId" = '796628440207853',
  "whatsappBusinessAccountId" = '1350650163185836',
  "whatsappAccessToken" = 'EAAhLVq96CJ8BP38MrFZCNyrHhSjOTuZC3RmVtOr9jZC4FtA879NJHWLoqnTcpXHmycTSLyZCzUzZAatLBnblKOqQoaOZBhnPpdbe5JO0ST1TZANxr5mcqZCE2odZBZCEGN7CKXhiUjZC0k2xysMES0y1ilLQTgpAb8P1txjAddL53SQIPIfrm0IAXumEGZBaIwpWCUH8ZCApD5y8UWNTIZBvBNLkLZBnvdt10rXWC3BUuznfUXV8eOiYcRPGfRgF5ctnobRngZDZD'
WHERE slug = 'hoteis-reserva';
```

## 2️⃣ Testar Envio de Mensagem (PowerShell/CMD)

```powershell
curl -X POST "https://graph.facebook.com/v21.0/796628440207853/messages" `
  -H "Authorization: Bearer EAAhLVq96CJ8BP38MrFZCNyrHhSjOTuZC3RmVtOr9jZC4FtA879NJHWLoqnTcpXHmycTSLyZCzUzZAatLBnblKOqQoaOZBhnPpdbe5JO0ST1TZANxr5mcqZCE2odZBZCEGN7CKXhiUjZC0k2xysMES0y1ilLQTgpAb8P1txjAddL53SQIPIfrm0IAXumEGZBaIwpWCUH8ZCApD5y8UWNTIZBvBNLkLZBnvdt10rXWC3BUuznfUXV8eOiYcRPGfRgF5ctnobRngZDZD" `
  -H "Content-Type: application/json" `
  -d '{\"messaging_product\":\"whatsapp\",\"to\":\"+15556398497\",\"type\":\"text\",\"text\":{\"body\":\"Teste do CRM\"}}'
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

2. Login:
   - Email: admin@hoteisreserva.com.br
   - Senha: Admin@123

3. Vá para "Conversas" e verifique se apareceu um card novo

## 5️⃣ Testar Socket.io (Tempo Real)

1. Deixe o frontend aberto na tela de conversas

2. Envie outra mensagem pelo painel da Meta

3. O card deve aparecer AUTOMATICAMENTE sem precisar recarregar a página

---

**Me avise em qual passo você está e o que aconteceu!** 👀
