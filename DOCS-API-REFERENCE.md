# 📡 API REFERENCE - CRM WhatsApp

> **Documentação completa de todas as rotas da API REST**

---

## 🔐 AUTENTICAÇÃO

Todas as rotas (exceto login e webhooks) requerem autenticação via **JWT Bearer Token**.

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📚 ÍNDICE DE ENDPOINTS

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/refresh` - Renovar access token
- `POST /auth/logout` - Logout

### Conversas
- `GET /api/conversations` - Listar conversas
- `GET /api/conversations/:id` - Detalhes de conversa
- `PATCH /api/conversations/:id` - Atualizar conversa
- `POST /api/conversations/:id/assign` - Atribuir atendente
- `POST /api/conversations/:id/close` - Fechar conversa

### Mensagens
- `GET /api/conversations/:id/messages` - Listar mensagens
- `POST /api/messages` - Enviar mensagem
- `POST /api/messages/:id/read` - Marcar como lida

### Contatos
- `GET /api/contacts` - Listar contatos
- `GET /api/contacts/:id` - Detalhes de contato
- `PATCH /api/contacts/:id` - Atualizar contato

### Tags
- `GET /api/tags` - Listar tags
- `POST /api/tags` - Criar tag
- `DELETE /api/tags/:id` - Deletar tag

### Usuários (Admin)
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `PATCH /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Deletar usuário

### Webhooks
- `GET /webhooks/whatsapp` - Verificação Meta
- `POST /webhooks/whatsapp` - Receber eventos

### N8N Integration
- `POST /api/n8n/send-message` - Enviar mensagem (n8n)
- `POST /api/n8n/send-template` - Enviar template (n8n)

---

## 🔑 AUTENTICAÇÃO

### POST /auth/login
Fazer login e obter tokens.

**Request:**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "atendente@hotel.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "uuid",
    "email": "atendente@hotel.com",
    "name": "João Silva",
    "role": "ATTENDANT"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Errors:**
- `401` - Credenciais inválidas
- `400` - Email/senha faltando

---

### POST /auth/refresh
Renovar access token usando refresh token.

**Request:**
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGc..."
}
```

**Errors:**
- `401` - Refresh token inválido/expirado

---

### POST /auth/logout
Invalidar refresh token.

**Request:**
```http
POST /auth/logout
Authorization: Bearer <accessToken>

{
  "refreshToken": "eyJhbGc..."
}
```

**Response 200:**
```json
{
  "message": "Logout realizado com sucesso"
}
```

---

## 💬 CONVERSAS

### GET /api/conversations
Listar conversas do atendente logado (ou todas se admin).

**Request:**
```http
GET /api/conversations?status=OPEN&page=1&limit=20&sort=lastMessageAt:desc
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `status` (optional): OPEN | IN_PROGRESS | WAITING | CLOSED
- `priority` (optional): LOW | MEDIUM | HIGH | URGENT
- `assignedToId` (optional): UUID do atendente
- `page` (optional): Número da página (default: 1)
- `limit` (optional): Itens por página (default: 20, max: 100)
- `sort` (optional): Campo:ordem (ex: lastMessageAt:desc)
- `search` (optional): Buscar por nome/telefone

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "OPEN",
      "priority": "MEDIUM",
      "lastMessageAt": "2025-11-03T10:30:00Z",
      "createdAt": "2025-11-03T09:00:00Z",
      "contact": {
        "id": "uuid",
        "phoneNumber": "5511999999999",
        "name": "Maria Silva",
        "profilePictureUrl": "https://..."
      },
      "assignedTo": null,
      "tags": [
        { "id": "uuid", "name": "VIP", "color": "#FFD700" }
      ],
      "unreadCount": 3,
      "lastMessage": {
        "id": "uuid",
        "content": "Olá, gostaria de fazer uma reserva",
        "direction": "INBOUND",
        "timestamp": "2025-11-03T10:30:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### GET /api/conversations/:id
Detalhes completos de uma conversa.

**Request:**
```http
GET /api/conversations/uuid-aqui
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "lastMessageAt": "2025-11-03T10:30:00Z",
  "createdAt": "2025-11-03T09:00:00Z",
  "closedAt": null,
  "contact": {
    "id": "uuid",
    "phoneNumber": "5511999999999",
    "name": "Maria Silva",
    "profilePictureUrl": "https://...",
    "metadata": {
      "whatsapp_name": "Maria"
    }
  },
  "assignedTo": {
    "id": "uuid",
    "name": "João Atendente",
    "email": "joao@hotel.com"
  },
  "tags": []
}
```

**Errors:**
- `404` - Conversa não encontrada
- `403` - Sem permissão (se não for o atendente atribuído e não for admin)

---

### PATCH /api/conversations/:id
Atualizar dados da conversa.

**Request:**
```http
PATCH /api/conversations/uuid-aqui
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "tags": ["uuid-tag-1", "uuid-tag-2"]
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "tags": [...]
}
```

---

### POST /api/conversations/:id/assign
Atribuir conversa a um atendente.

**Request:**
```http
POST /api/conversations/uuid-aqui/assign
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "userId": "uuid-atendente"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "assignedTo": {
    "id": "uuid",
    "name": "João Atendente"
  }
}
```

---

### POST /api/conversations/:id/close
Fechar uma conversa.

**Request:**
```http
POST /api/conversations/uuid-aqui/close
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "reason": "Reserva confirmada"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "CLOSED",
  "closedAt": "2025-11-03T11:00:00Z"
}
```

---

## 📨 MENSAGENS

### GET /api/conversations/:id/messages
Listar mensagens de uma conversa.

**Request:**
```http
GET /api/conversations/uuid-aqui/messages?limit=50&before=uuid-msg
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `limit` (optional): Quantidade (default: 50, max: 100)
- `before` (optional): ID da mensagem (para paginação)
- `after` (optional): ID da mensagem

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "conversationId": "uuid",
      "direction": "INBOUND",
      "type": "TEXT",
      "content": "Olá, preciso de uma reserva",
      "status": "DELIVERED",
      "timestamp": "2025-11-03T10:00:00Z",
      "sentBy": null,
      "metadata": null
    },
    {
      "id": "uuid",
      "conversationId": "uuid",
      "direction": "OUTBOUND",
      "type": "TEXT",
      "content": "Olá! Claro, quando seria?",
      "status": "READ",
      "timestamp": "2025-11-03T10:01:00Z",
      "sentBy": {
        "id": "uuid",
        "name": "João Atendente"
      },
      "metadata": null
    },
    {
      "id": "uuid",
      "direction": "INBOUND",
      "type": "IMAGE",
      "content": "https://cdn.whatsapp.com/...",
      "status": "DELIVERED",
      "timestamp": "2025-11-03T10:05:00Z",
      "metadata": {
        "caption": "Olha essa vista!",
        "mimeType": "image/jpeg",
        "sha256": "..."
      }
    }
  ],
  "hasMore": true,
  "nextCursor": "uuid-ultima-msg"
}
```

---

### POST /api/messages
Enviar mensagem.

**Request (Texto):**
```http
POST /api/messages
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "conversationId": "uuid",
  "type": "TEXT",
  "content": "Sua reserva foi confirmada!"
}
```

**Request (Imagem):**
```http
POST /api/messages
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "conversationId": "uuid",
  "type": "IMAGE",
  "content": "https://url-da-imagem.com/foto.jpg",
  "caption": "Foto do quarto"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "direction": "OUTBOUND",
  "type": "TEXT",
  "content": "Sua reserva foi confirmada!",
  "status": "SENT",
  "timestamp": "2025-11-03T11:00:00Z",
  "sentBy": {
    "id": "uuid",
    "name": "João Atendente"
  }
}
```

**Tipos de Mensagem Suportados:**

```typescript
type MessageType =
  | 'TEXT'      // Texto simples
  | 'IMAGE'     // Imagem (URL)
  | 'VIDEO'     // Vídeo (URL)
  | 'AUDIO'     // Áudio (URL)
  | 'DOCUMENT'  // Documento PDF/etc (URL)
  | 'LOCATION'  // Localização (lat/long)
```

**Errors:**
- `400` - Dados inválidos
- `403` - Conversa não atribuída ao atendente
- `429` - Rate limit excedido

---

### POST /api/messages/:id/read
Marcar mensagem como lida (envia confirmação para WhatsApp).

**Request:**
```http
POST /api/messages/uuid-aqui/read
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "success": true
}
```

---

## 👤 CONTATOS

### GET /api/contacts
Listar todos os contatos.

**Request:**
```http
GET /api/contacts?search=Maria&page=1&limit=20
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "phoneNumber": "5511999999999",
      "name": "Maria Silva",
      "profilePictureUrl": "https://...",
      "createdAt": "2025-11-01T08:00:00Z",
      "conversationsCount": 5,
      "lastConversationAt": "2025-11-03T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

### GET /api/contacts/:id
Detalhes de um contato.

**Request:**
```http
GET /api/contacts/uuid-aqui
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "id": "uuid",
  "phoneNumber": "5511999999999",
  "name": "Maria Silva",
  "profilePictureUrl": "https://...",
  "metadata": {
    "whatsapp_name": "Maria",
    "custom_field": "VIP"
  },
  "createdAt": "2025-11-01T08:00:00Z",
  "conversations": [
    {
      "id": "uuid",
      "status": "CLOSED",
      "createdAt": "2025-11-01T09:00:00Z"
    }
  ]
}
```

---

### PATCH /api/contacts/:id
Atualizar dados do contato.

**Request:**
```http
PATCH /api/contacts/uuid-aqui
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Maria Silva Santos",
  "metadata": {
    "cpf": "123.456.789-00",
    "preferredRoom": "Suíte Master"
  }
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "name": "Maria Silva Santos",
  "metadata": {...}
}
```

---

## 🏷️ TAGS

### GET /api/tags
Listar todas as tags.

**Request:**
```http
GET /api/tags
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "VIP",
      "color": "#FFD700"
    },
    {
      "id": "uuid",
      "name": "Urgente",
      "color": "#FF0000"
    }
  ]
}
```

---

### POST /api/tags
Criar nova tag (admin only).

**Request:**
```http
POST /api/tags
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Check-in Hoje",
  "color": "#00FF00"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "Check-in Hoje",
  "color": "#00FF00"
}
```

---

## 👥 USUÁRIOS (Admin Only)

### GET /api/users
Listar todos os usuários.

**Request:**
```http
GET /api/users
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "admin@hotel.com",
      "name": "Admin Principal",
      "role": "ADMIN",
      "status": "ACTIVE",
      "createdAt": "2025-10-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "email": "joao@hotel.com",
      "name": "João Atendente",
      "role": "ATTENDANT",
      "status": "ACTIVE",
      "createdAt": "2025-10-15T00:00:00Z"
    }
  ]
}
```

---

### POST /api/users
Criar novo usuário.

**Request:**
```http
POST /api/users
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "email": "novo@hotel.com",
  "password": "senhaSegura123!",
  "name": "Novo Atendente",
  "role": "ATTENDANT"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "email": "novo@hotel.com",
  "name": "Novo Atendente",
  "role": "ATTENDANT",
  "status": "ACTIVE"
}
```

---

## 🔗 WEBHOOKS (WhatsApp)

### GET /webhooks/whatsapp
Verificação inicial do webhook pela Meta.

**Request (feito pela Meta):**
```http
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123456
```

**Response 200:**
```
123456
```

---

### POST /webhooks/whatsapp
Receber eventos do WhatsApp.

**Request (feito pela Meta):**
```http
POST /webhooks/whatsapp
Content-Type: application/json
X-Hub-Signature-256: sha256=...

{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {...},
            "contacts": [{
              "profile": {
                "name": "Maria Silva"
              },
              "wa_id": "5511999999999"
            }],
            "messages": [{
              "from": "5511999999999",
              "id": "wamid.HBgNNT...",
              "timestamp": "1699012345",
              "type": "text",
              "text": {
                "body": "Olá, preciso de ajuda"
              }
            }]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Response 200:**
```
EVENT_RECEIVED
```

---

## 🤖 N8N INTEGRATION

### POST /api/n8n/send-message
Enviar mensagem via n8n (requer API Key).

**Request:**
```http
POST /api/n8n/send-message
Content-Type: application/json
X-API-Key: sua_api_key_aqui

{
  "phoneNumber": "5511999999999",
  "message": "Olá! Seu check-in foi confirmado para amanhã às 14h.",
  "priority": "HIGH"
}
```

**Response 200:**
```json
{
  "success": true,
  "conversationId": "uuid",
  "messageId": "uuid",
  "queued": true,
  "estimatedDelivery": "2025-11-03T11:01:00Z"
}
```

**Errors:**
- `401` - API Key inválida
- `400` - Dados inválidos
- `429` - Rate limit excedido

---

### POST /api/n8n/send-template
Enviar template pré-aprovado (necessário para iniciar conversa após 24h).

**Request:**
```http
POST /api/n8n/send-template
Content-Type: application/json
X-API-Key: sua_api_key_aqui

{
  "phoneNumber": "5511999999999",
  "templateName": "reserva_confirmada",
  "templateLanguage": "pt_BR",
  "parameters": [
    "João Silva",
    "15/11/2025",
    "14:00"
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "messageId": "uuid"
}
```

**Template deve estar aprovado pela Meta no Business Manager!**

---

## 📊 DASHBOARD / ANALYTICS (Futuro)

### GET /api/analytics/overview

**Response 200:**
```json
{
  "today": {
    "conversations": 45,
    "messages": 234,
    "avgResponseTime": 120
  },
  "week": {
    "conversations": 312,
    "messages": 1543,
    "closedConversations": 289
  }
}
```

---

## 🚨 CÓDIGOS DE ERRO

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |

**Formato de Erro:**
```json
{
  "error": "Mensagem de erro amigável",
  "code": "ERROR_CODE",
  "details": {
    "field": "email",
    "message": "Email inválido"
  }
}
```

---

## 📝 RATE LIMITS

| Endpoint | Limite |
|----------|--------|
| Login | 5 req/15min por IP |
| API Geral | 100 req/min por usuário |
| Webhooks | Ilimitado (WhatsApp) |
| N8N | 1000 req/hora por API Key |

---

## 🔄 WEBSOCKET EVENTS

### Conectar

```typescript
import io from 'socket.io-client';

const socket = io('wss://api.seudominio.com', {
  auth: {
    token: 'seu_jwt_token'
  }
});

socket.on('connect', () => {
  console.log('✅ Conectado');

  // Entrar em conversas específicas
  socket.emit('join_conversations', ['uuid-1', 'uuid-2']);
});
```

### Eventos Recebidos

```typescript
// Nova mensagem
socket.on('new_message', (data) => {
  console.log('Nova mensagem:', data);
  // {
  //   conversationId: 'uuid',
  //   message: { id, content, ... }
  // }
});

// Conversa atualizada
socket.on('conversation_updated', (data) => {
  console.log('Conversa atualizada:', data);
  // {
  //   conversationId: 'uuid',
  //   updates: { status: 'CLOSED', ... }
  // }
});

// Usuário digitando
socket.on('user_typing', (data) => {
  console.log('Digitando:', data);
  // {
  //   userId: 'uuid',
  //   conversationId: 'uuid'
  // }
});

// Status de mensagem atualizado
socket.on('message_status_update', (data) => {
  console.log('Status:', data);
  // {
  //   messageId: 'uuid',
  //   status: 'READ'
  // }
});
```

### Eventos Emitidos

```typescript
// Notificar que está digitando
socket.emit('typing', conversationId);

// Sair de uma conversa
socket.emit('leave_conversation', conversationId);
```

---

**Documentação completa da API! 🎯**

Use Postman, Insomnia ou Thunder Client para testar os endpoints.
