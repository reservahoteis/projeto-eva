# 🔄 Migração Webhook V1 → V2

**Data:** 12/11/2025
**Versão:** 2.0.0

---

## 📋 Visão Geral

Este guia descreve como migrar do webhook V1 (código original) para V2 (refatorado com Zod + Bull).

---

## ✨ O Que Mudou

### Melhorias V2

| Feature | V1 | V2 |
|---------|----|----|
| Validação de Payload | ❌ Manual | ✅ Zod (type-safe) |
| Processamento | ⚠️ Síncrono | ✅ Assíncrono (Bull queues) |
| Retry Logic | ❌ Nenhum | ✅ Exponential backoff |
| Type Safety | ⚠️ Parcial | ✅ 100% TypeScript strict |
| Signature Validation | ✅ Sim | ✅ Timing-safe |
| Error Handling | ⚠️ Básico | ✅ Robusto |
| Logging | ⚠️ Básico | ✅ Estruturado (Pino) |
| Rate Limiting | ❌ Nenhum | ✅ 80 msg/s (Meta limit) |
| Media Download | ⚠️ Bloqueante | ✅ Assíncrono |
| Monitoring | ❌ Nenhum | ✅ Queue metrics + health |
| Documentação | ⚠️ Comentários | ✅ Guia completo (50+ páginas) |

---

## 🚀 Passos de Migração

### 1. Instalar Dependências

```bash
cd deploy-backend

# Bull já está no package.json, mas verificar versão
npm list bull ioredis

# Se não estiver instalado:
pnpm add bull@4.12.0 ioredis@5.3.2
```

### 2. Criar Diretório de Uploads

```bash
# Na VPS
mkdir -p /opt/uploads/media
chmod 755 /opt/uploads/media
```

### 3. Atualizar server.ts

**Antes:**
```typescript
// server.ts
import webhookRoutes from '@/routes/webhook.routes';

app.use('/webhooks', webhookRoutes);
```

**Depois:**
```typescript
// server.ts
import webhookRoutesV2 from '@/routes/webhook.routes.v2';
import { registerWorkers } from '@/queues/workers';

// Routes
app.use('/webhooks', webhookRoutesV2);

// Registrar workers APÓS inicializar Express
registerWorkers();
logger.info('✅ Queue workers registered');
```

### 4. Atualizar Referências

**Arquivos que PODEM usar o novo webhook:**
- `src/services/message.service.ts` - Usar `enqueueOutgoingMessage()` ao invés de enviar direto
- `src/controllers/message.controller.ts` - Enfileirar mensagens

**Exemplo:**

**Antes (V1):**
```typescript
// message.service.ts
const result = await whatsAppService.sendTextMessage(tenantId, to, text);

await prisma.message.create({
  data: {
    whatsappMessageId: result.whatsappMessageId,
    status: 'SENT',
    // ...
  },
});
```

**Depois (V2):**
```typescript
// message.service.ts
import { enqueueOutgoingMessage } from '@/queues/whatsapp-webhook.queue';

// Criar mensagem com status PENDING
const message = await prisma.message.create({
  data: {
    status: 'PENDING', // Não SENT ainda
    // ...
  },
});

// Enfileirar para envio
await enqueueOutgoingMessage({
  tenantId,
  conversationId,
  messageId: message.id,
  to,
  type: 'text',
  content: text,
});
```

### 5. Atualizar Enum de Status (Opcional)

**Schema Prisma:**

**Antes:**
```prisma
enum MessageStatus {
  SENT
  DELIVERED
  READ
  FAILED
}
```

**Depois (adicionar PENDING):**
```prisma
enum MessageStatus {
  PENDING    // Enfileirado mas não enviado ainda
  SENT
  DELIVERED
  READ
  FAILED
}
```

**Migration:**
```bash
cd deploy-backend
pnpm prisma migrate dev --name add_pending_status
```

### 6. Deploy

```bash
# Build local
cd deploy-backend
pnpm build

# Deploy para VPS
scp -r deploy-backend/* root@72.61.39.235:/opt/

# Na VPS
ssh root@72.61.39.235
cd /opt

# Rebuild backend
docker compose -f docker-compose.production.yml up -d --build backend

# Verificar logs
docker logs crm-backend --tail 50

# Deve aparecer:
# ✅ Queue workers registered
# ✅ Incoming message worker registered (concurrency: 5)
# ✅ Status update worker registered (concurrency: 10)
# ✅ Outgoing message worker registered (concurrency: 3)
# ✅ Media download worker registered (concurrency: 2)
```

---

## ✅ Validação

### 1. Testar Verificação

```bash
curl "https://api.seudominio.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=test123" \
  -H "X-Tenant-Slug: seu-hotel"

# Deve retornar: test123
```

### 2. Testar Webhook (Simulação)

```bash
# Criar signature válida (use Python ou Node)
node -e "
const crypto = require('crypto');
const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: []
});
const secret = 'SEU_APP_SECRET';
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('Signature:', sig);
console.log('Payload:', payload);
"

# Enviar POST
curl -X POST https://api.seudominio.com/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: SIGNATURE_ACIMA" \
  -H "X-Tenant-Slug: seu-hotel" \
  -d 'PAYLOAD_ACIMA'

# Deve retornar: EVENT_RECEIVED
```

### 3. Verificar Filas

```bash
docker exec crm-backend node -e "
const Queue = require('bull');
const redis = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
};

async function check() {
  const queues = [
    'whatsapp:incoming:message',
    'whatsapp:status:update',
    'whatsapp:outgoing:message',
    'whatsapp:media:download'
  ];

  for (const name of queues) {
    const q = new Queue(name, { redis });
    const counts = await q.getJobCounts();
    console.log(name, counts);
  }

  process.exit(0);
}

check();
"
```

### 4. Enviar Mensagem Real

```bash
# Via WhatsApp mobile, enviar mensagem para o número do tenant
# Verificar logs:
docker logs crm-backend --tail 100 | grep "Incoming message"

# Deve aparecer:
# Incoming message enqueued
# Processing incoming message
# Incoming message processed successfully
```

---

## ⚠️ Rollback (Se Necessário)

Se algo der errado, você pode reverter para V1:

### 1. Reverter Código

```bash
# Na sua máquina local
cd deploy-backend
git checkout HEAD~1 src/controllers/webhook.controller.ts
git checkout HEAD~1 src/routes/webhook.routes.ts

# Rebuild e deploy
pnpm build
scp -r deploy-backend/* root@72.61.39.235:/opt/

# Na VPS
ssh root@72.61.39.235
cd /opt
docker compose -f docker-compose.production.yml up -d --build backend
```

### 2. Verificar Funcionamento

```bash
# Testar webhook V1
curl -X POST https://api.seudominio.com/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ..." \
  -H "X-Tenant-Slug: seu-hotel" \
  -d '{...}'
```

---

## 📊 Comparação de Performance

### V1 (Síncrono)

```
Webhook POST → Controller (validate + process)
  ├─ Validate signature (10ms)
  ├─ Find tenant (50ms)
  ├─ Find/Create contact (100ms)
  ├─ Find/Create conversation (100ms)
  ├─ Save message (50ms)
  └─ Response (310ms total)
```

**Problemas:**
- ❌ Timeout se DB lento (> 5s)
- ❌ Não retry se falhar
- ❌ Bloqueante

---

### V2 (Assíncrono)

```
Webhook POST → Controller (validate + enqueue)
  ├─ Validate signature (10ms)
  ├─ Validate payload Zod (5ms)
  ├─ Find tenant (50ms)
  ├─ Enqueue to Bull (5ms)
  └─ Response (70ms total) ✅

Background Worker
  ├─ Process message (200ms)
  ├─ Retry if fail (3x)
  └─ Log metrics
```

**Vantagens:**
- ✅ Response < 100ms (sempre)
- ✅ Retry automático
- ✅ Não bloqueante
- ✅ Escalável

---

## 🐛 Troubleshooting

### Problema: Workers não processando

**Solução:**
```bash
# Verificar se workers foram registrados
docker logs crm-backend | grep "workers registered"

# Verificar Redis
docker exec crm-redis redis-cli -a PASSWORD PING

# Restart backend
docker compose -f docker-compose.production.yml restart backend
```

### Problema: Jobs ficam em "stalled"

**Solução:**
```bash
# Limpar jobs travados
docker exec crm-backend node -e "
const Queue = require('bull');
const q = new Queue('whatsapp:incoming:message', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  }
});

q.clean(0, 'active').then(() => {
  console.log('Cleaned active jobs');
  process.exit(0);
});
"
```

### Problema: Mensagens duplicadas

**Causa:** Job deduplication não funcionando

**Solução:**
- Verificar `jobId` único em `enqueueIncomingMessage()`
- Jobs com mesmo `jobId` são automaticamente deduplicados

---

## ✅ Checklist de Migração

- [ ] Dependências instaladas (Bull, ioredis)
- [ ] Diretório `uploads/media` criado
- [ ] `server.ts` atualizado (registerWorkers)
- [ ] Build sem erros TypeScript
- [ ] Deploy na VPS
- [ ] Logs mostram "workers registered"
- [ ] Teste de verificação passa
- [ ] Teste de webhook passa
- [ ] Filas aparecem no Redis
- [ ] Mensagem real é processada
- [ ] Status updates funcionam
- [ ] Mídias sendo baixadas
- [ ] Documentação lida

---

## 📚 Próximos Passos

Após migração completa:

1. **Monitorar Performance**
   - Usar `/health/queues` para métricas
   - Verificar jobs falhados

2. **Ajustar Concorrência** (se necessário)
   - Editar `queues/workers/index.ts`
   - Aumentar/diminuir workers

3. **Configurar Alertas**
   - Alertar se jobs > 100 falhados
   - Alertar se queue > 1000 waiting

4. **Migrar Message Service**
   - Usar `enqueueOutgoingMessage()` em todos os envios

---

**Última atualização:** 12/11/2025
**Versão:** 2.0.0
