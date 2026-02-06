---
name: tech-redis-bull
description: Melhores praticas Redis e BullMQ - Cache, Filas, Jobs, Pub/Sub, Rate Limiting
version: 1.0.0
---

# Redis + BullMQ - Melhores Praticas

## Redis Basico

### Conexao
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('Redis connected'));
```

---

## Operacoes Basicas

```typescript
// Strings
await redis.set('user:1:name', 'Ana');
await redis.set('session:abc', 'data', 'EX', 3600); // Expira em 1h
const name = await redis.get('user:1:name');

// Com JSON
await redis.set('user:1', JSON.stringify({ name: 'Ana', role: 'ADMIN' }));
const user = JSON.parse(await redis.get('user:1') || '{}');

// Multiplos
await redis.mset('key1', 'val1', 'key2', 'val2');
const [val1, val2] = await redis.mget('key1', 'key2');

// Increment
await redis.incr('counter');
await redis.incrby('counter', 5);

// Expiracao
await redis.expire('key', 3600); // 1 hora
await redis.ttl('key'); // Tempo restante
```

---

## Hash (Objetos)

```typescript
// Set hash fields
await redis.hset('user:1', 'name', 'Ana', 'email', 'ana@email.com');
await redis.hset('user:1', { role: 'ADMIN', tenantId: 'tenant-1' });

// Get
const name = await redis.hget('user:1', 'name');
const user = await redis.hgetall('user:1');

// Increment field
await redis.hincrby('user:1', 'loginCount', 1);

// Delete field
await redis.hdel('user:1', 'tempField');
```

---

## Lists (Filas Simples)

```typescript
// Push
await redis.lpush('queue:notifications', JSON.stringify({ type: 'email' }));
await redis.rpush('queue:notifications', JSON.stringify({ type: 'sms' }));

// Pop (blocking)
const item = await redis.blpop('queue:notifications', 5); // Aguarda 5s

// Range
const items = await redis.lrange('queue:notifications', 0, 9); // Primeiros 10

// Length
const length = await redis.llen('queue:notifications');
```

---

## Sets e Sorted Sets

```typescript
// Set - membros unicos
await redis.sadd('user:1:roles', 'ADMIN', 'MODERATOR');
const roles = await redis.smembers('user:1:roles');
const isAdmin = await redis.sismember('user:1:roles', 'ADMIN');

// Sorted Set - com score
await redis.zadd('leaderboard', 100, 'user:1', 200, 'user:2');
const top10 = await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');
await redis.zincrby('leaderboard', 10, 'user:1');

// Rate limiting com sorted set
async function isRateLimited(userId: string, limit: number, window: number) {
  const key = `ratelimit:${userId}`;
  const now = Date.now();
  const windowStart = now - window * 1000;

  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);

  if (count >= limit) return true;

  await redis.zadd(key, now, `${now}`);
  await redis.expire(key, window);
  return false;
}
```

---

## Cache Pattern

```typescript
// Cache-aside pattern
async function getUser(id: string): Promise<User> {
  const cacheKey = `user:${id}`;

  // Tenta cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Busca no banco
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('User not found');

  // Salva no cache
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
  return user;
}

// Invalidar cache
async function updateUser(id: string, data: UpdateUserInput) {
  const user = await prisma.user.update({ where: { id }, data });
  await redis.del(`user:${id}`);
  return user;
}

// Cache com stale-while-revalidate
async function getUserWithSWR(id: string): Promise<User> {
  const key = `user:${id}`;
  const staleKey = `user:${id}:stale`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  // Verifica stale
  const stale = await redis.get(staleKey);
  if (stale) {
    // Revalida em background
    refreshUserCache(id);
    return JSON.parse(stale);
  }

  return fetchAndCacheUser(id);
}
```

---

## Pub/Sub

```typescript
// Publisher
const pub = new Redis();

async function publishEvent(channel: string, data: object) {
  await pub.publish(channel, JSON.stringify(data));
}

// Subscriber
const sub = new Redis();

sub.subscribe('notifications', 'events');

sub.on('message', (channel, message) => {
  const data = JSON.parse(message);
  console.log(`${channel}: ${JSON.stringify(data)}`);
});

// Pattern subscribe
sub.psubscribe('user:*');

sub.on('pmessage', (pattern, channel, message) => {
  console.log(`${pattern} -> ${channel}: ${message}`);
});
```

---

## BullMQ - Filas de Jobs

### Setup
```typescript
import { Queue, Worker, Job } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Criar fila
const emailQueue = new Queue('email', { connection });
const webhookQueue = new Queue('webhook', { connection });
```

### Adicionar Jobs
```typescript
// Job simples
await emailQueue.add('send', {
  to: 'user@email.com',
  subject: 'Bem-vindo',
  body: 'Conteudo do email',
});

// Job com opcoes
await emailQueue.add('send', { to: 'user@email.com' }, {
  delay: 5000,           // Atraso de 5s
  attempts: 3,           // Maximo de tentativas
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: 1000,     // Manter ultimos 1000 falhos
  priority: 1,            // Menor = maior prioridade
});

// Job com ID customizado (evita duplicatas)
await emailQueue.add('send', { to: 'user@email.com' }, {
  jobId: `email-welcome-user-123`,
});
```

### Workers
```typescript
const emailWorker = new Worker('email', async (job: Job) => {
  const { to, subject, body } = job.data;

  // Atualizar progresso
  await job.updateProgress(10);

  // Processar
  await sendEmail(to, subject, body);

  await job.updateProgress(100);

  return { sent: true, timestamp: new Date() };
}, {
  connection,
  concurrency: 5, // Jobs simultaneos
});

// Event handlers
emailWorker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

emailWorker.on('progress', (job, progress) => {
  console.log(`Job ${job.id}: ${progress}%`);
});
```

### Jobs Recorrentes
```typescript
// Repetir a cada 5 minutos
await emailQueue.add('daily-report', { type: 'daily' }, {
  repeat: {
    every: 5 * 60 * 1000,
  },
});

// Cron expression
await emailQueue.add('backup', {}, {
  repeat: {
    pattern: '0 0 * * *', // Todo dia meia-noite
  },
});

// Remover job recorrente
const repeatableJobs = await emailQueue.getRepeatableJobs();
for (const job of repeatableJobs) {
  await emailQueue.removeRepeatableByKey(job.key);
}
```

### Flow (Jobs dependentes)
```typescript
import { FlowProducer } from 'bullmq';

const flowProducer = new FlowProducer({ connection });

// Job pai aguarda filhos
await flowProducer.add({
  name: 'process-order',
  queueName: 'orders',
  data: { orderId: '123' },
  children: [
    {
      name: 'validate-payment',
      queueName: 'payments',
      data: { orderId: '123' },
    },
    {
      name: 'update-inventory',
      queueName: 'inventory',
      data: { orderId: '123' },
    },
  ],
});
```

---

## Patterns Uteis

### Distributed Lock
```typescript
import Redlock from 'redlock';

const redlock = new Redlock([redis], {
  retryCount: 3,
  retryDelay: 200,
});

async function processWithLock(resourceId: string) {
  const lock = await redlock.acquire([`lock:${resourceId}`], 5000);

  try {
    // Codigo protegido
    await processResource(resourceId);
  } finally {
    await lock.release();
  }
}
```

### Session Store
```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redis }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 86400000 },
}));
```

### Rate Limiter (Express)
```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit',
  points: 100,    // Requests
  duration: 60,   // Por minuto
});

app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (err) {
    res.status(429).json({ error: 'Too many requests' });
  }
});
```

---

## Monitoramento

```typescript
// Info do Redis
const info = await redis.info();

// Monitorar fila BullMQ
const counts = await emailQueue.getJobCounts();
// { waiting: 10, active: 2, completed: 100, failed: 5, delayed: 3 }

// Limpar jobs antigos
await emailQueue.clean(24 * 3600 * 1000, 1000, 'completed');
```

---

## Checklist

- [ ] Usar prefixos nas chaves (user:, session:, cache:)
- [ ] Definir TTL para todas chaves de cache
- [ ] Implementar circuit breaker para Redis
- [ ] Usar pipeline para multiplas operacoes
- [ ] Configurar maxmemory-policy (allkeys-lru)
- [ ] Monitorar memoria e conexoes
- [ ] Usar BullMQ para jobs (nao Bull antigo)
- [ ] Implementar retry com backoff exponencial
