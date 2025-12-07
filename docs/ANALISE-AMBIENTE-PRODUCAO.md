# Analise Completa do Ambiente de Producao - VPS Backend

## Informacoes Gerais

**Servidor:** 72.61.39.235
**Usuario:** root
**Diretorio Base:** /root/deploy-backend/
**Dominio:** api.botreserva.com.br, botreserva.com.br
**Status:** AMBIENTE DOCKERIZADO EM PRODUCAO

---

## 1. ARQUITETURA E INFRAESTRUTURA

### 1.1 Containers Docker em Execucao

```
CONTAINER ID   NOME           IMAGEM                    STATUS                  PORTAS
9f041e877333   crm-nginx      nginx:alpine             Up 17 hours (healthy)   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
c69e289bcf56   crm-backend    deploy-backend-backend   Up 17 hours (healthy)   3001/tcp
15518d134fc0   crm-postgres   postgres:16-alpine       Up 17 hours (healthy)   0.0.0.0:5432->5432/tcp
b1f653597115   crm-redis      redis:7-alpine           Up 17 hours (healthy)   6379/tcp
7a7f5f87852b   crm-certbot    certbot/certbot          Up 17 hours             80/tcp, 443/tcp
```

### 1.2 Arquitetura de Rede

```
┌──────────────────────────────────────────────────────┐
│                    INTERNET                           │
└────────────┬────────────────────────┬─────────────────┘
             │                        │
             │ HTTP:80                │ HTTPS:443
             │                        │
    ┌────────▼────────────────────────▼───────────┐
    │         NGINX REVERSE PROXY                 │
    │   - SSL/TLS Termination                     │
    │   - Load Balancing                          │
    │   - CORS & Security Headers                 │
    └────────────────┬────────────────────────────┘
                     │
                     │ HTTP:3001
                     │
        ┌────────────▼───────────────┐
        │   BACKEND (Node.js/Express) │
        │   - API REST                │
        │   - WebSocket (Socket.io)   │
        │   - JWT Authentication      │
        │   - Multi-tenant            │
        └────┬──────────────┬─────────┘
             │              │
    ┌────────▼──────┐   ┌──▼─────────┐
    │  POSTGRESQL   │   │   REDIS    │
    │  Port: 5432   │   │  Port: 6379│
    │  - Database   │   │  - Cache   │
    │  - Prisma ORM │   │  - Queue   │
    └───────────────┘   └────────────┘
```

### 1.3 Rede Docker

**Rede:** crm-network (bridge driver)
**Comunicacao Interna:** Por nome de container (DNS interno do Docker)

---

## 2. ESTRUTURA DE DIRETORIOS

```
/root/deploy-backend/
├── src/                          # Codigo fonte TypeScript
│   ├── config/                   # Configuracoes (env, database, redis, logger, socket)
│   ├── controllers/              # Controllers da API (10 arquivos)
│   ├── middlewares/              # Middlewares (auth, validation, rate-limit, etc)
│   ├── routes/                   # Definicao de rotas (12 arquivos)
│   ├── services/                 # Logica de negocio (whatsapp, message, auth, etc)
│   ├── queues/                   # Bull queues e workers
│   │   └── workers/              # Workers para processamento assincrono
│   ├── utils/                    # Utilitarios
│   ├── validators/               # Validacao com Zod
│   ├── types/                    # TypeScript types
│   ├── test/                     # Testes unitarios e integracao
│   └── server.ts                 # Arquivo principal da aplicacao
│
├── dist/                         # Build de producao (TypeScript compilado)
│   └── (mesma estrutura do src/)
│
├── prisma/                       # ORM e Database
│   └── schema.prisma             # Schema do banco de dados
│
├── nginx/                        # Configuracao do Nginx
│   ├── nginx.conf                # Configuracao principal
│   └── conf.d/
│       └── api.conf              # Virtual host da API
│
├── certbot/                      # Certificados SSL (Let's Encrypt)
│   ├── conf/                     # Certificados
│   │   └── live/botreserva.com.br/
│   │       ├── fullchain.pem
│   │       ├── privkey.pem
│   │       └── chain.pem
│   └── www/                      # ACME challenge
│
├── backups/                      # Backups pre-deploy
│   ├── pre-deploy-20251121-132615/
│   ├── pre-deploy-20251121-144349/
│   └── (outros backups)
│
├── scripts/                      # Scripts utilitarios
│   ├── deploy.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── (outros scripts)
│
├── docs/                         # Documentacao
├── docker-compose.production.yml # Orquestracao Docker
├── Dockerfile.standalone         # Build da imagem backend
├── package.json                  # Dependencias Node.js
├── tsconfig.json                 # Configuracao TypeScript
├── jest.config.js                # Configuracao testes
└── .env                          # Variaveis de ambiente (PRODUCAO)
```

---

## 3. VARIAVEIS DE AMBIENTE (.env)

### 3.1 Database (PostgreSQL)

```env
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=SUA_SENHA_DATABASE
POSTGRES_DB=crm_whatsapp_saas
DATABASE_URL=postgresql://crm_user:SUA_SENHA_DATABASE@crm-postgres:5432/crm_whatsapp_saas?schema=public
```

### 3.2 Redis (Cache + Queue)

```env
REDIS_HOST=crm-redis
REDIS_PORT=6379
REDIS_PASSWORD=SUA_SENHA_REDIS
REDIS_URL=redis://:SUA_SENHA_REDIS@crm-redis:6379
```

### 3.3 JWT Authentication

```env
JWT_SECRET=crm_jwt_secret_min_32_chars_production_2024
JWT_REFRESH_SECRET=crm_refresh_secret_min_32_chars_production_2024
```

### 3.4 Application

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://projeto-eva-frontend.vercel.app,https://www.botreserva.com.br,https://botreserva.com.br
BASE_DOMAIN=botreserva.com.br
```

### 3.5 WhatsApp Business API

```env
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=webhook_verify_token_secure_2024
```

### 3.6 N8N Integration

```env
N8N_API_KEY=n8n_api_key_change_me
```

### 3.7 Super Admin

```env
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=SUA_SENHA_SUPER_ADMIN
```

### 3.8 Encryption

```env
ENCRYPTION_KEY=2b135afe5bc4771af1ca5a0d2d0a05dcfcbda79ec9d118fa3722670c0e98245a
```

---

## 4. BANCO DE DADOS

### 4.1 PostgreSQL 16 (Alpine)

**Container:** crm-postgres
**Porta Externa:** 5432
**Usuario:** crm_user
**Database:** crm_whatsapp_saas
**ORM:** Prisma
**Volume:** postgres_data (persistente)

### 4.2 Tabelas do Banco

```
 Schema |        Nome            | Tipo  |  Owner
--------|------------------------|-------|----------
 public | tenants                | table | crm_user  # Organizacoes/Hoteis (multi-tenant)
 public | users                  | table | crm_user  # Usuarios do sistema
 public | contacts               | table | crm_user  # Contatos do WhatsApp
 public | conversations          | table | crm_user  # Conversas
 public | messages               | table | crm_user  # Mensagens
 public | tags                   | table | crm_user  # Tags para organizacao
 public | escalations            | table | crm_user  # Escalonamentos
 public | usage_tracking         | table | crm_user  # Rastreamento de uso
 public | audit_logs             | table | crm_user  # Logs de auditoria
 public | webhook_events         | table | crm_user  # Eventos de webhook
 public | _ConversationToTag     | table | crm_user  # Relacao many-to-many
 public | _prisma_migrations     | table | crm_user  # Migrations Prisma
```

### 4.3 Schema Multi-Tenant

O sistema usa isolamento por `tenantId` em todas as queries:

```typescript
// Tenant Model
model Tenant {
  id    String @id @default(uuid())
  name  String // "Hotel Copacabana Palace"
  slug  String @unique // "hotelcopacabana"
  email String @unique

  status TenantStatus @default(TRIAL) // TRIAL, ACTIVE, SUSPENDED, CANCELLED
  plan   Plan         @default(BASIC) // BASIC, PRO, ENTERPRISE

  // WhatsApp Config (cada tenant tem suas credenciais)
  whatsappPhoneNumberId      String?
  whatsappAccessToken        String? // Criptografado
  whatsappBusinessAccountId  String?
  whatsappWebhookVerifyToken String?
  whatsappAppSecret          String?

  // N8N Integration
  n8nApiKey     String?
  n8nWebhookUrl String?

  // Relacoes (todos os dados isolados por tenant)
  users         User[]
  contacts      Contact[]
  conversations Conversation[]
  messages      Message[]
  tags          Tag[]
}
```

---

## 5. REDIS

**Container:** crm-redis
**Versao:** 7 (Alpine)
**Porta:** 6379 (interna)
**Password:** SUA_SENHA_REDIS
**Memoria Max:** 256MB
**Politica:** allkeys-lru
**Volume:** redis_data (persistente)

### 5.1 Uso do Redis

1. **Cache de Sessao:** Tokens JWT e sessoes de usuario
2. **Bull Queue:** Processamento assincrono de mensagens
3. **Rate Limiting:** Controle de taxa de requisicoes
4. **WebSocket State:** Estado das conexoes Socket.io

---

## 6. NGINX REVERSE PROXY

### 6.1 Configuracao Principal

**Arquivo:** /root/deploy-backend/nginx/nginx.conf

```nginx
worker_processes: auto
worker_connections: 1024
client_max_body_size: 20M
keepalive_timeout: 65s
gzip: on (comp_level 6)
```

### 6.2 Virtual Host (api.conf)

**Upstream Backend:**
```nginx
upstream backend {
    server backend:3001;
    keepalive 32;
    keepalive_timeout 60s;
    keepalive_requests 100;
}
```

**HTTP (Port 80):**
- ACME Challenge: `/.well-known/acme-challenge/`
- Health Check: `/health` (sem redirect)
- WhatsApp Webhook: `/webhooks/whatsapp` (sem redirect para compatibilidade)
- Outros: Redirect 301 para HTTPS

**HTTPS (Port 443):**
- Certificados Let's Encrypt: `/etc/letsencrypt/live/botreserva.com.br/`
- TLS 1.2 e 1.3
- HSTS: max-age=63072000
- CORS configurado
- WebSocket support: `/socket.io/`
- Proxy para backend:3001

### 6.3 Security Headers

```nginx
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 7. APLICACAO BACKEND (Node.js)

### 7.1 Stack Tecnologico

```json
{
  "runtime": "Node.js 20 (Alpine)",
  "language": "TypeScript 5.3",
  "framework": "Express 4.18",
  "orm": "Prisma 5.7",
  "validation": "Zod 3.22",
  "auth": "JWT (jsonwebtoken 9.0)",
  "websocket": "Socket.io 4.8",
  "queue": "Bull 4.12",
  "cache": "ioredis 5.3",
  "logger": "Pino 8.16",
  "security": "Helmet 7.1",
  "tests": "Jest 29.7",
  "build": "tsc + tsc-alias"
}
```

### 7.2 Estrutura de Rotas

```typescript
// Total: 12 arquivos de rotas
/api/auth           # Autenticacao (login, register, refresh, logout)
/api/users          # Gerenciamento de usuarios
/api/tenants        # Gerenciamento de tenants
/api/contacts       # Gerenciamento de contatos
/api/conversations  # Conversas (list, get, update status, assign)
/api/messages       # Mensagens (send, list, mark read)
/api/tags           # Tags
/api/reports        # Relatorios e estatisticas
/api/escalations    # Escalonamentos
/webhooks/whatsapp  # Webhook do WhatsApp Business
/n8n/*              # Integracao N8N
/health             # Health check
/debug/*            # Debug endpoints (dev only)
```

### 7.3 Controllers (10 arquivos)

```
auth.controller.ts         # Login, register, refresh token
contact.controller.ts      # CRUD de contatos
conversation.controller.ts # Gerenciamento de conversas
escalation.controller.ts   # Sistema de escalonamento
message.controller.ts      # Envio e listagem de mensagens
report.controller.ts       # Dashboard e relatorios
tenant.controller.ts       # Multi-tenant management
user.controller.ts         # Gerenciamento de usuarios
webhook.controller.ts      # Webhook WhatsApp v1
webhook.controller.v2.ts   # Webhook WhatsApp v2
```

### 7.4 Services (Logica de Negocio)

```
auth.service.ts            # Autenticacao e autorizacao
contact.service.ts         # Operacoes com contatos
conversation.service.ts    # Gerenciamento de conversas
escalation.service.ts      # Regras de escalonamento
message.service.ts         # Processamento de mensagens
message.service.v2.ts      # Versao 2 do servico
whatsapp.service.ts        # Integracao WhatsApp Business API
whatsapp.service.v2.ts     # Versao 2
tenant.service.ts          # Multi-tenant logic
n8n.service.ts             # Integracao N8N
image-processor.ts         # Processamento de imagens (HEIC, Sharp)
```

### 7.5 Middlewares

```typescript
auth.middleware.ts               # JWT validation, role-based access
tenant.middleware.ts             # Multi-tenant isolation (CRITICO)
validate.middleware.ts           # Zod schema validation
rate-limit.middleware.ts         # Rate limiting (general, auth, webhook)
webhook-validation.middleware.ts # WhatsApp HMAC signature validation
n8n-auth.middleware.ts          # N8N API key validation
error-handler.middleware.ts      # Global error handler
raw-body.middleware.ts          # Raw body for webhook validation
```

### 7.6 Queues e Workers

**Bull Queue com Redis:**

```typescript
// Queues
- message-outgoing-queue  # Envio de mensagens para WhatsApp
- webhook-processing-queue # Processamento de webhooks
- status-update-queue      # Atualizacao de status de mensagens

// Workers
/queues/workers/
  - message-worker.ts      # Processa envio de mensagens
  - webhook-worker.ts      # Processa eventos de webhook
  - status-worker.ts       # Atualiza status de mensagens
```

### 7.7 WebSocket (Socket.io)

**Eventos em Tempo Real:**

```typescript
// Client -> Server
'authenticate'           # Autenticacao do socket
'join:conversation'      # Entrar numa conversa
'leave:conversation'     # Sair de uma conversa
'typing:start'          # Usuario digitando
'typing:stop'           # Usuario parou de digitar

// Server -> Client
'message:new'           # Nova mensagem (inbound/outbound)
'message:status'        # Status atualizado (sent, delivered, read, failed)
'conversation:updated'  # Conversa atualizada
'conversation:assigned' # Conversa atribuida
```

**Rooms:**
```typescript
`tenant:${tenantId}`                    # Todos usuarios do tenant
`conversation:${conversationId}`        # Usuarios numa conversa especifica
```

---

## 8. DOCKER CONFIGURATION

### 8.1 docker-compose.production.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: crm-postgres
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck: pg_isready

  redis:
    image: redis:7-alpine
    container_name: crm-redis
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb
    volumes: [redis_data:/data]
    healthcheck: redis-cli incr ping

  backend:
    build:
      context: .
      dockerfile: Dockerfile.standalone
    container_name: crm-backend
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck: node health check script

  nginx:
    image: nginx:alpine
    container_name: crm-nginx
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
    depends_on: [backend]

  certbot:
    image: certbot/certbot
    container_name: crm-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    # Auto-renewal every 12h

volumes:
  postgres_data:
  redis_data:

networks:
  crm-network:
    driver: bridge
```

### 8.2 Dockerfile.standalone

**Multi-stage Build:**

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
- Install build dependencies (python3, make, g++, openssl)
- npm ci (compile native modules for Alpine)
- Prisma generate
- TypeScript build

# Stage 2: Production
FROM node:20-alpine AS production
- Install dumb-init (proper signal handling)
- Create non-root user (nodejs:1001)
- Copy node_modules + dist + prisma
- EXPOSE 3001
- HEALTHCHECK on /health
- Start with: dumb-init node dist/server.js
```

---

## 9. SSL/TLS CERTIFICATES

### 9.1 Let's Encrypt

**Provedor:** Let's Encrypt (Certbot)
**Dominio:** botreserva.com.br (wildcard ou subdomains)
**Validacao:** HTTP-01 Challenge
**Renovacao:** Automatica (Certbot container, a cada 12h)
**Validade:** 90 dias

**Certificados:**
```
/root/deploy-backend/certbot/conf/live/botreserva.com.br/
  ├── fullchain.pem      # Certificado completo (usado pelo Nginx)
  ├── privkey.pem        # Chave privada
  ├── chain.pem          # Cadeia de certificacao
  └── cert.pem           # Certificado do dominio
```

### 9.2 Configuracao TLS no Nginx

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_stapling on;
ssl_stapling_verify on;
```

---

## 10. PORTS E FIREWALL

### 10.1 Portas Expostas

```
80/tcp   -> Nginx (HTTP)  -> Redirect to HTTPS + ACME Challenge
443/tcp  -> Nginx (HTTPS) -> API + WebSocket
5432/tcp -> PostgreSQL    -> Database (EXPOSTA - RISCO DE SEGURANCA!)

Portas Internas (Docker network):
3001/tcp -> Backend
6379/tcp -> Redis
```

**ALERTA DE SEGURANCA:**
```
CRITICO: PostgreSQL porta 5432 esta EXPOSTA publicamente!
- Isso e um GRANDE RISCO DE SEGURANCA
- Deve ser fechada e acessivel APENAS internamente via Docker
- Modificar docker-compose.production.yml:
  postgres:
    ports: [] # Remover mapeamento de porta
```

### 10.2 Firewall Recomendado (UFW)

```bash
# Bloquear tudo por padrao
ufw default deny incoming
ufw default allow outgoing

# Abrir apenas portas necessarias
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# FECHAR PostgreSQL
ufw deny 5432/tcp

# Ativar firewall
ufw enable
```

---

## 11. LOGS E MONITORAMENTO

### 11.1 Logs do Backend

**Logger:** Pino (JSON structured logging)
**Formato:** JSON Lines
**Destino:** STDOUT (Docker logs)

**Ver logs em tempo real:**
```bash
docker logs -f crm-backend
docker logs -f crm-backend --tail 100
docker logs -f crm-nginx
```

### 11.2 Health Checks

**Endpoint:** GET /health
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-05T10:00:00.000Z",
  "uptime": 62400
}
```

**Docker Health Checks:**
- Backend: HTTP GET localhost:3001/health (30s interval)
- PostgreSQL: pg_isready (10s interval)
- Redis: redis-cli incr ping (10s interval)
- Nginx: wget localhost/health (30s interval)

### 11.3 Monitoramento Recomendado

**Faltando (para adicionar):**

1. **Application Performance Monitoring (APM)**
   - New Relic, Datadog, ou Sentry
   - Trace de requisicoes
   - Error tracking

2. **Metrics Collection**
   - Prometheus + Grafana
   - Metricas de CPU, memoria, disco
   - Metricas de aplicacao (requests/s, latency, errors)

3. **Log Aggregation**
   - ELK Stack (Elasticsearch, Logstash, Kibana)
   - Loki + Grafana

4. **Uptime Monitoring**
   - UptimeRobot ou Pingdom
   - Alertas de downtime

---

## 12. BACKUP E DISASTER RECOVERY

### 12.1 Backups Automaticos

**Diretorio:** /root/deploy-backend/backups/

```
backups/
├── pre-deploy-20251121-132615/
├── pre-deploy-20251121-144349/
├── pre-deploy-20251121-184534/
├── pre-deploy-20251124-122809/
└── pre-deploy-20251124-134615/
```

**Scripts disponiveis:**
```bash
/root/deploy-backend/scripts/backup.sh   # Backup manual
/root/deploy-backend/scripts/restore.sh  # Restauracao
```

### 12.2 Estrategia de Backup Recomendada

**Faltando (para implementar):**

1. **Backup Diario Automatizado (Cron)**
   ```bash
   # Adicionar ao crontab
   0 2 * * * /root/deploy-backend/scripts/backup.sh >> /var/log/backup.log 2>&1
   ```

2. **Backup Offsite**
   - AWS S3, Google Cloud Storage, ou Backblaze B2
   - Copia automatica dos backups

3. **Retention Policy**
   - Daily: ultimos 7 dias
   - Weekly: ultimas 4 semanas
   - Monthly: ultimos 12 meses

4. **Teste de Restauracao**
   - Testar restauracao mensalmente
   - Documentar procedimento

---

## 13. DEPLOYMENT E CI/CD

### 13.1 Processo de Deploy Atual

**Manual via SSH:**
```bash
ssh root@72.61.39.235
cd /root/deploy-backend
git pull origin main
docker-compose -f docker-compose.production.yml build backend
docker-compose -f docker-compose.production.yml up -d backend
docker-compose -f docker-compose.production.yml restart nginx
```

### 13.2 CI/CD Recomendado (GitHub Actions)

**Pipeline proposto:**

1. **Test Stage**
   - Run unit tests
   - Run integration tests
   - Security audit (npm audit)
   - Lint & type check

2. **Build Stage**
   - Build Docker image
   - Push to registry (GitHub Container Registry)

3. **Deploy Stage (Production)**
   - SSH to VPS
   - Pull new image
   - Run database migrations
   - Rolling restart containers
   - Smoke tests

---

## 14. SECURITY AUDIT

### 14.1 Vulnerabilidades Encontradas

**CRITICAS:**

1. **PostgreSQL Exposto Publicamente (5432/tcp)**
   - Severidade: CRITICA
   - Acao: Fechar porta imediatamente
   - Fix: Remover mapeamento de porta no docker-compose

2. **Senhas no .env Commitadas**
   - Arquivo .env esta no servidor com senhas em texto claro
   - Recomendacao: Usar secrets management (AWS Secrets Manager, Vault)

3. **No Firewall Ativo**
   - Todas as portas abertas
   - Acao: Configurar UFW

**MEDIAS:**

4. **Container rodando como root internamente**
   - Backend constroi com user nodejs:1001, mas pode ter privilegios elevados
   - Verificar com: docker exec crm-backend whoami

5. **Sem Rate Limiting em algumas rotas**
   - Webhook endpoint pode ser abusado
   - Implementar rate limiting especifico

6. **Logs sem rotacao configurada**
   - Docker logs podem crescer infinitamente
   - Configurar log rotation

**BAIXAS:**

7. **Dependencias desatualizadas**
   - Rodar npm audit e atualizar pacotes

8. **Sem Content Security Policy (CSP)**
   - Adicionar headers CSP no Nginx

### 14.2 Recomendacoes de Seguranca

```bash
# 1. Fechar PostgreSQL
# Editar docker-compose.production.yml:
postgres:
  # ports: ["5432:5432"]  # REMOVER ESTA LINHA

# 2. Ativar Firewall
ufw enable
ufw allow 22,80,443/tcp
ufw deny 5432/tcp

# 3. Rotacao de senhas
# Gerar novas senhas fortes:
openssl rand -base64 32  # Para JWT_SECRET, REDIS_PASSWORD, etc.

# 4. Backup offsite
# Configurar rsync ou AWS CLI para backup automatico

# 5. Monitoring
# Instalar Prometheus + Grafana ou usar servico cloud

# 6. Docker Secrets
# Migrar de .env para Docker Secrets:
docker secret create db_password db_password.txt
```

---

## 15. PERFORMANCE E OTIMIZACAO

### 15.1 Configuracoes Atuais

**Backend:**
- Node.js 20 (Alpine) - Leve e eficiente
- Keepalive connections
- Socket.io com Redis adapter (escalavel)
- Bull queue para processamento assincrono

**Nginx:**
- Gzip compression (level 6)
- Keepalive connections (32)
- Worker connections: 1024
- Client max body size: 20MB

**PostgreSQL:**
- Sem tuning especifico
- Usando configuracoes default do Alpine

**Redis:**
- Max memory: 256MB
- Eviction policy: allkeys-lru

### 15.2 Otimizacoes Recomendadas

**PostgreSQL Tuning:**
```sql
# /etc/postgresql/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
max_connections = 100
```

**Redis Tuning:**
```bash
# Aumentar memoria se necessario
maxmemory 512mb
# Persistencia (RDB)
save 900 1
save 300 10
```

**Nginx Caching:**
```nginx
# Cache de assets estaticos
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
```

**Backend:**
```javascript
// Prisma connection pooling
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 20
}
```

---

## 16. COMANDOS UTEIS

### 16.1 Docker

```bash
# Ver status dos containers
docker ps -a

# Ver logs em tempo real
docker logs -f crm-backend

# Entrar no container
docker exec -it crm-backend sh

# Reiniciar servicos
docker-compose -f docker-compose.production.yml restart backend
docker-compose -f docker-compose.production.yml restart nginx

# Rebuild e restart
docker-compose -f docker-compose.production.yml up -d --build backend

# Ver uso de recursos
docker stats

# Limpar recursos nao utilizados
docker system prune -a
```

### 16.2 Database

```bash
# Conectar ao PostgreSQL
docker exec -it crm-postgres psql -U crm_user -d crm_whatsapp_saas

# Backup manual
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup.sql

# Restore
cat backup.sql | docker exec -i crm-postgres psql -U crm_user -d crm_whatsapp_saas

# Ver tabelas
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c '\dt'

# Ver tamanho do banco
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT pg_size_pretty(pg_database_size('crm_whatsapp_saas'));"
```

### 16.3 Redis

```bash
# Conectar ao Redis
docker exec -it crm-redis redis-cli -a SUA_SENHA_REDIS

# Ver keys
KEYS *

# Ver info
INFO

# Limpar cache
FLUSHDB

# Monitorar comandos
MONITOR
```

### 16.4 Nginx

```bash
# Testar configuracao
docker exec crm-nginx nginx -t

# Reload configuracao (sem downtime)
docker exec crm-nginx nginx -s reload

# Ver logs de acesso
docker exec crm-nginx tail -f /var/log/nginx/access.log

# Ver logs de erro
docker exec crm-nginx tail -f /var/log/nginx/error.log
```

### 16.5 SSL/TLS

```bash
# Renovar certificado manualmente
docker-compose -f docker-compose.production.yml run --rm certbot renew

# Ver informacoes do certificado
openssl x509 -in /root/deploy-backend/certbot/conf/live/botreserva.com.br/fullchain.pem -text -noout

# Testar SSL
curl -vI https://api.botreserva.com.br/health

# Testar SSL com OpenSSL
openssl s_client -connect api.botreserva.com.br:443
```

---

## 17. TROUBLESHOOTING

### 17.1 Backend nao inicia

```bash
# Ver logs detalhados
docker logs crm-backend --tail 100

# Verificar variaveis de ambiente
docker exec crm-backend env | grep -E 'DATABASE_URL|REDIS_URL|PORT'

# Verificar conexao com banco
docker exec crm-backend node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.$connect().then(() => console.log('DB OK')).catch(e => console.error(e))"

# Verificar porta em uso
docker exec crm-backend netstat -tlnp | grep 3001
```

### 17.2 Erro de conexao com banco

```bash
# Verificar se PostgreSQL esta rodando
docker ps | grep postgres

# Testar conexao
docker exec crm-postgres pg_isready -U crm_user

# Ver logs do PostgreSQL
docker logs crm-postgres --tail 50

# Verificar network
docker network inspect crm-network
```

### 17.3 Nginx 502 Bad Gateway

```bash
# Verificar se backend esta rodando
docker ps | grep backend

# Testar backend diretamente (dentro da rede Docker)
docker exec crm-nginx wget -O- http://backend:3001/health

# Ver logs do Nginx
docker logs crm-nginx --tail 50

# Verificar upstream
docker exec crm-nginx cat /etc/nginx/conf.d/api.conf | grep upstream
```

### 17.4 SSL/HTTPS nao funciona

```bash
# Verificar certificados
ls -la /root/deploy-backend/certbot/conf/live/botreserva.com.br/

# Testar renovacao (dry-run)
docker-compose -f docker-compose.production.yml run --rm certbot renew --dry-run

# Ver logs do Certbot
docker logs crm-certbot

# Verificar configuracao SSL no Nginx
docker exec crm-nginx nginx -T | grep ssl
```

---

## 18. PROXIMOS PASSOS PARA AMBIENTE DE DESENVOLVIMENTO

### 18.1 Estrategia de Replicacao

**Opcao 1: Docker Compose Local (RECOMENDADO)**

Criar um `docker-compose.dev.yml` baseado no de producao:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: dev-postgres
    ports: ["5433:5432"]  # Porta diferente para nao conflitar
    environment:
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: crm_dev
    volumes:
      - dev_postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: dev-redis
    ports: ["6380:6379"]
    command: redis-server --requirepass dev_redis_pass

  # Backend roda localmente (npm run dev)
  # Nao precisa de container

volumes:
  dev_postgres_data:
```

**Vantagens:**
- Ambiente isolado e reproduzivel
- Facil de compartilhar com equipe
- Nao afeta producao

**Opcao 2: Clonar dados de producao (NAO RECOMENDADO)**

```bash
# Fazer backup do banco de producao
ssh root@72.61.39.235 "docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas" > prod-backup.sql

# Importar no ambiente local
psql -U dev_user -d crm_dev -f prod-backup.sql
```

**Desvantagens:**
- Dados sensiveis em ambiente dev
- LGPD/GDPR compliance issues

### 18.2 Arquivo .env.development

Criar `/deploy-backend/.env.development`:

```env
# Database (local Docker)
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5433/crm_dev

# Redis (local Docker)
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=dev_redis_pass
REDIS_URL=redis://:dev_redis_pass@localhost:6380

# JWT (diferentes de producao)
JWT_SECRET=dev_jwt_secret_change_me_min_32_chars
JWT_REFRESH_SECRET=dev_refresh_secret_change_me_min_32_chars

# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173,http://localhost:3000

# WhatsApp (usar credenciais de teste)
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=dev_webhook_token

# N8N (opcional)
N8N_API_KEY=dev_n8n_key

# Super Admin (local)
SUPER_ADMIN_EMAIL=admin@dev.local
SUPER_ADMIN_PASSWORD=Dev123!

# Encryption
ENCRYPTION_KEY=dev_encryption_key_32_chars_here
```

### 18.3 Script de Setup Desenvolvimento

Criar `setup-dev.sh`:

```bash
#!/bin/bash
set -e

echo "Setting up development environment..."

# 1. Instalar dependencias
npm install

# 2. Subir Docker Compose (apenas DB e Redis)
docker-compose -f docker-compose.dev.yml up -d

# 3. Aguardar servicos ficarem prontos
echo "Waiting for PostgreSQL..."
sleep 5

# 4. Rodar migrations
npm run prisma:migrate

# 5. Seed database (dados de exemplo)
npm run prisma:seed

# 6. Gerar Prisma Client
npm run prisma:generate

echo "Development environment ready!"
echo "Run 'npm run dev' to start the backend"
```

### 18.4 Comandos de Desenvolvimento

```bash
# Setup inicial
chmod +x setup-dev.sh
./setup-dev.sh

# Desenvolvimento
npm run dev              # Inicia backend com hot-reload (tsx watch)
npm run prisma:studio    # Interface visual do banco
npm test                 # Testes
npm run test:watch       # Testes em watch mode
npm run lint             # Linter

# Database
npm run prisma:migrate   # Criar nova migration
npm run prisma:seed      # Popular banco com dados de exemplo
npm run prisma:reset     # Resetar banco (cuidado!)
```

---

## 19. CHECKLIST DE SEGURANCA PARA PRODUCAO

### Urgente (fazer AGORA)

- [ ] Fechar porta 5432 do PostgreSQL (remover mapeamento no docker-compose)
- [ ] Configurar firewall UFW
- [ ] Rotacionar senha do banco de dados
- [ ] Rotacionar JWT secrets
- [ ] Rotacionar senha do Redis
- [ ] Configurar log rotation no Docker

### Importante (proximas semanas)

- [ ] Implementar backup automatizado diario (cron)
- [ ] Configurar backup offsite (AWS S3)
- [ ] Adicionar monitoramento (Prometheus + Grafana ou APM)
- [ ] Implementar alertas (email/SMS) para downtime
- [ ] Configurar CI/CD pipeline (GitHub Actions)
- [ ] Adicionar testes de restauracao de backup
- [ ] Implementar Docker Secrets (remover .env)
- [ ] Audit de dependencias (npm audit fix)

### Recomendado (longo prazo)

- [ ] Migrar para Kubernetes (escalabilidade)
- [ ] Implementar multi-region deployment
- [ ] Adicionar WAF (Web Application Firewall)
- [ ] Implementar disaster recovery plan completo
- [ ] Documentar runbook de incidentes
- [ ] Implementar canary deployments
- [ ] Adicionar cache em CDN
- [ ] Otimizar queries do banco (indices, explain analyze)

---

## 20. RESUMO EXECUTIVO

### Infraestrutura Atual

- **Servidor:** VPS 72.61.39.235
- **Stack:** Docker + Node.js 20 + TypeScript + PostgreSQL 16 + Redis 7 + Nginx
- **Dominio:** api.botreserva.com.br (SSL Let's Encrypt)
- **Status:** PRODUCAO ATIVA, funcionando ha ~17 horas

### Pontos Fortes

1. Arquitetura Docker bem estruturada
2. Multi-tenant isolation implementado
3. SSL/TLS configurado corretamente
4. WebSocket para tempo real funcionando
5. Queue system para processamento assincrono
6. Health checks em todos os servicos
7. Codigo TypeScript bem organizado

### Pontos Fracos (URGENTE)

1. **CRITICO:** PostgreSQL exposto publicamente (porta 5432)
2. **CRITICO:** Sem firewall configurado
3. Sem backup automatizado
4. Sem monitoramento/alertas
5. Senhas em .env (nao usar secrets management)
6. Sem CI/CD pipeline

### Recomendacoes Imediatas

1. Fechar porta 5432 do PostgreSQL HOJE
2. Configurar firewall UFW HOJE
3. Implementar backup automatizado esta semana
4. Configurar monitoramento/alertas em 2 semanas
5. Setup ambiente de desenvolvimento local esta semana

---

## CONTATO E SUPORTE

**Acesso SSH:** root@72.61.39.235
**Diretorio Backend:** /root/deploy-backend/
**URL API:** https://api.botreserva.com.br
**URL Frontend:** https://projeto-eva-frontend.vercel.app

**Scripts importantes:**
- Deploy: /root/deploy-backend/scripts/deploy.sh
- Backup: /root/deploy-backend/scripts/backup.sh
- Restore: /root/deploy-backend/scripts/restore.sh

---

## CHANGELOG

- 2025-12-05: Analise inicial completa do ambiente de producao
- 2025-12-07: Sanitizacao de credenciais expostas

---

> **IMPORTANTE:** Substitua os placeholders pelas credenciais reais obtidas do painel Meta Business ou ambiente de producao. Os valores como `SUA_SENHA_DATABASE`, `SUA_SENHA_REDIS` e `SUA_SENHA_SUPER_ADMIN` devem ser substituidos pelas senhas reais antes de usar em producao.
