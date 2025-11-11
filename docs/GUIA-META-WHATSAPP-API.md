# 📱 Guia - Integração WhatsApp Business API (Meta)

## ✅ O que já foi configurado

### 1. **Credenciais no `.env`**

Arquivo: `apps/backend/.env`

```env
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=smart_hoteis_webhook_2024_secure_token
WHATSAPP_TEST_PHONE_NUMBER_ID=796628440207853
WHATSAPP_TEST_ACCESS_TOKEN=EAAhLVq96CJ8...
WHATSAPP_APP_ID=2334635496966303
WHATSAPP_WABA_ID=1350650163185836
```

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

## 🔗 Configurar Webhook na Meta

Para receber mensagens, você precisa configurar o webhook:

### **Opção A: Desenvolvimento Local (com ngrok)**

1. **Instale o ngrok:**
```bash
npm install -g ngrok
```

2. **Inicie o backend:**
```bash
cd apps/backend
npm run dev
```

3. **Em outro terminal, inicie o ngrok:**
```bash
ngrok http 3001
```

4. **Copie a URL pública:**
```
https://abc123.ngrok.io
```

5. **Configure na Meta:**
   - Acesse: https://developers.facebook.com/apps/2334635496966303/whatsapp-business/wa-settings
   - Clique em **"Configurar"** no Webhook
   - **URL de callback**: `https://abc123.ngrok.io/api/webhooks/whatsapp`
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

## 🎯 Próximos Passos

### 1. ✅ **Testar Envio de Mensagens**
Execute os 3 scripts de teste e veja se as mensagens chegam.

### 2. 🔧 **Configurar Webhook**
Configure o webhook para receber mensagens dos clientes.

### 3. 🔄 **Migrar Workflows do N8N**
Os workflows atuais usam Z-API. Precisam ser adaptados para:
- Usar `whatsAppService.sendTextMessage()` ao invés de Z-API
- Usar `sendInteractiveList()` para carrosseis
- Usar `sendInteractiveButtons()` para menus

### 4. 📱 **Adicionar Número Real**
Quando tudo estiver funcionando:
- Adicionar o número real do hotel
- Gerar token permanente
- Migrar do número de teste para produção

### 5. 🚀 **Deploy**
Colocar o backend em produção com webhook público.

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
