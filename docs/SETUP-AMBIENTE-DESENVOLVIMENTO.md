# Setup do Ambiente de Desenvolvimento - Backend CRM WhatsApp

## Indice

1. [Pre-requisitos](#pre-requisitos)
2. [Setup Inicial](#setup-inicial)
3. [Configuracao do Banco de Dados](#configuracao-do-banco-de-dados)
4. [Configuracao do Redis](#configuracao-do-redis)
5. [Configuracao do Backend](#configuracao-do-backend)
6. [Testes](#testes)
7. [Troubleshooting](#troubleshooting)

---

## Pre-requisitos

### Software Necessario

1. **Node.js 20.x ou superior**
   ```bash
   node --version  # v20.x.x
   npm --version   # v10.x.x
   ```

2. **Docker e Docker Compose**
   ```bash
   docker --version          # 24.x ou superior
   docker-compose --version  # 2.x ou superior
   ```

3. **Git**
   ```bash
   git --version  # 2.x ou superior
   ```

4. **Editor de Codigo**
   - VS Code (recomendado)
   - WebStorm
   - Cursor

### Extensoes VS Code Recomendadas

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "mikestead.dotenv",
    "ms-azuretools.vscode-docker"
  ]
}
```

---

## Setup Inicial

### 1. Clonar o Repositorio

```bash
cd C:\Users\55489\Desktop
git clone <repository-url> projeto-hoteis-reserva
cd projeto-hoteis-reserva
```

### 2. Instalar Dependencias do Backend

```bash
cd deploy-backend
npm install
```

**Pacotes principais instalados:**
- express: Framework web
- prisma: ORM
- typescript: Linguagem
- socket.io: WebSocket
- bull: Queue system
- ioredis: Redis client
- zod: Validacao
- jsonwebtoken: Autenticacao

### 3. Criar Estrutura de Arquivos de Ambiente

```bash
# Windows PowerShell
Copy-Item .env.production.example .env.development

# Linux/Mac
cp .env.production.example .env.development
```

---

## Configuracao do Banco de Dados

### Opcao 1: Docker Compose (RECOMENDADO)

#### 1.1. Criar docker-compose.dev.yml

Crie o arquivo `deploy-backend/docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL para desenvolvimento
  postgres-dev:
    image: postgres:16-alpine
    container_name: crm-postgres-dev
    restart: always
    ports:
      - "5433:5432"  # Porta 5433 para nao conflitar com instalacao local
    environment:
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password_123
      POSTGRES_DB: crm_whatsapp_dev
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dev_user']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - crm-dev-network

  # Redis para desenvolvimento
  redis-dev:
    image: redis:7-alpine
    container_name: crm-redis-dev
    restart: always
    ports:
      - "6380:6379"  # Porta 6380 para nao conflitar
    command: redis-server --requirepass dev_redis_password_123 --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_dev_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - crm-dev-network

  # Adminer - Interface Web para PostgreSQL (opcional)
  adminer:
    image: adminer:latest
    container_name: crm-adminer-dev
    restart: always
    ports:
      - "8080:8080"
    environment:
      ADMINER_DEFAULT_SERVER: postgres-dev
    networks:
      - crm-dev-network

volumes:
  postgres_dev_data:
    driver: local
  redis_dev_data:
    driver: local

networks:
  crm-dev-network:
    driver: bridge
```

#### 1.2. Subir os Servicos

```bash
cd deploy-backend
docker-compose -f docker-compose.dev.yml up -d

# Verificar status
docker-compose -f docker-compose.dev.yml ps

# Ver logs
docker-compose -f docker-compose.dev.yml logs -f
```

**Output esperado:**
```
NAME                IMAGE                 STATUS
crm-postgres-dev    postgres:16-alpine    Up (healthy)
crm-redis-dev       redis:7-alpine        Up (healthy)
crm-adminer-dev     adminer:latest        Up
```

#### 1.3. Testar Conexoes

**PostgreSQL:**
```bash
# Windows PowerShell
docker exec -it crm-postgres-dev psql -U dev_user -d crm_whatsapp_dev

# Dentro do psql:
\l           # Listar databases
\dt          # Listar tabelas (vazio inicialmente)
\q           # Sair
```

**Redis:**
```bash
docker exec -it crm-redis-dev redis-cli -a dev_redis_password_123

# Dentro do redis-cli:
PING         # Deve retornar PONG
INFO         # Informacoes do servidor
EXIT         # Sair
```

**Adminer (Interface Web):**
- Abrir navegador: http://localhost:8080
- System: PostgreSQL
- Server: postgres-dev
- Username: dev_user
- Password: dev_password_123
- Database: crm_whatsapp_dev

### Opcao 2: PostgreSQL e Redis Locais (Nativo)

#### 2.1. Instalar PostgreSQL

**Windows (Chocolatey):**
```powershell
choco install postgresql16
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install postgresql-16 postgresql-contrib
```

**Mac (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

#### 2.2. Criar Database

```bash
# Conectar como superuser
psql -U postgres

# Dentro do psql:
CREATE USER dev_user WITH PASSWORD 'dev_password_123';
CREATE DATABASE crm_whatsapp_dev OWNER dev_user;
GRANT ALL PRIVILEGES ON DATABASE crm_whatsapp_dev TO dev_user;
\q
```

#### 2.3. Instalar Redis

**Windows (WSL ou Docker):**
```powershell
# Usar Docker (recomendado)
docker run -d --name redis-dev -p 6380:6379 redis:7-alpine redis-server --requirepass dev_redis_password_123
```

**Linux (Ubuntu):**
```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Mac (Homebrew):**
```bash
brew install redis
brew services start redis
```

---

## Configuracao do Backend

### 1. Criar arquivo .env.development

Edite `deploy-backend/.env.development`:

```env
# ============================================
# DEVELOPMENT ENVIRONMENT VARIABLES
# ============================================

# ============================================
# DATABASE (PostgreSQL)
# ============================================
# Para Docker Compose:
DATABASE_URL=postgresql://dev_user:dev_password_123@localhost:5433/crm_whatsapp_dev?schema=public

# Para PostgreSQL local:
# DATABASE_URL=postgresql://dev_user:dev_password_123@localhost:5432/crm_whatsapp_dev?schema=public

POSTGRES_USER=dev_user
POSTGRES_PASSWORD=dev_password_123
POSTGRES_DB=crm_whatsapp_dev

# ============================================
# REDIS
# ============================================
# Para Docker Compose:
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=dev_redis_password_123
REDIS_URL=redis://:dev_redis_password_123@localhost:6380

# Para Redis local:
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=dev_redis_password_123
# REDIS_URL=redis://:dev_redis_password_123@localhost:6379

# ============================================
# JWT AUTHENTICATION
# ============================================
# IMPORTANTE: Usar secrets DIFERENTES de producao!
JWT_SECRET=dev_jwt_secret_for_development_min_32_chars_here
JWT_REFRESH_SECRET=dev_refresh_secret_for_development_min_32_chars_here

# ============================================
# APPLICATION
# ============================================
NODE_ENV=development
PORT=3001

# Frontend URLs (CORS) - adicionar localhost do frontend
FRONTEND_URL=http://localhost:5173,http://localhost:3000,http://localhost:4200

# Base domain (desenvolvimento)
BASE_DOMAIN=localhost

# ============================================
# WHATSAPP BUSINESS API (Teste)
# ============================================
# USAR CREDENCIAIS DE TESTE/SANDBOX DO WHATSAPP
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=dev_webhook_verify_token_change_me

# Estas serao configuradas por tenant, mas precisam estar no .env
# WHATSAPP_PHONE_NUMBER_ID=
# WHATSAPP_ACCESS_TOKEN=
# WHATSAPP_BUSINESS_ACCOUNT_ID=
# WHATSAPP_APP_SECRET=

# ============================================
# N8N INTEGRATION (Optional)
# ============================================
N8N_API_KEY=dev_n8n_api_key_change_me

# ============================================
# SUPER ADMIN (Development)
# ============================================
SUPER_ADMIN_EMAIL=admin@dev.local
SUPER_ADMIN_PASSWORD=DevAdmin123!

# ============================================
# ENCRYPTION
# ============================================
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=debug  # debug, info, warn, error
```

### 2. Gerar Prisma Client

```bash
npm run prisma:generate
```

### 3. Rodar Migrations do Banco

```bash
# Criar todas as tabelas
npm run prisma:migrate

# OU especificar nome da migration:
npx prisma migrate dev --name init
```

**Output esperado:**
```
Applying migration `20251124_init`
The following migration(s) have been applied:

migrations/
  └─ 20251124_init/
      └─ migration.sql

Your database is now in sync with your schema.
```

### 4. Seed do Banco (Dados de Teste)

#### 4.1. Criar arquivo de seed

Crie `deploy-backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Criar Tenant de Teste
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'hotel-teste' },
    update: {},
    create: {
      name: 'Hotel Teste Dev',
      slug: 'hotel-teste',
      email: 'contato@hotel-teste.dev',
      status: 'ACTIVE',
      plan: 'BASIC',
      maxAttendants: 10,
      maxMessages: 10000,
    },
  });

  console.log('✓ Tenant created:', tenant.name);

  // 2. Criar Usuario Admin
  const hashedPassword = await bcrypt.hash('Admin123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hotel-teste.dev' },
    update: {},
    create: {
      email: 'admin@hotel-teste.dev',
      name: 'Admin Teste',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  console.log('✓ Admin user created:', adminUser.email);

  // 3. Criar Usuario Atendente
  const attendantUser = await prisma.user.upsert({
    where: { email: 'atendente@hotel-teste.dev' },
    update: {},
    create: {
      email: 'atendente@hotel-teste.dev',
      name: 'Atendente Teste',
      password: hashedPassword,
      role: 'ATTENDANT',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  console.log('✓ Attendant user created:', attendantUser.email);

  // 4. Criar Contatos de Teste
  const contact1 = await prisma.contact.create({
    data: {
      phone: '5511999999999',
      name: 'Cliente Teste 1',
      tenantId: tenant.id,
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      phone: '5511888888888',
      name: 'Cliente Teste 2',
      tenantId: tenant.id,
    },
  });

  console.log('✓ Contacts created');

  // 5. Criar Conversas de Teste
  const conversation1 = await prisma.conversation.create({
    data: {
      contactId: contact1.id,
      tenantId: tenant.id,
      status: 'OPEN',
      lastMessageAt: new Date(),
    },
  });

  console.log('✓ Conversations created');

  // 6. Criar Mensagens de Teste
  await prisma.message.create({
    data: {
      conversationId: conversation1.id,
      contactId: contact1.id,
      tenantId: tenant.id,
      type: 'TEXT',
      content: 'Ola, gostaria de fazer uma reserva',
      direction: 'INBOUND',
      status: 'RECEIVED',
      whatsappMessageId: 'test_msg_1',
    },
  });

  console.log('✓ Messages created');

  // 7. Criar Tags
  const tags = await Promise.all([
    prisma.tag.create({
      data: { name: 'VIP', color: '#FFD700', tenantId: tenant.id },
    }),
    prisma.tag.create({
      data: { name: 'Urgente', color: '#FF0000', tenantId: tenant.id },
    }),
    prisma.tag.create({
      data: { name: 'Reserva', color: '#00FF00', tenantId: tenant.id },
    }),
  ]);

  console.log('✓ Tags created');

  console.log('\n=================================');
  console.log('Seed completed successfully! ✓');
  console.log('=================================\n');
  console.log('Login credentials:');
  console.log('Admin: admin@hotel-teste.dev / Admin123!');
  console.log('Attendant: atendente@hotel-teste.dev / Admin123!');
  console.log('\nTenant slug: hotel-teste');
  console.log('=================================\n');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

#### 4.2. Adicionar script no package.json

Edite `deploy-backend/package.json`:

```json
{
  "scripts": {
    "prisma:seed": "tsx prisma/seed.ts"
  }
}
```

#### 4.3. Executar seed

```bash
npm run prisma:seed
```

**Output esperado:**
```
Starting seed...
✓ Tenant created: Hotel Teste Dev
✓ Admin user created: admin@hotel-teste.dev
✓ Attendant user created: atendente@hotel-teste.dev
✓ Contacts created
✓ Conversations created
✓ Messages created
✓ Tags created

=================================
Seed completed successfully! ✓
=================================

Login credentials:
Admin: admin@hotel-teste.dev / Admin123!
Attendant: atendente@hotel-teste.dev / Admin123!

Tenant slug: hotel-teste
=================================
```

### 5. Iniciar o Backend em Modo Desenvolvimento

```bash
npm run dev
```

**Output esperado:**
```
[INFO] Starting CRM WhatsApp Backend...
[INFO] Environment: development
[INFO] Port: 3001
[INFO] Database connected successfully
[INFO] Redis connected successfully
[INFO] Socket.IO initialized
[INFO] Bull Queue workers registered
[INFO] Server listening on port 3001
[INFO] Health check: http://localhost:3001/health
```

### 6. Testar a API

#### 6.1. Health Check

```bash
# Windows PowerShell
Invoke-WebRequest http://localhost:3001/health | Select-Object Content

# Linux/Mac
curl http://localhost:3001/health
```

**Response esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-05T10:00:00.000Z",
  "uptime": 5.123
}
```

#### 6.2. Login

```bash
# PowerShell
$body = @{
    email = "admin@hotel-teste.dev"
    password = "Admin123!"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "x-tenant-slug" = "hotel-teste"
}

Invoke-WebRequest -Uri http://localhost:3001/auth/login -Method POST -Body $body -Headers $headers | Select-Object Content

# Bash/cURL
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: hotel-teste" \
  -d '{
    "email": "admin@hotel-teste.dev",
    "password": "Admin123!"
  }'
```

**Response esperada:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@hotel-teste.dev",
    "name": "Admin Teste",
    "role": "ADMIN"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 7. Prisma Studio (Interface Visual)

```bash
npm run prisma:studio
```

Abre automaticamente no navegador: http://localhost:5555

---

## Testes

### 1. Rodar Todos os Testes

```bash
npm test
```

### 2. Testes em Watch Mode

```bash
npm run test:watch
```

### 3. Coverage Report

```bash
npm run test:coverage
```

### 4. Rodar Testes Especificos

```bash
# Testar apenas servico de autenticacao
npm test -- auth.service.test.ts

# Testar apenas um caso especifico
npm test -- -t "should login successfully"
```

---

## Estrutura de Pastas do Projeto

```
deploy-backend/
├── prisma/
│   ├── schema.prisma           # Schema do banco
│   ├── seed.ts                 # Seed de dados
│   └── migrations/             # Historico de migrations
├── src/
│   ├── config/                 # Configuracoes
│   │   ├── env.ts              # Validacao de variaveis de ambiente
│   │   ├── database.ts         # Setup Prisma
│   │   ├── redis.ts            # Setup Redis
│   │   ├── logger.ts           # Logger (Pino)
│   │   └── socket.ts           # Setup Socket.io
│   ├── controllers/            # Controllers (camada HTTP)
│   ├── services/               # Logica de negocio
│   ├── routes/                 # Definicao de rotas
│   ├── middlewares/            # Middlewares (auth, validation, etc)
│   ├── queues/                 # Bull queues
│   │   └── workers/            # Workers de processamento
│   ├── utils/                  # Utilitarios
│   ├── validators/             # Schemas Zod
│   ├── types/                  # TypeScript types
│   └── server.ts               # Entry point
├── dist/                       # Build (gerado pelo tsc)
├── node_modules/               # Dependencias
├── .env.development            # Variaveis de ambiente dev
├── .env.production.example     # Exemplo de producao
├── docker-compose.dev.yml      # Docker Compose para dev
├── package.json
├── tsconfig.json               # Configuracao TypeScript
└── jest.config.js              # Configuracao testes
```

---

## Comandos Uteis

### NPM Scripts

```bash
# Desenvolvimento
npm run dev              # Inicia backend com hot-reload (tsx watch)
npm run build            # Build para producao (tsc)
npm start                # Inicia versao de producao (node dist/server.js)

# Database
npm run prisma:generate  # Gera Prisma Client
npm run prisma:migrate   # Cria nova migration
npm run prisma:studio    # Interface visual do banco
npm run prisma:seed      # Popular banco com dados de teste
npm run prisma:reset     # CUIDADO! Deleta tudo e refaz migrations + seed

# Testes
npm test                 # Todos os testes
npm run test:watch       # Testes em watch mode
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # ESLint
npm run format           # Prettier

# Limpeza
npm run clean            # Remove dist/ e node_modules/
```

### Docker Compose

```bash
# Subir servicos de desenvolvimento
docker-compose -f docker-compose.dev.yml up -d

# Ver logs
docker-compose -f docker-compose.dev.yml logs -f
docker-compose -f docker-compose.dev.yml logs -f postgres-dev

# Parar servicos
docker-compose -f docker-compose.dev.yml stop

# Parar e remover containers
docker-compose -f docker-compose.dev.yml down

# Parar e remover TUDO (incluindo volumes/dados)
docker-compose -f docker-compose.dev.yml down -v

# Recriar containers
docker-compose -f docker-compose.dev.yml up -d --force-recreate
```

### PostgreSQL (via Docker)

```bash
# Conectar ao PostgreSQL
docker exec -it crm-postgres-dev psql -U dev_user -d crm_whatsapp_dev

# Comandos psql uteis:
\l           # Listar databases
\dt          # Listar tabelas
\d tablename # Descrever tabela
\q           # Sair

# Backup
docker exec crm-postgres-dev pg_dump -U dev_user crm_whatsapp_dev > backup-dev.sql

# Restore
cat backup-dev.sql | docker exec -i crm-postgres-dev psql -U dev_user -d crm_whatsapp_dev
```

### Redis (via Docker)

```bash
# Conectar ao Redis
docker exec -it crm-redis-dev redis-cli -a dev_redis_password_123

# Comandos redis-cli uteis:
PING                    # Testar conexao
KEYS *                  # Listar todas as keys
GET key_name            # Ver valor de uma key
DEL key_name            # Deletar key
FLUSHDB                 # CUIDADO! Limpa todo o banco
INFO                    # Informacoes do servidor
MONITOR                 # Ver comandos em tempo real
```

---

## Troubleshooting

### Erro: "Cannot connect to PostgreSQL"

**Sintomas:**
```
Error: Can't reach database server at localhost:5433
```

**Solucoes:**

1. Verificar se container esta rodando:
```bash
docker ps | grep postgres-dev
```

2. Verificar logs do container:
```bash
docker logs crm-postgres-dev
```

3. Testar conexao manualmente:
```bash
docker exec -it crm-postgres-dev pg_isready -U dev_user
```

4. Verificar .env.development tem a porta correta (5433 se Docker, 5432 se local)

5. Recriar container:
```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

### Erro: "Cannot connect to Redis"

**Sintomas:**
```
Error: connect ECONNREFUSED 127.0.0.1:6380
```

**Solucoes:**

1. Verificar container:
```bash
docker ps | grep redis-dev
```

2. Testar conexao:
```bash
docker exec -it crm-redis-dev redis-cli -a dev_redis_password_123 PING
```

3. Verificar porta no .env.development (6380 se Docker, 6379 se local)

### Erro: "Prisma Client not generated"

**Sintomas:**
```
Error: Cannot find module '@prisma/client'
```

**Solucao:**
```bash
npm run prisma:generate
```

### Erro: "Port 3001 already in use"

**Sintomas:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solucoes:**

1. Matar processo na porta:

**Windows PowerShell:**
```powershell
# Encontrar processo
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess
# Matar processo (substitua PID)
Stop-Process -Id <PID> -Force
```

**Linux/Mac:**
```bash
# Encontrar e matar
lsof -ti:3001 | xargs kill -9
```

2. Ou mudar a porta no .env.development:
```env
PORT=3002
```

### Erro: "Migration failed"

**Sintomas:**
```
Error: P3005 The database schema is not empty
```

**Solucao:**

1. Resetar banco completamente:
```bash
npm run prisma:reset
```

2. Ou aplicar migrations manualmente:
```bash
npx prisma migrate deploy
```

### Testes Falhando

**Solucoes:**

1. Limpar cache do Jest:
```bash
npx jest --clearCache
```

2. Verificar mocks:
```bash
# Ver se arquivo jest.setup.ts existe e esta correto
cat jest.setup.ts
```

3. Rodar teste especifico com mais logs:
```bash
npm test -- --verbose auth.service.test.ts
```

### Hot Reload nao funciona

**Solucoes:**

1. Verificar se tsx esta instalado:
```bash
npm list tsx
```

2. Reinstalar dependencias:
```bash
rm -rf node_modules package-lock.json
npm install
```

3. Usar nodemon como alternativa:
```bash
npm install --save-dev nodemon
# Adicionar em package.json:
"dev": "nodemon --exec tsx src/server.ts"
```

---

## Proximos Passos

Apos setup completo:

1. [ ] Configurar frontend para apontar para http://localhost:3001
2. [ ] Obter credenciais de teste do WhatsApp Business API
3. [ ] Configurar Webhook do WhatsApp para localhost (usar ngrok/localtunnel)
4. [ ] Testar fluxo completo de mensagens
5. [ ] Configurar debugger do VS Code
6. [ ] Ler documentacao da API (ARQUITETURA_API.md)

---

## Recursos Adicionais

### Documentacao

- [Documentacao Completa do Sistema](./DOCUMENTACAO-COMPLETA.md)
- [Arquitetura da API](./ARQUITETURA_API.md)
- [Analise Ambiente Producao](./ANALISE-AMBIENTE-PRODUCAO.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Express Documentation](https://expressjs.com/)
- [Socket.io Documentation](https://socket.io/docs/)

### Ferramentas

- **Prisma Studio:** http://localhost:5555
- **Adminer:** http://localhost:8080
- **API Documentation (Swagger):** http://localhost:3001/api-docs (se implementado)

### VS Code Debug Configuration

Crie `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

---

## Checklist de Setup

- [ ] Node.js 20+ instalado
- [ ] Docker e Docker Compose instalados
- [ ] Repositorio clonado
- [ ] `npm install` executado
- [ ] `docker-compose.dev.yml` criado
- [ ] Containers Docker rodando (postgres-dev, redis-dev)
- [ ] `.env.development` configurado
- [ ] `npm run prisma:generate` executado
- [ ] `npm run prisma:migrate` executado
- [ ] `npm run prisma:seed` executado
- [ ] `npm run dev` funcionando
- [ ] Health check respondendo (http://localhost:3001/health)
- [ ] Login funcionando
- [ ] Prisma Studio acessivel (http://localhost:5555)
- [ ] Testes passando (`npm test`)

---

**Ambiente de desenvolvimento pronto para uso!**

Se tiver duvidas ou problemas, consulte a secao [Troubleshooting](#troubleshooting) ou abra uma issue no repositorio.
