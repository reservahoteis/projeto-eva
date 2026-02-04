# CRM Hoteis Reserva

> SaaS multi-tenant para atendimento automatizado via WhatsApp, focado em hoteis e pousadas brasileiras.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Production](https://img.shields.io/badge/Production-Live-success.svg)](https://hoteisreserva.com.br)

## Producao

| Servico | URL |
|---------|-----|
| Frontend | https://hoteisreserva.com.br |
| API | https://api.hoteisreserva.com.br |
| VPS | 72.61.39.235 (Ubuntu 24.04) |

---

## Arquitetura

```
                    +------------------+
                    |   CLIENTE        |
                    |   WhatsApp       |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   META CLOUD     |
                    |   WhatsApp API   |
                    +--------+---------+
                             | Webhook
          +------------------+------------------+
          |                                     |
+---------v---------+               +-----------v-----------+
|                   |   forward    |                       |
|   BACKEND (VPS)   +------------->+   N8N (Automacoes)    |
|   Express + TS    |              |   IA + Fluxos         |
|   72.61.39.235    |<-------------+                       |
|                   |   API calls  +-----------------------+
+---------+---------+
          |
+---------v---------+      +-------------------+
|   PostgreSQL 16   |      |   Redis + Bull    |
|   Prisma ORM      |      |   Filas/Cache     |
+-------------------+      +-------------------+
          |
+---------v---------+
|   Socket.io       |
|   Real-time       |
+-------------------+
          |
+---------v---------+
|   FRONTEND        |
|   Next.js 14      |
|   Vercel          |
+-------------------+
```

---

## Stack Tecnologico

### Backend
| Tecnologia | Uso |
|------------|-----|
| Node.js 20 | Runtime |
| TypeScript 5 | Linguagem |
| Express 4 | Framework HTTP |
| Prisma 5 | ORM + Migrations |
| PostgreSQL 16 | Banco principal |
| Redis 7 + BullMQ | Cache + Filas |
| Socket.io | Real-time |
| Zod | Validacao |
| Pino | Logging |

### Frontend
| Tecnologia | Uso |
|------------|-----|
| Next.js 14 | Framework (App Router) |
| TailwindCSS | Estilizacao |
| Radix UI | Componentes acessiveis |
| TanStack Query | Cache e data fetching |
| Zustand | Estado global |
| Socket.io Client | Real-time |

### Integracoes
| Servico | Funcao |
|---------|--------|
| WhatsApp Cloud API | Mensagens |
| N8N | Automacoes e IA |
| Vercel | Deploy frontend |

---

## Estrutura do Projeto

```
projeto-hoteis-reserva/
├── apps/
│   └── frontend/              # Next.js 14 (App Router)
│       ├── src/
│       │   ├── app/           # Pages e routes
│       │   │   ├── dashboard/ # Area autenticada
│       │   │   └── admin/     # Area SUPER_ADMIN
│       │   ├── components/    # Componentes React
│       │   ├── contexts/      # Auth, Socket, Theme
│       │   ├── hooks/         # Custom hooks
│       │   ├── services/      # API clients
│       │   └── types/         # TypeScript types
│       └── public/
│
├── deploy-backend/            # Backend Express
│   ├── src/
│   │   ├── config/           # Database, logger, redis, socket
│   │   ├── controllers/      # Request handlers
│   │   ├── middlewares/      # Auth, tenant, rate-limit
│   │   ├── services/         # Business logic
│   │   ├── queues/           # BullMQ workers
│   │   ├── routes/           # API routes
│   │   ├── validators/       # Zod schemas
│   │   └── utils/            # Helpers
│   ├── prisma/               # Schema + migrations
│   └── docker-compose.production.yml
│
├── docs/                      # Documentacao
│
└── .claude/                   # Claude Code config
    ├── agents/               # Agentes especializados
    ├── skills/               # Skills do projeto
    └── CLAUDE.md             # Instrucoes principais
```

---

## Sistema de Roles

| Role | Descricao | Acesso |
|------|-----------|--------|
| **SUPER_ADMIN** | Administrador do SaaS | Todos os tenants |
| **TENANT_ADMIN** | Admin do hotel | Seu tenant, gerencia usuarios |
| **HEAD** | Supervisor | Seu tenant, ve todas conversas |
| **ATTENDANT** | Atendente | Conversas da sua unidade |
| **SALES** | Comercial | Apenas oportunidades de venda |

---

## Fluxo de Atendimento

```
1. Cliente envia mensagem no WhatsApp
              ↓
2. Meta envia webhook para Backend
              ↓
3. Backend salva mensagem e encaminha para N8N
              ↓
4. N8N processa com IA (se iaLocked=false)
              ↓
5. IA responde automaticamente OU escala para humano
              ↓
6. Se escalou: Socket.io notifica atendentes em tempo real
              ↓
7. Atendente assume conversa no dashboard Kanban
              ↓
8. Quando atendente assume: iaLocked=true (IA para de responder)
```

---

## Quick Start

### Pre-requisitos

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- pnpm

### Desenvolvimento Local

```bash
# Clonar repositorio
git clone <repo-url>
cd projeto-hoteis-reserva

# Backend (terminal 1)
cd deploy-backend
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma migrate dev
pnpm dev

# Frontend (terminal 2)
cd apps/frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

---

## API Endpoints

### Autenticacao
```
POST /api/auth/login          # Login
POST /api/auth/register       # Registro
POST /api/auth/refresh        # Refresh token
GET  /api/auth/me             # Usuario atual
```

### Conversas
```
GET  /api/conversations                    # Listar
GET  /api/conversations/:id                # Detalhes
GET  /api/conversations/:id/messages       # Mensagens
POST /api/conversations/:id/messages       # Enviar mensagem
PUT  /api/conversations/:id/assign         # Atribuir atendente
PUT  /api/conversations/:id/status         # Mudar status
```

### Contatos
```
GET  /api/contacts            # Listar
POST /api/contacts            # Criar
PUT  /api/contacts/:id        # Atualizar
```

### N8N (Integracoes)
```
POST /api/n8n/send-text       # Enviar texto
POST /api/n8n/send-buttons    # Enviar botoes
POST /api/n8n/send-carousel   # Enviar carousel
POST /api/n8n/send-list       # Enviar lista
POST /api/n8n/escalate        # Escalar para humano
GET  /api/n8n/check-ia-lock   # Verificar se IA pode responder
POST /api/n8n/mark-followup-sent   # Marcar follow-up (cria oportunidade)
POST /api/n8n/mark-opportunity     # Atualizar oportunidade
```

### Webhooks
```
GET  /api/webhooks/whatsapp   # Verificacao Meta
POST /api/webhooks/whatsapp   # Receber eventos
```

---

## WebSocket (Socket.io)

```typescript
// Conectar
const socket = io(API_URL, {
  auth: { token: accessToken }
});

// Entrar em conversa
socket.emit('join:conversation', conversationId);

// Eventos recebidos
socket.on('message:new', (message) => { ... });
socket.on('message:status', (update) => { ... });
socket.on('conversation:updated', (conversation) => { ... });
socket.on('escalation:new', (escalation) => { ... });
```

---

## Deploy

### Frontend (Vercel)
```bash
# Automatico - push para main
git push origin main
```

### Backend (VPS)
```bash
# CI/CD automatico via GitHub Actions
# Ou manual:
ssh root@72.61.39.235
cd /root/deploy-backend
docker compose -f docker-compose.production.yml up -d --build
```

---

## Variaveis de Ambiente

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=https://api.hoteisreserva.com.br
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://hoteisreserva.com.br
```

### Backend (VPS)
```env
DATABASE_URL=postgresql://user:pass@crm-postgres:5432/crm_production
REDIS_URL=redis://crm-redis:6379
JWT_SECRET=<secret>
ENCRYPTION_KEY=<key>
WHATSAPP_VERIFY_TOKEN=<token>
```

---

## Multi-Tenant

O sistema isola dados por tenant. **TODA query deve filtrar por tenantId:**

```typescript
// CORRETO
const conversations = await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId, // OBRIGATORIO
    status: 'OPEN',
  },
});

// ERRADO - vazamento de dados!
const conversations = await prisma.conversation.findMany({
  where: { status: 'OPEN' },
});
```

---

## Status do Projeto

| Componente | Status |
|------------|--------|
| Backend API | Producao |
| Frontend Dashboard | Producao |
| WhatsApp Integration | Producao |
| Multi-Tenant | Producao |
| Real-time (Socket.io) | Producao |
| IA via N8N | Producao |
| Perfil SALES | Producao |
| CI/CD | Producao |

---

## Roadmap

- [ ] Gestao de quartos/reservas
- [ ] Dashboard de metricas
- [ ] Integracao OTAs (Booking, Expedia)
- [ ] App mobile
- [ ] Multi-WABA (multiplos WhatsApp)

---

## Licenca

Proprietario - Todos os direitos reservados.

---

Desenvolvido pela area de Tecnologia - Hoteis Reserva
