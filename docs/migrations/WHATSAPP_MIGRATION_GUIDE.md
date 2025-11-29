# Guia de Migração - WhatsApp Web Interface

## Resumo das Mudanças

Este guia mostra as diferenças entre a implementação antiga e a nova interface estilo WhatsApp Web.

---

## ANTES vs DEPOIS

### Estrutura de Componentes

#### ❌ ANTES (ChatInterface Monolítico)
```
<ChatInterface>
  └── Tudo junto em um componente
      ├── Header básico
      ├── Messages com pouca estilização
      └── Input simples
```

#### ✅ DEPOIS (Componentes Modulares WhatsApp-Style)
```
<div className="flex flex-col h-screen">
  ├── <ChatHeader />           # Header profissional
  ├── <MessageList />          # Lista otimizada
  └── <ChatInput />            # Input com recursos
```

---

### Arquivo Principal: `page.tsx`

#### ❌ ANTES
```typescript
// Importações
import { ChatInterface } from '@/components/tenant/chat-interface';

// Retorno
return (
  <div className="flex h-screen">
    <div className="flex-1">
      <ChatInterface
        conversation={conversation}
        messages={messagesData?.data || []}
        onMessageSent={() => {}}
      />
    </div>
    <ContactSidebar conversation={conversation} />
  </div>
);
```

#### ✅ DEPOIS
```typescript
// Importações
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';

// Retorno
return (
  <div className="flex h-screen overflow-hidden">
    <div className="flex-1 flex flex-col h-screen">
      <ChatHeader
        conversation={conversation}
        isOnline={false}
        isTyping={isUserTyping(params.id)}
        isConnected={isConnected}
      />

      <MessageList
        messages={messagesData?.data || []}
        isTyping={isUserTyping(params.id)}
        contactName={conversation.contact.name}
        contactAvatar={conversation.contact.avatar}
      />

      <ChatInput
        onSendMessage={handleSendMessage}
        onTypingChange={handleTypingChange}
        disabled={!isConnected}
        isLoading={sendMutation.isPending}
      />
    </div>
    <ContactSidebar conversation={conversation} />
  </div>
);
```

---

## Diferenças Visuais

### Cores

| Elemento | ANTES | DEPOIS (WhatsApp) |
|----------|-------|-------------------|
| Background Chat | `bg-[#e5ddd5]` (já tinha) | `#e5ddd5` + padrão SVG |
| Mensagem Recebida | `bg-white` | `bg-white` + sombra sutil |
| Mensagem Enviada | `bg-[#d9fdd3]` (já tinha) | `#d9fdd3` + sombra sutil |
| Header | `bg-card` | `bg-[#f0f2f5]` |
| Input | `bg-card` | `bg-[#f0f2f5]` |

### Tipografia

| Elemento | ANTES | DEPOIS |
|----------|-------|--------|
| Font | System default | Segoe UI, Helvetica Neue |
| Mensagem | 14px (text-sm) | 14px + WhatsApp style |
| Timestamp | Variável | 11px consistente |

### Ícones de Status

#### ❌ ANTES
```typescript
{message.status === 'READ' && '✓✓'}
{message.status === 'DELIVERED' && '✓✓'}
{message.status === 'SENT' && '✓'}
{message.status === 'PENDING' && '🕐'}
```

#### ✅ DEPOIS
```typescript
// READ: CheckCheck azul (#53bdeb)
<CheckCheck className="w-4 h-4 text-[#53bdeb]" />

// DELIVERED: CheckCheck cinza
<CheckCheck className="w-4 h-4 text-[#667781]" />

// SENT: Check simples cinza
<Check className="w-4 h-4 text-[#667781]" />

// PENDING: Loading spinner animado
<svg className="w-4 h-4 animate-spin">...</svg>
```

---

## Funcionalidades Novas

### 1. Message Grouping

#### ❌ ANTES
Todas as mensagens separadas igualmente.

#### ✅ DEPOIS
```typescript
// Mensagens consecutivas do mesmo remetente agrupadas
// Border radius adaptativo
// Avatar apenas na primeira do grupo
const groupedWithNext = nextMessage &&
  nextMessage.direction === message.direction &&
  timeDiff < 5 * 60 * 1000; // 5 minutos
```

### 2. Date Dividers

#### ❌ ANTES
Sem divisores de data.

#### ✅ DEPOIS
```typescript
<DateDivider date={new Date(message.createdAt)} />
// Mostra "HOJE", "ONTEM", ou "DD de MMMM de YYYY"
```

### 3. Auto-scroll Inteligente

#### ❌ ANTES
```typescript
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

#### ✅ DEPOIS
```typescript
// Só faz scroll se usuário estiver no bottom
const [isAtBottom, setIsAtBottom] = useState(true);

useEffect(() => {
  if (isAtBottom) {
    scrollToBottom('smooth');
  }
}, [messages, isAtBottom]);

// Botão "Scroll to Bottom" quando scrolled up > 300px
{showScrollButton && (
  <button onClick={() => scrollToBottom('smooth')}>
    <ArrowDown />
  </button>
)}
```

### 4. Typing Indicator Aprimorado

#### ❌ ANTES
```typescript
{isUserTyping && (
  <div className="flex">
    <MoreHorizontal className="animate-pulse" />
    <span>Digitando...</span>
  </div>
)}
```

#### ✅ DEPOIS
```typescript
<TypingIndicator name={contactName} />
// Componente dedicado com animação de 3 bolinhas
// Estilo idêntico ao WhatsApp
```

---

## Lógica Socket.io

### ✅ PRESERVADA 100%

**Nenhuma mudança** na lógica Socket.io:

```typescript
// ✅ Mantido exatamente como estava
useEffect(() => {
  subscribeToConversation(params.id);

  const handleNewMessage = (data: any) => {
    queryClient.setQueryData(['messages', params.id], ...);
    queryClient.invalidateQueries(...);
  };

  on('message:new', handleNewMessage);
  on('conversation:updated', handleConversationUpdate);
  on('message:status', handleMessageStatus);

  return () => {
    unsubscribeFromConversation(params.id);
    off('message:new', handleNewMessage);
    // ...
  };
}, [isConnected, params.id, ...]);
```

---

## Handlers Novos

### Enviar Mensagem

#### ❌ ANTES
```typescript
const sendMutation = useMutation({
  mutationFn: (content: string) => messageService.send({...}),
  onSuccess: () => {
    setMessageText('');
    onMessageSent(); // Prop callback
  }
});
```

#### ✅ DEPOIS
```typescript
const handleSendMessage = (content: string) => {
  // Stop typing indicator
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }
  sendTypingStatus(params.id, false);
  setIsTyping(false);

  sendMutation.mutate(content);
};
```

### Typing Status

#### ❌ ANTES
Lógica embutida no componente ChatInterface.

#### ✅ DEPOIS
```typescript
const handleTypingChange = (typing: boolean) => {
  setIsTyping(typing);
  sendTypingStatus(params.id, typing); // Via SocketContext
};

// Cleanup ao desmontar
useEffect(() => {
  return () => {
    if (isTyping) {
      sendTypingStatus(params.id, false);
    }
  };
}, []);
```

---

## Arquivos Criados

### Componentes Novos (6 arquivos)

```
apps/frontend/src/components/chat/
├── index.ts                  ✅ NOVO
├── message-bubble.tsx        ✅ NOVO
├── chat-header.tsx           ✅ NOVO
├── chat-input.tsx            ✅ NOVO
├── message-list.tsx          ✅ NOVO
├── date-divider.tsx          ✅ NOVO
└── typing-indicator.tsx      ✅ NOVO
```

### Arquivos Modificados

```
apps/frontend/src/app/dashboard/conversations/[id]/
└── page.tsx                  🔄 MODIFICADO
```

### Arquivos Antigos (Podem ser removidos)

```
apps/frontend/src/components/tenant/
└── chat-interface.tsx        ⚠️ NÃO USADO MAIS (manter por segurança)
```

---

## Checklist de Migração

### Desenvolvimento
- [x] Criar componentes WhatsApp-style
- [x] Atualizar página principal
- [x] Preservar lógica Socket.io
- [x] Implementar message grouping
- [x] Adicionar date dividers
- [x] Auto-scroll inteligente
- [x] Typing indicator melhorado
- [x] Status de mensagem visual

### Testes
- [ ] Testar envio de mensagem
- [ ] Testar recebimento via Socket.io
- [ ] Verificar status updates (✓, ✓✓)
- [ ] Testar scroll automático
- [ ] Testar button "Scroll to Bottom"
- [ ] Verificar grouping de mensagens
- [ ] Testar date dividers
- [ ] Verificar typing indicator
- [ ] Testar em mobile
- [ ] Verificar suporte a mídias

### Deploy
- [ ] Build sem erros TypeScript
- [ ] Testes E2E passando
- [ ] Performance adequada
- [ ] Deploy em staging
- [ ] QA approval
- [ ] Deploy em produção

---

## Rollback (Se Necessário)

Caso precise voltar à versão anterior:

```typescript
// Em apps/frontend/src/app/dashboard/conversations/[id]/page.tsx

// 1. Remover imports novos
// import { ChatHeader } from '@/components/chat/chat-header';
// import { MessageList } from '@/components/chat/message-list';
// import { ChatInput } from '@/components/chat/chat-input';

// 2. Re-adicionar import antigo
import { ChatInterface } from '@/components/tenant/chat-interface';

// 3. Voltar ao retorno antigo
return (
  <div className="flex h-screen">
    <div className="flex-1">
      <ChatInterface
        conversation={conversation}
        messages={messagesData?.data || []}
        onMessageSent={() => {}}
      />
    </div>
    <ContactSidebar conversation={conversation} />
  </div>
);
```

---

## Suporte

**Documentação completa:** `WHATSAPP_CHAT_IMPLEMENTATION.md`

**Componentes:** `apps/frontend/src/components/chat/`

**Testes:** Verificar console logs Socket.io

---

**Data:** 2025-11-20
**Versão:** 1.0.0
