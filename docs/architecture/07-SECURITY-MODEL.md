# Modelo de Seguranca - Bot Reserva Hoteis

## 1. Visao Geral da Arquitetura de Seguranca

```
+-----------------------------------------------------------------------------+
|                           CAMADAS DE SEGURANCA                               |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +---------------------------------------------------------------------+   |
|  |                     CAMADA DE PERIMETRO                              |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  |  |   Nginx     |  |  DDoS       |  |   Rate      |  |   CORS     |  |   |
|  |  | Rev. Proxy  |  | Protection  |  |  Limiting   |  |  Policy    |  |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  +---------------------------------------------------------------------+   |
|                                    |                                        |
|  +---------------------------------v-----------------------------------+   |
|  |                     CAMADA DE TRANSPORTE                             |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  |  |  TLS 1.2+   |  |   HSTS      |  | Let's       |  |   CSP      |  |   |
|  |  |  HTTPS      |  |   Headers   |  | Encrypt     |  |  Headers   |  |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  +---------------------------------------------------------------------+   |
|                                    |                                        |
|  +---------------------------------v-----------------------------------+   |
|  |                     CAMADA DE AUTENTICACAO                           |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  |  |    JWT      |  |  Refresh    |  |   X-API-Key |  |  Session   |  |   |
|  |  |   Tokens    |  |   Tokens    |  |   (N8N)     |  | Management |  |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  +---------------------------------------------------------------------+   |
|                                    |                                        |
|  +---------------------------------v-----------------------------------+   |
|  |                     CAMADA DE AUTORIZACAO                            |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  |  |    RBAC     |  |  Multi-     |  |   Policy    |  |   Audit    |  |   |
|  |  |   Roles     |  |  Tenancy    |  |  Evaluation |  |   Logging  |  |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  +---------------------------------------------------------------------+   |
|                                    |                                        |
|  +---------------------------------v-----------------------------------+   |
|  |                     CAMADA DE DADOS                                  |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  |  |  AES-256    |  |   Input     |  |   Prisma    |  |  Webhook   |  |   |
|  |  |  Encryption |  | Validation  |  | Param Query |  |  HMAC      |  |   |
|  |  +-------------+  +-------------+  +-------------+  +------------+  |   |
|  +---------------------------------------------------------------------+   |
|                                                                             |
+-----------------------------------------------------------------------------+
```

## 2. Autenticacao JWT

### 2.1 Estrutura dos Tokens

```typescript
// Access Token Payload
interface AccessTokenPayload {
  sub: string;           // User ID (UUID)
  tenantId: string;      // Tenant ID (UUID) - isolamento multi-tenant
  email: string;         // User email
  role: UserRole;        // SUPER_ADMIN | ADMIN | MANAGER | ATTENDANT
  hotelUnit?: string;    // Unidade hoteleira (opcional)
  iat: number;           // Issued at (timestamp)
  exp: number;           // Expiration (timestamp) - 8 horas
  jti: string;           // JWT ID (UUID) - para blacklist
  type: 'access';        // Token type
}

// Refresh Token Payload
interface RefreshTokenPayload {
  sub: string;           // User ID (UUID)
  tenantId: string;      // Tenant ID (UUID)
  sessionId: string;     // Session ID (UUID)
  iat: number;           // Issued at (timestamp)
  exp: number;           // Expiration (timestamp) - 7 dias
  jti: string;           // JWT ID (UUID)
  type: 'refresh';       // Token type
}
```

### 2.2 Configuracao JWT

```typescript
// config/jwt.config.ts
export const jwtConfig = {
  access: {
    secret: process.env.JWT_SECRET,       // Minimo 256 bits
    expiresIn: '8h',                      // 8 horas de sessao
    algorithm: 'HS256' as const,
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET, // Diferente do access
    expiresIn: '7d',                        // 7 dias
    algorithm: 'HS256' as const,
  },
  issuer: 'bot-reserva-hoteis',
  audience: 'bot-reserva-api',
};

// Geracao de secrets seguros (exemplo)
// openssl rand -base64 64
```

### 2.3 Fluxo de Autenticacao

```
+------------+     +------------+     +------------+     +------------+
|   Client   |     |    API     |     |   Redis    |     | PostgreSQL |
+-----+------+     +-----+------+     +-----+------+     +-----+------+
      |                  |                  |                  |
      | POST /auth/login |                  |                  |
      | {email, password}|                  |                  |
      |----------------->|                  |                  |
      |                  |                  |                  |
      |                  | SELECT user WHERE email = ?         |
      |                  |------------------------------------>|
      |                  |<------------------------------------|
      |                  |                  |                  |
      |                  | SELECT tenant WHERE id = user.tenantId
      |                  |------------------------------------>|
      |                  |<------------------------------------|
      |                  |                  |                  |
      |                  | bcrypt.compare() |                  |
      |                  |-------+          |                  |
      |                  |<------+          |                  |
      |                  |                  |                  |
      |                  | Generate JWT     |                  |
      |                  | (access+refresh) |                  |
      |                  | Include tenantId |                  |
      |                  |-------+          |                  |
      |                  |<------+          |                  |
      |                  |                  |                  |
      |                  | SET session:{userId}                |
      |                  |----------------->|                  |
      |                  |<-----------------|                  |
      |                  |                  |                  |
      |  200 OK          |                  |                  |
      |  {accessToken,   |                  |                  |
      |   refreshToken,  |                  |                  |
      |   user, tenant}  |                  |                  |
      |<-----------------|                  |                  |
      |                  |                  |                  |
```

### 2.4 Cookie Configuration

```typescript
// services/auth.service.ts
const cookieOptions = {
  accessToken: {
    httpOnly: true,           // Previne acesso via JavaScript
    secure: true,             // Apenas HTTPS em producao
    sameSite: 'strict',       // Previne CSRF
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,   // 8 horas
  },
  refreshToken: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth',        // Restrito a endpoints de auth
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 dias
  },
};
```

### 2.5 Token Blacklist

```typescript
// services/token-blacklist.service.ts
export class TokenBlacklistService {
  constructor(private readonly redis: Redis) {}

  async blacklist(jti: string, expiresAt: Date): Promise<void> {
    const ttl = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:${jti}`, '1', 'EX', ttl);
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${jti}`);
    return result !== null;
  }

  async blacklistAllUserTokens(userId: string): Promise<void> {
    // Em caso de logout forçado ou comprometimento
    await this.redis.set(`blacklist:user:${userId}`, Date.now().toString(), 'EX', 86400);
  }
}
```

## 3. Autenticacao N8N (X-API-Key)

### 3.1 Formato da API Key

```typescript
// Formato: {tenantSlug}:{whatsappPhoneNumberId}
// Exemplo: hoteis-reserva:123456789012345

interface N8NApiKey {
  tenantSlug: string;           // Slug do hotel (hoteis-reserva)
  whatsappPhoneNumberId: string; // Phone Number ID do WhatsApp
}

// Header obrigatorio
// X-API-Key: hoteis-reserva:123456789012345
```

### 3.2 Validacao da API Key

```typescript
// middlewares/n8n-auth.middleware.ts
export async function n8nAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'X-API-Key header required' });
  }

  const [tenantSlug, whatsappPhoneNumberId] = apiKey.split(':');

  if (!tenantSlug || !whatsappPhoneNumberId) {
    return res.status(401).json({ error: 'Invalid API Key format' });
  }

  // Buscar tenant pelo slug e phoneNumberId
  const tenant = await prisma.tenant.findFirst({
    where: {
      slug: tenantSlug,
      whatsappPhoneNumberId: whatsappPhoneNumberId,
      active: true,
    },
  });

  if (!tenant) {
    logger.warn({ tenantSlug, whatsappPhoneNumberId }, 'Invalid N8N API Key');
    return res.status(401).json({ error: 'Invalid API Key' });
  }

  // Injetar tenant no request
  req.tenantId = tenant.id;
  req.tenant = tenant;

  next();
}
```

### 3.3 Endpoints Protegidos por N8N Auth

```
POST /api/n8n/send-text          - Enviar mensagem de texto
POST /api/n8n/send-buttons       - Enviar mensagem com botoes
POST /api/n8n/send-list          - Enviar lista interativa
POST /api/n8n/send-media         - Enviar midia
POST /api/n8n/send-template      - Enviar template
POST /api/n8n/send-carousel      - Enviar carousel
POST /api/n8n/escalate           - Escalar para atendente
POST /api/n8n/set-hotel-unit     - Definir unidade hoteleira
POST /api/n8n/mark-read          - Marcar como lida
GET  /api/n8n/check-ia-lock      - Verificar lock da IA
```

## 4. Autorizacao RBAC + Multi-Tenant

### 4.1 Hierarquia de Roles

```
                    +------------------+
                    |   SUPER_ADMIN    |
                    | (Nivel 4)        |
                    |                  |
                    | - Todos tenants  |
                    | - Config global  |
                    | - Auditoria      |
                    +--------+---------+
                             |
                    +--------v---------+
                    |     ADMIN        |
                    | (Nivel 3)        |
                    |                  |
                    | - Tenant proprio |
                    | - Gestao users   |
                    | - Relatorios     |
                    +--------+---------+
                             |
                    +--------v---------+
                    |    MANAGER       |
                    | (Nivel 2)        |
                    |                  |
                    | - Supervisao     |
                    | - Relatorios     |
                    | - Todas unidades |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   ATTENDANT      |
                    | (Nivel 1)        |
                    |                  |
                    | - Conversas      |
                    | - Apenas propria |
                    |   unidade        |
                    +-----------------+
```

### 4.2 Isolamento Multi-Tenant

```typescript
// REGRA DE OURO: TODAS as queries DEVEM incluir tenantId
// Excecao: SUPER_ADMIN pode consultar sem tenantId

// middlewares/tenant.middleware.ts
export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  // SUPER_ADMIN pode acessar qualquer tenant
  if (req.user?.role === 'SUPER_ADMIN') {
    req.tenantId = req.query.tenantId as string || req.user.tenantId;
  } else {
    // Usuarios normais so acessam seu proprio tenant
    req.tenantId = req.user?.tenantId;
  }

  if (!req.tenantId) {
    return res.status(403).json({ error: 'Tenant ID required' });
  }

  next();
}

// Exemplo de query COM isolamento
const conversations = await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId,  // <-- OBRIGATORIO
    status: 'OPEN',
  },
});

// NUNCA fazer query sem tenantId (vazamento entre tenants!)
```

### 4.3 Matriz de Permissoes por Recurso

#### Conversas (Conversations)

| Acao | ATTENDANT | MANAGER | ADMIN | SUPER_ADMIN |
|------|-----------|---------|-------|-------------|
| Listar proprias | OK | OK | OK | OK |
| Listar da unidade | OK* | OK | OK | OK |
| Listar todas | X | OK | OK | OK |
| Ver detalhes propria | OK | OK | OK | OK |
| Ver detalhes qualquer | X | OK | OK | OK |
| Assumir conversa | OK** | OK | OK | OK |
| Transferir conversa | X | OK | OK | OK |
| Fechar conversa | OK** | OK | OK | OK |
| Reabrir conversa | X | OK | OK | OK |

*ATTENDANT so ve conversas da sua hotelUnit
**ATTENDANT so pode agir em conversas atribuidas a ele

#### Mensagens (Messages)

| Acao | ATTENDANT | MANAGER | ADMIN | SUPER_ADMIN |
|------|-----------|---------|-------|-------------|
| Enviar em conversa atribuida | OK | OK | OK | OK |
| Enviar em conversa nao atribuida | X | OK | OK | OK |
| Ver historico | OK* | OK | OK | OK |
| Deletar mensagem | X | X | X | OK |

*Apenas de conversas da sua unidade

#### Usuarios (Users)

| Acao | ATTENDANT | MANAGER | ADMIN | SUPER_ADMIN |
|------|-----------|---------|-------|-------------|
| Ver proprio perfil | OK | OK | OK | OK |
| Editar proprio perfil | OK | OK | OK | OK |
| Listar usuarios | X | OK | OK | OK |
| Criar usuario | X | X | OK | OK |
| Editar outro usuario | X | X | OK* | OK |
| Deletar usuario | X | X | OK* | OK |
| Alterar role | X | X | X | OK |

*ADMIN nao pode editar/deletar SUPER_ADMIN

#### Escalacoes (Escalations)

| Acao | ATTENDANT | MANAGER | ADMIN | SUPER_ADMIN |
|------|-----------|---------|-------|-------------|
| Ver pendentes | OK* | OK | OK | OK |
| Assumir escalacao | OK | OK | OK | OK |
| Resolver escalacao | OK** | OK | OK | OK |
| Ver historico | X | OK | OK | OK |
| Relatorios | X | X | OK | OK |

*Apenas da sua unidade
**Apenas escalacoes atribuidas a ele

#### Tenants

| Acao | ATTENDANT | MANAGER | ADMIN | SUPER_ADMIN |
|------|-----------|---------|-------|-------------|
| Ver proprio tenant | OK | OK | OK | OK |
| Editar config tenant | X | X | OK | OK |
| Listar todos tenants | X | X | X | OK |
| Criar tenant | X | X | X | OK |
| Deletar tenant | X | X | X | OK |

### 4.4 Implementacao dos Guards

```typescript
// middlewares/auth.middleware.ts
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;

    // Verificar se token esta na blacklist
    const isBlacklisted = await tokenBlacklistService.isBlacklisted(payload.jti);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    req.user = payload;
    req.tenantId = payload.tenantId;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// middlewares/roles.middleware.ts
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({
        userId: req.user.sub,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      }, 'Access denied - insufficient role');

      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Uso nas rotas
router.delete('/tenants/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  async (req, res) => { /* ... */ }
);
```

### 4.5 Filtro por Hotel Unit

```typescript
// middlewares/hotel-unit.middleware.ts
export function hotelUnitFilter(req: Request, res: Response, next: NextFunction) {
  // MANAGER e acima veem todas as unidades
  if (['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)) {
    req.hotelUnitFilter = null; // Sem filtro
    return next();
  }

  // ATTENDANT ve apenas sua unidade
  if (req.user?.role === 'ATTENDANT') {
    req.hotelUnitFilter = req.user.hotelUnit || null;
  }

  next();
}

// Uso na query
const conversations = await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId,
    status: 'OPEN',
    ...(req.hotelUnitFilter && { hotelUnit: req.hotelUnitFilter }),
  },
});
```

## 5. Protecao de Senhas

### 5.1 Configuracao bcrypt

```typescript
// config/security.config.ts
export const passwordConfig = {
  saltRounds: 10,             // Custo computacional (2^10 iteracoes)
  minLength: 8,               // Minimo 8 caracteres
  maxLength: 128,             // Maximo 128 caracteres
  requireUppercase: true,     // Pelo menos 1 maiuscula
  requireLowercase: true,     // Pelo menos 1 minuscula
  requireNumber: true,        // Pelo menos 1 numero
  requireSpecial: false,      // Caractere especial opcional
};

// services/auth.service.ts
export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, passwordConfig.saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < passwordConfig.minLength) {
      errors.push(`Minimo ${passwordConfig.minLength} caracteres`);
    }

    if (password.length > passwordConfig.maxLength) {
      errors.push(`Maximo ${passwordConfig.maxLength} caracteres`);
    }

    if (passwordConfig.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Deve conter letra maiuscula');
    }

    if (passwordConfig.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Deve conter letra minuscula');
    }

    if (passwordConfig.requireNumber && !/\d/.test(password)) {
      errors.push('Deve conter numero');
    }

    return { valid: errors.length === 0, errors };
  }
}
```

### 5.2 Politica de Senhas

```
+----------------------------------------------------------------+
|                    POLITICA DE SENHAS                           |
+----------------------------------------------------------------+
|                                                                 |
|  Requisitos Minimos:                                            |
|  +------------------------------------------------------------+ |
|  | - Minimo 8 caracteres                                      | |
|  | - Pelo menos 1 letra maiuscula (A-Z)                       | |
|  | - Pelo menos 1 letra minuscula (a-z)                       | |
|  | - Pelo menos 1 numero (0-9)                                | |
|  +------------------------------------------------------------+ |
|                                                                 |
|  Armazenamento:                                                 |
|  +------------------------------------------------------------+ |
|  | - bcrypt com salt unico por senha                          | |
|  | - Cost factor: 10 (1024 iteracoes)                         | |
|  | - Hash resultante: 60 caracteres                           | |
|  +------------------------------------------------------------+ |
|                                                                 |
|  Regras Adicionais:                                             |
|  +------------------------------------------------------------+ |
|  | - Nao pode conter email do usuario                         | |
|  | - Nao pode conter nome do usuario                          | |
|  | - Verificacao contra lista de senhas comuns                | |
|  +------------------------------------------------------------+ |
|                                                                 |
+----------------------------------------------------------------+
```

## 6. Rate Limiting

### 6.1 Configuracao por Endpoint

```typescript
// config/rate-limit.config.ts
export const rateLimitConfig = {
  // Limite global
  global: {
    windowMs: 60 * 1000,      // 1 minuto
    max: 100,                  // 100 requisicoes por IP
  },

  // Endpoints de autenticacao (mais restritivos)
  auth: {
    login: {
      windowMs: 15 * 60 * 1000,  // 15 minutos
      max: 5,                     // 5 tentativas
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    },
    register: {
      windowMs: 60 * 60 * 1000,  // 1 hora
      max: 3,                     // 3 registros por IP
      message: 'Limite de registros excedido.',
    },
    refresh: {
      windowMs: 60 * 1000,       // 1 minuto
      max: 10,                    // 10 refreshes por minuto
    },
  },

  // Webhooks do WhatsApp (alto volume)
  webhooks: {
    windowMs: 60 * 1000,         // 1 minuto
    max: 1000,                    // 1000 requisicoes
    keyGenerator: (req) => `webhook:${req.ip}`,
  },

  // N8N (automacoes - ALTO VOLUME)
  n8n: {
    windowMs: 60 * 1000,         // 1 minuto
    max: 5000,                    // 5000 requisicoes por tenant
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'] as string || '';
      const tenantSlug = apiKey.split(':')[0] || 'unknown';
      return `n8n:${tenantSlug}`;
    },
    message: 'Rate limit N8N excedido. Aguarde antes de enviar mais mensagens.',
  },

  // API geral
  api: {
    conversations: {
      windowMs: 60 * 1000,
      max: 60,
    },
    messages: {
      windowMs: 60 * 1000,
      max: 100,
    },
    media: {
      windowMs: 60 * 1000,
      max: 200,
    },
  },
};
```

### 6.2 Implementacao com Redis

```typescript
// middlewares/rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '@/config/redis';

export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: {
      error: 'Rate limit exceeded',
      message: config.message || 'Too many requests',
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    keyGenerator: config.keyGenerator || ((req) => {
      const userId = req.user?.sub || 'anonymous';
      return `${req.ip}:${userId}`;
    }),
    standardHeaders: true, // RateLimit-* headers
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
  });
}

// Aplicar por rota
router.post('/auth/login', createRateLimiter(rateLimitConfig.auth.login), loginHandler);
router.use('/api/n8n', createRateLimiter(rateLimitConfig.n8n), n8nRoutes);
```

### 6.3 Diagrama de Rate Limiting

```
+--------------------------------------------------------------------------+
|                         RATE LIMITING FLOW                                |
+--------------------------------------------------------------------------+
|                                                                          |
|   Request                                                                |
|      |                                                                   |
|      v                                                                   |
|   +-----------------+                                                    |
|   | Extract Key     |                                                    |
|   | (IP + User/     |                                                    |
|   |  Tenant)        |                                                    |
|   +--------+--------+                                                    |
|            |                                                             |
|            v                                                             |
|   +-----------------+     +--------------+                               |
|   | INCR key        |---->|    Redis     |                               |
|   | GET TTL         |<----|              |                               |
|   +--------+--------+     +--------------+                               |
|            |                                                             |
|            v                                                             |
|   +-----------------+                                                    |
|   | count > limit?  |                                                    |
|   +--------+--------+                                                    |
|            |                                                             |
|     +------+------+                                                      |
|     |             |                                                      |
|     v             v                                                      |
|   +----+       +------------------+                                      |
|   | No |       | Yes              |                                      |
|   +-+--+       | Return 429       |                                      |
|     |         | Too Many Requests |                                      |
|     |         +------------------+                                       |
|     v                                                                    |
|   +-----------------+                                                    |
|   | Set Headers:    |                                                    |
|   | X-RateLimit-*   |                                                    |
|   +--------+--------+                                                    |
|            |                                                             |
|            v                                                             |
|   +-----------------+                                                    |
|   | Continue to     |                                                    |
|   | Handler         |                                                    |
|   +-----------------+                                                    |
|                                                                          |
+--------------------------------------------------------------------------+
```

## 7. Criptografia de Dados Sensiveis

### 7.1 AES-256-GCM para Credenciais

```typescript
// utils/encryption.ts
import crypto from 'crypto';
import { env } from '@/config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes (64 hex chars)

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

### 7.2 Dados Criptografados

| Campo | Tabela | Razao |
|-------|--------|-------|
| `whatsappAccessToken` | Tenant | Token de acesso a API do WhatsApp |
| `whatsappAppSecret` | Tenant | Secret para validacao de webhooks |
| `n8nApiKey` | Tenant | Chave de API do N8N (se armazenada) |

## 8. Validacao de Webhook (WhatsApp)

### 8.1 HMAC-SHA256 Signature

```typescript
// routes/webhook.routes.ts
import crypto from 'crypto';

/**
 * Valida assinatura HMAC do webhook do WhatsApp
 * Previne ataques de replay e webhooks falsificados
 */
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

// Middleware para capturar raw body
app.use('/webhooks/whatsapp', express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString();
  },
}));

router.post('/whatsapp', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    logger.warn({ ip: req.ip }, 'Webhook without signature');
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Identificar tenant pelo phone number ID
  const phoneNumberId = extractPhoneNumberId(req.body);
  const tenant = await getTenantByPhoneNumberId(phoneNumberId);

  if (!tenant) {
    logger.warn({ phoneNumberId }, 'Unknown phone number ID');
    return res.status(404).json({ error: 'Unknown tenant' });
  }

  // Descriptografar app secret e validar
  const appSecret = decrypt(tenant.whatsappAppSecret);
  const isValid = validateWebhookSignature(req.rawBody, signature, appSecret);

  if (!isValid) {
    logger.warn({
      tenantId: tenant.id,
      signature,
    }, 'Invalid webhook signature');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Processar webhook...
});
```

### 8.2 Verificacao de Webhook (Setup)

```typescript
// GET /webhooks/whatsapp - Verificacao inicial pelo Meta
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  logger.warn({ token }, 'Invalid webhook verification token');
  return res.status(403).json({ error: 'Invalid verify token' });
});
```

## 9. Headers de Seguranca

### 9.1 Configuracao Helmet

```typescript
// server.ts
import helmet from 'helmet';

app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Next.js precisa
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'wss:', 'https://graph.facebook.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },

  // Strict Transport Security
  hsts: {
    maxAge: 31536000,           // 1 ano
    includeSubDomains: true,
    preload: true,
  },

  // Outras configuracoes
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,                 // X-Content-Type-Options: nosniff
  xssFilter: true,               // X-XSS-Protection
  hidePoweredBy: true,           // Remove X-Powered-By
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
}));
```

### 9.2 CORS Configuration

```typescript
// server.ts
import cors from 'cors';

const allowedOrigins = env.FRONTEND_URL.split(',').map(url => url.trim());
// Exemplo: ['https://www.botreserva.com.br', 'https://admin.botreserva.com.br']

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (mobile apps, Postman em dev)
    if (!origin && env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS blocked origin');
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  credentials: true,
  maxAge: 86400,                 // Cache preflight por 24h
}));
```

## 10. Validacao de Entrada (Zod)

### 10.1 Schema de Mensagem

```typescript
// validators/message.validator.ts
import { z } from 'zod';

export const sendTextMessageSchema = z.object({
  body: z.object({
    conversationId: z.string().uuid('ID de conversa invalido'),
    content: z.string()
      .min(1, 'Mensagem nao pode ser vazia')
      .max(4096, 'Mensagem muito longa (max 4096 caracteres)'),
  }),
});

export const sendButtonsMessageSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^\d{10,15}$/, 'Telefone invalido'),
    text: z.string().min(1).max(1024),
    buttons: z.array(z.object({
      id: z.string().max(256),
      title: z.string().max(20),
    })).min(1).max(3, 'Maximo 3 botoes'),
    header: z.string().max(60).optional(),
    footer: z.string().max(60).optional(),
  }),
});
```

### 10.2 Schema de Autenticacao

```typescript
// validators/auth.validator.ts
export const loginSchema = z.object({
  body: z.object({
    email: z.string()
      .email('Email invalido')
      .max(255)
      .transform(val => val.toLowerCase().trim()),
    password: z.string()
      .min(8, 'Senha deve ter minimo 8 caracteres')
      .max(128),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
    name: z.string().min(2).max(100),
    tenantId: z.string().uuid(),
    role: z.enum(['ADMIN', 'MANAGER', 'ATTENDANT']).default('ATTENDANT'),
    hotelUnit: z.string().max(100).optional(),
  }),
});
```

### 10.3 Middleware de Validacao

```typescript
// middlewares/validate.middleware.ts
import { ZodSchema, ZodError } from 'zod';

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
      if (error instanceof ZodError) {
        logger.warn({
          path: req.path,
          errors: error.errors,
        }, 'Validation failed');

        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}
```

## 11. Protecao SQL Injection (Prisma)

### 11.1 Queries Parametrizadas (Padrao)

```typescript
// Prisma automaticamente usa prepared statements
// Todas as queries sao parametrizadas por padrao

// OK - SEGURO - Prisma parametriza automaticamente
const conversations = await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId,    // Parametrizado
    status: status,            // Parametrizado
    contact: {
      phoneNumber: phone,      // Parametrizado
    },
  },
});

// OK - SEGURO - Raw query com parametros
const results = await prisma.$queryRaw`
  SELECT * FROM conversations
  WHERE tenant_id = ${tenantId}
  AND status = ${status}
`;

// NUNCA FAZER - Interpolacao direta (vulneravel!)
// const results = await prisma.$queryRawUnsafe(
//   `SELECT * FROM conversations WHERE tenant_id = '${tenantId}'`
// );
```

### 11.2 Validacao de Parametros de Query

```typescript
// validators/conversation.validator.ts
export const listConversationsSchema = z.object({
  query: z.object({
    status: z.enum(['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED']).optional(),
    hotelUnit: z.string().max(100).optional(),
    assignedToId: z.string().uuid().optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sortBy: z.enum(['lastMessageAt', 'createdAt', 'status']).default('lastMessageAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
```

## 12. Auditoria e Logging

### 12.1 Estrutura de Log de Auditoria

```typescript
// Prisma schema
model AuditLog {
  id           String   @id @default(uuid())
  tenantId     String?
  userId       String?
  userEmail    String?
  userRole     String?
  action       String
  entity       String
  entityId     String?
  oldData      Json?
  newData      Json?
  ipAddress    String
  userAgent    String?
  success      Boolean  @default(true)
  errorMessage String?
  metadata     Json?
  createdAt    DateTime @default(now())

  tenant       Tenant?  @relation(fields: [tenantId], references: [id])
  user         User?    @relation(fields: [userId], references: [id])

  @@index([tenantId, createdAt])
  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@index([entity, entityId])
}
```

### 12.2 Acoes Auditadas

```typescript
export enum AuditAction {
  // Autenticacao
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',

  // Usuarios
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  ROLE_CHANGE = 'ROLE_CHANGE',

  // Conversas
  CONVERSATION_ASSIGN = 'CONVERSATION_ASSIGN',
  CONVERSATION_TRANSFER = 'CONVERSATION_TRANSFER',
  CONVERSATION_CLOSE = 'CONVERSATION_CLOSE',
  CONVERSATION_REOPEN = 'CONVERSATION_REOPEN',

  // Mensagens
  MESSAGE_SEND = 'MESSAGE_SEND',
  MESSAGE_DELETE = 'MESSAGE_DELETE',

  // Escalacoes
  ESCALATION_CREATE = 'ESCALATION_CREATE',
  ESCALATION_RESOLVE = 'ESCALATION_RESOLVE',

  // IA
  IA_LOCK_ENABLE = 'IA_LOCK_ENABLE',
  IA_LOCK_DISABLE = 'IA_LOCK_DISABLE',

  // Tenants
  TENANT_CREATE = 'TENANT_CREATE',
  TENANT_UPDATE = 'TENANT_UPDATE',
  TENANT_DELETE = 'TENANT_DELETE',
  TENANT_SUSPEND = 'TENANT_SUSPEND',

  // Seguranca
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}
```

### 12.3 Servico de Auditoria

```typescript
// services/audit.service.ts
export class AuditService {
  async log(params: CreateAuditLogParams): Promise<void> {
    const log = {
      tenantId: params.tenantId,
      userId: params.user?.sub,
      userEmail: params.user?.email,
      userRole: params.user?.role,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      oldData: this.sanitizeData(params.oldData),
      newData: this.sanitizeData(params.newData),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: params.success ?? true,
      errorMessage: params.errorMessage,
      metadata: params.metadata,
    };

    // Salvar no banco
    await prisma.auditLog.create({ data: log });

    // Log estruturado para Pino
    logger.info({
      audit: true,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      userId: log.userId,
      tenantId: log.tenantId,
      success: log.success,
    }, `Audit: ${log.action}`);
  }

  private sanitizeData(data: any): any {
    if (!data) return null;

    const sensitiveFields = [
      'password',
      'whatsappAccessToken',
      'whatsappAppSecret',
      'token',
      'secret',
    ];

    const sanitized = { ...data };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }
}
```

## 13. Protecao contra Ataques Comuns

### 13.1 Brute Force Protection

```typescript
// services/brute-force.service.ts
export class BruteForceProtectionService {
  private readonly maxAttempts = 5;
  private readonly lockDuration = 15 * 60; // 15 minutos

  async recordFailedAttempt(identifier: string): Promise<void> {
    const key = `bruteforce:${identifier}`;
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      await redis.expire(key, this.lockDuration);
    }

    if (attempts >= this.maxAttempts) {
      await redis.set(
        `locked:${identifier}`,
        '1',
        'EX',
        this.lockDuration
      );

      logger.warn({
        identifier,
        attempts,
      }, 'Account locked due to brute force attempts');
    }
  }

  async isLocked(identifier: string): Promise<boolean> {
    return (await redis.get(`locked:${identifier}`)) !== null;
  }

  async clearAttempts(identifier: string): Promise<void> {
    await redis.del(`bruteforce:${identifier}`);
    await redis.del(`locked:${identifier}`);
  }

  async getRemainingAttempts(identifier: string): Promise<number> {
    const attempts = await redis.get(`bruteforce:${identifier}`);
    return Math.max(0, this.maxAttempts - (parseInt(attempts || '0')));
  }
}

// Uso no login
if (await bruteForceService.isLocked(email)) {
  return res.status(429).json({
    error: 'Account temporarily locked',
    message: 'Muitas tentativas de login. Aguarde 15 minutos.',
  });
}

const user = await authService.validateCredentials(email, password);

if (!user) {
  await bruteForceService.recordFailedAttempt(email);
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Login bem sucedido - limpar tentativas
await bruteForceService.clearAttempts(email);
```

### 13.2 Deteccao de Atividade Suspeita

```typescript
// services/suspicious-activity.service.ts
export class SuspiciousActivityService {
  async checkAndAlert(userId: string, activity: Activity): Promise<void> {
    const suspicious = await this.detectSuspiciousPatterns(userId, activity);

    if (suspicious.detected) {
      await auditService.log({
        action: AuditAction.SUSPICIOUS_ACTIVITY,
        userId,
        metadata: {
          type: suspicious.type,
          reason: suspicious.reason,
          activity,
        },
      });

      // Notificar administradores via Socket.io
      socketService.emitToRole('ADMIN', 'security:alert', {
        type: 'SUSPICIOUS_ACTIVITY',
        userId,
        reason: suspicious.reason,
        timestamp: new Date(),
      });
    }
  }

  private async detectSuspiciousPatterns(
    userId: string,
    activity: Activity
  ): Promise<SuspiciousResult> {
    const patterns = [
      this.checkRapidRequests(userId),
      this.checkUnusualLocation(userId, activity.ip),
      this.checkOffHoursAccess(userId, activity.timestamp),
      this.checkMultipleFailedActions(userId),
    ];

    const results = await Promise.all(patterns);
    return results.find((r) => r.detected) || { detected: false };
  }

  private async checkRapidRequests(userId: string): Promise<SuspiciousResult> {
    const key = `requests:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 60); // 1 minuto
    }

    if (count > 100) {
      return {
        detected: true,
        type: 'RAPID_REQUESTS',
        reason: `Usuario fez ${count} requisicoes em 1 minuto`,
      };
    }

    return { detected: false };
  }
}
```

## 14. Modelo de Ameacas (STRIDE)

### 14.1 Analise STRIDE

| Categoria | Ameaca | Mitigacao |
|-----------|--------|-----------|
| **S**poofing | Falsificacao de identidade | JWT com assinatura, bcrypt para senhas, X-API-Key para N8N |
| **T**ampering | Adulteracao de dados | HTTPS/TLS, Zod validation, Prisma parametrizado |
| **R**epudiation | Negacao de acoes | Logs de auditoria imutaveis, timestamps em todas operacoes |
| **I**nformation Disclosure | Vazamento de dados | Multi-tenant isolation, AES-256, RBAC rigoroso |
| **D**enial of Service | Negacao de servico | Rate limiting, filas async, circuit breakers |
| **E**levation of Privilege | Escalacao de privilegio | RBAC, tenant isolation, validacao de ownership |

### 14.2 Diagrama de Zonas de Confianca

```
+-----------------------------------------------------------------------------+
|                              INTERNET (Nao Confiavel)                        |
|                                                                             |
|    +--------------+    +-------------+    +--------------+                  |
|    | Atacante     |    |   Cliente   |    |    Meta      |                  |
|    |              |    |  WhatsApp   |    |  Webhooks    |                  |
|    +--------------+    +-------------+    +--------------+                  |
|                                                                             |
+---------------------------------+-------------------------------------------+
                                  |
                   +--------------v--------------+
                   |          Nginx              |
                   |    (TLS, Rate Limit)        |
                   +--------------+--------------+
                                  |
+---------------------------------+-------------------------------------------+
|                           DMZ (Semi-Confiavel)                              |
|                                 |                                           |
|    +----------------------------v---------------------------+               |
|    |                     Backend API                         |              |
|    |              (Express.js + Middlewares)                 |              |
|    |  - Auth Middleware                                      |              |
|    |  - Tenant Middleware                                    |              |
|    |  - Rate Limit                                           |              |
|    |  - Zod Validation                                       |              |
|    +----------------------------+---------------------------+               |
|                                 |                                           |
+---------------------------------+-------------------------------------------+
                                  |
+---------------------------------+-------------------------------------------+
|                      REDE INTERNA (Confiavel)                               |
|                                 |                                           |
|    +------------+   +-----------+----------+   +-------------+              |
|    |            |   |                      |   |             |              |
|    | PostgreSQL |   |        Redis         |   |    N8N      |              |
|    |  (Dados)   |   |   (Cache/Sessions)   |   | (Automacao) |              |
|    |            |   |                      |   |             |              |
|    +------------+   +----------------------+   +-------------+              |
|                                                                             |
+-----------------------------------------------------------------------------+
```

## 15. Checklist de Seguranca

### 15.1 Antes do Deploy

- [ ] Todas as variaveis de ambiente configuradas
- [ ] JWT_SECRET gerado com 256+ bits de entropia
- [ ] ENCRYPTION_KEY de 32 bytes (64 hex chars)
- [ ] HTTPS configurado com certificado valido (Let's Encrypt)
- [ ] Headers de seguranca ativos (Helmet)
- [ ] Rate limiting configurado por tipo de endpoint
- [ ] CORS restrito aos dominios permitidos
- [ ] Logs de auditoria funcionando
- [ ] Multi-tenant isolation testado
- [ ] Webhook signature validation configurado

### 15.2 Monitoramento Continuo

- [ ] Alertas de tentativas de login falhadas
- [ ] Monitoramento de rate limit excedido
- [ ] Alertas de erros 5xx
- [ ] Monitoramento de uso de CPU/memoria
- [ ] Alertas de certificado proximo do vencimento
- [ ] Revisao periodica de logs de auditoria
- [ ] Monitoramento de filas (Bull Dashboard)

### 15.3 Resposta a Incidentes

```
+----------------------------------------------------------------+
|                  PLANO DE RESPOSTA A INCIDENTES                 |
+----------------------------------------------------------------+
|                                                                 |
|  1. IDENTIFICACAO                                               |
|     - Detectar e confirmar o incidente                          |
|     - Classificar severidade (P1-P4)                            |
|     - Notificar equipe de resposta                              |
|                                                                 |
|  2. CONTENCAO                                                   |
|     - Isolar sistemas afetados                                  |
|     - Bloquear IPs suspeitos                                    |
|     - Revogar tokens comprometidos                              |
|     - Preservar evidencias (logs)                               |
|                                                                 |
|  3. ERRADICACAO                                                 |
|     - Identificar causa raiz                                    |
|     - Remover acesso nao autorizado                             |
|     - Atualizar sistemas vulneraveis                            |
|     - Resetar credenciais afetadas                              |
|                                                                 |
|  4. RECUPERACAO                                                 |
|     - Restaurar sistemas a partir de backup                     |
|     - Validar integridade dos dados                             |
|     - Retomar operacoes gradualmente                            |
|     - Monitorar sinais de recorrencia                           |
|                                                                 |
|  5. LICOES APRENDIDAS                                           |
|     - Documentar incidente                                      |
|     - Realizar post-mortem                                      |
|     - Implementar melhorias                                     |
|     - Atualizar procedimentos                                   |
|                                                                 |
|  Contatos de Emergencia:                                        |
|  - Admin do Sistema: root@72.61.39.235                          |
|  - Desenvolvedor: [contato do dev]                              |
|                                                                 |
+----------------------------------------------------------------+
```

## 16. Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [LGPD - Lei 13.709/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [WhatsApp Cloud API Security](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/security)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [JWT Best Practices](https://auth0.com/blog/jwt-security-best-practices/)

---

## 17. Por que essas escolhas?

**JWT com access token de 8h e refresh de 7 dias**
15 minutos (recomendação padrão) gerava muitos refreshes e UX ruim para atendentes que ficam logados o dia todo. 8 horas cobre um turno de trabalho. Se comprometido, o atacante tem janela limitada.

**bcrypt com cost 12 em vez de 10**
Cost 10 é rápido demais em GPUs modernas. Cost 12 leva ~250ms por hash - imperceptível para usuário, mas inviável para brute force em escala.

**Rate limit de 5000 req/min para N8N**
Começamos com 100, bloqueou automações legítimas (carrosséis de 10 cards = 10 requests em sequência). Em alta temporada, com múltiplos clientes simultâneos, 100 era muito baixo.

**AES-256-GCM para tokens WhatsApp**
Tokens de acesso do WhatsApp são permanentes e dão acesso total à conta. Se o banco vazar, o atacante não pode usar os tokens sem a chave de criptografia (que fica em variável de ambiente, não no banco).

**Isolamento por Row-Level em vez de schema por tenant**
Schema por tenant complica migrations e não escala para centenas de tenants. Row-level é mais simples: toda query inclui WHERE tenantId = X. Middleware garante que nenhuma query escape sem filtro.

---

Última atualização: Dezembro de 2025

**Desenvolvido por [3ian](https://3ian.com.br)** - Soluções em Tecnologia e Automação
