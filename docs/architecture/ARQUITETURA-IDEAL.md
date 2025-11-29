# 🏗️ ARQUITETURA IDEAL - Lições Aprendidas

> **Objetivo:** Documentar o que FUNCIONA e o que NÃO FUNCIONA baseado na experiência real deste projeto
>
> **Use este documento como guia para EVITAR os mesmos erros e REPLICAR os acertos**

---

## 📋 ÍNDICE

1. [❌ Anti-Patterns: O Que NÃO Fazer](#anti-patterns)
2. [✅ Best Practices: O Que SEMPRE Fazer](#best-practices)
3. [🏗️ Arquitetura Recomendada](#arquitetura-recomendada)
4. [📦 Stack Tecnológico Ideal](#stack-ideal)
5. [🚀 Processo de Deploy Ideal](#deploy-ideal)
6. [📁 Estrutura de Pastas Ideal](#estrutura-ideal)
7. [🔐 Segurança e Credenciais](#seguranca)
8. [📊 Monitoramento e Logs](#monitoramento)

---

## ❌ ANTI-PATTERNS: O QUE **NÃO** FAZER

### 🚫 1. Deploy Manual com Arquivos .tar.gz

**❌ O que fizemos ERRADO:**
```bash
# NO LOCAL
tar -czf backend.tar.gz apps/backend/
scp backend.tar.gz root@vps:/root/
ssh root@vps "cd /root && tar -xzf backend.tar.gz"
```

**Por que é RUIM:**
- ❌ Sem controle de versão
- ❌ Sem histórico de mudanças
- ❌ Impossível fazer rollback
- ❌ Arquivos acumulam (tivemos 21.5 MB de lixo!)
- ❌ Erros humanos (esquecer arquivos, copiar errado)
- ❌ Sem CI/CD
- ❌ Demora muito

**✅ SOLUÇÃO CORRETA:**
```bash
# Setup inicial (UMA VEZ)
ssh root@vps
cd /root/projeto
git init
git remote add origin git@github.com:user/repo.git
ssh-keygen -t ed25519 -C "vps-deploy"
# Adicionar SSH key no GitHub como Deploy Key

# Deploy (SEMPRE)
git pull origin master
npm install
npm run build
docker-compose restart backend
```

**Resultado:**
- ✅ Git tracking completo
- ✅ Rollback com `git reset --hard HEAD~1`
- ✅ Histórico de todas as mudanças
- ✅ Sem arquivos .tar.gz
- ✅ Automação possível

---

### 🚫 2. Documentação Fragmentada

**❌ O que fizemos ERRADO:**
```
📁 projeto/
├── README.md
├── LEIA-ME-PRIMEIRO.md
├── GETTING-STARTED.md
├── RODAR-AGORA.md
├── PROXIMO-PASSO.md
├── DEPLOY-VPS.md
├── DEPLOY-VPS-BACKEND-ONLY.md
├── DEPLOY-VERCEL.md
├── GUIA-DEPLOY.md
├── GUIA-RAPIDO-DEPLOY.md
├── DOCS-ARQUITETURA.md
├── DOCS-DESENVOLVIMENTO.md
├── DOCS-API-REFERENCE.md
├── DOCS-MULTI-TENANT.md
├── STATUS-PROJETO.md
└── ... (21 arquivos .md no total!)
```

**Por que é RUIM:**
- ❌ Informações duplicadas
- ❌ Documentação desatualizada
- ❌ Impossível encontrar o que precisa
- ❌ Manutenção pesadelo
- ❌ Ninguém lê tudo

**✅ SOLUÇÃO CORRETA:**
```
📁 projeto/
├── 📘 README.md                      ← Porta de entrada
├── 📖 DOCUMENTACAO-COMPLETA.md       ← Tudo em um lugar
├── 🏗️ ARQUITETURA-IDEAL.md           ← Este documento
├── 📋 MODELO-PROJETO-SUCESSO.md      ← Template
│
└── 📂 docs/                          ← Guias específicos
    ├── api-reference.md
    ├── deploy-guide.md
    ├── whatsapp-integration.md
    └── contributing.md
```

**Resultado:**
- ✅ 1 documento completo > 20 incompletos
- ✅ Fácil de manter atualizado
- ✅ README como índice
- ✅ Guias específicos separados

---

### 🚫 3. Monorepo SEM Clareza de Propósito

**❌ O que fizemos ERRADO:**
```
apps/backend/       ← Para desenvolvimento?
deploy-backend/     ← Para produção?
🤔 Qual usar? Qual editar? Como sincronizar?
```

**Por que é RUIM:**
- ❌ Confusão sobre qual editar
- ❌ Código duplicado
- ❌ Falta de sincronização
- ❌ Deploy complexo

**✅ SOLUÇÃO CORRETA - Opção 1 (Monorepo Puro):**
```
📁 projeto/
├── apps/
│   ├── backend/       ← Único, desenvolvimento E produção
│   └── frontend/
└── infra/
    └── docker-compose.production.yml

# Deploy: Clonar repo completo na VPS
cd /root
git clone repo.git
cd repo/apps/backend
npm install && npm run build
docker-compose -f ../../infra/docker-compose.production.yml up -d
```

**✅ SOLUÇÃO CORRETA - Opção 2 (Separado):**
```
# Repositório 1: Desenvolvimento
github.com/user/projeto-dev
├── backend/
└── frontend/

# Repositório 2: Produção
github.com/user/projeto-prod
└── backend/       ← Código standalone, pronto para prod

# CI/CD sincroniza automaticamente
```

**Escolha UMA opção e documente claramente!**

---

### 🚫 4. .env SEM Backup

**❌ O que fizemos ERRADO:**
- .env.production apenas em 1 lugar
- Se perder = sistema offline
- Sem versionamento (obviamente)
- Sem backup automático

**Por que é RUIM:**
- ❌ Ponto único de falha
- ❌ Sem histórico de mudanças
- ❌ Difícil recuperar credenciais antigas
- ❌ Downtime se perder

**✅ SOLUÇÃO CORRETA:**
```bash
# 1. Backup automático no deploy
echo "Backing up .env..."
cp .env.production /root/.backups/env.$(date +%Y%m%d-%H%M%S)

# 2. Rotação de backups (manter últimos 30 dias)
find /root/.backups/env.* -mtime +30 -delete

# 3. Backup em secret manager (produção)
# AWS Secrets Manager, Doppler, Vault, etc.

# 4. .env.example versionado
cp .env.production .env.example
# Remover valores sensíveis
sed -i 's/=.*/=YOUR_VALUE_HERE/g' .env.example
git add .env.example
```

**Resultado:**
- ✅ Backups automáticos timestamped
- ✅ Histórico de mudanças
- ✅ Fácil recuperação
- ✅ .env.example para novos devs

---

### 🚫 5. Container com Código Hardcoded

**❌ O que fizemos ERRADO:**
```dockerfile
# Dockerfile ruim
FROM node:20
COPY . /app
RUN npm install && npm run build
# Código fica "congelado" na imagem
```

**Por que é RUIM:**
- ❌ Atualizar código = rebuild imagem completa
- ❌ npm install a cada build (lento!)
- ❌ Downtime durante rebuild
- ❌ Difícil debugar

**✅ SOLUÇÃO CORRETA:**
```dockerfile
# Dockerfile bom (multi-stage)
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build

# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    volumes:
      - ./src:/app/src:ro     # ← Código via volume (dev)
      - ./dist:/app/dist       # ← Build via volume
    environment:
      - NODE_ENV=production
```

**Resultado:**
- ✅ Hot reload em dev
- ✅ npm install só quando package.json muda
- ✅ Atualizar código = só restart
- ✅ Fácil debugar

---

### 🚫 6. Logs Apenas no Console

**❌ O que fizemos ERRADO:**
```typescript
console.log('User logged in');
console.error('Database error:', err);
```

**Por que é RUIM:**
- ❌ Logs perdidos quando container reinicia
- ❌ Sem estrutura (impossível parsear)
- ❌ Sem níveis (info, warn, error)
- ❌ Sem contexto (tenantId, userId, requestId)
- ❌ Difícil debugar produção

**✅ SOLUÇÃO CORRETA:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

// Uso correto
logger.info({
  userId: user.id,
  tenantId: req.tenantId,
  requestId: req.id
}, 'User logged in');

logger.error({
  err,
  tenantId: req.tenantId,
  query: 'SELECT * FROM users'
}, 'Database error');
```

**Resultado:**
- ✅ Logs estruturados (JSON)
- ✅ Fácil parsear e filtrar
- ✅ Contexto completo
- ✅ Integração com Datadog/Sentry

---

## ✅ BEST PRACTICES: O Que **SEMPRE** Fazer

### 🎯 1. Git ANTES de Qualquer Código

**Ordem correta de setup:**

```bash
# 1. PRIMEIRO: Git
mkdir projeto && cd projeto
git init
echo "node_modules/" > .gitignore
echo "dist/" >> .gitignore
echo ".env*" >> .gitignore
echo "*.log" >> .gitignore
git add .gitignore
git commit -m "Initial commit"

# 2. SEGUNDO: Remote
git remote add origin git@github.com:user/repo.git
git branch -M main
git push -u origin main

# 3. TERCEIRO: Código
npm init -y
# ...desenvolvimento

# 4. QUARTO: Deploy
# Configurar SSH keys, CI/CD, etc.
```

**Por quê:**
- ✅ Histórico desde o primeiro arquivo
- ✅ Branches funcionam desde o início
- ✅ .gitignore configurado antes de commitar lixo
- ✅ Remote configurado = backups automáticos

---

### 🎯 2. TypeScript com Configuração Strict

**tsconfig.json ideal:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",

    // ✅ CRÍTICO: Strict mode
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // ✅ BOM: Extra checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // ✅ BOM: Interoperabilidade
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    // ✅ BOM: Paths
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@config/*": ["src/config/*"],
      "@services/*": ["src/services/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

**Por quê:**
- ✅ Catch erros em COMPILE time (não em produção!)
- ✅ Autocomplete perfeito
- ✅ Refactoring seguro
- ✅ Menos bugs

---

### 🎯 3. Validação com Zod em TODAS as Entradas

**Schema Zod para TUDO:**

```typescript
import { z } from 'zod';

// ✅ Request bodies
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'ATTENDANT'])
});

// ✅ Query params
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// ✅ Env variables
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32)
}).parse(process.env);

// ✅ Uso no controller
app.post('/users', async (req, res) => {
  const data = createUserSchema.parse(req.body); // ← Valida E tipagem!
  // data é tipado automaticamente!
});
```

**Por quê:**
- ✅ Runtime validation
- ✅ Type inference automático
- ✅ Erros claros para o client
- ✅ Documentação viva do schema

---

### 🎯 4. Multi-Tenant Isolation OBRIGATÓRIO

**Middleware crítico:**

```typescript
// src/middlewares/tenant.middleware.ts

export async function tenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. Extrair tenant (subdomain, header, ou path)
  const subdomain = req.headers.host?.split('.')[0];

  // 2. Buscar tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: subdomain },
    select: { id: true, status: true }
  });

  // 3. Validar
  if (!tenant) {
    throw new TenantNotFoundError();
  }

  if (tenant.status !== 'ACTIVE') {
    throw new TenantSuspendedError();
  }

  // 4. ⚠️ CRÍTICO: Adicionar no request E no async context
  req.tenantId = tenant.id;
  asyncLocalStorage.run({ tenantId: tenant.id }, () => next());
}

// ✅ USAR EM TODAS AS ROTAS (exceto health check)
app.use('/api', tenantIsolation);
app.use('/webhooks', tenantIsolation);
```

**SEMPRE incluir tenantId em queries:**

```typescript
// ❌ ERRADO - Vaza dados entre tenants!
const users = await prisma.user.findMany();

// ✅ CORRETO
const users = await prisma.user.findMany({
  where: { tenantId: req.tenantId }
});

// ✅ MELHOR: Helper function
function getTenantQuery(req: Request) {
  return { tenantId: req.tenantId };
}

const users = await prisma.user.findMany({
  where: getTenantQuery(req)
});
```

---

### 🎯 5. Health Check Sempre Presente

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),

    // ✅ Verificar dependências
    database: await checkDatabase(),
    redis: await checkRedis(),
    disk: await checkDiskSpace(),
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal
    }
  };

  const allHealthy = Object.values(checks)
    .filter(v => typeof v === 'object' && 'status' in v)
    .every(c => c.status === 'ok');

  res.status(allHealthy ? 200 : 503).json(checks);
});

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}
```

**Por quê:**
- ✅ Monitoramento externo
- ✅ Load balancer health checks
- ✅ Alertas automáticos
- ✅ Debug rápido

---

## 🏗️ ARQUITETURA RECOMENDADA

### Stack Ideal (Baseado em Experiência)

```
┌─────────────────────────────────────────────┐
│           FRONTEND (Next.js 14)             │
│  - App Router                               │
│  - Server Components                        │
│  - TailwindCSS + Shadcn/ui                  │
└────────────────┬────────────────────────────┘
                 │
                 │ HTTP + WebSocket
                 ▼
┌─────────────────────────────────────────────┐
│      NGINX (Reverse Proxy + SSL)            │
│  - Rate limiting                            │
│  - Gzip compression                         │
│  - SSL/TLS (Certbot)                        │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│       BACKEND (Node.js + TypeScript)        │
│  - Express.js                               │
│  - Prisma ORM                               │
│  - Socket.io (WebSocket)                    │
│  - Bull (Job queues)                        │
└──────┬──────────────────────┬───────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐      ┌──────────────┐
│ PostgreSQL   │      │    Redis     │
│   (Dados)    │      │ (Cache/Jobs) │
└──────────────┘      └──────────────┘
```

**Por quê este stack:**
- ✅ **Node.js**: Mesma linguagem front/back
- ✅ **TypeScript**: Type safety end-to-end
- ✅ **Prisma**: Melhor DX para TypeScript + SQL
- ✅ **PostgreSQL**: ACID, JSON, escalável
- ✅ **Redis**: Cache rápido, pub/sub, jobs
- ✅ **Next.js**: SSR, otimizações automáticas
- ✅ **Docker**: Ambientes reproduzíveis

---

### Camadas da Aplicação

```
📁 src/
├── 🎯 routes/
│   └── Define rotas (GET /users, POST /messages)
│
├── 🔒 middlewares/
│   ├── auth.middleware.ts        (JWT validation)
│   ├── tenant.middleware.ts      (Multi-tenant isolation)
│   ├── validate.middleware.ts    (Zod schemas)
│   └── error-handler.middleware.ts
│
├── 🎮 controllers/
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   └── message.controller.ts
│   └── Responsabilidades:
│       - Receber request
│       - Validar input (Zod)
│       - Chamar service
│       - Retornar response
│
├── 💼 services/
│   ├── auth.service.ts
│   ├── user.service.ts
│   └── message.service.ts
│   └── Responsabilidades:
│       - Lógica de negócio
│       - Orquestrar repositories
│       - Transações
│       - Validações complexas
│
├── 💾 repositories/
│   ├── user.repository.ts
│   ├── message.repository.ts
│   └── Responsabilidades:
│       - CRUD com Prisma
│       - Queries SQL
│       - SEM lógica de negócio
│
└── 📋 validators/
    ├── auth.validator.ts
    ├── user.validator.ts
    └── Zod schemas
```

**Fluxo de uma request:**

```
1. Cliente → POST /api/users
2. Middleware (auth) → Valida JWT
3. Middleware (tenant) → Extrai tenantId
4. Middleware (validate) → Valida body com Zod
5. Controller → Extrai dados validados
6. Service → Lógica de negócio (hash senha, etc)
7. Repository → Salva no banco
8. Service → Retorna user criado
9. Controller → Retorna HTTP 201 + JSON
```

---

## 📦 STACK TECNOLÓGICO IDEAL

### Versões Testadas e Aprovadas

```json
{
  "engines": {
    "node": "20.x",
    "pnpm": "8.x"
  },
  "dependencies": {
    "express": "^4.18.2",
    "prisma": "^5.7.0",
    "@prisma/client": "^5.7.0",
    "typescript": "^5.3.3",
    "zod": "^3.22.4",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "socket.io": "^4.6.1",
    "bull": "^4.12.0",
    "ioredis": "^5.3.2",
    "axios": "^1.6.5",
    "pino": "^8.17.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.6",
    "tsx": "^4.7.0",
    "prettier": "^3.1.1",
    "eslint": "^8.56.0"
  }
}
```

**Por quê essas versões:**
- ✅ Node 20 LTS (suporte até 2026)
- ✅ Prisma 5.x (stable, rápido)
- ✅ TypeScript 5.3 (últimas features)
- ✅ Todas testadas juntas (sem conflitos)

---

## 🚀 PROCESSO DE DEPLOY IDEAL

### Setup Inicial (UMA VEZ)

```bash
# ===== NO LOCAL =====
git init
git remote add origin git@github.com:user/repo.git

# ===== NA VPS =====
ssh root@vps

# 1. Instalar Docker
curl -fsSL https://get.docker.com | sh

# 2. Gerar SSH Key para GitHub
ssh-keygen -t ed25519 -C "vps-deploy@projeto"
cat ~/.ssh/id_ed25519.pub
# Adicionar no GitHub: Settings → Deploy Keys → Add (✅ Allow write access)

# 3. Configurar SSH
cat >> ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking no
EOF

# 4. Clonar projeto
cd /root
git clone git@github.com:user/repo.git
cd repo

# 5. Configurar .env.production
cp .env.example .env.production
nano .env.production  # Editar credenciais

# 6. Primeiro build
npm install
npm run build
docker-compose -f docker-compose.production.yml up -d

# 7. Verificar
docker ps
curl http://localhost/health
```

### Deploy Diário (SEMPRE)

```bash
# ===== NO LOCAL =====
# 1. Desenvolver
# 2. Testar
# 3. Commit & Push
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 4. Deploy automático (script)
./deploy.sh

# ===== deploy.sh =====
#!/bin/bash
set -e

echo "🚀 Deploying..."

# Push local
git push origin main

# Pull na VPS + restart
ssh root@vps << 'ENDSSH'
  cd /root/repo
  git pull origin main
  npm install
  npm run build
  docker-compose -f docker-compose.production.yml restart backend
  echo "✅ Deploy completed!"
ENDSSH
```

---

## 📁 ESTRUTURA DE PASTAS IDEAL

```
projeto-nome/
│
├── 📘 README.md                      # Porta de entrada
├── 📖 DOCUMENTACAO-COMPLETA.md       # Tudo em um lugar
├── 🏗️ ARQUITETURA-IDEAL.md           # Este documento
├── 📋 MODELO-PROJETO-SUCESSO.md      # Template
├── 📜 LICENSE
├── 📜 .gitignore
├── 📜 .env.example
│
├── 📂 docs/                          # Documentação específica
│   ├── api-reference.md
│   ├── deployment.md
│   ├── contributing.md
│   └── code-of-conduct.md
│
├── 📂 apps/                          # Monorepo
│   ├── backend/
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   │
│   └── frontend/
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── next.config.js
│
├── 📂 infra/                         # Infraestrutura
│   ├── docker-compose.yml
│   ├── docker-compose.production.yml
│   ├── nginx/
│   └── k8s/
│
├── 📂 scripts/                       # Automações
│   ├── deploy.sh
│   ├── backup.sh
│   ├── setup-vps.sh
│   └── seed-db.sh
│
├── 📜 package.json                   # Root workspace
├── 📜 pnpm-workspace.yaml
└── 📜 .github/
    └── workflows/
        ├── ci.yml                    # Tests + Lint
        └── deploy.yml                # Deploy automático
```

---

## 🔐 SEGURANÇA E CREDENCIAIS

### Hierarquia de .env

```bash
# ===== DESENVOLVIMENTO =====
.env                        # Local, commitado com valores fake
.env.local                  # Local, gitignored, valores reais

# ===== PRODUÇÃO =====
.env.production            # VPS, gitignored
.env.production.example    # Template, commitado
```

### Gerenciamento de Secrets

```bash
# ❌ ERRADO - Hardcoded
const API_KEY = 'abc123';

# ❌ ERRADO - .env commitado
git add .env  # NÃO!

# ✅ CORRETO - .env gitignored
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore

# ✅ CORRETO - Validação com Zod
import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().url(),
}).parse(process.env);

// ✅ MELHOR - Secret Manager (produção)
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
const secrets = await secretsManager.getSecretValue({ SecretId: 'prod/api' });
```

### Backup de .env.production

```bash
# Criar backup antes de qualquer deploy
mkdir -p /root/.backups
cp /root/projeto/.env.production /root/.backups/env.$(date +%Y%m%d-%H%M%S)

# Rotação (manter últimos 30 dias)
find /root/.backups/env.* -mtime +30 -delete
```

---

## 📊 MONITORAMENTO E LOGS

### Logs Estruturados

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined
});

// Uso correto
logger.info({ userId, tenantId, action: 'login' }, 'User logged in');
logger.error({ err, tenantId, query }, 'Database error');
```

### Health Checks

```typescript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: await checkDB(),
    redis: await checkRedis()
  };

  res.json(health);
});
```

### Métricas

```typescript
// Prometheus metrics
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant']
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    httpRequestDuration.observe({
      method: req.method,
      route: req.route?.path,
      status_code: res.statusCode,
      tenant: req.tenantId
    }, (Date.now() - start) / 1000);
  });
  next();
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});
```

---

## 🎯 CHECKLIST DE ARQUITETURA IDEAL

### Setup Inicial
- [ ] Git configurado ANTES de qualquer código
- [ ] .gitignore completo
- [ ] TypeScript strict mode
- [ ] ESLint + Prettier configurados
- [ ] package.json com engines definidos
- [ ] README.md com quick start
- [ ] .env.example commitado

### Backend
- [ ] Estrutura em camadas (Routes → Controllers → Services → Repositories)
- [ ] Validação Zod em todas as entradas
- [ ] Multi-tenant isolation middleware
- [ ] JWT authentication
- [ ] Error handling global
- [ ] Logs estruturados (Pino)
- [ ] Health check endpoint
- [ ] Migrations com Prisma

### Deploy
- [ ] SSH Deploy Key configurada
- [ ] Git na VPS sincronizado
- [ ] Script de deploy automático
- [ ] .env.production backupeado
- [ ] Docker Compose configurado
- [ ] Nginx reverse proxy
- [ ] SSL com Certbot
- [ ] Healthchecks no docker-compose

### Segurança
- [ ] Secrets em .env (nunca hardcoded)
- [ ] .env gitignored
- [ ] Backups de .env.production
- [ ] Helmet.js configurado
- [ ] Rate limiting
- [ ] CORS configurado
- [ ] JWT com expiração curta
- [ ] Senhas com bcrypt (12+ rounds)

### Documentação
- [ ] README.md atualizado
- [ ] Documentação completa
- [ ] API reference
- [ ] Guia de deployment
- [ ] Guia de contribuição
- [ ] CHANGELOG.md

### Monitoramento
- [ ] Logs estruturados
- [ ] Health checks
- [ ] Métricas (Prometheus)
- [ ] Alertas configurados
- [ ] Backup automático do banco

---

## 🏆 RESUMO: ARQUITETURA VENCEDORA

### Stack
```
Frontend:  Next.js 14 + TypeScript + TailwindCSS
Backend:   Node.js 20 + TypeScript + Express + Prisma
Database:  PostgreSQL 16
Cache:     Redis 7
Deploy:    Docker + Git + SSH
Proxy:     Nginx + Certbot (SSL)
Logs:      Pino (JSON structured)
Monitor:   Prometheus + Grafana
```

### Princípios
1. **Git First** - Antes de qualquer código
2. **Type Safety** - TypeScript strict + Zod
3. **Layers** - Separação clara de responsabilidades
4. **Isolation** - Multi-tenant obrigatório
5. **Automation** - Deploy com 1 comando
6. **Documentation** - Menos docs, mais completos
7. **Security** - .env nunca commitado, sempre backupeado
8. **Monitoring** - Logs estruturados, health checks, métricas

### Anti-Patterns Evitados
- ❌ Deploy manual com .tar.gz
- ❌ 20+ documentos .md
- ❌ Console.log ao invés de logger estruturado
- ❌ .env sem backup
- ❌ Código sem Git tracking
- ❌ Container sem volume mounts
- ❌ Queries sem tenantId

---

**Use este documento como BÍBLIA para novos projetos!**

Seguir 100% = Sucesso garantido 🚀
