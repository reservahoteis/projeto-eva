---
name: tech-prisma
description: Melhores praticas Prisma ORM - Schema, Queries, Migrations, Relations, Multi-tenant
version: 1.0.0
---

# Prisma ORM - Melhores Praticas

## Schema Basico

```prisma
// prisma/schema.prisma
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
  name      String
  role      Role     @default(ATTENDANT)
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
  @@index([email])
}

enum Role {
  ADMIN
  ATTENDANT
  SALES
}
```

---

## Relations

```prisma
// One-to-Many
model Tenant {
  id    String @id @default(uuid())
  name  String
  users User[]
}

model User {
  id       String @id @default(uuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
}

// Many-to-Many
model Conversation {
  id   String @id @default(uuid())
  tags Tag[]
}

model Tag {
  id            String         @id @default(uuid())
  name          String
  conversations Conversation[]
}

// Many-to-Many Explicita
model ConversationTag {
  conversationId String
  tagId          String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  tag            Tag          @relation(fields: [tagId], references: [id])
  createdAt      DateTime     @default(now())

  @@id([conversationId, tagId])
}

// Self-Relation
model Message {
  id        String    @id @default(uuid())
  content   String
  replyToId String?
  replyTo   Message?  @relation("Replies", fields: [replyToId], references: [id])
  replies   Message[] @relation("Replies")
}
```

---

## Queries CRUD

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CREATE
const user = await prisma.user.create({
  data: {
    name: 'Ana',
    email: 'ana@email.com',
    tenantId: 'tenant-1',
  },
});

// CREATE MANY
const count = await prisma.user.createMany({
  data: [
    { name: 'Bob', email: 'bob@email.com', tenantId: 'tenant-1' },
    { name: 'Carol', email: 'carol@email.com', tenantId: 'tenant-1' },
  ],
  skipDuplicates: true,
});

// READ
const user = await prisma.user.findUnique({ where: { id: 'user-1' } });
const user = await prisma.user.findFirst({ where: { email: 'ana@email.com' } });
const users = await prisma.user.findMany({ where: { tenantId: 'tenant-1' } });

// UPDATE
const user = await prisma.user.update({
  where: { id: 'user-1' },
  data: { name: 'Ana Silva' },
});

// UPSERT
const user = await prisma.user.upsert({
  where: { email: 'ana@email.com' },
  update: { name: 'Ana Updated' },
  create: { name: 'Ana', email: 'ana@email.com', tenantId: 'tenant-1' },
});

// DELETE
await prisma.user.delete({ where: { id: 'user-1' } });
await prisma.user.deleteMany({ where: { tenantId: 'tenant-1' } });
```

---

## Filtros Avancados

```typescript
// Operadores
const users = await prisma.user.findMany({
  where: {
    name: { contains: 'ana', mode: 'insensitive' },
    email: { endsWith: '@email.com' },
    role: { in: ['ADMIN', 'ATTENDANT'] },
    createdAt: { gte: new Date('2024-01-01') },
  },
});

// AND, OR, NOT
const users = await prisma.user.findMany({
  where: {
    AND: [
      { tenantId: 'tenant-1' },
      { OR: [{ role: 'ADMIN' }, { role: 'ATTENDANT' }] },
    ],
    NOT: { email: { contains: 'test' } },
  },
});

// Filtro em relacoes
const conversations = await prisma.conversation.findMany({
  where: {
    messages: { some: { content: { contains: 'urgente' } } },
    tags: { every: { name: { in: ['vip', 'priority'] } } },
  },
});
```

---

## Select e Include

```typescript
// SELECT - campos especificos
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    _count: { select: { conversations: true } },
  },
});

// INCLUDE - relacoes
const conversation = await prisma.conversation.findUnique({
  where: { id: 'conv-1' },
  include: {
    contact: true,
    messages: { take: 10, orderBy: { createdAt: 'desc' } },
    assignedTo: { select: { id: true, name: true } },
    tags: true,
  },
});

// Nested include
const tenant = await prisma.tenant.findUnique({
  where: { id: 'tenant-1' },
  include: {
    users: {
      where: { role: 'ADMIN' },
      include: { conversations: { take: 5 } },
    },
  },
});
```

---

## Ordenacao e Paginacao

```typescript
// Ordenacao
const users = await prisma.user.findMany({
  orderBy: [
    { role: 'asc' },
    { name: 'asc' },
  ],
});

// Paginacao offset-based
const users = await prisma.user.findMany({
  skip: 20,
  take: 10,
  orderBy: { createdAt: 'desc' },
});

// Paginacao cursor-based (melhor performance)
const messages = await prisma.message.findMany({
  take: 50,
  cursor: { id: 'last-message-id' },
  skip: 1, // Pula o cursor
  orderBy: { createdAt: 'desc' },
});

// Count total
const [users, total] = await prisma.$transaction([
  prisma.user.findMany({ skip: 0, take: 10 }),
  prisma.user.count(),
]);
```

---

## Transactions

```typescript
// Transaction automatica
const result = await prisma.$transaction([
  prisma.user.create({ data: { ... } }),
  prisma.conversation.update({ where: { id: 'conv-1' }, data: { ... } }),
]);

// Transaction interativa
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { name: 'Ana', ... } });

  const conversation = await tx.conversation.create({
    data: { contactId: 'contact-1', assignedToId: user.id },
  });

  if (!conversation) {
    throw new Error('Failed to create conversation');
  }

  return { user, conversation };
});

// Isolation level
await prisma.$transaction(
  async (tx) => { ... },
  { isolationLevel: 'Serializable' }
);
```

---

## Raw Queries

```typescript
// Query raw
const users = await prisma.$queryRaw<User[]>`
  SELECT * FROM "User"
  WHERE "tenantId" = ${tenantId}
  AND "createdAt" > ${startDate}
`;

// Execute raw (INSERT, UPDATE, DELETE)
const count = await prisma.$executeRaw`
  UPDATE "Conversation"
  SET status = 'CLOSED'
  WHERE "updatedAt" < NOW() - INTERVAL '30 days'
`;

// Com Prisma.sql para queries dinamicas
const orderBy = Prisma.sql`ORDER BY "createdAt" DESC`;
const users = await prisma.$queryRaw`
  SELECT * FROM "User" ${orderBy}
`;
```

---

## Aggregations

```typescript
// Count
const count = await prisma.conversation.count({
  where: { status: 'OPEN', tenantId },
});

// Aggregate
const stats = await prisma.message.aggregate({
  where: { conversationId },
  _count: true,
  _max: { createdAt: true },
  _min: { createdAt: true },
});

// Group by
const byStatus = await prisma.conversation.groupBy({
  by: ['status'],
  where: { tenantId },
  _count: true,
  orderBy: { _count: { status: 'desc' } },
});
```

---

## Middleware e Extensions

```typescript
// Middleware (logging, soft delete)
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  console.log(`${params.model}.${params.action}: ${Date.now() - start}ms`);
  return result;
});

// Soft delete middleware
prisma.$use(async (params, next) => {
  if (params.model === 'User') {
    if (params.action === 'delete') {
      params.action = 'update';
      params.args.data = { deletedAt: new Date() };
    }
    if (params.action === 'findMany') {
      params.args.where = { ...params.args.where, deletedAt: null };
    }
  }
  return next(params);
});

// Extensions (Prisma 4.16+)
const xprisma = prisma.$extends({
  model: {
    user: {
      async findByTenant(tenantId: string) {
        return prisma.user.findMany({ where: { tenantId } });
      },
    },
  },
});
```

---

## Multi-Tenant Pattern

```typescript
// Client por request
function getPrismaClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
    },
  });
}

// Service com tenant
class ConversationService {
  constructor(private tenantId: string) {}

  async list(filters: Filters) {
    return prisma.conversation.findMany({
      where: { tenantId: this.tenantId, ...filters },
    });
  }

  async create(data: CreateInput) {
    return prisma.conversation.create({
      data: { ...data, tenantId: this.tenantId },
    });
  }
}
```

---

## Migrations

```bash
# Criar migration
npx prisma migrate dev --name add_user_phone

# Aplicar migrations em producao
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Gerar cliente
npx prisma generate

# Ver status
npx prisma migrate status
```

---

## Performance Tips

```typescript
// 1. Selecionar apenas campos necessarios
const users = await prisma.user.findMany({
  select: { id: true, name: true }, // Nao email, createdAt, etc
});

// 2. Evitar N+1 com include/select
const conversations = await prisma.conversation.findMany({
  include: { messages: true, contact: true }, // 1 query vs N queries
});

// 3. Usar cursor pagination para grandes datasets
// 4. Criar indices no schema para campos de filtro/ordenacao

// 5. Connection pooling
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// 6. Desconectar ao encerrar
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

---

## Checklist

- [ ] Definir indices para campos de busca/filtro
- [ ] Usar select para limitar campos retornados
- [ ] Implementar soft delete quando necessario
- [ ] Usar transactions para operacoes atomicas
- [ ] Implementar middleware para logging/audit
- [ ] Usar cursor pagination para grandes listas
- [ ] Configurar connection pooling
- [ ] Validar dados antes de enviar ao banco
