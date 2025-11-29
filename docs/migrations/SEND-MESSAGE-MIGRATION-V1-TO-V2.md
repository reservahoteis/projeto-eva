# 🔄 Migração Send Message Service V1 → V2

**Data:** 12/11/2025
**Versão:** 2.0.0

---

## 📋 Visão Geral

Este guia descreve como migrar do Send Message Service V1 (síncrono) para V2 (assíncrono com filas).

---

## ✨ O Que Mudou

### Comparação V1 vs V2

| Feature | V1 (Antigo) | V2 (Novo) |
|---------|-------------|-----------|
| **Processamento** | ⚠️ Síncrono (aguarda envio) | ✅ Assíncrono (retorna imediato) |
| **Error Handling** | ⚠️ Básico | ✅ Robusto com códigos específicos |
| **Validação** | ⚠️ Parcial | ✅ Completa (tipo, tamanho, formato) |
| **Retry Logic** | ❌ Nenhum | ✅ 3x com exponential backoff |
| **Rate Limiting** | ❌ Nenhum | ✅ 80 msg/s (Meta limit) |
| **Axios Caching** | ❌ Nova instância sempre | ✅ Cache 5 min per tenant |
| **Phone Validation** | ⚠️ Básica | ✅ E.164 + formatação automática |
| **Type Safety** | ⚠️ Parcial | ✅ 100% TypeScript strict |
| **Logging** | ⚠️ console.log | ✅ Pino estruturado |
| **Template Support** | ✅ Sim | ✅ Sim + validação parâmetros |
| **Interactive Messages** | ❌ Não | ✅ Buttons + Lists |
| **Media Validation** | ⚠️ Básica | ✅ URL, tamanho, formato |
| **Status Tracking** | ⚠️ SENT após envio | ✅ SENT imediato, atualizado por webhook |

---

## 🚀 Passos de Migração

### 1. Verificar Dependências

Todas as dependências já devem estar instaladas se você fez a migração do Webhook V2:

```bash
cd deploy-backend

# Verificar se Bull e ioredis estão instalados
npm list bull ioredis

# Deve mostrar:
# bull@4.12.0
# ioredis@5.3.2
```

Se não estiverem:

```bash
pnpm add bull@4.12.0 ioredis@5.3.2
```

### 2. Atualizar Imports nos Controllers

**Antes (V1):**

```typescript
// src/controllers/message.controller.ts
import { whatsAppService } from '@/services/whatsapp.service';
import { messageService } from '@/services/message.service';
```

**Depois (V2):**

```typescript
// src/controllers/message.controller.ts
import { whatsAppServiceV2 } from '@/services/whatsapp.service.v2';
import { messageServiceV2 } from '@/services/message.service.v2';
```

---

### 3. Atualizar Método de Envio de Mensagem

#### 3.1. Mensagens de Texto

**Antes (V1):**

```typescript
// src/controllers/message.controller.ts
export class MessageController {
  async sendMessage(req: Request, res: Response): Promise<void> {
    const { conversationId, content, type } = req.body;
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    try {
      // 1. Buscar conversa
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, tenantId },
        include: { contact: true },
      });

      if (!conversation) {
        throw new NotFoundError('Conversa não encontrada');
      }

      // 2. ENVIAR DIRETO (SÍNCRONO - AGUARDA RESPOSTA)
      const result = await whatsAppService.sendTextMessage(
        tenantId,
        conversation.contact.phoneNumber,
        content
      );

      // 3. CRIAR MENSAGEM NO BANCO APÓS ENVIO
      const message = await prisma.message.create({
        data: {
          tenantId,
          conversationId,
          whatsappMessageId: result.whatsappMessageId, // Já tem ID
          direction: 'OUTBOUND',
          type: 'TEXT',
          content,
          sentById: userId,
          timestamp: new Date(),
          status: 'SENT', // Status final
        },
      });

      // 4. Atualizar conversa
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      res.status(200).json({ message });
    } catch (error) {
      // Error handling básico
      logger.error(error, 'Erro ao enviar mensagem');
      res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
  }
}
```

**Problemas do V1:**
- ❌ Aguarda envio (pode demorar 1-3s)
- ❌ Se WhatsApp API falhar, request falha
- ❌ Sem retry se der timeout
- ❌ Não escalável (muitas mensagens = muitas requisições pendentes)

---

**Depois (V2):**

```typescript
// src/controllers/message.controller.ts
export class MessageController {
  async sendMessage(req: Request, res: Response): Promise<void> {
    const { conversationId, content, type } = req.body;
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    try {
      // USAR SERVICE V2 - ENFILEIRA E RETORNA IMEDIATO
      const message = await messageServiceV2.sendMessage(
        {
          conversationId,
          content,
          type: type || 'TEXT',
          sentById: userId,
        },
        tenantId
      );

      // Retorna imediatamente (< 100ms)
      // Worker envia em background
      res.status(200).json({ message });
    } catch (error) {
      // Error handling robusto
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        logger.error({ error }, 'Erro ao enviar mensagem');
        res.status(500).json({ error: 'Erro interno ao enviar mensagem' });
      }
    }
  }
}
```

**Vantagens do V2:**
- ✅ Retorna em < 100ms
- ✅ Não bloqueia se WhatsApp API lenta
- ✅ Retry automático (3x)
- ✅ Escalável (milhares de mensagens)
- ✅ Rate limiting automático (80 msg/s)

---

#### 3.2. Mensagens de Mídia

**Antes (V1):**

```typescript
// Envio direto
const result = await whatsAppService.sendImageMessage(
  tenantId,
  phoneNumber,
  imageUrl,
  caption
);

const message = await prisma.message.create({
  data: {
    whatsappMessageId: result.whatsappMessageId,
    status: 'SENT',
    type: 'IMAGE',
    content: imageUrl,
    metadata: { caption },
    // ...
  },
});
```

**Depois (V2):**

```typescript
// Enfileira e retorna
const message = await messageServiceV2.sendMessage(
  {
    conversationId,
    content: imageUrl, // URL HTTPS pública
    type: 'IMAGE',
    sentById: userId,
    metadata: { caption },
  },
  tenantId
);

// Retorna imediatamente
// Worker baixa e envia em background
```

---

#### 3.3. Template Messages

**Antes (V1):**

```typescript
const result = await whatsAppService.sendTemplate(
  tenantId,
  phoneNumber,
  'reserva_confirmada',
  ['João', '15', 'dezembro'],
  'pt_BR'
);

const message = await prisma.message.create({
  data: {
    whatsappMessageId: result.whatsappMessageId,
    type: 'TEMPLATE',
    content: `Template: reserva_confirmada`,
    metadata: {
      templateName: 'reserva_confirmada',
      parameters: ['João', '15', 'dezembro'],
    },
    status: 'SENT',
    // ...
  },
});
```

**Depois (V2):**

```typescript
const message = await messageServiceV2.sendTemplateMessage(
  tenantId,
  conversationId,
  'reserva_confirmada',
  ['João', '15', 'dezembro'],
  userId, // sentById
  'pt_BR'
);

// Retorna imediatamente
// Worker envia em background
```

---

### 4. Atualizar Validações

**V2 já faz todas as validações automaticamente**, mas se você tiver validações customizadas, ajuste:

#### 4.1. Validação de Telefone

**Antes (V1):**

```typescript
// Validação básica (não suficiente)
if (!phoneNumber || phoneNumber.length < 10) {
  throw new BadRequestError('Número inválido');
}
```

**Depois (V2):**

```typescript
// whatsAppServiceV2 já valida automaticamente
// Mas você pode validar antes se quiser:
import { whatsAppServiceV2 } from '@/services/whatsapp.service.v2';

if (!whatsAppServiceV2.validatePhoneNumber(phoneNumber)) {
  throw new BadRequestError('Número de telefone inválido (formato E.164)');
}

// Formatar automaticamente
const formatted = whatsAppServiceV2.formatPhoneNumber(phoneNumber);
// +55 11 9999-9999 → 5511999999999
```

#### 4.2. Validação de Conteúdo

**Antes (V1):**

```typescript
// Validação manual
if (text.length > 4096) {
  throw new BadRequestError('Texto muito longo');
}
```

**Depois (V2):**

```typescript
// messageServiceV2.sendMessage() JÁ VALIDA automaticamente:
// - Texto: max 4096 caracteres, não vazio
// - Caption: max 1024 caracteres
// - Botões: 1-3, títulos max 20 chars
// - List: max 10 itens, títulos max 24 chars
// - URL de mídia: deve ser HTTPS

// Você não precisa validar manualmente!
```

---

### 5. Atualizar Error Handling

**Antes (V1):**

```typescript
try {
  const result = await whatsAppService.sendTextMessage(...);
} catch (error) {
  // Error handling genérico
  logger.error(error, 'Erro ao enviar');
  throw new Error('Erro ao enviar mensagem');
}
```

**Depois (V2):**

```typescript
import { WhatsAppApiError, WhatsAppErrorCode } from '@/services/whatsapp.service.v2';

try {
  const message = await messageServiceV2.sendMessage(...);
} catch (error) {
  if (error instanceof WhatsAppApiError) {
    // Tratar erros específicos da WhatsApp API
    switch (error.code) {
      case WhatsAppErrorCode.RATE_LIMIT_HIT:
        // Bull vai tentar novamente automaticamente
        throw new Error('Muitas mensagens, tente novamente em alguns segundos');

      case WhatsAppErrorCode.MESSAGE_UNDELIVERABLE:
        // Número bloqueou ou não existe
        throw new BadRequestError('Mensagem não pode ser entregue a este número');

      case WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE:
        // Fora da janela de 24h
        throw new BadRequestError('Use template message para contatos inativos');

      case WhatsAppErrorCode.TEMPLATE_DOES_NOT_EXIST:
        throw new NotFoundError('Template não encontrado');

      case WhatsAppErrorCode.PHONE_NUMBER_NOT_WHATSAPP:
        throw new BadRequestError('Número não tem WhatsApp');

      default:
        logger.error({ error }, 'WhatsApp API error');
        throw new Error('Erro ao enviar mensagem via WhatsApp');
    }
  }

  // Outros erros
  throw error;
}
```

---

### 6. Adicionar Suporte a Interactive Messages (Novo no V2)

#### 6.1. Buttons

```typescript
// NOVO no V2 - não existia no V1
import { whatsAppServiceV2 } from '@/services/whatsapp.service.v2';

export class MessageController {
  async sendButtonMessage(req: Request, res: Response): Promise<void> {
    const { conversationId, bodyText, buttons } = req.body;
    const tenantId = req.tenant.id;

    try {
      // Buscar conversa para pegar número do contato
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, tenantId },
        include: { contact: true },
      });

      if (!conversation) {
        throw new NotFoundError('Conversa não encontrada');
      }

      // Enviar botões
      await whatsAppServiceV2.sendInteractiveButtons(
        tenantId,
        conversation.contact.phoneNumber,
        bodyText,
        buttons // [{ id: 'btn1', title: 'Opção 1' }, ...]
      );

      // Criar registro no banco
      const message = await prisma.message.create({
        data: {
          tenantId,
          conversationId,
          direction: 'OUTBOUND',
          type: 'INTERACTIVE',
          content: bodyText,
          metadata: {
            interactiveType: 'button',
            buttons,
          },
          sentById: req.user.id,
          timestamp: new Date(),
          status: 'SENT',
        },
      });

      res.status(200).json({ message });
    } catch (error) {
      // Error handling...
    }
  }
}
```

#### 6.2. List

```typescript
// NOVO no V2
export class MessageController {
  async sendListMessage(req: Request, res: Response): Promise<void> {
    const { conversationId, bodyText, buttonText, sections } = req.body;
    const tenantId = req.tenant.id;

    try {
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, tenantId },
        include: { contact: true },
      });

      if (!conversation) {
        throw new NotFoundError('Conversa não encontrada');
      }

      await whatsAppServiceV2.sendInteractiveList(
        tenantId,
        conversation.contact.phoneNumber,
        bodyText,
        buttonText,
        sections
      );

      const message = await prisma.message.create({
        data: {
          tenantId,
          conversationId,
          direction: 'OUTBOUND',
          type: 'INTERACTIVE',
          content: bodyText,
          metadata: {
            interactiveType: 'list',
            buttonText,
            sections,
          },
          sentById: req.user.id,
          timestamp: new Date(),
          status: 'SENT',
        },
      });

      res.status(200).json({ message });
    } catch (error) {
      // Error handling...
    }
  }
}
```

---

### 7. Atualizar Routes (Opcional)

Se você quiser adicionar endpoints para interactive messages:

```typescript
// src/routes/message.routes.ts
import { Router } from 'express';
import { MessageController } from '@/controllers/message.controller';

const router = Router();
const controller = new MessageController();

// Endpoints existentes
router.post('/', controller.sendMessage);
router.get('/:conversationId', controller.listMessages);

// NOVOS endpoints para interactive messages
router.post('/buttons', controller.sendButtonMessage);
router.post('/list', controller.sendListMessage);

export default router;
```

---

### 8. Deploy

#### 8.1. Build Local

```bash
cd deploy-backend

# Compilar TypeScript
pnpm build

# Verificar se não há erros
```

#### 8.2. Deploy para VPS

```bash
# Copiar arquivos
scp -r deploy-backend/* root@72.61.39.235:/opt/

# Conectar via SSH
ssh root@72.61.39.235

# Ir para diretório
cd /opt

# Rebuild backend
docker compose -f docker-compose.production.yml up -d --build backend

# Verificar logs
docker logs crm-backend --tail 100

# Deve aparecer:
# ✅ Queue workers registered
# ✅ Outgoing message worker registered (concurrency: 3)
```

---

## ✅ Validação

### 1. Testar Envio de Mensagem de Texto

```bash
# Via curl (ou Postman)
curl -X POST https://api.seudominio.com/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "X-Tenant-Slug: seu-hotel" \
  -d '{
    "conversationId": "conv-123",
    "content": "Teste V2 - mensagem assíncrona",
    "type": "TEXT"
  }'

# Deve retornar em < 100ms com:
{
  "message": {
    "id": "msg-xxx",
    "status": "SENT",
    "whatsappMessageId": null,  // Será preenchido pelo worker
    "content": "Teste V2 - mensagem assíncrona",
    // ...
  }
}
```

**Verificar logs do worker:**

```bash
docker logs crm-backend --tail 50 | grep "Sending message"

# Deve aparecer:
# Sending message (enqueuing)
# Message created in database
# Message enqueued for sending
# Processing outgoing message job
# Message sent successfully
```

**Verificar se whatsappMessageId foi preenchido:**

```bash
# No banco de dados
docker exec crm-postgres psql -U postgres -d crm -c \
  "SELECT id, whatsapp_message_id, status FROM messages WHERE id = 'msg-xxx';"

# Deve mostrar:
# id      | whatsapp_message_id      | status
# --------|--------------------------|-------
# msg-xxx | wamid.XXX=               | SENT
```

---

### 2. Testar Envio de Template

```bash
curl -X POST https://api.seudominio.com/api/messages/template \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "X-Tenant-Slug: seu-hotel" \
  -d '{
    "conversationId": "conv-123",
    "templateName": "reserva_confirmada",
    "parameters": ["João Silva", "15", "dezembro", "14:00"],
    "languageCode": "pt_BR"
  }'
```

---

### 3. Testar Envio de Imagem

```bash
curl -X POST https://api.seudominio.com/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "X-Tenant-Slug: seu-hotel" \
  -d '{
    "conversationId": "conv-123",
    "content": "https://exemplo.com/foto.jpg",
    "type": "IMAGE",
    "metadata": {
      "caption": "Foto do quarto"
    }
  }'
```

---

### 4. Testar Interactive Buttons

```bash
curl -X POST https://api.seudominio.com/api/messages/buttons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "X-Tenant-Slug: seu-hotel" \
  -d '{
    "conversationId": "conv-123",
    "bodyText": "Escolha uma opção:",
    "buttons": [
      { "id": "opt1", "title": "Opção 1" },
      { "id": "opt2", "title": "Opção 2" }
    ]
  }'
```

---

### 5. Verificar Filas

```bash
# Contar jobs nas filas
docker exec crm-backend node -e "
const Queue = require('bull');
const redis = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
};

async function check() {
  const queue = new Queue('whatsapp:outgoing:message', { redis });
  const counts = await queue.getJobCounts();
  console.log('Outgoing message queue:', counts);
  process.exit(0);
}

check();
"
```

---

### 6. Testar Rate Limiting

```bash
# Enviar 100 mensagens rapidamente
for i in {1..100}; do
  curl -X POST https://api.seudominio.com/api/messages \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer SEU_TOKEN" \
    -H "X-Tenant-Slug: seu-hotel" \
    -d "{
      \"conversationId\": \"conv-123\",
      \"content\": \"Mensagem $i\",
      \"type\": \"TEXT\"
    }" &
done

wait

# Verificar logs - deve mostrar rate limiting em ação
docker logs crm-backend --tail 200 | grep "rate limit"
```

---

## ⚠️ Rollback (Se Necessário)

Se algo der errado, você pode reverter para V1:

### 1. Reverter Código

```bash
# Na sua máquina local
cd deploy-backend

# Voltar commits dos services V2
git checkout HEAD~1 src/services/whatsapp.service.v2.ts
git checkout HEAD~1 src/services/message.service.v2.ts

# Reverter imports no controller
# Editar manualmente src/controllers/message.controller.ts
# Trocar:
#   import { messageServiceV2 } from '@/services/message.service.v2';
# Por:
#   import { messageService } from '@/services/message.service';

# Rebuild
pnpm build
```

### 2. Deploy Versão Antiga

```bash
# Copiar para VPS
scp -r deploy-backend/* root@72.61.39.235:/opt/

# Na VPS
ssh root@72.61.39.235
cd /opt

# Rebuild backend
docker compose -f docker-compose.production.yml up -d --build backend

# Verificar logs
docker logs crm-backend --tail 50
```

### 3. Verificar Funcionamento V1

```bash
# Testar envio
curl -X POST https://api.seudominio.com/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "X-Tenant-Slug: seu-hotel" \
  -d '{
    "conversationId": "conv-123",
    "content": "Teste V1",
    "type": "TEXT"
  }'
```

---

## 📊 Comparação de Performance

### V1 (Síncrono)

```
POST /api/messages → Controller
  ├─ Validate request (10ms)
  ├─ Find conversation (50ms)
  ├─ Send via WhatsApp API (1000-3000ms) ⏰ BLOQUEANTE
  ├─ Create message in DB (50ms)
  ├─ Update conversation (50ms)
  └─ Response (1160-3160ms total) ❌ LENTO
```

**Problemas:**
- ❌ Response time 1-3 segundos
- ❌ Se API lenta, request fica travado
- ❌ Se falhar, não tenta novamente
- ❌ Não escalável (10 req/s = 10 enviando ao mesmo tempo)

---

### V2 (Assíncrono)

```
POST /api/messages → Controller
  ├─ Validate request (10ms)
  ├─ messageServiceV2.sendMessage()
  │   ├─ Find conversation (50ms)
  │   ├─ Validate phone (5ms)
  │   ├─ Validate content (5ms)
  │   ├─ Create message in DB (50ms)
  │   ├─ Enqueue to Bull (5ms) ⚡ NÃO BLOQUEANTE
  │   └─ Update conversation (50ms)
  └─ Response (175ms total) ✅ RÁPIDO

Background Worker (assíncrono)
  ├─ Process job from queue
  ├─ Send via WhatsApp API (1000-3000ms)
  ├─ Update message with whatsappMessageId (50ms)
  └─ Log result
```

**Vantagens:**
- ✅ Response time < 200ms (sempre)
- ✅ Não bloqueia se API lenta
- ✅ Retry automático (3x)
- ✅ Escalável (1000 req/s = 1000 enfileirados, 80 enviando por segundo)
- ✅ Rate limiting automático

---

## 🐛 Troubleshooting

### Problema 1: Mensagens não são enviadas após migração

**Sintomas:**
- Request retorna 200 OK
- Mensagem criada no banco com status SENT
- Mas whatsappMessageId fica NULL
- Cliente não recebe

**Causa:**
Worker não está registrado ou não está rodando.

**Solução:**

```bash
# 1. Verificar se registerWorkers() foi chamado
docker logs crm-backend | grep "workers registered"

# Se NÃO aparecer "✅ Queue workers registered", adicionar no server.ts:
```

```typescript
// server.ts
import { registerWorkers } from '@/queues/workers';

// ... após inicializar Express

// IMPORTANTE: Registrar workers
registerWorkers();
logger.info('✅ Queue workers registered');
```

```bash
# 2. Rebuild backend
cd /opt
docker compose -f docker-compose.production.yml up -d --build backend

# 3. Verificar logs novamente
docker logs crm-backend --tail 50
```

---

### Problema 2: Jobs ficam em "stalled"

**Sintomas:**
```bash
docker exec crm-backend node -e "..."
# Mostra: stalled: 10
```

**Causa:**
Worker travou ou foi reiniciado no meio do processamento.

**Solução:**

```bash
# Limpar jobs travados
docker exec crm-backend node -e "
const Queue = require('bull');
const redis = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
};

async function clean() {
  const queue = new Queue('whatsapp:outgoing:message', { redis });
  await queue.clean(0, 'active');
  console.log('Cleaned active jobs');
  process.exit(0);
}

clean();
"
```

---

### Problema 3: Erros de validação que antes não existiam

**Sintomas:**
```json
{
  "error": "Número de telefone inválido (formato E.164)"
}
```

**Causa:**
V2 tem validações mais rigorosas.

**Solução:**
Ajustar dados de entrada para seguir padrões:

```typescript
// Números de telefone devem ser E.164 (sem espaços, hífens)
// ❌ ERRADO: +55 11 9999-9999
// ✅ CORRETO: 5511999999999

// V2 formata automaticamente, mas é melhor enviar correto
import { whatsAppServiceV2 } from '@/services/whatsapp.service.v2';

const formatted = whatsAppServiceV2.formatPhoneNumber(phoneNumber);
// Usar `formatted` nas chamadas
```

---

### Problema 4: Interactive messages não funcionam

**Causa:**
Endpoint não foi criado ou está mal configurado.

**Solução:**
Verificar se endpoint existe:

```bash
# Testar endpoint
curl -X POST https://api.seudominio.com/api/messages/buttons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '...'

# Se retornar 404, adicionar route:
```

```typescript
// src/routes/message.routes.ts
router.post('/buttons', controller.sendButtonMessage);
router.post('/list', controller.sendListMessage);
```

---

## ✅ Checklist de Migração

- [ ] Dependências instaladas (Bull, ioredis)
- [ ] `whatsapp.service.v2.ts` e `message.service.v2.ts` criados
- [ ] Imports atualizados nos controllers
- [ ] `registerWorkers()` chamado no `server.ts`
- [ ] Build sem erros TypeScript
- [ ] Deploy na VPS
- [ ] Logs mostram "workers registered"
- [ ] Teste de envio de texto passa
- [ ] Teste de envio de template passa
- [ ] Teste de envio de mídia passa
- [ ] whatsappMessageId é preenchido pelo worker
- [ ] Rate limiting funcionando
- [ ] Error handling testado
- [ ] Rollback plan documentado
- [ ] Documentação lida (WHATSAPP-SEND-MESSAGE-GUIDE.md)

---

## 📚 Próximos Passos

Após migração completa:

1. **Monitorar Performance**
   - Usar `/health/queues` para métricas
   - Verificar response time (deve ser < 200ms)
   - Verificar jobs falhados

2. **Ajustar Concorrência** (se necessário)
   - Editar `queues/workers/index.ts`
   - Aumentar/diminuir workers baseado no volume

3. **Implementar Webhooks de Status**
   - DELIVERED, READ já são tratados pelo webhook V2
   - Apenas verificar se está atualizando corretamente

4. **Adicionar Métricas**
   - Tempo médio de envio
   - Taxa de sucesso/falha
   - Mensagens por segundo

5. **Configurar Alertas**
   - Alertar se jobs > 100 falhados
   - Alertar se queue > 1000 waiting
   - Alertar se response time > 500ms

---

**Última atualização:** 12/11/2025
**Versão:** 2.0.0
