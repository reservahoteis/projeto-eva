# 📋 DOCUMENTAÇÃO COMPLETA DO PROJETO
## CRM WhatsApp SaaS Multi-Tenant - Backend API

**Data de criação:** 10/11/2025
**Versão:** 1.0.0
**Status:** ✅ PRODUÇÃO - FUNCIONANDO

---

## 📌 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura e Infraestrutura](#arquitetura-e-infraestrutura)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Estrutura de Diretórios](#estrutura-de-diretórios)
5. [Diretórios Ativos vs. Não Utilizados](#diretórios-ativos-vs-não-utilizados)
6. [Configurações Críticas](#configurações-críticas)
7. [O Que Foi Implementado](#o-que-foi-implementado)
8. [O Que Precisa Ser Feito](#o-que-precisa-ser-feito)
9. [Regras e Padrões OBRIGATÓRIOS](#regras-e-padrões-obrigatórios)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

### Propósito
Sistema SaaS multi-tenant para gestão de atendimento via WhatsApp Business API, com isolamento de dados por tenant, autenticação JWT, e integração com Meta WhatsApp Cloud API.

### Modelo de Deploy
**IMPORTANTE:** Este projeto utiliza **deploy separado** (backend standalone):
- ❌ **NÃO é monorepo** (não use a estrutura packages/ do diretório raiz)
- ✅ **Backend standalone** em `/deploy-backend/`
- ✅ **Deploy em VPS** no diretório `/opt/`

### URLs de Acesso
- **Produção (VPS):** http://72.61.39.235
- **Backend API:** http://72.61.39.235/auth/*, http://72.61.39.235/api/*
- **Health Check:** http://72.61.39.235/health

### Credenciais de Teste
```json
{
  "url": "http://72.61.39.235/auth/login",
  "headers": {
    "Content-Type": "application/json",
    "X-Tenant-Slug": "smarthoteis"
  },
  "body": {
    "email": "admin@smarthoteis.com",
    "password": "secret123"
  }
}
```

---

## 🏗️ ARQUITETURA E INFRAESTRUTURA

### Diagrama de Containers Docker

```
┌─────────────────────────────────────────────────────┐
│                VPS: 72.61.39.235                    │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐        │
│  │   Nginx      │◄────────│   Certbot    │        │
│  │  (Port 80)   │         │    (SSL)     │        │
│  └──────┬───────┘         └──────────────┘        │
│         │                                          │
│         ▼                                          │
│  ┌──────────────┐                                 │
│  │   Backend    │                                 │
│  │ (Node.js)    │                                 │
│  │  Port 3001   │                                 │
│  └──┬────────┬──┘                                 │
│     │        │                                     │
│     ▼        ▼                                     │
│  ┌─────┐  ┌─────┐                                │
│  │ PG  │  │Redis│                                 │
│  │ SQL │  │     │                                 │
│  └─────┘  └─────┘                                 │
└─────────────────────────────────────────────────────┘
```

### Containers Ativos

| Container      | Image              | Status   | Porta            | Função                        |
|----------------|-------------------|----------|------------------|-------------------------------|
| crm-nginx      | nginx:alpine      | Healthy  | 80, 443          | Reverse Proxy + Load Balancer |
| crm-backend    | opt-backend       | Healthy  | 3001 (interno)   | API Node.js + Express         |
| crm-postgres   | postgres:16-alpine| Healthy  | 5432 (interno)   | Banco de Dados Relacional     |
| crm-redis      | redis:7-alpine    | Healthy  | 6379 (interno)   | Cache + Queue Manager         |
| crm-certbot    | certbot/certbot   | Running  | -                | Gerenciamento SSL/TLS         |

---

## 🔧 STACK TECNOLÓGICO

### Backend Runtime & Framework
- **Node.js:** 20.x LTS
- **TypeScript:** 5.3.3
- **Express.js:** 4.18.2
- **Package Manager:** pnpm 10.20.0

### Banco de Dados & ORM
- **PostgreSQL:** 16-alpine
- **Prisma ORM:** 5.7.0
- **Redis:** 7-alpine (cache + queues)

### Autenticação & Segurança
- **JWT:** jsonwebtoken 9.0.2
- **bcrypt:** 5.1.1 (hash de senhas)
- **helmet:** 7.1.0 (security headers)
- **cors:** 2.8.5
- **express-rate-limit:** 7.1.5

### Validação & Tipo Checking
- **Zod:** 3.22.4 (schema validation)
- **TypeScript:** strict mode

### Queue & Background Jobs
- **Bull:** 4.12.0 (Redis-based queues)
- **ioredis:** 5.3.2

### Logging & Monitoring
- **Pino:** 8.16.2 (structured logging)
- **pino-pretty:** 10.3.0 (dev formatting)

### API Integration
- **Axios:** 1.6.2 (HTTP client para Meta WhatsApp API)
- **Socket.io:** 4.6.1 (WebSocket real-time)

### DevOps & Deploy
- **Docker:** Multi-stage builds
- **Docker Compose:** 3.8
- **Nginx:** alpine (reverse proxy)
- **Certbot:** Let's Encrypt SSL

---

## 📁 ESTRUTURA DE DIRETÓRIOS

### ⚠️ DIRETÓRIO ATIVO (USAR ESTE)

```
C:/Users/55489/Desktop/projeto-hoteis-reserva/deploy-backend/
│
├── src/                           # ✅ Código-fonte TypeScript
│   ├── config/                    # Configurações (DB, Redis, Logger, Env)
│   │   ├── database.ts            # Prisma Client + Connection Pool
│   │   ├── redis.ts               # Redis Client (ioredis)
│   │   ├── logger.ts              # Pino Logger Setup
│   │   └── env.ts                 # Environment Variables (Zod validation)
│   │
│   ├── middlewares/               # ✅ Express Middlewares
│   │   ├── tenant.middleware.ts   # 🔴 CRÍTICO: Isolamento multi-tenant
│   │   ├── auth.middleware.ts     # JWT Authentication
│   │   ├── error-handler.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   └── validate.middleware.ts # Zod Schema Validation
│   │
│   ├── controllers/               # Request Handlers
│   │   ├── auth.controller.ts
│   │   ├── tenant.controller.ts
│   │   ├── conversation.controller.ts
│   │   └── message.controller.ts
│   │
│   ├── services/                  # Business Logic
│   │   ├── auth.service.ts
│   │   ├── tenant.service.ts
│   │   ├── whatsapp.service.ts    # Meta WhatsApp API Integration
│   │   └── message.service.ts
│   │
│   ├── repositories/              # Data Access Layer (Prisma)
│   │   ├── tenant.repository.ts
│   │   ├── user.repository.ts
│   │   └── conversation.repository.ts
│   │
│   ├── routes/                    # Express Routes
│   │   ├── auth.routes.ts
│   │   ├── tenant.routes.ts
│   │   ├── conversation.routes.ts
│   │   ├── message.routes.ts
│   │   └── webhook.routes.ts      # WhatsApp Webhook
│   │
│   ├── validators/                # Zod Schemas
│   │   ├── auth.validator.ts
│   │   └── tenant.validator.ts
│   │
│   ├── queues/                    # Bull Queue Jobs
│   │   └── message.queue.ts
│   │
│   ├── websocket/                 # Socket.io Handlers
│   │   └── socket-handler.ts
│   │
│   ├── utils/                     # Helpers & Utilities
│   │   ├── errors.ts              # Custom Error Classes
│   │   └── async-storage.ts       # AsyncLocalStorage para tenant context
│   │
│   ├── types/                     # TypeScript Type Definitions
│   │   └── express.d.ts           # Extend Express Request
│   │
│   └── server.ts                  # 🔴 ENTRY POINT - Express App Setup
│
├── prisma/                        # ✅ Prisma ORM
│   ├── schema.prisma              # Database Schema
│   ├── migrations/                # SQL Migration History
│   └── seed.ts                    # Database Seeding
│
├── Dockerfile.standalone          # 🔴 USAR ESTE (multi-stage build)
├── docker-compose.production.yml  # Orquestração de containers
├── package.json                   # Dependencies + Scripts
├── pnpm-lock.yaml                 # Lock file do pnpm
├── tsconfig.json                  # TypeScript Config (dev)
├── tsconfig.production.json       # 🔴 TypeScript Config (build produção)
├── .env.production.example        # Template de variáveis
└── .dockerignore                  # Arquivos ignorados no build Docker
```

### 🚫 DIRETÓRIOS NÃO UTILIZADOS (IGNORAR)

```
C:/Users/55489/Desktop/projeto-hoteis-reserva/
│
├── packages/                      # ❌ NÃO USAR - Estrutura monorepo antiga
│   ├── backend/                   # ❌ DESATUALIZADO
│   └── shared/                    # ❌ DESATUALIZADO
│
├── apps/                          # ❌ NÃO USAR
│
└── docker-compose.yml             # ❌ NÃO USAR - Apenas para dev local antigo
```

**⚠️ REGRA CRÍTICA:**
- **SEMPRE trabalhar em:** `deploy-backend/`
- **NUNCA modificar:** `packages/backend/` ou `apps/`

---

## 🚀 DEPLOY NA VPS (Diretório Ativo em Produção)

```
/opt/                              # ✅ Diretório de deploy na VPS
│
├── src/                           # Código-fonte (sync do deploy-backend/src)
├── prisma/                        # Schema + Migrations
├── node_modules/                  # Dependencies instaladas
├── dist/                          # 🔴 TypeScript compilado (gerado no build)
│
├── nginx/                         # Configurações Nginx
│   ├── nginx.conf
│   └── conf.d/
│       └── api.conf               # Proxy reverso para backend:3001
│
├── certbot/                       # Certificados SSL
│   ├── conf/
│   └── www/
│
├── backups/                       # Backups do PostgreSQL
│
├── Dockerfile.standalone          # Build da imagem Docker
├── docker-compose.production.yml  # Orquestração
├── .env.production                # 🔴 Variáveis de ambiente REAIS (secretas)
├── package.json
└── pnpm-lock.yaml
```

### Workflow de Deploy

```bash
# 1. Desenvolvimento local (C:/Users/.../deploy-backend/)
npm run build    # Compila TypeScript

# 2. Transfer para VPS
scp -r deploy-backend/* root@72.61.39.235:/opt/

# 3. Build e Deploy na VPS
ssh root@72.61.39.235
cd /opt
docker compose -f docker-compose.production.yml up -d --build backend
```

---

## ⚙️ CONFIGURAÇÕES CRÍTICAS

### 1. Tenant Isolation Middleware

**Arquivo:** `src/middlewares/tenant.middleware.ts`

**REGRA FUNDAMENTAL:**
```typescript
// Ordem de prioridade para identificar o tenant:
// 1. Header X-Tenant-Slug (produção via nginx ou client direto)
// 2. Query param ?tenant=slug (testes)
// 3. Subdomínio do host (fallback, não funciona com IP)
```

**Código Atual (CORRETO):**
```typescript
let subdomain: string;

// Prioridade 1: X-Tenant-Slug header
if (req.headers['x-tenant-slug']) {
  subdomain = req.headers['x-tenant-slug'] as string;
  logger.debug({ subdomain }, 'Tenant from X-Tenant-Slug header');
}
// Prioridade 2: Query param
else if (req.query.tenant) {
  subdomain = req.query.tenant as string;
  logger.debug({ subdomain }, 'Tenant from query param');
}
// Prioridade 3: Subdomínio
else {
  const parts = host.split('.');
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    subdomain = 'super-admin';
  } else {
    subdomain = parts[0] || '';
  }
}
```

**⚠️ NUNCA:**
- Remover a verificação de `X-Tenant-Slug`
- Inverter a ordem de prioridade
- Usar apenas subdomain extraction (não funciona com IPs)

### 2. Dockerfile Multi-Stage Build

**Arquivo ATIVO:** `Dockerfile.standalone`
**Arquivo OBSOLETO:** ❌ `Dockerfile` (ignorar)

**Estágios:**
1. **Builder:** Instala deps, compila TypeScript, gera Prisma Client
2. **Production:** Copia apenas dist/ e node_modules necessários

**IMPORTANTE:**
- Usa `node:20-slim` (Debian, não Alpine) porque bcrypt precisa de `python3`, `make`, `g++`
- Roda `npm rebuild bcrypt` após pnpm install
- Path alias `@/` é resolvido com `tsc-alias`

### 3. TypeScript Configuration

**Arquivo de Build:** `tsconfig.production.json` (NÃO `tsconfig.json`)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Build Command:**
```bash
tsc -p tsconfig.production.json && tsc-alias -p tsconfig.production.json
```

### 4. Prisma Schema

**Multi-Tenancy Model:**
```prisma
model Tenant {
  id        String   @id @default(uuid())
  slug      String   @unique  // URL-friendly identifier
  name      String
  status    TenantStatus @default(TRIAL)

  // WhatsApp Credentials (encrypted)
  whatsappPhoneNumberId String?
  whatsappAccessToken   String?

  users         User[]
  conversations Conversation[]
}

model User {
  id       String @id @default(uuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  email    String
  password String  // bcrypt hashed
  role     UserRole

  @@unique([tenantId, email])  // Email único POR tenant
}
```

**Migration Workflow:**
```bash
# Desenvolvimento
pnpm prisma migrate dev --name nome_da_migration

# Produção (VPS)
docker exec crm-backend pnpm prisma migrate deploy
```

### 5. Variáveis de Ambiente

**Arquivo Produção:** `/opt/.env.production`

**Variáveis Críticas:**
```env
# Database
DATABASE_URL=postgresql://crm_user:PASSWORD@postgres:5432/crm_whatsapp_saas

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=strongpassword123

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# Frontend
FRONTEND_URL=http://72.61.39.235:3000

# WhatsApp
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-webhook-token

# Node
NODE_ENV=production
PORT=3001
```

**⚠️ NUNCA:**
- Commitar `.env.production` no Git
- Usar valores default em produção
- Deixar JWT_SECRET curto (<32 caracteres)

---

## ✅ O QUE FOI IMPLEMENTADO

### 1. Infraestrutura Docker (100%)
- ✅ Docker Compose com 5 serviços orquestrados
- ✅ Health checks em todos os containers
- ✅ Volumes persistentes (PostgreSQL + Redis)
- ✅ Network bridge isolada
- ✅ Logs rotacionados (max 10MB, 3 arquivos)
- ✅ Restart policies (always)

### 2. Backend API (90%)
- ✅ Express.js server com TypeScript
- ✅ Multi-tenant middleware com isolamento de dados
- ✅ Autenticação JWT (access + refresh tokens)
- ✅ Bcrypt para hash de senhas
- ✅ Rate limiting (5 req/15min no login)
- ✅ Error handling centralizado
- ✅ Structured logging com Pino
- ✅ CORS configurado
- ✅ Security headers (Helmet)
- ✅ Request validation com Zod

### 3. Banco de Dados (100%)
- ✅ PostgreSQL 16 com Prisma ORM
- ✅ Schema multi-tenant completo
- ✅ Migrations executadas
- ✅ Indexes otimizados
- ✅ Constraints de unicidade por tenant
- ✅ Tenant "smarthoteis" criado
- ✅ Usuário admin configurado

### 4. Autenticação (100%)
- ✅ Login endpoint funcionando
- ✅ Refresh token endpoint
- ✅ Register (admin cria users)
- ✅ Change password
- ✅ GET /auth/me
- ✅ Middleware authenticate validando JWT
- ✅ Role-based access (TENANT_ADMIN, ATTENDANT)

### 5. Nginx Reverse Proxy (100%)
- ✅ Proxy reverso para backend:3001
- ✅ Headers forwarding (X-Real-IP, X-Forwarded-For)
- ✅ CORS headers
- ✅ Timeouts configurados (60s)
- ✅ Health check route

### 6. Redis (100%)
- ✅ Cache configurado
- ✅ Bull queues setup
- ✅ MaxMemory policy (256MB, allkeys-lru)
- ✅ Password authentication

### 7. Segurança (95%)
- ✅ Senhas hasheadas com bcrypt (10 rounds)
- ✅ JWT com expiração (access: 15min, refresh: 7d)
- ✅ Rate limiting no login
- ✅ Helmet security headers
- ✅ Input validation (Zod)
- ✅ SQL Injection protection (Prisma)
- ⚠️ HTTPS/SSL pendente (certbot configurado mas cert não gerado)

---

## 🔜 O QUE PRECISA SER FEITO

### Prioridade ALTA 🔴

1. **SSL/HTTPS Configuration**
   - Configurar domínio apontando para 72.61.39.235
   - Gerar certificado Let's Encrypt com Certbot
   - Atualizar nginx para forçar HTTPS
   - **Arquivo:** `/opt/nginx/conf.d/api.conf`

2. **WhatsApp Webhook Integration**
   - Implementar webhook handler em `/webhooks/whatsapp`
   - Validar signature da Meta
   - Processar eventos: `messages`, `message_status`
   - **Arquivo:** `src/routes/webhook.routes.ts`

3. **WhatsApp Message Sending**
   - Service para enviar mensagens via Meta API
   - Template messages
   - Media messages (imagens, documentos)
   - **Arquivo:** `src/services/whatsapp.service.ts`

4. **Database Backups**
   - Script de backup automático
   - Cron job diário
   - Retenção de 7 dias
   - **Localização:** `/opt/backups/`

5. **Monitoring & Alerting**
   - Logs centralizados
   - Metrics (Prometheus + Grafana?)
   - Uptime monitoring
   - Error tracking (Sentry?)

### Prioridade MÉDIA 🟡

6. **Frontend Connection**
   - Documentar API endpoints
   - Configurar FRONTEND_URL corretamente
   - Testar CORS com frontend real
   - WebSocket connection

7. **Multi-Tenant Features**
   - Tenant creation via API
   - Tenant settings management
   - Billing/subscription logic
   - Usage metrics por tenant

8. **Conversation Management**
   - Listar conversas do tenant
   - Filtros e paginação
   - Marcar como lido/não lido
   - Arquivar conversas

9. **Message Features**
   - Histórico de mensagens
   - Busca full-text
   - Anexos (upload/download)
   - Mensagens agendadas

10. **Queue Processing**
    - Worker process para Bull queues
    - Retry logic
    - Dead letter queue
    - Job monitoring

### Prioridade BAIXA 🟢

11. **Testing**
    - Unit tests (Jest)
    - Integration tests
    - E2E tests
    - Coverage >80%

12. **Documentation**
    - Swagger/OpenAPI spec
    - Postman collection
    - API documentation site
    - Deployment runbook

13. **Performance Optimization**
    - Query optimization (Prisma)
    - Caching strategy
    - CDN for assets
    - Database connection pooling

14. **DevOps Improvements**
    - CI/CD pipeline
    - Automated deployments
    - Blue-green deployment
    - Rollback strategy

---

## 🚨 REGRAS E PADRÕES OBRIGATÓRIOS

### 1. Estrutura de Código

**✅ SEMPRE:**
- Trabalhar em `deploy-backend/`
- Usar TypeScript strict mode
- Validar inputs com Zod
- Usar Prisma para queries (nunca raw SQL)
- Logar com Pino (nunca console.log em produção)
- Tratar erros com classes customizadas (`src/utils/errors.ts`)

**❌ NUNCA:**
- Modificar `packages/backend/` ou `apps/`
- Usar `any` type sem justificativa
- Commitar `.env.production`
- Fazer console.log em produção
- Fazer queries sem validar `tenantId`

### 2. Multi-Tenancy

**✅ SEMPRE:**
- Incluir `tenantId` em TODAS as queries
- Usar `req.tenantId` do middleware
- Validar tenant no controller
- Isolar dados por tenant
- Usar AsyncLocalStorage para contexto

**❌ NUNCA:**
- Query sem WHERE tenantId
- Confiar no cliente para tenantId
- Compartilhar dados entre tenants
- Expor dados de outro tenant

**Exemplo Correto:**
```typescript
// ✅ CORRETO
const conversations = await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId,  // OBRIGATÓRIO
    status: 'OPEN'
  }
});

// ❌ ERRADO - Vaza dados de todos os tenants!
const conversations = await prisma.conversation.findMany({
  where: { status: 'OPEN' }
});
```

### 3. Autenticação & Autorização

**✅ SEMPRE:**
- Usar middleware `authenticate` em rotas protegidas
- Validar role do usuário quando necessário
- Retornar 401 para não autenticado
- Retornar 403 para não autorizado
- Expirar access tokens em 15 minutos

**❌ NUNCA:**
- Retornar senha no response
- Armazenar JWT no banco
- Usar tokens sem expiração
- Confiar no payload do JWT sem verificar

### 4. Error Handling

**✅ SEMPRE:**
- Usar classes de erro customizadas
- Incluir `statusCode` e `isOperational`
- Logar erros com contexto (tenantId, userId)
- Retornar mensagens genéricas ao cliente
- Stack trace apenas em dev

**Exemplo:**
```typescript
// src/utils/errors.ts
export class UnauthorizedError extends Error {
  statusCode = 401;
  isOperational = true;

  constructor(message = 'Unauthorized') {
    super(message);
  }
}

// Controller
throw new UnauthorizedError('Invalid credentials');
```

### 5. Environment Variables

**✅ SEMPRE:**
- Validar com Zod em `src/config/env.ts`
- Usar valores default apenas em dev
- Documentar variáveis em `.env.example`
- Tipo forte para `process.env`

**❌ NUNCA:**
- Acessar `process.env` diretamente
- Hardcodear secrets no código
- Commitar arquivos `.env`

### 6. Database Migrations

**✅ SEMPRE:**
- Criar migration para TODA mudança no schema
- Testar migration em ambiente de staging
- Fazer backup antes de migrate em produção
- Nomear migrations descritivamente

**Workflow:**
```bash
# 1. Modificar prisma/schema.prisma
# 2. Criar migration
pnpm prisma migrate dev --name add_user_avatar_field

# 3. Deploy em produção
ssh root@72.61.39.235
cd /opt
docker exec crm-backend pnpm prisma migrate deploy
```

**❌ NUNCA:**
- Editar migrations já aplicadas
- Fazer ALTER TABLE manual
- Deletar arquivo de migration

### 7. TypeScript Build

**✅ SEMPRE:**
- Usar `tsconfig.production.json` para build
- Rodar `tsc-alias` após compilação
- Verificar output em `dist/`
- Manter path aliases consistentes

**Build Command:**
```bash
pnpm build
# Expande para: tsc -p tsconfig.production.json && tsc-alias -p tsconfig.production.json
```

**❌ NUNCA:**
- Buildar com `tsconfig.json` (é para dev)
- Commitar pasta `dist/`
- Usar caminhos relativos longos (`../../../`)

### 8. Docker Best Practices

**✅ SEMPRE:**
- Usar multi-stage builds
- Mínima quantidade de layers
- `.dockerignore` completo
- Health checks em TODOS os services
- Logs JSON structured

**❌ NUNCA:**
- Copiar `node_modules/` para container
- Usar `latest` tag em produção
- Rodar como root user (usar nodejs user)
- Ignorar health check failures

### 9. Git Workflow

**✅ SEMPRE:**
- Commitar em `deploy-backend/`
- Mensagens descritivas
- Um commit = uma funcionalidade
- `.gitignore` atualizado

**❌ NUNCA:**
- Commitar `.env.production`
- Commitar `node_modules/`
- Commitar `dist/`
- Fazer commits massivos sem descrição

### 10. Performance

**✅ SEMPRE:**
- Usar indexes no Prisma
- Paginar queries grandes
- Cache em Redis quando possível
- Connection pooling configurado

**❌ NUNCA:**
- SELECT * sem LIMIT
- N+1 queries (usar Prisma include)
- Queries sem indexes
- Bloquear event loop com código síncrono

---

## 🔧 TROUBLESHOOTING

### Problema: "Tenant not found"

**Causa:**
- Cliente não enviando header `X-Tenant-Slug`
- Tenant não existe no banco
- Middleware não aplicado na rota

**Solução:**
```bash
# 1. Verificar se tenant existe
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT id, slug, status FROM tenants;"

# 2. Verificar logs do backend
docker logs crm-backend | grep tenant

# 3. Testar com curl
curl -X POST http://72.61.39.235/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: smarthoteis" \
  -d '{"email":"admin@smarthoteis.com","password":"secret123"}'
```

### Problema: "Email ou senha inválidos"

**Causa:**
- Senha incorreta
- Hash bcrypt corrompido
- Usuário não existe para esse tenant

**Solução:**
```bash
# 1. Verificar usuário
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "SELECT id, email, LENGTH(password) FROM users WHERE email = 'admin@smarthoteis.com';"

# 2. Gerar novo hash de senha
docker exec crm-backend node -e \
  "const bcrypt = require('bcrypt'); bcrypt.hash('secret123', 10).then(console.log);"

# 3. Atualizar senha (copiar hash acima)
docker exec -i crm-postgres psql -U crm_user -d crm_whatsapp_saas <<EOF
UPDATE users SET password = E'\$2b\$10\$HASH_AQUI' WHERE email = 'admin@smarthoteis.com';
EOF
```

### Problema: Build Docker Falha com Erro TypeScript

**Causa:**
- Erros de compilação TypeScript
- Path aliases não resolvidos
- Dependencies faltando

**Solução:**
```bash
# 1. Build local primeiro
cd deploy-backend
pnpm install
pnpm build

# 2. Se local funciona, rebuildar Docker
ssh root@72.61.39.235
cd /opt
docker compose -f docker-compose.production.yml build --no-cache backend
docker compose -f docker-compose.production.yml up -d backend
```

### Problema: Container Reiniciando Constantemente

**Causa:**
- Erro de inicialização
- Dependências não prontas (DB/Redis)
- Porta já em uso

**Solução:**
```bash
# 1. Ver logs
docker logs crm-backend --tail 100

# 2. Verificar health checks
docker inspect crm-backend | grep -A 10 Health

# 3. Verificar network
docker network inspect opt_crm-network

# 4. Restart dependencies primeiro
docker compose -f docker-compose.production.yml restart postgres redis
sleep 10
docker compose -f docker-compose.production.yml restart backend
```

### Problema: Conexão com Postgres Falha

**Causa:**
- Container postgres não healthy
- Password incorreto
- Database não criada

**Solução:**
```bash
# 1. Verificar postgres
docker logs crm-postgres

# 2. Testar conexão manual
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT NOW();"

# 3. Verificar variáveis .env.production
cat /opt/.env.production | grep DATABASE_URL

# 4. Recrear database se necessário
docker compose -f docker-compose.production.yml down
docker volume rm opt_postgres_data  # ⚠️ APAGA DADOS!
docker compose -f docker-compose.production.yml up -d postgres
# Esperar healthy, então rodar migrations
docker exec crm-backend pnpm prisma migrate deploy
```

### Problema: Redis Connection Timeout

**Causa:**
- Redis password incorreto
- Container redis down
- MaxMemory atingido

**Solução:**
```bash
# 1. Verificar redis
docker logs crm-redis

# 2. Testar conexão
docker exec crm-redis redis-cli -a "$(grep REDIS_PASSWORD /opt/.env.production | cut -d'=' -f2)" PING

# 3. Ver uso de memória
docker exec crm-redis redis-cli -a PASSWORD INFO memory

# 4. Flush cache se necessário (⚠️ apaga cache!)
docker exec crm-redis redis-cli -a PASSWORD FLUSHALL
```

### Problema: Nginx 502 Bad Gateway

**Causa:**
- Backend container down
- Backend não respondendo na porta 3001
- Network issue entre nginx e backend

**Solução:**
```bash
# 1. Verificar backend está UP
docker ps | grep backend

# 2. Testar backend diretamente
docker exec crm-backend curl http://localhost:3001/health

# 3. Verificar nginx config
docker exec crm-nginx nginx -t

# 4. Ver logs nginx
docker logs crm-nginx | tail -50

# 5. Restart sequencial
docker compose -f docker-compose.production.yml restart backend
sleep 5
docker compose -f docker-compose.production.yml restart nginx
```

---

## 📊 MONITORAMENTO

### Health Checks

```bash
# Backend
curl http://72.61.39.235/health

# Postgres
docker exec crm-postgres pg_isready -U crm_user

# Redis
docker exec crm-redis redis-cli -a PASSWORD PING

# Todos os containers
docker ps --filter "health=healthy" --format "table {{.Names}}\t{{.Status}}"
```

### Logs

```bash
# Backend (últimas 100 linhas)
docker logs crm-backend --tail 100 --follow

# Apenas erros
docker logs crm-backend 2>&1 | grep -i error

# Logs específicos de tenant
docker logs crm-backend 2>&1 | grep "tenantId.*550e8400"

# Nginx access log
docker logs crm-nginx | grep "POST /auth/login"
```

### Performance

```bash
# CPU e Memória por container
docker stats

# Espaço em disco
df -h
docker system df

# Limpar caches Docker
docker system prune -a --volumes  # ⚠️ CUIDADO - apaga tudo não usado
```

---

## 📞 CONTATOS E RECURSOS

### Documentação Oficial
- **Node.js:** https://nodejs.org/docs/latest-v20.x/api/
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Prisma:** https://www.prisma.io/docs
- **Express.js:** https://expressjs.com/
- **Docker:** https://docs.docker.com/
- **Meta WhatsApp API:** https://developers.facebook.com/docs/whatsapp/cloud-api

### Repositórios
- **Local:** `C:/Users/55489/Desktop/projeto-hoteis-reserva/deploy-backend/`
- **Produção:** `/opt/` em `root@72.61.39.235`

---

## 📝 CHANGELOG

### v1.0.0 - 10/11/2025 (PRODUÇÃO)
- ✅ Deploy inicial na VPS
- ✅ Multi-tenant middleware funcionando
- ✅ Autenticação JWT completa
- ✅ Banco de dados configurado
- ✅ Docker Compose orquestrado
- ✅ Nginx reverse proxy
- ✅ Tenant "smarthoteis" + admin criado
- ✅ Health checks implementados

---

**Última atualização:** 10/11/2025 20:30 UTC
**Autor:** Claude Code
**Status do Sistema:** ✅ OPERACIONAL
