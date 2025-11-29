# WhatsApp CRM SaaS Multi-Tenant

> Sistema completo de CRM com integracao WhatsApp Business API para gestao de multiplos hoteis

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Production](https://img.shields.io/badge/Production-Live-success.svg)](https://crm.botreserva.com.br)

## Producao

| Servico | URL |
|---------|-----|
| Frontend | https://crm.botreserva.com.br |
| API | https://api.botreserva.com.br |
| VPS | 72.61.39.235 (Ubuntu 24.04) |

## Stack Tecnologico

### Backend
- **Runtime:** Node.js 20 LTS
- **Language:** TypeScript 5
- **Framework:** Express 4
- **ORM:** Prisma 5
- **Database:** PostgreSQL 16
- **Cache/Queue:** Redis 7 + Bull
- **Realtime:** Socket.io

### Frontend
- **Framework:** Next.js 14 (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **State:** React Query + Zustand
- **Deploy:** Vercel

## Estrutura do Projeto

```
projeto-hoteis-reserva/
├── apps/
│   └── frontend/           # Next.js 14 (App Router)
│       ├── src/
│       │   ├── app/        # App Router pages
│       │   ├── components/ # React components
│       │   ├── hooks/      # Custom hooks
│       │   ├── lib/        # Utilities
│       │   ├── services/   # API clients
│       │   └── types/      # TypeScript types
│       └── public/
│
├── deploy-backend/         # Backend Node.js/Express
│   ├── src/
│   │   ├── config/        # Configuracoes
│   │   ├── controllers/   # Request handlers
│   │   ├── middlewares/   # Auth, validation, tenant
│   │   ├── services/      # Business logic
│   │   ├── queues/        # Bull workers
│   │   ├── routes/        # API routes
│   │   ├── validators/    # Zod schemas
│   │   └── utils/         # Helpers
│   ├── prisma/            # Schema + migrations
│   └── docker-compose.production.yml
│
├── docs/                   # Documentacao organizada
│   ├── api/               # API endpoints e WebSocket
│   ├── architecture/      # Arquitetura do sistema
│   ├── changelogs/        # Historico de mudancas
│   ├── deployment/        # Guias de deploy
│   ├── guides/            # Tutoriais e guias praticos
│   ├── meta-setup/        # Configuracao Meta/WhatsApp
│   ├── migrations/        # Guias de migracao
│   ├── reports/           # Relatorios e auditorias
│   ├── sessions/          # Logs de desenvolvimento
│   └── whatsapp/          # Docs especificos WhatsApp
│
└── .claude/               # Configuracoes Claude Code
    ├── agents/            # Agentes especializados
    └── commands/          # Slash commands
```

## Quick Start

### Pre-requisitos

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- pnpm (recomendado)

### Desenvolvimento Local

```bash
# Clonar e instalar
git clone https://github.com/fredcast/projeto-eva.git
cd projeto-eva
pnpm install

# Backend (terminal 1)
cd deploy-backend
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev

# Frontend (terminal 2)
cd apps/frontend
cp .env.example .env.local
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

### Deploy Producao

```bash
# Backend - VPS via SSH
ssh root@72.61.39.235
cd /root/deploy-backend
docker compose -f docker-compose.production.yml up -d --build

# Frontend - Automatico via Vercel (push para GitHub)
git push origin master
```

## API Endpoints Principais

### Autenticacao
```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

### Conversas
```
GET  /api/conversations
GET  /api/conversations/:id
POST /api/conversations/:id/messages
```

### Contatos
```
GET  /api/contacts
POST /api/contacts
PUT  /api/contacts/:id
```

### Webhooks WhatsApp
```
GET  /api/webhooks/whatsapp      # Verificacao Meta
POST /api/webhooks/whatsapp      # Eventos
```

## WebSocket (Socket.io)

```typescript
// Eventos
socket.emit('join:conversation', conversationId);
socket.on('message:new', (message) => { ... });
socket.on('message:status', (update) => { ... });
```

## Documentacao

Ver pasta [docs/](docs/README.md) para documentacao completa:

- [Quickstart](docs/guides/QUICKSTART.md)
- [API Endpoints](docs/api/API-ENDPOINTS.md)
- [Deploy Guide](docs/deployment/DEPLOY-SETUP.md)
- [Arquitetura](docs/architecture/ARCHITECTURE.md)

## Status do Projeto

| Componente | Status |
|------------|--------|
| Backend API | ✅ Producao |
| Frontend Dashboard | ✅ Producao |
| WhatsApp Integration | ✅ Producao |
| Multi-Tenant | ✅ Producao |
| Realtime (Socket.io) | ✅ Producao |
| Media (Audio/Image/Video) | ✅ Producao |
| Kanban Pipeline | ✅ Producao |

## Licenca

MIT - Ver [LICENSE](LICENSE)

---

Desenvolvido por [@fredcast](https://github.com/fredcast)
