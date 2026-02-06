---
name: hoteis-arquitetura
description: Arquitetura detalhada do sistema CRM Hoteis Reserva
version: 1.0.0
---

# Skill: Arquitetura do Sistema

Documentacao detalhada da arquitetura do CRM Hoteis Reserva.

## Diagrama de Alto Nivel

```
+-------------------------------------------------------------+
|                        CLIENTE                              |
|                   (WhatsApp Mobile)                         |
+------------------------+------------------------------------+
                         |
                         v
+-------------------------------------------------------------+
|                  WhatsApp Cloud API                         |
|                   (Meta - graph.facebook.com)               |
+------------+------------------------------------------------+
             |
             | Webhook POST
             | (mensagens, status)
             v
+-------------------------------------------------------------+
|                   BACKEND API (Express.js)                  |
|                   api.botreserva.com.br                     |
|                                                             |
|  +--------------+  +--------------+  +--------------+       |
|  |   Webhooks   |  |   REST API   |  |  Socket.io   |       |
|  |   Handler    |  |   Routes     |  |   Server     |       |
|  +------+-------+  +------+-------+  +------+-------+       |
|         |                 |                  |              |
|         v                 v                  v              |
|  +----------------------------------------------------+    |
|  |          Bull Queues (Redis)                       |    |
|  |  - process-incoming-message                        |    |
|  |  - send-outgoing-message                           |    |
|  +----------------------+-----------------------------+    |
|                         |                                   |
|                         v                                   |
|  +----------------------------------------------------+    |
|  |          Services Layer                            |    |
|  |  - whatsapp.service.ts                             |    |
|  |  - message.service.ts                              |    |
|  |  - conversation.service.ts                         |    |
|  |  - escalation.service.ts                           |    |
|  |  - media-storage.service.ts                        |    |
|  +----------------------+-----------------------------+    |
|                         |                                   |
|                         v                                   |
|  +----------------------------------------------------+    |
|  |        Prisma ORM (Database Layer)                 |    |
|  +----------------------+-----------------------------+    |
+------------------------++-------------------------------+---+
                         ||
        +----------------++--------+
        v                          v
+---------------+          +---------------+
|  PostgreSQL   |          |     Redis     |
|  (Dados)      |          |  (Cache/Filas)|
+---------------+          +---------------+

        |
        | N8N Webhook
        v
+-----------------------------------------+
|              N8N (Automacao)            |
|  - Fluxos de IA conversacional          |
|  - Integracao com LLMs                  |
|  - Logica de negocio customizada        |
+-----------------------------------------+

        |
        | HTTP Requests
        v
+-----------------------------------------+
|       Backend API - N8N Routes          |
|  /api/n8n/send-text                     |
|  /api/n8n/send-buttons                  |
|  /api/n8n/send-carousel                 |
|  /api/n8n/escalate                      |
+-----------------------------------------+

+-----------------------------------------+
|         FRONTEND (Next.js/React)        |
|         www.botreserva.com.br           |
|                                         |
|  - Dashboard de conversas (Kanban)      |
|  - Chat em tempo real                   |
|  - Gestao de atendentes                 |
|  - Relatorios e Analytics               |
+-----------------------------------------+
```

## Fluxo de Mensagens

### Mensagem Recebida (Cliente -> Sistema)

```
1. Cliente envia msg no WhatsApp
   |
   v
2. WhatsApp Cloud API recebe
   |
   v
3. Meta envia webhook POST para /webhooks/whatsapp
   |
   v
4. Webhook valida HMAC signature (seguranca)
   |
   v
5. Adiciona job na fila 'process-incoming-message'
   |
   v
6. Worker processa assincronamente:
   - Cria/atualiza Contact
   - Cria/atualiza Conversation
   - Salva Message no banco
   - Verifica se IA esta locked
   - Se IA nao locked: encaminha para N8N
   - Se IA locked: apenas salva (atendente responde)
   |
   v
7. Socket.io emite evento para frontend
   |
   v
8. Frontend atualiza UI em tempo real
```

### Mensagem Enviada (Sistema -> Cliente)

```
A) Via Atendente (Frontend):
   1. Atendente digita no chat
   2. POST /api/messages
   3. Valida tenant + permissoes
   4. Chama whatsapp.service.sendTextMessage()
   5. WhatsApp Cloud API envia
   6. Salva no banco
   7. Socket.io notifica outros atendentes

B) Via N8N (Automacao):
   1. Fluxo N8N decide enviar
   2. POST /api/n8n/send-text (com API Key)
   3. Valida API Key + tenant
   4. Chama whatsapp.service.sendTextMessage()
   5. WhatsApp Cloud API envia
   6. Salva no banco
   7. Socket.io notifica atendentes
```

## Multi-Tenancy

### Estrategia: Row-Level Security via Prisma

```typescript
// SEMPRE incluir tenantId em queries
const conversations = await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId, // <- OBRIGATORIO
    status: 'OPEN',
  },
});

// Middleware global garante req.tenantId
// Qualquer query sem tenantId e bloqueada em review
```

### Regras

- `tenantId` obrigatorio em TODAS as queries (exceto SUPER_ADMIN)
- Indices compostos: `@@index([tenantId, ...])`
- Cascade delete: deletar tenant remove todos os dados
- Foreign keys: garantem integridade referencial

### Dados Compartilhados

- Nenhum. Cada tenant e completamente isolado.
- SUPER_ADMIN (tenantId NULL) ve tudo.

## Containers Docker

```
+---------------+------------------+-----------+---------------+
| Container     | Image            | Ports     | Status        |
+---------------+------------------+-----------+---------------+
| crm-nginx     | nginx:alpine     | 80, 443   | Up (healthy)  |
| crm-backend   | deploy-backend   | 3001      | Up (healthy)  |
| crm-postgres  | postgres:16      | 5432      | Up (healthy)  |
| crm-redis     | redis:7-alpine   | 6379      | Up (healthy)  |
| crm-certbot   | certbot/certbot  | -         | Up            |
+---------------+------------------+-----------+---------------+

NOTA: O N8N NAO esta nesta VPS - e gerenciado pela 3ian
```

## Volumes Docker

```
Docker Volumes:
+-- postgres_data     # Dados do PostgreSQL
+-- redis_data        # Persistencia Redis
\-- media_data        # Arquivos de midia WhatsApp

Bind Mounts:
+-- ./nginx/          # Configuracoes Nginx
\-- ./certbot/        # Certificados SSL
```

## Filas Assincronas (Bull + Redis)

### Por que filas?

- Webhooks do WhatsApp esperam resposta em <5s (ou reenviam)
- Processamento de mensagens pode demorar (chamadas N8N, DB writes)
- Retry automatico em caso de falha
- Controle de concorrencia

### Configuracao

```typescript
export const incomingMessageQueue = new Bull('incoming-message', {
  defaultJobOptions: {
    attempts: 3, // Retry ate 3 vezes
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
```

## Roles e Permissoes

| Role | Acesso |
|------|--------|
| `SUPER_ADMIN` | Todos os tenants, todas as operacoes |
| `ADMIN` | Tenant especifico, gestao completa |
| `MANAGER` | Tenant especifico, visualizacao e relatorios |
| `ATTENDANT` | Apenas conversas atribuidas ou da sua unidade |
| `SALES` | Apenas oportunidades (isOpportunity=true) |

## Checklist de Arquitetura

- [ ] Todas as queries incluem tenantId?
- [ ] Webhooks retornam em <5s?
- [ ] Jobs sao processados por filas?
- [ ] Socket.io emite para rooms corretos?
- [ ] N8N verifica iaLocked antes de responder?
