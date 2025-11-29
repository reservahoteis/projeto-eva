# Fix: Deployment Workflow - Docker-based Deployment

## Problema Identificado

O workflow de deployment estava **falhando** porque tentava executar comandos npm/node **diretamente no host VPS**, mas o npm/node estão **dentro do container Docker**.

### Erro Original
```bash
Installing dependencies...
-bash: line 5: npm: command not found
```

### Causa Raiz
O workflow estava executando:
```bash
ssh ... "cd /root/deploy-backend && npm ci && npm run build"
```

Mas o VPS usa **Docker Compose** para rodar o backend, então:
- npm/node estão DENTRO do container `crm-backend`
- Host VPS não tem (e não precisa ter) npm/node instalados
- Build deve acontecer DENTRO do Dockerfile multi-stage

## Solução Implementada

### Arquitetura VPS
```
VPS Host (Linux)
├── Docker Engine
└── Docker Compose
    ├── crm-backend (Node.js app)
    ├── crm-postgres (PostgreSQL)
    ├── crm-redis (Redis)
    ├── crm-nginx (Reverse proxy)
    └── crm-certbot (SSL certificates)
```

### Fluxo de Deployment Corrigido

#### ANTES (Errado)
```yaml
# Step 6: Install dependencies and build (FALHA - npm não existe no host)
- npm ci
- npx prisma generate
- npm run build

# Step 7: Run migrations (Inconsistente)
- docker-compose exec backend npx prisma migrate deploy || npx prisma migrate deploy

# Step 8: Restart container
- docker-compose up -d --build backend
```

#### DEPOIS (Correto)
```yaml
# Step 6: Build Docker image
- docker-compose -f docker-compose.production.yml build backend
  # O build acontece DENTRO do Dockerfile multi-stage
  # Dockerfile.standalone faz: npm ci -> prisma generate -> npm run build

# Step 7: Start backend container
- docker-compose -f docker-compose.production.yml up -d --no-deps --force-recreate backend
  # --no-deps: não reinicia postgres/redis (evita downtime)
  # --force-recreate: garante novo container com nova imagem

# Step 8: Run migrations
- docker-compose -f docker-compose.production.yml exec -T backend npx prisma migrate deploy
  # Migrations rodam DENTRO do container backend
```

## Mudanças Implementadas

### 1. Backup Melhorado
```bash
# ANTES: Backup de arquivos no host
cp -r dist/ backups/
cp package.json backups/

# DEPOIS: Backup de imagens Docker
docker tag deploy-backend_backend:latest deploy-backend_backend:backup-$(date +%Y%m%d-%H%M%S)
# Mantém últimas 3 imagens Docker para rollback rápido
```

### 2. Build Process
```bash
# ANTES: Build no host (ERRO)
npm ci --production=false
npx prisma generate
npm run build

# DEPOIS: Build no Docker
docker-compose -f docker-compose.production.yml build backend
# O Dockerfile.standalone tem multi-stage build:
# Stage 1: Builder (instala deps + compila TypeScript + gera Prisma)
# Stage 2: Production (copia apenas /dist e node_modules)
```

### 3. Deployment
```bash
# ANTES: Build + restart juntos
docker-compose up -d --build backend

# DEPOIS: Build separado + restart
docker-compose build backend              # Build da imagem
docker-compose up -d --no-deps --force-recreate backend  # Restart apenas backend
# Vantagens:
# - Não reinicia PostgreSQL/Redis (evita downtime)
# - Força criação de novo container (sem cache)
# - Mais controle sobre o processo
```

### 4. Migrations
```bash
# ANTES: Fallback para host (INCONSISTENTE)
docker-compose exec -T backend npx prisma migrate deploy || npx prisma migrate deploy

# DEPOIS: Apenas dentro do container
docker-compose exec -T backend npx prisma migrate deploy
# Se falhar, mostra logs do container para debug
```

### 5. Rollback
```bash
# ANTES: Rollback de arquivos
cp backups/latest/dist .
docker-compose restart backend

# DEPOIS: Rollback de imagem Docker
docker tag deploy-backend_backend:backup-20250115-143000 deploy-backend_backend:latest
docker-compose up -d --no-deps --force-recreate backend
# Rollback instantâneo (imagem já está built)
```

## Benefícios da Solução

1. **Consistência**: Build sempre acontece da mesma forma (Dockerfile)
2. **Isolamento**: Host VPS não precisa ter npm/node instalados
3. **Segurança**: Menos dependências no host = menos superfície de ataque
4. **Rollback Rápido**: Imagens Docker já estão prontas para rollback
5. **Zero Downtime**: Apenas backend é reiniciado (PostgreSQL/Redis continuam rodando)
6. **Reprodutibilidade**: Build do Docker é idêntico em dev/staging/production

## Verificação de Sucesso

### 1. Verificar Containers no VPS
```bash
ssh root@VPS
cd /root/deploy-backend
docker-compose -f docker-compose.production.yml ps

# Deve mostrar:
# crm-backend   running (healthy)
# crm-postgres  running (healthy)
# crm-redis     running (healthy)
# crm-nginx     running (healthy)
```

### 2. Verificar Logs do Backend
```bash
docker-compose -f docker-compose.production.yml logs --tail=50 backend
```

### 3. Health Check
```bash
curl https://api.botreserva.com.br/api/health
# Deve retornar: {"status":"ok","timestamp":"..."}
```

### 4. Verificar Backup Images
```bash
docker images | grep deploy-backend_backend
# Deve mostrar:
# deploy-backend_backend   latest           <id>   X minutes ago
# deploy-backend_backend   backup-20250115  <id>   Y minutes ago
```

## Troubleshooting

### Erro: "npm: command not found"
**Causa**: Workflow está tentando rodar npm no host
**Solução**: Usar `docker-compose build` ou `docker-compose exec`

### Erro: "Cannot connect to the Docker daemon"
**Causa**: Docker não está rodando no VPS
**Solução**: `systemctl start docker`

### Erro: "failed to solve: failed to compute cache key"
**Causa**: Arquivos de contexto Docker não foram sincronizados
**Solução**: Verificar se rsync completou com sucesso

### Erro: "Container is unhealthy"
**Causa**: Backend não consegue conectar ao PostgreSQL/Redis
**Solução**:
```bash
docker-compose logs postgres redis
docker-compose exec backend env | grep DATABASE_URL
```

### Rollback Manual
```bash
# 1. Listar backups disponíveis
docker images | grep backup

# 2. Escolher backup
docker tag deploy-backend_backend:backup-YYYYMMDD-HHMMSS deploy-backend_backend:latest

# 3. Restart backend
docker-compose up -d --no-deps --force-recreate backend
```

## Container Architecture

### Dockerfile.standalone (Multi-stage Build)

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
- Instala dependências de build (python3, make, g++)
- Roda npm install (compila módulos nativos como bcrypt)
- Gera Prisma Client
- Compila TypeScript (npm run build)

# Stage 2: Production
FROM node:20-alpine AS production
- Copia apenas /dist e node_modules do builder
- Roda como usuário não-root (nodejs:1001)
- Expõe porta 3001
- Health check integrado
- ENTRYPOINT: dumb-init (proper signal handling)
```

### docker-compose.production.yml

```yaml
backend:
  build:
    context: .
    dockerfile: Dockerfile.standalone  # Multi-stage build
  container_name: crm-backend
  environment:
    NODE_ENV: production
    DATABASE_URL: postgresql://crm_user:***@postgres:5432/crm_whatsapp_saas
    REDIS_HOST: redis
  depends_on:
    postgres: { condition: service_healthy }
    redis: { condition: service_healthy }
  healthcheck:
    test: ["CMD", "node", "-e", "require('http').get(...)"]
```

## Workflow Steps Summary

```
1. Checkout code
2. Setup SSH
3. Pre-deployment checks (disk space, Docker status)
4. Create backup (Docker image + database)
5. Sync files via rsync (source code)
6. Build Docker image (npm install + build happens here)
7. Start backend container (--no-deps --force-recreate)
8. Run database migrations (inside container)
9. Health check (wait for /api/health to return 200)
10. Post-deployment verification
```

## Comandos Úteis

### No VPS
```bash
# Ver todos os containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Logs em tempo real
docker-compose -f docker-compose.production.yml logs -f backend

# Rebuild completo
docker-compose -f docker-compose.production.yml build --no-cache backend

# Restart apenas backend
docker-compose -f docker-compose.production.yml up -d --no-deps --force-recreate backend

# Entrar no container
docker exec -it crm-backend sh

# Verificar variáveis de ambiente
docker-compose -f docker-compose.production.yml exec backend env

# Limpar imagens antigas
docker image prune -a -f --filter "until=72h"
```

### GitHub Actions
```bash
# Trigger manual deployment
gh workflow run deploy-production.yml

# Ver logs do último run
gh run list --workflow=deploy-production.yml --limit=1
gh run view <run-id> --log

# Cancelar deployment em andamento
gh run cancel <run-id>
```

## Referências

- **Workflow**: `.github/workflows/deploy-production.yml`
- **Dockerfile**: `deploy-backend/Dockerfile.standalone`
- **Docker Compose**: `deploy-backend/docker-compose.production.yml`
- **VPS Path**: `/root/deploy-backend`
- **Container Name**: `crm-backend`
- **Health Endpoint**: `https://api.botreserva.com.br/api/health`
