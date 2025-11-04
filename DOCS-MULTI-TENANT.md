# 🏢 ARQUITETURA MULTI-TENANT SAAS

> **Sistema SaaS Multi-Tenant para Rede de Hotéis**
> Modelo: Cada hotel é um tenant isolado com seu próprio painel e WhatsApp

---

## 🎯 MODELO DE NEGÓCIO

### Conceito
Você (empresa) oferece o CRM WhatsApp como **SaaS** (Software as a Service) para múltiplos hotéis. Cada hotel assina o serviço e tem seu ambiente completamente isolado.

### Comparação
**Igual ao Claude Code:**
- Claude (Anthropic) = Você (Empresa)
- Assinante do Claude = Hotel assinante
- Workspace do assinante = Painel do hotel
- Tokens/API Keys = Credenciais WhatsApp do hotel

---

## 👥 NÍVEIS DE ACESSO

```
┌─────────────────────────────────────────────────────┐
│  SUPER ADMIN (Você/Empresa)                         │
│  super-admin.seucrm.com                             │
│                                                     │
│  Poderes:                                           │
│  ✅ Criar novos tenants (hotéis)                    │
│  ✅ Ver lista de todos os clientes                  │
│  ✅ Gerenciar assinaturas                           │
│  ✅ Ver métricas agregadas                          │
│  ✅ Desativar/suspender tenants                     │
│  ✅ Acessar qualquer tenant (suporte)               │
└─────────────────────────────────────────────────────┘
                          │
                          │ Cria tenants
                          ▼
┌─────────────────────────────────────────────────────┐
│  TENANT (Hotel Copacabana)                          │
│  hotelcopacabana.seucrm.com                         │
│                                                     │
│  ┌───────────────────────────────────┐             │
│  │ TENANT ADMIN (Gerente do Hotel)   │             │
│  │                                   │             │
│  │ Poderes:                          │             │
│  │ ✅ Gerenciar atendentes do hotel  │             │
│  │ ✅ Ver todas as conversas         │             │
│  │ ✅ Configurar tags e automações   │             │
│  │ ✅ Ver dashboard e métricas       │             │
│  │ ✅ Configurar credenciais WhatsApp│             │
│  │ ❌ Criar outros hotéis            │             │
│  │ ❌ Ver dados de outros hotéis     │             │
│  └───────────────────────────────────┘             │
│                    │                                │
│                    │ Gerencia                       │
│                    ▼                                │
│  ┌───────────────────────────────────┐             │
│  │ ATTENDANT (Atendente)             │             │
│  │                                   │             │
│  │ Poderes:                          │             │
│  │ ✅ Ver conversas atribuídas       │             │
│  │ ✅ Responder mensagens            │             │
│  │ ✅ Criar/fechar conversas         │             │
│  │ ❌ Gerenciar usuários             │             │
│  │ ❌ Ver conversas de outros        │             │
│  │ ❌ Configurar WhatsApp             │             │
│  └───────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  TENANT (Hotel Ipanema)                             │
│  hotelipanema.seucrm.com                            │
│  [Mesma estrutura, dados 100% isolados]             │
└─────────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE SCHEMA MULTI-TENANT

### Nova Estrutura

```prisma
// prisma/schema.prisma

// ============================================
// TENANT (Organização/Hotel)
// ============================================
model Tenant {
  id          String   @id @default(uuid())
  name        String   // "Hotel Copacabana"
  slug        String   @unique // "hotelcopacabana" (usado no subdomínio)
  email       String   @unique
  status      TenantStatus @default(ACTIVE)
  plan        Plan     @default(BASIC)

  // Limites por plano
  maxAttendants  Int   @default(10)
  maxMessages    Int   @default(10000) // Por mês

  // Billing
  stripeCustomerId     String?  @unique
  stripeSubscriptionId String?  @unique
  subscriptionStatus   SubscriptionStatus?
  currentPeriodEnd     DateTime?

  // WhatsApp Config (cada tenant tem seu próprio)
  whatsappPhoneNumberId    String?
  whatsappAccessToken      String?  // Criptografado
  whatsappBusinessAccountId String?
  whatsappWebhookVerifyToken String?

  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relações
  users         User[]
  contacts      Contact[]
  conversations Conversation[]
  messages      Message[]
  tags          Tag[]

  @@index([slug])
  @@index([status])
}

enum TenantStatus {
  ACTIVE      // Ativo e pagando
  TRIAL       // Período de teste
  SUSPENDED   // Suspenso por falta de pagamento
  CANCELLED   // Cancelado
}

enum Plan {
  BASIC       // Plano único inicial
  PRO         // Futuro
  ENTERPRISE  // Futuro
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  INCOMPLETE
}

// ============================================
// USER (Agora com tenantId)
// ============================================
model User {
  id        String   @id @default(uuid())
  tenantId  String?  // NULL = Super Admin, preenchido = pertence a tenant

  email     String   @unique
  password  String
  name      String
  role      Role     @default(ATTENDANT)
  status    UserStatus @default(ACTIVE)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant    Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations Conversation[]

  @@index([tenantId])
  @@index([email])
}

enum Role {
  SUPER_ADMIN    // Você (empresa) - acesso total
  TENANT_ADMIN   // Admin do hotel
  ATTENDANT      // Atendente do hotel
}

enum UserStatus {
  ACTIVE
  INACTIVE
}

// ============================================
// CONTACT (Com tenantId)
// ============================================
model Contact {
  id                 String   @id @default(uuid())
  tenantId           String   // IMPORTANTE: isola contatos por tenant

  phoneNumber        String   // Formato: 5511999999999
  name               String?
  profilePictureUrl  String?
  metadata           Json?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  tenant       Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations Conversation[]

  @@unique([tenantId, phoneNumber]) // Mesmo número pode existir em tenants diferentes
  @@index([tenantId, phoneNumber])
}

// ============================================
// CONVERSATION (Com tenantId)
// ============================================
model Conversation {
  id             String       @id @default(uuid())
  tenantId       String       // IMPORTANTE: isola conversas

  contactId      String
  assignedToId   String?
  status         ConversationStatus @default(OPEN)
  priority       Priority     @default(MEDIUM)
  lastMessageAt  DateTime     @default(now())
  createdAt      DateTime     @default(now())
  closedAt       DateTime?

  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  contact    Contact   @relation(fields: [contactId], references: [id])
  assignedTo User?     @relation(fields: [assignedToId], references: [id])
  messages   Message[]
  tags       Tag[]

  @@index([tenantId, status, lastMessageAt])
  @@index([tenantId, assignedToId])
}

enum ConversationStatus {
  OPEN
  IN_PROGRESS
  WAITING
  CLOSED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

// ============================================
// MESSAGE (Com tenantId)
// ============================================
model Message {
  id                String      @id @default(uuid())
  tenantId          String      // IMPORTANTE: isola mensagens

  conversationId    String
  whatsappMessageId String?     @unique
  direction         Direction
  type              MessageType
  content           String      @db.Text
  metadata          Json?
  status            MessageStatus @default(SENT)
  sentById          String?
  timestamp         DateTime
  createdAt         DateTime    @default(now())

  tenant       Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversation Conversation @relation(fields: [conversationId], references: [id])

  @@index([tenantId, conversationId, timestamp])
}

enum Direction {
  INBOUND
  OUTBOUND
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  LOCATION
  STICKER
}

enum MessageStatus {
  SENT
  DELIVERED
  READ
  FAILED
}

// ============================================
// TAG (Com tenantId)
// ============================================
model Tag {
  id        String   @id @default(uuid())
  tenantId  String   // Cada tenant suas próprias tags

  name      String
  color     String
  createdAt DateTime @default(now())

  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations Conversation[]

  @@unique([tenantId, name]) // Tag única por tenant
  @@index([tenantId])
}

// ============================================
// USAGE TRACKING (Para billing)
// ============================================
model UsageTracking {
  id        String   @id @default(uuid())
  tenantId  String

  period    DateTime // Mês/ano (2025-11-01)

  messagesCount    Int @default(0)
  conversationsCount Int @default(0)
  activeUsers      Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, period])
  @@index([tenantId, period])
}
```

---

## 🔐 TENANT ISOLATION (Segurança Crítica!)

### Middleware de Isolamento

**TODA QUERY deve incluir tenantId automaticamente!**

```typescript
// src/middlewares/tenant.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export async function tenantIsolation(req: Request, res: Response, next: NextFunction) {
  // 1. Extrair tenant do subdomínio
  const host = req.headers.host; // hotelcopacabana.seucrm.com
  const subdomain = host?.split('.')[0];

  // 2. Se for super-admin, pular isolamento
  if (subdomain === 'super-admin' || subdomain === 'admin') {
    req.tenantId = null; // Super admin não tem tenant
    return next();
  }

  // 3. Buscar tenant pelo slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: subdomain },
    select: { id: true, status: true }
  });

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant não encontrado' });
  }

  if (tenant.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Assinatura inativa' });
  }

  // 4. Adicionar tenantId no request
  req.tenantId = tenant.id;

  next();
}

// Usar em todas as rotas de tenant
// app.use('/api', tenantIsolation);
```

### Prisma Middleware (Segurança Extra)

```typescript
// src/config/database.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Middleware que adiciona tenantId automaticamente
prisma.$use(async (params, next) => {
  // Lista de models que têm tenantId
  const modelsWithTenant = ['Contact', 'Conversation', 'Message', 'Tag'];

  if (modelsWithTenant.includes(params.model || '')) {
    // Em queries (findMany, findFirst, etc)
    if (params.action === 'findMany' || params.action === 'findFirst') {
      if (!params.args.where) params.args.where = {};

      // Se tenantId não foi especificado, adicionar
      if (!params.args.where.tenantId) {
        // Pegar do contexto (AsyncLocalStorage)
        const tenantId = getTenantIdFromContext();
        if (tenantId) {
          params.args.where.tenantId = tenantId;
        }
      }
    }

    // Em criação
    if (params.action === 'create') {
      const tenantId = getTenantIdFromContext();
      if (tenantId) {
        params.args.data.tenantId = tenantId;
      }
    }
  }

  return next(params);
});

export { prisma };
```

---

## 🌐 SUBDOMÍNIOS

### Estrutura de URLs

```
https://super-admin.seucrm.com    → Painel Super Admin (você)
https://hotelcopacabana.seucrm.com → Tenant 1
https://hotelipanema.seucrm.com    → Tenant 2
https://hotelrj.seucrm.com         → Tenant 3
```

### Nginx Config (Wildcard)

```nginx
# Capturar todos os subdomínios
server {
    listen 443 ssl http2;
    server_name *.seucrm.com;

    # SSL wildcard
    ssl_certificate /etc/letsencrypt/live/seucrm.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seucrm.com/privkey.pem;

    # Backend detecta tenant pelo header Host
    location / {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Super Admin em subdomínio específico
server {
    listen 443 ssl http2;
    server_name super-admin.seucrm.com;

    location / {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        # Pode ter lógica específica
    }
}
```

### DNS Wildcard

```
Type: A
Name: *
Value: SEU_IP_VPS

Type: A
Name: super-admin
Value: SEU_IP_VPS
```

---

## 🎨 SUPER ADMIN PANEL

### Funcionalidades

```
SUPER ADMIN DASHBOARD
├── 📊 Overview
│   ├── Total de tenants ativos
│   ├── MRR (Monthly Recurring Revenue)
│   ├── Churn rate
│   └── Uso total de mensagens
│
├── 🏢 Tenants
│   ├── Listar todos
│   ├── Criar novo tenant
│   │   └── Form: Nome, Email, Slug, Plano
│   ├── Editar tenant
│   ├── Suspender/Ativar
│   └── Deletar (com confirmação)
│
├── 💳 Billing
│   ├── Ver assinaturas ativas
│   ├── Inadimplentes
│   └── Integração Stripe (futuro)
│
├── 📈 Analytics
│   ├── Uso por tenant
│   ├── Mensagens enviadas
│   └── Crescimento
│
└── ⚙️ Configurações
    ├── Planos e preços
    └── Limites padrão
```

### Criar Novo Tenant (Flow)

```typescript
// Super Admin cria tenant

POST /super-admin/api/tenants

{
  "name": "Hotel Copacabana Palace",
  "slug": "hotelcopacabana",  // Validar: único, lowercase, sem espaços
  "email": "contato@hotelcopa.com",
  "plan": "BASIC"
}

↓

Backend:
1. Validar slug único
2. Criar Tenant no DB
3. Criar primeiro User (TENANT_ADMIN)
   - Email: fornecido
   - Password: gerada aleatoriamente
4. Enviar email com credenciais
5. Retornar:
   {
     "tenant": {...},
     "adminUser": {...},
     "loginUrl": "https://hotelcopacabana.seucrm.com"
   }
```

---

## 📱 TENANT PANEL (Painel do Hotel)

### Onboarding do Novo Cliente

**Primeiro acesso:**

1. Cliente recebe email:
   ```
   Bem-vindo ao CRM WhatsApp!

   Seu painel: https://hotelcopacabana.seucrm.com
   Email: contato@hotelcopa.com
   Senha temporária: [gerada]

   Por favor, troque sua senha no primeiro login.
   ```

2. Ao logar, wizard de setup:
   ```
   Passo 1: Trocar senha
   Passo 2: Configurar WhatsApp Business API
      - Phone Number ID
      - Access Token
      - Business Account ID
   Passo 3: Criar primeiro atendente
   Passo 4: Pronto! 🎉
   ```

### Configuração WhatsApp (Self-Service)

```typescript
// Tenant Admin pode configurar suas próprias credenciais

PATCH /api/tenant/whatsapp-config

{
  "whatsappPhoneNumberId": "123456789",
  "whatsappAccessToken": "EAAG...",
  "whatsappBusinessAccountId": "987654321"
}

↓

Backend:
1. Validar credenciais (fazer test request pra Meta)
2. Criptografar token
3. Salvar no Tenant
4. Configurar webhook automaticamente
5. Retornar status OK
```

---

## 💰 BILLING (Futuro - Stripe)

### Flow de Assinatura

```
1. Tenant criado → Status: TRIAL (14 dias grátis)

2. Após trial → Email: "Trial acabando, adicione cartão"

3. Tenant adiciona cartão:
   ├── Stripe.js no frontend
   ├── Cria Payment Method
   ├── Backend cria Customer e Subscription no Stripe
   └── Stripe retorna subscription_id

4. Webhook Stripe → Backend atualiza:
   ├── subscriptionStatus: ACTIVE
   ├── currentPeriodEnd: +30 dias
   └── tenantStatus: ACTIVE

5. Cobrança mensal automática (Stripe)

6. Se falhar pagamento:
   ├── subscriptionStatus: PAST_DUE
   ├── Email: "Problema com pagamento"
   └── Após X dias: tenantStatus: SUSPENDED
```

### Limites por Plano

```typescript
// Middleware de limites

async function checkTenantLimits(req: Request, res: Response, next: NextFunction) {
  const tenant = await getTenant(req.tenantId);

  // Exemplo: limite de mensagens
  const thisMonth = startOfMonth(new Date());
  const usage = await prisma.message.count({
    where: {
      tenantId: req.tenantId,
      createdAt: { gte: thisMonth }
    }
  });

  if (usage >= tenant.maxMessages) {
    return res.status(429).json({
      error: 'Limite de mensagens atingido',
      limit: tenant.maxMessages,
      used: usage,
      upgrade: 'https://seucrm.com/upgrade'
    });
  }

  next();
}
```

---

## 🔄 MIGRAÇÃO DE DADOS

### Se cliente já usa outro sistema

```typescript
// Endpoint de importação

POST /api/tenant/import-data

{
  "contacts": [...],
  "conversations": [...],
  "messages": [...]
}

↓

Backend:
1. Validar formato
2. Criar em batch
3. Retornar relatório
```

---

## 📊 ANALYTICS POR TENANT

Cada tenant vê apenas seus dados:

```sql
-- Queries sempre com WHERE tenantId

SELECT COUNT(*)
FROM conversations
WHERE tenantId = :tenantId
  AND createdAt >= :startDate;

SELECT AVG(response_time)
FROM messages
WHERE tenantId = :tenantId
  AND direction = 'OUTBOUND';
```

---

## 🚨 SEGURANÇA CRÍTICA

### Checklist Multi-Tenant

- ✅ **SEMPRE** filtrar por `tenantId` em queries
- ✅ **NUNCA** confiar no `tenantId` vindo do cliente (sempre extrair do token/subdomínio)
- ✅ Validar que User pertence ao Tenant antes de autorizar
- ✅ Criptografar tokens WhatsApp no banco
- ✅ Rate limiting por tenant (não global)
- ✅ Backup isolado por tenant
- ✅ Logs com tenantId para auditoria

### Teste de Segurança

```bash
# Usuário do Hotel A não pode ver dados do Hotel B

curl https://hotelcopacabana.seucrm.com/api/conversations \
  -H "Authorization: Bearer <token-hotel-A>"

# Deve retornar APENAS conversas do Hotel A
# Se retornar do Hotel B = FALHA CRÍTICA DE SEGURANÇA!
```

---

**Arquitetura Multi-Tenant pronta! 🎯**

Próximo: Atualizar código para implementar tudo isso.
