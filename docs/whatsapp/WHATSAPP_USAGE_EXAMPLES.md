# WhatsApp Chat - Exemplos de Uso

## Quick Start

### Uso Básico (Já Implementado)

A interface WhatsApp já está integrada na página de conversas. Acesse:

```
http://localhost:3000/dashboard/conversations/{conversation-id}
```

---

## Exemplos de Código

### 1. Usar Componentes Individuais

```typescript
import {
  ChatHeader,
  MessageList,
  ChatInput,
  MessageBubble,
  DateDivider,
  TypingIndicator
} from '@/components/chat';

// Exemplo: Chat personalizado
function CustomChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      <ChatHeader
        conversation={conversation}
        isOnline={true}
        isTyping={isTyping}
        isConnected={true}
      />

      <MessageList
        messages={messages}
        isTyping={isTyping}
        contactName="João Silva"
        contactAvatar="/avatar.jpg"
      />

      <ChatInput
        onSendMessage={(content) => {
          console.log('Enviando:', content);
        }}
        onTypingChange={setIsTyping}
        disabled={false}
        isLoading={false}
      />
    </div>
  );
}
```

### 2. MessageBubble Standalone

```typescript
import { MessageBubble } from '@/components/chat';
import { Message, MessageDirection, MessageStatus, MessageType } from '@/types';

function MessageExample() {
  const message: Message = {
    id: '1',
    content: 'Olá, como vai?',
    direction: MessageDirection.INBOUND,
    status: MessageStatus.READ,
    type: MessageType.TEXT,
    createdAt: new Date().toISOString(),
    // ... outros campos
  };

  return (
    <MessageBubble
      message={message}
      isOwnMessage={false}
      showAvatar={true}
      groupedWithNext={false}
      contactName="João Silva"
      contactAvatar="/avatar.jpg"
    />
  );
}
```

### 3. DateDivider Standalone

```typescript
import { DateDivider } from '@/components/chat';

function Example() {
  return (
    <div>
      <DateDivider date={new Date()} />
      {/* Mostra "HOJE" */}

      <DateDivider date={new Date('2025-11-19')} />
      {/* Mostra "ONTEM" */}

      <DateDivider date={new Date('2025-11-01')} />
      {/* Mostra "01 DE NOVEMBRO DE 2025" */}
    </div>
  );
}
```

### 4. TypingIndicator Standalone

```typescript
import { TypingIndicator } from '@/components/chat';

function Example() {
  const isTyping = true;

  return (
    <div>
      {isTyping && (
        <TypingIndicator name="João Silva" />
      )}
    </div>
  );
}
```

---

## Snippets Úteis

### Agrupar Mensagens por Data

```typescript
import { format, isSameDay } from 'date-fns';

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: Date; messages: Message[] }[] = [];

  messages.forEach((message) => {
    const messageDate = new Date(message.createdAt);
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || !isSameDay(lastGroup.date, messageDate)) {
      groups.push({ date: messageDate, messages: [message] });
    } else {
      lastGroup.messages.push(message);
    }
  });

  return groups;
}

// Uso
const groupedMessages = groupMessagesByDate(messages);

return (
  <div>
    {groupedMessages.map((group) => (
      <div key={group.date.toISOString()}>
        <DateDivider date={group.date} />
        {group.messages.map((message) => (
          <MessageBubble key={message.id} {...} />
        ))}
      </div>
    ))}
  </div>
);
```

### Detectar Agrupamento de Mensagens

```typescript
function shouldGroupMessages(
  currentMsg: Message,
  previousMsg: Message | null,
  nextMsg: Message | null
): {
  showAvatar: boolean;
  groupedWithNext: boolean;
} {
  const MAX_GROUP_INTERVAL = 5 * 60 * 1000; // 5 minutos

  // Mostrar avatar se:
  // - Primeira mensagem
  // - Remetente diferente do anterior
  // - Intervalo maior que 5 minutos
  const showAvatar = !previousMsg ||
    previousMsg.direction !== currentMsg.direction ||
    new Date(currentMsg.createdAt).getTime() -
      new Date(previousMsg.createdAt).getTime() > MAX_GROUP_INTERVAL;

  // Agrupar com próxima se:
  // - Mesmo remetente
  // - Intervalo menor que 5 minutos
  const groupedWithNext = nextMsg &&
    nextMsg.direction === currentMsg.direction &&
    new Date(nextMsg.createdAt).getTime() -
      new Date(currentMsg.createdAt).getTime() < MAX_GROUP_INTERVAL;

  return { showAvatar, groupedWithNext: !!groupedWithNext };
}

// Uso
messages.map((message, index) => {
  const { showAvatar, groupedWithNext } = shouldGroupMessages(
    message,
    messages[index - 1],
    messages[index + 1]
  );

  return (
    <MessageBubble
      key={message.id}
      message={message}
      showAvatar={showAvatar}
      groupedWithNext={groupedWithNext}
      {...}
    />
  );
});
```

### Scroll para Mensagem Específica

```typescript
import { useRef, useEffect } from 'react';

function MessageListWithScroll({ messages, highlightMessageId }) {
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (highlightMessageId) {
      const element = messageRefs.current.get(highlightMessageId);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Destacar temporariamente
        element.classList.add('bg-yellow-200');
        setTimeout(() => {
          element.classList.remove('bg-yellow-200');
        }, 2000);
      }
    }
  }, [highlightMessageId]);

  return (
    <div>
      {messages.map((message) => (
        <div
          key={message.id}
          ref={(el) => {
            if (el) messageRefs.current.set(message.id, el);
          }}
        >
          <MessageBubble message={message} {...} />
        </div>
      ))}
    </div>
  );
}
```

### Infinite Scroll (Load More Messages)

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';

function MessageListWithInfiniteScroll({ conversationId }) {
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam = 0 }) =>
      messageService.list(conversationId, {
        limit: 50,
        offset: pageParam
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 50) return undefined;
      return pages.length * 50;
    }
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage]);

  const allMessages = data?.pages.flatMap((page) => page.data) || [];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Load More Trigger */}
      {hasNextPage && (
        <div ref={ref} className="h-10 flex items-center justify-center">
          {isFetchingNextPage && <LoadingSpinner />}
        </div>
      )}

      {/* Messages */}
      {allMessages.map((message) => (
        <MessageBubble key={message.id} message={message} {...} />
      ))}
    </div>
  );
}
```

### Debounce no Typing Indicator

```typescript
import { useRef, useCallback } from 'react';

function useDebouncedTyping(
  conversationId: string,
  sendTypingStatus: (id: string, isTyping: boolean) => void,
  delay: number = 2000
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = useCallback(() => {
    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Enviar "está digitando"
    sendTypingStatus(conversationId, true);

    // Agendar "parou de digitar"
    timeoutRef.current = setTimeout(() => {
      sendTypingStatus(conversationId, false);
    }, delay);
  }, [conversationId, sendTypingStatus, delay]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    sendTypingStatus(conversationId, false);
  }, [conversationId, sendTypingStatus]);

  return { startTyping, stopTyping };
}

// Uso
function ChatInput() {
  const { startTyping, stopTyping } = useDebouncedTyping(
    conversationId,
    sendTypingStatus
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    if (value.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  return (
    <input
      value={message}
      onChange={handleChange}
      onBlur={stopTyping}
    />
  );
}
```

### Message Status Updates

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useSocketContext } from '@/contexts/socket-context';

function useMessageStatusUpdates(conversationId: string) {
  const queryClient = useQueryClient();
  const { on, off } = useSocketContext();

  useEffect(() => {
    const handleStatusUpdate = (data: {
      messageId: string;
      status: MessageStatus;
    }) => {
      console.log('Status update:', data);

      // Atualizar no cache
      queryClient.setQueryData(
        ['messages', conversationId],
        (oldData: any) => {
          if (!oldData) return oldData;

          return {
            ...oldData,
            data: oldData.data.map((msg: Message) =>
              msg.id === data.messageId
                ? { ...msg, status: data.status }
                : msg
            )
          };
        }
      );
    };

    on('message:status', handleStatusUpdate);

    return () => {
      off('message:status', handleStatusUpdate);
    };
  }, [conversationId, on, off, queryClient]);
}

// Uso
function ConversationPage({ params }) {
  useMessageStatusUpdates(params.id);

  // ... resto do código
}
```

### Formatação de Timestamp

```typescript
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatMessageTimestamp(date: Date): string {
  if (isToday(date)) {
    return format(date, 'HH:mm', { locale: ptBR });
  }

  if (isYesterday(date)) {
    return `Ontem ${format(date, 'HH:mm', { locale: ptBR })}`;
  }

  const daysAgo = Math.floor(
    (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysAgo < 7) {
    return format(date, "EEEE 'às' HH:mm", { locale: ptBR });
  }

  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

// Uso
<span className="text-xs text-muted-foreground">
  {formatMessageTimestamp(new Date(message.createdAt))}
</span>
```

---

## Testes

### Teste de Componente

```typescript
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '@/components/chat/message-bubble';
import { MessageDirection, MessageStatus, MessageType } from '@/types';

describe('MessageBubble', () => {
  const mockMessage = {
    id: '1',
    content: 'Hello World',
    direction: MessageDirection.OUTBOUND,
    status: MessageStatus.SENT,
    type: MessageType.TEXT,
    createdAt: new Date().toISOString(),
    // ... outros campos necessários
  };

  it('should render message content', () => {
    render(
      <MessageBubble
        message={mockMessage}
        isOwnMessage={true}
        showAvatar={true}
        groupedWithNext={false}
      />
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should show check icon for sent message', () => {
    render(
      <MessageBubble
        message={mockMessage}
        isOwnMessage={true}
        showAvatar={true}
        groupedWithNext={false}
      />
    );

    // Verificar se ícone de check está presente
    const checkIcon = screen.getByRole('img', { hidden: true });
    expect(checkIcon).toBeInTheDocument();
  });
});
```

### Teste E2E (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('WhatsApp Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/conversations/123');
  });

  test('should send message', async ({ page }) => {
    // Digitar mensagem
    await page.fill('input[placeholder="Digite uma mensagem"]', 'Hello!');

    // Pressionar Enter
    await page.press('input[placeholder="Digite uma mensagem"]', 'Enter');

    // Verificar se mensagem apareceu
    await expect(page.getByText('Hello!')).toBeVisible();
  });

  test('should auto-scroll to bottom', async ({ page }) => {
    // Aguardar mensagens carregarem
    await page.waitForSelector('[data-testid="message-bubble"]');

    // Verificar se última mensagem está visível
    const lastMessage = page.locator('[data-testid="message-bubble"]').last();
    await expect(lastMessage).toBeInViewport();
  });

  test('should show typing indicator', async ({ page }) => {
    // Simular outro usuário digitando (via Socket.io mock)
    // ...

    // Verificar se indicador aparece
    await expect(page.getByText(/está digitando/i)).toBeVisible();
  });
});
```

---

## Customização

### Mudar Cores

```typescript
// Criar arquivo: tailwind.config.js

module.exports = {
  theme: {
    extend: {
      colors: {
        // WhatsApp Colors
        'whatsapp-bg': '#e5ddd5',
        'whatsapp-incoming': '#ffffff',
        'whatsapp-outgoing': '#d9fdd3',
        'whatsapp-header': '#f0f2f5',
        'whatsapp-online': '#25d366',
        'whatsapp-read': '#53bdeb',

        // Custom Colors (exemplo)
        'custom-bg': '#f5f5f5',
        'custom-incoming': '#e3f2fd',
        'custom-outgoing': '#c8e6c9',
      }
    }
  }
};

// Usar em componente
<div className="bg-custom-bg">
  <MessageBubble className="bg-custom-incoming" />
</div>
```

### Adicionar Dark Mode

```typescript
// Em message-bubble.tsx
const bubbleColor = isOwnMessage
  ? 'bg-[#d9fdd3] dark:bg-[#005c4b]'
  : 'bg-white dark:bg-[#202c33]';

const textColor = 'text-[#111b21] dark:text-[#e9edef]';

// Em chat-header.tsx
<div className="bg-[#f0f2f5] dark:bg-[#202c33]">
  {/* ... */}
</div>

// Em message-list.tsx
<div
  className="flex-1 overflow-y-auto"
  style={{
    backgroundColor: isDarkMode ? '#0b141a' : '#e5ddd5',
  }}
>
  {/* ... */}
</div>
```

---

## Recursos Adicionais

### Links Úteis

- [WhatsApp Design Guidelines](https://www.whatsapp.com/brand)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [React Query Documentation](https://tanstack.com/query/latest)
- [date-fns Documentation](https://date-fns.org/)
- [Tailwind CSS](https://tailwindcss.com/)

### Ferramentas de Debug

```typescript
// Adicionar em qualquer componente
useEffect(() => {
  console.log('🔍 DEBUG - Component State:', {
    messages: messages.length,
    isTyping,
    isConnected,
    currentUser: user?.id
  });
}, [messages, isTyping, isConnected, user]);

// Debug Socket.io
if (typeof window !== 'undefined') {
  (window as any).debugSocket = () => {
    const socket = (window as any).socket;
    console.log('Socket Debug:', {
      connected: socket?.connected,
      id: socket?.id,
      listeners: socket?.eventNames()
    });
  };
}

// Chamar no console:
// > debugSocket()
```

---

**Última atualização:** 2025-11-20
**Versão:** 1.0.0
