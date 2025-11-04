# Frontend - CRM WhatsApp SaaS

Frontend desenvolvido com Next.js 14, TypeScript e TailwindCSS para o sistema Multi-Tenant de CRM para WhatsApp Business.

## 🚀 Stack Tecnológica

- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript (strict mode)
- **Estilização:** TailwindCSS + Shadcn/ui
- **State Management:**
  - React Query (server state)
  - Zustand (client state - opcional)
- **Formulários:** React Hook Form + Zod
- **Comunicação:** Axios
- **Real-time:** Socket.io Client (preparado)
- **UI Components:** Radix UI + Lucide Icons

## 📁 Estrutura do Projeto

```
src/
├── app/                          # Next.js App Router
│   ├── login/                    # Página de login
│   ├── unauthorized/             # Página de acesso negado
│   ├── super-admin/              # Painel Super Admin
│   │   ├── tenants/              # Gerenciamento de tenants
│   │   └── settings/             # Configurações
│   └── dashboard/                # Painel Tenant (CRM)
│       ├── page.tsx              # Dashboard principal
│       ├── conversations/        # Conversas (Kanban + Chat)
│       ├── contacts/             # Gestão de contatos
│       ├── users/                # Gestão de usuários
│       ├── settings/             # Configurações
│       └── reports/              # Relatórios
│
├── components/
│   ├── ui/                       # Componentes Shadcn/ui
│   ├── layout/                   # Layouts e sidebars
│   ├── super-admin/              # Componentes do Super Admin
│   └── tenant/                   # Componentes do CRM Tenant
│
├── contexts/
│   └── auth-context.tsx          # Context de autenticação
│
├── services/                     # Serviços da API
│   ├── auth.service.ts
│   ├── tenant.service.ts
│   ├── conversation.service.ts
│   └── message.service.ts
│
├── lib/
│   ├── axios.ts                  # Configuração Axios
│   └── utils.ts                  # Funções utilitárias
│
└── types/
    └── index.ts                  # TypeScript types
```

## 🎨 Funcionalidades Implementadas

### Super Admin
- ✅ Dashboard de gerenciamento de tenants
- ✅ Criar novos tenants (hotéis)
- ✅ Visualizar estatísticas de todos os tenants
- ✅ Gerenciar status e planos
- ✅ Sidebar com navegação

### Tenant CRM
- ✅ Dashboard com estatísticas de conversas
- ✅ **Kanban Board** - Visualização drag-and-drop de conversas
- ✅ **Interface de Chat** - Estilo WhatsApp Web
- ✅ Gestão de contatos
- ✅ Gestão de usuários (Admin only)
- ✅ Configurações do WhatsApp
- ✅ Relatórios e métricas
- ✅ Sistema de autenticação completo
- ✅ Protected routes com RBAC

### Componentes Reutilizáveis
- ✅ 10+ componentes UI (Button, Card, Badge, Avatar, Dialog, etc)
- ✅ ConversationCard - Card de conversa com ações
- ✅ KanbanBoard - Board com drag-and-drop
- ✅ ChatInterface - Interface de mensagens
- ✅ ContactSidebar - Sidebar com informações do contato

## 🔧 Como Rodar

### 1. Instalar dependências

```bash
cd apps/frontend
pnpm install
```

### 2. Configurar variáveis de ambiente

Edite o arquivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
NODE_ENV=development
```

### 3. Rodar o servidor de desenvolvimento

```bash
pnpm dev
```

O frontend estará disponível em: **http://localhost:3000**

### 4. Build para produção

```bash
pnpm build
pnpm start
```

## 🔐 Autenticação

O sistema usa JWT com refresh tokens:

1. Login em `/login`
2. Token salvo no `localStorage`
3. Axios interceptor adiciona o token automaticamente
4. Refresh automático quando o token expira
5. Redirect para login se não autenticado

### Fluxo de Autenticação

```typescript
// 1. Usuário faz login
await authService.login(email, password);

// 2. Token é salvo
localStorage.setItem('accessToken', token);

// 3. Todas as requests incluem o token
axios.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 4. Se token expirar (401), tenta refresh
if (response.status === 401) {
  const newToken = await authService.refresh(refreshToken);
  // Retry original request
}
```

## 🎯 Rotas e Permissões

### Públicas
- `/login` - Login
- `/unauthorized` - Acesso negado

### Super Admin Only
- `/super-admin/tenants` - Gerenciar tenants
- `/super-admin/settings` - Configurações

### Tenant (Admin + Attendant)
- `/dashboard` - Dashboard principal
- `/dashboard/conversations` - Conversas (Kanban/Lista)
- `/dashboard/conversations/[id]` - Chat individual
- `/dashboard/contacts` - Contatos

### Tenant Admin Only
- `/dashboard/users` - Gestão de usuários
- `/dashboard/settings` - Configurações
- `/dashboard/reports` - Relatórios

## 📱 Multi-Tenant

O sistema detecta o tenant automaticamente pelo subdomínio:

```typescript
// hotelcopacabana.seucrm.com
const hostname = window.location.hostname;
const tenant = hostname.split('.')[0]; // "hotelcopacabana"

// Adiciona tenant em todas as requests
axios.interceptors.request.use((config) => {
  config.params = { ...config.params, tenant };
  return config;
});
```

### Estrutura de Subdomínios

- `super-admin.seucrm.com` → Super Admin Panel
- `hotelcopacabana.seucrm.com` → Tenant "hotelcopacabana"
- `hotelbotafogo.seucrm.com` → Tenant "hotelbotafogo"

## 🎨 Customização de Tema

O projeto usa CSS Variables para temas:

```css
/* globals.css */
:root {
  --primary: 142 76% 36%;        /* Verde WhatsApp */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... */
}

.dark {
  --primary: 142 76% 36%;
  --background: 222.2 84% 4.9%;
  /* ... */
}
```

Cores especiais WhatsApp:
```css
--whatsapp-green: #25D366;
--whatsapp-darkGreen: #128C7E;
--whatsapp-tealGreen: #075E54;
--whatsapp-lightGreen: #DCF8C6;
```

## 🧩 Componentes Principais

### KanbanBoard
```typescript
<KanbanBoard
  conversations={conversations}
  onUpdate={refetch}
/>
```

### ChatInterface
```typescript
<ChatInterface
  conversation={conversation}
  messages={messages}
  onMessageSent={() => refetch()}
/>
```

### ProtectedRoute
```typescript
<ProtectedRoute allowedRoles={[UserRole.TENANT_ADMIN]}>
  {children}
</ProtectedRoute>
```

## 📊 React Query

Cache e sincronização automática:

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['conversations'],
  queryFn: () => conversationService.list(),
  refetchInterval: 5000, // Refetch a cada 5s
});
```

## 🚧 Próximos Passos

- [ ] WebSocket para real-time (Socket.io)
- [ ] Upload de imagens/arquivos
- [ ] Templates de mensagens
- [ ] Busca avançada de conversas
- [ ] Filtros por tags
- [ ] Exportação de relatórios
- [ ] Dark mode toggle
- [ ] PWA (Progressive Web App)

## 🐛 Troubleshooting

### Erro: "Cannot find module '@/...'"

Verifique o `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Erro: "localStorage is not defined"

Use `typeof window !== 'undefined'` antes de acessar:
```typescript
if (typeof window !== 'undefined') {
  localStorage.setItem('token', token);
}
```

### Erro de CORS

Configure o backend para aceitar requests do frontend:
```typescript
// backend/src/server.ts
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

## 📚 Documentação Adicional

- [Next.js 14 Docs](https://nextjs.org/docs)
- [TailwindCSS](https://tailwindcss.com/docs)
- [Shadcn/ui](https://ui.shadcn.com/)
- [React Query](https://tanstack.com/query/latest)
- [Zod](https://zod.dev/)

---

**Status:** ✅ Frontend 100% funcional e pronto para uso!
