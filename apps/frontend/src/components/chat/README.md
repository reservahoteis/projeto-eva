# WhatsApp-Style Chat Components

## Componentes de Mensagens Interativas

Este diretório contém componentes React que replicam EXATAMENTE o design do WhatsApp iOS para renderização de mensagens interativas.

## Componentes Principais

### 1. WhatsAppListMessage

Renderiza mensagens de lista interativa do WhatsApp.

**Uso:**
```tsx
import { WhatsAppListMessage } from '@/components/chat';

<WhatsAppListMessage
  header="Nossos Serviços"
  body="Escolha uma das opções abaixo:"
  footer="Estamos à disposição"
  buttonLabel="Ver Serviços"
  sections={[
    {
      title: "Acomodações",
      rows: [
        {
          id: "room-1",
          title: "Quarto Standard",
          description: "Cama de casal, TV e WiFi"
        }
      ]
    }
  ]}
  isOwnMessage={false}
/>
```

**Props:**
- `header` (string, opcional): Título no topo da mensagem
- `body` (string, obrigatório): Texto principal da mensagem
- `footer` (string, opcional): Texto de rodapé
- `buttonLabel` (string, obrigatório): Texto do botão que abre a lista
- `sections` (array, obrigatório): Array de seções com itens
- `isOwnMessage` (boolean, obrigatório): Define cor da bolha

**Features:**
- Modal bottom sheet no mobile
- Card centralizado no desktop
- Scroll vertical para listas longas
- Animações suaves de abertura/fechamento
- Hover states nos itens

---

### 2. WhatsAppCarouselMessage

Renderiza mensagens de carrossel com scroll horizontal.

**Uso:**
```tsx
import { WhatsAppCarouselMessage } from '@/components/chat';

<WhatsAppCarouselMessage
  templateName="Promoções de Verão"
  cards={[
    {
      imageUrl: "https://example.com/image1.jpg",
      bodyParams: ["Suíte Deluxe com 30% de desconto"],
      buttonPayloads: ["Reservar", "https://booking.com"]
    },
    {
      imageUrl: "https://example.com/image2.jpg",
      bodyParams: ["Pacote Spa Completo"],
      buttonPayloads: ["Ver Detalhes"]
    }
  ]}
  isOwnMessage={false}
/>
```

**Props:**
- `cards` (array, obrigatório): Array de cards do carrossel
  - `imageUrl` (string, opcional): URL da imagem do card
  - `bodyParams` (string[], opcional): Textos do card
  - `buttonPayloads` (string[], opcional): Labels dos botões
- `templateName` (string, opcional): Nome do template
- `isOwnMessage` (boolean, obrigatório): Define cor da bolha

**Features:**
- Scroll horizontal com snap-to-center
- Drag/swipe para navegação (mouse + touch)
- Setas de navegação (desktop)
- Dots de paginação
- Contador de posição (X/Y)
- Auto-snap ao card mais próximo

---

### 3. MessageBubble (Atualizado)

Componente principal que renderiza todos os tipos de mensagens, incluindo as interativas.

**Tipos de mensagem suportados:**
- TEXT (texto simples)
- IMAGE (imagem com caption)
- VIDEO (vídeo com controls)
- AUDIO (player de áudio)
- DOCUMENT (arquivo para download)
- **INTERACTIVE** (botões ou listas) ⭐ NOVO
- **TEMPLATE** (templates incluindo carrossel) ⭐ ATUALIZADO

**Detecção automática:**

O componente detecta automaticamente o tipo de mensagem interativa pelos metadados:

```typescript
// Lista
{
  type: 'INTERACTIVE',
  metadata: { interactiveType: 'list', ... }
}
// → Renderiza WhatsAppListMessage

// Carrossel
{
  type: 'TEMPLATE',
  metadata: { templateType: 'carousel', ... }
}
// → Renderiza WhatsAppCarouselMessage
```

---

## Estrutura de Dados do Backend

### Lista Interativa

```json
{
  "type": "INTERACTIVE",
  "content": "Texto principal",
  "metadata": {
    "interactiveType": "list",
    "header": "Título (opcional)",
    "footer": "Rodapé (opcional)",
    "buttonLabel": "Ver opções",
    "sections": [
      {
        "title": "Seção 1",
        "rows": [
          {
            "id": "opt1",
            "title": "Opção 1",
            "description": "Descrição da opção"
          }
        ]
      }
    ]
  }
}
```

### Carrossel de Template

```json
{
  "type": "TEMPLATE",
  "metadata": {
    "templateType": "carousel",
    "templateName": "nome_template",
    "cards": [
      {
        "imageUrl": "https://...",
        "bodyParams": ["Texto do card"],
        "buttonPayloads": ["Botão 1", "https://link.com"]
      }
    ]
  }
}
```

---

## Design System

### Cores WhatsApp

```css
/* Principais */
--whatsapp-green: #00a884;
--whatsapp-blue: #027eb5;
--text-primary: #111b21;
--text-secondary: #667781;
--bg-light: #f0f2f5;
--own-message: #d9fdd3;
```

### Tipografia

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
```

### Border Radius

- Cards principais: `16px`
- Botões: `8px`
- Elementos pequenos: `4-6px`

---

## Demonstração

Para testar os componentes visualmente:

```tsx
import { InteractiveMessagesDemo } from '@/components/chat/InteractiveMessagesDemo';

// Renderiza exemplos completos de todos os componentes
<InteractiveMessagesDemo />
```

---

## Responsividade

### Mobile (< 640px)
- Lista: Bottom sheet que desliza de baixo
- Carrossel: Cards 280px, scroll horizontal
- Touch/swipe habilitado

### Desktop (>= 640px)
- Lista: Modal centralizado (max-width 460px)
- Carrossel: Cards 300px, navegação por setas
- Mouse drag habilitado

---

## Acessibilidade

### Keyboard Navigation
- **Lista**: ESC fecha modal, Tab navega itens
- **Carrossel**: Arrow keys navegam cards, Tab navega botões

### Screen Readers
- ARIA labels nos botões de navegação
- Estrutura semântica correta (button, dialog)
- Focus trap no modal de lista

### Touch Targets
- Mínimo 44x44px para botões (iOS guideline)
- Áreas de toque generosas

---

## Performance

### Otimizações
- Debounce em eventos de scroll
- CSS scroll-snap (GPU-accelerated)
- Transform para animações
- useRef para evitar re-renders desnecessários

### Best Practices
- Limite de 10 cards por carrossel
- Imagens otimizadas (max 500x500px)
- Lazy loading pode ser adicionado se necessário

---

## Troubleshooting

### Lista não abre
- Verificar z-index de componentes pais
- Modal usa z-50

### Carrossel não faz scroll
- Verificar overflow no componente pai
- Verificar se há CSS conflitante

### Imagens não aparecem
- Verificar CORS no servidor de imagens
- Verificar URLs válidas
- Fallback para imagens quebradas já implementado

---

## Próximos Passos

Ver `WHATSAPP-INTERACTIVE-MESSAGES.md` para:
- Roadmap de features
- Melhorias planejadas
- Detalhes técnicos completos

---

## Suporte

- Código fonte com comentários inline
- Console logs para debugging
- TypeScript para type safety

**Versão:** 1.0.0
**Data:** 2025-12-06
