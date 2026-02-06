---
name: hoteis-feature
description: Criar features completas (backend + frontend) para o CRM Hoteis Reserva
version: 1.0.0
author: Hoteis Reserva Team
---

# Skill: Criar Feature Completa - CRM Hoteis Reserva

Esta skill cria features end-to-end seguindo os padroes do projeto.

## Quando Usar

Use `/hoteis-feature` quando precisar:
- Criar uma feature completa (backend + frontend)
- Implementar um novo modulo do sistema
- Adicionar funcionalidade com multiplos arquivos

## Arquivos a Criar

```
1. Backend (deploy-backend/src/)
   ├── routes/[recurso].routes.ts
   ├── controllers/[recurso].controller.ts
   ├── services/[recurso].service.ts
   └── validators/[recurso].validator.ts

2. Frontend (frontend/src/)
   ├── app/(dashboard)/[recurso]/page.tsx
   ├── components/[recurso]/
   │   ├── [Recurso]Form.tsx
   │   ├── [Recurso]Table.tsx
   │   └── [Recurso]Modal.tsx
   └── hooks/use[Recurso].ts

3. Database (se necessario)
   └── prisma/migrations/
```

## Passo 1: Schema Prisma (se novo modelo)

```prisma
model [Recurso] {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}
```

## Passo 2: Validator (Backend)

```typescript
// deploy-backend/src/validators/[recurso].validator.ts
import { z } from 'zod';

export const create[Recurso]Schema = z.object({
  name: z.string().min(2).max(100),
});

export const update[Recurso]Schema = create[Recurso]Schema.partial();

export type Create[Recurso]Input = z.infer<typeof create[Recurso]Schema>;
export type Update[Recurso]Input = z.infer<typeof update[Recurso]Schema>;
```

## Passo 3: Service (Backend)

```typescript
// deploy-backend/src/services/[recurso].service.ts
import { prisma } from '@/config/database';
import { NotFoundError } from '@/errors';

export class [Recurso]Service {
  async list(tenantId: string) {
    return prisma.[recurso].findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(tenantId: string, id: string) {
    return prisma.[recurso].findFirst({
      where: { id, tenantId },
    });
  }

  async create(tenantId: string, data: Create[Recurso]Input) {
    return prisma.[recurso].create({
      data: { ...data, tenantId },
    });
  }

  async update(tenantId: string, id: string, data: Update[Recurso]Input) {
    const existing = await this.getById(tenantId, id);
    if (!existing) throw new NotFoundError();

    return prisma.[recurso].update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.getById(tenantId, id);
    if (!existing) throw new NotFoundError();

    return prisma.[recurso].update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

## Passo 4: Controller (Backend)

```typescript
// deploy-backend/src/controllers/[recurso].controller.ts
import { Request, Response, NextFunction } from 'express';
import { [Recurso]Service } from '@/services/[recurso].service';
import logger from '@/config/logger';

export class [Recurso]Controller {
  private service = new [Recurso]Service();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await this.service.list(req.tenantId!);
      logger.info({ tenantId: req.tenantId, count: items.length }, '[Recurso]: Listed');
      return res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  };

  // ... getById, create, update, delete (ver hoteis-api)
}
```

## Passo 5: Routes (Backend)

```typescript
// deploy-backend/src/routes/[recurso].routes.ts
import { Router } from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware';
import { tenantMiddleware } from '@/middlewares/tenant.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { [Recurso]Controller } from '@/controllers/[recurso].controller';
import { create[Recurso]Schema, update[Recurso]Schema } from '@/validators/[recurso].validator';

const router = Router();
const controller = new [Recurso]Controller();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', validate(create[Recurso]Schema), controller.create);
router.patch('/:id', validate(update[Recurso]Schema), controller.update);
router.delete('/:id', controller.delete);

export default router;
```

## Passo 6: Hook (Frontend)

```typescript
// frontend/src/hooks/use[Recurso].ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';

const QUERY_KEY = ['[recurso]s'];

export function use[Recurso]s() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get('/[recurso]s').then(r => r.data.data),
  });
}

export function useCreate[Recurso]() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/[recurso]s', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Criado com sucesso!');
    },
  });
}

export function useUpdate[Recurso]() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/[recurso]s/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Atualizado!');
    },
  });
}

export function useDelete[Recurso]() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/[recurso]s/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Excluido!');
    },
  });
}
```

## Passo 7: Page (Frontend)

```typescript
// frontend/src/app/(dashboard)/[recurso]/page.tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { [Recurso]Table } from '@/components/[recurso]/[Recurso]Table';
import { [Recurso]Modal } from '@/components/[recurso]/[Recurso]Modal';
import { use[Recurso]s } from '@/hooks/use[Recurso]';

export default function [Recurso]Page() {
  const { data, isLoading } = use[Recurso]s();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const handleEdit = (item) => {
    setEditItem(item);
    setModalOpen(true);
  };

  const handleClose = () => {
    setEditItem(null);
    setModalOpen(false);
  };

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">[Recurso]s</h1>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} className="mr-2" /> Novo
        </Button>
      </div>

      <[Recurso]Table data={data || []} onEdit={handleEdit} />

      <[Recurso]Modal
        open={modalOpen}
        onOpenChange={handleClose}
        initialData={editItem}
      />
    </div>
  );
}
```

## Registrar Rota no Server

```typescript
// deploy-backend/src/server.ts
import [recurso]Routes from '@/routes/[recurso].routes';

app.use('/api/[recurso]s', [recurso]Routes);
```

## Checklist

### Backend
- [ ] Schema Prisma criado e migrado
- [ ] Validator com Zod
- [ ] Service com todas operacoes CRUD
- [ ] Controller com logging
- [ ] Routes com middlewares (auth, tenant, validate)
- [ ] Rota registrada no server.ts

### Frontend
- [ ] Hook com TanStack Query
- [ ] Page com listagem
- [ ] Tabela com acoes
- [ ] Modal de criar/editar
- [ ] Formulario com validacao
- [ ] Toast de feedback

## Exemplo de Uso

```
/hoteis-feature tags
```

Cria feature completa de gerenciamento de tags.
