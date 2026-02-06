---
name: hoteis-seguranca
description: Padroes de seguranca do CRM Hoteis Reserva
version: 1.0.0
---

# Skill: Seguranca

Padroes de seguranca obrigatorios do CRM Hoteis Reserva.

## 1. Autenticacao e Autorizacao

### JWT Strategy

```typescript
// Fluxo de autenticacao:
1. POST /auth/login { email, password }
2. Valida credenciais (bcrypt)
3. Gera access token (15 min) + refresh token (7 dias)
4. Retorna tokens + user data
5. Frontend armazena em httpOnly cookie (ideal) ou localStorage

// Access Token Payload:
{
  sub: userId,
  tenantId: tenantId,
  role: 'ATTENDANT' | 'ADMIN' | 'SUPER_ADMIN',
  iat: timestamp,
  exp: timestamp
}

// Middleware valida token em todas as rotas /api/*
```

### Middleware de Autorizacao

```typescript
function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }

    next();
  };
}

// Uso:
router.delete('/tenants/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  async (req, res) => { /* ... */ }
);
```

## 2. Validacao de Entrada (Zod)

```typescript
// validators/message.validator.ts
import { z } from 'zod';

export const createMessageSchema = z.object({
  body: z.object({
    conversationId: z.string().uuid('ID de conversa invalido'),
    content: z.string()
      .min(1, 'Mensagem nao pode ser vazia')
      .max(4096, 'Mensagem muito longa (max 4096 caracteres)'),
    type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'])
      .optional()
      .default('TEXT'),
  }),
});

// middleware/validate.middleware.ts
export function validateRequest(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      next(error);
    }
  };
}
```

## 3. Criptografia de Dados Sensiveis

```typescript
// utils/encryption.ts
import crypto from 'crypto';
import { env } from '@/config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes

/**
 * Criptografa dados sensiveis (WhatsApp tokens, API keys)
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const key = crypto.pbkdf2Sync(KEY, salt, 100000, 32, 'sha512');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Formato: salt.iv.tag.encrypted (tudo em hex)
  return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
}

/**
 * Descriptografa dados
 */
export function decrypt(encryptedHex: string): string {
  const buffer = Buffer.from(encryptedHex, 'hex');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = crypto.pbkdf2Sync(KEY, salt, 100000, 32, 'sha512');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
```

### Dados que DEVEM ser criptografados

- `whatsappAccessToken` (Tenant)
- `whatsappAppSecret` (Tenant)
- `n8nApiKey` (Tenant)
- Qualquer API key de terceiros

## 4. Rate Limiting

| Endpoint | Limite | Janela | Razao |
|----------|--------|--------|-------|
| `/auth/login` | 5 req | 15 min | Protecao brute force |
| `/webhooks/*` | 1000 req | 1 min | Alto volume do WhatsApp |
| `/api/n8n/*` | 5000 req | 1 min | Carrosseis, automacoes |
| `/api/*` (geral) | 100 req | 1 min | Uso normal |
| `/api/media/*` | 200 req | 1 min | Download de midias |

```typescript
// middlewares/rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';

export const n8nLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5000,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many N8N requests',
    retryAfter: 60,
  },
  keyGenerator: (req) => {
    const apiKey = req.headers['x-api-key'] as string || '';
    const tenantSlug = apiKey.split(':')[0] || 'unknown';
    return `n8n:${tenantSlug}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

## 5. Webhook Security (WhatsApp)

```typescript
// Valida assinatura HMAC do webhook do WhatsApp
function validateWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

router.post('/whatsapp', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    logger.warn('Webhook received without signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const isValid = validateWebhookSignature(
    req.rawBody,
    signature,
    tenant.whatsappAppSecret
  );

  if (!isValid) {
    logger.warn({ signature }, 'Invalid webhook signature');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Prossegue...
});
```

## 6. SQL Injection Prevention

```typescript
// Prisma previne automaticamente, mas mantenha boas praticas:

// BOM - Prisma escapa automaticamente
const user = await prisma.user.findUnique({
  where: { email: req.body.email },
});

// RUIM - Raw SQL sem parametrizacao (NUNCA)
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${req.body.email}
`; // Vulneravel!

// BOM - Raw SQL com parametrizacao
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${Prisma.raw(email)}
`;
```

## 7. CORS Configuration

```typescript
import cors from 'cors';

const allowedOrigins = env.FRONTEND_URL.split(',').map(url => url.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS blocked origin');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 86400, // 24h preflight cache
}));
```

## 8. Security Headers (Helmet)

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://graph.facebook.com'],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true,
  },
}));
```

## 9. Multi-Tenant Security (CRITICO)

```typescript
// TODA query Prisma DEVE incluir tenantId (exceto SUPER_ADMIN)
// NAO buscar globalmente e verificar depois - vulneravel a timing attacks

// CORRETO
const user = await prisma.user.findFirst({
  where: {
    email,
    tenantId, // <- OBRIGATORIO NA QUERY
  },
});

// ERRADO (vulneravel)
const user = await prisma.user.findFirst({
  where: { email },
});
if (user.tenantId !== tenantId) throw new Error(); // TARDE DEMAIS
```

## Checklist de Seguranca

- [ ] JWT validado em todas as rotas /api/*?
- [ ] Zod validando todas as entradas?
- [ ] Dados sensiveis criptografados (AES-256)?
- [ ] Rate limiting configurado?
- [ ] HMAC validando webhooks?
- [ ] tenantId em TODAS as queries?
- [ ] CORS configurado corretamente?
- [ ] Helmet ativo?
- [ ] Sem console.log em producao?
- [ ] Sem secrets hardcoded?
