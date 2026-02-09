# Swagger/OpenAPI Documentation Setup

## Overview

O backend do CRM Hoteis Reserva agora possui documentação completa em OpenAPI 3.0 com Swagger UI interativa.

## Acessando a Documentação

### Swagger UI (Interface Interativa)
```
GET http://localhost:3000/api/docs
```

Acesso visual com testes de endpoints em tempo real.

### Especificação OpenAPI (JSON)
```
GET http://localhost:3000/api/docs/swagger.json
```

Especificação completa em formato JSON para integração com Postman, Insomnia, etc.

## Arquivos de Configuração

### 1. `/deploy-backend/src/config/swagger.ts`
Arquivo principal com configuração do Swagger:
- OpenAPI 3.0.3 specification
- Info: título, versão, descrição
- Servers (dev, produção)
- Security schemes (JWT BearerAuth, N8N API Key)
- Base schemas (User, Conversation, Message, etc.)

### 2. `/deploy-backend/src/config/swagger-endpoints.ts`
Definição de todos os endpoints organizados por domínio:
- `authEndpoints` - Login, refresh, logout, change password
- `userEndpoints` - CRUD de usuários
- `conversationEndpoints` - CRUD de conversas
- `messageEndpoints` - Envio e listagem de mensagens
- `contactEndpoints` - CRUD de contatos
- `tagEndpoints` - CRUD de tags
- `reportEndpoints` - Relatórios e métricas
- `escalationEndpoints` - Escalações para humano
- `n8nEndpoints` - Integração N8N (envio de mensagens, flows, etc)
- `auditLogEndpoints` - Logs de auditoria
- `usageTrackingEndpoints` - Rastreamento de uso
- `webhookEventEndpoints` - Gerenciamento de webhook events

### 3. `server.ts` (Atualizado)
Integração do Swagger UI:
```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// Registra Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {...}));

// Endpoint para download da spec
app.get('/api/docs/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
```

## Autenticação

### BearerAuth (JWT)
Endpoints protegidos usam JWT:
1. Faça login: `POST /auth/login`
2. Copie o `accessToken` retornado
3. No Swagger UI, clique em "Authorize"
4. Cole o token: `Bearer {accessToken}`

### ApiKey (N8N)
Endpoints N8N usam API Key:
- Header: `X-API-Key`
- Formato: `tenantSlug:whatsappPhoneNumberId`
- Exemplo: `hotel-ilhabela:5511987654321000`

## Tags de Endpoints

A documentação está organizada em tags para fácil navegação:

- **Auth** - Autenticação (login, refresh, logout)
- **Users** - Gerenciamento de usuários
- **Conversations** - Conversas WhatsApp
- **Messages** - Mensagens (envio, busca, leitura)
- **Contacts** - Contatos
- **Tags** - Tags para organizar conversas
- **Reports** - Relatórios e analytics
- **Escalations** - Escalações para atendimento humano
- **N8N** - Integração com automação (N8N)
- **AuditLogs** - Logs de auditoria
- **UsageTracking** - Rastreamento de uso
- **WebhookEvents** - Gerenciamento de webhooks

## Modelos de Dados (Schemas)

### User
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "email": "user@email.com",
  "name": "Nome do Usuário",
  "role": "TENANT_ADMIN|MANAGER|ATTENDANT|SALES",
  "status": "ACTIVE|SUSPENDED|INACTIVE",
  "createdAt": "2026-02-09T10:00:00Z",
  "updatedAt": "2026-02-09T10:00:00Z"
}
```

### Conversation
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "contactId": "uuid",
  "status": "BOT_HANDLING|OPEN|IN_PROGRESS|WAITING|CLOSED|ARCHIVED",
  "assignedToId": "uuid|null",
  "hotelUnit": "Ilhabela|Campos do Jordão|Camburi|Santo Antônio do Pinhal",
  "isOpportunity": true,
  "opportunityAt": "2026-02-09T10:00:00Z",
  "iaLocked": false,
  "iaLockedAt": "2026-02-09T10:00:00Z",
  "lastMessageAt": "2026-02-09T10:00:00Z",
  "createdAt": "2026-02-09T10:00:00Z",
  "updatedAt": "2026-02-09T10:00:00Z"
}
```

### Message
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "tenantId": "uuid",
  "type": "TEXT|IMAGE|VIDEO|AUDIO|DOCUMENT|TEMPLATE|INTERACTIVE",
  "content": "Conteúdo da mensagem",
  "direction": "INBOUND|OUTBOUND",
  "whatsappMessageId": "wamid.xxx",
  "isRead": false,
  "sentAt": "2026-02-09T10:00:00Z",
  "createdAt": "2026-02-09T10:00:00Z"
}
```

### Contact
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "phoneNumber": "5511999999999",
  "name": "Nome do Contato",
  "email": "contato@email.com",
  "profilePictureUrl": "https://...",
  "createdAt": "2026-02-09T10:00:00Z",
  "updatedAt": "2026-02-09T10:00:00Z"
}
```

## Exemplos de Requisições

### Autenticação
```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hotel.com",
    "password": "senha123",
    "tenantSlug": "hotel-ilhabela"
  }'

# Response
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "admin@hotel.com",
    "name": "Admin",
    "role": "TENANT_ADMIN",
    "status": "ACTIVE"
  }
}

# Renovar Token
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

### Listar Conversas
```bash
curl -X GET 'http://localhost:3000/api/conversations?skip=0&take=10&status=OPEN' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Enviar Mensagem
```bash
curl -X POST http://localhost:3000/api/conversations/{id}/messages \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Olá! Como posso ajudar?",
    "type": "TEXT"
  }'
```

### N8N - Enviar Mensagem de Texto
```bash
curl -X POST http://localhost:3000/api/n8n/send-text \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "message": "Sua reserva foi confirmada!"
  }'

# Response
{
  "success": true,
  "messageId": "wamid.HBEUIFRFQUxDODEyMzQ1Nj...",
  "botReservaResponse": {
    "messageId": "wamid.HBEUIFRFQUxDODEyMzQ1Nj...",
    "id": "wamid.HBEUIFRFQUxDODEyMzQ1Nj..."
  }
}
```

### N8N - Enviar com Botões
```bash
curl -X POST http://localhost:3000/api/n8n/send-buttons \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "message": "Qual é sua escolha?",
    "buttons": [
      {"id": "btn1", "label": "Opção 1"},
      {"id": "btn2", "label": "Opção 2"},
      {"id": "btn3", "label": "Opção 3"}
    ],
    "title": "Menu",
    "footer": "Escolha uma opção"
  }'
```

### N8N - Verificar Disponibilidade
```bash
curl -X GET 'http://localhost:3000/api/n8n/check-availability?unidade=Ilhabela&checkin=15/02/2026&checkout=20/02/2026&adults=2' \
  -H "X-API-Key: hotel-ilhabela:5511987654321000"

# Response
{
  "success": true,
  "companyId": "5f15f591ab41d43ac0fed67e",
  "unidade": "Ilhabela",
  "checkin": "15/02/2026",
  "checkout": "20/02/2026",
  "adults": 2,
  "rooms": [
    {
      "id": "room-123",
      "name": "Quarto Standard",
      "price": 350,
      "available": true,
      "imageUrl": "https://..."
    }
  ],
  "scrapedAt": "2026-02-09T12:00:00.000Z"
}
```

### N8N - Escalação (Transferir para Humano)
```bash
curl -X POST http://localhost:3000/api/n8n/escalate \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "reason": "USER_REQUESTED",
    "reasonDetail": "Cliente quer falar com um atendente",
    "priority": "HIGH"
  }'

# Response
{
  "success": true,
  "escalation": {
    "id": "uuid",
    "conversationId": "uuid",
    "status": "PENDING",
    "reason": "USER_REQUESTED",
    "priority": "HIGH",
    "createdAt": "2026-02-09T12:00:00.000Z"
  },
  "conversation": { ... },
  "contact": { ... }
}
```

## Códigos de Status HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado |
| 204 | No Content - Sucesso sem corpo |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Não autenticado |
| 403 | Forbidden - Sem permissão |
| 404 | Not Found - Recurso não encontrado |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error - Erro do servidor |

## Rate Limits

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `/auth/login` | 5 req | 15 min |
| `/api/n8n/*` | 5000 req | 1 min |
| `/api/*` (geral) | 100 req | 1 min |
| `/webhooks/*` | 1000 req | 1 min |

## Integração com Postman/Insomnia

### Importar Especificação OpenAPI

**Postman:**
1. Clique em "Import"
2. Selecione "Link"
3. Cole: `http://localhost:3000/api/docs/swagger.json`
4. Clique em "Continue" e "Import"

**Insomnia:**
1. Clique em "Create" > "Request Collection"
2. Clique em "Import"
3. Selecione "OpenAPI 3.0"
4. Cole: `http://localhost:3000/api/docs/swagger.json`

## Deployar em Produção

Em produção, atualize:
```typescript
// /deploy-backend/src/config/swagger.ts
servers: [
  {
    url: 'https://api.botreserva.com.br',
    description: 'Production Server',
  },
]
```

## Disabling Swagger em Produção (Opcional)

Para desabilitar Swagger em produção por segurança:
```typescript
if (env.NODE_ENV === 'production') {
  app.get('/api/docs', (_req, res) => {
    res.status(403).json({ error: 'Documentation not available in production' });
  });
} else {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

## Validação de Tipo

Todos os endpoints incluem:
- **Request validation** (Zod schemas)
- **Response schemas** (OpenAPI 3.0)
- **Type safety** (TypeScript generics)
- **Error responses** (400, 401, 403, 404, 500)

## Próximos Passos

1. Testar endpoints via Swagger UI
2. Importar especificação no Postman/Insomnia
3. Gerar SDK clientes (Java, Python, JavaScript)
4. Documentar exemplos específicos de cada flow
5. Manter swagger.ts atualizado quando adicionar endpoints

## Links Úteis

- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [swagger-jsdoc GitHub](https://github.com/Surnet/swagger-jsdoc)
