# GitHub Actions Deploy - Architecture Diagram

Diagrama visual da arquitetura de deploy automático.

---

## Visão Geral do Fluxo

```
┌──────────────────────────────────────────────────────────────────┐
│                         DEVELOPER                                │
│                                                                  │
│  ┌────────────────┐                                             │
│  │ Local Machine  │                                             │
│  │                │                                             │
│  │  git add .     │                                             │
│  │  git commit    │                                             │
│  │  git push ──────────┐                                        │
│  └────────────────┘    │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                         GITHUB                                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Repository (master branch)                                 │ │
│  │   deploy-backend/                                          │ │
│  │     ├── src/                                               │ │
│  │     ├── prisma/                                            │ │
│  │     ├── package.json                                       │ │
│  │     └── docker-compose.production.yml                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ GitHub Actions Workflow                                    │ │
│  │   .github/workflows/deploy-production.yml                  │ │
│  │                                                            │ │
│  │   Trigger: push to master (deploy-backend/*)              │ │
│  │                                                            │ │
│  │   Steps:                                                   │ │
│  │     1. Checkout code                                       │ │
│  │     2. Setup SSH (using VPS_SSH_KEY secret)                │ │
│  │     3. Pre-deployment checks                               │ │
│  │     4. Create backup                                       │ │
│  │     5. Rsync files to VPS                                  │ │
│  │     6. Install & Build                                     │ │
│  │     7. Run migrations                                      │ │
│  │     8. Restart backend                                     │ │
│  │     9. Health check                                        │ │
│  │    10. Verify deployment                                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          │ SSH + rsync                           │
│                          │ (using secrets)                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    VPS (72.61.39.235)                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ /root/deploy-backend/                                      │ │
│  │                                                            │ │
│  │  1. Receive files via rsync                                │ │
│  │  2. npm ci (install dependencies)                          │ │
│  │  3. npm run build (TypeScript → JavaScript)                │ │
│  │  4. npx prisma migrate deploy                              │ │
│  │  5. docker-compose up -d --build backend                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                          ▼                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Docker Compose                                             │ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │   PostgreSQL │  │     Redis    │  │   Backend    │    │ │
│  │  │              │  │              │  │              │    │ │
│  │  │  Port: 5432  │  │  Port: 6379  │  │  Port: 3001  │    │ │
│  │  │              │  │              │  │              │    │ │
│  │  │  Volume:     │  │  Volume:     │  │  Health:     │    │ │
│  │  │  postgres_   │  │  redis_data  │  │  /health     │    │ │
│  │  │  data        │  │              │  │              │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  │         │                  │                  │           │ │
│  └─────────┼──────────────────┼──────────────────┼───────────┘ │
│            │                  │                  │             │
│            └──────────────────┴──────────────────┘             │
│                               │                                │
│                               ▼                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Nginx (Reverse Proxy)                                      │ │
│  │                                                            │ │
│  │   Port 80  → redirect to 443                               │ │
│  │   Port 443 → proxy to backend:3001                         │ │
│  │                                                            │ │
│  │   SSL: Let's Encrypt (Certbot)                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Public Internet    │
                │                      │
                │  api.botreserva.     │
                │  com.br              │
                │                      │
                │  HTTPS (443)         │
                └──────────────────────┘
```

---

## Componentes Detalhados

### 1. GitHub Repository

```
projeto-hoteis-reserva/
├── .github/
│   ├── workflows/
│   │   └── deploy-production.yml      # Workflow de deploy
│   └── scripts/
│       └── setup-deploy-keys.sh       # Setup SSH keys
│
└── deploy-backend/                    # PASTA DEPLOYADA
    ├── src/                           # Código TypeScript
    ├── prisma/                        # Database schema
    ├── dist/                          # Build output
    ├── package.json                   # Dependencies
    ├── docker-compose.production.yml  # Docker config
    ├── Dockerfile.standalone          # Backend image
    └── .env.production.example        # Env template
```

### 2. GitHub Actions Workflow

```yaml
Trigger:
  - push to master
  - changes in deploy-backend/*
  - workflow_dispatch (manual)

Secrets Required:
  - VPS_SSH_KEY      # SSH private key
  - VPS_HOST         # 72.61.39.235
  - VPS_USER         # root
  - VPS_PATH         # /root/deploy-backend

Steps:
  1. Checkout          →  Get code from repo
  2. Setup SSH         →  Configure SSH key
  3. Pre-checks        →  Verify VPS is ready
  4. Backup            →  Create backup (dist, DB)
  5. Rsync             →  Sync files to VPS
  6. Build             →  npm ci + build
  7. Migrate           →  Prisma migrations
  8. Restart           →  Docker restart backend
  9. Health Check      →  Verify /api/health
  10. Verify           →  Check containers
  11. Cleanup          →  Remove temp files
```

### 3. VPS Infrastructure

```
VPS (Ubuntu 24.04)
├── Docker Engine
│   ├── Network: crm-network (bridge)
│   │
│   ├── Container: crm-postgres
│   │   ├── Image: postgres:16-alpine
│   │   ├── Port: 5432
│   │   ├── Volume: postgres_data
│   │   └── Health: pg_isready
│   │
│   ├── Container: crm-redis
│   │   ├── Image: redis:7-alpine
│   │   ├── Port: 6379
│   │   ├── Volume: redis_data
│   │   └── Health: redis-cli ping
│   │
│   ├── Container: crm-backend
│   │   ├── Build: Dockerfile.standalone
│   │   ├── Port: 3001
│   │   ├── Health: GET /health
│   │   └── Depends: postgres, redis
│   │
│   ├── Container: crm-nginx
│   │   ├── Image: nginx:alpine
│   │   ├── Ports: 80, 443
│   │   ├── Volumes: nginx config, SSL certs
│   │   └── Proxy: backend:3001
│   │
│   └── Container: crm-certbot
│       ├── Image: certbot/certbot
│       └── Volumes: SSL certs
│
└── Directories
    ├── /root/deploy-backend/        # Main deploy dir
    │   ├── src/                     # Source code
    │   ├── dist/                    # Compiled JS
    │   ├── prisma/                  # DB schema
    │   ├── backups/                 # Auto backups
    │   ├── nginx/                   # Nginx configs
    │   └── certbot/                 # SSL certs
    │
    └── /var/lib/docker/volumes/     # Docker volumes
        ├── postgres_data/
        └── redis_data/
```

---

## Fluxo de Deploy Detalhado

### Phase 1: Trigger (GitHub)

```
Developer pushes code
    ↓
GitHub detects changes in deploy-backend/
    ↓
Workflow starts
    ↓
Runner (ubuntu-latest) spins up
```

### Phase 2: Pre-Deploy (GitHub Runner)

```
1. Checkout code from repository
    ↓
2. Install SSH key from VPS_SSH_KEY secret
    ↓
3. Add VPS to known_hosts
    ↓
4. Test SSH connection to VPS
    ↓
5. Check VPS health:
   - Ping VPS
   - Check disk space (must be < 90%)
   - Verify Docker is running
```

### Phase 3: Backup (VPS)

```
SSH to VPS
    ↓
Create backup directory: backups/pre-deploy-YYYYMMDD-HHMMSS/
    ↓
Backup current state:
   - dist/              (compiled code)
   - package.json       (dependencies)
   - database.sql       (PostgreSQL dump)
    ↓
Keep only last 5 backups
```

### Phase 4: Deploy (GitHub Runner → VPS)

```
1. Rsync deploy-backend/ to VPS
   - Exclude: node_modules, dist, .env, coverage, backups
   - Only changed files transferred
   - Delete removed files
    ↓
2. SSH to VPS and execute:
   - npm ci (install dependencies)
   - npx prisma generate
   - npm run build (TypeScript → JavaScript)
    ↓
3. Run database migrations
   - docker-compose exec backend npx prisma migrate deploy
    ↓
4. Restart backend container
   - docker-compose up -d --build --force-recreate backend
```

### Phase 5: Verification (GitHub Runner)

```
1. Health check loop (max 30 attempts, 5s interval):
   - curl https://api.botreserva.com.br/api/health
   - Expect: HTTP 200 + JSON with "status": "healthy"
    ↓
2. Post-deployment verification:
   - Check all containers are UP
   - Check containers are healthy
   - Check disk usage
    ↓
3. Cleanup:
   - Remove temporary SSH key
   - Report success/failure
```

---

## Network Flow

```
Internet
    │
    │ HTTPS (443)
    ▼
┌─────────────────┐
│  api.botreserva │  DNS → 72.61.39.235
│  .com.br        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  VPS: 72.61.39.235              │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Nginx (Container)        │  │
│  │  Port: 443 (public)       │  │
│  │                           │  │
│  │  SSL Termination          │  │
│  │  (Let's Encrypt)          │  │
│  └───────────┬───────────────┘  │
│              │                  │
│              │ HTTP              │
│              ▼                  │
│  ┌───────────────────────────┐  │
│  │  Backend (Container)      │  │
│  │  Port: 3001 (internal)    │  │
│  │                           │  │
│  │  Express.js API           │  │
│  └───┬───────────────────┬───┘  │
│      │                   │      │
│      │                   │      │
│      ▼                   ▼      │
│  ┌─────────┐      ┌──────────┐  │
│  │ PostgreSQL│      │  Redis   │  │
│  │ :5432   │      │  :6379   │  │
│  └─────────┘      └──────────┘  │
│                                 │
└─────────────────────────────────┘
```

---

## Security Architecture

```
┌──────────────────────────────────────────┐
│  GitHub Secrets (Encrypted)              │
│                                          │
│  ✓ VPS_SSH_KEY (SSH private key)         │
│  ✓ VPS_HOST (IP address)                 │
│  ✓ VPS_USER (SSH username)               │
│  ✓ VPS_PATH (deploy path)                │
└──────────────────┬───────────────────────┘
                   │
                   │ Injected at runtime
                   │ (never logged)
                   ▼
         ┌──────────────────────┐
         │  GitHub Actions      │
         │  Runner (ephemeral)  │
         └──────────┬───────────┘
                    │
                    │ SSH (port 22)
                    │ Key-based auth
                    ▼
         ┌──────────────────────────┐
         │  VPS authorized_keys     │
         │  (public key stored)     │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │  Docker Containers       │
         │  (non-root user)         │
         └──────────────────────────┘
```

---

## Data Flow

### Deploy Data Flow

```
Developer Machine
    │
    │ git push
    ▼
GitHub Repository
    │
    │ webhook trigger
    ▼
GitHub Actions Runner
    │
    │ rsync (SSH)
    ▼
VPS: /root/deploy-backend/
    │
    │ npm ci
    │ npm run build
    ▼
VPS: /root/deploy-backend/dist/
    │
    │ docker build
    ▼
Docker Image (crm-backend)
    │
    │ docker run
    ▼
Running Container
    │
    │ HTTP GET /health
    ▼
Health Check Response (200 OK)
```

### Request Data Flow (Production)

```
Client (Browser/App)
    │
    │ HTTPS GET /api/health
    ▼
DNS (api.botreserva.com.br → 72.61.39.235)
    │
    ▼
VPS:443 (Nginx)
    │
    │ SSL Termination
    │ Proxy Pass
    ▼
Backend:3001 (Express)
    │
    │ Business Logic
    ▼
PostgreSQL:5432 (Database Query)
    │
    ▼
Redis:6379 (Cache Check)
    │
    ▼
Response JSON
    │
    │ Through Nginx
    ▼
Client (Browser/App)
```

---

## Backup Architecture

```
Deploy Triggered
    ↓
Before any changes
    ↓
┌─────────────────────────────────────┐
│ Create Backup                       │
│                                     │
│ backups/pre-deploy-YYYYMMDD-HHMMSS/ │
│   ├── dist/                         │
│   ├── package.json                  │
│   └── database.sql                  │
└─────────────────────────────────────┘
    ↓
Proceed with deploy
    ↓
If successful: Keep backup
If failed: Rollback from backup
    ↓
Cleanup: Keep only last 5 backups
```

---

## Monitoring Points

```
┌──────────────────────────────────────────┐
│  Monitoring Points                       │
├──────────────────────────────────────────┤
│                                          │
│  1. GitHub Actions                       │
│     - Workflow execution logs            │
│     - Step-by-step progress              │
│     - Success/Failure status             │
│                                          │
│  2. VPS Logs                             │
│     - docker logs crm-backend            │
│     - docker logs crm-nginx              │
│     - /var/log/syslog                    │
│                                          │
│  3. Application Health                   │
│     - GET /api/health                    │
│     - Container health checks            │
│     - Docker stats                       │
│                                          │
│  4. Infrastructure                       │
│     - Disk usage (df -h)                 │
│     - Memory usage (free -h)             │
│     - Docker system (docker info)        │
└──────────────────────────────────────────┘
```

---

## Rollback Architecture

```
Deploy Failed
    ↓
Detect failure (health check)
    ↓
┌─────────────────────────────────┐
│ Rollback Process                │
│                                 │
│ 1. Find latest backup           │
│    ls -t backups/ | head -1     │
│                                 │
│ 2. Stop backend                 │
│    docker-compose stop backend  │
│                                 │
│ 3. Restore files                │
│    cp -r backup/dist .          │
│    cp backup/package.json .     │
│                                 │
│ 4. Restore database (optional)  │
│    psql < backup/database.sql   │
│                                 │
│ 5. Restart backend              │
│    docker-compose start backend │
│                                 │
│ 6. Verify health                │
│    curl /health                 │
└─────────────────────────────────┘
    ↓
System restored to previous state
```

---

## Technology Stack

```
┌─────────────────────────────────────────┐
│  CI/CD Layer                            │
│  - GitHub Actions                       │
│  - rsync                                │
│  - SSH                                  │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Application Layer                      │
│  - Node.js 20                           │
│  - TypeScript                           │
│  - Express.js                           │
│  - Prisma ORM                           │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Container Layer                        │
│  - Docker                               │
│  - Docker Compose                       │
│  - Multi-stage builds                   │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Data Layer                             │
│  - PostgreSQL 16                        │
│  - Redis 7                              │
└─────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Infrastructure Layer                   │
│  - Ubuntu 24.04                         │
│  - Nginx (reverse proxy)                │
│  - Let's Encrypt (SSL)                  │
└─────────────────────────────────────────┘
```

---

## Deployment Timeline

```
Time  Step                          Status
────────────────────────────────────────────────
0:00  Developer pushes code         ●
0:01  GitHub detects changes        ●
0:02  Workflow starts               ●
0:05  Checkout & SSH setup          ●
0:10  Pre-deployment checks         ●
0:15  Create backup                 ●
0:30  Rsync files to VPS            ●
1:00  Install dependencies          ●
1:30  Build TypeScript              ●
1:45  Run migrations                ●
2:00  Restart container             ●
2:10  Health check (waiting)        ●
2:30  Health check passed           ✓
2:35  Post-deployment verify        ✓
2:40  Deploy complete               ✓
```

---

**Legenda**:
- `●` Em progresso
- `✓` Concluído com sucesso
- `✗` Falhou

---

**Última atualização**: 2025-11-15
