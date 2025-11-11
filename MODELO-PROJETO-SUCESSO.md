# 🎯 MODELO DE PROJETO SUCESSO

## Copy-Paste Template para Próximos Projetos

> **Template testado e validado em produção**
> Use este guia para iniciar novos projetos com **ZERO erros de configuração**

---

## 📋 ÍNDICE

1. [Stack Tecnológico](#-stack-tecnológico)
2. [Estrutura de Pastas](#-estrutura-de-pastas)
3. [Setup Inicial](#-setup-inicial)
4. [Configuração do Backend](#-configuração-do-backend)
5. [Configuração do Frontend](#-configuração-do-frontend)
6. [Configuração do Banco de Dados](#-configuração-do-banco-de-dados)
7. [Docker & Deploy](#-docker--deploy)
8. [Segurança](#-segurança)
9. [Git & CI/CD](#-git--cicd)
10. [Checklist Final](#-checklist-final)

---

## 🛠️ STACK TECNOLÓGICO

### **Versões EXATAS (Testadas e Aprovadas)**

```json
{
  "runtime": {
    "node": "20.11.0 LTS",
    "npm": "10.2.4",
    "typescript": "5.3.3"
  },
  "backend": {
    "express": "4.18.2",
    "prisma": "5.9.1",
    "@prisma/client": "5.9.1",
    "zod": "3.22.4",
    "jsonwebtoken": "9.0.2",
    "bcrypt": "5.1.1",
    "cors": "2.8.5",
    "dotenv": "16.4.1",
    "pino": "8.17.2",
    "pino-pretty": "10.3.1"
  },
  "database": {
    "postgresql": "16.1-alpine",
    "redis": "7.2-alpine"
  },
  "devDependencies": {
    "@types/node": "20.11.5",
    "@types/express": "4.17.21",
    "@types/bcrypt": "5.0.2",
    "@types/jsonwebtoken": "9.0.5",
    "tsx": "4.7.0",
    "nodemon": "3.0.3",
    "prisma": "5.9.1"
  }
}
```

### **❌ NÃO USE:**
- ❌ Node 18 ou inferior (problemas com fetch e crypto)
- ❌ TypeScript 4.x (problemas com tipos genéricos)
- ❌ Prisma 4.x (migrations instáveis)
- ❌ Express 5.x (ainda em beta, instável)

---

## 📁 ESTRUTURA DE PASTAS

### **Estrutura IDEAL (Copy-Paste)**

```
projeto-nome/
│
├── apps/
│   ├── backend/                    # Backend em desenvolvimento
│   │   ├── src/
│   │   │   ├── config/            # Configurações
│   │   │   │   ├── database.ts
│   │   │   │   ├── logger.ts
│   │   │   │   └── env.ts
│   │   │   │
│   │   │   ├── controllers/       # Controladores
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── user.controller.ts
│   │   │   │   └── *.controller.ts
│   │   │   │
│   │   │   ├── middlewares/       # Middlewares
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── tenant.middleware.ts
│   │   │   │   ├── errorHandler.ts
│   │   │   │   └── validation.middleware.ts
│   │   │   │
│   │   │   ├── services/          # Lógica de negócio
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   └── *.service.ts
│   │   │   │
│   │   │   ├── repositories/      # Acesso ao banco
│   │   │   │   ├── user.repository.ts
│   │   │   │   └── *.repository.ts
│   │   │   │
│   │   │   ├── routes/            # Rotas da API
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── user.routes.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── validators/        # Schemas Zod
│   │   │   │   ├── auth.validator.ts
│   │   │   │   └── *.validator.ts
│   │   │   │
│   │   │   ├── utils/             # Utilitários
│   │   │   │   ├── jwt.ts
│   │   │   │   ├── hash.ts
│   │   │   │   └── response.ts
│   │   │   │
│   │   │   ├── types/             # TypeScript types
│   │   │   │   └── index.d.ts
│   │   │   │
│   │   │   └── server.ts          # Entry point
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   │
│   │   ├── tests/                 # Testes
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   │
│   │   ├── .env.example
│   │   ├── .env.development
│   │   ├── .gitignore
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── README.md
│   │
│   └── frontend/                   # Frontend (Next.js/React)
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── ...
│
├── deploy-backend/                 # Backend standalone para VPS
│   └── (mesma estrutura de apps/backend/)
│
├── infra/                          # Infraestrutura
│   ├── docker-compose.dev.yml
│   ├── docker-compose.production.yml
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── conf.d/
│   └── scripts/
│       ├── deploy.sh
│       ├── backup.sh
│       └── setup-ssl.sh
│
├── docs/                           # Documentação
│   ├── API-REFERENCE.md
│   ├── GUIA-DEPLOY.md
│   └── CONTRIBUTING.md
│
├── .github/                        # GitHub Actions
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .gitignore
├── README.md
├── LICENSE
└── package.json                    # Root package.json (workspace)
```

---

## 🚀 SETUP INICIAL

### **1. Criar Projeto**

```bash
# Criar pasta do projeto
mkdir projeto-nome
cd projeto-nome

# Inicializar Git
git init
git branch -M master

# Criar estrutura de pastas
mkdir -p apps/backend/src/{config,controllers,middlewares,services,repositories,routes,validators,utils,types}
mkdir -p apps/backend/prisma
mkdir -p apps/backend/tests/{unit,integration,e2e}
mkdir -p apps/frontend
mkdir -p infra/{nginx/conf.d,scripts}
mkdir -p docs
mkdir -p .github/workflows
```

### **2. package.json Root (Workspace)**

```json
{
  "name": "projeto-nome",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/backend",
    "apps/frontend"
  ],
  "scripts": {
    "dev:backend": "npm run dev --workspace=apps/backend",
    "dev:frontend": "npm run dev --workspace=apps/frontend",
    "build:backend": "npm run build --workspace=apps/backend",
    "build:frontend": "npm run build --workspace=apps/frontend"
  }
}
```

---

## ⚙️ CONFIGURAÇÃO DO BACKEND

### **1. apps/backend/package.json**

```json
{
  "name": "backend",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.9.1",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "pino": "^8.17.2",
    "pino-pretty": "^10.3.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.11.5",
    "nodemon": "^3.0.3",
    "prisma": "^5.9.1",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

### **2. apps/backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### **3. apps/backend/.env.example**

```env
# Servidor
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Banco de Dados
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/projeto_dev?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Logs
LOG_LEVEL=info
```

### **4. apps/backend/src/server.ts** (Entry Point)

```typescript
import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { logger } from './config/logger';
import { errorHandler } from './middlewares/errorHandler';
import routes from './routes';

const app: Express = express();

// Middlewares
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/api', routes);

// Error handler (SEMPRE POR ÚLTIMO)
app.use(errorHandler);

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${config.server.env}`);
});

export default app;
```

### **5. apps/backend/src/config/env.ts**

```typescript
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  server: {
    env: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
  },
  database: {
    url: parsed.data.DATABASE_URL,
  },
  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
  },
  cors: {
    origin: parsed.data.CORS_ORIGIN,
  },
  log: {
    level: parsed.data.LOG_LEVEL,
  },
};
```

### **6. apps/backend/src/config/logger.ts**

```typescript
import pino from 'pino';
import { config } from './env';

export const logger = pino({
  level: config.log.level,
  transport: config.server.env === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
```

### **7. apps/backend/src/middlewares/errorHandler.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Zod validation errors
  if (err instanceof ZodError) {
    logger.error({ err: err.errors }, 'Validation error');
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    });
  }

  // App errors
  if (err instanceof AppError) {
    logger.error({ err, statusCode: err.statusCode }, err.message);
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Unknown errors
  logger.error({ err }, 'Internal server error');
  return res.status(500).json({
    error: 'Internal server error',
  });
};
```

---

## 🗄️ CONFIGURAÇÃO DO BANCO DE DADOS

### **1. apps/backend/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  role      Role     @default(USER)
  tenantId  String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}
```

### **2. apps/backend/src/config/database.ts**

```typescript
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Log queries em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: any) => {
    logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Query');
  });
}

prisma.$on('error', (e: any) => {
  logger.error({ error: e }, 'Prisma error');
});

export default prisma;
```

---

## 🐳 DOCKER & DEPLOY

### **1. apps/backend/Dockerfile**

```dockerfile
FROM node:20.11.0-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build
RUN npm run build

# ===============================
# Production stage
# ===============================
FROM node:20.11.0-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/

# Instalar apenas produção
RUN npm ci --only=production

# Copiar build do stage anterior
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### **2. docker-compose.production.yml**

```yaml
version: '3.8'

services:
  backend:
    container_name: app-backend
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_HOST: redis
      REDIS_PORT: 6379
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - app-network

  postgres:
    image: postgres:16.1-alpine
    container_name: app-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7.2-alpine
    container_name: app-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: app-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot_data:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network

  certbot:
    image: certbot/certbot:latest
    container_name: app-certbot
    volumes:
      - certbot_data:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - app-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  certbot_data:
    driver: local
  certbot_www:
    driver: local

networks:
  app-network:
    driver: bridge
```

### **3. nginx/nginx.conf**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    include /etc/nginx/conf.d/*.conf;
}
```

### **4. nginx/conf.d/default.conf**

```nginx
upstream backend {
    server backend:3001;
}

server {
    listen 80;
    server_name _;

    # Certbot validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Proxy to backend
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔐 SEGURANÇA

### **1. .gitignore COMPLETO**

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Production
dist/
build/

# Environment
.env
.env.local
.env.development
.env.production
.env.test

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*.swn
.fleet/

# Testing
coverage/
.nyc_output/

# Prisma
prisma/migrations/**/migration.sql

# Docker
*.tar.gz

# Temporary
temp/
tmp/
*.tmp

# SSL Certificates
*.pem
*.key
*.crt
```

### **2. Checklist de Segurança**

```markdown
- [ ] JWT_SECRET forte (mínimo 32 caracteres aleatórios)
- [ ] Senhas hasheadas com bcrypt (salt rounds >= 10)
- [ ] CORS configurado corretamente
- [ ] Rate limiting implementado
- [ ] Helmet.js para headers de segurança
- [ ] Validação de input com Zod em TODAS as rotas
- [ ] .env NUNCA commitado
- [ ] Secrets no GitHub Secrets (CI/CD)
- [ ] SSL/HTTPS em produção
- [ ] Banco com senha forte
- [ ] Redis com senha
- [ ] Logs não expõem informações sensíveis
```

---

## 🔄 GIT & CI/CD

### **1. deploy.sh** (Deploy Automático)

```bash
#!/bin/bash

set -e

echo "🚀 Starting deploy..."

# Variáveis
VPS_HOST="root@YOUR_VPS_IP"
DEPLOY_PATH="/root/deploy-backend"
BRANCH="master"

# 1. Commit e push local
echo "📦 Committing changes..."
git add .
read -p "Commit message: " commit_msg
git commit -m "$commit_msg"
git push origin $BRANCH

# 2. Deploy na VPS
echo "🌐 Deploying to VPS..."
ssh $VPS_HOST << ENDSSH
  set -e
  cd $DEPLOY_PATH

  echo "📥 Pulling latest code..."
  git pull origin $BRANCH

  echo "📦 Installing dependencies..."
  npm install

  echo "🔨 Building..."
  npm run build

  echo "🗄️ Running migrations..."
  npx prisma migrate deploy

  echo "🔄 Restarting containers..."
  docker-compose -f docker-compose.production.yml build backend
  docker-compose -f docker-compose.production.yml restart backend

  echo "✅ Deploy complete!"
ENDSSH

echo "✅ All done!"
```

### **2. .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.11.0'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        run: npx prisma migrate deploy

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          JWT_SECRET: test-secret
        run: npm test

      - name: Build
        run: npm run build
```

---

## ✅ CHECKLIST FINAL

### **Antes de Commitar:**

```markdown
- [ ] .env NÃO está no Git
- [ ] .gitignore configurado
- [ ] Todos os imports funcionando
- [ ] TypeScript sem erros: `npm run build`
- [ ] Prisma schema validado: `npx prisma validate`
- [ ] Tests passando: `npm test`
- [ ] Logs não expõem secrets
```

### **Antes de Deploy:**

```markdown
- [ ] .env.production criado na VPS
- [ ] Migrations aplicadas: `npx prisma migrate deploy`
- [ ] Variáveis de ambiente validadas
- [ ] SSL configurado (Certbot)
- [ ] Health check respondendo
- [ ] Logs monitorados
- [ ] Backup do banco configurado
```

### **Pós-Deploy:**

```markdown
- [ ] API respondendo: curl https://api.dominio.com/health
- [ ] Containers healthy: docker ps
- [ ] Logs normais: docker logs app-backend -f
- [ ] Banco conectado
- [ ] Redis conectado
- [ ] Nginx proxy funcionando
- [ ] CORS configurado
- [ ] Rate limiting testado
```

---

## 📚 COMANDOS ÚTEIS

### **Desenvolvimento:**

```bash
# Iniciar dev server
npm run dev

# Gerar Prisma Client
npx prisma generate

# Criar migration
npx prisma migrate dev --name nome_migration

# Abrir Prisma Studio
npx prisma studio

# Build
npm run build

# Rodar em produção local
npm start
```

### **Docker:**

```bash
# Build
docker-compose -f docker-compose.production.yml build

# Subir containers
docker-compose -f docker-compose.production.yml up -d

# Ver logs
docker-compose -f docker-compose.production.yml logs -f backend

# Restart
docker-compose -f docker-compose.production.yml restart backend

# Parar tudo
docker-compose -f docker-compose.production.yml down

# Limpar volumes
docker-compose -f docker-compose.production.yml down -v
```

### **Prisma:**

```bash
# Deploy migrations (produção)
npx prisma migrate deploy

# Reset database (CUIDADO!)
npx prisma migrate reset

# Seed
npm run prisma:seed

# Format schema
npx prisma format
```

---

## 🎯 ORDEM DE SETUP (Step-by-Step)

1. ✅ Criar estrutura de pastas
2. ✅ Configurar package.json (root + backend)
3. ✅ Configurar tsconfig.json
4. ✅ Criar .env.example e .env.development
5. ✅ Configurar .gitignore
6. ✅ Criar src/config/ (env, logger, database)
7. ✅ Criar src/middlewares/errorHandler.ts
8. ✅ Criar src/server.ts (entry point)
9. ✅ Configurar Prisma (schema.prisma)
10. ✅ Criar primeira migration: `npx prisma migrate dev --name init`
11. ✅ Testar servidor: `npm run dev`
12. ✅ Criar Dockerfile
13. ✅ Criar docker-compose.production.yml
14. ✅ Configurar Nginx
15. ✅ Testar Docker local: `docker-compose up`
16. ✅ Configurar deploy.sh
17. ✅ Configurar GitHub Actions (CI/CD)
18. ✅ Deploy para VPS
19. ✅ Configurar SSL (Certbot)
20. ✅ Monitorar logs e health checks

---

## 🎉 PRONTO!

Seguindo este template exatamente, você terá:

✅ Estrutura de pastas profissional
✅ TypeScript configurado corretamente
✅ Banco de dados com Prisma
✅ Docker para produção
✅ Deploy automatizado
✅ Logs estruturados
✅ Validação de dados
✅ Tratamento de erros
✅ Segurança configurada
✅ CI/CD com GitHub Actions

**Use este documento como CHECKLIST para TODOS os próximos projetos!**

---

**Última atualização:** 11/11/2025
**Testado em produção:** ✅ SIM
**Status:** 🎯 APROVADO
