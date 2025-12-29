# API REST - Bot Reserva Hotéis

## Versão: 1.0.0

### Base URL
```
https://api.botreserva.com.br/api
```

### Autenticação
A API utiliza JWT (JSON Web Tokens) para autenticação. Tokens de acesso expiram em 8 horas e tokens de refresh em 7 dias.

**Header de Autenticação:**
```
Authorization: Bearer {access_token}
```

### Autenticação N8N (Automações)
Para endpoints da integração N8N, utilizar API Key no header:
```
X-API-Key: {tenant_slug}:{whatsapp_phone_number_id}
```

**Exemplo:**
```
X-API-Key: hoteis-reserva:123456789012345
```

### Papéis de Usuário
- `SUPER_ADMIN` - Acesso total ao sistema (multi-tenant)
- `ADMIN` - Gerenciamento completo do tenant
- `MANAGER` - Visualização e relatórios
- `ATTENDANT` - Atendimento de conversas

### Códigos de Status HTTP
- `200` - Sucesso
- `201` - Criado com sucesso
- `204` - Sucesso sem conteúdo
- `400` - Requisição inválida
- `401` - Não autenticado
- `403` - Acesso negado
- `404` - Recurso não encontrado
- `409` - Conflito
- `422` - Entidade não processável
- `429` - Rate limit excedido
- `500` - Erro interno do servidor

---

## 1. Autenticação

### 1.1 Login

**POST** `/auth/login`

Autentica um usuário e retorna tokens de acesso e refresh.

**Acesso:** Público

**Rate Limit:** 5 requisições / 15 minutos (por IP)

**Request Body:**
```json
{
  "email": "atendente@hotel.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "atendente@hotel.com",
      "name": "João Silva",
      "role": "ATTENDANT",
      "status": "ACTIVE",
      "tenantId": "uuid",
      "hotelUnit": "Campos do Jordão"
    }
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email ou senha inválidos"
  }
}
```

---

### 1.2 Refresh Token

**POST** `/auth/refresh`

Gera um novo access token usando o refresh token.

**Acesso:** Público

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "Token de refresh inválido ou expirado"
  }
}
```

---

### 1.3 Registrar Usuário

**POST** `/auth/register`

Registra um novo usuário no tenant.

**Acesso:** ADMIN, SUPER_ADMIN

**Request Body:**
```json
{
  "email": "novo@hotel.com",
  "password": "senha123",
  "name": "Maria Santos",
  "role": "ATTENDANT",
  "hotelUnit": "Ilhabela"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "novo@hotel.com",
    "name": "Maria Santos",
    "role": "ATTENDANT",
    "status": "ACTIVE",
    "tenantId": "uuid",
    "hotelUnit": "Ilhabela",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

---

### 1.4 Alterar Senha

**POST** `/auth/change-password`

Altera a senha do usuário autenticado.

**Acesso:** Autenticado

**Request Body:**
```json
{
  "currentPassword": "senhaAtual123",
  "newPassword": "novaSenha456"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Senha alterada com sucesso"
}
```

---

### 1.5 Obter Usuário Atual

**GET** `/auth/me`

Obtém dados do usuário autenticado.

**Acesso:** Autenticado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "atendente@hotel.com",
    "name": "João Silva",
    "role": "ATTENDANT",
    "status": "ACTIVE",
    "tenantId": "uuid",
    "hotelUnit": "Campos do Jordão",
    "tenant": {
      "id": "uuid",
      "name": "Hotéis Reserva",
      "slug": "hoteis-reserva"
    }
  }
}
```

---

## 2. Conversas

### 2.1 Listar Conversas

**GET** `/conversations`

Lista conversas do tenant com filtros e paginação (formato Kanban).

**Acesso:** Autenticado

**Query Parameters:**
- `page` (number, default: 1) - Número da página
- `limit` (number, default: 50) - Itens por página
- `status` (string, optional) - Filtrar por status (BOT_HANDLING, OPEN, IN_PROGRESS, WAITING, CLOSED)
- `hotelUnit` (string, optional) - Filtrar por unidade hoteleira
- `assignedToId` (string, optional) - Filtrar por atendente atribuído
- `search` (string, optional) - Buscar por nome ou telefone do contato
- `priority` (string, optional) - Filtrar por prioridade (LOW, MEDIUM, HIGH, URGENT)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "uuid",
        "status": "OPEN",
        "priority": "MEDIUM",
        "iaLocked": true,
        "iaLockedAt": "2025-01-15T10:30:00Z",
        "hotelUnit": "Campos do Jordão",
        "lastMessageAt": "2025-01-15T14:20:00Z",
        "createdAt": "2025-01-15T10:30:00Z",
        "contact": {
          "id": "uuid",
          "name": "Maria Santos",
          "phoneNumber": "5511999999999",
          "profilePictureUrl": "https://..."
        },
        "assignedTo": {
          "id": "uuid",
          "name": "João Silva"
        },
        "_count": {
          "messages": 15
        },
        "unreadCount": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 125,
      "totalPages": 3
    }
  }
}
```

---

### 2.2 Obter Conversa

**GET** `/conversations/:id`

Obtém detalhes de uma conversa específica.

**Acesso:** Autenticado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "iaLocked": true,
    "iaLockedAt": "2025-01-15T10:30:00Z",
    "iaLockedBy": "uuid",
    "hotelUnit": "Campos do Jordão",
    "lastMessageAt": "2025-01-15T14:20:00Z",
    "metadata": {
      "checkIn": "2025-01-20",
      "checkOut": "2025-01-25",
      "roomType": "Suite Premium"
    },
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T14:20:00Z",
    "contact": {
      "id": "uuid",
      "name": "Maria Santos",
      "phoneNumber": "5511999999999",
      "email": "maria@email.com",
      "profilePictureUrl": "https://..."
    },
    "assignedTo": {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@hotel.com"
    },
    "tags": [
      {
        "id": "uuid",
        "name": "VIP",
        "color": "#FFD700"
      }
    ],
    "escalations": [
      {
        "id": "uuid",
        "reason": "USER_REQUESTED",
        "reasonDetail": "Cliente pediu para falar com atendente",
        "status": "RESOLVED",
        "createdAt": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

### 2.3 Atualizar Conversa

**PATCH** `/conversations/:id`

Atualiza informações de uma conversa.

**Acesso:** Autenticado

**Request Body:**
```json
{
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "hotelUnit": "Ilhabela",
  "metadata": {
    "checkIn": "2025-01-20",
    "checkOut": "2025-01-25"
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_PROGRESS",
    "priority": "HIGH",
    "hotelUnit": "Ilhabela",
    "updatedAt": "2025-01-15T15:00:00Z"
  }
}
```

---

### 2.4 Atribuir Conversa

**POST** `/conversations/:id/assign`

Atribui uma conversa a um atendente e trava a IA.

**Acesso:** Autenticado

**Request Body:**
```json
{
  "assignedToId": "uuid"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "assignedToId": "uuid",
    "iaLocked": true,
    "iaLockedAt": "2025-01-15T15:00:00Z",
    "iaLockedBy": "uuid",
    "status": "IN_PROGRESS",
    "updatedAt": "2025-01-15T15:00:00Z"
  }
}
```

---

### 2.5 Fechar Conversa

**POST** `/conversations/:id/close`

Fecha uma conversa e destrava a IA.

**Acesso:** Autenticado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CLOSED",
    "iaLocked": false,
    "closedAt": "2025-01-15T16:00:00Z",
    "updatedAt": "2025-01-15T16:00:00Z"
  }
}
```

---

### 2.6 Estatísticas de Conversas

**GET** `/conversations/stats`

Obtém estatísticas do dashboard.

**Acesso:** Autenticado

**Query Parameters:**
- `hotelUnit` (string, optional) - Filtrar por unidade

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total": 1250,
    "byStatus": {
      "BOT_HANDLING": 45,
      "OPEN": 78,
      "IN_PROGRESS": 23,
      "WAITING": 15,
      "CLOSED": 1089
    },
    "byPriority": {
      "LOW": 300,
      "MEDIUM": 550,
      "HIGH": 320,
      "URGENT": 80
    },
    "byHotelUnit": {
      "Campos do Jordão": 450,
      "Ilhabela": 380,
      "Camburi": 280,
      "Santo Antônio do Pinhal": 140
    },
    "averageResponseTime": 180,
    "todayNew": 25,
    "todayClosed": 18
  }
}
```

---

### 2.7 Marcar Conversa como Lida

**PATCH** `/conversations/:id/read`

Marca todas as mensagens da conversa como lidas.

**Acesso:** Autenticado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "messagesMarked": 5
  }
}
```

---

## 3. Mensagens

### 3.1 Listar Mensagens

**GET** `/messages`

Lista mensagens de uma conversa.

**Acesso:** Autenticado

**Query Parameters:**
- `conversationId` (string, required) - ID da conversa
- `page` (number, default: 1) - Número da página
- `limit` (number, default: 50) - Itens por página
- `before` (string, optional) - Cursor para paginação (timestamp)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "conversationId": "uuid",
        "whatsappMessageId": "wamid.xxx",
        "type": "TEXT",
        "direction": "INBOUND",
        "content": "Olá, gostaria de fazer uma reserva",
        "status": "READ",
        "timestamp": "2025-01-15T10:30:00Z",
        "metadata": {},
        "contact": {
          "name": "Maria Santos",
          "phoneNumber": "5511999999999"
        }
      },
      {
        "id": "uuid",
        "conversationId": "uuid",
        "whatsappMessageId": "wamid.yyy",
        "type": "INTERACTIVE",
        "direction": "OUTBOUND",
        "content": "Olá Maria! Escolha uma opção:",
        "status": "DELIVERED",
        "timestamp": "2025-01-15T10:30:05Z",
        "metadata": {
          "buttons": [
            {"id": "reserva", "title": "Fazer Reserva"},
            {"id": "info", "title": "Informações"},
            {"id": "falar", "title": "Falar com Atendente"}
          ]
        },
        "sentBy": {
          "id": "uuid",
          "name": "Bot IA"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 125,
      "totalPages": 3,
      "hasMore": true
    }
  }
}
```

---

### 3.2 Enviar Mensagem de Texto

**POST** `/messages/send-text`

Envia mensagem de texto para o cliente.

**Acesso:** Autenticado

**Request Body:**
```json
{
  "conversationId": "uuid",
  "content": "Olá! Como posso ajudar?"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "whatsappMessageId": "wamid.xxx",
    "type": "TEXT",
    "direction": "OUTBOUND",
    "content": "Olá! Como posso ajudar?",
    "status": "SENT",
    "timestamp": "2025-01-15T10:30:00Z",
    "sentById": "uuid"
  }
}
```

---

### 3.3 Enviar Mídia

**POST** `/messages/send-media`

Envia imagem, vídeo, áudio ou documento.

**Acesso:** Autenticado

**Request Body:**
```json
{
  "conversationId": "uuid",
  "type": "IMAGE",
  "mediaUrl": "https://cdn.hotel.com/quarto.jpg",
  "caption": "Nosso quarto Standard"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "whatsappMessageId": "wamid.xxx",
    "type": "IMAGE",
    "direction": "OUTBOUND",
    "content": "Nosso quarto Standard",
    "mediaUrl": "https://cdn.hotel.com/quarto.jpg",
    "status": "SENT",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

---

### 3.4 Enviar Botões Interativos

**POST** `/messages/send-buttons`

Envia mensagem com botões clicáveis (máx 3).

**Acesso:** Autenticado

**Request Body:**
```json
{
  "conversationId": "uuid",
  "body": "Escolha uma opção:",
  "buttons": [
    {"id": "reserva", "title": "Fazer Reserva"},
    {"id": "info", "title": "Informações"},
    {"id": "atendente", "title": "Falar com Atendente"}
  ],
  "header": "Menu Principal",
  "footer": "Hotéis Reserva"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "whatsappMessageId": "wamid.xxx",
    "type": "INTERACTIVE",
    "status": "SENT"
  }
}
```

---

### 3.5 Enviar Lista Interativa

**POST** `/messages/send-list`

Envia mensagem com lista de opções (máx 10 itens).

**Acesso:** Autenticado

**Request Body:**
```json
{
  "conversationId": "uuid",
  "body": "Selecione um tipo de quarto:",
  "buttonText": "Ver Quartos",
  "sections": [
    {
      "title": "Quartos Disponíveis",
      "rows": [
        {"id": "standard", "title": "Standard", "description": "R$ 350/noite"},
        {"id": "superior", "title": "Superior", "description": "R$ 500/noite"},
        {"id": "suite", "title": "Suíte Premium", "description": "R$ 850/noite"}
      ]
    }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "whatsappMessageId": "wamid.xxx",
    "type": "INTERACTIVE",
    "status": "SENT"
  }
}
```

---

### 3.6 Marcar como Lida

**POST** `/messages/:id/read`

Marca uma mensagem específica como lida.

**Acesso:** Autenticado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "READ",
    "readAt": "2025-01-15T10:35:00Z"
  }
}
```

---

### 3.7 Buscar Mensagens

**GET** `/messages/search`

Busca mensagens por conteúdo.

**Acesso:** Autenticado

**Query Parameters:**
- `q` (string, required) - Termo de busca
- `conversationId` (string, optional) - Filtrar por conversa
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "conversationId": "uuid",
        "content": "reserva para o dia 20",
        "timestamp": "2025-01-15T10:30:00Z",
        "contact": {
          "name": "Maria Santos"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

---

## 4. Contatos

### 4.1 Listar Contatos

**GET** `/contacts`

Lista contatos do tenant.

**Acesso:** Autenticado

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `search` (string, optional) - Buscar por nome ou telefone

**Response 200:**
```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "uuid",
        "name": "Maria Santos",
        "phoneNumber": "5511999999999",
        "email": "maria@email.com",
        "profilePictureUrl": "https://...",
        "isBlocked": false,
        "metadata": {
          "totalReservations": 3,
          "lastCheckOut": "2024-12-15"
        },
        "createdAt": "2025-01-15T10:30:00Z",
        "_count": {
          "conversations": 5
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 250
    }
  }
}
```

---

### 4.2 Obter Contato

**GET** `/contacts/:id`

Obtém detalhes de um contato.

**Acesso:** Autenticado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Maria Santos",
    "phoneNumber": "5511999999999",
    "email": "maria@email.com",
    "profilePictureUrl": "https://...",
    "isBlocked": false,
    "metadata": {
      "totalReservations": 3,
      "preferences": ["vista mar", "andar alto"]
    },
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T14:20:00Z",
    "conversations": [
      {
        "id": "uuid",
        "status": "CLOSED",
        "createdAt": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

### 4.3 Atualizar Contato

**PATCH** `/contacts/:id`

Atualiza informações de um contato.

**Acesso:** Autenticado

**Request Body:**
```json
{
  "name": "Maria Santos Silva",
  "email": "maria.silva@email.com",
  "metadata": {
    "vip": true,
    "preferences": ["vista mar", "andar alto", "café da manhã"]
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Maria Santos Silva",
    "email": "maria.silva@email.com",
    "updatedAt": "2025-01-15T15:00:00Z"
  }
}
```

---

### 4.4 Bloquear Contato

**POST** `/contacts/:id/block`

Bloqueia um contato (não recebe mais mensagens).

**Acesso:** ADMIN, MANAGER

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isBlocked": true,
    "blockedAt": "2025-01-15T15:00:00Z"
  }
}
```

---

## 5. Escalações

### 5.1 Listar Escalações

**GET** `/escalations`

Lista escalações do tenant.

**Acesso:** Autenticado

**Query Parameters:**
- `status` (string, optional) - PENDING, IN_PROGRESS, RESOLVED
- `conversationId` (string, optional)
- `page` (number, default: 1)
- `limit` (number, default: 50)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "escalations": [
      {
        "id": "uuid",
        "conversationId": "uuid",
        "reason": "USER_REQUESTED",
        "reasonDetail": "Cliente pediu para falar com gerente",
        "status": "PENDING",
        "priority": "HIGH",
        "hotelUnit": "Campos do Jordão",
        "createdAt": "2025-01-15T10:30:00Z",
        "conversation": {
          "contact": {
            "name": "Maria Santos",
            "phoneNumber": "5511999999999"
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15
    }
  }
}
```

---

### 5.2 Criar Escalação

**POST** `/escalations`

Cria uma nova escalação (manual).

**Acesso:** Autenticado

**Request Body:**
```json
{
  "conversationId": "uuid",
  "reason": "COMPLEX_QUERY",
  "reasonDetail": "Solicitação de grupo grande com requisitos especiais",
  "priority": "HIGH"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "reason": "COMPLEX_QUERY",
    "status": "PENDING",
    "priority": "HIGH",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

---

### 5.3 Atualizar Escalação

**PATCH** `/escalations/:id`

Atualiza status de uma escalação.

**Acesso:** Autenticado

**Request Body:**
```json
{
  "status": "RESOLVED",
  "resolvedById": "uuid",
  "resolution": "Reserva de grupo realizada com sucesso"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "RESOLVED",
    "resolvedAt": "2025-01-15T12:00:00Z",
    "resolvedById": "uuid"
  }
}
```

---

### 5.4 Verificar IA Lock

**GET** `/escalations/check-ia-lock`

Verifica se a IA está travada para um contato.

**Acesso:** Autenticado

**Query Parameters:**
- `phone` (string, required) - Telefone do contato

**Response 200:**
```json
{
  "success": true,
  "data": {
    "locked": true,
    "conversationId": "uuid",
    "lockedAt": "2025-01-15T10:30:00Z",
    "lockedBy": "uuid",
    "reason": "ATTENDANT_ASSIGNED"
  }
}
```

---

### 5.5 Estatísticas de Escalações

**GET** `/escalations/stats`

Obtém estatísticas de escalações.

**Acesso:** Autenticado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "pending": 12,
    "inProgress": 8,
    "resolved": 130,
    "byReason": {
      "USER_REQUESTED": 45,
      "AI_UNABLE": 30,
      "COMPLEX_QUERY": 50,
      "COMPLAINT": 25
    },
    "averageResolutionTime": 1800,
    "todayTotal": 5
  }
}
```

---

## 6. Integração N8N

### 6.1 Enviar Texto (N8N)

**POST** `/n8n/send-text`

Envia mensagem de texto via automação N8N.

**Autenticação:** X-API-Key

**Rate Limit:** 5000 requisições / minuto (por tenant)

**Request Body:**
```json
{
  "phone": "5511999999999",
  "text": "Olá! Obrigado por entrar em contato."
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "whatsappMessageId": "wamid.xxx",
    "status": "SENT"
  }
}
```

---

### 6.2 Enviar Botões (N8N)

**POST** `/n8n/send-buttons`

Envia mensagem com botões via N8N.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "phone": "5511999999999",
  "body": "Escolha uma opção:",
  "buttons": [
    {"id": "reserva", "title": "Fazer Reserva"},
    {"id": "info", "title": "Informações"},
    {"id": "atendente", "title": "Falar com Atendente"}
  ],
  "header": "Menu Principal",
  "footer": "Hotéis Reserva"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "whatsappMessageId": "wamid.xxx"
  }
}
```

---

### 6.3 Enviar Lista (N8N)

**POST** `/n8n/send-list`

Envia mensagem com lista via N8N.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "phone": "5511999999999",
  "body": "Selecione o tipo de quarto:",
  "buttonText": "Ver Quartos",
  "sections": [
    {
      "title": "Disponíveis",
      "rows": [
        {"id": "standard", "title": "Standard", "description": "R$ 350/noite"},
        {"id": "suite", "title": "Suíte", "description": "R$ 850/noite"}
      ]
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "whatsappMessageId": "wamid.xxx"
  }
}
```

---

### 6.4 Enviar Mídia (N8N)

**POST** `/n8n/send-media`

Envia mídia (imagem, vídeo, áudio, documento) via N8N.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "phone": "5511999999999",
  "type": "image",
  "mediaUrl": "https://cdn.hotel.com/quarto-standard.jpg",
  "caption": "Nosso Quarto Standard com vista para o jardim"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "whatsappMessageId": "wamid.xxx"
  }
}
```

---

### 6.5 Enviar Template (N8N)

**POST** `/n8n/send-template`

Envia template pré-aprovado pela Meta.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "phone": "5511999999999",
  "templateName": "notificacao_atendente",
  "language": "pt_BR",
  "components": [
    {
      "type": "body",
      "parameters": [
        {"type": "text", "text": "Maria Santos"},
        {"type": "text", "text": "Reserva para 20/01"}
      ]
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "whatsappMessageId": "wamid.xxx"
  }
}
```

---

### 6.6 Enviar Carousel (N8N)

**POST** `/n8n/send-carousel`

Envia carousel de cards (template) via N8N.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "phone": "5511999999999",
  "templateName": "carousel_quartos_geral",
  "language": "pt_BR",
  "cards": [
    {
      "imageUrl": "https://cdn.hotel.com/standard.jpg",
      "buttonPayloads": ["detalhes_standard", "voltar_menu"]
    },
    {
      "imageUrl": "https://cdn.hotel.com/superior.jpg",
      "buttonPayloads": ["detalhes_superior", "voltar_menu"]
    },
    {
      "imageUrl": "https://cdn.hotel.com/suite.jpg",
      "buttonPayloads": ["detalhes_suite", "voltar_menu"]
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "whatsappMessageId": "wamid.xxx",
    "cardsCount": 3
  }
}
```

---

### 6.7 Escalar para Humano (N8N)

**POST** `/n8n/escalate`

Escala conversa da IA para atendente humano.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "phone": "5511999999999",
  "reason": "USER_REQUESTED",
  "reasonDetail": "Cliente pediu para falar com atendente",
  "hotelUnit": "Campos do Jordão",
  "priority": "HIGH",
  "messageHistory": [
    {"role": "user", "content": "Quero falar com atendente"},
    {"role": "assistant", "content": "Claro, vou transferir você!"}
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "escalationId": "uuid",
    "conversationId": "uuid",
    "iaLocked": true,
    "status": "PENDING"
  }
}
```

---

### 6.8 Verificar IA Lock (N8N)

**GET** `/n8n/check-ia-lock`

Verifica se IA está travada antes de responder.

**Autenticação:** X-API-Key

**Query Parameters:**
- `phone` (string, required) - Telefone do contato

**Response 200:**
```json
{
  "locked": false,
  "conversationId": "uuid"
}
```

```json
{
  "locked": true,
  "conversationId": "uuid",
  "lockedAt": "2025-01-15T10:30:00Z",
  "lockedBy": "uuid",
  "reason": "Atendente assumiu conversa"
}
```

---

### 6.9 Marcar como Lida (N8N)

**POST** `/n8n/mark-read`

Marca mensagem como lida no WhatsApp.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "messageId": "wamid.xxx"
}
```

**Response 200:**
```json
{
  "success": true
}
```

---

### 6.10 Definir Unidade Hoteleira (N8N)

**POST** `/n8n/set-hotel-unit`

Define a unidade hoteleira da conversa.

**Autenticação:** X-API-Key

**Request Body:**
```json
{
  "phone": "5511999999999",
  "hotelUnit": "Campos do Jordão"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "hotelUnit": "Campos do Jordão"
  }
}
```

---

### 6.11 Rastrear Clique (N8N)

**GET** `/n8n/track-click`

Rastreia cliques em botões de carousel/template.

**Acesso:** Público (sem autenticação)

**Query Parameters:**
- `phone` (string, required)
- `action` (string, required)
- `tenant` (string, required)

**Response 302:**
Redireciona para URL configurada ou retorna pixel 1x1.

---

## 7. Webhooks WhatsApp

### 7.1 Verificação de Webhook

**GET** `/webhooks/whatsapp`

Endpoint de verificação do webhook do Meta.

**Acesso:** Público

**Query Parameters:**
- `hub.mode` (string) - Deve ser "subscribe"
- `hub.challenge` (string) - Challenge a ser retornado
- `hub.verify_token` (string) - Token de verificação

**Response 200:**
```
{hub.challenge}
```

---

### 7.2 Receber Mensagens

**POST** `/webhooks/whatsapp`

Recebe eventos do WhatsApp (mensagens, status, etc.).

**Acesso:** Público (validado por HMAC)

**Rate Limit:** 1000 requisições / minuto

**Headers:**
```
X-Hub-Signature-256: sha256={signature}
```

**Request Body:**
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
            "messages": [
              {
                "from": "5511888888888",
                "id": "wamid.xxx",
                "timestamp": "1642267200",
                "type": "text",
                "text": {
                  "body": "Olá, quero fazer uma reserva"
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

**Response 200:**
```json
{
  "success": true
}
```

---

## 8. Usuários

### 8.1 Listar Usuários

**GET** `/users`

Lista usuários do tenant.

**Acesso:** ADMIN, SUPER_ADMIN

**Query Parameters:**
- `role` (string, optional) - Filtrar por papel
- `status` (string, optional) - Filtrar por status
- `hotelUnit` (string, optional) - Filtrar por unidade
- `page` (number, default: 1)
- `limit` (number, default: 50)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "joao@hotel.com",
        "name": "João Silva",
        "role": "ATTENDANT",
        "status": "ACTIVE",
        "hotelUnit": "Campos do Jordão",
        "createdAt": "2025-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15
    }
  }
}
```

---

### 8.2 Criar Usuário

**POST** `/users`

Cria novo usuário no tenant.

**Acesso:** ADMIN, SUPER_ADMIN

**Request Body:**
```json
{
  "email": "novo@hotel.com",
  "password": "senha123",
  "name": "Maria Santos",
  "role": "ATTENDANT",
  "hotelUnit": "Ilhabela"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "novo@hotel.com",
    "name": "Maria Santos",
    "role": "ATTENDANT",
    "status": "ACTIVE",
    "hotelUnit": "Ilhabela"
  }
}
```

---

### 8.3 Atualizar Usuário

**PATCH** `/users/:id`

Atualiza informações de um usuário.

**Acesso:** ADMIN, SUPER_ADMIN

**Request Body:**
```json
{
  "name": "Maria Santos Silva",
  "role": "MANAGER",
  "hotelUnit": "Campos do Jordão"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Maria Santos Silva",
    "role": "MANAGER",
    "hotelUnit": "Campos do Jordão",
    "updatedAt": "2025-01-15T15:00:00Z"
  }
}
```

---

### 8.4 Desativar Usuário

**PATCH** `/users/:id/status`

Ativa ou desativa um usuário.

**Acesso:** ADMIN, SUPER_ADMIN

**Request Body:**
```json
{
  "status": "INACTIVE"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "INACTIVE",
    "updatedAt": "2025-01-15T15:00:00Z"
  }
}
```

---

### 8.5 Deletar Usuário

**DELETE** `/users/:id`

Remove um usuário do sistema.

**Acesso:** SUPER_ADMIN

**Response 204:**
```
No Content
```

---

## 9. Tenants

### 9.1 Listar Tenants

**GET** `/tenants`

Lista todos os tenants (hotéis).

**Acesso:** SUPER_ADMIN

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": "uuid",
        "name": "Hotéis Reserva",
        "slug": "hoteis-reserva",
        "email": "contato@hoteisreserva.com.br",
        "status": "ACTIVE",
        "plan": "ENTERPRISE",
        "whatsappPhoneNumberId": "123456789",
        "createdAt": "2025-01-15T10:30:00Z",
        "_count": {
          "users": 15,
          "conversations": 1250
        }
      }
    ]
  }
}
```

---

### 9.2 Criar Tenant

**POST** `/tenants`

Cria novo tenant (hotel).

**Acesso:** SUPER_ADMIN

**Request Body:**
```json
{
  "name": "Novo Hotel",
  "slug": "novo-hotel",
  "email": "contato@novohotel.com.br",
  "plan": "PROFESSIONAL",
  "whatsappPhoneNumberId": "987654321",
  "whatsappBusinessAccountId": "111222333",
  "whatsappAccessToken": "EAAx...",
  "whatsappAppSecret": "abc123...",
  "n8nWebhookUrl": "https://n8n.novohotel.com.br/webhook/xxx"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Novo Hotel",
    "slug": "novo-hotel",
    "status": "ACTIVE",
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

---

### 9.3 Atualizar Tenant

**PATCH** `/tenants/:id`

Atualiza configurações do tenant.

**Acesso:** ADMIN (próprio tenant), SUPER_ADMIN

**Request Body:**
```json
{
  "name": "Hotéis Reserva Premium",
  "whatsappAccessToken": "EAAy...",
  "n8nWebhookUrl": "https://n8n.{dominio-3ian}/webhook/{tenant-id}"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Hotéis Reserva Premium",
    "updatedAt": "2025-01-15T15:00:00Z"
  }
}
```

---

### 9.4 Obter Configurações WhatsApp

**GET** `/tenants/:id/whatsapp-config`

Obtém configurações do WhatsApp (tokens parcialmente ocultos).

**Acesso:** ADMIN, SUPER_ADMIN

**Response 200:**
```json
{
  "success": true,
  "data": {
    "whatsappPhoneNumberId": "123456789",
    "whatsappBusinessAccountId": "111222333",
    "whatsappAccessToken": "EAAx...****",
    "webhookConfigured": true,
    "templateStatus": {
      "approved": 5,
      "pending": 1,
      "rejected": 0
    }
  }
}
```

---

## 10. Relatórios

### 10.1 Dashboard Geral

**GET** `/reports/dashboard`

Obtém métricas do dashboard principal.

**Acesso:** Autenticado

**Query Parameters:**
- `startDate` (string, optional) - Data inicial (ISO 8601)
- `endDate` (string, optional) - Data final (ISO 8601)
- `hotelUnit` (string, optional) - Filtrar por unidade

**Response 200:**
```json
{
  "success": true,
  "data": {
    "conversations": {
      "total": 1250,
      "new": 25,
      "closed": 18,
      "averageResponseTime": 180
    },
    "messages": {
      "total": 15000,
      "inbound": 8000,
      "outbound": 7000
    },
    "escalations": {
      "total": 150,
      "pending": 12,
      "averageResolutionTime": 1800
    },
    "byHotelUnit": [
      {
        "unit": "Campos do Jordão",
        "conversations": 450,
        "messages": 5500
      }
    ],
    "trends": [
      {
        "date": "2025-01-15",
        "conversations": 25,
        "messages": 300
      }
    ]
  }
}
```

---

### 10.2 Relatório de Atendentes

**GET** `/reports/attendants`

Obtém métricas de desempenho por atendente.

**Acesso:** ADMIN, MANAGER

**Response 200:**
```json
{
  "success": true,
  "data": {
    "attendants": [
      {
        "id": "uuid",
        "name": "João Silva",
        "hotelUnit": "Campos do Jordão",
        "conversationsHandled": 45,
        "messagesSent": 350,
        "averageResponseTime": 120,
        "escalationsResolved": 8,
        "satisfactionScore": 4.8
      }
    ]
  }
}
```

---

### 10.3 Relatório de Uso

**GET** `/reports/usage`

Obtém métricas de uso do sistema.

**Acesso:** ADMIN, SUPER_ADMIN

**Query Parameters:**
- `startDate` (string, optional)
- `endDate` (string, optional)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-01-01T00:00:00Z",
      "end": "2025-01-31T23:59:59Z"
    },
    "messages": {
      "total": 15000,
      "text": 12000,
      "image": 2000,
      "interactive": 1000
    },
    "api": {
      "requests": 50000,
      "n8nCalls": 25000,
      "webhookEvents": 15000
    },
    "storage": {
      "mediaFiles": 500,
      "totalSize": "2.5GB"
    }
  }
}
```

---

## 11. Mídia

### 11.1 Servir Mídia

**GET** `/media/:tenantId/:fileId`

Serve arquivo de mídia armazenado.

**Acesso:** Público (URLs temporárias)

**Rate Limit:** 200 requisições / minuto (por IP)

**Response 200:**
```
Binary file content
Content-Type: image/jpeg
Content-Disposition: inline; filename="quarto.jpg"
Cache-Control: public, max-age=86400
```

**Response 404:**
```json
{
  "success": false,
  "error": {
    "code": "MEDIA_NOT_FOUND",
    "message": "Arquivo não encontrado"
  }
}
```

---

## 12. Health Check

### 12.1 Status do Sistema

**GET** `/health`

Verifica status de saúde do sistema.

**Acesso:** Público

**Response 200:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "whatsapp": "healthy"
  },
  "uptime": 864000
}
```

**Response 503:**
```json
{
  "status": "unhealthy",
  "services": {
    "database": "healthy",
    "redis": "unhealthy",
    "whatsapp": "healthy"
  },
  "error": "Redis connection failed"
}
```

---

## Schemas de Dados

### Conversation
```json
{
  "id": "string (uuid)",
  "tenantId": "string (uuid)",
  "contactId": "string (uuid)",
  "assignedToId": "string (uuid) | null",
  "status": "enum (BOT_HANDLING, OPEN, IN_PROGRESS, WAITING, CLOSED)",
  "priority": "enum (LOW, MEDIUM, HIGH, URGENT)",
  "iaLocked": "boolean",
  "iaLockedAt": "string (datetime) | null",
  "iaLockedBy": "string (uuid) | null",
  "hotelUnit": "string | null",
  "lastMessageAt": "string (datetime)",
  "metadata": "object | null",
  "createdAt": "string (datetime)",
  "updatedAt": "string (datetime)"
}
```

### Message
```json
{
  "id": "string (uuid)",
  "tenantId": "string (uuid)",
  "conversationId": "string (uuid)",
  "whatsappMessageId": "string | null",
  "type": "enum (TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT, LOCATION, CONTACT, STICKER, INTERACTIVE, TEMPLATE, REACTION, UNKNOWN)",
  "direction": "enum (INBOUND, OUTBOUND)",
  "content": "string | null",
  "mediaUrl": "string | null",
  "mediaId": "string | null",
  "mimeType": "string | null",
  "status": "enum (PENDING, SENT, DELIVERED, READ, FAILED)",
  "timestamp": "string (datetime)",
  "metadata": "object | null",
  "sentById": "string (uuid) | null",
  "createdAt": "string (datetime)"
}
```

### Contact
```json
{
  "id": "string (uuid)",
  "tenantId": "string (uuid)",
  "phoneNumber": "string",
  "name": "string | null",
  "email": "string | null",
  "profilePictureUrl": "string | null",
  "isBlocked": "boolean",
  "metadata": "object | null",
  "createdAt": "string (datetime)",
  "updatedAt": "string (datetime)"
}
```

### Escalation
```json
{
  "id": "string (uuid)",
  "tenantId": "string (uuid)",
  "conversationId": "string (uuid)",
  "reason": "enum (USER_REQUESTED, AI_UNABLE, COMPLEX_QUERY, COMPLAINT, PAYMENT_ISSUE, URGENT, OTHER)",
  "reasonDetail": "string | null",
  "status": "enum (PENDING, IN_PROGRESS, RESOLVED, CANCELLED)",
  "priority": "enum (LOW, MEDIUM, HIGH, URGENT)",
  "hotelUnit": "string | null",
  "resolvedById": "string (uuid) | null",
  "resolvedAt": "string (datetime) | null",
  "resolution": "string | null",
  "createdAt": "string (datetime)",
  "updatedAt": "string (datetime)"
}
```

### User
```json
{
  "id": "string (uuid)",
  "tenantId": "string (uuid) | null",
  "email": "string",
  "name": "string",
  "role": "enum (SUPER_ADMIN, ADMIN, MANAGER, ATTENDANT)",
  "status": "enum (ACTIVE, INACTIVE, SUSPENDED)",
  "hotelUnit": "string | null",
  "createdAt": "string (datetime)",
  "updatedAt": "string (datetime)"
}
```

### Tenant
```json
{
  "id": "string (uuid)",
  "name": "string",
  "slug": "string (unique)",
  "email": "string | null",
  "status": "enum (ACTIVE, INACTIVE, SUSPENDED)",
  "plan": "enum (FREE, STARTER, PROFESSIONAL, ENTERPRISE)",
  "whatsappPhoneNumberId": "string | null",
  "whatsappBusinessAccountId": "string | null",
  "whatsappAccessToken": "string (encrypted) | null",
  "whatsappAppSecret": "string (encrypted) | null",
  "n8nWebhookUrl": "string | null",
  "createdAt": "string (datetime)",
  "updatedAt": "string (datetime)"
}
```

---

## Códigos de Erro

### Autenticação
- `INVALID_CREDENTIALS` - Credenciais inválidas
- `INVALID_TOKEN` - Token inválido ou expirado
- `INVALID_REFRESH_TOKEN` - Token de refresh inválido
- `USER_INACTIVE` - Usuário desativado
- `TENANT_SUSPENDED` - Tenant suspenso

### Autorização
- `FORBIDDEN` - Acesso negado
- `INSUFFICIENT_PERMISSIONS` - Permissões insuficientes
- `TENANT_MISMATCH` - Tentativa de acesso cross-tenant

### Validação
- `VALIDATION_ERROR` - Erro de validação de dados
- `INVALID_PHONE` - Telefone inválido
- `INVALID_EMAIL` - Email inválido
- `REQUIRED_FIELD` - Campo obrigatório

### Recursos
- `CONVERSATION_NOT_FOUND` - Conversa não encontrada
- `MESSAGE_NOT_FOUND` - Mensagem não encontrada
- `CONTACT_NOT_FOUND` - Contato não encontrado
- `USER_NOT_FOUND` - Usuário não encontrado
- `TENANT_NOT_FOUND` - Tenant não encontrado
- `ESCALATION_NOT_FOUND` - Escalação não encontrada

### WhatsApp
- `WHATSAPP_NOT_CONFIGURED` - WhatsApp não configurado
- `WHATSAPP_SEND_FAILED` - Falha ao enviar mensagem
- `WHATSAPP_TEMPLATE_NOT_FOUND` - Template não encontrado
- `WHATSAPP_RATE_LIMITED` - Rate limit da API do WhatsApp

### Sistema
- `INTERNAL_SERVER_ERROR` - Erro interno
- `SERVICE_UNAVAILABLE` - Serviço indisponível
- `RATE_LIMIT_EXCEEDED` - Rate limit excedido

---

## Rate Limiting

### Limites por Endpoint

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `/auth/login` | 5 req | 15 min |
| `/webhooks/*` | 1000 req | 1 min |
| `/api/n8n/*` | 5000 req | 1 min |
| `/api/*` (geral) | 100 req | 1 min |
| `/api/media/*` | 200 req | 1 min |

### Headers de Rate Limit
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642267260
Retry-After: 60
```

### Response 429
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Limite de requisições excedido",
    "retryAfter": 60
  }
}
```

---

## WebSocket Events

### Conexão
```
wss://api.botreserva.com.br/socket.io/?token={access_token}
```

### Eventos Disponíveis

#### conversation:new
```json
{
  "event": "conversation:new",
  "data": {
    "id": "uuid",
    "contactName": "Maria Santos",
    "contactPhone": "5511999999999",
    "hotelUnit": "Campos do Jordão"
  }
}
```

#### conversation:updated
```json
{
  "event": "conversation:updated",
  "data": {
    "id": "uuid",
    "status": "IN_PROGRESS",
    "assignedToId": "uuid"
  }
}
```

#### message:new
```json
{
  "event": "message:new",
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "type": "TEXT",
    "direction": "INBOUND",
    "content": "Olá, preciso de ajuda",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

#### message:status
```json
{
  "event": "message:status",
  "data": {
    "id": "uuid",
    "whatsappMessageId": "wamid.xxx",
    "status": "DELIVERED"
  }
}
```

#### escalation:new
```json
{
  "event": "escalation:new",
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "reason": "USER_REQUESTED",
    "priority": "HIGH",
    "hotelUnit": "Campos do Jordão"
  }
}
```

---

## Segurança

### HTTPS
Todas as requisições devem ser feitas via HTTPS.

### Headers de Segurança
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

### Validação de Webhook
Webhooks do WhatsApp são validados via HMAC-SHA256:
```
X-Hub-Signature-256: sha256={hmac_signature}
```

### Criptografia de Dados Sensíveis
Tokens do WhatsApp são criptografados em repouso com AES-256-GCM.

---

## Ambientes

### Produção
```
API:       https://api.botreserva.com.br/api
WebSocket: wss://api.botreserva.com.br/socket.io/
Frontend:  https://www.botreserva.com.br
```

### Staging (Develop)
```
API:       https://app.botreserva.com.br/api
WebSocket: wss://app.botreserva.com.br/socket.io/
Frontend:  https://develop.botreserva.com.br
```

### Local
```
API:       http://localhost:3001/api
WebSocket: ws://localhost:3001/socket.io/
Frontend:  http://localhost:3000
```

---

Última atualização: Dezembro de 2025

**Desenvolvido por [3ian](https://3ian.com.br)** - Soluções em Tecnologia e Automação
