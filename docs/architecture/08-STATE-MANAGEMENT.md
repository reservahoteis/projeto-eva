# Gerenciamento de Estado - Bot Reserva Hoteis

## 1. Visao Geral da Arquitetura de Estado

### 1.1 Distincao entre Estado Cliente e Estado Servidor

#### Estado do Cliente (Zustand)
Estado efemero da interface do usuario que nao precisa ser sincronizado com o servidor:
- Estado de UI (modals, sidebar, tema)
- Preferencias do usuario (layout, configuracoes visuais)
- Estado temporario de formularios
- Autenticacao (tokens, informacoes do usuario e tenant)
- Filtros e paginacao (estado local)
- Notificacoes de UI (toasts)
- Estado de conexao Socket.io

#### Estado do Servidor (TanStack Query)
Dados que sao de propriedade do servidor e precisam ser sincronizados:
- Conversas (Conversations)
- Mensagens (Messages)
- Contatos (Contacts)
- Usuarios e atendentes
- Escalacoes (Escalations)
- Estatisticas do dashboard
- Notificacoes do sistema
- Historico de atividades

### 1.2 Quando Usar Zustand vs TanStack Query

**Use Zustand quando:**
- O estado e puramente do lado do cliente
- Nao ha necessidade de sincronizacao com servidor
- Estado de UI temporario
- Preferencias locais do usuario
- Estado que nao precisa de cache do servidor
- Gerenciamento de conexao WebSocket/Socket.io

**Use TanStack Query quando:**
- Os dados vem de uma API
- Necessita de cache, invalidacao e refetch
- Requer sincronizacao com servidor
- Precisa de loading/error states automaticos
- Dados compartilhados entre componentes
- Necessita de atualizacoes otimistas

### 1.3 Fluxo de Estado

```
+-------------------------------------------------------------+
|                     APLICACAO NEXT.JS                        |
+-------------------------------------------------------------+
|                                                               |
|  +----------------------+      +----------------------+       |
|  |   ESTADO CLIENTE     |      |   ESTADO SERVIDOR    |       |
|  |     (Zustand)        |      |  (TanStack Query)    |       |
|  +----------------------+      +----------------------+       |
|           |                              |                    |
|           |                              |                    |
|  +--------v--------+           +--------v--------+            |
|  |   AuthStore     |           |  Query Hooks     |           |
|  |   - user        |           |  - useConversations          |
|  |   - tenant      |           |  - useMessages   |           |
|  |   - tokens      |           |  - useContacts   |           |
|  +-----------------+           |  - useEscalations|           |
|                                 +------------------+           |
|  +-----------------+                    |                     |
|  |   UIStore       |                    |                     |
|  |   - sidebar     |           +--------v--------+            |
|  |   - modals      |           |   QueryClient   |            |
|  |   - theme       |           |   - cache       |            |
|  +-----------------+           |   - refetch     |            |
|                                 +-----------------+            |
|  +-----------------+                    |                     |
|  |  FilterStore    |                    |                     |
|  |   - filters     |           +--------v--------+            |
|  |   - hotelUnit   |           |   API Layer     |            |
|  |   - pagination  |           +-----------------+            |
|  +-----------------+                    |                     |
|                                          |                     |
|  +-----------------+           +--------v--------+            |
|  | SocketStore     |           |   Backend API   |            |
|  |   - connected   |<--------->|   + Socket.io   |            |
|  |   - events      |           +-----------------+            |
|  +-----------------+                                          |
|                                                               |
+-------------------------------------------------------------+
```

## 2. Stores Zustand

### 2.1 AuthStore

```typescript
// src/stores/auth-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'ATTENDANT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hotelUnit?: string;      // Unidade hoteleira do atendente
  avatar?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  active: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;        // timestamp em ms
}

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  setAuth: (user: User, tenant: Tenant, tokens: AuthTokens) => void;
  updateUser: (user: Partial<User>) => void;
  updateTenant: (tenant: Partial<Tenant>) => void;
  logout: () => void;
  refreshTokens: (tokens: AuthTokens) => void;
  isTokenExpired: () => boolean;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  tenant: null,
  tokens: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAuth: (user, tenant, tokens) =>
        set({
          user,
          tenant,
          tokens,
          isAuthenticated: true,
        }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      updateTenant: (tenantData) =>
        set((state) => ({
          tenant: state.tenant ? { ...state.tenant, ...tenantData } : null,
        })),

      logout: () => set(initialState),

      refreshTokens: (tokens) =>
        set((state) => ({
          tokens,
          isAuthenticated: state.user !== null,
        })),

      isTokenExpired: () => {
        const { tokens } = get();
        if (!tokens) return true;
        // Considerar expirado 5 minutos antes para refresh preventivo
        return Date.now() >= (tokens.expiresAt - 5 * 60 * 1000);
      },
    }),
    {
      name: 'bot-reserva-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors
export const selectUser = (state: AuthStore) => state.user;
export const selectTenant = (state: AuthStore) => state.tenant;
export const selectTenantId = (state: AuthStore) => state.tenant?.id;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectUserRole = (state: AuthStore) => state.user?.role;
export const selectAccessToken = (state: AuthStore) => state.tokens?.accessToken;
export const selectHotelUnit = (state: AuthStore) => state.user?.hotelUnit;

export const selectIsAdmin = (state: AuthStore) =>
  state.user?.role === 'SUPER_ADMIN' || state.user?.role === 'ADMIN';

export const selectIsManager = (state: AuthStore) =>
  ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(state.user?.role || '');

export const selectCanSeeAllUnits = (state: AuthStore) =>
  ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(state.user?.role || '');
```

### 2.2 UIStore

```typescript
// src/stores/ui-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ChatView = 'kanban' | 'list';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface Modal {
  id: string;
  type: string;
  data?: any;
}

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: Theme;
  chatView: ChatView;
  toasts: Toast[];
  modals: Modal[];
  isLoading: boolean;
  selectedConversationId: string | null;
  isChatOpen: boolean;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  setChatView: (view: ChatView) => void;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  openModal: (modal: Omit<Modal, 'id'>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  setLoading: (loading: boolean) => void;
  setSelectedConversation: (id: string | null) => void;
  setIsChatOpen: (open: boolean) => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: 'dark',
  chatView: 'kanban',
  toasts: [],
  modals: [],
  isLoading: false,
  selectedConversationId: null,
  isChatOpen: false,
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      ...initialState,

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }),

      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      setTheme: (theme) =>
        set({ theme }),

      setChatView: (view) =>
        set({ chatView: view }),

      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        return id;
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      clearToasts: () =>
        set({ toasts: [] }),

      openModal: (modal) => {
        const id = `modal-${Date.now()}-${Math.random()}`;
        set((state) => ({
          modals: [...state.modals, { ...modal, id }],
        }));
        return id;
      },

      closeModal: (id) =>
        set((state) => ({
          modals: state.modals.filter((m) => m.id !== id),
        })),

      closeAllModals: () =>
        set({ modals: [] }),

      setLoading: (loading) =>
        set({ isLoading: loading }),

      setSelectedConversation: (id) =>
        set({ selectedConversationId: id, isChatOpen: id !== null }),

      setIsChatOpen: (open) =>
        set({ isChatOpen: open }),
    }),
    {
      name: 'bot-reserva-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        chatView: state.chatView,
      }),
    }
  )
);

// Selectors
export const selectSidebarOpen = (state: UIStore) => state.sidebarOpen;
export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed;
export const selectTheme = (state: UIStore) => state.theme;
export const selectChatView = (state: UIStore) => state.chatView;
export const selectToasts = (state: UIStore) => state.toasts;
export const selectModals = (state: UIStore) => state.modals;
export const selectIsLoading = (state: UIStore) => state.isLoading;
export const selectActiveModal = (state: UIStore) => state.modals[state.modals.length - 1];
export const selectSelectedConversationId = (state: UIStore) => state.selectedConversationId;
export const selectIsChatOpen = (state: UIStore) => state.isChatOpen;
```

### 2.3 FilterStore (Conversas)

```typescript
// src/stores/filter-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ConversationStatus =
  | 'BOT_HANDLING'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'CLOSED';

export type SortField = 'lastMessageAt' | 'createdAt' | 'status';
export type SortOrder = 'asc' | 'desc';

// Unidades hoteleiras do sistema
export const HOTEL_UNITS = [
  'Campos do Jordao',
  'Ilhabela',
  'Camburi',
  'Santo Antonio do Pinhal',
] as const;

export type HotelUnit = typeof HOTEL_UNITS[number];

export interface ConversationFilters {
  status?: ConversationStatus[];
  hotelUnit?: HotelUnit[];
  assignedToId?: string[];
  iaLocked?: boolean;
  search?: string;          // Busca por nome/telefone do contato
  dateFrom?: string;
  dateTo?: string;
  hasUnreadMessages?: boolean;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface SortState {
  field: SortField;
  order: SortOrder;
}

interface FilterState {
  conversationFilters: ConversationFilters;
  pagination: PaginationState;
  sort: SortState;
  activeKanbanColumn: ConversationStatus | null;
  savedFilterSets: Record<string, ConversationFilters>;
}

interface FilterActions {
  setConversationFilters: (filters: Partial<ConversationFilters>) => void;
  resetConversationFilters: () => void;
  setHotelUnitFilter: (units: HotelUnit[] | undefined) => void;
  setStatusFilter: (statuses: ConversationStatus[] | undefined) => void;
  setPagination: (pagination: Partial<PaginationState>) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sort: Partial<SortState>) => void;
  toggleSortOrder: () => void;
  setActiveKanbanColumn: (status: ConversationStatus | null) => void;
  saveFilterSet: (name: string, filters: ConversationFilters) => void;
  loadFilterSet: (name: string) => void;
  deleteFilterSet: (name: string) => void;
}

type FilterStore = FilterState & FilterActions;

const initialState: FilterState = {
  conversationFilters: {},
  pagination: {
    page: 1,
    pageSize: 50,
  },
  sort: {
    field: 'lastMessageAt',
    order: 'desc',
  },
  activeKanbanColumn: null,
  savedFilterSets: {},
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      ...initialState,

      setConversationFilters: (filters) =>
        set((state) => ({
          conversationFilters: { ...state.conversationFilters, ...filters },
          pagination: { ...state.pagination, page: 1 },
        })),

      resetConversationFilters: () =>
        set({
          conversationFilters: {},
          pagination: { ...initialState.pagination },
        }),

      setHotelUnitFilter: (units) =>
        set((state) => ({
          conversationFilters: { ...state.conversationFilters, hotelUnit: units },
          pagination: { ...state.pagination, page: 1 },
        })),

      setStatusFilter: (statuses) =>
        set((state) => ({
          conversationFilters: { ...state.conversationFilters, status: statuses },
          pagination: { ...state.pagination, page: 1 },
        })),

      setPagination: (pagination) =>
        set((state) => ({
          pagination: { ...state.pagination, ...pagination },
        })),

      setPage: (page) =>
        set((state) => ({
          pagination: { ...state.pagination, page },
        })),

      setPageSize: (pageSize) =>
        set((state) => ({
          pagination: { ...state.pagination, pageSize, page: 1 },
        })),

      setSort: (sort) =>
        set((state) => ({
          sort: { ...state.sort, ...sort },
          pagination: { ...state.pagination, page: 1 },
        })),

      toggleSortOrder: () =>
        set((state) => ({
          sort: {
            ...state.sort,
            order: state.sort.order === 'asc' ? 'desc' : 'asc',
          },
          pagination: { ...state.pagination, page: 1 },
        })),

      setActiveKanbanColumn: (status) =>
        set({ activeKanbanColumn: status }),

      saveFilterSet: (name, filters) =>
        set((state) => ({
          savedFilterSets: {
            ...state.savedFilterSets,
            [name]: filters,
          },
        })),

      loadFilterSet: (name) =>
        set((state) => ({
          conversationFilters: state.savedFilterSets[name] || {},
          pagination: { ...state.pagination, page: 1 },
        })),

      deleteFilterSet: (name) =>
        set((state) => {
          const { [name]: _, ...rest } = state.savedFilterSets;
          return { savedFilterSets: rest };
        }),
    }),
    {
      name: 'bot-reserva-filters',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pagination: { pageSize: state.pagination.pageSize },
        sort: state.sort,
        savedFilterSets: state.savedFilterSets,
        chatView: state.chatView,
      }),
    }
  )
);

// Selectors
export const selectConversationFilters = (state: FilterStore) => state.conversationFilters;
export const selectPagination = (state: FilterStore) => state.pagination;
export const selectSort = (state: FilterStore) => state.sort;
export const selectHasActiveFilters = (state: FilterStore) =>
  Object.keys(state.conversationFilters).length > 0;
export const selectSavedFilterSets = (state: FilterStore) => state.savedFilterSets;
export const selectActiveKanbanColumn = (state: FilterStore) => state.activeKanbanColumn;
```

### 2.4 SocketStore

```typescript
// src/stores/socket-store.ts
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export type SocketEvent =
  | 'conversation:new'
  | 'conversation:updated'
  | 'message:new'
  | 'message:status'
  | 'escalation:new'
  | 'escalation:resolved'
  | 'typing:start'
  | 'typing:stop';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  typingUsers: Record<string, string[]>; // conversationId -> userIds que estao digitando
}

interface SocketActions {
  connect: (token: string, tenantId: string) => void;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  addTypingUser: (conversationId: string, userId: string) => void;
  removeTypingUser: (conversationId: string, userId: string) => void;
}

type SocketStore = SocketState & SocketActions;

const initialState: SocketState = {
  socket: null,
  isConnected: false,
  connectionError: null,
  typingUsers: {},
};

export const useSocketStore = create<SocketStore>()((set, get) => ({
  ...initialState,

  connect: (token, tenantId) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) {
      return; // Ja conectado
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://api.botreserva.com.br';

    const socket = io(socketUrl, {
      auth: { token },
      query: { tenantId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket.io connected');
      set({ isConnected: true, connectionError: null });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.io disconnected:', reason);
      set({ isConnected: false });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      set({ connectionError: error.message });
    });

    // Eventos de typing
    socket.on('typing:start', ({ conversationId, userId }) => {
      get().addTypingUser(conversationId, userId);
    });

    socket.on('typing:stop', ({ conversationId, userId }) => {
      get().removeTypingUser(conversationId, userId);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set(initialState);
    }
  },

  emit: (event, data) => {
    const { socket, isConnected } = get();
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  },

  setTyping: (conversationId, isTyping) => {
    const { socket } = get();
    if (socket) {
      socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
    }
  },

  addTypingUser: (conversationId, userId) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: [
          ...(state.typingUsers[conversationId] || []).filter(id => id !== userId),
          userId,
        ],
      },
    })),

  removeTypingUser: (conversationId, userId) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: (state.typingUsers[conversationId] || []).filter(
          (id) => id !== userId
        ),
      },
    })),
}));

// Selectors
export const selectSocket = (state: SocketStore) => state.socket;
export const selectIsConnected = (state: SocketStore) => state.isConnected;
export const selectConnectionError = (state: SocketStore) => state.connectionError;
export const selectTypingUsers = (conversationId: string) => (state: SocketStore) =>
  state.typingUsers[conversationId] || [];
```

### 2.5 NotificationStore

```typescript
// src/stores/notification-store.ts
import { create } from 'zustand';

export type NotificationType =
  | 'CONVERSATION_NEW'
  | 'CONVERSATION_ASSIGNED'
  | 'MESSAGE_NEW'
  | 'ESCALATION_NEW'
  | 'ESCALATION_RESOLVED'
  | 'IA_LOCKED'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  conversationId?: string;
  contactName?: string;
  hotelUnit?: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  lastFetched: number | null;
}

interface NotificationActions {
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  updateUnreadCount: (count: number) => void;
  setLastFetched: (timestamp: number) => void;
}

type NotificationStore = NotificationState & NotificationActions;

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  lastFetched: null,
};

export const useNotificationStore = create<NotificationStore>()((set) => ({
  ...initialState,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.read ? state.unreadCount : state.unreadCount + 1,
    })),

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotification: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification && !notification.read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    }),

  clearNotifications: () =>
    set(initialState),

  updateUnreadCount: (count) =>
    set({ unreadCount: count }),

  setLastFetched: (timestamp) =>
    set({ lastFetched: timestamp }),
}));

// Selectors
export const selectNotifications = (state: NotificationStore) => state.notifications;
export const selectUnreadCount = (state: NotificationStore) => state.unreadCount;
export const selectUnreadNotifications = (state: NotificationStore) =>
  state.notifications.filter((n) => !n.read);
export const selectNotificationById = (id: string) => (state: NotificationStore) =>
  state.notifications.find((n) => n.id === id);
export const selectLastFetched = (state: NotificationStore) => state.lastFetched;
```

## 3. Configuracao do TanStack Query

### 3.1 QueryClient Setup

```typescript
// src/lib/query-client.ts
import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import { useUIStore } from '@/stores/ui-store';

const queryConfig: DefaultOptions = {
  queries: {
    staleTime: 30 * 1000,     // 30 segundos (conversas mudam frequentemente)
    gcTime: 5 * 60 * 1000,    // 5 minutos
    retry: (failureCount, error: any) => {
      // Nao retry em erros 4xx
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  },
  mutations: {
    retry: false,
    onError: (error: any) => {
      const addToast = useUIStore.getState().addToast;

      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Ocorreu um erro inesperado';

      addToast({
        type: 'error',
        message,
        duration: 5000,
      });
    },
  },
};

export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});
```

### 3.2 Provider Setup

```typescript
// src/providers/query-provider.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
```

### 3.3 API Client com Interceptors

```typescript
// src/lib/api-client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.botreserva.com.br',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().tokens?.accessToken;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { tokens, refreshTokens, logout } = useAuthStore.getState();

      if (tokens?.refreshToken) {
        try {
          const response = await axios.post(
            `${apiClient.defaults.baseURL}/auth/refresh`,
            { refreshToken: tokens.refreshToken }
          );

          const newTokens = response.data;
          refreshTokens(newTokens);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          }

          return apiClient(originalRequest);
        } catch (refreshError) {
          logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
```

## 4. Query Hooks

### 4.1 Conversations Queries

```typescript
// src/hooks/queries/use-conversations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useFilterStore } from '@/stores/filter-store';
import type { ConversationFilters, PaginationState, SortState } from '@/stores/filter-store';

export type ConversationStatus =
  | 'BOT_HANDLING'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'CLOSED';

export interface Contact {
  id: string;
  phoneNumber: string;
  name?: string;
  profilePictureUrl?: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  contactId: string;
  contact: Contact;
  status: ConversationStatus;
  hotelUnit?: string;
  assignedToId?: string;
  assignedTo?: User;
  iaLocked: boolean;
  iaLockedAt?: string;
  iaLockedBy?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
    unreadMessages: number;
  };
}

export interface ConversationsResponse {
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Query Keys
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: ConversationFilters, pagination: PaginationState, sort: SortState) =>
    [...conversationKeys.lists(), { filters, pagination, sort }] as const,
  byStatus: (status: ConversationStatus) =>
    [...conversationKeys.lists(), { status }] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
};

// Fetch functions
async function fetchConversations(
  filters: ConversationFilters,
  pagination: PaginationState,
  sort: SortState
): Promise<ConversationsResponse> {
  const params = new URLSearchParams();

  // Filtros
  if (filters.status?.length) {
    filters.status.forEach(s => params.append('status', s));
  }
  if (filters.hotelUnit?.length) {
    filters.hotelUnit.forEach(u => params.append('hotelUnit', u));
  }
  if (filters.assignedToId?.length) {
    filters.assignedToId.forEach(a => params.append('assignedToId', a));
  }
  if (filters.iaLocked !== undefined) {
    params.append('iaLocked', String(filters.iaLocked));
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.hasUnreadMessages !== undefined) {
    params.append('hasUnreadMessages', String(filters.hasUnreadMessages));
  }

  // Paginacao
  params.append('page', pagination.page.toString());
  params.append('limit', pagination.pageSize.toString());

  // Ordenacao
  params.append('sortBy', sort.field);
  params.append('sortOrder', sort.order);

  const { data } = await apiClient.get<ConversationsResponse>('/api/conversations', { params });
  return data;
}

async function fetchConversation(id: string): Promise<Conversation> {
  const { data } = await apiClient.get(`/api/conversations/${id}`);
  return data.conversation;
}

// Hooks
export function useConversations() {
  const filters = useFilterStore((state) => state.conversationFilters);
  const pagination = useFilterStore((state) => state.pagination);
  const sort = useFilterStore((state) => state.sort);

  return useQuery({
    queryKey: conversationKeys.list(filters, pagination, sort),
    queryFn: () => fetchConversations(filters, pagination, sort),
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000, // Refetch a cada 30 segundos
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: conversationKeys.detail(id!),
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}

export function useConversationsByStatus(status: ConversationStatus) {
  return useQuery({
    queryKey: conversationKeys.byStatus(status),
    queryFn: () => fetchConversations({ status: [status] }, { page: 1, pageSize: 100 }, { field: 'lastMessageAt', order: 'desc' }),
    refetchInterval: 30000,
  });
}
```

### 4.2 Conversation Mutations

```typescript
// src/hooks/mutations/use-conversation-mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useUIStore } from '@/stores/ui-store';
import { conversationKeys } from '@/hooks/queries/use-conversations';
import type { Conversation, ConversationStatus } from '@/hooks/queries/use-conversations';

interface UpdateConversationInput {
  status?: ConversationStatus;
  assignedToId?: string;
  hotelUnit?: string;
}

interface AssignConversationInput {
  assignedToId: string;
}

interface TransferConversationInput {
  assignedToId: string;
  hotelUnit?: string;
}

async function updateConversation(id: string, input: UpdateConversationInput): Promise<Conversation> {
  const { data } = await apiClient.patch(`/api/conversations/${id}`, input);
  return data.conversation;
}

async function assignConversation(id: string, input: AssignConversationInput): Promise<Conversation> {
  const { data } = await apiClient.post(`/api/conversations/${id}/assign`, input);
  return data.conversation;
}

async function closeConversation(id: string): Promise<Conversation> {
  const { data } = await apiClient.post(`/api/conversations/${id}/close`);
  return data.conversation;
}

async function reopenConversation(id: string): Promise<Conversation> {
  const { data } = await apiClient.post(`/api/conversations/${id}/reopen`);
  return data.conversation;
}

async function unlockIa(id: string): Promise<Conversation> {
  const { data } = await apiClient.post(`/api/conversations/${id}/unlock-ia`);
  return data.conversation;
}

export function useUpdateConversation(id: string) {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: (input: UpdateConversationInput) => updateConversation(id, input),
    onMutate: async (updatedData) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.detail(id) });

      const previousConversation = queryClient.getQueryData<Conversation>(
        conversationKeys.detail(id)
      );

      if (previousConversation) {
        queryClient.setQueryData<Conversation>(conversationKeys.detail(id), {
          ...previousConversation,
          ...updatedData,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousConversation };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousConversation) {
        queryClient.setQueryData(
          conversationKeys.detail(id),
          context.previousConversation
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useAssignConversation(id: string) {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: (input: AssignConversationInput) => assignConversation(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });

      addToast({
        type: 'success',
        message: 'Conversa atribuida com sucesso!',
        duration: 3000,
      });
    },
  });
}

export function useCloseConversation(id: string) {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: () => closeConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });

      addToast({
        type: 'success',
        message: 'Conversa encerrada com sucesso!',
        duration: 3000,
      });
    },
  });
}

export function useReopenConversation(id: string) {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: () => reopenConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });

      addToast({
        type: 'success',
        message: 'Conversa reaberta com sucesso!',
        duration: 3000,
      });
    },
  });
}

export function useUnlockIa(id: string) {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: () => unlockIa(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });

      addToast({
        type: 'info',
        message: 'IA desbloqueada. Bot voltara a responder.',
        duration: 3000,
      });
    },
  });
}
```

### 4.3 Messages Queries

```typescript
// src/hooks/queries/use-messages.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useUIStore } from '@/stores/ui-store';
import { conversationKeys } from './use-conversations';

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'INTERACTIVE' | 'TEMPLATE';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface Message {
  id: string;
  conversationId: string;
  whatsappMessageId?: string;
  type: MessageType;
  direction: MessageDirection;
  status: MessageStatus;
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  sentById?: string;
  sentBy?: User;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface MessagesResponse {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Query Keys
export const messageKeys = {
  all: ['messages'] as const,
  lists: () => [...messageKeys.all, 'list'] as const,
  list: (conversationId: string) => [...messageKeys.lists(), conversationId] as const,
};

// Fetch functions
async function fetchMessages(
  conversationId: string,
  page: number = 1,
  limit: number = 50
): Promise<MessagesResponse> {
  const { data } = await apiClient.get(
    `/api/conversations/${conversationId}/messages`,
    { params: { page, limit } }
  );
  return data;
}

async function sendTextMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  const { data } = await apiClient.post('/api/messages', {
    conversationId,
    content,
    type: 'TEXT',
  });
  return data.message;
}

// Hooks
export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messageKeys.list(conversationId!),
    queryFn: () => fetchMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 5000, // Refetch a cada 5 segundos para mensagens novas
  });
}

export function useInfiniteMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: messageKeys.list(conversationId!),
    queryFn: ({ pageParam = 1 }) => fetchMessages(conversationId!, pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: (content: string) => sendTextMessage(conversationId, content),
    onMutate: async (content) => {
      await queryClient.cancelQueries({
        queryKey: messageKeys.list(conversationId),
      });

      const previousMessages = queryClient.getQueryData<MessagesResponse>(
        messageKeys.list(conversationId)
      );

      // Atualizacao otimista
      if (previousMessages) {
        const optimisticMessage: Message = {
          id: `temp-${Date.now()}`,
          conversationId,
          type: 'TEXT',
          direction: 'OUTBOUND',
          status: 'PENDING',
          content,
          timestamp: new Date().toISOString(),
        };

        queryClient.setQueryData<MessagesResponse>(
          messageKeys.list(conversationId),
          {
            ...previousMessages,
            messages: [...previousMessages.messages, optimisticMessage],
          }
        );
      }

      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          messageKeys.list(conversationId),
          context.previousMessages
        );
      }

      addToast({
        type: 'error',
        message: 'Erro ao enviar mensagem',
        duration: 3000,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.list(conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}
```

### 4.4 Dashboard Stats Queries

```typescript
// src/hooks/queries/use-dashboard-stats.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DashboardStats {
  summary: {
    totalConversations: number;
    botHandling: number;
    openConversations: number;
    inProgressConversations: number;
    waitingConversations: number;
    closedToday: number;
    pendingEscalations: number;
  };
  byHotelUnit: Array<{
    hotelUnit: string;
    count: number;
    open: number;
    inProgress: number;
  }>;
  byStatus: {
    BOT_HANDLING: number;
    OPEN: number;
    IN_PROGRESS: number;
    WAITING: number;
    CLOSED: number;
  };
  attendantPerformance: Array<{
    attendantId: string;
    attendantName: string;
    assignedConversations: number;
    resolvedToday: number;
    averageResponseTime: number;
  }>;
  conversationTrends: Array<{
    date: string;
    created: number;
    closed: number;
    escalated: number;
  }>;
  averageResponseTime: number;
  averageResolutionTime: number;
  escalationRate: number;
}

export interface StatsFilters {
  startDate?: string;
  endDate?: string;
  hotelUnit?: string;
  attendantId?: string;
}

// Query Keys
export const statsKeys = {
  all: ['stats'] as const,
  dashboard: (filters?: StatsFilters) =>
    [...statsKeys.all, 'dashboard', filters] as const,
};

// Fetch functions
async function fetchDashboardStats(filters?: StatsFilters): Promise<DashboardStats> {
  const params = new URLSearchParams();

  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.hotelUnit) params.append('hotelUnit', filters.hotelUnit);
  if (filters?.attendantId) params.append('attendantId', filters.attendantId);

  const { data } = await apiClient.get('/api/reports/dashboard', { params });
  return data;
}

// Hooks
export function useDashboardStats(filters?: StatsFilters) {
  return useQuery({
    queryKey: statsKeys.dashboard(filters),
    queryFn: () => fetchDashboardStats(filters),
    staleTime: 2 * 60 * 1000,     // 2 minutos
    refetchInterval: 2 * 60 * 1000, // Refetch a cada 2 minutos
  });
}
```

### 4.5 Escalations Queries

```typescript
// src/hooks/queries/use-escalations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useUIStore } from '@/stores/ui-store';
import { conversationKeys } from './use-conversations';

export type EscalationReason =
  | 'USER_REQUESTED'
  | 'AI_UNABLE'
  | 'COMPLEX_QUERY'
  | 'COMPLAINT'
  | 'RESERVATION_ISSUE'
  | 'PAYMENT_ISSUE'
  | 'OTHER';

export type EscalationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type EscalationStatus = 'PENDING' | 'ASSIGNED' | 'RESOLVED';

export interface Escalation {
  id: string;
  conversationId: string;
  conversation?: Conversation;
  reason: EscalationReason;
  reasonDetail?: string;
  priority: EscalationPriority;
  status: EscalationStatus;
  hotelUnit?: string;
  assignedToId?: string;
  assignedTo?: User;
  resolvedAt?: string;
  resolvedById?: string;
  createdAt: string;
}

// Query Keys
export const escalationKeys = {
  all: ['escalations'] as const,
  lists: () => [...escalationKeys.all, 'list'] as const,
  pending: () => [...escalationKeys.lists(), 'pending'] as const,
  byHotelUnit: (unit: string) => [...escalationKeys.lists(), { hotelUnit: unit }] as const,
};

// Fetch functions
async function fetchPendingEscalations(): Promise<Escalation[]> {
  const { data } = await apiClient.get('/api/escalations', {
    params: { status: 'PENDING' },
  });
  return data.escalations;
}

async function resolveEscalation(id: string): Promise<Escalation> {
  const { data } = await apiClient.post(`/api/escalations/${id}/resolve`);
  return data.escalation;
}

// Hooks
export function usePendingEscalations() {
  return useQuery({
    queryKey: escalationKeys.pending(),
    queryFn: fetchPendingEscalations,
    refetchInterval: 30000, // Refetch a cada 30 segundos
  });
}

export function useResolveEscalation() {
  const queryClient = useQueryClient();
  const addToast = useUIStore((state) => state.addToast);

  return useMutation({
    mutationFn: resolveEscalation,
    onSuccess: (escalation) => {
      queryClient.invalidateQueries({ queryKey: escalationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(escalation.conversationId),
      });

      addToast({
        type: 'success',
        message: 'Escalacao resolvida com sucesso!',
        duration: 3000,
      });
    },
  });
}
```

## 5. Estrategia de Invalidacao de Cache

### 5.1 Tabela de Relacionamentos

```typescript
// src/lib/query-invalidation.ts
import { QueryClient } from '@tanstack/react-query';
import { conversationKeys } from '@/hooks/queries/use-conversations';
import { messageKeys } from '@/hooks/queries/use-messages';
import { escalationKeys } from '@/hooks/queries/use-escalations';
import { statsKeys } from '@/hooks/queries/use-dashboard-stats';

export const invalidationStrategies = {
  // Apos nova mensagem
  onMessageNew: (queryClient: QueryClient, conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: messageKeys.list(conversationId) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
  },

  // Apos status de mensagem atualizado
  onMessageStatus: (queryClient: QueryClient, conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: messageKeys.list(conversationId) });
  },

  // Apos nova conversa
  onConversationNew: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    queryClient.invalidateQueries({ queryKey: statsKeys.all });
  },

  // Apos conversa atualizada
  onConversationUpdate: (queryClient: QueryClient, conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    queryClient.invalidateQueries({ queryKey: statsKeys.all });
  },

  // Apos escalacao criada
  onEscalationNew: (queryClient: QueryClient, conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: escalationKeys.lists() });
    queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
    queryClient.invalidateQueries({ queryKey: statsKeys.all });
  },

  // Apos escalacao resolvida
  onEscalationResolved: (queryClient: QueryClient, conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: escalationKeys.lists() });
    queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
    queryClient.invalidateQueries({ queryKey: statsKeys.all });
  },

  // Apos IA locked/unlocked
  onIaLockChange: (queryClient: QueryClient, conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
    queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
  },
};
```

## 6. Persistencia de Estado

### 6.1 O que Persistir

#### AuthStore (Persistir)
```typescript
// Persistir:
- user
- tenant
- tokens
- isAuthenticated

// Nao persistir:
- (nenhum estado temporario)
```

#### UIStore (Persistir Parcialmente)
```typescript
// Persistir:
- sidebarCollapsed
- theme
- chatView

// Nao persistir:
- sidebarOpen (estado da sessao)
- toasts (temporario)
- modals (temporario)
- isLoading (temporario)
- selectedConversationId (estado da sessao)
- isChatOpen (estado da sessao)
```

#### FilterStore (Persistir Parcialmente)
```typescript
// Persistir:
- pagination.pageSize (preferencia do usuario)
- sort (preferencia do usuario)
- savedFilterSets (filtros salvos)

// Nao persistir:
- conversationFilters (estado da sessao)
- pagination.page (estado da sessao)
- activeKanbanColumn (estado da sessao)
```

#### SocketStore (Nao Persistir)
```typescript
// Nao persistir:
- socket (conexao ativa)
- isConnected (estado da sessao)
- connectionError (estado da sessao)
- typingUsers (estado da sessao)
```

#### NotificationStore (Nao Persistir)
```typescript
// Nao persistir:
- notifications (sempre vem do servidor)
- unreadCount (sempre vem do servidor)
- lastFetched (estado da sessao)
```

### 6.2 Hidratacao no Next.js

```typescript
// src/providers/hydration-provider.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useFilterStore } from '@/stores/filter-store';

export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Aguardar hidratacao das stores
    const unsubAuth = useAuthStore.persist.onFinishHydration(() => {
      console.log('AuthStore hydrated');
    });

    const unsubUI = useUIStore.persist.onFinishHydration(() => {
      console.log('UIStore hydrated');
    });

    const unsubFilter = useFilterStore.persist.onFinishHydration(() => {
      console.log('FilterStore hydrated');
    });

    setIsHydrated(true);

    return () => {
      unsubAuth();
      unsubUI();
      unsubFilter();
    };
  }, []);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
```

## 7. Atualizacoes em Tempo Real (Socket.io)

### 7.1 Socket.io Integration

```typescript
// src/hooks/use-socket.ts
import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useNotificationStore } from '@/stores/notification-store';
import { invalidationStrategies } from '@/lib/query-invalidation';

export function useSocket() {
  const queryClient = useQueryClient();
  const { tokens, tenant } = useAuthStore();
  const { socket, connect, disconnect, isConnected } = useSocketStore();
  const { addNotification } = useNotificationStore();

  // Conectar ao montar
  useEffect(() => {
    if (tokens?.accessToken && tenant?.id) {
      connect(tokens.accessToken, tenant.id);
    }

    return () => {
      disconnect();
    };
  }, [tokens?.accessToken, tenant?.id]);

  // Registrar event listeners
  useEffect(() => {
    if (!socket) return;

    // Nova conversa
    socket.on('conversation:new', (data) => {
      invalidationStrategies.onConversationNew(queryClient);
      addNotification({
        id: `notif-${Date.now()}`,
        type: 'CONVERSATION_NEW',
        title: 'Nova Conversa',
        message: `Nova conversa de ${data.contactName}`,
        conversationId: data.conversationId,
        contactName: data.contactName,
        hotelUnit: data.hotelUnit,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });

    // Conversa atualizada
    socket.on('conversation:updated', (data) => {
      invalidationStrategies.onConversationUpdate(queryClient, data.conversationId);
    });

    // Nova mensagem
    socket.on('message:new', (data) => {
      invalidationStrategies.onMessageNew(queryClient, data.conversationId);

      // Notificar se for mensagem de outro usuario
      if (data.direction === 'INBOUND') {
        addNotification({
          id: `notif-${Date.now()}`,
          type: 'MESSAGE_NEW',
          title: 'Nova Mensagem',
          message: `${data.contactName}: ${data.content?.substring(0, 50)}...`,
          conversationId: data.conversationId,
          contactName: data.contactName,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Status de mensagem atualizado
    socket.on('message:status', (data) => {
      invalidationStrategies.onMessageStatus(queryClient, data.conversationId);
    });

    // Nova escalacao
    socket.on('escalation:new', (data) => {
      invalidationStrategies.onEscalationNew(queryClient, data.conversationId);
      addNotification({
        id: `notif-${Date.now()}`,
        type: 'ESCALATION_NEW',
        title: 'Nova Escalacao',
        message: `Conversa escalada: ${data.reason}`,
        conversationId: data.conversationId,
        hotelUnit: data.hotelUnit,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });

    // Escalacao resolvida
    socket.on('escalation:resolved', (data) => {
      invalidationStrategies.onEscalationResolved(queryClient, data.conversationId);
    });

    return () => {
      socket.off('conversation:new');
      socket.off('conversation:updated');
      socket.off('message:new');
      socket.off('message:status');
      socket.off('escalation:new');
      socket.off('escalation:resolved');
    };
  }, [socket, queryClient, addNotification]);

  return {
    isConnected,
    socket,
  };
}
```

### 7.2 Socket Provider

```typescript
// src/providers/socket-provider.tsx
'use client';

import { useSocket } from '@/hooks/use-socket';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket();
  return <>{children}</>;
}
```

## 8. Exemplo de Uso Completo

### 8.1 Root Layout com Providers

```typescript
// src/app/layout.tsx
import { QueryProvider } from '@/providers/query-provider';
import { HydrationProvider } from '@/providers/hydration-provider';
import { SocketProvider } from '@/providers/socket-provider';
import { ThemeProvider } from '@/providers/theme-provider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <HydrationProvider>
            <ThemeProvider>
              <SocketProvider>
                {children}
              </SocketProvider>
            </ThemeProvider>
          </HydrationProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

### 8.2 Pagina de Conversas (Kanban)

```typescript
// src/app/(dashboard)/conversations/page.tsx
'use client';

import { useConversations } from '@/hooks/queries/use-conversations';
import { useFilterStore } from '@/stores/filter-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { ConversationKanban } from '@/components/conversations/conversation-kanban';
import { ConversationList } from '@/components/conversations/conversation-list';
import { ConversationFilters } from '@/components/conversations/conversation-filters';
import { Skeleton } from '@/components/ui/skeleton';

export default function ConversationsPage() {
  const { data, isLoading, error } = useConversations();
  const chatView = useUIStore((state) => state.chatView);
  const {
    conversationFilters,
    setConversationFilters,
    pagination,
    setPage,
    sort,
    setSort,
  } = useFilterStore();

  const canSeeAllUnits = useAuthStore((state) =>
    ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(state.user?.role || '')
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive">
        Erro ao carregar conversas
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <ConversationFilters
        filters={conversationFilters}
        onChange={setConversationFilters}
        showHotelUnitFilter={canSeeAllUnits}
      />

      {/* View Kanban ou Lista */}
      {chatView === 'kanban' ? (
        <ConversationKanban
          conversations={data?.conversations || []}
        />
      ) : (
        <ConversationList
          conversations={data?.conversations || []}
          sort={sort}
          onSortChange={setSort}
          pagination={{
            currentPage: pagination.page,
            totalPages: data?.pagination.totalPages || 1,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
```

### 8.3 Componente de Chat

```typescript
// src/components/conversations/chat-panel.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useConversation } from '@/hooks/queries/use-conversations';
import { useMessages, useSendMessage } from '@/hooks/queries/use-messages';
import { useUIStore } from '@/stores/ui-store';
import { useSocketStore } from '@/stores/socket-store';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import { ChatHeader } from './chat-header';
import { Skeleton } from '@/components/ui/skeleton';

export function ChatPanel() {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedId = useUIStore((state) => state.selectedConversationId);
  const { data: conversation, isLoading: conversationLoading } = useConversation(selectedId);
  const { data: messagesData, isLoading: messagesLoading } = useMessages(selectedId);
  const sendMessage = useSendMessage(selectedId!);
  const { setTyping } = useSocketStore();

  // Scroll para ultima mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData?.messages]);

  // Typing indicator
  useEffect(() => {
    if (!selectedId || !message) {
      setTyping(selectedId!, false);
      return;
    }

    setTyping(selectedId, true);
    const timeout = setTimeout(() => {
      setTyping(selectedId, false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [message, selectedId]);

  const handleSend = async () => {
    if (!message.trim() || !selectedId) return;

    await sendMessage.mutateAsync(message);
    setMessage('');
  };

  if (!selectedId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Selecione uma conversa para iniciar
      </div>
    );
  }

  if (conversationLoading || messagesLoading) {
    return <Skeleton className="h-full" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatHeader conversation={conversation!} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList messages={messagesData?.messages || []} />
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        value={message}
        onChange={setMessage}
        onSend={handleSend}
        disabled={sendMessage.isPending || conversation?.iaLocked === false}
        placeholder={
          conversation?.iaLocked
            ? 'Digite sua mensagem...'
            : 'Bot esta respondendo. Aguarde ou assuma a conversa.'
        }
      />
    </div>
  );
}
```

---

## Por que essas escolhas?

**Zustand em vez de Redux ou Context API**
Redux tem muito boilerplate para o que precisamos. Context API causa re-renders desnecessários. Zustand é simples (uma função, um hook) e só re-renderiza componentes que usam a fatia de estado que mudou.

**TanStack Query para estado do servidor**
Gerenciar cache manualmente é trabalhoso e propenso a bugs. TanStack Query faz cache, revalidação, retry, e sincronização entre abas automaticamente. O código fica focado no "o que buscar", não no "como cachear".

**Separação clara: Zustand para UI, TanStack Query para dados**
Misturar estado de UI (modal aberto, sidebar expandida) com dados do servidor (conversas, mensagens) complica a lógica. Zustand cuida da interface, TanStack Query cuida dos dados. Cada um faz uma coisa bem.

**Socket.io integrado com TanStack Query**
Quando chega uma mensagem por WebSocket, atualizamos o cache do TanStack Query. O componente re-renderiza automaticamente sem precisar de lógica adicional. Uma linha de código sincroniza real-time com cache.

**staleTime de 30s para conversas**
Conversas mudam com frequência (novas mensagens, status). 30 segundos é tempo suficiente para evitar requests desnecessários, mas curto o bastante para manter dados atualizados.

---

Última atualização: Dezembro de 2025

**Desenvolvido por [3ian](https://3ian.com.br)** - Soluções em Tecnologia e Automação
