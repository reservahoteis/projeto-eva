# 📱 WhatsApp Webhook - Guia Completo

**Versão:** 2.0.0
**Data:** 12/11/2025
**Status:** ✅ Production-Ready
**API Version:** WhatsApp Cloud API v21.0

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Fluxo de Processamento](#fluxo-de-processamento)
4. [Configuração](#configuração)
5. [Endpoints](#endpoints)
6. [Tipos de Eventos](#tipos-de-eventos)
7. [Filas e Workers](#filas-e-workers)
8. [Segurança](#segurança)
9. [Error Handling](#error-handling)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## 🎯 Visão Geral

Sistema completo de webhook para integração com WhatsApp Business Cloud API (v21.0), implementado com:

- ✅ **Validação rigorosa** (Zod schemas)
- ✅ **Processamento assíncrono** (Bull queues + Redis)
- ✅ **Segurança HMAC** (SHA256 signature validation)
- ✅ **Response rápido** (< 5 segundos para Meta)
- ✅ **Retry logic** (exponential backoff)
- ✅ **Type-safe** (TypeScript strict mode)
- ✅ **Production-ready** (error handling, logging, monitoring)

---

## 🏗️ Arquitetura

```
WhatsApp Cloud API (Meta)
    ↓
  HTTPS POST (porta 443)
    ↓
Nginx (SSL Termination)
    ↓
Backend - Webhook Controller V2
    ├─ Validate Signature (HMAC SHA256)
    ├─ Validate Payload (Zod)
    ├─ Log Event (async)
    ├─ Enqueue to Bull
    └─ Return 200 OK (< 5s)
    ↓
Redis (Bull Queues)
    ├─ whatsapp:incoming:message (priority: high)
    ├─ whatsapp:status:update (priority: medium)
    ├─ whatsapp:outgoing:message (priority: high, rate limited)
    └─ whatsapp:media:download (priority: low)
    ↓
Workers (background processing)
    ├─ Process Incoming Message
    │   ├─ Find/Create Contact
    │   ├─ Find/Create Conversation
    │   ├─ Save Message
    │   └─ Enqueue Media Download
    ├─ Process Status Update
    │   ├─ Find Message
    │   ├─ Update Status
    │   └─ Update Conversation
    ├─ Process Outgoing Message
    │   ├─ Send via WhatsApp API
    │   ├─ Update Message
    │   └─ Handle Errors
    └─ Process Media Download
        ├─ Download from WhatsApp
        ├─ Save to Disk/S3
        └─ Update Message Metadata
    ↓
PostgreSQL (data persistence)
```

---

## 🔄 Fluxo de Processamento

### 1. Webhook Verification (GET)

```
Meta → GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
     ↓
Controller:
  1. Validate query params (Zod)
  2. Find tenant by slug
  3. Validate verify token
  4. Return challenge (unchanged)
     ↓
Meta ← 200 OK + challenge
```

### 2. Incoming Message (POST)

```
Meta → POST /webhooks/whatsapp
     Headers: X-Hub-Signature-256, X-Tenant-Slug
     Body: { object: 'whatsapp_business_account', entry: [...] }
     ↓
Controller (< 5s):
  1. Validate signature (HMAC SHA256)
  2. Validate payload (Zod)
  3. Log event (async, non-blocking)
  4. Enqueue to Bull (non-blocking)
  5. Return 200 OK
     ↓
Meta ← 200 OK 'EVENT_RECEIVED'
     ↓
Redis Queue → Worker (background)
     ↓
Worker:
  1. Find/Create Contact
  2. Find/Create Conversation
  3. Extract message data
  4. Save message to DB
  5. Update conversation.lastMessageAt
  6. Enqueue media download (if applicable)
     ↓
PostgreSQL (data persisted)
```

### 3. Status Update (POST)

```
Meta → POST /webhooks/whatsapp (status: delivered/read/failed)
     ↓
Controller (< 5s):
  [same validation as incoming message]
  Enqueue to status update queue
     ↓
Meta ← 200 OK
     ↓
Worker:
  1. Find message by whatsappMessageId
  2. Validate status transition
  3. Update message status
  4. Log errors (if status = failed)
  5. Update conversation (if status = read)
     ↓
PostgreSQL (status updated)
```

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

```env
# .env.production

# WhatsApp API
WHATSAPP_API_VERSION=v21.0

# Redis (para filas Bull)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Tenant Configuration (por tenant no DB)
# - whatsappPhoneNumberId
# - whatsappAccessToken
# - whatsappBusinessAccountId
# - whatsappWebhookVerifyToken
# - whatsappAppSecret
```

### 2. Configurar Webhook no Meta

#### a) Obter Credenciais

1. Acesse [Meta for Developers](https://developers.facebook.com/)
2. Crie App WhatsApp Business
3. Anote:
   - **Phone Number ID** (`whatsappPhoneNumberId`)
   - **Access Token** (`whatsappAccessToken`)
   - **Business Account ID** (`whatsappBusinessAccountId`)
   - **App Secret** (`whatsappAppSecret`)

#### b) Configurar Tenant no DB

```sql
UPDATE tenants SET
  "whatsappPhoneNumberId" = '123456789',
  "whatsappAccessToken" = 'EAAxxxxxxxxxxxxx',
  "whatsappBusinessAccountId" = '987654321',
  "whatsappWebhookVerifyToken" = 'my-secret-verify-token-12345',
  "whatsappAppSecret" = 'abc123def456'
WHERE slug = 'meu-hotel';
```

#### c) Registrar Webhook na Meta

1. Acesse WhatsApp > Configuration > Webhook
2. **Callback URL:** `https://api.seudominio.com/webhooks/whatsapp?tenant=meu-hotel`
3. **Verify Token:** `my-secret-verify-token-12345` (mesmo do DB)
4. **Webhook Fields:** Selecione:
   - ✅ `messages`
   - ✅ `message_status`

5. Clique em "Verify and Save"

Meta vai fazer GET request para validar:
```
GET https://api.seudominio.com/webhooks/whatsapp?tenant=meu-hotel&hub.mode=subscribe&hub.verify_token=my-secret-verify-token-12345&hub.challenge=CHALLENGE_STRING
```

Se validação passar, webhook estará ativo! ✅

### 3. Inicializar Workers

No `server.ts`:

```typescript
import { registerWorkers } from '@/queues/workers';

// Após inicializar Express
registerWorkers();

logger.info('Queue workers registered');
```

---

## 📡 Endpoints

### GET /webhooks/whatsapp

**Verificação do webhook (Meta)**

**Query Params:**
- `hub.mode`: `'subscribe'` (obrigatório)
- `hub.verify_token`: Verify token configurado (obrigatório)
- `hub.challenge`: String aleatória (obrigatório)
- `tenant`: Slug do tenant (opcional, preferir header)

**Headers:**
- `X-Tenant-Slug`: Slug do tenant (recomendado)

**Response:**
- `200 OK` + challenge (se válido)
- `403 Forbidden` (se inválido)

**Exemplo:**
```bash
curl "https://api.seudominio.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=my-token&hub.challenge=abc123" \
  -H "X-Tenant-Slug: meu-hotel"

# Response: abc123
```

---

### POST /webhooks/whatsapp

**Receber eventos do WhatsApp**

**Headers:**
- `X-Hub-Signature-256`: Assinatura HMAC SHA256 (obrigatório)
- `X-Tenant-Slug`: Slug do tenant (recomendado)
- `Content-Type`: `application/json`

**Body:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5511999999999",
              "phone_number_id": "123456789"
            },
            "contacts": [
              {
                "profile": {
                  "name": "João Silva"
                },
                "wa_id": "5511888888888"
              }
            ],
            "messages": [
              {
                "from": "5511888888888",
                "id": "wamid.xxxxx",
                "timestamp": "1699999999",
                "type": "text",
                "text": {
                  "body": "Olá, gostaria de fazer uma reserva"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Response:**
- `200 OK` + `'EVENT_RECEIVED'` (sempre)

**IMPORTANTE:**
- Sempre retorna 200, mesmo com erro (para não bloquear webhook)
- Processamento é assíncrono (via filas)

---

## 📨 Tipos de Eventos

### 1. Messages (mensagens recebidas)

```json
{
  "field": "messages",
  "value": {
    "messages": [
      {
        "from": "5511888888888",
        "id": "wamid.xxxxx",
        "timestamp": "1699999999",
        "type": "text|image|video|audio|document|location|contacts|button|interactive",
        "text": { "body": "..." },           // se type = text
        "image": { "id": "...", ... },      // se type = image
        "button": { "button_reply": {...} }, // se type = button
        // ... outros tipos
      }
    ],
    "contacts": [{ "profile": { "name": "..." } }]
  }
}
```

**Tipos Suportados:**
- ✅ `text` - Mensagem de texto
- ✅ `image` - Imagem
- ✅ `video` - Vídeo
- ✅ `audio` - Áudio/nota de voz
- ✅ `document` - Documento (PDF, DOCX, etc)
- ✅ `location` - Localização
- ✅ `contacts` - Contato compartilhado
- ✅ `sticker` - Sticker/figurinha
- ✅ `button` - Resposta de botão
- ✅ `interactive` - Resposta de lista

**Processamento:**
1. Enfileirado em `whatsapp:incoming:message` (prioridade alta)
2. Worker cria/atualiza Contact
3. Worker cria/reabre Conversation
4. Worker salva Message
5. Se mídia, enfileira download

---

### 2. Message Status (status de mensagens)

```json
{
  "field": "message_status",
  "value": {
    "statuses": [
      {
        "id": "wamid.xxxxx",
        "status": "sent|delivered|read|failed",
        "timestamp": "1699999999",
        "recipient_id": "5511888888888",
        "errors": [...]  // se status = failed
      }
    ]
  }
}
```

**Status:**
- `sent` - Mensagem enviada para servidor WhatsApp
- `delivered` - Entregue no dispositivo do cliente
- `read` - Lida pelo cliente
- `failed` - Falha no envio

**Processamento:**
1. Enfileirado em `whatsapp:status:update` (prioridade média)
2. Worker encontra Message por `whatsappMessageId`
3. Worker atualiza status
4. Se `failed`, loga erro detalhado
5. Se `read`, pode mudar Conversation para `WAITING`

---

### 3. Account Update (não implementado)

Eventos de atualização de conta WhatsApp Business.

---

### 4. Account Alerts (não implementado)

Alertas sobre a conta (limite de mensagens, etc).

---

### 5. Message Template Status Update (não implementado)

Status de templates de mensagem (aprovado, rejeitado, etc).

---

## 🔄 Filas e Workers

### Filas Bull

| Fila | Prioridade | Concorrência | Rate Limit | Retry | Uso |
|------|-----------|--------------|------------|-------|-----|
| `whatsapp:incoming:message` | Alta (1) | 5 jobs | - | 3x (2s, 4s, 8s) | Processar mensagens recebidas |
| `whatsapp:status:update` | Média (3) | 10 jobs | - | 3x (2s, 4s, 8s) | Atualizar status de mensagens |
| `whatsapp:outgoing:message` | Alta (1) | 3 jobs | 80 msg/s | 3x (2s, 4s, 8s) | Enviar mensagens |
| `whatsapp:media:download` | Baixa (5) | 2 jobs | - | 5x (5s, 10s, 20s, 40s, 80s) | Baixar mídias |

### Workers

#### 1. Process Incoming Message

**Arquivo:** `queues/workers/process-incoming-message.worker.ts`

**Responsabilidades:**
1. Find or create Contact (atualiza nome se mudou)
2. Find or create Conversation (reabre se fechada)
3. Extract message data (baseado no tipo)
4. Save Message no DB
5. Update Conversation.lastMessageAt
6. Enqueue media download (se aplicável)

**Type Guards:**
- `isTextMessage()`
- `isImageMessage()`
- `isVideoMessage()`
- `isAudioMessage()`
- `isDocumentMessage()`
- `isLocationMessage()`
- `isButtonReply()`
- `isListReply()`

---

#### 2. Process Status Update

**Arquivo:** `queues/workers/process-status-update.worker.ts`

**Responsabilidades:**
1. Find Message by `whatsappMessageId`
2. Validate tenant (segurança)
3. Validate status transition
4. Update message status
5. Log errors (se status = failed)
6. Update conversation (se status = read)

**Status Transition:**
```
SENT → DELIVERED → READ
  ↓
FAILED (de qualquer status)
```

---

#### 3. Process Outgoing Message

**Arquivo:** `queues/workers/process-outgoing-message.worker.ts`

**Responsabilidades:**
1. Validate message exists
2. Send via WhatsApp Service
3. Update message with `whatsappMessageId`
4. Update conversation status to `IN_PROGRESS`
5. Handle errors (mark as FAILED)

**Supported Types:**
- `text`
- `image`, `video`, `audio`, `document`
- `template`

---

#### 4. Process Media Download

**Arquivo:** `queues/workers/process-media-download.worker.ts`

**Responsabilidades:**
1. Download media from WhatsApp
2. Save to disk (ou S3/Cloudinary)
3. Update message metadata with local path

**Storage:**
- **Local:** `uploads/media/{tenantId}/{mediaId}_{timestamp}.ext`
- **Cloud:** S3/Cloudinary (opcional, código comentado)

---

## 🔒 Segurança

### 1. HMAC Signature Validation

**Como funciona:**

```typescript
// Meta calcula:
const signature = 'sha256=' + HMAC_SHA256(payload, app_secret);

// Enviado no header:
'X-Hub-Signature-256': signature

// Validamos:
const expected = 'sha256=' + HMAC_SHA256(req.body, tenant.whatsappAppSecret);
if (expected === signature) {
  // Valid!
}
```

**Timing-Safe Comparison:**
```typescript
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```

**IMPORTANTE:**
- NUNCA desabilitar validação de signature
- NUNCA expor `whatsappAppSecret`
- SEMPRE usar timing-safe comparison

---

### 2. Rate Limiting

**Webhook Endpoint:**
- Max 1000 requests / minuto / IP

**Outgoing Queue:**
- Max 80 mensagens / segundo (limite da Meta)

---

### 3. Tenant Isolation

**Multi-Tenancy:**
- Cada tenant tem suas credenciais
- Validação de `tenantId` em todos os workers
- Queries sempre filtradas por `tenantId`

**Security Check:**
```typescript
if (message.tenantId !== tenantId) {
  logger.error('Tenant mismatch - possible security issue!');
  return;
}
```

---

## ⚠️ Error Handling

### 1. Controller Level

```typescript
try {
  // Process webhook
} catch (error) {
  logger.error({ error }, 'Error processing webhook');
  // SEMPRE retornar 200 (não bloquear webhook)
  res.status(200).send('EVENT_RECEIVED');
}
```

**Por quê sempre 200?**
- Meta marca webhook como "failed" após 3 erros consecutivos
- Webhook pode ser desativado automaticamente
- Processamento real é assíncrono (via filas)

---

### 2. Worker Level

```typescript
try {
  // Process job
} catch (error) {
  logger.error({ error }, 'Worker error');
  throw error; // Re-throw para Bull retry
}
```

**Retry Logic:**
- 3 tentativas com exponential backoff
- Job vai para "failed" após 3 tentativas
- Logs estruturados para debug

---

### 3. WhatsApp API Errors

**Error Codes Comuns:**
- `131031` - Recipient cannot be sender
- `131026` - Message undeliverable (número bloqueou)
- `131047` - Re-engagement message (24h window expirado)
- `131051` - Unsupported message type
- `133015` - Template does not exist

**Handling:**
```typescript
if (error.response?.data?.error?.code === 131026) {
  // Cliente bloqueou - não tentar novamente
  await markConversationAsBlocked(conversationId);
}
```

---

## 📊 Monitoring

### 1. Logs Estruturados

**Pino Logger:**
```typescript
logger.info({
  tenantId,
  messageId,
  whatsappMessageId,
  duration,
}, 'Message processed successfully');
```

**Levels:**
- `error` - Erros críticos
- `warn` - Avisos (ex: status transition inválido)
- `info` - Eventos importantes
- `debug` - Detalhes de processamento

---

### 2. Queue Metrics

**Health Endpoint:**
```typescript
import { getQueuesHealth } from '@/queues/whatsapp-webhook.queue';

router.get('/health/queues', async (req, res) => {
  const health = await getQueuesHealth();
  res.json(health);
});
```

**Response:**
```json
[
  {
    "name": "whatsapp:incoming:message",
    "counts": {
      "waiting": 0,
      "active": 2,
      "completed": 1543,
      "failed": 12,
      "delayed": 0
    },
    "isPaused": false
  },
  ...
]
```

---

### 3. Webhook Event Logs

**Tabela:** `webhook_events`

```sql
SELECT *
FROM webhook_events
WHERE "tenantId" = 'xxx'
  AND processed = false
ORDER BY "createdAt" DESC
LIMIT 50;
```

**Útil para:**
- Debug de problemas
- Replay de eventos
- Auditoria

---

## 🔧 Troubleshooting

### Problema 1: Webhook não verifica

**Sintomas:**
- Meta retorna "Verification failed"

**Causas:**
1. `whatsappWebhookVerifyToken` incorreto no DB
2. Tenant slug incorreto
3. URL incorreta

**Solução:**
```bash
# 1. Verificar token no DB
SELECT slug, "whatsappWebhookVerifyToken"
FROM tenants
WHERE slug = 'meu-hotel';

# 2. Testar manualmente
curl "https://api.seudominio.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN_DO_DB&hub.challenge=test123" \
  -H "X-Tenant-Slug: meu-hotel"

# Deve retornar: test123
```

---

### Problema 2: Webhook recebe mas não processa

**Sintomas:**
- Meta envia, retorna 200, mas mensagens não aparecem no DB

**Causas:**
1. Signature validation falhando
2. Workers não rodando
3. Redis não conectado

**Solução:**
```bash
# 1. Verificar logs do controller
docker logs crm-backend | grep "webhook"

# 2. Verificar se workers estão registrados
docker logs crm-backend | grep "workers registered"

# 3. Verificar Redis
docker exec crm-redis redis-cli -a PASSWORD PING
# Deve retornar: PONG

# 4. Verificar filas
docker exec crm-backend node -e "
const Queue = require('bull');
const q = new Queue('whatsapp:incoming:message', 'redis://redis:6379');
q.getJobCounts().then(console.log);
"
```

---

### Problema 3: Mensagens não sendo enviadas

**Sintomas:**
- Mensagens ficam em `status = SENT` mas não chegam

**Causas:**
1. `whatsappAccessToken` expirado
2. `whatsappPhoneNumberId` incorreto
3. Rate limit atingido

**Solução:**
```bash
# 1. Testar API diretamente
curl -X POST "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5511888888888",
    "type": "text",
    "text": { "body": "Test" }
  }'

# 2. Verificar logs de erro
SELECT *
FROM messages
WHERE status = 'FAILED'
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

### Problema 4: Mídias não baixando

**Sintomas:**
- Mensagens com mídia salvam mas `metadata.localPath` é null

**Causas:**
1. Worker de download não rodando
2. Permissões de escrita no diretório `uploads/`
3. WhatsApp API não autoriza download

**Solução:**
```bash
# 1. Verificar fila de download
docker exec crm-backend node -e "
const Queue = require('bull');
const q = new Queue('whatsapp:media:download', 'redis://redis:6379');
q.getJobCounts().then(console.log);
"

# 2. Verificar permissões
ls -la /opt/uploads/media/

# 3. Testar download manual
curl -X GET "https://graph.facebook.com/v21.0/MEDIA_ID" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

## ✅ Best Practices

### 1. Response Timing

- **SEMPRE** responder < 5 segundos
- Processamento pesado em background (filas)
- Não fazer queries síncronas no controller

### 2. Error Handling

- **SEMPRE** retornar 200 (mesmo com erro)
- Logar erros detalhados
- Não expor stack traces para Meta

### 3. Retry Logic

- Usar exponential backoff
- Limitar tentativas (3-5x)
- Dead letter queue para jobs falhos

### 4. Monitoring

- Logs estruturados (JSON)
- Métricas de filas
- Alertas para jobs falhos

### 5. Security

- **SEMPRE** validar signature
- Timing-safe comparison
- Rate limiting
- Tenant isolation

### 6. Scalability

- Workers em processos separados
- Redis clustering (futuro)
- Load balancing (futuro)

---

## 📚 Referências

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhooks Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Message Types](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)
- [Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
- [Bull Queue Docs](https://github.com/OptimalBits/bull)
- [Zod Validation](https://zod.dev/)

---

**Última atualização:** 12/11/2025
**Versão:** 2.0.0
**Status:** ✅ Production-Ready
