---
name: hoteis-whatsapp
description: Integracao WhatsApp Cloud API para o CRM Hoteis Reserva
version: 1.0.0
---

# Skill: Integracao WhatsApp Cloud API

Documentacao detalhada da integracao com WhatsApp Cloud API (Meta).

## Setup Inicial

### 1. Criar App no Meta for Developers

1. Acessar https://developers.facebook.com
2. Criar novo app (tipo Business)
3. Adicionar produto WhatsApp
4. Obter credenciais

### 2. Credenciais Necessarias

| Credencial | Descricao | Onde Usar |
|------------|-----------|-----------|
| `whatsappPhoneNumberId` | ID do numero de telefone | Envio de mensagens |
| `whatsappBusinessAccountId` | ID da conta business | Configuracao |
| `whatsappAccessToken` | Token de acesso permanente | Authorization header |
| `whatsappAppSecret` | Secret do app | Validacao HMAC webhooks |

### 3. Configuracao de Webhooks

```
Webhook URL: https://api.botreserva.com.br/webhooks/whatsapp
Verify Token: (definido no .env como WHATSAPP_WEBHOOK_VERIFY_TOKEN)

Eventos subscritos:
- messages (mensagens recebidas)
- message_status (status de entrega)
```

## Tipos de Mensagens

### Texto

```typescript
await whatsAppService.sendTextMessage(
  tenantId,
  '5511999999999',
  'Ola! Como posso ajudar?'
);
```

**Limites:**
- Maximo 4096 caracteres

### Midia (Imagem, Video, Audio, Documento)

```typescript
await whatsAppService.sendMediaMessage(
  tenantId,
  '5511999999999',
  {
    type: 'image', // 'video' | 'audio' | 'document'
    url: 'https://cdn.hotel.com/quarto.jpg',
    caption: 'Suite Premium', // opcional
  }
);
```

**Limites:**
| Tipo | Formatos | Tamanho Max |
|------|----------|-------------|
| image | JPEG, PNG | 5MB |
| video | MP4, 3GP | 16MB |
| audio | AAC, MP3, OGG | 16MB |
| document | PDF, DOC, etc | 100MB |

### Botoes Interativos (max 3)

```typescript
await whatsAppService.sendInteractiveButtons(
  tenantId,
  '5511999999999',
  'Escolha uma opcao:',
  [
    { id: 'reserva', title: 'Fazer Reserva' },
    { id: 'info', title: 'Mais Informacoes' },
    { id: 'falar', title: 'Falar com Atendente' },
  ],
  'Menu Principal', // header (opcional)
  'Estamos a disposicao' // footer (opcional)
);
```

**Limites:**
- Maximo 3 botoes
- Titulo do botao: max 20 caracteres
- Body: max 1024 caracteres

### Lista Interativa (max 10 itens)

```typescript
await whatsAppService.sendInteractiveList(
  tenantId,
  '5511999999999',
  'Selecione o tipo de quarto:',
  'Ver Opcoes', // buttonText
  [
    {
      title: 'Quartos Standard',
      rows: [
        { id: 'std_single', title: 'Single', description: 'R$ 200/noite' },
        { id: 'std_double', title: 'Double', description: 'R$ 300/noite' },
      ],
    },
  ]
);
```

**Limites:**
- Maximo 10 itens no total
- 1 secao por lista
- Titulo do item: max 24 caracteres
- Descricao: max 72 caracteres

### Template (Pre-aprovado pela Meta)

```typescript
await whatsAppService.sendTemplate(
  tenantId,
  '5511999999999',
  'notificacao_atendente',
  [
    { type: 'text', text: 'Novo chamado de Joao Silva' }, // {{1}}
  ]
);
```

**Templates Aprovados:**

| Nome | Categoria | Uso |
|------|-----------|-----|
| `notificacao_atendente` | UTILITY | Notificar equipe |
| `carousel_quartos_geral` | MARKETING | Mostrar opcoes de quartos |
| `carousel_quarto_fotos` | MARKETING | Galeria de fotos |

### Carousel (Template com Cards)

```typescript
await whatsAppService.sendCarouselTemplate(
  tenantId,
  '5511999999999',
  'carousel_quartos_geral',
  [
    {
      imageUrl: 'https://cdn.hotel.com/quarto-standard.jpg',
      buttonPayloads: ['detalhes_standard', 'menu'],
    },
    {
      imageUrl: 'https://cdn.hotel.com/suite-premium.jpg',
      buttonPayloads: ['detalhes_premium', 'menu'],
    },
  ]
);
```

**Limites:**
- Maximo 10 cards
- Cada card precisa de imagem
- Botoes definidos no template

## Validacao de Webhook

```typescript
import crypto from 'crypto';

function validateWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}
```

**IMPORTANTE:**
- Sempre validar assinatura HMAC
- Usar `rawBody` (antes do JSON parse)
- App Secret deve estar criptografado no banco

## Webhook Verification (GET)

```typescript
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});
```

## Webhook Payload (POST)

```typescript
interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: [{
    id: string; // WABA ID
    changes: [{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: [{
          profile: { name: string };
          wa_id: string;
        }];
        messages?: [{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'interactive';
          text?: { body: string };
          interactive?: {
            type: 'button_reply' | 'list_reply';
            button_reply?: { id: string; title: string };
            list_reply?: { id: string; title: string };
          };
        }];
        statuses?: [{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }];
      };
      field: 'messages';
    }];
  }];
}
```

## Rate Limits da Meta

| Tier | Mensagens/dia | Requisito |
|------|---------------|-----------|
| Gratuito | 1000 | - |
| Tier 1 | 10000 | Verificacao de negocio |
| Tier 2+ | Unlimited | Volume crescente |

## Tratamento de Erros

```typescript
try {
  await whatsAppService.sendTextMessage(tenantId, phone, text);
} catch (error) {
  if (error.response?.status === 400) {
    // Erro de validacao (numero invalido, etc)
    logger.warn({ phone, error: error.response.data }, 'WhatsApp validation error');
  } else if (error.response?.status === 429) {
    // Rate limit
    logger.error({ tenantId }, 'WhatsApp rate limit exceeded');
  } else {
    // Erro desconhecido
    logger.error({ error }, 'WhatsApp API error');
    throw error;
  }
}
```

## Integracao com N8N

### Endpoints N8N -> Backend

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/n8n/send-text` | POST | Envia texto |
| `/api/n8n/send-buttons` | POST | Envia botoes |
| `/api/n8n/send-list` | POST | Envia lista |
| `/api/n8n/send-media` | POST | Envia midia |
| `/api/n8n/send-template` | POST | Envia template |
| `/api/n8n/send-carousel` | POST | Envia carousel |
| `/api/n8n/check-ia-lock` | GET | Verifica se IA bloqueada |
| `/api/n8n/escalate` | POST | Escala para humano |

### Autenticacao N8N

```
Header: X-API-Key: {tenantSlug}:{whatsappPhoneNumberId}

Exemplo: X-API-Key: hoteis-reserva:123456789012345
```

## Checklist de Integracao

- [ ] Credenciais configuradas no tenant?
- [ ] App Secret criptografado?
- [ ] Webhook verificado pela Meta?
- [ ] HMAC validando assinatura?
- [ ] Rate limiting configurado (5000 req/min)?
- [ ] N8N verificando iaLocked?
- [ ] Templates aprovados pela Meta?
- [ ] Tratamento de erros implementado?
