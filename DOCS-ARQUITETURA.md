# 📋 DOCUMENTAÇÃO DE ARQUITETURA - CRM WhatsApp para Hotéis

> **Projeto:** Sistema CRM Multi-Atendente com Integração WhatsApp Business API (Meta)
> **Objetivo:** Plataforma enterprise para gerenciamento de conversas WhatsApp com interface Kanban
> **Público-alvo:** Rede de hotéis (produto para revenda)
> **Autor:** Desenvolvido com Claude Code
> **Data:** Novembro 2025

---

## 🎯 VISÃO GERAL DO PROJETO

### Problema que Resolve
Atualmente o cliente usa ZAPI (não oficial) para automação no n8n. Precisamos migrar para a **WhatsApp Business API oficial da Meta**, mantendo todas as automações do n8n e adicionando um CRM profissional para múltiplos atendentes gerenciarem conversas.

### Solução Proposta
Sistema completo composto por:

1. **Backend API** - Servidor Node.js que se comunica com WhatsApp Business API
2. **Frontend CRM** - Interface web moderna para atendentes gerenciarem conversas
3. **Integração n8n** - API RESTful para manter automações existentes
4. **Infraestrutura** - Docker containerizado para deploy fácil em VPS

---

## 🏗️ ARQUITETURA DO SISTEMA

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHATSAPP BUSINESS API (META)                 │
│                  https://graph.facebook.com/v21.0               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Webhooks (POST)
                         │ Envio de Mensagens (POST)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                             │
│                   (Node.js + TypeScript)                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Webhooks   │  │   REST API   │  │  WebSocket   │         │
│  │   Handler    │  │  Endpoints   │  │   Server     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────┐           │
│  │         Business Logic Layer (Services)         │           │
│  │  - MessageService                               │           │
│  │  - ConversationService                          │           │
│  │  - WhatsAppService                              │           │
│  │  - AttendantService                             │           │
│  │  - QueueService (Bull + Redis)                  │           │
│  └────────────────────┬────────────────────────────┘           │
│                       │                                         │
│                       ▼                                         │
│  ┌─────────────────────────────────────────────────┐           │
│  │         Data Access Layer (Repositories)        │           │
│  │              Prisma ORM                         │           │
│  └────────────────────┬────────────────────────────┘           │
└─────────────────────┬─┴──────────────────┬────────────────────┘
                      │                    │
                      ▼                    ▼
        ┌──────────────────────┐  ┌───────────────┐
        │   PostgreSQL 16      │  │   Redis 7     │
        │                      │  │               │
        │  - users             │  │  - Filas      │
        │  - conversations     │  │  - Cache      │
        │  - messages          │  │  - Sessions   │
        │  - contacts          │  │               │
        │  - attendants        │  └───────────────┘
        │  - tags              │
        └──────────────────────┘
                      ▲
                      │
        ┌─────────────┴──────────────────┐
        │                                │
        ▼                                ▼
┌──────────────────┐          ┌──────────────────────┐
│   FRONTEND CRM   │          │        n8n           │
│   (Next.js 14)   │          │   (Automações)       │
│                  │          │                      │
│  - Login         │          │  - Workflows         │
│  - Kanban View   │          │  - Triggers          │
│  - Chat UI       │          │  - HTTP Requests     │
│  - Dashboard     │          │    para API          │
└──────────────────┘          └──────────────────────┘
        │
        │ HTTP + WebSocket
        ▼
   [Atendentes]
```

---

## 🔧 STACK TECNOLÓGICO ESCOLHIDO

### Por que estas tecnologias?

#### BACKEND

**Node.js + TypeScript**
- ✅ **Por quê:** Performance excepcional para I/O, comunidade gigante, bibliotecas maduras
- ✅ **TypeScript:** Segurança de tipos em tempo de desenvolvimento, código mais manutenível
- ✅ **Versão:** Node 20 LTS (suporte até 2026)

**Express.js**
- ✅ **Por quê:** Framework minimalista, maduro, flexível
- ✅ **Alternativas consideradas:** Fastify (mais rápido), NestJS (mais opinado)
- ✅ **Decisão:** Express pela simplicidade e controle total

**Prisma ORM**
- ✅ **Por quê:** Type-safe, migrations automáticas, excelente DX
- ✅ **Alternativas:** TypeORM, Sequelize
- ✅ **Decisão:** Prisma pela modernidade e produtividade

**PostgreSQL 16**
- ✅ **Por quê:** ACID compliant, JSON nativo, performance, escalável
- ✅ **Alternativas:** MySQL, MongoDB
- ✅ **Decisão:** PostgreSQL por ser a melhor escolha para dados relacionais

**Socket.io**
- ✅ **Por quê:** Comunicação real-time confiável, fallback automático
- ✅ **Uso:** Notificações de novas mensagens para atendentes em tempo real

**Bull/BullMQ + Redis**
- ✅ **Por quê:** Processamento assíncrono, retry automático, escalável
- ✅ **Uso:** Fila para envio de mensagens WhatsApp, processamento de webhooks

**Zod**
- ✅ **Por quê:** Validação de dados runtime, integração perfeita com TypeScript
- ✅ **Uso:** Validar payloads de API, webhooks, formulários

**Winston/Pino**
- ✅ **Por quê:** Logging estruturado para debugging e monitoramento
- ✅ **Decisão:** Pino (mais rápido, menos overhead)

#### FRONTEND

**Next.js 14**
- ✅ **Por quê:** React com SSR, App Router moderno, otimizações automáticas
- ✅ **Alternativas:** Vite + React, Remix
- ✅ **Decisão:** Next.js pela maturidade e features enterprise

**TailwindCSS**
- ✅ **Por quê:** Utility-first, customizável, desenvolvimento rápido
- ✅ **Uso:** Estilização de todos os componentes

**Shadcn/ui**
- ✅ **Por quê:** Componentes acessíveis, bonitos, customizáveis (não é biblioteca!)
- ✅ **Uso:** Base para Design System próprio

**React Query (TanStack Query)**
- ✅ **Por quê:** Cache inteligente, sincronização de estado servidor
- ✅ **Uso:** Gerenciar dados de conversas, mensagens, usuários

**Zustand**
- ✅ **Por quê:** State management leve, sem boilerplate
- ✅ **Uso:** Estado local (UI, filtros, preferências)

#### DEVOPS

**Docker + Docker Compose**
- ✅ **Por quê:** Ambientes reproduzíveis, deploy consistente
- ✅ **Uso:** Containerizar backend, frontend, PostgreSQL, Redis

**GitHub Actions**
- ✅ **Por quê:** CI/CD nativo do GitHub, gratuito para repositórios privados
- ✅ **Uso:** Testes automatizados, build, deploy

---

## 📊 MODELO DE DADOS (Database Schema)

### Entidades Principais

```prisma
// Simplificado para documentação - schema completo em prisma/schema.prisma

User (Usuário/Atendente)
├── id: UUID
├── email: String (único)
├── password: String (hash bcrypt)
├── name: String
├── role: Enum (ADMIN, ATTENDANT)
├── status: Enum (ACTIVE, INACTIVE)
├── createdAt: DateTime
└── conversations: Conversation[]

Contact (Contato do WhatsApp)
├── id: UUID
├── phoneNumber: String (único, formato: 5511999999999)
├── name: String?
├── profilePictureUrl: String?
├── metadata: JSON (dados extras)
├── createdAt: DateTime
└── conversations: Conversation[]

Conversation (Conversa/Ticket)
├── id: UUID
├── contactId: UUID (FK)
├── assignedToId: UUID? (FK User)
├── status: Enum (OPEN, IN_PROGRESS, WAITING, CLOSED)
├── priority: Enum (LOW, MEDIUM, HIGH, URGENT)
├── tags: Tag[]
├── lastMessageAt: DateTime
├── createdAt: DateTime
├── closedAt: DateTime?
└── messages: Message[]

Message (Mensagem)
├── id: UUID
├── conversationId: UUID (FK)
├── whatsappMessageId: String (único)
├── direction: Enum (INBOUND, OUTBOUND)
├── type: Enum (TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT, LOCATION)
├── content: String (texto ou URL do media)
├── metadata: JSON (dados do WhatsApp)
├── status: Enum (SENT, DELIVERED, READ, FAILED)
├── sentBy: UUID? (FK User, se OUTBOUND)
├── timestamp: DateTime
└── createdAt: DateTime

Tag (Etiqueta/Label)
├── id: UUID
├── name: String
├── color: String (hex)
└── conversations: Conversation[]
```

### Relacionamentos
- **User ↔ Conversation**: 1:N (um atendente pode ter várias conversas)
- **Contact ↔ Conversation**: 1:N (um contato pode ter várias conversas)
- **Conversation ↔ Message**: 1:N (uma conversa tem várias mensagens)
- **Conversation ↔ Tag**: N:N (conversas podem ter várias tags)

---

## 🔐 SEGURANÇA

### Camadas de Segurança Implementadas

#### 1. Autenticação
```
JWT (Access Token) - Expira em 15min
└── Refresh Token - Expira em 7 dias
    └── Armazenado em httpOnly cookie
```

**Por quê JWT?**
- Stateless (escalável)
- Padrão da indústria
- Fácil integração com n8n

#### 2. Autorização
```
Role-Based Access Control (RBAC)
├── ADMIN: Acesso total
└── ATTENDANT: Apenas suas conversas
```

#### 3. WhatsApp Webhook Security
```
Meta envia:
├── X-Hub-Signature-256: HMAC SHA256
└── Validamos com App Secret
```

**Proteção contra:**
- ❌ Webhooks falsos
- ❌ Replay attacks
- ❌ Man-in-the-middle

#### 4. Rate Limiting
```
Express Rate Limit:
├── Login: 5 tentativas/15min
├── API Geral: 100 req/min
└── Webhooks: 1000 req/min (WhatsApp pode enviar muito)
```

#### 5. Validação de Dados
```
Todas as rotas usam Zod:
├── Validação de tipos
├── Sanitização
└── Erro amigável se inválido
```

#### 6. Headers de Segurança
```
Helmet.js adiciona:
├── X-Content-Type-Options: nosniff
├── X-Frame-Options: DENY
├── X-XSS-Protection: 1; mode=block
├── Content-Security-Policy
└── HTTPS Strict Transport Security
```

#### 7. Senhas
```
bcrypt com salt rounds: 12
└── Impossível de reverter
```

#### 8. CORS
```
Configuração restrita:
├── Origin: apenas frontend autorizado
└── Credentials: true (cookies)
```

---

## 🚀 FLUXO DE DADOS

### 1️⃣ Cliente envia mensagem no WhatsApp

```
[Cliente WhatsApp]
    │
    │ Envia mensagem
    ▼
[WhatsApp Business API]
    │
    │ POST /webhooks/whatsapp
    │ Headers:
    │   X-Hub-Signature-256: <hash>
    │ Body:
    │   { object: "whatsapp_business_account",
    │     entry: [...] }
    ▼
[Backend - Webhook Handler]
    │
    ├─ Valida assinatura HMAC
    ├─ Extrai dados da mensagem
    ├─ Busca/cria contato
    ├─ Busca/cria conversa
    ├─ Salva mensagem no PostgreSQL
    │
    ▼
[Backend - WebSocket]
    │
    ├─ Emite evento "new_message"
    │   para atendentes conectados
    │
    ▼
[Frontend CRM]
    │
    ├─ Recebe via WebSocket
    ├─ Atualiza UI em tempo real
    └─ Mostra notificação
```

### 2️⃣ Atendente responde pelo CRM

```
[Frontend CRM]
    │
    │ Atendente digita e envia
    │ POST /api/messages
    │ Body:
    │   { conversationId: "...",
    │     content: "Olá! Como posso ajudar?" }
    ▼
[Backend - API Handler]
    │
    ├─ Valida JWT
    ├─ Verifica se conversa pertence ao atendente
    ├─ Valida dados com Zod
    │
    ▼
[Backend - QueueService]
    │
    ├─ Adiciona à fila Bull
    │   (processamento assíncrono)
    │
    ▼
[Backend - WhatsAppService]
    │
    ├─ POST https://graph.facebook.com/v21.0/.../messages
    │   Headers:
    │     Authorization: Bearer <access_token>
    │   Body:
    │     { messaging_product: "whatsapp",
    │       to: "5511999999999",
    │       text: { body: "..." } }
    │
    ▼
[WhatsApp Business API]
    │
    ├─ Processa e envia
    ├─ Retorna message_id
    │
    ▼
[Backend]
    │
    ├─ Salva mensagem no PostgreSQL
    │   status: SENT
    ├─ Emite evento WebSocket
    │
    ▼
[Frontend CRM]
    │
    └─ Atualiza UI com mensagem enviada
```

### 3️⃣ Automação n8n envia mensagem

```
[n8n Workflow]
    │
    │ Trigger: Novo check-in no PMS
    │
    ▼
[n8n HTTP Request Node]
    │
    │ POST https://api.seucrm.com/api/n8n/send-message
    │ Headers:
    │   Authorization: Bearer <api_key>
    │ Body:
    │   { phoneNumber: "5511999999999",
    │     message: "Seu check-in foi confirmado!" }
    ▼
[Backend - API N8N]
    │
    ├─ Valida API Key
    ├─ Valida dados
    ├─ Adiciona à fila
    │
    ▼
[Mesmo fluxo de envio WhatsApp]
```

---

## 📂 ESTRUTURA DE PASTAS

### Monorepo Completo

```
projeto-hoteis-reserva/
│
├── docs/                          # 📚 Documentação completa
│   ├── ARQUITETURA.md             # Este arquivo
│   ├── API-REFERENCE.md           # Documentação de API
│   ├── DEPLOY-GUIDE.md            # Guia de deploy
│   └── DEVELOPMENT.md             # Guia de desenvolvimento
│
├── apps/
│   │
│   ├── backend/                   # 🔧 API Node.js
│   │   ├── src/
│   │   │   ├── config/            # Configurações (database, redis, etc)
│   │   │   ├── controllers/       # Controllers (Express routes)
│   │   │   ├── services/          # Business logic
│   │   │   ├── repositories/      # Data access (Prisma)
│   │   │   ├── middlewares/       # Auth, validation, error handling
│   │   │   ├── utils/             # Helpers, constants
│   │   │   ├── types/             # TypeScript types
│   │   │   ├── validators/        # Zod schemas
│   │   │   ├── websocket/         # Socket.io handlers
│   │   │   ├── queues/            # Bull jobs
│   │   │   └── server.ts          # Entry point
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Database schema
│   │   │   ├── migrations/        # SQL migrations
│   │   │   └── seed.ts            # Dados iniciais
│   │   │
│   │   ├── tests/                 # Jest tests
│   │   ├── .env.example
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── frontend/                  # 🎨 Next.js CRM
│       ├── src/
│       │   ├── app/               # Next.js App Router
│       │   │   ├── (auth)/        # Rotas de autenticação
│       │   │   │   └── login/
│       │   │   ├── (dashboard)/   # Rotas protegidas
│       │   │   │   ├── conversations/
│       │   │   │   ├── analytics/
│       │   │   │   └── settings/
│       │   │   └── layout.tsx
│       │   │
│       │   ├── components/        # React components
│       │   │   ├── ui/            # Shadcn/ui base
│       │   │   ├── kanban/        # Kanban board
│       │   │   ├── chat/          # Chat interface
│       │   │   └── layout/        # Layout components
│       │   │
│       │   ├── hooks/             # Custom React hooks
│       │   ├── lib/               # Utils, API client
│       │   ├── stores/            # Zustand stores
│       │   ├── styles/            # Global CSS
│       │   └── types/             # TypeScript types
│       │
│       ├── public/                # Static assets
│       ├── .env.local.example
│       ├── package.json
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── Dockerfile
│
├── packages/                      # 📦 Shared packages
│   ├── shared-types/              # Types compartilhados
│   ├── ui-components/             # Componentes compartilhados
│   └── config/                    # ESLint, Prettier, TS configs
│
├── infra/                         # 🐳 Infraestrutura
│   ├── docker/
│   │   ├── backend.Dockerfile
│   │   ├── frontend.Dockerfile
│   │   └── nginx.conf
│   └── docker-compose.yml
│
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Tests e linting
│       └── deploy.yml             # Deploy automático
│
├── .gitignore
├── README.md
└── package.json                   # Root package (workspace)
```

---

## 🎯 DECISÕES ARQUITETURAIS (ADRs)

### ADR-001: Monorepo vs Multi-repo
**Decisão:** Monorepo
**Razão:**
- ✅ Compartilhamento fácil de types entre backend/frontend
- ✅ Deploy atômico (uma versão)
- ✅ Mais fácil de manter para equipe pequena
- ❌ Contra: Repo maior, mas irrelevante para este projeto

### ADR-002: REST vs GraphQL
**Decisão:** REST
**Razão:**
- ✅ Mais simples para integração n8n
- ✅ Melhor documentação com OpenAPI/Swagger
- ✅ Time tem mais experiência
- ❌ Contra: GraphQL seria mais flexível, mas over-engineering

### ADR-003: Fila de Mensagens
**Decisão:** Bull + Redis
**Razão:**
- ✅ Retry automático se WhatsApp API falhar
- ✅ Rate limiting (WhatsApp tem limites)
- ✅ Escalável (pode adicionar workers)
- ✅ Persistência com Redis

### ADR-004: Realtime: WebSocket vs Polling
**Decisão:** WebSocket (Socket.io)
**Razão:**
- ✅ Latência baixíssima
- ✅ Menos requests ao servidor
- ✅ Melhor UX para chat
- ❌ Contra: Mais complexo, mas vale a pena

### ADR-005: Database
**Decisão:** PostgreSQL
**Razão:**
- ✅ ACID transactions (importante para mensagens)
- ✅ JSON fields (metadata flexível)
- ✅ Maduro, confiável, open-source
- ✅ Índices poderosos para busca

---

## 🔄 PRÓXIMOS PASSOS

1. ✅ **FASE 1:** Documentação (você está aqui!)
2. ⏳ **FASE 2:** Criar estrutura de pastas e configurações
3. ⏳ **FASE 3:** Desenvolver Backend API
4. ⏳ **FASE 4:** Desenvolver Frontend CRM
5. ⏳ **FASE 5:** Integração n8n
6. ⏳ **FASE 6:** Docker e DevOps
7. ⏳ **FASE 7:** Testes e Segurança
8. ⏳ **FASE 8:** Deploy em VPS

---

## 📚 REFERÊNCIAS

- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Prisma Best Practices](https://www.prisma.io/docs/guides)
- [Next.js App Router](https://nextjs.org/docs/app)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [12 Factor App](https://12factor.net/)

---

**PRÓXIMO DOCUMENTO:** `DOCS-DESENVOLVIMENTO.md` (Como desenvolver cada parte)
