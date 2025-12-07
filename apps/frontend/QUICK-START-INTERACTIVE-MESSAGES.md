# Quick Start - Mensagens Interativas WhatsApp

## Acesso Rápido

### Ver Demonstração Visual

```
http://localhost:3000/test-interactive-messages
```

### Usar no Código

```tsx
import { WhatsAppListMessage, WhatsAppCarouselMessage } from '@/components/chat';
```

---

## Lista Interativa

### Exemplo Básico

```tsx
<WhatsAppListMessage
  body="Escolha um dos nossos serviços:"
  buttonLabel="Ver Serviços"
  sections={[
    {
      title: "Acomodações",
      rows: [
        {
          id: "room-standard",
          title: "Quarto Standard",
          description: "Cama de casal, TV e WiFi"
        },
        {
          id: "room-deluxe",
          title: "Quarto Deluxe",
          description: "Vista para o mar"
        }
      ]
    }
  ]}
  isOwnMessage={false}
/>
```

### Com Header e Footer

```tsx
<WhatsAppListMessage
  header="Bem-vindo ao Hotel Paraíso"
  body="Escolha um dos nossos serviços:"
  footer="Estamos à disposição 24/7"
  buttonLabel="Ver Serviços"
  sections={[...]}
  isOwnMessage={false}
/>
```

---

## Carrossel

### Exemplo Básico

```tsx
<WhatsAppCarouselMessage
  cards={[
    {
      imageUrl: "https://example.com/room1.jpg",
      bodyParams: ["Suíte Deluxe - 30% OFF"],
      buttonPayloads: ["Reservar Agora"]
    },
    {
      imageUrl: "https://example.com/spa.jpg",
      bodyParams: ["Spa Completo - 3 dias"],
      buttonPayloads: ["Ver Detalhes", "https://booking.com"]
    }
  ]}
  isOwnMessage={false}
/>
```

### Com Nome de Template

```tsx
<WhatsAppCarouselMessage
  templateName="Promoções de Verão"
  cards={[...]}
  isOwnMessage={false}
/>
```

---

## Integração Automática

### No Chat (Já Funciona!)

As mensagens do backend são renderizadas automaticamente:

```json
// Backend envia (Lista)
{
  "type": "INTERACTIVE",
  "content": "Escolha uma opção",
  "metadata": {
    "interactiveType": "list",
    "buttonLabel": "Ver opções",
    "sections": [...]
  }
}

// Frontend renderiza automaticamente como WhatsAppListMessage
```

```json
// Backend envia (Carrossel)
{
  "type": "TEMPLATE",
  "metadata": {
    "templateType": "carousel",
    "cards": [...]
  }
}

// Frontend renderiza automaticamente como WhatsAppCarouselMessage
```

---

## Props Reference

### WhatsAppListMessage

| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `body` | string | ✅ Sim | Texto principal |
| `buttonLabel` | string | ✅ Sim | Texto do botão |
| `sections` | array | ✅ Sim | Array de seções |
| `isOwnMessage` | boolean | ✅ Sim | Define cor da bolha |
| `header` | string | ❌ Não | Título opcional |
| `footer` | string | ❌ Não | Rodapé opcional |

### WhatsAppCarouselMessage

| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `cards` | array | ✅ Sim | Array de cards |
| `isOwnMessage` | boolean | ✅ Sim | Define cor da bolha |
| `templateName` | string | ❌ Não | Nome do template |

### Card Object

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `imageUrl` | string | URL da imagem |
| `bodyParams` | string[] | Textos do card |
| `buttonPayloads` | string[] | Labels dos botões |

---

## Estrutura de Seção (Lista)

```typescript
interface ListSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}
```

---

## Cores WhatsApp

```tsx
// Verde WhatsApp (botões primários)
className="bg-[#00a884] text-white"

// Azul WhatsApp (links)
className="text-[#027eb5]"

// Texto primário
className="text-[#111b21]"

// Texto secundário
className="text-[#667781]"

// Fundo claro
className="bg-[#f0f2f5]"

// Mensagem enviada
className="bg-[#d9fdd3]"
```

---

## Responsividade

### Mobile
- Lista: Bottom sheet
- Carrossel: Swipe habilitado

### Desktop
- Lista: Modal centralizado
- Carrossel: Setas de navegação

### Breakpoint

```tsx
// Muda comportamento em 640px (sm)
sm:max-w-[460px]  // Desktop
max-w-full        // Mobile
```

---

## Testes

### 1. Teste Visual (Recomendado)

```bash
# Abrir no navegador
http://localhost:3000/test-interactive-messages
```

### 2. Teste no Chat Real

Enviar mensagem do backend com estrutura correta e verificar renderização

### 3. Teste de Componente Isolado

```tsx
import { WhatsAppListMessage } from '@/components/chat';

function TestPage() {
  return (
    <div className="p-4">
      <WhatsAppListMessage
        body="Teste"
        buttonLabel="Clique aqui"
        sections={[{
          rows: [{ id: "1", title: "Item 1" }]
        }]}
        isOwnMessage={false}
      />
    </div>
  );
}
```

---

## Troubleshooting Comum

### Lista não abre
- Verificar z-index do componente pai
- Modal usa z-50

### Carrossel não scrolls
- Verificar overflow no pai
- Remover overflow-hidden do container pai

### Botões não respondem
- Verificar console para erros JS
- Verificar se onClick está implementado

---

## Próximos Passos

1. ✅ Testar visualmente em `/test-interactive-messages`
2. ✅ Enviar mensagem de teste do backend
3. ✅ Verificar renderização no chat real
4. ❌ Implementar callbacks reais (opcional)
5. ❌ Integrar com analytics (opcional)

---

## Documentação Completa

- **Técnica Detalhada**: `apps/frontend/WHATSAPP-INTERACTIVE-MESSAGES.md`
- **Guia de Uso**: `apps/frontend/src/components/chat/README.md`
- **Resumo Executivo**: `IMPLEMENTACAO-MENSAGENS-INTERATIVAS.md`

---

## Suporte

- Código com comentários inline
- TypeScript para type safety
- Console logs para debugging

**Versão**: 1.0.0 | **Status**: ✅ Pronto para Produção
