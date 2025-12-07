# Resumo Executivo - Infraestrutura Backend CRM WhatsApp

## Visao Geral do Sistema

### Sistema Multi-Tenant CRM para WhatsApp Business
- **Proposito:** Plataforma SaaS para gerenciamento de conversas WhatsApp para hoteis
- **Arquitetura:** Microservices com Docker, API REST + WebSocket
- **Status:** PRODUCAO ATIVA na VPS 72.61.39.235

---

## Stack Tecnologico

### Backend
```
Node.js 20 (Alpine)
TypeScript 5.3
Express 4.18
Prisma ORM 5.7
Socket.io 4.8 (WebSocket)
Bull 4.12 (Queue)
```

### Database
```
PostgreSQL 16 (Alpine)
Redis 7 (Alpine)
```

### Infrastructure
```
Docker + Docker Compose
Nginx (Reverse Proxy + SSL)
Let's Encrypt (SSL/TLS)
```

---

## Arquitetura Visual

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└────────────┬────────────────────────────┬──────────────────┘
             │                            │
             │ HTTP:80                    │ HTTPS:443
             │                            │
    ┌────────▼────────────────────────────▼─────────────┐
    │           NGINX REVERSE PROXY                     │
    │   SSL Termination | CORS | Security Headers      │
    └────────────────┬──────────────────────────────────┘
                     │
                     │ HTTP:3001
                     │
        ┌────────────▼──────────────────┐
        │   BACKEND CONTAINER            │
        │   - REST API                   │
        │   - WebSocket (Socket.io)      │
        │   - JWT Auth                   │
        │   - Multi-tenant Isolation     │
        │   - Bull Queue Workers         │
        └────┬───────────────┬───────────┘
             │               │
    ┌────────▼──────┐   ┌───▼──────────┐
    │  POSTGRESQL   │   │    REDIS     │
    │  Port: 5432   │   │  Port: 6379  │
    │  Multi-tenant │   │  Cache+Queue │
    │  12 Tables    │   │  256MB       │
    └───────────────┘   └──────────────┘
```

---

## Containers Docker em Producao

| Container | Imagem | Status | Portas | Funcao |
|-----------|--------|--------|--------|--------|
| crm-nginx | nginx:alpine | Up 17h (healthy) | 80, 443 | Reverse Proxy + SSL |
| crm-backend | custom (Node 20) | Up 17h (healthy) | 3001 | API + WebSocket |
| crm-postgres | postgres:16-alpine | Up 17h (healthy) | 5432 | Database |
| crm-redis | redis:7-alpine | Up 17h (healthy) | 6379 | Cache + Queue |
| crm-certbot | certbot/certbot | Up 17h | - | SSL Auto-renewal |

---

## Estrutura do Banco de Dados

### Tabelas Principais

```sql
-- Multi-tenant
tenants               # Organizacoes/Hoteis

-- Usuarios e Autenticacao
users                 # Usuarios do sistema (admin, atendentes)

-- WhatsApp
contacts              # Contatos do WhatsApp
conversations         # Conversas
messages              # Mensagens (text, image, audio, video, etc)

-- Organizacao
tags                  # Tags para classificacao
_ConversationToTag    # Relacao many-to-many

-- Sistema
escalations           # Escalonamentos
usage_tracking        # Rastreamento de uso/cotas
audit_logs            # Logs de auditoria
webhook_events        # Eventos de webhook
```

### Isolamento Multi-Tenant

Todas as queries incluem `WHERE tenantId = ?` para isolamento completo.

---

## Endpoints da API

### Autenticacao
```
POST   /auth/login           # Login
POST   /auth/register         # Registro
POST   /auth/refresh          # Refresh token
POST   /auth/logout           # Logout
GET    /auth/me               # Usuario atual
```

### Usuarios
```
GET    /api/users             # Listar usuarios
GET    /api/users/:id         # Ver usuario
POST   /api/users             # Criar usuario
PATCH  /api/users/:id         # Atualizar usuario
DELETE /api/users/:id         # Deletar usuario
```

### Contatos
```
GET    /api/contacts          # Listar contatos
GET    /api/contacts/:id      # Ver contato
POST   /api/contacts          # Criar contato
PATCH  /api/contacts/:id      # Atualizar contato
```

### Conversas
```
GET    /api/conversations           # Listar conversas
GET    /api/conversations/:id       # Ver conversa
PATCH  /api/conversations/:id       # Atualizar status
POST   /api/conversations/:id/assign # Atribuir atendente
GET    /api/conversations/:id/messages # Mensagens da conversa
```

### Mensagens
```
POST   /api/messages          # Enviar mensagem
GET    /api/messages          # Listar mensagens
PATCH  /api/messages/:id/read # Marcar como lida
```

### Webhook
```
GET    /webhooks/whatsapp     # Verificacao (WhatsApp)
POST   /webhooks/whatsapp     # Receber eventos
```

### N8N Integration
```
POST   /n8n/message           # Enviar mensagem via N8N
POST   /n8n/template          # Enviar template
GET    /n8n/conversation/:id  # Buscar conversa
```

### Health Check
```
GET    /health                # Status da API
```

---

## WebSocket Events (Socket.io)

### Client -> Server
```javascript
// Autenticacao
socket.emit('authenticate', { token })

// Entrar/sair de conversa
socket.emit('join:conversation', { conversationId })
socket.emit('leave:conversation', { conversationId })

// Digitando
socket.emit('typing:start', { conversationId })
socket.emit('typing:stop', { conversationId })
```

### Server -> Client
```javascript
// Nova mensagem
socket.on('message:new', (message) => {})

// Status atualizado
socket.on('message:status', ({ messageId, status }) => {})

// Conversa atualizada
socket.on('conversation:updated', (conversation) => {})

// Conversa atribuida
socket.on('conversation:assigned', ({ conversationId, attendantId }) => {})
```

---

## Variaveis de Ambiente (Principais)

### Database
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=***
POSTGRES_DB=crm_whatsapp_saas
```

### Redis
```env
REDIS_HOST=crm-redis
REDIS_PORT=6379
REDIS_PASSWORD=***
REDIS_URL=redis://:***@host:6379
```

### JWT
```env
JWT_SECRET=***
JWT_REFRESH_SECRET=***
```

### Application
```env
NODE_ENV=production|development
PORT=3001
FRONTEND_URL=https://...
BASE_DOMAIN=botreserva.com.br
```

### WhatsApp
```env
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=***
```

---

## Fluxo de Mensagem WhatsApp

### Mensagem Inbound (Cliente -> Sistema)

```
1. WhatsApp API -> POST /webhooks/whatsapp
2. Validar HMAC signature
3. Enfileirar evento (Bull Queue)
4. Worker processa:
   - Criar/atualizar contato
   - Criar/atualizar conversa
   - Criar mensagem (status: RECEIVED)
   - Processar midia (se houver)
5. Emitir evento Socket.io:
   - Para sala da conversa
   - Para sala do tenant
6. Webhook N8N (se configurado)
```

### Mensagem Outbound (Sistema -> Cliente)

```
1. Frontend -> POST /api/messages
2. Autenticar e validar
3. Criar mensagem (status: PENDING)
4. Emitir Socket.io imediatamente (UI feedback)
5. Enfileirar job (Bull Queue)
6. Worker processa:
   - Buscar credenciais do tenant
   - Enviar via WhatsApp API
   - Atualizar status (SENT, DELIVERED, READ, FAILED)
7. Emitir Socket.io (status atualizado)
```

---

## Bull Queue Workers

### 1. Message Outgoing Worker
- **Funcao:** Enviar mensagens para WhatsApp API
- **Processamento:** Assincrono
- **Retry:** 3 tentativas com backoff exponencial
- **Prioridade:** Alta para mensagens manuais, normal para templates

### 2. Webhook Processing Worker
- **Funcao:** Processar eventos de webhook (mensagens, status)
- **Processamento:** Assincrono
- **Deduplicacao:** Por whatsappMessageId

### 3. Status Update Worker
- **Funcao:** Atualizar status de mensagens (sent, delivered, read)
- **Processamento:** Assincrono
- **Emite:** Socket.io events

---

## Seguranca

### Implementado
- [x] HTTPS/TLS (Let's Encrypt)
- [x] JWT Authentication
- [x] Rate Limiting (Express Rate Limit)
- [x] Helmet (Security Headers)
- [x] CORS configurado
- [x] Input Validation (Zod)
- [x] Multi-tenant Isolation
- [x] WhatsApp HMAC Signature Validation
- [x] Password Hashing (bcrypt)
- [x] Sensitive Data Encryption

### CRITICO - Vulnerabilidades Encontradas
- [ ] PostgreSQL exposto publicamente (porta 5432)
- [ ] Sem firewall ativo (UFW)
- [ ] Senhas em .env (nao usa secrets management)
- [ ] Sem rotacao de logs configurada

---

## Monitoramento e Logs

### Logs
- **Formato:** JSON (Pino)
- **Destino:** STDOUT (Docker logs)
- **Acesso:** `docker logs -f crm-backend`

### Health Checks
- **Backend:** GET /health (30s interval)
- **PostgreSQL:** pg_isready (10s interval)
- **Redis:** redis-cli incr ping (10s interval)
- **Nginx:** wget /health (30s interval)

### Metricas (FALTANDO)
- [ ] Prometheus + Grafana
- [ ] APM (New Relic, Datadog, Sentry)
- [ ] Uptime monitoring
- [ ] Log aggregation (ELK, Loki)

---

## Backup e Disaster Recovery

### Backups Automaticos
- **Diretorio:** /root/deploy-backend/backups/
- **Frequencia:** Pre-deploy (manual)
- **Retencao:** Indefinida (precisa de politica)

### FALTANDO
- [ ] Backup diario automatizado (cron)
- [ ] Backup offsite (AWS S3, GCS)
- [ ] Politica de retencao
- [ ] Testes de restauracao

---

## Deploy Atual (Manual)

```bash
# 1. SSH na VPS
ssh root@72.61.39.235

# 2. Navegar para diretorio
cd /root/deploy-backend

# 3. Pull do codigo
git pull origin main

# 4. Build e restart
docker-compose -f docker-compose.production.yml build backend
docker-compose -f docker-compose.production.yml up -d backend
docker-compose -f docker-compose.production.yml restart nginx

# 5. Verificar logs
docker logs -f crm-backend
```

---

## Performance

### Configuracoes Atuais
- **Nginx:**
  - Keepalive: 32 conexoes
  - Worker connections: 1024
  - Gzip compression: level 6
  - Client max body: 20MB

- **Backend:**
  - Node.js 20 (Alpine) - Otimizado
  - Socket.io com Redis adapter (escalavel)
  - Bull Queue (processamento assincrono)

- **PostgreSQL:**
  - Configuracoes default (precisa tuning)

- **Redis:**
  - Max memory: 256MB
  - Eviction: allkeys-lru

### Otimizacoes Recomendadas
- [ ] PostgreSQL tuning (shared_buffers, effective_cache_size)
- [ ] Nginx caching
- [ ] Prisma connection pooling configurado
- [ ] CDN para assets estaticos
- [ ] Database indexes otimizados

---

## Ambiente de Desenvolvimento

### Setup Recomendado

```yaml
# docker-compose.dev.yml
services:
  postgres-dev:    # Porta 5433
  redis-dev:       # Porta 6380
  adminer:         # http://localhost:8080
```

### Comandos Principais

```bash
# Setup inicial
npm install
docker-compose -f docker-compose.dev.yml up -d
npm run prisma:migrate
npm run prisma:seed

# Desenvolvimento
npm run dev              # Hot-reload backend
npm run prisma:studio    # Interface visual DB
npm test                 # Testes

# Database
npm run prisma:migrate   # Nova migration
npm run prisma:seed      # Dados de teste
npm run prisma:reset     # Reset completo
```

---

## Comandos Rapidos de Producao

### Docker
```bash
# Status
docker ps -a
docker stats

# Logs
docker logs -f crm-backend
docker logs -f crm-nginx

# Reiniciar
docker-compose -f docker-compose.production.yml restart backend
```

### Database
```bash
# Conectar
docker exec -it crm-postgres psql -U crm_user -d crm_whatsapp_saas

# Backup
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup.sql

# Ver tabelas
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c '\dt'
```

### Redis
```bash
# Conectar
docker exec -it crm-redis redis-cli -a SUA_SENHA_REDIS

# Ver keys
KEYS *

# Limpar (CUIDADO!)
FLUSHDB
```

---

## Troubleshooting Rapido

### Backend nao inicia
```bash
docker logs crm-backend --tail 100
docker exec crm-backend env | grep DATABASE_URL
```

### Erro de conexao com banco
```bash
docker ps | grep postgres
docker exec crm-postgres pg_isready -U crm_user
docker logs crm-postgres --tail 50
```

### Nginx 502 Bad Gateway
```bash
docker ps | grep backend
docker exec crm-nginx wget -O- http://backend:3001/health
docker logs crm-nginx --tail 50
```

### SSL nao funciona
```bash
ls -la /root/deploy-backend/certbot/conf/live/botreserva.com.br/
docker logs crm-certbot
docker exec crm-nginx nginx -T | grep ssl
```

---

## Proximos Passos Recomendados

### Urgente (Esta Semana)
1. [ ] Fechar porta 5432 do PostgreSQL
2. [ ] Configurar firewall UFW
3. [ ] Rotacionar senhas de producao
4. [ ] Configurar backup automatizado diario
5. [ ] Setup ambiente de desenvolvimento local

### Importante (Proximas 2 Semanas)
6. [ ] Implementar monitoramento (Prometheus/Grafana ou APM)
7. [ ] Configurar alertas de downtime
8. [ ] Backup offsite (AWS S3)
9. [ ] CI/CD pipeline (GitHub Actions)
10. [ ] Audit de seguranca completo

### Longo Prazo (1-3 Meses)
11. [ ] Migrar para Kubernetes
12. [ ] Multi-region deployment
13. [ ] WAF (Web Application Firewall)
14. [ ] Disaster recovery plan completo
15. [ ] Performance optimization

---

## Recursos e Documentacao

### Documentos do Projeto
- [Analise Completa do Ambiente](./ANALISE-AMBIENTE-PRODUCAO.md)
- [Setup Ambiente Desenvolvimento](./SETUP-AMBIENTE-DESENVOLVIMENTO.md)
- [Documentacao Completa](./DOCUMENTACAO-COMPLETA.md)
- [Arquitetura da API](./ARQUITETURA_API.md)

### Links Externos
- [Prisma Documentation](https://www.prisma.io/docs)
- [Express Documentation](https://expressjs.com/)
- [Socket.io Documentation](https://socket.io/docs/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Docker Documentation](https://docs.docker.com/)

---

## Informacoes de Acesso

### Producao
- **URL API:** https://api.botreserva.com.br
- **URL Frontend:** https://projeto-eva-frontend.vercel.app
- **SSH:** root@72.61.39.235
- **Diretorio:** /root/deploy-backend/

### Desenvolvimento
- **API:** http://localhost:3001
- **Prisma Studio:** http://localhost:5555
- **Adminer:** http://localhost:8080
- **PostgreSQL:** localhost:5433
- **Redis:** localhost:6380

---

## Metricas do Sistema (Producao)

### Uptime
- Backend: 17+ horas (desde ultimo restart)
- Database: 17+ horas
- Health: All services HEALTHY

### Containers
- Total: 5 containers
- Status: All UP
- Health Checks: All PASSING

### Database
- Tables: 12
- Size: ~MB (verificar: `SELECT pg_size_pretty(pg_database_size('crm_whatsapp_saas'));`)

### Performance
- API Response Time: ~ms (verificar)
- Database Queries: ~ms (verificar)
- Redis Latency: <1ms

---

**Documentacao gerada em:** 2025-12-05
**Versao do Sistema:** 1.0.0
**Ambiente:** Producao (VPS) + Desenvolvimento (Local)
