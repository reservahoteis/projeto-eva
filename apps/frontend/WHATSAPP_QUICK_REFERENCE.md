# WhatsApp UI - Referência Rápida

## Componentes Criados

### 📦 6 Componentes Novos

```
apps/frontend/src/components/chat/
├── message-bubble.tsx      # Balão de mensagem
├── chat-header.tsx         # Header da conversa
├── chat-input.tsx          # Input de mensagem
├── message-list.tsx        # Lista de mensagens
├── date-divider.tsx        # Divisor de data
└── typing-indicator.tsx    # Indicador "digitando..."
```

---

## Estrutura Visual

```
┌─────────────────────────────────────────────────────────────┐
│ ChatHeader (59px)                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Avatar] Nome                        [🎥] [📞] [🔍] [⋮] │ │
│ │ Últ. vez: 20/11 às 10:23                                │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ MessageList (flex-1, scrollable)                            │
│                                                             │
│  ┌─────────────┐ HOJE ┌─────────────┐                      │
│                                                             │
│  ┌────────────────────────┐                                │
│  │ Olá, tudo bem?         │ 10:23                          │ ← Recebida
│  └────────────────────────┘                                │
│                                                             │
│                       ┌──────────────────────┐             │
│                       │ Sim, e você?         │ 10:24 ✓✓   │ ← Enviada
│                       └──────────────────────┘             │
│                                                             │
│  ┌────────────────────────┐                                │
│  │ ● ● ● digitando...     │                                │ ← Typing
│  └────────────────────────┘                                │
│                                                             │
│                                            [↓] Scroll       │ ← Button
├─────────────────────────────────────────────────────────────┤
│ ChatInput (62px)                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [😊] [📎] [Digite uma mensagem ___________] [🎤]/[➤]   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Cores WhatsApp

```css
/* Backgrounds */
--chat-bg: #e5ddd5         /* Bege claro com pattern */
--header-bg: #f0f2f5       /* Cinza claro */
--input-bg: #f0f2f5        /* Cinza claro */

/* Messages */
--msg-incoming: #ffffff    /* Branco */
--msg-outgoing: #d9fdd3    /* Verde claro */

/* Text */
--text-primary: #111b21    /* Preto suave */
--text-secondary: #667781  /* Cinza médio */

/* Status */
--status-read: #53bdeb     /* Azul WhatsApp ✓✓ */
--status-sent: #667781     /* Cinza ✓ */
--online: #25d366          /* Verde online ● */
```

---

## Status de Mensagem

| Status | Ícone | Cor | Descrição |
|--------|-------|-----|-----------|
| PENDING | ⏱️ (spinner) | #667781 | Enviando... |
| SENT | ✓ | #667781 | Enviada |
| DELIVERED | ✓✓ | #667781 | Entregue |
| READ | ✓✓ | #53bdeb | Lida |
| FAILED | ❌ | red-500 | Erro |

---

## Imports Rápidos

```typescript
// Importar tudo de uma vez
import {
  ChatHeader,
  MessageList,
  ChatInput,
  MessageBubble,
  DateDivider,
  TypingIndicator
} from '@/components/chat';

// Ou individual
import { ChatHeader } from '@/components/chat/chat-header';
```

---

## Uso Básico

### Layout Completo

```typescript
<div className="flex flex-col h-screen">
  <ChatHeader
    conversation={conversation}
    isOnline={false}
    isTyping={isTyping}
    isConnected={true}
  />

  <MessageList
    messages={messages}
    isTyping={isTyping}
    contactName="João"
    contactAvatar="/avatar.jpg"
  />

  <ChatInput
    onSendMessage={(content) => console.log(content)}
    onTypingChange={(typing) => setIsTyping(typing)}
    disabled={false}
    isLoading={false}
  />
</div>
```

---

## Props Principais

### ChatHeader

```typescript
interface ChatHeaderProps {
  conversation: Conversation;     // Dados da conversa
  isOnline?: boolean;             // Mostrar bolinha verde
  isTyping?: boolean;             // "digitando..."
  isConnected?: boolean;          // Status Socket.io
}
```

### MessageList

```typescript
interface MessageListProps {
  messages: Message[];            // Array de mensagens
  isTyping?: boolean;             // Mostrar typing indicator
  contactName: string;            // Nome do contato
  contactAvatar?: string;         // URL do avatar
}
```

### ChatInput

```typescript
interface ChatInputProps {
  onSendMessage: (content: string) => void;   // Callback enviar
  onTypingChange?: (isTyping: boolean) => void; // Callback typing
  disabled?: boolean;                          // Desabilitar input
  isLoading?: boolean;                         // Loading state
}
```

### MessageBubble

```typescript
interface MessageBubbleProps {
  message: Message;               // Dados da mensagem
  isOwnMessage: boolean;          // Nossa mensagem?
  showAvatar: boolean;            // Mostrar avatar?
  groupedWithNext: boolean;       // Próxima é do mesmo?
  contactName?: string;           // Nome do contato
  contactAvatar?: string;         // Avatar do contato
}
```

---

## Funcionalidades

### ✅ Implementado

- [x] Auto-scroll para última mensagem
- [x] Botão "Scroll to Bottom" quando rola up
- [x] Message grouping (5min interval)
- [x] Date dividers (Hoje, Ontem, DD/MM/YYYY)
- [x] Status icons animados (✓, ✓✓, ✓✓ azul)
- [x] Typing indicator com animação
- [x] Suporte a TEXT, IMAGE, VIDEO, AUDIO, DOCUMENT
- [x] Socket.io real-time
- [x] React Query cache optimista
- [x] Responsivo mobile/desktop
- [x] Keyboard navigation (Enter)

### 🔄 Futuro

- [ ] Emoji picker
- [ ] File upload (drag & drop)
- [ ] Voice recording
- [ ] Message search
- [ ] Reactions
- [ ] Forward messages
- [ ] Dark mode

---

## Socket.io Events

### Escutar (Listen)

```typescript
on('message:new', handleNewMessage);
on('message:status', handleStatusUpdate);
on('user:typing', handleTyping);
on('conversation:updated', handleUpdate);
```

### Emitir (Emit)

```typescript
emit('conversation:join', { conversationId });
emit('conversation:leave', { conversationId });
emit('user:typing', { conversationId, isTyping: true });
```

---

## Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `Enter` | Enviar mensagem |
| `Shift + Enter` | Quebra de linha (futuro) |
| `Esc` | Fechar (futuro) |

---

## Debugging

### Console Logs

```typescript
// Ver estado do Socket.io
window.socket

// Ver todas as conversas subscritas
window.socket.emit('debug:subscriptions')

// Forçar typing indicator
window.socket.emit('user:typing', {
  conversationId: 'xxx',
  isTyping: true
})
```

### React Query DevTools

```typescript
// Ver cache de mensagens
queryClient.getQueryData(['messages', conversationId])

// Ver todas as queries
queryClient.getQueryCache().getAll()
```

---

## Performance Tips

1. **Message Limit**: Carregar apenas 50-100 últimas mensagens
2. **Virtualization**: Considerar `react-window` para > 500 msgs
3. **Debounce Typing**: Já implementado (2s)
4. **Image Lazy Load**: Adicionar `loading="lazy"`
5. **Memo Components**: Adicionar `React.memo()` se necessário

---

## Troubleshooting

### Mensagens não aparecem

```typescript
// 1. Verificar Socket.io
console.log('Socket conectado?', socket?.connected);

// 2. Verificar subscription
console.log('Subscrito?', subscribedConversations.has(id));

// 3. Verificar cache
console.log('Cache:', queryClient.getQueryData(['messages', id]));
```

### Scroll não funciona

```typescript
// 1. Verificar ref
console.log('Ref:', messagesEndRef.current);

// 2. Verificar altura container
console.log('Container height:', containerRef.current?.offsetHeight);

// 3. Forçar scroll
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
```

### Typing não aparece

```typescript
// 1. Verificar emit
sendTypingStatus(conversationId, true);

// 2. Verificar listener
console.log('Typing users:', typingUsers.get(conversationId));

// 3. Verificar componente
console.log('isUserTyping?', isUserTyping(conversationId));
```

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `page.tsx` | Página principal (modificada) |
| `message-bubble.tsx` | Componente de balão |
| `chat-header.tsx` | Header da conversa |
| `message-list.tsx` | Lista de mensagens |
| `chat-input.tsx` | Input de texto |
| `date-divider.tsx` | Divisor de data |
| `typing-indicator.tsx` | Indicador digitando |

---

## Documentação Completa

- 📘 **Implementação**: `WHATSAPP_CHAT_IMPLEMENTATION.md`
- 📗 **Migração**: `WHATSAPP_MIGRATION_GUIDE.md`
- 📕 **Exemplos**: `WHATSAPP_USAGE_EXAMPLES.md`
- 📙 **Changelog**: `CHANGELOG_WHATSAPP_UI.md`

---

## Suporte Rápido

### Erros Comuns

```typescript
// ❌ ERRO: Cannot read property 'id' of undefined
// ✅ FIX: Verificar se conversation existe antes de renderizar

if (!conversation) return <Loading />;

// ❌ ERRO: messagesEndRef.current is null
// ✅ FIX: Adicionar ref no final da lista

<div ref={messagesEndRef} />

// ❌ ERRO: Socket not connected
// ✅ FIX: Verificar isConnected antes de usar

{isConnected && <ChatInput />}
```

---

**Versão:** 1.0.0 | **Data:** 2025-11-20 | **Status:** ✅ Completo
