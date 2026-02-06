---
name: tech-tanstack-query
description: Melhores praticas TanStack Query (React Query) - Cache, Mutations, Optimistic Updates, Infinite Queries
version: 1.0.0
---

# TanStack Query - Melhores Praticas

## Introducao

TanStack Query (anteriormente React Query) e uma biblioteca de gerenciamento de estado assincrono para React. Simplifica fetching, caching, sincronizacao e atualizacao de dados do servidor.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query simples
const { data, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(res => res.json()),
});

// Mutation
const mutation = useMutation({
  mutationFn: (newUser) => fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(newUser),
  }),
});
```

---

## Configuracao

### Provider Setup
```typescript
// app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minuto
            gcTime: 5 * 60 * 1000, // 5 minutos (antigo cacheTime)
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// app/layout.tsx
import { QueryProvider } from './providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

---

## Query Keys

### Estrutura de Keys
```typescript
// Chaves simples
['users']
['user', 123]

// Chaves com filtros
['users', { status: 'active', page: 1 }]
['conversations', { tenantId, status, search }]

// Hierarquia de chaves
['users']                          // Lista
['users', userId]                  // Detalhe
['users', userId, 'posts']         // Posts do usuario
['users', userId, 'posts', postId] // Post especifico
```

### Query Key Factory
```typescript
// lib/query-keys.ts
export const queryKeys = {
  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },

  // Conversations
  conversations: {
    all: ['conversations'] as const,
    lists: () => [...queryKeys.conversations.all, 'list'] as const,
    list: (filters: ConversationFilters) => [...queryKeys.conversations.lists(), filters] as const,
    details: () => [...queryKeys.conversations.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.conversations.details(), id] as const,
    messages: (id: string) => [...queryKeys.conversations.detail(id), 'messages'] as const,
  },

  // Contacts
  contacts: {
    all: ['contacts'] as const,
    list: (filters: ContactFilters) => [...queryKeys.contacts.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.contacts.all, 'detail', id] as const,
    search: (query: string) => [...queryKeys.contacts.all, 'search', query] as const,
  },
};

// Uso
const { data } = useQuery({
  queryKey: queryKeys.users.detail(userId),
  queryFn: () => getUser(userId),
});
```

---

## useQuery

### Query Basica
```typescript
import { useQuery } from '@tanstack/react-query';

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => api.users.list(filters),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Componente
function UserList() {
  const { data, isLoading, isError, error, refetch } = useUsers({ status: 'active' });

  if (isLoading) return <Skeleton />;
  if (isError) return <Error message={error.message} />;

  return (
    <ul>
      {data.users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### Query com Dependencias
```typescript
// Query que depende de outra
function useUserPosts(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.posts(userId!),
    queryFn: () => api.users.getPosts(userId!),
    enabled: !!userId, // So executa se userId existir
  });
}

// Uso
function UserProfile({ userId }: { userId?: string }) {
  const { data: user } = useUser(userId);
  const { data: posts } = useUserPosts(user?.id);

  // ...
}
```

### Query com Select
```typescript
// Transformar/filtrar dados
const { data: activeUsers } = useQuery({
  queryKey: queryKeys.users.all,
  queryFn: () => api.users.list(),
  select: (data) => data.users.filter(user => user.status === 'active'),
});

// Selecionar campo especifico
const { data: userNames } = useQuery({
  queryKey: queryKeys.users.all,
  queryFn: () => api.users.list(),
  select: (data) => data.users.map(user => user.name),
});
```

### Placeholder e Initial Data
```typescript
// Placeholder enquanto carrega
const { data } = useQuery({
  queryKey: queryKeys.users.detail(userId),
  queryFn: () => api.users.get(userId),
  placeholderData: {
    id: userId,
    name: 'Carregando...',
    email: '',
  },
});

// Dados iniciais do cache
const { data } = useQuery({
  queryKey: queryKeys.users.detail(userId),
  queryFn: () => api.users.get(userId),
  initialData: () => {
    // Pega da lista em cache
    const users = queryClient.getQueryData<User[]>(queryKeys.users.all);
    return users?.find(user => user.id === userId);
  },
  initialDataUpdatedAt: () =>
    queryClient.getQueryState(queryKeys.users.all)?.dataUpdatedAt,
});
```

---

## useMutation

### Mutation Basica
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserInput) => api.users.create(data),
    onSuccess: () => {
      // Invalida cache para refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Componente
function CreateUserForm() {
  const createUser = useCreateUser();

  const onSubmit = (data: CreateUserInput) => {
    createUser.mutate(data, {
      onSuccess: () => {
        toast.success('Usuario criado!');
        reset();
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* campos */}
      <button type="submit" disabled={createUser.isPending}>
        {createUser.isPending ? 'Salvando...' : 'Criar'}
      </button>
    </form>
  );
}
```

### Mutation com Optimistic Update
```typescript
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      api.users.update(id, data),

    onMutate: async ({ id, data }) => {
      // Cancela queries em andamento
      await queryClient.cancelQueries({ queryKey: queryKeys.users.detail(id) });

      // Snapshot do valor anterior
      const previousUser = queryClient.getQueryData<User>(queryKeys.users.detail(id));

      // Atualiza otimisticamente
      queryClient.setQueryData<User>(queryKeys.users.detail(id), (old) => ({
        ...old!,
        ...data,
      }));

      // Retorna contexto para rollback
      return { previousUser };
    },

    onError: (err, { id }, context) => {
      // Rollback em caso de erro
      if (context?.previousUser) {
        queryClient.setQueryData(queryKeys.users.detail(id), context.previousUser);
      }
      toast.error('Erro ao atualizar usuario');
    },

    onSettled: (data, error, { id }) => {
      // Sempre invalida para sincronizar
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
    },
  });
}
```

### Mutation com Optimistic Update em Lista
```typescript
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.users.delete(userId),

    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.all });

      const previousUsers = queryClient.getQueryData<User[]>(queryKeys.users.all);

      // Remove otimisticamente da lista
      queryClient.setQueryData<User[]>(queryKeys.users.all, (old) =>
        old?.filter((user) => user.id !== userId)
      );

      return { previousUsers };
    },

    onError: (err, userId, context) => {
      queryClient.setQueryData(queryKeys.users.all, context?.previousUsers);
      toast.error('Erro ao excluir usuario');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
```

---

## Infinite Queries

### Lista Infinita
```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

interface MessagesResponse {
  messages: Message[];
  nextCursor?: string;
  hasMore: boolean;
}

export function useConversationMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId),
    queryFn: ({ pageParam }) =>
      api.messages.list(conversationId, { cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    getPreviousPageParam: (firstPage) => firstPage.prevCursor,
  });
}

// Componente
function MessageList({ conversationId }: { conversationId: string }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useConversationMessages(conversationId);

  // Flatten todas as paginas
  const messages = data?.pages.flatMap((page) => page.messages) ?? [];

  return (
    <div>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
```

### Infinite Query com Scroll Infinito
```typescript
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';

function InfiniteMessageList({ conversationId }: { conversationId: string }) {
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversationMessages(conversationId);

  // Busca automaticamente quando scroll atinge o fim
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const messages = data?.pages.flatMap((page) => page.messages) ?? [];

  return (
    <div className="overflow-y-auto max-h-[600px]">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {/* Elemento sentinela */}
      <div ref={ref} className="h-4" />

      {isFetchingNextPage && <LoadingSpinner />}
    </div>
  );
}
```

---

## Prefetching

### Prefetch no Hover
```typescript
export function UserCard({ user }: { user: UserSummary }) {
  const queryClient = useQueryClient();

  const prefetchUser = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.detail(user.id),
      queryFn: () => api.users.get(user.id),
      staleTime: 5 * 60 * 1000,
    });
  };

  return (
    <Link
      href={`/users/${user.id}`}
      onMouseEnter={prefetchUser}
      onFocus={prefetchUser}
    >
      {user.name}
    </Link>
  );
}
```

### Prefetch em Server Component (Next.js)
```typescript
// app/users/page.tsx
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { UserList } from './user-list';

export default async function UsersPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.users.list({ page: 1 }),
    queryFn: () => api.users.list({ page: 1 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserList />
    </HydrationBoundary>
  );
}
```

---

## Polling e Refetch

### Polling Automatico
```typescript
// Atualiza a cada 30 segundos
const { data } = useQuery({
  queryKey: queryKeys.conversations.list(filters),
  queryFn: () => api.conversations.list(filters),
  refetchInterval: 30 * 1000,
  refetchIntervalInBackground: false, // Pausa quando aba inativa
});
```

### Refetch Condicional
```typescript
const { data, refetch } = useQuery({
  queryKey: queryKeys.conversations.detail(id),
  queryFn: () => api.conversations.get(id),
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});

// Refetch manual
<button onClick={() => refetch()}>Atualizar</button>
```

---

## Invalidacao de Cache

### Invalidar Queries
```typescript
const queryClient = useQueryClient();

// Invalida todas queries que comecam com ['users']
queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

// Invalida query especifica
queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });

// Invalida com predicado
queryClient.invalidateQueries({
  predicate: (query) =>
    query.queryKey[0] === 'users' &&
    (query.queryKey[1] as any)?.status === 'active',
});

// Invalida queries exatas
queryClient.invalidateQueries({
  queryKey: queryKeys.users.detail(userId),
  exact: true,
});
```

### Atualizar Cache Diretamente
```typescript
// Setar dados
queryClient.setQueryData(queryKeys.users.detail(userId), newUserData);

// Atualizar dados existentes
queryClient.setQueryData<User>(queryKeys.users.detail(userId), (old) => ({
  ...old!,
  name: 'Novo Nome',
}));

// Remover do cache
queryClient.removeQueries({ queryKey: queryKeys.users.detail(userId) });
```

---

## Error Handling

### Error Boundary Global
```typescript
// providers.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true, // Propaga erros para Error Boundary
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        // Ja tinha dados, erro e de background refetch
        toast.error(`Erro ao atualizar: ${error.message}`);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  }),
});
```

### Error Handling por Query
```typescript
const { data, error, isError } = useQuery({
  queryKey: queryKeys.users.detail(userId),
  queryFn: () => api.users.get(userId),
  retry: (failureCount, error) => {
    // Nao tenta novamente para 404
    if (error.status === 404) return false;
    return failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});

if (isError) {
  if (error.status === 404) {
    return <NotFound />;
  }
  return <ErrorMessage error={error} />;
}
```

---

## Custom Hooks Patterns

### Hook Completo com CRUD
```typescript
// hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => api.users.list(filters),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => api.users.get(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.users.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('Usuario criado com sucesso!');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      api.users.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      toast.success('Usuario atualizado!');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.users.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('Usuario excluido!');
    },
  });
}
```

### Hook com Estado Derivado
```typescript
export function useConversationStats(tenantId: string) {
  const { data: conversations } = useConversations({ tenantId });

  const stats = useMemo(() => {
    if (!conversations) return null;

    return {
      total: conversations.length,
      pending: conversations.filter(c => c.status === 'PENDING').length,
      open: conversations.filter(c => c.status === 'OPEN').length,
      resolved: conversations.filter(c => c.status === 'RESOLVED').length,
    };
  }, [conversations]);

  return stats;
}
```

---

## Parallel e Dependent Queries

### Queries Paralelas
```typescript
import { useQueries } from '@tanstack/react-query';

function Dashboard({ userIds }: { userIds: string[] }) {
  const userQueries = useQueries({
    queries: userIds.map((id) => ({
      queryKey: queryKeys.users.detail(id),
      queryFn: () => api.users.get(id),
    })),
  });

  const isLoading = userQueries.some((q) => q.isLoading);
  const users = userQueries.map((q) => q.data).filter(Boolean);

  // ...
}
```

### Queries Dependentes
```typescript
function useUserWithPosts(userId: string) {
  const userQuery = useQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => api.users.get(userId),
  });

  const postsQuery = useQuery({
    queryKey: queryKeys.users.posts(userId),
    queryFn: () => api.posts.getByUser(userId),
    enabled: !!userQuery.data, // So executa apos user carregar
  });

  return {
    user: userQuery.data,
    posts: postsQuery.data,
    isLoading: userQuery.isLoading || postsQuery.isLoading,
  };
}
```

---

## Suspense Mode

### Query com Suspense
```typescript
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

function UserProfile({ userId }: { userId: string }) {
  // Automaticamente suspende ate dados carregarem
  const { data: user } = useSuspenseQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => api.users.get(userId),
  });

  // data sempre definido aqui (nao precisa de loading check)
  return <div>{user.name}</div>;
}

// Wrapper com Suspense
function UserPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserProfile userId={userId} />
    </Suspense>
  );
}
```

---

## Offline Support

### Persistir Cache
```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 horas
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 horas
});
```

### Mutations Offline
```typescript
import { onlineManager } from '@tanstack/react-query';

// Detectar status online
const isOnline = onlineManager.isOnline();

// Mutation que funciona offline
const mutation = useMutation({
  mutationFn: api.messages.send,
  networkMode: 'offlineFirst', // Executa mesmo offline
  onMutate: async (newMessage) => {
    // Salva localmente primeiro
    await saveToLocalStorage(newMessage);
  },
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

---

## Checklist de Boas Praticas

- [ ] Usar query key factory para consistencia
- [ ] Implementar staleTime adequado ao caso de uso
- [ ] Usar optimistic updates para UX responsiva
- [ ] Invalidar cache apos mutations
- [ ] Implementar prefetch para navegacao rapida
- [ ] Usar select para transformar/filtrar dados
- [ ] Configurar retry strategy por tipo de erro
- [ ] Implementar error boundaries
- [ ] Usar Suspense mode quando apropriado
- [ ] Configurar DevTools em desenvolvimento
