# 📱 Guia - Integração WhatsApp Business API (Meta)

**Última atualização:** 12/11/2025
**Status:** ✅ Backend pronto | ⏸️ Aguardando configuração Meta

---

## 🌐 Informações de Produção

**Backend API:** https://api.botreserva.com.br
**Webhook URL:** https://api.botreserva.com.br/webhooks/whatsapp
**SSL:** ✅ Let's Encrypt (HTTPS obrigatório)
**Status:** ✅ Online e operacional

---

## ✅ O que já foi configurado

### 1. **Credenciais no `.env`** (Produção)

Arquivo: `/root/deploy-backend/.env`

```env
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=[SERÁ_CONFIGURADO_POR_TENANT]
# Cada tenant terá suas próprias credenciais no banco de dados
```

**Nota:** No sistema multi-tenant, cada hotel (tenant) terá suas próprias credenciais WhatsApp armazenadas na tabela `tenants`:
- `whatsappPhoneNumberId`
- `whatsappAccessToken`
- `whatsappBusinessAccountId`
- `whatsappWebhookVerifyToken`
- `whatsappAppSecret`

### 2. **Serviço WhatsApp**

Arquivo: `apps/backend/src/services/whatsapp.service.ts`

**Funções disponíveis:**
- ✅ `sendTextMessage()` - Enviar mensagem de texto
- ✅ `sendMediaMessage()` - Enviar imagem/vídeo/documento
- ✅ `sendTemplate()` - Enviar template aprovado
- ✅ `sendInteractiveButtons()` - Enviar até 3 botões
- ✅ `sendInteractiveList()` - Enviar lista com até 10 opções
- ✅ `markAsRead()` - Marcar mensagem como lida
- ✅ `downloadMedia()` - Baixar mídia do WhatsApp

### 3. **Webhook Configurado**

Arquivo: `apps/backend/src/controllers/webhook.controller.ts`

**Endpoints:**
- `GET /api/webhooks/whatsapp` - Verificação (Meta)
- `POST /api/webhooks/whatsapp` - Receber mensagens

**O webhook já processa:**
- ✅ Mensagens de texto
- ✅ Imagens, vídeos, áudios, documentos
- ✅ Localização
- ✅ Status de mensagens (enviado, entregue, lido)
- ✅ Validação de assinatura (segurança)

---

## 🧪 Como Testar

### **Passo 1: Adicionar Número de Teste na Meta**

1. Acesse: https://developers.facebook.com/apps/2334635496966303/whatsapp-business/wa-dev-console
2. Vá em **"Números de telefone"**
3. Clique em **"Gerenciar números de telefone"**
4. Clique em **"Adicionar número de telefone"**
5. Digite seu número: `+55 11 99999-9999`
6. Você receberá um código via SMS
7. Digite o código para verificar

⚠️ **Pode adicionar até 5 números para teste!**

---

### **Passo 2: Executar os Testes**

#### 🔹 Teste 1: Mensagem Simples

```bash
cd apps/backend
npx tsx test-whatsapp.ts 5511999999999
```

Substitua pelo seu número!

#### 🔹 Teste 2: Botões Interativos

```bash
npx tsx test-whatsapp-buttons.ts 5511999999999
```

Você verá 3 botões no WhatsApp:
- Ver Quartos
- Fazer Reserva
- Falar com Humano

#### 🔹 Teste 3: Lista de Opções

```bash
npx tsx test-whatsapp-list.ts 5511999999999
```

Você verá uma lista com quartos de Campos do Jordão e Ilhabela.

---

## 🔗 Configurar Webhook na Meta (PRODUÇÃO)

### ✅ **Configuração de Produção** (Recomendado)

Agora que o backend está em produção com HTTPS, use a URL definitiva:

**URL do Webhook:** `https://api.botreserva.com.br/webhooks/whatsapp`

#### Passo a Passo:

1. **Acesse o Meta for Developers:**
   - URL: https://developers.facebook.com/apps/
   - Crie um novo app ou use um existente
   - Adicione o produto "WhatsApp Business API"

2. **Configure o Webhook:**
   - Vá em **WhatsApp** → **Configuration**
   - Clique em **"Edit"** na seção Webhook
   - **Callback URL**: `https://api.botreserva.com.br/webhooks/whatsapp`
   - **Verify Token**: Você define (ex: `meu_token_seguro_2025`)
   - Clique em **"Verify and Save"**

3. **Configure o Verify Token no Tenant:**
   ```bash
   # Via API (use o token do Super Admin)
   curl -X PATCH "https://api.botreserva.com.br/api/tenants/[TENANT_ID]" \
     -H "Authorization: Bearer [SUPER_ADMIN_TOKEN]" \
     -H "Content-Type: application/json" \
     -d '{
       "whatsappWebhookVerifyToken": "meu_token_seguro_2025",
       "whatsappPhoneNumberId": "[SEU_PHONE_NUMBER_ID]",
       "whatsappAccessToken": "[SEU_ACCESS_TOKEN]",
       "whatsappBusinessAccountId": "[SEU_WABA_ID]"
     }'
   ```

4. **Subscreva aos Eventos:**
   - Ainda nas configurações do Webhook
   - Marque as opções:
     - ✅ `messages` (mensagens recebidas)
     - ✅ `message_status` (status de entrega)
     - ✅ `message_template_status_update` (templates)
   - Clique em **"Save"**

5. **Teste o Webhook:**
   ```bash
   # A Meta enviará uma requisição GET para validar
   # O backend deve responder com o challenge
   # Se configurado corretamente, você verá: ✅ Webhook verified
   ```

---

### 🧪 **Opção Alternativa: Desenvolvimento Local (com ngrok)**

Se quiser testar localmente antes de usar produção:

1. **Instale o ngrok:**
```bash
npm install -g ngrok
```

2. **Inicie o backend localmente:**
```bash
cd deploy-backend
npm run dev
```

3. **Em outro terminal, inicie o ngrok:**
```bash
ngrok http 3001
```

4. **Use a URL ngrok:**
```
https://abc123.ngrok-free.app/webhooks/whatsapp
```

⚠️ **Lembre-se:** URLs ngrok mudam a cada execução. Use produção para algo definitivo.
   - **Token de verificação**: `smart_hoteis_webhook_2024_secure_token`
   - Clique em **"Verificar e salvar"**

6. **Assine os eventos:**
   - Marque: `messages`
   - Marque: `message_status`
   - Clique em **"Salvar"**

### **Opção B: Servidor em Produção**

Se você já tem o backend rodando em um servidor:

1. **URL de callback**: `https://seu-dominio.com/api/webhooks/whatsapp`
2. **Token**: `smart_hoteis_webhook_2024_secure_token`

---

## 📊 Estrutura Multi-Tenant

O sistema suporta **múltiplos hotéis** (tenants). Cada tenant tem suas próprias credenciais:

```typescript
// Banco de dados (Prisma)
model Tenant {
  whatsappPhoneNumberId    String?
  whatsappAccessToken      String?
  whatsappAppSecret        String?
  whatsappWebhookVerifyToken String?
}
```

Para adicionar um novo hotel:
1. Criar tenant no banco
2. Adicionar as credenciais do WhatsApp
3. Cada hotel terá sua própria fila de atendimento

---

---

## 🧪 Testar Fluxo Completo

### Teste 1: Enviar Mensagem (API → WhatsApp)

```bash
# 1. Login como tenant admin
TOKEN=$(curl -k -X POST "https://api.botreserva.com.br/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{"email":"contato@hotelipanema.com.br","password":"[SENHA]"}' \
  | jq -r '.accessToken')

# 2. Enviar mensagem de teste
curl -k -X POST "https://api.botreserva.com.br/api/messages/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999",
    "type": "text",
    "content": "Olá! Esta é uma mensagem de teste do Hotel Ipanema."
  }'
```

### Teste 2: Receber Mensagem (WhatsApp → API)

1. Envie uma mensagem do WhatsApp para o número configurado
2. Verifique os logs do backend:
```bash
ssh root@72.61.39.235
cd /root/deploy-backend
docker compose -f docker-compose.production.yml logs -f backend | grep -i webhook
```

3. Verifique se a mensagem foi salva no banco:
```bash
docker compose -f docker-compose.production.yml exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.message.findMany({
  where: { direction: 'INBOUND' },
  orderBy: { timestamp: 'desc' },
  take: 5,
  include: { contact: true }
}).then(msgs => {
  console.log(JSON.stringify(msgs, null, 2));
  prisma.\$disconnect();
});
"
```

---

## 🎯 Próximos Passos

### ✅ **Passo 1: Criar App Meta for Developers**
1. Acesse https://developers.facebook.com/apps/
2. Crie novo aplicativo → WhatsApp Business
3. Anote: `App ID`, `App Secret`

### ✅ **Passo 2: Configurar Webhook**
1. WhatsApp → Configuration → Webhook
2. URL: `https://api.botreserva.com.br/webhooks/whatsapp`
3. Verify Token: `[seu_token_aqui]`
4. Subscrever: `messages`, `message_status`

### ✅ **Passo 3: Obter Credenciais**
1. Anote o `Phone Number ID`
2. Gere um `Access Token` (System User Token para produção)
3. Anote o `WhatsApp Business Account ID`

### ✅ **Passo 4: Configurar Tenant**
Use o endpoint PATCH `/api/tenants/:id` (como Super Admin) para adicionar as credenciais WhatsApp ao tenant.

### ✅ **Passo 5: Testar Envio e Recebimento**
Execute os testes acima para validar a integração completa.

---

## 📚 Documentação Meta

- **Graph API**: https://developers.facebook.com/docs/whatsapp/cloud-api
- **Interactive Messages**: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages
- **Webhooks**: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
- **Painel do App**: https://developers.facebook.com/apps/2334635496966303

---

## 🐛 Troubleshooting

### Erro 131026
```
Message failed to send because more than 24 hours have passed
```
**Solução**: Cliente precisa enviar mensagem primeiro OU você precisa usar um Template aprovado.

### Erro 131031
```
User's phone number not in allowed list
```
**Solução**: Adicionar número na lista de números de teste.

### Erro 100
```
Invalid OAuth access token
```
**Solução**: Token expirado. Gerar novo token temporário ou criar token permanente.

---

## 🎉 Pronto!

Agora você tem toda a infraestrutura para usar a API oficial do WhatsApp da Meta!

**Perguntas?** Só me chamar! 😊
