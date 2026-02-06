---
name: hoteis-api
description: Criar endpoints Express para o CRM Hoteis Reserva
version: 1.0.0
author: Hoteis Reserva Team
---

# Skill: Criar Endpoint de API - CRM Hoteis Reserva

Esta skill cria endpoints Express seguindo todos os padroes do projeto.

## Quando Usar

Use `/hoteis-api` quando precisar:
- Criar um novo endpoint CRUD
- Adicionar uma rota de acao especifica
- Criar endpoints de consulta/listagem

## Estrutura de Arquivos

```
deploy-backend/src/
├── routes/
│   └── [recurso].routes.ts       # Definicao de rotas
├── controllers/
│   └── [recurso].controller.ts   # Handlers HTTP
├── services/
│   └── [recurso].service.ts      # Logica de negocio
└── validators/
    └── [recurso].validator.ts    # Schemas Zod
```

## Template de Rota

### routes/[recurso].routes.ts

```typescript
import { Router } from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware';
import { tenantMiddleware } from '@/middlewares/tenant.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { [Recurso]Controller } from '@/controllers/[recurso].controller';
import { create[Recurso]Schema, update[Recurso]Schema } from '@/validators/[recurso].validator';

const router = Router();
const controller = new [Recurso]Controller();

// Todas as rotas precisam de autenticacao e tenant
router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', validate(create[Recurso]Schema), controller.create);
router.patch('/:id', validate(update[Recurso]Schema), controller.update);
router.delete('/:id', controller.delete);

export default router;
```

## Template de Controller

### controllers/[recurso].controller.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { [Recurso]Service } from '@/services/[recurso].service';
import logger from '@/config/logger';

export class [Recurso]Controller {
  private service = new [Recurso]Service();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await this.service.list(req.tenantId!);

      logger.info({
        tenantId: req.tenantId,
        count: items.length,
      }, '[Recurso]: Listed');

      return res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await this.service.getById(req.tenantId!, id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Recurso nao encontrado' },
        });
      }

      return res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await this.service.create(req.tenantId!, req.body);

      logger.info({
        tenantId: req.tenantId,
        itemId: item.id,
      }, '[Recurso]: Created');

      return res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await this.service.update(req.tenantId!, id, req.body);

      logger.info({
        tenantId: req.tenantId,
        itemId: id,
      }, '[Recurso]: Updated');

      return res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.service.delete(req.tenantId!, id);

      logger.info({
        tenantId: req.tenantId,
        itemId: id,
      }, '[Recurso]: Deleted');

      return res.json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
}
```

## Template de Service

### services/[recurso].service.ts

```typescript
import { prisma } from '@/config/database';
import { NotFoundError } from '@/errors';

export class [Recurso]Service {
  async list(tenantId: string) {
    return prisma.[recurso].findMany({
      where: {
        tenantId, // OBRIGATORIO
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        // ... campos necessarios
        createdAt: true,
      },
    });
  }

  async getById(tenantId: string, id: string) {
    return prisma.[recurso].findFirst({
      where: {
        id,
        tenantId, // OBRIGATORIO
      },
    });
  }

  async create(tenantId: string, data: Create[Recurso]Input) {
    return prisma.[recurso].create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(tenantId: string, id: string, data: Update[Recurso]Input) {
    // Verificar se pertence ao tenant
    const existing = await this.getById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Recurso nao encontrado');
    }

    return prisma.[recurso].update({
      where: { id },
      data,
    });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.getById(tenantId, id);
    if (!existing) {
      throw new NotFoundError('Recurso nao encontrado');
    }

    // Soft delete
    return prisma.[recurso].update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

## Template de Validator

### validators/[recurso].validator.ts

```typescript
import { z } from 'zod';

export const create[Recurso]Schema = z.object({
  name: z.string().min(2).max(100),
  // ... outros campos
});

export const update[Recurso]Schema = z.object({
  name: z.string().min(2).max(100).optional(),
  // ... outros campos (todos opcionais)
});

export type Create[Recurso]Input = z.infer<typeof create[Recurso]Schema>;
export type Update[Recurso]Input = z.infer<typeof update[Recurso]Schema>;
```

## Checklist

- [ ] Autenticacao verificada com middleware
- [ ] `tenantId` filtrado em TODAS as queries
- [ ] Validacao com Zod
- [ ] Response no formato padrao `{ success, data/error }`
- [ ] Tratamento de erros com next(error)
- [ ] Logging com Pino (tenantId, itemId)
- [ ] Status HTTP corretos (200, 201, 400, 401, 404, 500)
- [ ] Rota registrada no server.ts

## Exemplo de Uso

```
/hoteis-api reservations
```

Cria endpoints CRUD para gerenciar reservas.
