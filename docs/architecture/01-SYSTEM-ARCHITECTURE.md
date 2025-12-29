# Bot Reserva Hotéis - Arquitetura de Sistema

> Versão: 1.0.0
> Data: Dezembro 2025

---

## 1. Visão Geral da Arquitetura

### 1.1 Diagrama de Alto Nível

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam roundCorner 15
skinparam rectangleBackgroundColor #29B6F6
skinparam rectangleBorderColor #1976D2
skinparam databaseBackgroundColor #0D47A1
skinparam databaseFontColor white

title Bot Reserva Hotéis - Arquitetura do Sistema

' === CAMADA DE INTERFACE (USER INTERFACE LAYER) ===
rectangle "WhatsApp\nHóspede" as whatsapp #29B6F6
rectangle "Dashboard\nAtendente" as dashboard #29B6F6
rectangle "N8N\nAutomação IA" as n8n_client #29B6F6

note right of n8n_client : **User Interface Layer**

' === CAMADA API GATEWAY ===
rectangle "API Gateway (Nginx)\nSSL/TLS, Rate Limiting, WebSocket Proxy" as nginx #26A69A

note right of nginx : **API Gateway Layer**

' === CAMADA DE SERVIÇOS (BUSINESS LOGIC) ===
rectangle "Auth Service\nJWT, Sessions" as auth #1E88E5
rectangle "Message Service\nEnvio/Recebimento" as msg #1E88E5
rectangle "Conversation Service\nGestão de Chats" as conv #1E88E5

note right of conv : **Business Logic Layer**

' === CAMADA DE ACESSO A DADOS ===
rectangle "Prisma ORM\nDatabase Access" as prisma #1565C0
rectangle "Bull Queues\nAsync Processing" as bull #1565C0
rectangle "Socket.io\nReal-time" as socketio #1565C0

note right of socketio : **Data Access Layer**

' === CAMADA DE DADOS (DATABASE LAYER) ===
database "PostgreSQL\nMulti-tenant Data" as postgres #0D47A1
database "Redis\nCache & Queues" as redis #0D47A1
database "Media Storage\nArquivos" as media #0D47A1

note right of media : **Database Layer**

' === CONEXÕES ===
whatsapp -down-> nginx : HTTPS
dashboard -down-> nginx : HTTPS/WSS
n8n_client -down-> nginx : HTTPS

nginx -down-> auth : HTTP
nginx -down-> msg : HTTP
nginx -down-> conv : HTTP

auth -down-> prisma
msg -down-> bull
conv -down-> socketio

prisma -down-> postgres
bull -down-> redis
socketio -down-> redis

@enduml
```

**Legenda:**

- **VPS (72.61.39.235)**: Servidor principal Ubuntu 24.04 com Docker
- **N8N**: Plataforma de automação gerenciada pela 3ian (infraestrutura separada)
- **Vercel**: Hospedagem do frontend Next.js com edge network global

### 1.2 Componentes Principais

| Componente    | Tecnologia        | Hospedagem               | Responsabilidade                           |
|---------------|-------------------|--------------------------|-------------------------------------------|
| **Frontend**  | Next.js 14        | Vercel                   | UI, Dashboard atendentes, Chat real-time  |
| **Backend**   | Express.js + TS   | VPS Cliente (Docker)     | API REST, WebSocket, Business Logic       |
| **Database**  | PostgreSQL 16     | VPS Cliente (Docker)     | Persistência multi-tenant                 |
| **Cache**     | Redis 7           | VPS Cliente (Docker)     | Sessions, Queues, Rate Limiting           |
| **Queues**    | Bull              | VPS Cliente              | Processamento assíncrono de mensagens     |
| **Real-time** | Socket.io         | VPS Cliente              | Chat em tempo real para atendentes        |
| **Automação** | N8N               | **3ian (Externo)**       | Fluxos de IA, integração com LLMs         |
| **Proxy**     | Nginx             | VPS Cliente              | SSL, Load Balancing, WebSocket Proxy      |
| **WhatsApp**  | Cloud API (Meta)  | Meta                     | Envio/recebimento de mensagens            |

---

## 2. Arquitetura de Infraestrutura

### 2.1 Diagrama de Containers (Docker)

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam roundCorner 15

title Docker Architecture - VPS 72.61.39.235

rectangle "Internet" as internet #E3F2FD {
    rectangle "Clientes\nWhatsApp/Browser" as clients #29B6F6
}

note right of internet : **External Network**

rectangle "VPS 72.61.39.235 - Ubuntu 24.04" as vps #E8F5E9 {
    rectangle "crm-nginx\nnginx:alpine\nPorts: 80, 443" as nginx #26A69A

    note right of nginx : **DMZ Layer**

    rectangle "crm-network (Docker Bridge)" as docker_net #E3F2FD {
        rectangle "crm-backend\nNode.js 20\nPort: 3001" as backend #1E88E5
        rectangle "crm-certbot\ncertbot/certbot\nSSL Renewal" as certbot #1E88E5

        note right of certbot : **Application Layer**

        database "crm-postgres\npostgres:16-alpine\nPort: 5432" as postgres #0D47A1
        database "crm-redis\nredis:7-alpine\nPort: 6379" as redis #0D47A1

        note right of redis : **Data Layer**
    }

    rectangle "Docker Volumes" as volumes #FFF3E0 {
        database "postgres_data" as vol_pg #FF9800
        database "redis_data" as vol_redis #FF9800
        database "media_data" as vol_media #FF9800
    }

    note right of volumes : **Persistence Layer**
}

clients -down-> nginx : HTTPS
nginx -down-> backend : HTTP :3001
backend -down-> postgres : SQL :5432
backend -down-> redis : Redis :6379
postgres -right-> vol_pg : mount
redis -right-> vol_redis : mount
backend -down-> vol_media : mount

@enduml
```

**Nota:** O N8N NÃO está nesta VPS - é gerenciado pela 3ian em infraestrutura separada.

**Docker Volumes:**

- `postgres_data` - Dados do PostgreSQL
- `redis_data` - Persistência Redis
- `media_data` - Arquivos de mídia WhatsApp

**Bind Mounts:**

- `./certbot/conf` - Certificados Let's Encrypt
- `./nginx/` - Configurações Nginx

### 2.2 Docker Compose (Production)

```yaml
# docker-compose.production.yml (estrutura real em produção)
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: crm-postgres
    ports:
      - "5432:5432"
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-crm_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-crm_whatsapp_saas}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - crm-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-crm_user}']
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Cache + Queues)
  redis:
    image: redis:7-alpine
    container_name: crm-redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - crm-network
    healthcheck:
      test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend Application
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: crm-backend
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      FRONTEND_URL: ${FRONTEND_URL}
      BASE_DOMAIN: ${BASE_DOMAIN}
      WHATSAPP_API_VERSION: ${WHATSAPP_API_VERSION:-v21.0}
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: ${WHATSAPP_WEBHOOK_VERIFY_TOKEN}
      MEDIA_STORAGE_PATH: /var/lib/whatsapp-crm/media
    volumes:
      - media_data:/var/lib/whatsapp-crm/media
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - crm-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: crm-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - backend
    networks:
      - crm-network

  # Certbot for SSL certificates
  certbot:
    image: certbot/certbot
    container_name: crm-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - crm-network

  # NOTA: O N8N NÃO está nesta VPS
  # É gerenciado pela 3ian em infraestrutura separada (multi-tenant)
  # A URL do webhook é configurada no campo tenant.n8nWebhookUrl

volumes:
  postgres_data:
  redis_data:
  media_data:

networks:
  crm-network:
    driver: bridge
```

### 2.3 Estrutura de Diretórios na VPS

> **IMPORTANTE**: Esta é a estrutura exata verificada na VPS de produção (72.61.39.235)

```bash
/root/deploy-backend/
│
├── src/                              # Código-fonte TypeScript
│   ├── config/                       # Configurações centralizadas
│   │   ├── database.ts              # Prisma client singleton
│   │   ├── env.ts                   # Variáveis de ambiente (Zod validation)
│   │   ├── logger.ts                # Pino logger configurado
│   │   ├── redis.ts                 # Redis client singleton
│   │   └── socket.ts                # Socket.io setup e helpers
│   │
│   ├── constants/                    # Constantes da aplicação
│   │   └── hotel-units.ts           # Unidades hoteleiras disponíveis
│   │
│   ├── controllers/                  # Controllers HTTP
│   │   ├── auth.controller.ts       # Autenticação
│   │   ├── contact.controller.ts    # Gestão de contatos
│   │   ├── conversation.controller.ts # Gestão de conversas
│   │   ├── escalation.controller.ts # Escalações IA → Humano
│   │   ├── message.controller.ts    # Mensagens
│   │   ├── report.controller.ts     # Relatórios
│   │   ├── tenant.controller.ts     # Multi-tenancy
│   │   ├── user.controller.ts       # Usuários
│   │   ├── webhook.controller.ts    # Webhooks WhatsApp
│   │   └── webhook.controller.v2.ts # Webhooks v2
│   │
│   ├── middlewares/                  # Middlewares Express
│   │   ├── auth.middleware.ts       # JWT validation
│   │   ├── error-handler.middleware.ts # Global error handler
│   │   ├── n8n-auth.middleware.ts   # N8N API key auth
│   │   ├── rate-limit.middleware.ts # Rate limiting inteligente
│   │   ├── raw-body.middleware.ts   # Raw body para webhooks
│   │   ├── tenant.middleware.ts     # Multi-tenant isolation
│   │   ├── validate.middleware.ts   # Zod schema validation
│   │   └── webhook-validation.middleware.ts # Validação HMAC webhooks
│   │
│   ├── queues/                       # Bull queues e workers
│   │   ├── whatsapp-webhook.queue.ts # Fila principal de webhooks
│   │   └── workers/
│   │       ├── index.ts             # Registra todos workers
│   │       ├── process-incoming-message.worker.ts  # Mensagens recebidas
│   │       ├── process-media-download.worker.ts    # Download de mídias
│   │       ├── process-outgoing-message.worker.ts  # Mensagens enviadas
│   │       └── process-status-update.worker.ts     # Status de entrega
│   │
│   ├── routes/                       # Rotas da API
│   │   ├── auth.routes.ts           # /auth/* - Login, register, refresh
│   │   ├── contact.routes.ts        # /api/contacts/* - CRUD contacts
│   │   ├── conversation.routes.ts   # /api/conversations/* - CRUD conversations
│   │   ├── debug.routes.ts          # /debug/* - Debug (apenas dev)
│   │   ├── escalation.routes.ts     # /api/escalations/* - Escalações
│   │   ├── health.routes.ts         # /health - Health checks
│   │   ├── media.routes.ts          # /api/media/* - Servir mídias
│   │   ├── message.routes.ts        # /api/messages/* - CRUD messages
│   │   ├── n8n.routes.ts            # /api/n8n/* - Integração N8N
│   │   ├── report.routes.ts         # /api/reports/* - Analytics
│   │   ├── tenant.routes.ts         # /api/tenants/* - CRUD tenants
│   │   ├── user.routes.ts           # /api/users/* - CRUD users
│   │   ├── webhook.routes.ts        # /webhooks/* - WhatsApp webhooks
│   │   └── webhook.routes.v2.ts     # /webhooks/v2/* - Webhooks v2
│   │
│   ├── services/                     # Lógica de negócio
│   │   ├── auth.service.ts          # Autenticação e tokens JWT
│   │   ├── contact.service.ts       # Gestão de contatos
│   │   ├── conversation.service.ts  # Gestão de conversas
│   │   ├── escalation.service.ts    # Escalações e IA lock
│   │   ├── media-storage.service.ts # Upload/download de mídias
│   │   ├── message.service.ts       # Lógica de mensagens
│   │   ├── message.service.v2.ts    # Mensagens v2
│   │   ├── n8n.service.ts           # Integração com N8N
│   │   ├── tenant.service.ts        # Gestão de tenants
│   │   ├── whatsapp.service.ts      # WhatsApp Cloud API
│   │   └── whatsapp.service.v2.ts   # WhatsApp v2
│   │
│   ├── test/                         # Helpers de teste
│   │   └── helpers/
│   │       └── prisma-mock.ts       # Mock do Prisma para testes
│   │
│   ├── types/                        # Definições TypeScript
│   │   ├── express.d.ts             # Extensão tipos Express
│   │   ├── utility.types.ts         # Tipos utilitários
│   │   └── whatsapp.types.ts        # Tipos WhatsApp API
│   │
│   ├── utils/                        # Utilitários
│   │   ├── async-storage.ts         # AsyncLocalStorage para contexto
│   │   ├── crypto.ts                # Utilitários criptográficos
│   │   ├── encryption.ts            # AES-256 encrypt/decrypt
│   │   ├── errors.ts                # Classes de erro customizadas
│   │   ├── image-processor.ts       # Processamento de imagens
│   │   └── url-validator.ts         # Validação de URLs
│   │
│   ├── validators/                   # Zod schemas
│   │   ├── auth.validator.ts        # Schemas de autenticação
│   │   ├── contact.validator.ts     # Schemas de contatos
│   │   ├── conversation.validator.ts # Schemas de conversas
│   │   ├── escalation.validator.ts  # Schemas de escalação
│   │   ├── message.validator.ts     # Schemas de mensagens
│   │   ├── report.validator.ts      # Schemas de relatórios
│   │   ├── tenant.validator.ts      # Schemas de tenants
│   │   ├── user.validator.ts        # Schemas de usuários
│   │   └── whatsapp-webhook.validator.ts # Schemas de webhooks
│   │
│   └── server.ts                     # Entry point da aplicação
│
├── prisma/                           # Prisma ORM
│   ├── schema.prisma                # Schema do banco de dados
│   ├── migrations-manual/           # Migrations manuais (casos especiais)
│   └── seed.ts                      # Seed inicial (SUPER_ADMIN)
│
├── nginx/                            # Configuração Nginx
│   ├── nginx.conf                   # Configuração principal
│   └── conf.d/
│       ├── api.conf                 # Config produção (api.botreserva.com.br)
│       └── api-dev.conf             # Config desenvolvimento
│
├── certbot/                          # Let's Encrypt SSL
│   ├── conf/                        # Certificados e configuração
│   │   ├── accounts/                # Contas ACME
│   │   ├── archive/                 # Histórico de certificados
│   │   ├── live/                    # Certificados atuais
│   │   │   └── botreserva.com.br/   # Cert do domínio
│   │   ├── renewal/                 # Configs de renovação
│   │   └── renewal-hooks/           # Hooks pré/pós renovação
│   └── www/                         # Webroot para validação
│
├── scripts/                          # Scripts de automação
├── docs/                             # Documentação local
├── backups/                          # Backups pré-deploy automáticos
│
├── docker-compose.production.yml     # Docker Compose produção
├── docker-compose.staging.yml        # Docker Compose staging
├── Dockerfile                        # Container do backend
├── .env.production.example           # Template de env vars
├── package.json                      # Dependências NPM
├── package-lock.json                 # Lock de versões
├── tsconfig.json                     # Config TypeScript dev
├── tsconfig.production.json          # Config TypeScript produção
└── jest.setup.ts                     # Configuração Jest
```

### 2.4 Volumes e Storage

```bash
# Docker Volumes (gerenciados pelo Docker)
Docker Volumes:
├── postgres_data     # Dados do PostgreSQL (/var/lib/docker/volumes/...)
├── redis_data        # Persistência Redis
└── media_data        # Arquivos de mídia WhatsApp (/var/lib/whatsapp-crm/media)

# Bind Mounts (não são volumes Docker, são mapeamentos diretos)
Bind Mounts:
├── ./nginx/          # Configurações Nginx → /etc/nginx/
└── ./certbot/        # Certificados SSL → /etc/letsencrypt/
```

### 2.5 Status dos Containers em Produção

```bash
┌─────────────────┬────────────────────┬──────────────┬─────────────────┐
│ Container       │ Image              │ Ports        │ Status          │
├─────────────────┼────────────────────┼──────────────┼─────────────────┤
│ crm-nginx       │ nginx:alpine       │ 80, 443      │ Up (healthy)    │
│ crm-backend     │ deploy-backend     │ 3001         │ Up (healthy)    │
│ crm-postgres    │ postgres:16-alpine │ 5432         │ Up (healthy)    │
│ crm-redis       │ redis:7-alpine     │ 6379         │ Up (healthy)    │
│ crm-certbot     │ certbot/certbot    │ -            │ Up              │
└─────────────────┴────────────────────┴──────────────┴─────────────────┘

⚠️  NOTA IMPORTANTE: O N8N NÃO está nesta VPS
    É gerenciado pela 3ian em infraestrutura separada (multi-tenant)
```

---

## 3. Arquitetura de Rede

### 3.1 Diagrama de Rede

```plantuml
@startuml
skinparam backgroundColor #FEFEFE
skinparam defaultFontName Arial
skinparam defaultFontSize 11
skinparam roundCorner 15

title Network Architecture - Zones & DNS

rectangle "Usuários" as users #E3F2FD {
    rectangle "Hóspede\nWhatsApp Mobile" as hospede #29B6F6
    rectangle "Atendente\nWeb Browser" as atendente #29B6F6
}

note right of users : **User Interface Layer**

rectangle "Serviços Externos" as external #FFEBEE {
    rectangle "WhatsApp Cloud API\ngraph.facebook.com" as whatsapp #EF5350
    rectangle "N8N\nAI Workflows (3ian)" as n8n #EF5350
}

note right of external : **External Services**

rectangle "DNS Resolution" as dns #E8F5E9 {
    rectangle "api.botreserva.com.br\nA Record -> VPS" as dns_api #66BB6A
    rectangle "www.botreserva.com.br\nCNAME -> Vercel" as dns_www #66BB6A
}

note right of dns : **DNS Layer**

rectangle "Vercel Edge Network" as vercel #E8EAF6 {
    rectangle "Next.js App\nDashboard, Chat, Reports" as frontend #7986CB
}

note right of vercel : **CDN/Edge Layer**

rectangle "VPS 72.61.39.235 (DMZ)" as vps #E8F5E9 {
    rectangle "Nginx\nSSL, Rate Limit, HSTS" as nginx #26A69A

    rectangle "crm-network (Internal Zone)" as internal #E3F2FD {
        rectangle "Backend API\nExpress.js :3001" as backend #1E88E5
        database "PostgreSQL\n:5432" as postgres #0D47A1
        database "Redis\n:6379" as redis #0D47A1
    }
}

note right of vps : **Infrastructure Layer**

hospede -down-> whatsapp : WhatsApp
atendente -down-> dns_www : HTTPS
whatsapp -down-> dns_api : Webhooks
dns_api -down-> nginx : Resolve
dns_www -down-> frontend : Resolve
frontend -down-> nginx : API + WS
nginx -down-> backend : Proxy :3001
backend -down-> postgres : SQL/Prisma
backend -down-> redis : Pub/Sub
backend -right-> n8n : HTTPS

@enduml
```

**Ambientes:**

| Ambiente | Frontend | Backend API |
|----------|----------|-------------|
| **Produção** | www.botreserva.com.br | api.botreserva.com.br |
| **Staging** | develop.botreserva.com.br | app.botreserva.com.br |
| **Local** | localhost:3000 | localhost:3001 |

**Nota:** O N8N é gerenciado pela 3ian em infraestrutura separada. A URL do webhook é configurada por tenant (`n8nWebhookUrl`).

### 3.2 Portas e Protocolos

| Serviço    | Porta Interna | Porta Externa | Protocolo  | Acesso           |
|------------|---------------|---------------|------------|------------------|
| Nginx      | 80, 443       | 80, 443       | HTTP/HTTPS | Público          |
| Backend    | 3001          | -             | HTTP/WS    | Interno          |
| PostgreSQL | 5432          | -             | TCP        | Interno          |
| Redis      | 6379          | -             | TCP        | Interno          |
| N8N        | -             | -             | HTTP       | Externo (3ian)   |

### 3.3 Configuração SSL/TLS

```nginx
# nginx.conf - SSL Configuration
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 3.4 Configuração CORS

```typescript
// Backend CORS Configuration
const corsOptions = {
  origin: [
    'https://www.botreserva.com.br',
    'https://botreserva.com.br',
    'http://localhost:3000', // Development
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400, // 24 hours
};
```

---

## 4. Fluxo de Mensagens WhatsApp

### 4.1 Mensagem Recebida (Inbound Flow)

```plantuml
@startuml Fluxo Mensagem Recebida
!theme cerulean
skinparam backgroundColor #FEFEFE

title Fluxo de Mensagem Recebida (Inbound)

|📥 Entrada|
start
:📱 Hóspede envia mensagem;
:WhatsApp App;
:☁️ Meta Cloud API;
:POST /webhooks/whatsapp;

|⚡ Webhook Handler|
:1. Validar HMAC-SHA256;
:2. Responder HTTP 200 (< 5s);
:3. Adicionar job na fila Bull;

|⚙️ Bull Queue Worker|
:1. Identificar tenant;
:2. Criar/atualizar Contact;
:3. Criar/atualizar Conversation;
:4. Salvar Message;
:5. Download mídia (se houver);

if (🔒 iaLocked?) then (true - humano)
    :💾 Apenas salvar;
    note right: Atendente vê via Socket.io
else (false - IA ativa)
    |🤖 N8N Workflow|
    :1. Receber mensagem;
    :2. Processar com IA;

    if (Decisão IA?) then (Auto-resposta)
        :POST /api/n8n/send-*;
    else (Escalar)
        :POST /api/n8n/escalate;
        note right
            • Cria Escalation
            • iaLocked = true
        end note
    endif
endif

|📡 Notificação|
:🔔 Socket.io emit;
:io.emit('message:new');
note right: Dashboard atualiza

stop

@enduml
```

**Resumo do Fluxo:**

1. **Webhook recebido** → Validar assinatura HMAC e responder em < 5 segundos
2. **Fila Bull** → Processamento assíncrono (salvar contact, conversation, message)
3. **Verificar iaLocked** → Se IA ativa, encaminha para N8N; se humano, apenas salva
4. **N8N decide** → Auto-responder ou escalar para atendente
5. **Socket.io** → Notifica atendentes em tempo real

### 4.2 Mensagem Enviada (Outbound Flow)

```plantuml
@startuml Fluxo Mensagem Enviada
!theme cerulean
skinparam backgroundColor #FEFEFE

title Fluxo de Mensagem Enviada (Outbound)

|📤 Origem|
start
split
    :👤 A) Via Atendente;
    note right
        POST /api/messages
        Auth: JWT Bearer
    end note
split again
    :🤖 B) Via N8N;
    note right
        POST /api/n8n/send-*
        Auth: X-API-Key
    end note
end split

|⚙️ WhatsApp Service|
:1. Validar tenant/permissões;
:2. Descriptografar token;
:3. Construir payload;
:4. POST graph.facebook.com/v21.0;

|💾 Persistência|
:INSERT Message;
note right
    direction: OUTBOUND
    status: SENT
end note
:UPDATE Conversation;
note right: lastMessageAt = NOW()

|📡 Notificação|
:Socket.io emit 'message:new';

stop

== Webhook de Status (assíncrono) ==

|📥 Callback|
start
:POST /webhooks/whatsapp;
note right: status: delivered | read | failed
:UPDATE Message status;
:Socket.io emit 'message:status';
stop

@enduml
```

**Payload de Exemplo (texto):**

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": { "body": "Olá! Como posso ajudar?" }
}
```

---

## 5. Multi-Tenancy Architecture

### 5.1 Estratégia de Isolamento

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            MULTI-TENANCY: ROW-LEVEL SECURITY                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              TENANT TABLE                                        │   │
│   │                                                                                  │   │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│   │  │  id       │ name               │ slug           │ whatsappPhoneNumberId │    │   │
│   │  │──────────────────────────────────────────────────────────────────────────│    │   │
│   │  │  uuid-1   │ Hotel Campos Jordão │ campos-jordao  │ 123456789012345       │    │   │
│   │  │  uuid-2   │ Pousada Ilhabela   │ ilhabela       │ 234567890123456       │    │   │
│   │  │  uuid-3   │ Resort Premium     │ resort-premium │ 345678901234567       │    │   │
│   │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                              │                                           │
│                     ┌────────────────────────┼────────────────────────┐                  │
│                     │                        │                        │                  │
│                     ▼                        ▼                        ▼                  │
│   ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐       │
│   │  USER (tenantId: 1)   │  │  USER (tenantId: 2)   │  │  USER (tenantId: 3)   │       │
│   │                       │  │                       │  │                       │       │
│   │  • João (admin)       │  │  • Maria (admin)      │  │  • Carlos (admin)     │       │
│   │  • Ana (atendente)    │  │  • Pedro (atendente)  │  │  • Lucia (atendente)  │       │
│   └───────────────────────┘  └───────────────────────┘  └───────────────────────┘       │
│                                                                                          │
│   ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐       │
│   │ CONTACT (tenantId: 1) │  │ CONTACT (tenantId: 2) │  │ CONTACT (tenantId: 3) │       │
│   │                       │  │                       │  │                       │       │
│   │  • 5511999990001      │  │  • 5521888880001      │  │  • 5531777770001      │       │
│   │  • 5511999990002      │  │  • 5521888880002      │  │  • 5531777770002      │       │
│   └───────────────────────┘  └───────────────────────┘  └───────────────────────┘       │
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                           QUERY ISOLATION                                        │   │
│   │                                                                                  │   │
│   │  // TODAS as queries DEVEM incluir tenantId                                     │   │
│   │                                                                                  │   │
│   │  ✅ CORRETO:                                                                     │   │
│   │  const conversations = await prisma.conversation.findMany({                     │   │
│   │    where: {                                                                      │   │
│   │      tenantId: req.tenantId, // ← OBRIGATÓRIO                                   │   │
│   │      status: 'OPEN',                                                            │   │
│   │    },                                                                            │   │
│   │  });                                                                             │   │
│   │                                                                                  │   │
│   │  ❌ ERRADO (vazamento entre tenants!):                                          │   │
│   │  const conversations = await prisma.conversation.findMany({                     │   │
│   │    where: { status: 'OPEN' }, // ← FALTA tenantId!                              │   │
│   │  });                                                                             │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                           MIDDLEWARE DE TENANT                                   │   │
│   │                                                                                  │   │
│   │  // Extrai tenantId do JWT e injeta em req.tenantId                             │   │
│   │  export function tenantMiddleware(req, res, next) {                             │   │
│   │    const { tenantId } = req.user; // Do JWT                                     │   │
│   │                                                                                  │   │
│   │    if (!tenantId && req.user.role !== 'SUPER_ADMIN') {                          │   │
│   │      return res.status(403).json({ error: 'Tenant required' });                 │   │
│   │    }                                                                             │   │
│   │                                                                                  │   │
│   │    req.tenantId = tenantId;                                                      │   │
│   │    next();                                                                       │   │
│   │  }                                                                               │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         SUPER_ADMIN EXCEPTION                                    │   │
│   │                                                                                  │   │
│   │  • Role SUPER_ADMIN tem tenantId: null                                          │   │
│   │  • Pode ver/gerenciar TODOS os tenants                                          │   │
│   │  • Usado apenas pela equipe da plataforma                                       │   │
│   │  • Queries para SUPER_ADMIN não incluem filtro tenantId                         │   │
│   │                                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Arquitetura de Segurança

### 6.1 Camadas de Segurança

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY LAYERS                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  Layer 1: NETWORK SECURITY (Nginx)                                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  • SSL Termination (TLS 1.2/1.3 only)                                             │  │
│  │  • Security Headers (HSTS, X-Frame-Options, X-Content-Type-Options)               │  │
│  │  • Rate Limiting (express-rate-limit)                                             │  │
│  │  • Request Size Limits (50MB max for media)                                       │  │
│  │  • WebSocket timeout configuration                                                │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                              │                                                           │
│                              ▼                                                           │
│  Layer 2: APPLICATION SECURITY (Express.js)                                              │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  • JWT Authentication                                                             │  │
│  │    - Access Token: 8 horas                                                        │  │
│  │    - Refresh Token: 7 dias                                                        │  │
│  │  • Role-Based Authorization (SUPER_ADMIN, TENANT_ADMIN, ATTENDANT)               │  │
│  │  • Input Validation (Zod schemas em TODOS os endpoints)                          │  │
│  │  • Helmet.js (security headers)                                                   │  │
│  │  • CORS restrito a domínios permitidos                                           │  │
│  │  • Request ID tracking para auditoria                                            │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                              │                                                           │
│                              ▼                                                           │
│  Layer 3: WEBHOOK SECURITY (WhatsApp)                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  • HMAC-SHA256 signature validation                                               │  │
│  │  • Verify token para challenge/response                                           │  │
│  │  • Rate limiting específico (1000 req/min)                                        │  │
│  │  • Resposta imediata + processamento async                                        │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                              │                                                           │
│                              ▼                                                           │
│  Layer 4: N8N API SECURITY                                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  • API Key authentication (X-API-Key header)                                      │  │
│  │  • Format: {tenantSlug}:{whatsappPhoneNumberId}                                   │  │
│  │  • Rate limiting: 5000 req/min por tenant                                         │  │
│  │  • Whitelist de IPs (opcional)                                                    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                              │                                                           │
│                              ▼                                                           │
│  Layer 5: DATA SECURITY (PostgreSQL + Prisma)                                            │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │  • Row-Level Security (tenantId em TODAS as queries)                              │  │
│  │  • Encrypted connections (SSL)                                                    │  │
│  │  • Password Hashing (bcrypt, 10 rounds)                                           │  │
│  │  • Sensitive data encryption (AES-256-GCM)                                        │  │
│  │    - whatsappAccessToken                                                          │  │
│  │    - whatsappAppSecret                                                            │  │
│  │  • No direct external access (internal network only)                              │  │
│  │  • Audit logging para ações críticas                                              │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Rate Limiting Strategy

| Endpoint         | Limite        | Janela   | Key                    | Razão                         |
|------------------|---------------|----------|------------------------|-------------------------------|
| `/auth/login`    | 5 req         | 15 min   | IP                     | Proteção brute force          |
| `/webhooks/*`    | 1000 req      | 1 min    | IP                     | Alto volume WhatsApp          |
| `/api/n8n/*`     | 5000 req      | 1 min    | Tenant (via API Key)   | Carrosséis e automações       |
| `/api/*` (geral) | 100 req       | 1 min    | User ID                | Uso normal                    |
| `/api/media/*`   | 200 req       | 1 min    | IP                     | Download de mídias            |

---

## 7. Escalabilidade

### 7.1 Pontos de Escala

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              SCALING STRATEGY                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  HORIZONTAL SCALING (Current Architecture Ready)                                         │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                                     │ │
│  │   Frontend (Vercel)                                                                 │ │
│  │   └── Auto-scales automatically (serverless)                                        │ │
│  │   └── Edge functions scale globally                                                 │ │
│  │   └── No manual intervention needed                                                 │ │
│  │                                                                                     │ │
│  │   Backend (Docker)                                                                  │ │
│  │   └── Currently: 1 instance                                                         │ │
│  │   └── Scale to: N instances behind Nginx (stateless design)                         │ │
│  │   └── Socket.io: Redis adapter para multi-instance                                  │ │
│  │                                                                                     │ │
│  │   Database (PostgreSQL)                                                             │ │
│  │   └── Currently: Single instance                                                    │ │
│  │   └── Scale to: Read replicas para queries pesadas                                  │ │
│  │   └── Future: Managed service (RDS, Supabase)                                       │ │
│  │                                                                                     │ │
│  │   Cache/Queues (Redis)                                                              │ │
│  │   └── Currently: Single instance with AOF                                           │ │
│  │   └── Scale to: Redis Cluster                                                       │ │
│  │   └── Future: Managed service (ElastiCache)                                         │ │
│  │                                                                                     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                          │
│  CAPACITY PLANNING                                                                       │
│                                                                                          │
│  Current Capacity:                                                                       │
│  ├── Concurrent Tenants: 10                                                             │
│  ├── Messages/day: 10,000                                                               │
│  ├── Concurrent WebSocket connections: 100                                              │
│  ├── Database Size: 5GB                                                                 │
│  └── Media Storage: 20GB                                                                │
│                                                                                          │
│  Target Capacity (Scale Point):                                                          │
│  ├── Concurrent Tenants: 100                                                            │
│  ├── Messages/day: 100,000                                                              │
│  ├── Concurrent WebSocket connections: 1,000                                            │
│  ├── Database Size: 50GB                                                                │
│  └── Media Storage: 200GB                                                               │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Bottlenecks e Mitigações

| Bottleneck           | Sintoma              | Mitigação                                  |
|----------------------|----------------------|-------------------------------------------|
| Database Connections | Pool exhaustion      | Connection pooling, read replicas          |
| WhatsApp API Limits  | Rate limit errors    | Queue backpressure, exponential backoff    |
| WebSocket Memory     | High memory usage    | Redis adapter, connection limits           |
| File Uploads         | Timeout              | Streaming upload, chunked processing       |
| Bull Queue Backlog   | High latency         | Increase workers, priority queues          |

---

## 8. Decisões Arquiteturais e Justificativas

### 8.1 Padrões Arquiteturais Adotados

O sistema adota uma combinação de padrões que priorizam manutenibilidade e escalabilidade:

**Service Layer Pattern**
Toda lógica de negócio fica isolada em services (`whatsapp.service.ts`, `message.service.ts`). Controllers apenas orquestram chamadas - não contêm regras de negócio. Isso facilita testes unitários e permite reutilizar lógica entre diferentes endpoints.

**Repository Pattern (via Prisma)**
O Prisma atua como nossa camada de acesso a dados. Queries ficam centralizadas nos services, nunca espalhadas pelos controllers. Mudanças no schema propagam automaticamente via tipagem TypeScript.

**Queue-based Async Processing**
Webhooks do WhatsApp exigem resposta em menos de 5 segundos. Usamos Bull + Redis para processar mensagens de forma assíncrona. O worker pode falhar e tentar novamente sem perder a mensagem.

**Event-Driven (Socket.io)**
Atendentes recebem atualizações em tempo real sem precisar fazer polling. Quando uma mensagem chega, o sistema emite eventos para todos os clientes conectados ao tenant.

**Multi-tenant Row-Level Isolation**
Cada query inclui `tenantId` como filtro obrigatório. Não há schema separado por tenant - o isolamento acontece via dados. Mais simples de manter e escala melhor para centenas de tenants.

### 8.2 ADR (Architecture Decision Records)

| Decisão | Escolha | Por que essa e não outra |
|---------|---------|--------------------------|
| **Backend Framework** | Express.js | NestJS adiciona muita abstração que não precisamos. Fastify é mais rápido em benchmarks sintéticos, mas Express tem ecossistema maior e a equipe já conhece. Para nosso volume (~1000 req/min), a diferença de performance é irrelevante. |
| **Database** | PostgreSQL 16 | MySQL não tem suporte nativo a JSON tão bom. MongoDB complicaria queries relacionais (tenant → conversations → messages). PostgreSQL é ACID, tem JSONB para metadados flexíveis, e escala verticalmente bem. |
| **ORM** | Prisma | TypeORM tem tipagem fraca e migrations confusas. Drizzle é mais novo e menos testado. Prisma gera tipos automaticamente do schema e as migrations são previsíveis. |
| **Cache/Queue** | Redis + Bull | Precisamos de cache (config de tenants) e filas (mensagens). Redis resolve os dois. Bull é mais maduro que Agenda e não precisa de MongoDB separado. |
| **Real-time** | Socket.io | WebSockets nativos não têm fallback para ambientes com proxy problemático. Socket.io faz fallback para polling e tem conceito de "rooms" que facilita separar eventos por tenant. |
| **Frontend** | Next.js 14 | Precisa de SSR para SEO do site institucional. App Router é o padrão atual. Deploy no Vercel é zero-config. React puro exigiria configurar SSR manualmente. |
| **Automação** | N8N | Construir IA conversacional do zero levaria meses. LangChain é código, difícil de ajustar. N8N permite que o cliente (ou a 3ian) modifique fluxos sem deploy. |
| **Deploy Backend** | VPS + Docker | Kubernetes seria overkill para 1 servidor. ECS tem custo alto para tráfego baixo. VPS com Docker dá controle total e custa R$100/mês. Quando escalar, migramos para K8s. |
| **Deploy Frontend** | Vercel | Edge network global, preview deployments automáticos, integração nativa com Next.js. Netlify funciona, mas Vercel é otimizado para Next. |

### 8.3 Trade-offs Conhecidos

- **VPS única**: Ponto único de falha. Mitigação: backups diários + monitoramento. Upgrade futuro: adicionar réplica.
- **N8N externo**: Dependência da 3ian. Mitigação: contrato de SLA + documentação de fluxos para migração se necessário.
- **Storage local**: Mídias ficam no disco do servidor. Mitigação: backups. Upgrade futuro: S3 ou R2.

---

## 9. Checklist de Implementação

- [x] Configurar VPS com Docker e Docker Compose
- [x] Configurar DNS para subdomínios (api, www, n8n)
- [x] Deploy inicial do backend com PostgreSQL e Redis
- [x] Configurar Nginx como reverse proxy com SSL
- [x] Configurar Vercel para o frontend
- [x] Implementar webhooks WhatsApp
- [x] Integrar N8N para automações
- [x] Implementar multi-tenancy
- [x] Implementar Socket.io para real-time
- [ ] Configurar backups automatizados
- [ ] Implementar monitoramento (Grafana + Prometheus)
- [ ] Configurar alertas

---

Última atualização: Dezembro de 2025

**Desenvolvido por [3ian](https://3ian.com.br)** - Soluções em Tecnologia e Automação
