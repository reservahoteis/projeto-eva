---
name: tech-jwt
description: Melhores praticas JWT Auth - Access/Refresh Tokens, Seguranca, Middleware
version: 1.0.0
---

# JWT Authentication - Melhores Praticas

## Geracao de Tokens

```typescript
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  tenantId: string;
  role: string;
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

// Gerar access token (curta duracao)
function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: '15m',
    issuer: 'crm-hoteis',
    audience: 'crm-hoteis-api',
  });
}

// Gerar refresh token (longa duracao)
function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
    issuer: 'crm-hoteis',
    audience: 'crm-hoteis-api',
  });
}

// Gerar par de tokens
function generateTokens(payload: TokenPayload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: 15 * 60, // 15 minutos em segundos
  };
}
```

---

## Verificacao de Tokens

```typescript
// Verificar access token
function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: 'crm-hoteis',
      audience: 'crm-hoteis-api',
    }) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

// Verificar refresh token
function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET, {
    issuer: 'crm-hoteis',
    audience: 'crm-hoteis-api',
  }) as TokenPayload;
}

// Decodificar sem verificar (para debug)
function decodeToken(token: string) {
  return jwt.decode(token, { complete: true });
}
```

---

## Middleware de Autenticacao

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  userId: string;
  tenantId: string;
  role: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token not provided' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.tenantId = payload.tenantId;
    req.role = payload.role;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message },
    });
  }
}

// Middleware de roles
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
    next();
  };
}

// Uso nas rotas
router.get('/users', authMiddleware, requireRole('ADMIN'), listUsers);
router.get('/profile', authMiddleware, getProfile);
```

---

## Endpoints de Auth

```typescript
// Login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
  }

  const tokens = generateTokens({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  // Salvar refresh token no banco (para revogacao)
  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({ success: true, data: tokens });
});

// Refresh token
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Refresh token required' },
    });
  }

  // Verificar se token existe e nao foi revogado
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
    });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    // Rotacao de refresh token
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });

    const newTokens = generateTokens({
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
    });

    await prisma.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        userId: payload.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ success: true, data: newTokens });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' },
    });
  }
});

// Logout
router.post('/auth/logout', authMiddleware, async (req: AuthRequest, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken, userId: req.userId },
      data: { revokedAt: new Date() },
    });
  }

  res.json({ success: true, data: null });
});

// Logout de todos dispositivos
router.post('/auth/logout-all', authMiddleware, async (req: AuthRequest, res) => {
  await prisma.refreshToken.updateMany({
    where: { userId: req.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  res.json({ success: true, data: null });
});
```

---

## Schema Prisma

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  token     String    @unique
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([token])
}
```

---

## Cliente (React/Next.js)

```typescript
// lib/auth.ts
import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isTokenExpired(token: string): boolean {
  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    return Date.now() >= exp * 1000 - 60000; // 1 min de margem
  } catch {
    return true;
  }
}

// Fetch com refresh automatico
export async function authFetch(url: string, options: RequestInit = {}) {
  let accessToken = getAccessToken();

  if (accessToken && isTokenExpired(accessToken)) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      const newTokens = await refreshAccessToken(refreshToken);
      if (newTokens) {
        setTokens(newTokens.accessToken, newTokens.refreshToken);
        accessToken = newTokens.accessToken;
      } else {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
    },
  });
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;
  const { data } = await response.json();
  return data;
}
```

---

## Seguranca

```typescript
// Usar secrets fortes
// ACCESS_TOKEN_SECRET=<256+ bits aleatorios>
// REFRESH_TOKEN_SECRET=<256+ bits aleatorios diferentes>

// Nao armazenar dados sensiveis no payload
// BAD: { userId, password, creditCard }
// GOOD: { userId, tenantId, role }

// Validar claims importantes
jwt.verify(token, secret, {
  issuer: 'crm-hoteis',      // Validar emissor
  audience: 'crm-hoteis-api', // Validar audiencia
  algorithms: ['HS256'],      // Restringir algoritmos
});

// Rate limiting no refresh
import rateLimit from 'express-rate-limit';

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many refresh attempts' },
});

router.post('/auth/refresh', refreshLimiter, refreshHandler);
```

---

## Checklist

- [ ] Access token com expiracao curta (15min)
- [ ] Refresh token com expiracao longa (7 dias)
- [ ] Armazenar refresh tokens no banco
- [ ] Implementar rotacao de refresh tokens
- [ ] Validar issuer e audience
- [ ] Nao incluir dados sensiveis no payload
- [ ] Rate limiting em endpoints de auth
- [ ] Logout revoga refresh tokens
- [ ] Usar HTTPS em producao
- [ ] Secrets com pelo menos 256 bits
