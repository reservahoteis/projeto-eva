# WhatsApp Interactive Messages - Implementação

## Visão Geral

Esta documentação descreve a implementação de renderização visual de mensagens interativas do WhatsApp (Listas e Carrosséis) no painel de chat, replicando EXATAMENTE o design do WhatsApp iOS 2024/2025.

## Arquivos Criados/Modificados

### Novos Componentes

1. **`WhatsAppListMessage.tsx`**
   - Caminho: `apps/frontend/src/components/chat/WhatsAppListMessage.tsx`
   - Renderiza mensagens de lista interativa
   - Design idêntico ao WhatsApp iOS

2. **`WhatsAppCarouselMessage.tsx`**
   - Caminho: `apps/frontend/src/components/chat/WhatsAppCarouselMessage.tsx`
   - Renderiza mensagens de carrossel com scroll horizontal
   - Suporte a drag/swipe e navegação por setas

3. **`InteractiveMessagesDemo.tsx`**
   - Caminho: `apps/frontend/src/components/chat/InteractiveMessagesDemo.tsx`
   - Componente de demonstração e teste

### Arquivos Modificados

1. **`message-bubble.tsx`**
   - Integração dos novos componentes
   - Substituição da renderização básica anterior

2. **`index.ts`** (chat components)
   - Exportação dos novos componentes

## Estrutura de Dados

### Lista Interativa (INTERACTIVE type, list)

```typescript
{
  type: 'INTERACTIVE',
  content: 'Texto principal da mensagem',
  metadata: {
    interactiveType: 'list',
    header: 'Título opcional',
    footer: 'Rodapé opcional',
    buttonLabel: 'Ver opções',
    sections: [
      {
        title: 'Seção 1',
        rows: [
          {
            id: 'opt1',
            title: 'Opção 1',
            description: 'Descrição da opção'
          },
          // ... mais opções
        ]
      },
      // ... mais seções
    ]
  }
}
```

### Carrossel de Template (TEMPLATE type, carousel)

```typescript
{
  type: 'TEMPLATE',
  metadata: {
    templateType: 'carousel',
    templateName: 'nome_do_template',
    cards: [
      {
        imageUrl: 'https://...',
        bodyParams: ['Texto do card'],
        buttonPayloads: ['Botão 1', 'https://link.com']
      },
      // ... mais cards
    ]
  }
}
```

## Design Specifications (WhatsApp iOS 2024/2025)

### Cores

| Elemento | Cor | Uso |
|----------|-----|-----|
| WhatsApp Green | `#00a884` | Botões primários, ações principais |
| WhatsApp Blue | `#027eb5` | Links, botões secundários |
| Text Primary | `#111b21` | Texto principal |
| Text Secondary | `#667781` | Texto secundário, labels |
| Background Light | `#f0f2f5` | Fundos de cards, itens de lista |
| Own Message | `#d9fdd3` | Fundo de mensagens enviadas |
| White | `#ffffff` | Fundo de cards, mensagens recebidas |

### Tipografia

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
```

- **Títulos**: 15-17px, font-weight: 600-700
- **Body text**: 14px, line-height: 1.4
- **Secondary text**: 12-13px, color: #667781
- **Labels**: 11px, uppercase, tracking-wide

### Border Radius

- Cards principais: `16px` (rounded-xl)
- Cards de carrossel: `12px` (rounded-xl)
- Botões: `8px` (rounded-lg)
- Elementos pequenos: `4-6px`

### Sombras

```css
/* Sombra sutil para cards */
box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08);

/* Sombra para modais */
box-shadow: 0 -2px 20px rgba(0,0,0,0.15), 0 4px 40px rgba(0,0,0,0.2);

/* Sombra para botões de navegação */
box-shadow: 0 2px 8px rgba(0,0,0,0.15);
```

## Funcionalidades Implementadas

### WhatsAppListMessage

#### Features
- ✅ Header, body e footer com estilos WhatsApp
- ✅ Botão verde com ícone de lista
- ✅ Modal bottom sheet (mobile) / centered card (desktop)
- ✅ Seções com títulos
- ✅ Itens de lista clicáveis com hover/active states
- ✅ Ícone chevron à direita dos itens
- ✅ Animações de abertura (fadeIn + slideUp)
- ✅ Backdrop com blur
- ✅ Scroll vertical para listas longas

#### Comportamento
1. Clique no botão abre o modal
2. Clique fora do modal fecha
3. Clique no X fecha
4. Clique em item fecha e registra seleção (console.log)

#### Responsividade
- Mobile: Bottom sheet que desliza de baixo
- Desktop: Card centralizado com largura máxima de 460px

### WhatsAppCarouselMessage

#### Features
- ✅ Scroll horizontal suave com snap-to-center
- ✅ Drag/swipe para navegação (mouse + touch)
- ✅ Cards com imagem, texto e botões
- ✅ Indicador de posição (X/Y) sobre a imagem
- ✅ Navegação por setas (desktop)
- ✅ Paginação com dots na base
- ✅ Aspect ratio 1:1 para imagens
- ✅ Botões de ação estilizados (URL vs quick_reply)
- ✅ Smooth scroll behavior
- ✅ Auto-snap ao card mais próximo

#### Comportamento
1. Scroll horizontal livre com snap automático
2. Drag/swipe funciona em desktop e mobile
3. Setas aparecem apenas em desktop
4. Dots de paginação sempre visíveis (se > 1 card)
5. Transições suaves entre cards

#### Responsividade
- Cards: 280px (mobile) / 300px (desktop)
- Container adapta largura
- Scroll horizontal em todas as resoluções

## Integração no MessageBubble

### Detecção de Tipo de Mensagem

```typescript
// Lista Interativa
if (message.type === MessageType.INTERACTIVE &&
    metadata.interactiveType === 'list') {
  return <WhatsAppListMessage {...props} />;
}

// Carrossel
if (message.type === MessageType.TEMPLATE &&
    metadata.templateType === 'carousel') {
  return <WhatsAppCarouselMessage {...props} />;
}
```

### Passagem de Dados

Os componentes recebem dados diretamente do `message.metadata`, com fallbacks para valores padrão:

```typescript
<WhatsAppListMessage
  header={metadata?.header}
  body={message.content || ''}
  footer={metadata?.footer}
  buttonLabel={metadata?.buttonLabel || 'Ver opções'}
  sections={metadata?.sections || []}
  isOwnMessage={isOwnMessage}
/>
```

## Acessibilidade

### WhatsAppListMessage
- ✅ Keyboard navigation (ESC fecha modal)
- ✅ Focus trap no modal
- ✅ Botões com estados hover/active
- ✅ Semântica correta (button, dialog)
- ✅ ARIA labels implícitos

### WhatsAppCarouselMessage
- ✅ Keyboard navigation com setas
- ✅ Dots de paginação clicáveis
- ✅ ARIA labels nos botões de navegação
- ✅ Touch-friendly hit areas
- ✅ Skip links para acessar cards

## Performance

### Otimizações Implementadas

1. **Scroll Performance**
   - Debounce no handleScroll
   - RequestAnimationFrame para smooth scroll
   - CSS scroll-snap para performance nativa

2. **Render Optimization**
   - useState para gerenciar estado local
   - useRef para referencias DOM (evita re-renders)
   - Eventos de mouse/touch otimizados

3. **Image Loading**
   - Fallback para imagens quebradas
   - aspect-ratio para evitar layout shift
   - loading="lazy" pode ser adicionado se necessário

4. **CSS Performance**
   - Transform para animações (GPU-accelerated)
   - Will-change hints onde apropriado
   - Transições com cubic-bezier otimizadas

## Testes Visuais

### Cenários de Teste

1. **Lista com 1 seção, 3 itens**
2. **Lista com 3 seções, 10+ itens** (scroll vertical)
3. **Lista sem header/footer**
4. **Carrossel com 1 card**
5. **Carrossel com 5+ cards**
6. **Carrossel sem imagens**
7. **Carrossel com botões URL vs quick_reply**

### Resoluções Testadas

- ✅ Mobile: 375px (iPhone SE)
- ✅ Mobile: 414px (iPhone Pro Max)
- ✅ Tablet: 768px (iPad)
- ✅ Desktop: 1280px
- ✅ Desktop: 1920px

### Browsers

- Chrome/Edge (Chromium)
- Safari (iOS e macOS)
- Firefox

## Como Usar

### 1. Em um Chat Existente

As mensagens são renderizadas automaticamente quando o tipo e metadados corretos estão presentes:

```typescript
// Mensagem do backend já renderiza automaticamente
const message = {
  type: 'INTERACTIVE',
  content: 'Escolha uma opção',
  metadata: {
    interactiveType: 'list',
    buttonLabel: 'Ver opções',
    sections: [...]
  }
};
```

### 2. Componente Standalone

```typescript
import { WhatsAppListMessage } from '@/components/chat';

<WhatsAppListMessage
  body="Escolha uma opção abaixo:"
  buttonLabel="Ver Serviços"
  sections={[
    {
      title: "Seção 1",
      rows: [
        { id: "1", title: "Opção 1", description: "Descrição" }
      ]
    }
  ]}
  isOwnMessage={false}
/>
```

### 3. Demonstração

Para ver todos os componentes em ação:

```typescript
import { InteractiveMessagesDemo } from '@/components/chat/InteractiveMessagesDemo';

// Em qualquer página
<InteractiveMessagesDemo />
```

## Próximos Passos (Futuras Melhorias)

### Funcionalidades
- [ ] Adicionar callback real para seleção de itens de lista
- [ ] Integrar com sistema de respostas do chat
- [ ] Adicionar histórico de seleções
- [ ] Suporte a mensagens de lista com imagens nos itens
- [ ] Carrossel com vídeos (não apenas imagens)

### Performance
- [ ] Virtual scrolling para listas muito longas (100+ itens)
- [ ] Lazy loading de imagens de carrossel
- [ ] IntersectionObserver para cards visíveis

### Acessibilidade
- [ ] Testes com screen readers (NVDA, JAWS, VoiceOver)
- [ ] Focus management melhorado
- [ ] Atalhos de teclado documentados
- [ ] High contrast mode support

### Design
- [ ] Modo escuro (dark theme)
- [ ] Animações customizáveis
- [ ] Temas personalizáveis por tenant

## Troubleshooting

### Lista não abre ao clicar no botão

**Causa**: Modal bloqueado por z-index de outro componente
**Solução**: Verificar z-index de componentes pais (z-50 é usado)

### Carrossel não faz scroll

**Causa**: Container com overflow hidden no pai
**Solução**: Verificar CSS do componente pai

### Imagens não aparecem

**Causa**: CORS ou URL inválida
**Solução**: Verificar permissões CORS no servidor de imagens

### Performance ruim em mobile

**Causa**: Muitos cards ou imagens grandes
**Solução**: Limitar número de cards a 10, otimizar tamanho de imagens

## Referências

- [WhatsApp Business API - Interactive Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages)
- [WhatsApp Design Guidelines](https://www.whatsapp.com/design)
- [Meta Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

## Contato e Suporte

Para dúvidas ou melhorias, verificar:
- Código fonte dos componentes
- Comentários inline no código
- Console logs para debugging

---

**Última atualização**: 2025-12-06
**Versão**: 1.0.0
**Autor**: Claude Code (Anthropic)
