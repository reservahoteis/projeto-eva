---
name: hoteis-component
description: Criar componentes React/UI para o CRM Hoteis Reserva
version: 1.0.0
author: Hoteis Reserva Team
---

# Skill: Criar Componente UI - CRM Hoteis Reserva

Esta skill cria componentes React seguindo os padroes do projeto.

## Quando Usar

Use `/hoteis-component` quando precisar:
- Criar um novo componente de UI
- Criar um componente de formulario
- Criar componentes de listagem/tabela
- Criar modais e dialogs

## Estrutura de Arquivos

```
frontend/src/
├── components/
│   ├── ui/                    # Componentes base (Button, Input, etc)
│   ├── forms/                 # Componentes de formulario
│   ├── tables/                # Tabelas e listagens
│   └── modals/                # Dialogs e modais
├── hooks/
│   └── use[Recurso].ts        # Custom hooks
└── types/
    └── [recurso].ts           # Types e interfaces
```

## Template de Componente Base

### components/ui/[Component].tsx

```typescript
'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface [Component]Props extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const [Component] = forwardRef<HTMLDivElement, [Component]Props>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'base-classes',
          variant === 'default' && 'bg-white dark:bg-gray-800',
          variant === 'outline' && 'border border-gray-200 dark:border-gray-700',
          size === 'sm' && 'p-2 text-sm',
          size === 'md' && 'p-4 text-base',
          size === 'lg' && 'p-6 text-lg',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

[Component].displayName = '[Component]';
```

## Template de Formulario

### components/forms/[Recurso]Form.tsx

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreate[Recurso], useUpdate[Recurso] } from '@/hooks/use[Recurso]';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido').optional(),
});

type FormData = z.infer<typeof formSchema>;

interface [Recurso]FormProps {
  initialData?: FormData;
  onSuccess?: () => void;
}

export function [Recurso]Form({ initialData, onSuccess }: [Recurso]FormProps) {
  const isEditing = !!initialData;
  const createMutation = useCreate[Recurso]();
  const updateMutation = useUpdate[Recurso]();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || { name: '', email: '' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
      onSuccess?.();
    } catch (error) {
      // Erro tratado pelo hook
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nome</label>
        <Input {...form.register('name')} disabled={isPending} />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <Input {...form.register('email')} type="email" disabled={isPending} />
        {form.formState.errors.email && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
      </Button>
    </form>
  );
}
```

## Template de Tabela

### components/tables/[Recurso]Table.tsx

```typescript
'use client';

import { useState } from 'react';
import { MoreHorizontal, Edit, Trash } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useDelete[Recurso] } from '@/hooks/use[Recurso]';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface [Recurso] {
  id: string;
  name: string;
  createdAt: string;
}

interface [Recurso]TableProps {
  data: [Recurso][];
  onEdit: (item: [Recurso]) => void;
}

export function [Recurso]Table({ data, onEdit }: [Recurso]TableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteMutation = useDelete[Recurso]();

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Nome</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Criado em</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="p-2 hover:bg-gray-100 rounded">
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content className="bg-white shadow-lg rounded-lg p-1">
                      <DropdownMenu.Item
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded cursor-pointer"
                        onSelect={() => onEdit(item)}
                      >
                        <Edit size={14} /> Editar
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                        onSelect={() => setDeleteId(item.id)}
                      >
                        <Trash size={14} /> Excluir
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Excluir item"
        description="Tem certeza que deseja excluir este item?"
      />
    </>
  );
}
```

## Template de Modal

### components/modals/[Recurso]Modal.tsx

```typescript
'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { [Recurso]Form } from '@/components/forms/[Recurso]Form';

interface [Recurso]ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
}

export function [Recurso]Modal({ open, onOpenChange, initialData }: [Recurso]ModalProps) {
  const title = initialData ? 'Editar [Recurso]' : 'Novo [Recurso]';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-lg p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold mb-4">
            {title}
          </Dialog.Title>

          <[Recurso]Form
            initialData={initialData}
            onSuccess={() => onOpenChange(false)}
          />

          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

## Template de Hook

### hooks/use[Recurso].ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';

export function use[Recurso]s() {
  return useQuery({
    queryKey: ['[recurso]s'],
    queryFn: () => api.get('/[recurso]s').then(r => r.data),
  });
}

export function useCreate[Recurso]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.post('/[recurso]s', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[recurso]s'] });
      toast.success('[Recurso] criado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar [recurso]');
    },
  });
}

export function useUpdate[Recurso]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/[recurso]s/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[recurso]s'] });
      toast.success('[Recurso] atualizado!');
    },
  });
}

export function useDelete[Recurso]() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.delete(`/[recurso]s/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[recurso]s'] });
      toast.success('[Recurso] excluido!');
    },
  });
}
```

## Checklist

- [ ] Usar 'use client' quando necessario
- [ ] Usar forwardRef para componentes base
- [ ] Tipar todas as props com interfaces
- [ ] Usar cn() para classes condicionais
- [ ] Dark mode em todas as cores
- [ ] Estados de loading/disabled
- [ ] Validacao com Zod nos forms
- [ ] TanStack Query para data fetching
- [ ] Radix UI para interacoes acessiveis

## Exemplo de Uso

```
/hoteis-component ContactCard
```

Cria componente de card para exibir contatos.
