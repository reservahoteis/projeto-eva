---
name: tech-nextjs
description: Melhores praticas Next.js 14 App Router - Server Components, Data Fetching, Caching, ISR, Server Actions
version: 1.0.0
---

# Next.js 14 - Melhores Praticas

## Arquitetura App Router

### Estrutura de Arquivos
```
app/
├── layout.tsx          # Root layout
├── page.tsx            # Pagina inicial
├── loading.tsx         # Suspense boundary
├── error.tsx           # Error boundary
├── not-found.tsx       # 404
├── api/
│   └── route.ts        # Route Handlers
├── (auth)/             # Route groups
│   ├── login/
│   └── register/
└── [slug]/             # Dynamic routes
    └── page.tsx
```

---

## Server Components vs Client Components

### Server Components (Padrao)
```typescript
// app/posts/page.tsx - Server Component por padrao
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60 } // ISR - 60 segundos
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### Client Components (Apenas quando necessario)
```typescript
'use client';
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

### Quando usar cada um

| Server Components | Client Components |
|-------------------|-------------------|
| Fetch data | useState, useEffect |
| Acesso direto ao banco | Event listeners (onClick) |
| Tokens/secrets | Browser APIs |
| Grandes dependencias | Interatividade |

---

## Data Fetching

### Static Generation (SSG)
```typescript
// Gerado no build time
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data}</div>;
}
```

### Incremental Static Regeneration (ISR)
```typescript
// Revalida a cada 60 segundos
export const revalidate = 60;

export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 }
  });
  return <div>{data}</div>;
}
```

### Server-Side Rendering (SSR)
```typescript
// Sempre renderiza no servidor
export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store'
  });
  return <div>{data}</div>;
}
```

### generateStaticParams (Rotas Dinamicas)
```typescript
// app/posts/[id]/page.tsx
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return posts.map((post) => ({
    id: post.id.toString(),
  }));
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`).then(r => r.json());
  return <article>{post.title}</article>;
}
```

---

## Caching e Revalidation

### Tag-based Revalidation
```typescript
// Fetch com tags
const posts = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
});

// Server Action para revalidar
'use server';
import { revalidateTag } from 'next/cache';

export async function updatePost(id: string, data: FormData) {
  await db.posts.update(id, data);
  revalidateTag('posts');
}
```

### Path-based Revalidation
```typescript
'use server';
import { revalidatePath } from 'next/cache';

export async function updateProfile() {
  await updateUser();
  revalidatePath('/profile');
}
```

---

## Server Actions

### Definicao
```typescript
// app/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  // Validacao
  if (!title || !content) {
    return { error: 'Campos obrigatorios' };
  }

  // Database
  const post = await db.posts.create({ data: { title, content } });

  // Revalidar e redirecionar
  revalidatePath('/posts');
  redirect(`/posts/${post.id}`);
}
```

### Uso em Forms
```typescript
'use client';
import { createPost } from '@/app/actions';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar'}
    </button>
  );
}

export default function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <SubmitButton />
    </form>
  );
}
```

---

## Route Handlers (API Routes)

```typescript
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';

  const posts = await db.posts.findMany({
    take: 10,
    skip: (parseInt(page) - 1) * 10,
  });

  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const post = await db.posts.create({ data: body });
  return NextResponse.json(post, { status: 201 });
}

// app/api/posts/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const post = await db.posts.findUnique({ where: { id: params.id } });

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(post);
}
```

---

## Middleware

```typescript
// middleware.ts (raiz do projeto)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Verificar autenticacao
  const token = request.cookies.get('token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Adicionar headers
  const response = NextResponse.next();
  response.headers.set('X-Custom-Header', 'value');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

---

## Error Handling

### Error Boundary
```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Algo deu errado!</h2>
      <button onClick={() => reset()}>Tentar novamente</button>
    </div>
  );
}
```

### Not Found
```typescript
// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div>
      <h2>404 - Pagina nao encontrada</h2>
      <Link href="/">Voltar ao inicio</Link>
    </div>
  );
}

// Uso programatico
import { notFound } from 'next/navigation';

export default async function PostPage({ params }) {
  const post = await db.posts.findUnique({ where: { id: params.id } });
  if (!post) notFound();
  return <article>{post.title}</article>;
}
```

---

## Loading States

```typescript
// app/posts/loading.tsx
export default function Loading() {
  return <div>Carregando...</div>;
}

// Suspense granular
import { Suspense } from 'react';

export default function Page() {
  return (
    <>
      <h1>Posts</h1>
      <Suspense fallback={<div>Carregando posts...</div>}>
        <PostList />
      </Suspense>
      <Suspense fallback={<div>Carregando comentarios...</div>}>
        <Comments />
      </Suspense>
    </>
  );
}
```

---

## Image Optimization

```typescript
import Image from 'next/image';

// Imagem estatica
import profilePic from '@/public/profile.png';

export default function Profile() {
  return (
    <Image
      src={profilePic}
      alt="Profile"
      width={200}
      height={200}
      priority // LCP optimization
      quality={75}
      placeholder="blur"
    />
  );
}

// Imagem remota
export default function PostImage({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt="Post"
      width={800}
      height={600}
      sizes="(max-width: 640px) 100vw, 640px"
      loading="lazy"
    />
  );
}
```

---

## Metadata e SEO

```typescript
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'CRM Hoteis Reserva',
    template: '%s | CRM Hoteis',
  },
  description: 'Sistema de atendimento para hoteis',
  openGraph: {
    title: 'CRM Hoteis Reserva',
    description: 'Sistema de atendimento',
    url: 'https://hoteisreserva.com.br',
    siteName: 'CRM Hoteis',
    locale: 'pt_BR',
    type: 'website',
  },
};

// Metadata dinamica
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.id);
  return {
    title: post.title,
    description: post.excerpt,
  };
}
```

---

## Checklist de Boas Praticas

- [ ] Usar Server Components por padrao
- [ ] Client Components apenas para interatividade
- [ ] Implementar ISR para dados frequentes
- [ ] Tag-based revalidation apos mutations
- [ ] Server Actions para forms
- [ ] Suspense boundaries para loading states
- [ ] Error boundaries por segmento
- [ ] Otimizar imagens com next/image
- [ ] Metadata para SEO
- [ ] Middleware para auth global
