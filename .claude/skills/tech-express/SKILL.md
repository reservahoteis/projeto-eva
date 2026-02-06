---
name: tech-express
description: Melhores praticas Express.js - Middlewares, Routing, Error Handling, Security
version: 1.0.0
---

# Express.js - Melhores Praticas

## Estrutura de Projeto

```
src/
├── config/
│   ├── database.ts
│   ├── logger.ts
│   └── env.ts
├── middlewares/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   ├── validate.middleware.ts
│   └── tenant.middleware.ts
├── routes/
│   ├── index.ts
│   ├── users.routes.ts
│   └── posts.routes.ts
├── controllers/
│   ├── users.controller.ts
│   └── posts.controller.ts
├── services/
│   ├── users.service.ts
│   └── posts.service.ts
├── validators/
│   ├── users.validator.ts
│   └── posts.validator.ts
├── errors/
│   └── index.ts
├── types/
│   └── express.d.ts
└── server.ts
```

---

## Routing

### Rotas Basicas
```typescript
import { Router } from 'express';

const router = Router();

// GET
router.get('/', (req, res) => {
  res.json({ message: 'Lista' });
});

// GET com parametro
router.get('/:id', (req, res) => {
  const { id } = req.params;
  res.json({ id });
});

// POST
router.post('/', (req, res) => {
  const body = req.body;
  res.status(201).json(body);
});

// PATCH
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body;
  res.json({ id, ...body });
});

// DELETE
router.delete('/:id', (req, res) => {
  res.json({ success: true });
});

export default router;
```

### Rotas Encadeadas
```typescript
router.route('/users')
  .get(listUsers)
  .post(validate(createUserSchema), createUser);

router.route('/users/:id')
  .get(getUser)
  .patch(validate(updateUserSchema), updateUser)
  .delete(deleteUser);
```

### Query Parameters
```typescript
router.get('/search', (req, res) => {
  const { q, page = '1', limit = '10' } = req.query;

  res.json({
    query: q,
    page: parseInt(page as string),
    limit: parseInt(limit as string),
  });
});
```

---

## Middlewares

### Middleware Global
```typescript
// server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

### Authentication Middleware
```typescript
// middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
  tenantId?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token nao fornecido' },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      tenantId: string;
    };

    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token invalido' },
    });
  }
};
```

### Validation Middleware
```typescript
// middlewares/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados invalidos',
          details: error.errors,
        },
      });
    }
  };
};
```

### Tenant Middleware (Multi-tenant)
```typescript
// middlewares/tenant.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const tenantMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      error: { code: 'TENANT_REQUIRED', message: 'Tenant nao identificado' },
    });
  }
  next();
};
```

---

## Controllers

### Padrao Controller
```typescript
// controllers/users.controller.ts
import { Request, Response, NextFunction } from 'express';
import { UsersService } from '@/services/users.service';
import logger from '@/config/logger';

export class UsersController {
  private service = new UsersService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req as any;
      const { page = '1', limit = '10' } = req.query;

      const result = await this.service.list(tenantId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      logger.info({ tenantId, count: result.data.length }, 'Users: Listed');

      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req as any;
      const { id } = req.params;

      const user = await this.service.getById(tenantId, id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Usuario nao encontrado' },
        });
      }

      return res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req as any;
      const user = await this.service.create(tenantId, req.body);

      logger.info({ tenantId, userId: user.id }, 'Users: Created');

      return res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req as any;
      const { id } = req.params;

      const user = await this.service.update(tenantId, id, req.body);

      logger.info({ tenantId, userId: id }, 'Users: Updated');

      return res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req as any;
      const { id } = req.params;

      await this.service.delete(tenantId, id);

      logger.info({ tenantId, userId: id }, 'Users: Deleted');

      return res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
}
```

---

## Error Handling

### Custom Errors
```typescript
// errors/index.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso nao encontrado') {
    super(404, 'NOT_FOUND', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Nao autorizado') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados invalidos', public details?: any) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de dados') {
    super(409, 'CONFLICT', message);
  }
}
```

### Error Handler Middleware
```typescript
// middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/errors';
import logger from '@/config/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log do erro
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // AppError (erros conhecidos)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && { details: err.details }),
      },
    });
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;

    if (prismaError.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE', message: 'Registro ja existe' },
      });
    }

    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Registro nao encontrado' },
      });
    }
  }

  // Erro generico (nao expor detalhes em producao)
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : err.message,
    },
  });
};

// 404 Handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Rota nao encontrada' },
  });
};
```

---

## Response Patterns

### Formato Padrao
```typescript
// Sucesso com dados
{
  "success": true,
  "data": { ... }
}

// Sucesso com paginacao
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}

// Erro
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados invalidos",
    "details": [...]
  }
}
```

### Helper Functions
```typescript
// utils/response.ts
import { Response } from 'express';

export const success = (res: Response, data: any, status = 200) => {
  return res.status(status).json({ success: true, data });
};

export const paginated = (
  res: Response,
  data: any[],
  meta: { total: number; page: number; limit: number }
) => {
  return res.json({
    success: true,
    data,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });
};

export const error = (
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: any
) => {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details && { details }) },
  });
};
```

---

## Security

### Helmet
```typescript
import helmet from 'helmet';

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
}));
```

### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Muitas requisicoes' },
  },
});

app.use('/api', limiter);

// Rate limit especifico para auth
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 tentativas
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', authLimiter);
```

### CORS
```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## Server Setup

```typescript
// server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from '@/middlewares/error.middleware';
import routes from '@/routes';
import logger from '@/config/logger';

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

// Body parsing
app.use(express.json({ limit: '10kb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
```

---

## Checklist de Boas Praticas

- [ ] Estrutura modular (routes, controllers, services)
- [ ] Middlewares de autenticacao e validacao
- [ ] Error handling centralizado
- [ ] Response format padronizado
- [ ] Rate limiting
- [ ] Helmet para security headers
- [ ] CORS configurado
- [ ] Logging estruturado
- [ ] Health check endpoint
- [ ] Graceful shutdown
