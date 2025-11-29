# Relatório Técnico Detalhado - CRM WhatsApp SaaS

## Índice
1. [Stack Tecnológico Completo](#stack-tecnológico-completo)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Banco de Dados](#banco-de-dados)
4. [APIs e Endpoints](#apis-e-endpoints)
5. [Segurança](#segurança)
6. [Performance e Otimização](#performance-e-otimização)
7. [Deploy e DevOps](#deploy-e-devops)

---

## Stack Tecnológico Completo

### Frontend

#### Framework e Core
- **Next.js 14.2.33** - Framework React com App Router
  - Server Components para performance
  - Client Components para interatividade
  - API Routes (não usadas, preferência por backend separado)
  - Otimização automática de imagens

- **React 18.3.1** - Biblioteca UI
  - Hooks modernos (useState, useEffect, useCallback, useMemo)
  - Concurrent features
  - Suspense boundaries

- **TypeScript 5.x** - Tipagem estática
  - Strict mode habilitado
  - Interfaces e Types bem definidos
  - Type inference avançado

#### State Management & Data Fetching
- **TanStack Query (React Query) 5.x**
  - Cache inteligente de dados
  - Refetch automático
  - Optimistic updates
  - Invalidação de queries
  - Stale-while-revalidate strategy

#### UI e Estilização
- **Tailwind CSS 3.x** - Utility-first CSS
  - Custom theme configurado
  - Responsive design mobile-first
  - Dark mode support (preparado)

- **shadcn/ui** - Componentes headless
  - Radix UI primitives
  - Acessibilidade WCAG 2.1
  - Componentes: Dialog, Select, Tabs, Card, Badge, etc.

- **Lucide React** - Ícones modernos
  - Tree-shaking automático
  - Ícones SVG otimizados

#### Forms e Validação
- **React Hook Form 7.x** - Gestão de formulários
  - Performance otimizada (menos re-renders)
  - Validação assíncrona
  - Integração com Zod

- **Zod 3.x** - Schema validation
  - Type-safe validation
  - Mensagens de erro customizadas
  - Runtime + compile-time validation

#### HTTP Client
- **Axios 1.x** - Cliente HTTP
  - Interceptors para autenticação
  - Retry automático configurado
  - Timeout handling
  - Request/Response transformation

#### Real-time
- **Socket.io Client 4.x**
  - Reconexão automática
  - Event-based communication
  - Binary support

#### Notificações
- **Sonner** - Toast notifications
  - Animações suaves
  - Queue management
  - Customizável

---

### Backend

#### Runtime e Framework
- **Node.js 20.18.1 LTS** - Runtime JavaScript
  - Performance V8 otimizada
  - Native fetch support
  - Enhanced error stack traces

- **Express.js 4.x** - Web framework
  - Middleware architecture
  - Routing robusto
  - Error handling centralizado

- **TypeScript 5.x** - Tipagem estática
  - Strict null checks
  - No implicit any
  - Path aliases configurados

#### ORM e Banco de Dados
- **Prisma ORM 5.22.0** - Database toolkit moderno
  - Type-safe queries
  - Migration system
  - Query optimization
  - Connection pooling
  - Schema introspection

- **PostgreSQL 15** - Banco relacional
  - ACID compliance
  - JSON support
  - Full-text search
  - Triggers e Functions
  - Row Level Security (preparado)

#### Cache e Filas
- **Redis 7.x** - In-memory data store
  - Cache de sessões
  - Rate limiting
  - Pub/Sub para eventos
  - Queue storage (Bull)

- **Bull 4.x** - Queue management
  - Job scheduling
  - Retry logic
  - Priority queues
  - Job completion events

#### Real-time Communication
- **Socket.io 4.x** - WebSocket wrapper
  - Rooms para multi-tenant
  - Namespaces organizados
  - Middleware de autenticação
  - Fallback para long-polling

#### Segurança
- **bcrypt 5.x** - Password hashing
  - Salt rounds configuráveis
  - Async hashing

- **jsonwebtoken 9.x** - JWT implementation
  - HS256 algorithm
  - Token refresh strategy
  - Custom claims

- **Helmet 7.x** - Security headers
  - CSP configurado
  - XSS protection
  - HSTS enabled

- **cors 2.x** - CORS middleware
  - Origin whitelist
  - Credentials support

#### Logging e Monitoramento
- **Winston 3.x** - Logger profissional
  - Multiple transports
  - Log levels (error, warn, info, debug)
  - Rotation de logs
  - Structured logging (JSON)

#### Validação
- **Zod 3.x** - Runtime validation
  - Request body validation
  - Query params validation
  - Type inference para TypeScript

#### HTTP Client (Backend)
- **Axios 1.x** - Para chamadas externas
  - WhatsApp Business API
  - Webhooks externos

---

### Infraestrutura

#### Containerização
- **Docker 24.x** - Container runtime
  - Multi-stage builds
  - Layer caching
  - Health checks
  - Resource limits

- **Docker Compose** - Orchestração local
  - Services: backend, postgres, redis, nginx
  - Networks isolados
  - Volumes persistentes

#### Reverse Proxy
- **Nginx 1.24** - Web server e proxy
  - SSL/TLS termination
  - Load balancing (preparado)
  - Rate limiting
  - Gzip compression
  - Static file serving

#### SSL/TLS
- **Let's Encrypt** - Certificados SSL gratuitos
  - Auto-renewal com Certbot
  - HTTP/2 enabled
  - A+ rating SSLabs

#### Hospedagem

**Backend:**
- **VPS (Virtual Private Server)**
  - Linux Ubuntu 22.04 LTS
  - 2GB+ RAM
  - Docker instalado
  - IP fixo: 72.61.39.235

**Frontend:**
- **Vercel** - Platform as a Service
  - Deploy automático via Git
  - Edge Network global
  - Preview deployments
  - Environment variables

**Banco de Dados:**
- **PostgreSQL** no mesmo VPS
  - Backup automático
  - Replication (preparado)

**Cache:**
- **Redis** no mesmo VPS
  - Persistence configurada
  - AOF + RDB

---

## Arquitetura do Sistema

### Padrão Arquitetural

**Monorepo Modular** com separação clara:
```
projeto-hoteis-reserva/
├── apps/
│   ├── frontend/          # Next.js App
│   └── backend/           # Express API (não usado)
├── deploy-backend/        # Backend de produção
├── packages/              # Shared libs (futuro)
└── docs/                  # Documentação
```

### Arquitetura Backend (Camadas)

```
┌──────────────────────────────────────────┐
│           HTTP REQUEST                   │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│         MIDDLEWARES GLOBAIS              │
│  - CORS                                  │
│  - Helmet (Security)                     │
│  - Body Parser                           │
│  - Rate Limiting                         │
│  - Tenant Isolation                      │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│            ROUTES                        │
│  - /auth           (público)             │
│  - /webhooks       (público)             │
│  - /api/users      (autenticado)         │
│  - /api/contacts   (autenticado)         │
│  - /api/conversations (autenticado)      │
│  - /api/messages   (autenticado)         │
│  - /api/reports    (autenticado)         │
│  - /api/tenants    (admin)               │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│         VALIDATORS                       │
│  - Zod schemas                           │
│  - Type inference                        │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│         CONTROLLERS                      │
│  - Request/Response handling             │
│  - Error catching                        │
│  - Delegation to services                │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│          SERVICES                        │
│  - Business logic                        │
│  - Database operations                   │
│  - External API calls                    │
│  - Queue jobs                            │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│    DATABASE (Prisma ORM)                 │
│  - Type-safe queries                     │
│  - Transactions                          │
│  - Relations                             │
└──────────────────────────────────────────┘
```

### Arquitetura Frontend (Estrutura)

```
apps/frontend/src/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth layout
│   │   └── login/
│   ├── dashboard/               # Dashboard layout
│   │   ├── page.tsx            # Home/Stats
│   │   ├── conversations/      # Kanban
│   │   ├── contacts/           # Contatos
│   │   ├── users/              # Usuários
│   │   ├── reports/            # Relatórios
│   │   └── settings/           # Configurações
│   └── layout.tsx              # Root layout
├── components/                  # Componentes React
│   ├── ui/                     # shadcn components
│   ├── conversation/           # Específicos
│   ├── contact/
│   └── tenant/
├── services/                    # API clients
│   ├── auth.service.ts
│   ├── conversation.service.ts
│   ├── contact.service.ts
│   ├── user.service.ts
│   ├── report.service.ts
│   └── settings.service.ts
├── lib/                         # Utilities
│   ├── api-client.ts           # Axios config
│   ├── socket.ts               # Socket.io
│   └── utils.ts                # Helpers
├── hooks/                       # Custom hooks
│   └── use-auth.ts
└── types/                       # TypeScript types
    └── index.ts
```

### Fluxo de Autenticação

```
┌─────────┐                    ┌─────────┐
│ Cliente │                    │ Backend │
└────┬────┘                    └────┬────┘
     │                              │
     │  POST /auth/login            │
     │  { email, password }         │
     │─────────────────────────────>│
     │                              │
     │                         ┌────▼────┐
     │                         │ Validate│
     │                         │ & Hash  │
     │                         └────┬────┘
     │                              │
     │    200 OK                    │
     │    { accessToken, user }     │
     │<─────────────────────────────│
     │                              │
┌────▼────┐                         │
│  Store  │                         │
│  Token  │                         │
│LocalStg │                         │
└────┬────┘                         │
     │                              │
     │  GET /api/conversations      │
     │  Authorization: Bearer token │
     │─────────────────────────────>│
     │                              │
     │                         ┌────▼────┐
     │                         │ Verify  │
     │                         │  JWT    │
     │                         └────┬────┘
     │                              │
     │    200 OK                    │
     │    { data: [...] }           │
     │<─────────────────────────────│
```

### Fluxo Real-time (Socket.io)

```
┌─────────┐              ┌─────────┐              ┌─────────┐
│Frontend │              │ Backend │              │WhatsApp │
└────┬────┘              └────┬────┘              └────┬────┘
     │                        │                        │
     │ socket.connect()       │                        │
     │ + JWT token            │                        │
     │───────────────────────>│                        │
     │                        │                        │
     │                   ┌────▼────┐                   │
     │                   │ Validate│                   │
     │                   │   JWT   │                   │
     │                   └────┬────┘                   │
     │                        │                        │
     │    'connected'         │                        │
     │<───────────────────────│                        │
     │                        │                        │
     │ Join room: tenantId    │                        │
     │───────────────────────>│                        │
     │                        │                        │
     │                        │  Webhook POST          │
     │                        │  (nova mensagem)       │
     │                        │<───────────────────────│
     │                        │                        │
     │                   ┌────▼────┐                   │
     │                   │  Save   │                   │
     │                   │   to    │                   │
     │                   │   DB    │                   │
     │                   └────┬────┘                   │
     │                        │                        │
     │  'new-message'         │                        │
     │  (evento real-time)    │                        │
     │<───────────────────────│                        │
     │                        │                        │
┌────▼────┐                   │                        │
│ Update  │                   │                        │
│   UI    │                   │                        │
└─────────┘                   │                        │
```

---

## Banco de Dados

### Schema Prisma Completo

#### Tenant (Multi-tenancy)
```prisma
model Tenant {
  id    String @id @default(uuid())
  name  String
  slug  String @unique
  email String @unique

  // Status e Plano
  status TenantStatus @default(TRIAL)
  plan   Plan         @default(BASIC)

  // Limites
  maxAttendants Int @default(10)
  maxMessages   Int @default(10000)

  // Billing
  stripeCustomerId     String?
  stripeSubscriptionId String?
  subscriptionStatus   SubscriptionStatus?
  currentPeriodEnd     DateTime?
  trialEndsAt          DateTime?

  // WhatsApp Config
  whatsappPhoneNumberId      String?
  whatsappAccessToken        String?
  whatsappBusinessAccountId  String?
  whatsappWebhookVerifyToken String?
  whatsappAppSecret          String?

  // Metadata
  metadata  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  users         User[]
  contacts      Contact[]
  conversations Conversation[]
}
```

#### User (Usuários/Atendentes)
```prisma
model User {
  id       String   @id @default(uuid())
  email    String   @unique
  password String
  name     String
  role     Role     @default(ATTENDANT)
  status   UserStatus @default(ACTIVE)

  // Multi-tenant
  tenantId String?
  tenant   Tenant? @relation(fields: [tenantId], references: [id])

  // Avatar
  avatarUrl String?

  // Metadata
  metadata  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  conversations Conversation[]
  sentMessages  Message[]

  @@index([tenantId])
  @@index([email])
}
```

#### Contact (Contatos/Clientes)
```prisma
model Contact {
  id          String  @id @default(uuid())
  name        String
  phoneNumber String
  email       String?

  // WhatsApp Info
  whatsappId String?

  // Metadata
  tags     String[]
  notes    String?
  metadata Json?

  // Multi-tenant
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  conversations Conversation[]

  @@unique([tenantId, phoneNumber])
  @@index([tenantId])
  @@index([phoneNumber])
}
```

#### Conversation (Conversas)
```prisma
model Conversation {
  id     String             @id @default(uuid())
  status ConversationStatus @default(OPEN)

  // Assignment
  assignedToId String?
  assignedTo   User?   @relation(fields: [assignedToId], references: [id])

  // Contact
  contactId String
  contact   Contact @relation(fields: [contactId], references: [id])

  // Priority
  priority Priority @default(MEDIUM)

  // Multi-tenant
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  // Timestamps
  lastMessageAt DateTime @default(now())
  closedAt      DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Metadata
  metadata Json?

  // Relations
  messages Message[]

  @@index([tenantId])
  @@index([contactId])
  @@index([assignedToId])
  @@index([status])
}
```

#### Message (Mensagens)
```prisma
model Message {
  id String @id @default(uuid())

  // Content
  content     String
  messageType MessageType
  mediaUrl    String?

  // Direction
  isFromContact Boolean @default(true)

  // WhatsApp IDs
  whatsappMessageId String? @unique

  // Relations
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])

  sentById String?
  sentBy   User?   @relation(fields: [sentById], references: [id])

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Metadata
  metadata Json?

  @@index([conversationId])
  @@index([whatsappMessageId])
}
```

### Enums

```prisma
enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}

enum Plan {
  BASIC
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}

enum Role {
  SUPER_ADMIN      // Acesso total ao sistema
  TENANT_ADMIN     // Gerencia o tenant
  ATTENDANT        // Atende conversas
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum ConversationStatus {
  BOT_HANDLING     // IA atendendo
  OPEN             // Aguardando
  IN_PROGRESS      // Atendente conversando
  WAITING          // Aguardando cliente
  CLOSED           // Finalizada
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum MessageType {
  TEXT
  IMAGE
  DOCUMENT
  AUDIO
  VIDEO
}
```

### Índices e Performance

**Índices Estratégicos:**
- `tenantId` em todas as tabelas (isolamento)
- `email` em User (login)
- `phoneNumber` em Contact (busca)
- `status` em Conversation (filtros Kanban)
- `whatsappMessageId` em Message (idempotência)

**Unique Constraints:**
- `tenant.slug` - URL única por tenant
- `tenant.email` - Email único
- `user.email` - Email único
- `contact[tenantId, phoneNumber]` - Contato único por tenant

---

## APIs e Endpoints

### Autenticação

#### POST /auth/register
**Descrição:** Criar novo tenant + usuário admin

**Request:**
```json
{
  "tenantName": "Hotel Copacabana",
  "tenantSlug": "hotelcopacabana",
  "email": "admin@hotel.com",
  "password": "senha123",
  "name": "João Silva"
}
```

**Response:**
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Hotel Copacabana",
    "slug": "hotelcopacabana"
  },
  "user": {
    "id": "uuid",
    "email": "admin@hotel.com",
    "name": "João Silva",
    "role": "TENANT_ADMIN"
  },
  "accessToken": "jwt-token"
}
```

#### POST /auth/login
**Descrição:** Login de usuário

**Request:**
```json
{
  "email": "admin@hotel.com",
  "password": "senha123"
}
```

**Response:**
```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "admin@hotel.com",
    "name": "João Silva",
    "role": "TENANT_ADMIN",
    "tenantId": "uuid"
  }
}
```

---

### Conversas

#### GET /api/conversations
**Auth:** Required
**Descrição:** Listar conversas do tenant

**Query Params:**
- `status` (optional): OPEN | IN_PROGRESS | WAITING | CLOSED
- `assignedToId` (optional): UUID do atendente
- `page` (optional): número da página (default: 1)
- `limit` (optional): itens por página (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "OPEN",
      "priority": "MEDIUM",
      "lastMessageAt": "2025-11-24T10:30:00Z",
      "contact": {
        "id": "uuid",
        "name": "Maria Santos",
        "phoneNumber": "+5511999999999"
      },
      "assignedTo": {
        "id": "uuid",
        "name": "João Silva"
      },
      "messagesCount": 5,
      "unreadCount": 2
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

#### GET /api/conversations/:id
**Auth:** Required
**Descrição:** Buscar conversa específica com mensagens

**Response:**
```json
{
  "id": "uuid",
  "status": "IN_PROGRESS",
  "contact": {
    "id": "uuid",
    "name": "Maria Santos",
    "phoneNumber": "+5511999999999",
    "email": "maria@email.com"
  },
  "assignedTo": {
    "id": "uuid",
    "name": "João Silva"
  },
  "messages": [
    {
      "id": "uuid",
      "content": "Olá, gostaria de fazer uma reserva",
      "isFromContact": true,
      "createdAt": "2025-11-24T10:00:00Z"
    },
    {
      "id": "uuid",
      "content": "Olá Maria! Claro, posso ajudar.",
      "isFromContact": false,
      "sentBy": {
        "name": "João Silva"
      },
      "createdAt": "2025-11-24T10:01:00Z"
    }
  ]
}
```

#### PATCH /api/conversations/:id/status
**Auth:** Required
**Descrição:** Atualizar status da conversa

**Request:**
```json
{
  "status": "CLOSED"
}
```

#### PATCH /api/conversations/:id/assign
**Auth:** Required
**Descrição:** Atribuir conversa a atendente

**Request:**
```json
{
  "userId": "uuid"
}
```

---

### Mensagens

#### POST /api/messages
**Auth:** Required
**Descrição:** Enviar mensagem

**Request:**
```json
{
  "conversationId": "uuid",
  "content": "Olá! Como posso ajudar?",
  "messageType": "TEXT"
}
```

**Response:**
```json
{
  "id": "uuid",
  "content": "Olá! Como posso ajudar?",
  "conversationId": "uuid",
  "sentById": "uuid",
  "isFromContact": false,
  "createdAt": "2025-11-24T10:30:00Z"
}
```

---

### Contatos

#### GET /api/contacts
**Auth:** Required
**Descrição:** Listar contatos

**Query Params:**
- `search` (optional): busca por nome/telefone
- `page`, `limit`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Maria Santos",
      "phoneNumber": "+5511999999999",
      "email": "maria@email.com",
      "conversationsCount": 3,
      "lastContactAt": "2025-11-24T10:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### POST /api/contacts
**Auth:** Required
**Descrição:** Criar contato

**Request:**
```json
{
  "name": "Maria Santos",
  "phoneNumber": "+5511999999999",
  "email": "maria@email.com",
  "tags": ["vip", "reserva-frequente"]
}
```

---

### Usuários

#### GET /api/users
**Auth:** Required (TENANT_ADMIN)
**Descrição:** Listar usuários do tenant

#### POST /api/users
**Auth:** Required (TENANT_ADMIN)
**Descrição:** Criar usuário

**Request:**
```json
{
  "name": "Pedro Oliveira",
  "email": "pedro@hotel.com",
  "password": "senha123",
  "role": "ATTENDANT"
}
```

#### PATCH /api/users/:id
**Auth:** Required (TENANT_ADMIN)
**Descrição:** Atualizar usuário

#### PATCH /api/users/:id/status
**Auth:** Required (TENANT_ADMIN)
**Descrição:** Ativar/suspender usuário

---

### Relatórios

#### GET /api/reports/overview
**Auth:** Required
**Descrição:** Métricas gerais

**Query Params:**
- `period`: 7d | 30d | 90d | 1y

**Response:**
```json
{
  "period": "30d",
  "overview": {
    "totalConversations": 342,
    "conversationsChange": 12,
    "averageResponseTime": 5,
    "resolutionRate": 89,
    "activeAttendants": 8,
    "totalAttendants": 10
  },
  "statusBreakdown": [
    {
      "status": "CLOSED",
      "count": 256,
      "percentage": 75
    }
  ]
}
```

#### GET /api/reports/attendants
**Auth:** Required
**Descrição:** Performance por atendente

**Response:**
```json
{
  "period": "30d",
  "attendants": [
    {
      "id": "uuid",
      "name": "João Silva",
      "conversationsCount": 45,
      "satisfactionRate": 98
    }
  ]
}
```

#### GET /api/reports/hourly
**Auth:** Required
**Descrição:** Volume por hora

**Response:**
```json
{
  "period": "30d",
  "hourlyVolume": [
    { "hour": 8, "count": 12 },
    { "hour": 9, "count": 25 },
    { "hour": 10, "count": 45 }
  ]
}
```

---

### Configurações

#### GET /api/tenants/whatsapp-config
**Auth:** Required (TENANT_ADMIN)
**Descrição:** Ver configuração do WhatsApp

**Response:**
```json
{
  "whatsappPhoneNumberId": "123456789",
  "whatsappBusinessAccountId": "987654321",
  "phoneNumber": "+5511999999999",
  "isConnected": true
}
```

#### POST /api/tenants/whatsapp-config
**Auth:** Required (TENANT_ADMIN)
**Descrição:** Configurar WhatsApp

**Request:**
```json
{
  "whatsappPhoneNumberId": "123456789",
  "whatsappAccessToken": "EAAxxxxxxxxx",
  "whatsappBusinessAccountId": "987654321",
  "whatsappWebhookVerifyToken": "my-verify-token",
  "whatsappAppSecret": "app-secret"
}
```

---

### Webhooks

#### POST /webhooks/whatsapp
**Auth:** Public (WhatsApp signature validation)
**Descrição:** Receber mensagens do WhatsApp

**Request (WhatsApp):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511999999999",
          "type": "text",
          "text": { "body": "Olá!" }
        }]
      }
    }]
  }]
}
```

#### GET /webhooks/whatsapp
**Auth:** Public
**Descrição:** Verificação do webhook (WhatsApp)

---

## Segurança

### Autenticação e Autorização

#### JWT (JSON Web Tokens)
- **Algoritmo:** HS256
- **Expiração:** 7 dias
- **Claims:**
  ```json
  {
    "userId": "uuid",
    "tenantId": "uuid",
    "role": "TENANT_ADMIN",
    "iat": timestamp,
    "exp": timestamp
  }
  ```

#### Middleware de Autenticação
```typescript
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};
```

#### Middleware de Autorização
```typescript
export const authorize = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};
```

### Isolamento Multi-Tenant

**Middleware de Tenant:**
```typescript
export const tenantIsolationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extrair tenantId do token JWT
  const tenantId = req.user?.tenantId;

  // Adicionar ao request
  req.tenantId = tenantId;

  next();
};
```

**Todas as queries do Prisma incluem `tenantId`:**
```typescript
await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId, // SEMPRE presente
    status: 'OPEN'
  }
});
```

### Proteção contra Ataques

#### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

// Geral: 100 req/15min
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Login: 5 tentativas/15min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de login',
});
```

#### CORS (Cross-Origin)
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL.split(','),
  credentials: true,
}));
```

#### Helmet (Security Headers)
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  }
}));
```

#### SQL Injection
- **Prisma ORM** previne automaticamente
- Queries parametrizadas
- Type-safe

#### XSS (Cross-Site Scripting)
- Sanitização de inputs no frontend
- Content Security Policy
- React escape automático

#### Password Hashing
```typescript
import bcrypt from 'bcrypt';

// Hash
const hashedPassword = await bcrypt.hash(password, 10);

// Verify
const isValid = await bcrypt.compare(password, hashedPassword);
```

---

## Performance e Otimização

### Backend

#### Connection Pooling (Prisma)
```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Pool settings
  connection_limit = 10
}
```

#### Query Optimization
- Seleção de campos específicos
- Eager loading de relations
- Índices estratégicos

**Exemplo:**
```typescript
// ❌ Ruim: busca tudo
const conversations = await prisma.conversation.findMany();

// ✅ Bom: select específico + relations
const conversations = await prisma.conversation.findMany({
  select: {
    id: true,
    status: true,
    contact: {
      select: {
        name: true,
        phoneNumber: true
      }
    },
    _count: {
      select: { messages: true }
    }
  },
  where: { tenantId },
  take: 20,
  skip: (page - 1) * 20
});
```

#### Caching (Redis)
```typescript
// Cache de sessão
await redis.set(`session:${userId}`, JSON.stringify(user), 'EX', 3600);

// Cache de queries
const cacheKey = `conversations:${tenantId}:${status}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const data = await prisma.conversation.findMany({...});
await redis.set(cacheKey, JSON.stringify(data), 'EX', 60);
```

#### Queue Processing (Bull)
```typescript
// Producer
await messageQueue.add('send-whatsapp', {
  phoneNumber: '+5511999999999',
  message: 'Olá!',
  tenantId
});

// Consumer
messageQueue.process('send-whatsapp', async (job) => {
  const { phoneNumber, message, tenantId } = job.data;

  // Enviar via WhatsApp API
  await whatsappService.sendMessage({...});
});
```

### Frontend

#### Code Splitting
```typescript
// Lazy loading de páginas
const ConversationsPage = dynamic(
  () => import('./conversations/page'),
  { loading: () => <LoadingSkeleton /> }
);
```

#### Image Optimization
```typescript
import Image from 'next/image';

<Image
  src="/avatar.jpg"
  width={100}
  height={100}
  alt="Avatar"
  loading="lazy"
/>
```

#### React Query Caching
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['conversations', status],
  queryFn: () => conversationService.list({ status }),
  staleTime: 30000, // 30s
  cacheTime: 300000, // 5min
});
```

#### Memoization
```typescript
const filteredConversations = useMemo(() => {
  return conversations.filter(c => c.status === selectedStatus);
}, [conversations, selectedStatus]);

const handleClick = useCallback(() => {
  // Handler function
}, [dependencies]);
```

---

## Deploy e DevOps

### Backend (VPS)

#### Estrutura Docker

**Dockerfile:**
```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 nodejs
RUN adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
USER nodejs
EXPOSE 3001
CMD ["dumb-init", "node", "dist/server.js"]
```

**docker-compose.production.yml:**
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.standalone
    container_name: crm-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis
    networks:
      - crm-network

  postgres:
    image: postgres:15-alpine
    container_name: crm-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - crm-network

  redis:
    image: redis:7-alpine
    container_name: crm-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - crm-network

  nginx:
    image: nginx:alpine
    container_name: crm-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - certbot_data:/var/www/certbot
    depends_on:
      - backend
    networks:
      - crm-network

volumes:
  postgres_data:
  redis_data:
  certbot_data:

networks:
  crm-network:
    driver: bridge
```

#### Nginx Configuration
```nginx
upstream backend {
    server backend:3001;
}

server {
    listen 80;
    server_name api.hotelcrm.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.hotelcrm.com;

    # SSL
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to backend
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.io
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### Deploy Commands
```bash
# Build e deploy
cd /root/deploy-backend
docker compose -f docker-compose.production.yml build backend
docker compose -f docker-compose.production.yml up -d backend

# Ver logs
docker logs crm-backend --tail=100 -f

# Restart
docker compose -f docker-compose.production.yml restart backend
```

---

### Frontend (Vercel)

#### Configuração

**vercel.json:**
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "devCommand": "npm run dev",
  "env": {
    "NEXT_PUBLIC_API_URL": "@api-url",
    "NEXT_PUBLIC_WS_URL": "@ws-url"
  }
}
```

#### Environment Variables (Vercel)
```
NEXT_PUBLIC_API_URL=https://api.hotelcrm.com
NEXT_PUBLIC_WS_URL=wss://api.hotelcrm.com
NODE_ENV=production
```

#### Deploy Automático
- Push para `master` → Deploy automático
- Preview deployments para PRs
- Rollback com 1 clique

---

### Monitoramento

#### Health Check Endpoint
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
```

#### Logs Estruturados (Winston)
```typescript
logger.info('User login', {
  userId: user.id,
  tenantId: user.tenantId,
  timestamp: new Date()
});

logger.error('Database error', {
  error: error.message,
  stack: error.stack,
  context: { userId, tenantId }
});
```

---

**Última Atualização:** 24 de Novembro de 2025
**Versão do Documento:** 1.0
