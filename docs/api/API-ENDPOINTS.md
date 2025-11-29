# 📚 API Endpoints - CRM WhatsApp SaaS

**Versão:** 2.0.0
**Data:** 12/11/2025
**Base URL:** `http://localhost:3001` (dev) ou `https://api.seudominio.com` (prod)

---

## 🔐 Autenticação

Todos os endpoints (exceto `/auth/*` e `/webhooks/*`) requerem:
- **Header:** `Authorization: Bearer {JWT_TOKEN}`
- **Header:** `X-Tenant-Slug: {TENANT_SLUG}`

---

## 📋 Índice

1. [Autenticação](#autenticação)
2. [Conversas](#conversas)
3. [Mensagens](#mensagens)
4. [Webhooks](#webhooks)
5. [WebSocket](#websocket)

---

## 🔐 Autenticação

### POST /auth/login

Login de usuário.

**Body:**
```json
{
  "email": "admin@hotel.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "user-123",
    "email": "admin@hotel.com",
    "name": "Admin",
    "role": "ADMIN",
    "tenantId": "tenant-abc"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tenant": {
    "id": "tenant-abc",
    "slug": "hotel-abc",
    "name": "Hotel ABC"
  }
}
```

---

### POST /auth/register

Registro de novo tenant + primeiro usuário (admin).

**Body:**
```json
{
  "tenantName": "Hotel ABC",
  "tenantSlug": "hotel-abc",
  "userName": "Admin",
  "email": "admin@hotel.com",
  "password": "senha123"
}
```

**Response 201:**
```json
{
  "user": { ... },
  "token": "...",
  "tenant": { ... }
}
```

---

## 💬 Conversas

### GET /api/conversations

Listar conversas (com filtros e paginação).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Query Params:**
- `status` (opcional): `OPEN`, `IN_PROGRESS`, `WAITING`, `CLOSED`
- `priority` (opcional): `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `assignedToId` (opcional): ID do atendente
- `search` (opcional): buscar por nome ou telefone
- `page` (opcional, default: 1)
- `limit` (opcional, default: 20, max: 100)

**Response 200:**
```json
{
  "data": [
    {
      "id": "conv-123",
      "tenantId": "tenant-abc",
      "contactId": "contact-456",
      "contact": {
        "id": "contact-456",
        "phoneNumber": "5511999999999",
        "name": "João Silva",
        "profilePictureUrl": null
      },
      "status": "OPEN",
      "priority": "MEDIUM",
      "assignedToId": null,
      "assignedTo": null,
      "tags": [],
      "lastMessageAt": "2025-11-12T10:30:00.000Z",
      "closedAt": null,
      "lastMessage": {
        "id": "msg-789",
        "content": "Olá, gostaria de fazer uma reserva",
        "direction": "INBOUND",
        "type": "TEXT",
        "timestamp": "2025-11-12T10:30:00.000Z"
      },
      "unreadCount": 1
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

Buscar conversa por ID.

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Response 200:**
```json
{
  "id": "conv-123",
  "tenantId": "tenant-abc",
  "contactId": "contact-456",
  "contact": {
    "id": "contact-456",
    "phoneNumber": "5511999999999",
    "name": "João Silva",
    "email": null,
    "profilePictureUrl": null,
    "createdAt": "2025-11-10T08:00:00.000Z"
  },
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "assignedToId": "user-123",
  "assignedTo": {
    "id": "user-123",
    "name": "Maria Atendente",
    "email": "maria@hotel.com"
  },
  "tags": [
    {
      "id": "tag-1",
      "name": "Reserva",
      "color": "#4CAF50"
    }
  ],
  "lastMessageAt": "2025-11-12T10:35:00.000Z",
  "closedAt": null,
  "createdAt": "2025-11-10T08:00:00.000Z"
}
```

---

### PATCH /api/conversations/:id

Atualizar conversa (status, prioridade, tags, atribuição).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Body (todos os campos são opcionais):**
```json
{
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "assignedToId": "user-123",
  "tagIds": ["tag-1", "tag-2"]
}
```

**Response 200:**
```json
{
  "id": "conv-123",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "assignedToId": "user-123",
  // ... resto dos dados
}
```

---

### POST /api/conversations/:id/assign

Atribuir conversa a um atendente.

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Body:**
```json
{
  "userId": "user-123"
}
```

**Response 200:**
```json
{
  "id": "conv-123",
  "assignedToId": "user-123",
  "assignedTo": {
    "id": "user-123",
    "name": "Maria Atendente",
    "email": "maria@hotel.com"
  },
  // ... resto dos dados
}
```

---

### POST /api/conversations/:id/close

Fechar conversa.

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Response 200:**
```json
{
  "id": "conv-123",
  "status": "CLOSED",
  "closedAt": "2025-11-12T10:40:00.000Z",
  // ... resto dos dados
}
```

---

## 📨 Mensagens

### GET /api/conversations/:conversationId/messages

Listar mensagens de uma conversa (com paginação por cursor).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Query Params:**
- `limit` (opcional, default: 50, max: 100)
- `before` (opcional): ID da mensagem (paginação)
- `after` (opcional): ID da mensagem (paginação)

**Response 200:**
```json
{
  "data": [
    {
      "id": "msg-789",
      "whatsappMessageId": "wamid.HBgNNTU...",
      "direction": "INBOUND",
      "type": "TEXT",
      "content": "Olá, gostaria de fazer uma reserva",
      "metadata": null,
      "status": "DELIVERED",
      "sentById": null,
      "timestamp": "2025-11-12T10:30:00.000Z",
      "createdAt": "2025-11-12T10:30:05.000Z"
    },
    {
      "id": "msg-790",
      "whatsappMessageId": "wamid.HBgNNTU...",
      "direction": "OUTBOUND",
      "type": "TEXT",
      "content": "Olá João! Como posso ajudá-lo?",
      "metadata": null,
      "status": "READ",
      "sentById": "user-123",
      "timestamp": "2025-11-12T10:31:00.000Z",
      "createdAt": "2025-11-12T10:31:02.000Z"
    }
  ],
  "hasMore": true,
  "nextCursor": "msg-788"
}
```

---

### POST /api/messages

Enviar mensagem de texto ou mídia (assíncrono via fila).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Body (Texto):**
```json
{
  "conversationId": "conv-123",
  "type": "TEXT",
  "content": "Olá! Como posso ajudá-lo?"
}
```

**Body (Imagem):**
```json
{
  "conversationId": "conv-123",
  "type": "IMAGE",
  "content": "https://cdn.exemplo.com/foto.jpg",
  "metadata": {
    "caption": "Foto do quarto disponível"
  }
}
```

**Response 201:**
```json
{
  "id": "msg-791",
  "whatsappMessageId": null,
  "direction": "OUTBOUND",
  "type": "TEXT",
  "content": "Olá! Como posso ajudá-lo?",
  "status": "SENT",
  "sentById": "user-123",
  "timestamp": "2025-11-12T10:35:00.000Z",
  "createdAt": "2025-11-12T10:35:01.000Z"
}
```

**⚠️ Nota:** `whatsappMessageId` será preenchido pelo worker após envio bem-sucedido.

---

### POST /api/messages/template

Enviar template message (assíncrono via fila).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Body:**
```json
{
  "conversationId": "conv-123",
  "templateName": "reserva_confirmada",
  "parameters": ["João Silva", "15", "dezembro", "14:00"],
  "languageCode": "pt_BR"
}
```

**Response 201:**
```json
{
  "id": "msg-792",
  "type": "TEMPLATE",
  "content": "Template: reserva_confirmada",
  "metadata": {
    "templateName": "reserva_confirmada",
    "parameters": ["João Silva", "15", "dezembro", "14:00"],
    "languageCode": "pt_BR"
  },
  "status": "SENT",
  // ... resto dos dados
}
```

---

### POST /api/messages/buttons

Enviar mensagem interativa com botões (NOVO no V2).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Body:**
```json
{
  "conversationId": "conv-123",
  "bodyText": "Escolha uma opção:",
  "buttons": [
    { "id": "opt1", "title": "Nova Reserva" },
    { "id": "opt2", "title": "Ver Reservas" },
    { "id": "opt3", "title": "Falar com Atendente" }
  ],
  "headerText": "Menu Principal",
  "footerText": "Disponível 24/7"
}
```

**Limites:**
- Mínimo 1, máximo 3 botões
- Título do botão: máximo 20 caracteres
- Header/Footer: máximo 60 caracteres

**Response 201:**
```json
{
  "id": "msg-793",
  "type": "INTERACTIVE",
  "content": "Escolha uma opção:",
  "metadata": {
    "interactiveType": "button",
    "buttons": [...],
    "headerText": "Menu Principal",
    "footerText": "Disponível 24/7"
  },
  "status": "SENT",
  // ... resto dos dados
}
```

---

### POST /api/messages/list

Enviar mensagem interativa com lista (NOVO no V2).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Body:**
```json
{
  "conversationId": "conv-123",
  "bodyText": "Escolha o tipo de quarto:",
  "buttonText": "Ver quartos",
  "sections": [
    {
      "title": "Quartos Standard",
      "rows": [
        {
          "id": "quarto_single",
          "title": "Single",
          "description": "Cama de solteiro - R$ 150/noite"
        },
        {
          "id": "quarto_double",
          "title": "Double",
          "description": "Cama de casal - R$ 200/noite"
        }
      ]
    },
    {
      "title": "Quartos Premium",
      "rows": [
        {
          "id": "quarto_suite",
          "title": "Suite Master",
          "description": "Cama king + sala - R$ 350/noite"
        }
      ]
    }
  ]
}
```

**Limites:**
- Máximo 10 itens total
- Título do item: máximo 24 caracteres
- Descrição: máximo 72 caracteres
- Button text: máximo 20 caracteres

**Response 201:**
```json
{
  "id": "msg-794",
  "type": "INTERACTIVE",
  "content": "Escolha o tipo de quarto:",
  "metadata": {
    "interactiveType": "list",
    "buttonText": "Ver quartos",
    "sections": [...]
  },
  "status": "SENT",
  // ... resto dos dados
}
```

---

### POST /api/messages/:id/read

Marcar mensagem como lida.

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Response 204:** No Content

---

### GET /api/messages/search

Buscar mensagens por texto (full-text search).

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Query Params:**
- `query` (obrigatório): texto a buscar
- `conversationId` (opcional): filtrar por conversa
- `limit` (opcional, default: 50, max: 100)

**Response 200:**
```json
{
  "data": [
    {
      "id": "msg-789",
      "conversationId": "conv-123",
      "direction": "INBOUND",
      "type": "TEXT",
      "content": "Olá, gostaria de fazer uma reserva",
      "timestamp": "2025-11-12T10:30:00.000Z",
      "conversation": {
        "id": "conv-123",
        "contact": {
          "id": "contact-456",
          "name": "João Silva",
          "phoneNumber": "5511999999999"
        }
      }
    }
  ],
  "count": 1
}
```

---

### GET /api/conversations/:conversationId/stats

Estatísticas de mensagens de uma conversa.

**Headers:**
- `Authorization: Bearer {token}`
- `X-Tenant-Slug: hotel-abc`

**Response 200:**
```json
{
  "total": 25,
  "byDirection": {
    "INBOUND": 12,
    "OUTBOUND": 13
  },
  "byStatus": {
    "SENT": 5,
    "DELIVERED": 6,
    "READ": 12,
    "FAILED": 2
  }
}
```

---

## 🔗 Webhooks

### GET /webhooks/whatsapp

Verificação do webhook (Meta verification).

**Query Params:**
- `hub.mode`: deve ser "subscribe"
- `hub.verify_token`: token configurado no tenant
- `hub.challenge`: string a ser retornada

**Response 200:** Retorna o valor de `hub.challenge`

---

### POST /webhooks/whatsapp

Receber eventos do WhatsApp.

**Headers:**
- `X-Hub-Signature-256`: HMAC SHA256 do payload
- `X-Tenant-Slug`: slug do tenant

**Body:** (Exemplo de mensagem recebida)
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
              "display_phone_number": "15551234567",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": {
                  "name": "João Silva"
                },
                "wa_id": "5511999999999"
              }
            ],
            "messages": [
              {
                "from": "5511999999999",
                "id": "wamid.HBgNNTU1...",
                "timestamp": "1699881234",
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

**Response 200:** `EVENT_RECEIVED`

**⚠️ Nota:** Webhook processa assincronamente via Bull queues. Response é sempre 200 OK em < 100ms.

---

## 🔌 WebSocket (Socket.io)

### Conexão

**URL:** `ws://localhost:3001` (dev) ou `wss://api.seudominio.com` (prod)

**Autenticação:**
```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'SEU_JWT_TOKEN' // Ou no header Authorization
  },
  transports: ['websocket', 'polling']
});
```

---

### Eventos do Cliente → Servidor

#### `conversation:join`

Entrar em uma conversa para receber atualizações em tempo real.

```javascript
socket.emit('conversation:join', 'conv-123');

// Recebe confirmação:
socket.on('conversation:joined', (data) => {
  console.log('Joined conversation:', data.conversationId);
});
```

---

#### `conversation:leave`

Sair de uma conversa.

```javascript
socket.emit('conversation:leave', 'conv-123');

// Recebe confirmação:
socket.on('conversation:left', (data) => {
  console.log('Left conversation:', data.conversationId);
});
```

---

#### `conversation:typing`

Indicar que o atendente está digitando.

```javascript
socket.emit('conversation:typing', {
  conversationId: 'conv-123',
  isTyping: true
});

// Outros atendentes na mesma conversa recebem:
socket.on('conversation:typing', (data) => {
  console.log(`${data.userName} is typing in ${data.conversationId}:`, data.isTyping);
});
```

---

#### `messages:mark-read`

Marcar mensagens como lidas.

```javascript
socket.emit('messages:mark-read', {
  messageIds: ['msg-789', 'msg-790']
});

// Recebe confirmação:
socket.on('messages:marked-read', (data) => {
  console.log('Messages marked as read:', data.messageIds);
});
```

---

#### `ping`

Keep-alive.

```javascript
socket.emit('ping');

socket.on('pong', () => {
  console.log('Server is alive');
});
```

---

### Eventos do Servidor → Cliente

#### `message:new`

Nova mensagem recebida (de cliente ou atendente).

```javascript
socket.on('message:new', (data) => {
  console.log('New message:', data);
  // {
  //   conversationId: 'conv-123',
  //   message: {
  //     id: 'msg-791',
  //     whatsappMessageId: 'wamid.HBgNNTU...',
  //     direction: 'INBOUND',
  //     type: 'TEXT',
  //     content: 'Olá!',
  //     metadata: null,
  //     status: 'DELIVERED',
  //     timestamp: '2025-11-12T10:35:00.000Z',
  //     contact: {
  //       id: 'contact-456',
  //       phoneNumber: '5511999999999',
  //       name: 'João Silva'
  //     }
  //   }
  // }
});
```

---

#### `message:status-update`

Status de mensagem atualizado (SENT → DELIVERED → READ).

```javascript
socket.on('message:status-update', (data) => {
  console.log('Message status updated:', data);
  // {
  //   conversationId: 'conv-123',
  //   messageId: 'msg-790',
  //   status: 'READ'
  // }
});
```

---

#### `conversation:new`

Nova conversa criada (primeiro contato de um cliente).

```javascript
socket.on('conversation:new', (data) => {
  console.log('New conversation:', data.conversation);
});
```

---

#### `conversation:updated`

Conversa atualizada (status, prioridade, atribuição, etc.).

```javascript
socket.on('conversation:updated', (data) => {
  console.log('Conversation updated:', data);
  // {
  //   conversationId: 'conv-123',
  //   updates: {
  //     status: 'IN_PROGRESS',
  //     assignedToId: 'user-123'
  //   }
  // }

  // OU (quando há nova mensagem):
  // {
  //   conversationId: 'conv-123',
  //   lastMessage: { ... },
  //   lastMessageAt: '2025-11-12T10:35:00.000Z'
  // }
});
```

---

#### `notification`

Notificação genérica para o usuário.

```javascript
socket.on('notification', (data) => {
  console.log('Notification:', data);
  // Estrutura livre dependendo do tipo de notificação
});
```

---

#### `error`

Erro do WebSocket.

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

---

### Exemplo Completo (Frontend)

```javascript
import io from 'socket.io-client';

// Conectar
const socket = io('http://localhost:3001', {
  auth: {
    token: localStorage.getItem('jwt_token')
  },
  transports: ['websocket', 'polling']
});

// Eventos de conexão
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket');

  // Entrar na conversa atual
  socket.emit('conversation:join', 'conv-123');
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

// Escutar nova mensagem
socket.on('message:new', (data) => {
  // Adicionar mensagem na UI
  addMessageToUI(data.message);

  // Tocar som de notificação
  playNotificationSound();

  // Marcar como lida se a conversa está aberta
  if (isConversationOpen(data.conversationId)) {
    socket.emit('messages:mark-read', {
      messageIds: [data.message.id]
    });
  }
});

// Escutar status update
socket.on('message:status-update', (data) => {
  // Atualizar UI (mostrar checkmark duplo quando READ)
  updateMessageStatus(data.messageId, data.status);
});

// Typing indicator
let typingTimeout;
function onUserTyping() {
  socket.emit('conversation:typing', {
    conversationId: 'conv-123',
    isTyping: true
  });

  // Limpar após 3 segundos
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('conversation:typing', {
      conversationId: 'conv-123',
      isTyping: false
    });
  }, 3000);
}

// Receber typing de outros
socket.on('conversation:typing', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.userName);
  } else {
    hideTypingIndicator(data.userName);
  }
});

// Cleanup ao sair
window.addEventListener('beforeunload', () => {
  socket.emit('conversation:leave', 'conv-123');
  socket.disconnect();
});
```

---

## 🔍 Códigos de Status HTTP

| Código | Significado |
|--------|-------------|
| **200** | OK - Sucesso |
| **201** | Created - Recurso criado |
| **204** | No Content - Sucesso sem retorno |
| **400** | Bad Request - Erro de validação |
| **401** | Unauthorized - Token inválido/ausente |
| **403** | Forbidden - Sem permissão |
| **404** | Not Found - Recurso não encontrado |
| **429** | Too Many Requests - Rate limit |
| **500** | Internal Server Error - Erro interno |

---

## ⚠️ Códigos de Erro WhatsApp API

| Código | Erro | Solução |
|--------|------|---------|
| **80007** | Rate limit hit | Aguardar alguns segundos |
| **131026** | Message undeliverable | Número bloqueou ou não existe |
| **131031** | Phone not WhatsApp | Número não tem WhatsApp |
| **131047** | Re-engagement required | Usar template (fora janela 24h) |
| **133015** | Template does not exist | Verificar nome do template |
| **133016** | Template paused | Ativar template na Meta |
| **132000** | Template param mismatch | Verificar número de parâmetros |

---

**Última atualização:** 12/11/2025
**Versão:** 2.0.0
