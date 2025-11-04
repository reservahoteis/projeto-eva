# 🔧 Backend API - CRM WhatsApp SaaS

Backend Node.js + TypeScript com arquitetura Multi-Tenant.

---

## 📁 Estrutura de Pastas

```
src/
├── config/              # Configurações
│   ├── env.ts          # Validação de variáveis de ambiente (Zod)
│   ├── database.ts     # Prisma Client singleton
│   ├── redis.ts        # Redis clients
│   └── logger.ts       # Pino logger
│
├── middlewares/         # Middlewares Express
│   ├── tenant.middleware.ts        # 🔥 CRÍTICO: Isolamento Multi-Tenant
│   ├── auth.middleware.ts          # Autenticação JWT + RBAC
│   ├── error-handler.middleware.ts # Error handling global
│   └── rate-limit.middleware.ts    # Rate limiting
│
├── utils/               # Utilitários
│   ├── errors.ts       # Custom error classes
│   ├── crypto.ts       # Encrypt/decrypt WhatsApp tokens
│   └── async-storage.ts # Async context para tenantId
│
├── types/               # TypeScript types
│   └── express.d.ts    # Extend Express Request
│
├── services/            # Business logic (TODO)
├── controllers/         # Route handlers (TODO)
├── repositories/        # Data access (TODO)
├── validators/          # Zod schemas (TODO)
├── websocket/           # Socket.io (TODO)
├── queues/              # Bull jobs (TODO)
│
└── server.ts            # Entry point 🚀

prisma/
├── schema.prisma        # 🔥 Database schema Multi-Tenant
└── seed.ts              # Seed data (Super Admin + Demo Tenant)
```

---

## 🔥 Features Implementadas

### ✅ Multi-Tenant Architecture
- **Tenant Isolation Middleware**: Extrai tenant do subdomínio
- **Async Context**: TenantId disponível globalmente via AsyncLocalStorage
- **Database Schema**: Todos os models têm `tenantId` (exceto User que pode ser Super Admin)

### ✅ Autenticação & Autorização
- **JWT**: Access tokens + Refresh tokens
- **RBAC**: 3 roles (SUPER_ADMIN, TENANT_ADMIN, ATTENDANT)
- **Middlewares**: authenticate, authorize, verifyTenantAccess

### ✅ Security
- **Helmet.js**: Security headers
- **Rate Limiting**: Por tenant + IP
- **Data Encryption**: WhatsApp tokens criptografados
- **Error Handling**: Errors customizados + Zod validation

### ✅ Database (Prisma + PostgreSQL)
- **Multi-Tenant schema**: Tenant, User, Contact, Conversation, Message, Tag
- **Audit Log**: WebhookEvent para debug
- **Usage Tracking**: Para billing futuro
- **Indexes**: Otimizados para queries multi-tenant

### ✅ Infrastructure
- **TypeScript Strict Mode**: Type safety total
- **Pino Logger**: Logging estruturado
- **Redis**: Cache + Job queues (setup pronto)
- **Environment Validation**: Zod schema

---

## 🚀 Rodar Localmente

```bash
# 1. Instalar dependências
pnpm install

# 2. Criar .env
cp ../../.env.example ../../.env
# Editar .env com suas credenciais

# 3. Subir PostgreSQL + Redis
cd ../../
pnpm docker:up

# 4. Gerar Prisma Client
pnpm prisma:generate

# 5. Rodar migrations
pnpm prisma:migrate

# 6. Seed (criar super admin)
pnpm prisma:seed

# 7. Iniciar dev server
pnpm dev
```

Backend rodando em: **http://localhost:3001**

---

## 🧪 Testar

```bash
# Health check
curl http://localhost:3001/health

# API (sem tenant, retorna erro)
curl http://localhost:3001/api

# API (com tenant demo via query param)
curl http://localhost:3001/api?tenant=demo-hotel

# Super Admin
curl http://localhost:3001/api?tenant=super-admin
```

---

## 📊 Prisma

```bash
# Prisma Studio (GUI do banco)
pnpm prisma:studio

# Criar nova migration
pnpm prisma migrate dev --name nome_da_migration

# Resetar banco (CUIDADO!)
pnpm prisma:reset
```

---

## 🔐 Credenciais Iniciais

Após seed:

**Super Admin:**
- Email: `admin@seucrm.com`
- Senha: `change_me_in_production`

**Tenant Demo:**
- Slug: `demo-hotel`
- URL: `http://demo-hotel.localhost:3000`
- Admin: `admin@demo.hotel` / `demo123`
- Atendente: `atendente1@demo.hotel` / `demo123`

---

## 📝 TODO

- [ ] Services (AuthService, TenantService, WhatsAppService, etc)
- [ ] Controllers e rotas
- [ ] Validators (Zod schemas)
- [ ] WebSocket setup (Socket.io)
- [ ] Job queues (Bull + Redis)
- [ ] Testes (Jest)

---

## 🏗️ Arquitetura em Camadas

```
Request → Middleware → Controller → Service → Repository → Database
```

**Separação de responsabilidades:**
- **Controller**: Valida input, chama service, retorna response
- **Service**: Lógica de negócio, orquestra repositories
- **Repository**: Acesso direto ao banco (Prisma)

---

**Status:** ✅ **Base completa e funcional**

Próximo: Implementar Services, Controllers e Routes.
