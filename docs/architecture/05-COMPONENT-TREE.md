# Árvore de Componentes - Bot Reserva Hotéis

## 1. Estrutura de Pastas `/src`

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── conversations/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── contacts/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── escalations/
│   │   │   └── page.tsx
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   ├── users/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── tenants/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── usage/
│   │   │   │   └── page.tsx
│   │   │   └── audit-logs/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   ├── layout.tsx
│   ├── globals.css
│   └── providers.tsx
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── avatar.tsx
│   │   ├── separator.tsx
│   │   ├── alert.tsx
│   │   ├── toast.tsx
│   │   ├── toaster.tsx
│   │   ├── skeleton.tsx
│   │   ├── scroll-area.tsx
│   │   ├── popover.tsx
│   │   ├── command.tsx
│   │   └── sheet.tsx
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── navigation.tsx
│   │   ├── mobile-menu.tsx
│   │   └── breadcrumb.tsx
│   ├── auth/
│   │   ├── login-form.tsx
│   │   └── auth-guard.tsx
│   ├── dashboard/
│   │   ├── stats-card.tsx
│   │   ├── recent-escalations.tsx
│   │   ├── activity-feed.tsx
│   │   ├── quick-actions.tsx
│   │   └── hotel-unit-filter.tsx
│   ├── conversations/
│   │   ├── conversation-list.tsx
│   │   ├── conversation-card.tsx
│   │   ├── conversation-kanban.tsx
│   │   ├── conversation-filters.tsx
│   │   ├── conversation-status-badge.tsx
│   │   ├── conversation-priority-badge.tsx
│   │   ├── conversation-detail.tsx
│   │   └── conversation-actions.tsx
│   ├── chat/
│   │   ├── chat-window.tsx
│   │   ├── chat-header.tsx
│   │   ├── message-list.tsx
│   │   ├── message-bubble.tsx
│   │   ├── message-input.tsx
│   │   ├── message-media.tsx
│   │   ├── message-buttons.tsx
│   │   ├── message-carousel.tsx
│   │   ├── typing-indicator.tsx
│   │   └── quick-replies.tsx
│   ├── contacts/
│   │   ├── contact-list.tsx
│   │   ├── contact-table.tsx
│   │   ├── contact-detail.tsx
│   │   ├── contact-avatar.tsx
│   │   └── contact-dialog.tsx
│   ├── escalations/
│   │   ├── escalation-list.tsx
│   │   ├── escalation-card.tsx
│   │   ├── escalation-status-badge.tsx
│   │   ├── escalation-reason-badge.tsx
│   │   └── escalation-dialog.tsx
│   ├── users/
│   │   ├── user-list.tsx
│   │   ├── user-table.tsx
│   │   ├── user-form.tsx
│   │   ├── user-dialog.tsx
│   │   └── user-avatar.tsx
│   ├── tenants/
│   │   ├── tenant-list.tsx
│   │   ├── tenant-form.tsx
│   │   ├── tenant-dialog.tsx
│   │   └── whatsapp-config.tsx
│   ├── reports/
│   │   ├── report-filters.tsx
│   │   ├── report-chart.tsx
│   │   ├── report-table.tsx
│   │   └── export-button.tsx
│   ├── settings/
│   │   ├── profile-form.tsx
│   │   ├── password-change-form.tsx
│   │   ├── notification-settings.tsx
│   │   └── whatsapp-integration.tsx
│   └── shared/
│       ├── loading-spinner.tsx
│       ├── error-boundary.tsx
│       ├── empty-state.tsx
│       ├── confirmation-dialog.tsx
│       ├── search-input.tsx
│       ├── pagination.tsx
│       ├── data-table.tsx
│       ├── file-upload.tsx
│       ├── date-picker.tsx
│       ├── theme-toggle.tsx
│       └── socket-status.tsx
├── hooks/
│   ├── use-auth.ts
│   ├── use-conversations.ts
│   ├── use-messages.ts
│   ├── use-contacts.ts
│   ├── use-escalations.ts
│   ├── use-users.ts
│   ├── use-tenants.ts
│   ├── use-reports.ts
│   ├── use-toast.ts
│   ├── use-socket.ts
│   ├── use-debounce.ts
│   ├── use-pagination.ts
│   └── use-theme.ts
├── lib/
│   ├── api.ts
│   ├── utils.ts
│   ├── validations.ts
│   ├── constants.ts
│   ├── formatters.ts
│   └── socket.ts
├── types/
│   ├── index.ts
│   ├── auth.ts
│   ├── conversation.ts
│   ├── message.ts
│   ├── contact.ts
│   ├── escalation.ts
│   ├── user.ts
│   ├── tenant.ts
│   └── report.ts
└── providers/
    ├── auth-provider.tsx
    ├── theme-provider.tsx
    ├── socket-provider.tsx
    └── query-provider.tsx
```

## 2. Hierarquia de Componentes (ASCII)

```
RootLayout
├── Providers
│   ├── AuthProvider
│   ├── ThemeProvider
│   ├── SocketProvider
│   └── QueryClientProvider
│
├── (auth)/layout
│   └── LoginPage
│       └── LoginForm
│           ├── Input (ui)
│           ├── Button (ui)
│           └── Alert (ui)
│
├── (dashboard)/layout
│   ├── Header
│   │   ├── Navigation
│   │   │   └── HotelUnitFilter
│   │   │       └── Select (ui)
│   │   ├── SocketStatus
│   │   │   └── Badge (ui)
│   │   ├── UserAvatar
│   │   │   ├── Avatar (ui)
│   │   │   └── DropdownMenu (ui)
│   │   └── ThemeToggle
│   │       └── Button (ui)
│   ├── Sidebar
│   │   ├── Navigation
│   │   │   └── Button (ui)
│   │   └── QuickStats
│   │       └── Badge (ui)
│   ├── MobileMenu
│   │   └── Sheet (ui)
│   │
│   ├── DashboardPage (/)
│   │   ├── StatsCard
│   │   │   └── Card (ui)
│   │   ├── ConversationKanban
│   │   │   ├── ConversationCard
│   │   │   │   ├── Card (ui)
│   │   │   │   ├── ContactAvatar
│   │   │   │   │   └── Avatar (ui)
│   │   │   │   ├── ConversationStatusBadge
│   │   │   │   │   └── Badge (ui)
│   │   │   │   └── ConversationPriorityBadge
│   │   │   │       └── Badge (ui)
│   │   │   └── ScrollArea (ui)
│   │   ├── RecentEscalations
│   │   │   ├── Card (ui)
│   │   │   └── EscalationCard
│   │   │       ├── EscalationStatusBadge
│   │   │       │   └── Badge (ui)
│   │   │       └── EscalationReasonBadge
│   │   │           └── Badge (ui)
│   │   ├── ActivityFeed
│   │   │   ├── Card (ui)
│   │   │   └── ScrollArea (ui)
│   │   └── QuickActions
│   │       ├── Card (ui)
│   │       └── Button (ui)
│   │
│   ├── ConversationsPage (/conversations)
│   │   ├── ConversationFilters
│   │   │   ├── SearchInput
│   │   │   │   └── Input (ui)
│   │   │   ├── Select (ui)
│   │   │   ├── HotelUnitFilter
│   │   │   └── Button (ui)
│   │   ├── ConversationKanban
│   │   │   └── ConversationCard
│   │   └── Pagination
│   │
│   ├── ConversationDetailPage (/conversations/[id])
│   │   ├── ConversationDetail
│   │   │   ├── Card (ui)
│   │   │   ├── ContactAvatar
│   │   │   ├── ConversationStatusBadge
│   │   │   ├── ConversationPriorityBadge
│   │   │   └── ConversationActions
│   │   │       ├── Button (ui)
│   │   │       └── DropdownMenu (ui)
│   │   ├── Tabs (ui)
│   │   │   ├── ChatTab
│   │   │   │   └── ChatWindow
│   │   │   │       ├── ChatHeader
│   │   │   │       │   ├── ContactAvatar
│   │   │   │       │   └── Button (ui)
│   │   │   │       ├── MessageList
│   │   │   │       │   └── MessageBubble
│   │   │   │       │       ├── MessageMedia
│   │   │   │       │       │   └── Dialog (ui)
│   │   │   │       │       ├── MessageButtons
│   │   │   │       │       │   └── Button (ui)
│   │   │   │       │       ├── MessageCarousel
│   │   │   │       │       │   └── Card (ui)
│   │   │   │       │       └── Badge (ui)
│   │   │   │       ├── TypingIndicator
│   │   │   │       ├── MessageInput
│   │   │   │       │   ├── Textarea (ui)
│   │   │   │       │   ├── FileUpload
│   │   │   │       │   └── Button (ui)
│   │   │   │       └── QuickReplies
│   │   │   │           └── Button (ui)
│   │   │   ├── ContactTab
│   │   │   │   └── ContactDetail
│   │   │   │       ├── Card (ui)
│   │   │   │       └── Input (ui)
│   │   │   └── EscalationsTab
│   │   │       └── EscalationList
│   │   │           └── EscalationCard
│   │   └── Sidebar
│   │       ├── ConversationList
│   │       │   └── ConversationCard
│   │       └── ScrollArea (ui)
│   │
│   ├── ContactsPage (/contacts)
│   │   ├── SearchInput
│   │   ├── ContactTable
│   │   │   ├── Table (ui)
│   │   │   ├── ContactAvatar
│   │   │   └── DropdownMenu (ui)
│   │   ├── ContactDialog
│   │   │   ├── Dialog (ui)
│   │   │   └── ContactForm
│   │   │       ├── Input (ui)
│   │   │       ├── Textarea (ui)
│   │   │       └── Button (ui)
│   │   └── Pagination
│   │
│   ├── ContactDetailPage (/contacts/[id])
│   │   ├── ContactDetail
│   │   │   ├── Card (ui)
│   │   │   ├── ContactAvatar
│   │   │   └── Button (ui)
│   │   └── ConversationList
│   │       └── ConversationCard
│   │
│   ├── EscalationsPage (/escalations)
│   │   ├── EscalationFilters
│   │   │   ├── Select (ui)
│   │   │   └── DatePicker
│   │   ├── EscalationList
│   │   │   └── EscalationCard
│   │   │       ├── EscalationStatusBadge
│   │   │       ├── EscalationReasonBadge
│   │   │       ├── ContactAvatar
│   │   │       └── Button (ui)
│   │   ├── EscalationDialog
│   │   │   ├── Dialog (ui)
│   │   │   └── EscalationForm
│   │   │       ├── Select (ui)
│   │   │       ├── Textarea (ui)
│   │   │       └── Button (ui)
│   │   └── Pagination
│   │
│   ├── ReportsPage (/reports)
│   │   ├── ReportFilters
│   │   │   ├── DatePicker
│   │   │   │   ├── Popover (ui)
│   │   │   │   └── Calendar (ui)
│   │   │   ├── Select (ui)
│   │   │   └── Button (ui)
│   │   ├── Tabs (ui)
│   │   │   ├── OverviewTab
│   │   │   │   ├── StatsCard
│   │   │   │   └── ReportChart
│   │   │   │       └── Card (ui)
│   │   │   ├── AttendantsTab
│   │   │   │   └── ReportTable
│   │   │   │       ├── Card (ui)
│   │   │   │       └── Table (ui)
│   │   │   └── UsageTab
│   │   │       └── ReportChart
│   │   └── ExportButton
│   │       └── DropdownMenu (ui)
│   │
│   ├── UsersPage (/users)
│   │   ├── SearchInput
│   │   ├── Button (ui)
│   │   ├── UserTable
│   │   │   ├── Table (ui)
│   │   │   ├── UserAvatar
│   │   │   ├── Badge (ui)
│   │   │   └── DropdownMenu (ui)
│   │   ├── UserDialog
│   │   │   ├── Dialog (ui)
│   │   │   └── UserForm
│   │   │       ├── Input (ui)
│   │   │       ├── Select (ui)
│   │   │       └── Button (ui)
│   │   └── Pagination
│   │
│   └── SettingsPage (/settings)
│       ├── Tabs (ui)
│       ├── ProfileTab
│       │   └── ProfileForm
│       │       ├── Input (ui)
│       │       ├── Avatar (ui)
│       │       └── Button (ui)
│       ├── SecurityTab
│       │   └── PasswordChangeForm
│       │       ├── Input (ui)
│       │       └── Button (ui)
│       ├── NotificationsTab
│       │   └── NotificationSettings
│       │       ├── Switch (ui)
│       │       └── Button (ui)
│       └── WhatsAppTab (ADMIN only)
│           └── WhatsAppIntegration
│               ├── Card (ui)
│               ├── Input (ui)
│               └── Button (ui)
│
└── (admin)/layout (SUPER_ADMIN only)
    ├── TenantsPage (/admin/tenants)
    │   ├── TenantList
    │   │   └── TenantCard
    │   │       ├── Card (ui)
    │   │       ├── Badge (ui)
    │   │       └── DropdownMenu (ui)
    │   ├── TenantDialog
    │   │   ├── Dialog (ui)
    │   │   └── TenantForm
    │   │       ├── Input (ui)
    │   │       ├── Select (ui)
    │   │       ├── Tabs (ui)
    │   │       │   ├── GeneralTab
    │   │       │   └── WhatsAppTab
    │   │       │       └── WhatsAppConfig
    │   │       └── Button (ui)
    │   └── Pagination
    │
    ├── UsagePage (/admin/usage)
    │   ├── ReportFilters
    │   ├── UsageCharts
    │   │   └── ReportChart
    │   └── UsageTable
    │       └── Table (ui)
    │
    └── AuditLogsPage (/admin/audit-logs)
        ├── SearchInput
        ├── AuditLogTable
        │   ├── Table (ui)
        │   └── Dialog (ui)
        └── Pagination
```

## 3. Componentes Compartilhados

### 3.1 Layout Components

#### Header
```typescript
interface HeaderProps {
  user: User;
  tenant: Tenant;
}

// Responsabilidade: Cabeçalho principal com navegação, filtro de unidade e menu do usuário
```

#### Sidebar
```typescript
interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  userRole: Role;
}

// Responsabilidade: Menu lateral de navegação com itens baseados em role
```

#### Navigation
```typescript
interface NavigationProps {
  items: NavigationItem[];
  currentPath: string;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType;
  badge?: number;
  roles: Role[];
}

// Responsabilidade: Lista de links de navegação com badges de notificação
```

#### MobileMenu
```typescript
interface MobileMenuProps {
  items: NavigationItem[];
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

// Responsabilidade: Menu mobile responsivo com Sheet do shadcn/ui
```

#### HotelUnitFilter
```typescript
interface HotelUnitFilterProps {
  value: string | null;
  onChange: (unit: string | null) => void;
  hotelUnits: string[];
}

// Responsabilidade: Filtro de unidade hoteleira no header
```

### 3.2 Dashboard Components

#### StatsCard
```typescript
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

// Responsabilidade: Card de estatísticas com ícone e tendência
```

#### RecentEscalations
```typescript
interface RecentEscalationsProps {
  escalations: Escalation[];
  onEscalationClick: (escalationId: string) => void;
  maxItems?: number;
}

// Responsabilidade: Lista de escalações recentes pendentes
```

#### ActivityFeed
```typescript
interface ActivityFeedProps {
  activities: Activity[];
  maxItems?: number;
}

interface Activity {
  id: string;
  type: 'message_received' | 'message_sent' | 'conversation_assigned' |
        'conversation_closed' | 'escalation_created' | 'escalation_resolved';
  message: string;
  timestamp: Date;
  user?: User;
  contact?: Contact;
}

// Responsabilidade: Feed de atividades em tempo real
```

#### QuickActions
```typescript
interface QuickActionsProps {
  userRole: Role;
  onAction: (action: string) => void;
}

// Responsabilidade: Ações rápidas baseadas no papel do usuário
```

### 3.3 Conversation Components

#### ConversationKanban
```typescript
interface ConversationKanbanProps {
  conversations: Conversation[];
  isLoading?: boolean;
  onConversationClick: (conversationId: string) => void;
  onStatusChange: (conversationId: string, status: ConversationStatus) => void;
}

// Responsabilidade: Visualização Kanban de conversas por status
```

#### ConversationList
```typescript
interface ConversationListProps {
  conversations: Conversation[];
  isLoading?: boolean;
  selectedId?: string;
  onConversationClick: (conversationId: string) => void;
  emptyMessage?: string;
}

// Responsabilidade: Lista lateral de conversas
```

#### ConversationCard
```typescript
interface ConversationCardProps {
  conversation: Conversation;
  isSelected?: boolean;
  onClick?: () => void;
  showActions?: boolean;
}

// Responsabilidade: Card individual de conversa com preview
```

#### ConversationDetail
```typescript
interface ConversationDetailProps {
  conversation: Conversation;
  onUpdate: (data: Partial<Conversation>) => void;
  onClose: () => void;
  onAssign: (userId: string) => void;
}

// Responsabilidade: Detalhes completos da conversa com ações
```

#### ConversationFilters
```typescript
interface ConversationFiltersProps {
  onFilterChange: (filters: ConversationFilters) => void;
  hotelUnits: string[];
  users: User[];
}

interface ConversationFilters {
  search?: string;
  status?: ConversationStatus[];
  priority?: Priority[];
  hotelUnit?: string;
  assignedToId?: string;
  dateRange?: { from: Date; to: Date };
}

// Responsabilidade: Filtros de busca de conversas
```

#### ConversationStatusBadge
```typescript
interface ConversationStatusBadgeProps {
  status: ConversationStatus;
  size?: 'sm' | 'md' | 'lg';
}

type ConversationStatus = 'BOT_HANDLING' | 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'CLOSED';

// Responsabilidade: Badge de status com cores específicas
// BOT_HANDLING = roxo, OPEN = vermelho, IN_PROGRESS = amarelo,
// WAITING = laranja, CLOSED = verde
```

#### ConversationPriorityBadge
```typescript
interface ConversationPriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md' | 'lg';
}

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Responsabilidade: Badge de prioridade com cores específicas
// LOW = cinza, MEDIUM = azul, HIGH = laranja, URGENT = vermelho
```

#### ConversationActions
```typescript
interface ConversationActionsProps {
  conversation: Conversation;
  onAssign: () => void;
  onClose: () => void;
  onReopen: () => void;
  onEscalate: () => void;
  onChangePriority: (priority: Priority) => void;
}

// Responsabilidade: Dropdown de ações da conversa
```

### 3.4 Chat Components

#### ChatWindow
```typescript
interface ChatWindowProps {
  conversationId: string;
  contact: Contact;
  isIaLocked: boolean;
  onSendMessage: (content: string, type: MessageType) => void;
  onSendMedia: (file: File, caption?: string) => void;
}

// Responsabilidade: Janela principal de chat em tempo real
```

#### ChatHeader
```typescript
interface ChatHeaderProps {
  contact: Contact;
  conversation: Conversation;
  isOnline?: boolean;
  onViewContact: () => void;
  onActions: () => void;
}

// Responsabilidade: Cabeçalho do chat com info do contato
```

#### MessageList
```typescript
interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore: () => void;
}

// Responsabilidade: Lista de mensagens com scroll infinito
```

#### MessageBubble
```typescript
interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTimestamp?: boolean;
  onRetry?: () => void;
}

// Responsabilidade: Balão de mensagem individual
```

#### MessageMedia
```typescript
interface MessageMediaProps {
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  url: string;
  mimeType?: string;
  caption?: string;
  onView?: () => void;
  onDownload?: () => void;
}

// Responsabilidade: Visualização de mídia na mensagem
```

#### MessageButtons
```typescript
interface MessageButtonsProps {
  buttons: InteractiveButton[];
  disabled?: boolean;
}

interface InteractiveButton {
  id: string;
  title: string;
}

// Responsabilidade: Botões interativos na mensagem
```

#### MessageCarousel
```typescript
interface MessageCarouselProps {
  cards: CarouselCard[];
}

interface CarouselCard {
  imageUrl: string;
  title?: string;
  buttons: InteractiveButton[];
}

// Responsabilidade: Carousel de cards na mensagem
```

#### MessageInput
```typescript
interface MessageInputProps {
  onSend: (content: string) => void;
  onSendMedia: (file: File, caption?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Responsabilidade: Input de mensagem com upload de mídia
```

#### TypingIndicator
```typescript
interface TypingIndicatorProps {
  isTyping: boolean;
  name?: string;
}

// Responsabilidade: Indicador "digitando..."
```

#### QuickReplies
```typescript
interface QuickRepliesProps {
  replies: QuickReply[];
  onSelect: (reply: QuickReply) => void;
}

interface QuickReply {
  id: string;
  label: string;
  content: string;
}

// Responsabilidade: Respostas rápidas pré-definidas
```

### 3.5 Contact Components

#### ContactList
```typescript
interface ContactListProps {
  contacts: Contact[];
  isLoading?: boolean;
  onContactClick: (contactId: string) => void;
}

// Responsabilidade: Lista de contatos com busca
```

#### ContactTable
```typescript
interface ContactTableProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onView: (contactId: string) => void;
  onBlock: (contactId: string) => void;
}

// Responsabilidade: Tabela de contatos com ações
```

#### ContactDetail
```typescript
interface ContactDetailProps {
  contact: Contact;
  conversations: Conversation[];
  onUpdate: (data: Partial<Contact>) => void;
  onBlock: () => void;
}

// Responsabilidade: Detalhes do contato com histórico de conversas
```

#### ContactAvatar
```typescript
interface ContactAvatarProps {
  contact: Contact;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showOnlineStatus?: boolean;
}

// Responsabilidade: Avatar do contato com fallback de iniciais
```

#### ContactDialog
```typescript
interface ContactDialogProps {
  contact?: Contact;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ContactFormData) => Promise<void>;
}

// Responsabilidade: Modal de edição de contato
```

### 3.6 Escalation Components

#### EscalationList
```typescript
interface EscalationListProps {
  escalations: Escalation[];
  isLoading?: boolean;
  onEscalationClick: (escalationId: string) => void;
  onResolve: (escalationId: string) => void;
}

// Responsabilidade: Lista de escalações com filtros
```

#### EscalationCard
```typescript
interface EscalationCardProps {
  escalation: Escalation;
  onClick?: () => void;
  showActions?: boolean;
  onResolve?: () => void;
}

// Responsabilidade: Card de escalação com info resumida
```

#### EscalationStatusBadge
```typescript
interface EscalationStatusBadgeProps {
  status: EscalationStatus;
  size?: 'sm' | 'md' | 'lg';
}

type EscalationStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';

// Responsabilidade: Badge de status da escalação
// PENDING = vermelho, IN_PROGRESS = amarelo, RESOLVED = verde, CANCELLED = cinza
```

#### EscalationReasonBadge
```typescript
interface EscalationReasonBadgeProps {
  reason: EscalationReason;
}

type EscalationReason = 'USER_REQUESTED' | 'AI_UNABLE' | 'COMPLEX_QUERY' |
                        'COMPLAINT' | 'PAYMENT_ISSUE' | 'URGENT' | 'OTHER';

// Responsabilidade: Badge de motivo da escalação
```

#### EscalationDialog
```typescript
interface EscalationDialogProps {
  escalation?: Escalation;
  conversationId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EscalationFormData) => Promise<void>;
}

// Responsabilidade: Modal de criação/edição de escalação
```

### 3.7 User Components

#### UserTable
```typescript
interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onToggleStatus: (userId: string) => void;
}

// Responsabilidade: Tabela de usuários com ações administrativas
```

#### UserForm
```typescript
interface UserFormProps {
  initialData?: Partial<User>;
  hotelUnits: string[];
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel?: () => void;
}

interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: Role;
  status: UserStatus;
  hotelUnit?: string;
}

// Responsabilidade: Formulário de criação/edição de usuário
```

#### UserDialog
```typescript
interface UserDialogProps {
  user?: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UserFormData) => Promise<void>;
}

// Responsabilidade: Modal de criação/edição de usuário
```

#### UserAvatar
```typescript
interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  onClick?: () => void;
}

// Responsabilidade: Avatar do usuário com dropdown de menu
```

### 3.8 Tenant Components (SUPER_ADMIN)

#### TenantList
```typescript
interface TenantListProps {
  tenants: Tenant[];
  onTenantClick: (tenantId: string) => void;
  onEdit: (tenant: Tenant) => void;
  onDelete: (tenantId: string) => void;
}

// Responsabilidade: Lista de tenants (hotéis)
```

#### TenantForm
```typescript
interface TenantFormProps {
  initialData?: Partial<Tenant>;
  onSubmit: (data: TenantFormData) => Promise<void>;
  onCancel?: () => void;
}

interface TenantFormData {
  name: string;
  slug: string;
  email?: string;
  plan: Plan;
  status: TenantStatus;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappAccessToken?: string;
  whatsappAppSecret?: string;
  n8nWebhookUrl?: string;
}

// Responsabilidade: Formulário de criação/edição de tenant
```

#### TenantDialog
```typescript
interface TenantDialogProps {
  tenant?: Tenant;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TenantFormData) => Promise<void>;
}

// Responsabilidade: Modal de criação/edição de tenant
```

#### WhatsAppConfig
```typescript
interface WhatsAppConfigProps {
  tenant: Tenant;
  onSave: (data: WhatsAppConfigData) => Promise<void>;
  onTest: () => Promise<boolean>;
}

interface WhatsAppConfigData {
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  whatsappAccessToken: string;
  whatsappAppSecret: string;
}

// Responsabilidade: Configuração de integração WhatsApp
```

### 3.9 Report Components

#### ReportFilters
```typescript
interface ReportFiltersProps {
  onFilterChange: (filters: ReportFilters) => void;
  hotelUnits: string[];
  users: User[];
}

interface ReportFilters {
  dateRange: { from: Date; to: Date };
  groupBy?: 'day' | 'week' | 'month';
  hotelUnit?: string;
  userId?: string;
}

// Responsabilidade: Filtros para geração de relatórios
```

#### ReportChart
```typescript
interface ReportChartProps {
  data: ChartData[];
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  height?: number;
}

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

// Responsabilidade: Gráficos de relatórios
```

#### ReportTable
```typescript
interface ReportTableProps {
  data: ReportData[];
  columns: ReportColumn[];
  title: string;
}

// Responsabilidade: Tabela de dados de relatório
```

#### ExportButton
```typescript
interface ExportButtonProps {
  data: any[];
  filename: string;
  formats: ('csv' | 'xlsx' | 'pdf')[];
  onExport?: (format: string) => Promise<void>;
}

// Responsabilidade: Botão de exportação de relatórios
```

### 3.10 Settings Components

#### ProfileForm
```typescript
interface ProfileFormProps {
  user: User;
  onSubmit: (data: ProfileData) => Promise<void>;
}

interface ProfileData {
  name: string;
  email: string;
  avatar?: File;
}

// Responsabilidade: Formulário de edição de perfil
```

#### PasswordChangeForm
```typescript
interface PasswordChangeFormProps {
  onSubmit: (data: PasswordChangeData) => Promise<void>;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Responsabilidade: Formulário de alteração de senha
```

#### NotificationSettings
```typescript
interface NotificationSettingsProps {
  settings: NotificationSettings;
  onUpdate: (settings: NotificationSettings) => Promise<void>;
}

interface NotificationSettings {
  desktopNotifications: boolean;
  soundNotifications: boolean;
  emailDigest: 'none' | 'daily' | 'weekly';
}

// Responsabilidade: Configurações de notificações
```

#### WhatsAppIntegration
```typescript
interface WhatsAppIntegrationProps {
  tenant: Tenant;
  onSave: (data: WhatsAppConfigData) => Promise<void>;
  onTest: () => Promise<{ success: boolean; message: string }>;
}

// Responsabilidade: Configuração de WhatsApp para ADMIN
```

### 3.11 Shared Components

#### LoadingSpinner
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

// Responsabilidade: Indicador de carregamento
```

#### ErrorBoundary
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

// Responsabilidade: Tratamento de erros em componentes
```

#### EmptyState
```typescript
interface EmptyStateProps {
  icon?: React.ComponentType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Responsabilidade: Estado vazio de listas e tabelas
```

#### ConfirmationDialog
```typescript
interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  variant?: 'default' | 'danger';
  confirmText?: string;
  cancelText?: string;
}

// Responsabilidade: Modal de confirmação de ações
```

#### SearchInput
```typescript
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  onClear?: () => void;
}

// Responsabilidade: Input de busca com debounce
```

#### Pagination
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

// Responsabilidade: Controles de paginação
```

#### DataTable
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  pagination?: PaginationProps;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  selection?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
}

// Responsabilidade: Tabela de dados com sorting, pagination e seleção
```

#### FileUpload
```typescript
interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  onError?: (error: string) => void;
  value?: File[];
}

// Responsabilidade: Componente de upload de arquivos com validação
```

#### DatePicker
```typescript
interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledDates?: (date: Date) => boolean;
  mode?: 'single' | 'range';
}

// Responsabilidade: Seletor de data com calendário
```

#### ThemeToggle
```typescript
interface ThemeToggleProps {
  variant?: 'icon' | 'text' | 'dropdown';
}

// Responsabilidade: Toggle de tema claro/escuro
```

#### SocketStatus
```typescript
interface SocketStatusProps {
  isConnected: boolean;
  lastEvent?: Date;
}

// Responsabilidade: Indicador de status da conexão WebSocket
```

## 4. Provider Components

### AuthProvider
```typescript
interface AuthProviderProps {
  children: React.ReactNode;
}

interface AuthContextValue {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// Responsabilidade: Gerenciamento de estado de autenticação
```

### ThemeProvider
```typescript
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
  storageKey?: string;
}

interface ThemeContextValue {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// Responsabilidade: Gerenciamento de tema da aplicação
```

### SocketProvider
```typescript
interface SocketProviderProps {
  children: React.ReactNode;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
}

// Responsabilidade: Gerenciamento de conexão WebSocket
```

### QueryClientProvider
```typescript
import { QueryClient, QueryClientProvider as RQProvider } from '@tanstack/react-query';

interface QueryProviderProps {
  children: React.ReactNode;
}

// Responsabilidade: Configuração do React Query para cache e estado servidor
```

## 5. Hooks

### useAuth
```typescript
function useAuth(): {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// Responsabilidade: Hook de acesso ao contexto de autenticação
```

### useConversations
```typescript
function useConversations(filters?: ConversationFilters): {
  conversations: Conversation[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  updateConversation: (id: string, data: Partial<Conversation>) => Promise<Conversation>;
  assignConversation: (id: string, userId: string) => Promise<void>;
  closeConversation: (id: string) => Promise<void>;
}

// Responsabilidade: Gerenciamento de conversas com React Query
```

### useMessages
```typescript
function useMessages(conversationId: string): {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  sendText: (content: string) => Promise<Message>;
  sendMedia: (file: File, caption?: string) => Promise<Message>;
  markAsRead: (messageId: string) => Promise<void>;
}

// Responsabilidade: Gerenciamento de mensagens com paginação infinita
```

### useContacts
```typescript
function useContacts(filters?: ContactFilters): {
  contacts: Contact[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  updateContact: (id: string, data: Partial<Contact>) => Promise<Contact>;
  blockContact: (id: string) => Promise<void>;
}

// Responsabilidade: Gerenciamento de contatos com React Query
```

### useEscalations
```typescript
function useEscalations(filters?: EscalationFilters): {
  escalations: Escalation[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  createEscalation: (data: EscalationFormData) => Promise<Escalation>;
  resolveEscalation: (id: string, resolution: string) => Promise<void>;
}

// Responsabilidade: Gerenciamento de escalações
```

### useUsers
```typescript
function useUsers(filters?: UserFilters): {
  users: User[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  createUser: (data: UserFormData) => Promise<User>;
  updateUser: (id: string, data: Partial<User>) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<void>;
}

// Responsabilidade: Gerenciamento de usuários
```

### useTenants (SUPER_ADMIN)
```typescript
function useTenants(): {
  tenants: Tenant[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  createTenant: (data: TenantFormData) => Promise<Tenant>;
  updateTenant: (id: string, data: Partial<Tenant>) => Promise<Tenant>;
  deleteTenant: (id: string) => Promise<void>;
}

// Responsabilidade: Gerenciamento de tenants (SUPER_ADMIN only)
```

### useReports
```typescript
function useReports(type: ReportType, filters: ReportFilters): {
  data: ReportData[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  exportReport: (format: 'csv' | 'xlsx' | 'pdf') => Promise<void>;
}

// Responsabilidade: Geração e exportação de relatórios
```

### useSocket
```typescript
function useSocket(): {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
}

// Responsabilidade: Hook de acesso ao contexto de WebSocket
```

### useToast
```typescript
function useToast(): {
  toast: (options: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// Responsabilidade: Exibição de notificações toast
```

### useDebounce
```typescript
function useDebounce<T>(value: T, delay: number): T;

// Responsabilidade: Debounce de valores (útil para inputs de busca)
```

### usePagination
```typescript
function usePagination<T>(
  items: T[],
  pageSize: number
): {
  currentPage: number;
  totalPages: number;
  pageItems: T[];
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

// Responsabilidade: Lógica de paginação cliente-side
```

### useTheme
```typescript
function useTheme(): {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}

// Responsabilidade: Gerenciamento de tema
```

## 6. Funções Utilitárias

### lib/api.ts
```typescript
export const api: {
  get: <T>(url: string, config?: RequestConfig) => Promise<T>;
  post: <T>(url: string, data?: any, config?: RequestConfig) => Promise<T>;
  patch: <T>(url: string, data?: any, config?: RequestConfig) => Promise<T>;
  delete: <T>(url: string, config?: RequestConfig) => Promise<T>;
}

// Responsabilidade: Cliente HTTP com autenticação e interceptors
// Inclui refresh automático de token
```

### lib/socket.ts
```typescript
export function createSocket(token: string): Socket;
export function subscribeToConversation(socket: Socket, conversationId: string): void;
export function unsubscribeFromConversation(socket: Socket, conversationId: string): void;

// Responsabilidade: Gerenciamento de conexão Socket.io
```

### lib/utils.ts
```typescript
export function cn(...inputs: ClassValue[]): string;
export function formatDate(date: Date, format?: string): string;
export function formatRelativeTime(date: Date): string;
export function formatPhone(phone: string): string;
export function formatFileSize(bytes: number): string;
export function truncate(text: string, length: number): string;
export function getInitials(name: string): string;
export function generateId(): string;

// Responsabilidade: Funções utilitárias gerais
```

### lib/validations.ts
```typescript
import { z } from 'zod';

export const loginSchema: z.ZodSchema;
export const userSchema: z.ZodSchema;
export const contactSchema: z.ZodSchema;
export const escalationSchema: z.ZodSchema;
export const tenantSchema: z.ZodSchema;
export const messageSchema: z.ZodSchema;
export const passwordChangeSchema: z.ZodSchema;

// Responsabilidade: Schemas de validação com Zod
```

### lib/constants.ts
```typescript
export const CONVERSATION_STATUS: Record<ConversationStatus, string>;
export const CONVERSATION_STATUS_COLORS: Record<ConversationStatus, string>;
export const PRIORITY: Record<Priority, string>;
export const PRIORITY_COLORS: Record<Priority, string>;
export const ESCALATION_STATUS: Record<EscalationStatus, string>;
export const ESCALATION_REASONS: Record<EscalationReason, string>;
export const USER_ROLES: Record<Role, string>;
export const HOTEL_UNITS: string[];
export const MESSAGE_TYPES: Record<MessageType, string>;
export const FILE_SIZE_LIMIT: number;
export const ALLOWED_FILE_TYPES: string[];
export const PAGINATION_PAGE_SIZE: number;
export const DEBOUNCE_DELAY: number;

// Responsabilidade: Constantes da aplicação
```

### lib/formatters.ts
```typescript
export function formatConversationStatus(status: ConversationStatus): string;
export function formatPriority(priority: Priority): string;
export function formatEscalationStatus(status: EscalationStatus): string;
export function formatEscalationReason(reason: EscalationReason): string;
export function formatUserRole(role: Role): string;
export function formatMessageType(type: MessageType): string;
export function formatDuration(milliseconds: number): string;

// Responsabilidade: Formatadores de dados para exibição
```

## 7. Definições de Tipos

### types/conversation.ts
```typescript
export interface Conversation {
  id: string;
  tenantId: string;
  contactId: string;
  contact: Contact;
  assignedToId?: string;
  assignedTo?: User;
  status: ConversationStatus;
  priority: Priority;
  iaLocked: boolean;
  iaLockedAt?: Date;
  iaLockedBy?: string;
  hotelUnit?: string;
  lastMessageAt: Date;
  metadata?: Record<string, any>;
  tags: Tag[];
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStatus =
  | 'BOT_HANDLING'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'CLOSED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
```

### types/message.ts
```typescript
export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  whatsappMessageId?: string;
  type: MessageType;
  direction: Direction;
  content?: string;
  mediaUrl?: string;
  mediaId?: string;
  mimeType?: string;
  status: MessageStatus;
  timestamp: Date;
  metadata?: Record<string, any>;
  sentById?: string;
  sentBy?: User;
  createdAt: Date;
}

export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'LOCATION'
  | 'CONTACT'
  | 'STICKER'
  | 'INTERACTIVE'
  | 'TEMPLATE'
  | 'REACTION'
  | 'UNKNOWN';

export type Direction = 'INBOUND' | 'OUTBOUND';

export type MessageStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';
```

### types/contact.ts
```typescript
export interface Contact {
  id: string;
  tenantId: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  profilePictureUrl?: string;
  isBlocked: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### types/escalation.ts
```typescript
export interface Escalation {
  id: string;
  tenantId: string;
  conversationId: string;
  conversation?: Conversation;
  reason: EscalationReason;
  reasonDetail?: string;
  status: EscalationStatus;
  priority: Priority;
  hotelUnit?: string;
  resolvedById?: string;
  resolvedBy?: User;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EscalationReason =
  | 'USER_REQUESTED'
  | 'AI_UNABLE'
  | 'COMPLEX_QUERY'
  | 'COMPLAINT'
  | 'PAYMENT_ISSUE'
  | 'URGENT'
  | 'OTHER';

export type EscalationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CANCELLED';
```

### types/user.ts
```typescript
export interface User {
  id: string;
  tenantId?: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  hotelUnit?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'ATTENDANT';

export type UserStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED';
```

### types/tenant.ts
```typescript
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email?: string;
  status: TenantStatus;
  plan: Plan;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappAccessToken?: string;
  whatsappAppSecret?: string;
  n8nWebhookUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED';

export type Plan =
  | 'FREE'
  | 'STARTER'
  | 'PROFESSIONAL'
  | 'ENTERPRISE';
```

## 8. Componentes shadcn/ui Utilizados

### Componentes Base
- **Button**: Botões com variantes (default, destructive, outline, ghost, link)
- **Input**: Campos de entrada de texto
- **Textarea**: Campos de texto multilinha
- **Label**: Labels para formulários
- **Select**: Seletor dropdown
- **Switch**: Toggle switches

### Componentes de Layout
- **Card**: Containers para conteúdo
- **Separator**: Divisores visuais
- **Tabs**: Navegação em abas
- **Sheet**: Painéis laterais deslizantes (mobile menu)
- **Scroll Area**: Áreas de scroll customizadas (chat)

### Componentes de Feedback
- **Alert**: Alertas e mensagens
- **Toast**: Notificações temporárias
- **Dialog**: Modais e diálogos
- **Skeleton**: Loading placeholders

### Componentes de Navegação
- **Dropdown Menu**: Menus dropdown
- **Navigation Menu**: Menus de navegação

### Componentes de Data
- **Table**: Tabelas de dados
- **Calendar**: Calendários
- **Popover**: Popovers para conteúdo adicional
- **Command**: Command palette para busca

### Componentes de Display
- **Avatar**: Avatares de usuário/contato
- **Badge**: Badges e tags (status, prioridade)

### Componentes de Formulário
- **Form**: Wrapper de formulários com validação
- **Form Field**: Campos de formulário
- **Form Item**: Items de formulário
- **Form Label**: Labels de formulário
- **Form Message**: Mensagens de erro/validação

## 9. Estrutura de Rotas

### Rotas Públicas
```
/login              - LoginPage
```

### Rotas Protegidas (Dashboard)
```
/                            - DashboardPage (redirect para /conversations se ATTENDANT)
/conversations               - ConversationsPage (Kanban)
/conversations/[id]          - ConversationDetailPage (Chat)
/contacts                    - ContactsPage
/contacts/[id]               - ContactDetailPage
/escalations                 - EscalationsPage
/reports                     - ReportsPage (ADMIN, MANAGER)
/users                       - UsersPage (ADMIN)
/settings                    - SettingsPage
```

### Rotas Admin (SUPER_ADMIN)
```
/admin/tenants               - TenantsPage
/admin/tenants/[id]          - TenantDetailPage
/admin/usage                 - UsagePage
/admin/audit-logs            - AuditLogsPage
```

## 10. Convenções de Nomenclatura

### Componentes
- PascalCase para nomes de componentes
- Sufixo descritivo: `Form`, `List`, `Table`, `Dialog`, `Card`, `Badge`
- Exemplos: `ConversationCard`, `EscalationDialog`, `ContactTable`

### Hooks
- camelCase iniciado com `use`
- Exemplos: `useAuth`, `useConversations`, `useSocket`

### Tipos e Interfaces
- PascalCase para interfaces e types
- Sufixo `Props` para props de componentes
- Sufixo `Data` para dados de formulário
- Exemplos: `ConversationCardProps`, `UserFormData`

### Arquivos
- kebab-case para arquivos
- Exemplos: `conversation-card.tsx`, `user-table.tsx`, `use-auth.ts`

### Variáveis e Funções
- camelCase para variáveis e funções
- Exemplos: `conversationList`, `handleSubmit`, `formatDate`

### Constantes
- UPPER_SNAKE_CASE para constantes globais
- Exemplos: `CONVERSATION_STATUS`, `API_BASE_URL`, `MAX_FILE_SIZE`

## 11. Eventos Socket.io

### Eventos Recebidos (Server → Client)
```typescript
// Nova mensagem recebida
socket.on('message:new', (message: Message) => void)

// Status da mensagem atualizado
socket.on('message:status', (data: { id: string; status: MessageStatus }) => void)

// Nova conversa criada
socket.on('conversation:new', (conversation: Conversation) => void)

// Conversa atualizada
socket.on('conversation:updated', (conversation: Partial<Conversation>) => void)

// Nova escalação criada
socket.on('escalation:new', (escalation: Escalation) => void)

// Indicador de digitação
socket.on('typing:start', (data: { conversationId: string }) => void)
socket.on('typing:stop', (data: { conversationId: string }) => void)
```

### Eventos Emitidos (Client → Server)
```typescript
// Entrar na sala do tenant
socket.emit('join:tenant', { tenantId: string })

// Entrar na sala de uma conversa específica
socket.emit('join:conversation', { conversationId: string })

// Sair da sala de uma conversa
socket.emit('leave:conversation', { conversationId: string })

// Indicar que está digitando
socket.emit('typing', { conversationId: string, isTyping: boolean })
```

---

Última atualização: Dezembro de 2025

**Desenvolvido por [3ian](https://3ian.com.br)** - Soluções em Tecnologia e Automação
