# 📤 WhatsApp Send Message Service - Guia Completo

**Versão:** 2.0.0
**Data:** 12/11/2025
**Status:** ✅ Production Ready

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Tipos de Mensagens Suportados](#tipos-de-mensagens-suportados)
4. [Error Handling](#error-handling)
5. [Validações](#validações)
6. [Rate Limiting](#rate-limiting)
7. [Exemplos de Uso](#exemplos-de-uso)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## 🎯 Visão Geral

O **WhatsApp Send Message Service V2** é um serviço robusto para envio de mensagens via WhatsApp Business Cloud API v21.0, com suporte completo para todos os tipos de mensagens, validação rigorosa, error handling, e processamento assíncrono via filas Bull.

### ✨ Features Principais

| Feature | V1 | V2 |
|---------|----|----|
| **Error Handling** | ⚠️ Básico | ✅ Robusto com códigos de erro |
| **Validação** | ⚠️ Parcial | ✅ Completa (tipo, tamanho, formato) |
| **Rate Limiting** | ❌ Nenhum | ✅ 80 msg/s (Meta limit) |
| **Retry Logic** | ❌ Nenhum | ✅ Exponential backoff |
| **Processamento** | ⚠️ Síncrono | ✅ Assíncrono (filas) |
| **Type Safety** | ⚠️ Parcial | ✅ 100% TypeScript strict |
| **Phone Validation** | ⚠️ Básica | ✅ E.164 + WhatsApp format |
| **Axios Caching** | ❌ Nenhum | ✅ 5 min TTL per tenant |
| **Template Messages** | ✅ Sim | ✅ Sim + validação de parâmetros |
| **Interactive Messages** | ❌ Não | ✅ Buttons + Lists |
| **Media Messages** | ✅ Básico | ✅ Completo + validação URL |
| **Logging** | ⚠️ Básico | ✅ Estruturado (Pino) |
| **Idempotência** | ⚠️ Parcial | ✅ Job IDs únicos |

---

## 🏗️ Arquitetura

### Fluxo de Envio de Mensagem

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Request (POST /messages)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               MessageController (message.controller.ts)          │
│  • Validar request body                                          │
│  • Verificar autenticação tenant                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            MessageServiceV2 (message.service.v2.ts)              │
│  • Buscar conversa e contato                                     │
│  • Validar número de telefone                                    │
│  • Validar conteúdo (tipo, tamanho, formato)                     │
│  • Criar registro no banco (status: SENT)                        │
│  • ENFILEIRAR para envio (não esperar)                           │
│  • Retornar imediatamente                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Bull Queue (whatsapp:outgoing:message)                   │
│  • Rate limiting: 80 msg/s                                       │
│  • Priority: 1 (normal)                                          │
│  • Retry: 3x com exponential backoff                             │
│  • Job ID: messageId (deduplicação)                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│     Worker (process-outgoing-message.worker.ts)                  │
│  • Buscar message, conversation, tenant do banco                 │
│  • Buscar credenciais WhatsApp do tenant                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│        WhatsAppServiceV2 (whatsapp.service.v2.ts)                │
│  • Obter/criar Axios instance (cache 5min)                       │
│  • Validar telefone (E.164 format)                               │
│  • Validar conteúdo específico do tipo                           │
│  • Enviar para WhatsApp API                                      │
│  • Retornar whatsappMessageId                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              WhatsApp Business Cloud API v21.0                   │
│  POST /{phone_number_id}/messages                                │
│  • Processar mensagem                                            │
│  • Retornar message ID                                           │
│  • Enviar status updates via webhook                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            Worker atualiza banco de dados                        │
│  • message.whatsappMessageId = result.whatsappMessageId          │
│  • message.status permanece SENT                                 │
│  • Log de sucesso                                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│          Webhook Status Update (assíncrono, separado)            │
│  • SENT → DELIVERED → READ (vem do WhatsApp)                     │
│  • Processado por process-status-update.worker.ts                │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes

#### 1. **WhatsAppServiceV2** (`whatsapp.service.v2.ts`)

Serviço de baixo nível que interage diretamente com a WhatsApp API.

**Responsabilidades:**
- Gerenciar instâncias Axios (cache por tenant)
- Validar e formatar números de telefone
- Enviar todos os tipos de mensagens
- Fazer download de mídia
- Traduzir erros da API para erros internos

**Métodos principais:**
- `sendTextMessage(tenantId, to, text, options?)`
- `sendMediaMessage(tenantId, to, mediaUrl, type, caption?)`
- `sendTemplate(tenantId, to, templateName, parameters, languageCode)`
- `sendInteractiveButtons(tenantId, to, bodyText, buttons)`
- `sendInteractiveList(tenantId, to, bodyText, buttonText, sections)`
- `markAsRead(tenantId, messageId)`
- `downloadMedia(tenantId, mediaId)`

#### 2. **MessageServiceV2** (`message.service.v2.ts`)

Serviço de alto nível que gerencia mensagens no banco de dados e enfileira para envio.

**Responsabilidades:**
- Validar conversa e contato
- Validar conteúdo da mensagem
- Criar registro no banco
- Enfileirar para envio assíncrono
- Atualizar conversa (lastMessageAt, status)
- Gerenciar templates
- Buscar e pesquisar mensagens

**Métodos principais:**
- `sendMessage(data, tenantId)`
- `sendTemplateMessage(tenantId, conversationId, templateName, parameters)`
- `receiveMessage(data)` (chamado pelo webhook worker)
- `listMessages(conversationId, tenantId, params?)`
- `searchMessages(tenantId, query, options?)`
- `markAsRead(messageId, tenantId)`
- `getConversationStats(conversationId, tenantId)`

#### 3. **Outgoing Message Worker** (`process-outgoing-message.worker.ts`)

Worker que processa mensagens enfileiradas para envio.

**Responsabilidades:**
- Buscar dados da mensagem e tenant
- Validar credenciais WhatsApp
- Chamar WhatsAppServiceV2 para enviar
- Atualizar whatsappMessageId no banco
- Lidar com falhas e retry

---

## 📨 Tipos de Mensagens Suportados

### 1. Mensagem de Texto

Mensagem simples com texto plano ou formatado.

**Limites:**
- Máximo: 4096 caracteres
- Mínimo: 1 caractere (não vazio)

**Formatação suportada:**
- **Negrito**: `*texto*`
- _Itálico_: `_texto_`
- ~Riscado~: `~texto~`
- `Monoespaçado`: `` `texto` ``

**Exemplo:**

```typescript
import { messageServiceV2 } from '@/services/message.service.v2';

const message = await messageServiceV2.sendMessage(
  {
    conversationId: 'conv-123',
    content: 'Olá! Seu pedido foi confirmado. *Obrigado!*',
    type: 'TEXT',
    sentById: 'user-456',
  },
  'tenant-abc'
);

// Retorna imediatamente com status SENT
// Worker envia em background
```

**Preview de URL automático:**

```typescript
// Com preview
await whatsAppServiceV2.sendTextMessage(
  'tenant-abc',
  '5511999999999',
  'Confira: https://exemplo.com',
  { previewUrl: true }
);

// Sem preview
await whatsAppServiceV2.sendTextMessage(
  'tenant-abc',
  '5511999999999',
  'Link: https://exemplo.com',
  { previewUrl: false }
);
```

---

### 2. Mensagens de Mídia

Suporte para imagens, vídeos, áudios e documentos.

#### 2.1. Imagem

**Formatos suportados:** JPG, PNG, WebP
**Tamanho máximo:** 5 MB
**Caption:** Máximo 1024 caracteres

```typescript
await messageServiceV2.sendMessage(
  {
    conversationId: 'conv-123',
    content: 'https://exemplo.com/foto.jpg', // URL pública HTTPS
    type: 'IMAGE',
    sentById: 'user-456',
    metadata: {
      caption: 'Foto do produto em estoque',
    },
  },
  'tenant-abc'
);
```

#### 2.2. Vídeo

**Formatos suportados:** MP4, 3GP
**Tamanho máximo:** 16 MB
**Caption:** Máximo 1024 caracteres

```typescript
await messageServiceV2.sendMessage(
  {
    conversationId: 'conv-123',
    content: 'https://exemplo.com/video.mp4',
    type: 'VIDEO',
    sentById: 'user-456',
    metadata: {
      caption: 'Tutorial de instalação',
    },
  },
  'tenant-abc'
);
```

#### 2.3. Áudio

**Formatos suportados:** AAC, MP3, AMR, OGG (Opus)
**Tamanho máximo:** 16 MB

```typescript
await messageServiceV2.sendMessage(
  {
    conversationId: 'conv-123',
    content: 'https://exemplo.com/audio.mp3',
    type: 'AUDIO',
    sentById: 'user-456',
  },
  'tenant-abc'
);
```

#### 2.4. Documento

**Formatos suportados:** PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
**Tamanho máximo:** 100 MB
**Caption:** Máximo 1024 caracteres
**Filename:** Recomendado para melhor UX

```typescript
await messageServiceV2.sendMessage(
  {
    conversationId: 'conv-123',
    content: 'https://exemplo.com/contrato.pdf',
    type: 'DOCUMENT',
    sentById: 'user-456',
    metadata: {
      caption: 'Contrato de prestação de serviços',
      filename: 'contrato-2025.pdf',
    },
  },
  'tenant-abc'
);
```

**⚠️ IMPORTANTE - Requisitos de URL de Mídia:**

1. **HTTPS obrigatório** (não HTTP)
2. **URL pública** (não localhost, IP privado)
3. **Content-Type correto** no header da resposta
4. **Sem autenticação** (ou token na URL)
5. **Tamanho dentro dos limites**
6. **Formato válido**

**Exemplo de URL válida:**
```
https://cdn.exemplo.com/uploads/abc123.jpg
```

**Exemplos de URLs INVÁLIDAS:**
```
http://exemplo.com/foto.jpg          ❌ HTTP (não HTTPS)
https://localhost:3000/foto.jpg      ❌ localhost
https://192.168.1.100/foto.jpg       ❌ IP privado
https://exemplo.com/foto             ❌ Sem extensão
```

---

### 3. Template Messages

Mensagens pré-aprovadas pela Meta para iniciar conversas fora da janela de 24h.

**Uso típico:**
- Confirmações de pedido
- Lembretes de agendamento
- Notificações de entrega
- Marketing opt-in

**Limites:**
- Nome do template: 1-512 caracteres (lowercase, underscore, números)
- Parâmetros: máximo 10 por componente
- Language code: formato BCP 47 (ex: `pt_BR`, `en_US`)

**Exemplo:**

```typescript
await messageServiceV2.sendTemplateMessage(
  'tenant-abc',
  'conv-123',
  'reserva_confirmada',
  ['João Silva', '15', 'dezembro', '14:00'],
  'user-456',
  'pt_BR'
);
```

**Template na Meta (exemplo):**
```
Olá {{1}}! Sua reserva para o dia {{2}} de {{3}} às {{4}} foi confirmada. ✅
```

**Resultado enviado:**
```
Olá João Silva! Sua reserva para o dia 15 de dezembro às 14:00 foi confirmada. ✅
```

**⚠️ IMPORTANTE:**
- Template deve estar **aprovado** na Meta antes de usar
- Parâmetros devem estar na **ordem correta** ({{1}}, {{2}}, etc.)
- Número de parâmetros deve **corresponder** aos placeholders
- Language code deve ser **exatamente** o mesmo do template

---

### 4. Interactive Messages - Buttons

Mensagens com até 3 botões clicáveis.

**Limites:**
- Mínimo: 1 botão
- Máximo: 3 botões
- Título do botão: máximo 20 caracteres
- Body text: máximo 1024 caracteres
- Header: opcional (texto ou mídia)
- Footer: opcional, máximo 60 caracteres

**Exemplo:**

```typescript
import { whatsAppServiceV2 } from '@/services/whatsapp.service.v2';

await whatsAppServiceV2.sendInteractiveButtons(
  'tenant-abc',
  '5511999999999',
  'Escolha uma opção para continuar:',
  [
    { id: 'opt_1', title: 'Ver cardápio' },
    { id: 'opt_2', title: 'Fazer pedido' },
    { id: 'opt_3', title: 'Falar com atendente' },
  ]
);
```

**Com header e footer:**

```typescript
await whatsAppServiceV2.sendInteractiveButtons(
  'tenant-abc',
  '5511999999999',
  'Escolha uma opção para continuar:',
  [
    { id: 'opt_1', title: 'Sim' },
    { id: 'opt_2', title: 'Não' },
  ],
  {
    headerText: 'Confirmação necessária',
    footerText: 'Responda em até 24h',
  }
);
```

**⚠️ Validações automáticas:**
- Número de botões entre 1-3
- Títulos ≤ 20 caracteres
- IDs únicos
- Body text não vazio

---

### 5. Interactive Messages - List

Mensagem com lista de opções (até 10 itens).

**Limites:**
- Mínimo: 1 item
- Máximo: 10 itens por seção
- Máximo: 10 seções
- Título do item: máximo 24 caracteres
- Descrição do item: máximo 72 caracteres
- Body text: máximo 1024 caracteres
- Button text: máximo 20 caracteres

**Exemplo:**

```typescript
await whatsAppServiceV2.sendInteractiveList(
  'tenant-abc',
  '5511999999999',
  'Selecione um dos nossos planos:',
  'Ver planos',
  [
    {
      title: 'Planos Disponíveis',
      rows: [
        {
          id: 'plan_basic',
          title: 'Básico',
          description: 'R$ 29,90/mês - 100 mensagens',
        },
        {
          id: 'plan_pro',
          title: 'Profissional',
          description: 'R$ 99,90/mês - 1000 mensagens',
        },
        {
          id: 'plan_enterprise',
          title: 'Empresarial',
          description: 'R$ 299,90/mês - Ilimitado',
        },
      ],
    },
  ]
);
```

**Com múltiplas seções:**

```typescript
await whatsAppServiceV2.sendInteractiveList(
  'tenant-abc',
  '5511999999999',
  'Escolha um produto:',
  'Ver catálogo',
  [
    {
      title: 'Bebidas',
      rows: [
        { id: 'prod_1', title: 'Coca-Cola', description: 'Lata 350ml - R$ 4,50' },
        { id: 'prod_2', title: 'Guaraná', description: 'Lata 350ml - R$ 4,00' },
      ],
    },
    {
      title: 'Lanches',
      rows: [
        { id: 'prod_3', title: 'X-Burger', description: 'Hambúrguer completo - R$ 18,00' },
        { id: 'prod_4', title: 'X-Salada', description: 'Com alface e tomate - R$ 16,00' },
      ],
    },
  ]
);
```

**⚠️ Validações automáticas:**
- Número de itens entre 1-10
- Títulos ≤ 24 caracteres
- Descrições ≤ 72 caracteres
- IDs únicos
- Button text ≤ 20 caracteres

---

## ⚠️ Error Handling

### Hierarquia de Erros

```typescript
Error
  └─ WhatsAppApiError (whatsapp.service.v2.ts)
       └─ BadRequestError (400)
       └─ UnauthorizedError (401)
       └─ NotFoundError (404)
       └─ RateLimitError (429)
       └─ InternalServerError (500)
```

### WhatsAppApiError

Classe customizada para erros da WhatsApp API.

**Propriedades:**
- `code: number` - Código de erro da Meta
- `title: string` - Título do erro
- `details: string` - Detalhes específicos
- `isRetryable: boolean` - Se deve tentar novamente

```typescript
export class WhatsAppApiError extends Error {
  constructor(
    public code: number,
    public title: string,
    public details: string,
    public isRetryable: boolean = false
  ) {
    super(`WhatsApp API Error ${code}: ${title} - ${details}`);
    this.name = 'WhatsAppApiError';
  }
}
```

### Códigos de Erro da WhatsApp API

```typescript
export enum WhatsAppErrorCode {
  // Rate Limiting
  RATE_LIMIT_HIT = 80007,

  // Message Quality
  MESSAGE_UNDELIVERABLE = 131026,
  RE_ENGAGEMENT_MESSAGE = 131047,

  // Template Errors
  TEMPLATE_DOES_NOT_EXIST = 133015,
  TEMPLATE_PAUSED = 133016,
  TEMPLATE_DISABLED = 133017,
  TEMPLATE_PARAM_COUNT_MISMATCH = 132000,
  TEMPLATE_PARAM_FORMAT_MISMATCH = 132001,
  TEMPLATE_HYDRATED_TEXT_TOO_LONG = 132068,

  // Business Account
  BUSINESS_NOT_APPROVED = 368,
  MESSAGE_EXPIRED = 131051,

  // Phone Number
  RECIPIENT_PHONE_NUMBER_NOT_VALID = 131005,
  PHONE_NUMBER_NOT_WHATSAPP = 131031,

  // Media
  MEDIA_DOWNLOAD_ERROR = 131052,
  MEDIA_UPLOAD_ERROR = 133004,

  // Generic
  INTERNAL_SERVER_ERROR = 131000,
  TEMPORARILY_BLOCKED = 131042,
  ACCOUNT_RESTRICTED = 131048,
}
```

### Tratamento de Erros no Service

```typescript
// whatsapp.service.v2.ts
try {
  const response = await axiosInstance.post(`/${phoneNumberId}/messages`, payload);
  return { whatsappMessageId: response.data.messages[0]?.id, success: true };
} catch (error) {
  if (axios.isAxiosError(error) && error.response) {
    const errorData = error.response.data.error;

    // Identificar se é retryable
    const isRetryable = [
      WhatsAppErrorCode.RATE_LIMIT_HIT,
      WhatsAppErrorCode.INTERNAL_SERVER_ERROR,
      WhatsAppErrorCode.TEMPORARILY_BLOCKED,
    ].includes(errorData.code);

    throw new WhatsAppApiError(
      errorData.code,
      errorData.message,
      errorData.error_data?.details || 'Erro ao enviar mensagem',
      isRetryable
    );
  }

  throw error;
}
```

### Tratamento no Worker

```typescript
// process-outgoing-message.worker.ts
export async function processOutgoingMessage(job: Job<SendMessageJobData>): Promise<void> {
  try {
    // Enviar mensagem
    const result = await whatsAppServiceV2.sendTextMessage(tenantId, to, content);

    // Atualizar banco
    await prisma.message.update({
      where: { id: messageId },
      data: { whatsappMessageId: result.whatsappMessageId },
    });

    logger.info({ messageId, whatsappMessageId }, 'Message sent successfully');
  } catch (error) {
    if (error instanceof WhatsAppApiError) {
      // Atualizar status para FAILED
      await prisma.message.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          metadata: {
            error: {
              code: error.code,
              title: error.title,
              details: error.details,
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      logger.error(
        {
          messageId,
          errorCode: error.code,
          errorTitle: error.title,
          isRetryable: error.isRetryable,
        },
        'Failed to send message'
      );

      // Se não for retryable, não fazer throw (marcar como failed definitivamente)
      if (!error.isRetryable) {
        return;
      }
    }

    // Fazer throw para Bull tentar novamente
    throw error;
  }
}
```

### Erros Comuns e Soluções

| Código | Erro | Causa | Solução |
|--------|------|-------|---------|
| **80007** | Rate limit hit | Muitas mensagens em curto período | Aguardar e tentar novamente (Bull faz automaticamente) |
| **131026** | Message undeliverable | Número bloqueou o bot ou não existe | Marcar contato como inválido, não tentar novamente |
| **131031** | Phone number not WhatsApp | Número não tem WhatsApp | Validar número antes de enviar |
| **131047** | Re-engagement message | Cliente não interage há 24h | Usar template message ao invés de mensagem regular |
| **133015** | Template does not exist | Template não existe ou nome errado | Verificar nome do template na Meta |
| **133016** | Template paused | Template pausado pela Meta | Ativar template no painel da Meta |
| **132000** | Template param count mismatch | Número de parâmetros incorreto | Verificar quantos placeholders o template tem |
| **368** | Business not approved | Conta não aprovada pela Meta | Completar verificação de negócio na Meta |
| **131005** | Recipient phone invalid | Número inválido | Validar formato E.164 |

---

## ✅ Validações

### 1. Validação de Número de Telefone

**Formato esperado:** E.164 (sem espaços, hífens, parênteses)

```typescript
// VÁLIDOS:
5511999999999    ✅ Brasil
5511988887777    ✅ Brasil (celular)
12025551234      ✅ EUA
442071234567     ✅ Reino Unido

// INVÁLIDOS:
+55 11 99999-9999  ❌ Espaços e hífen
(11) 99999-9999    ❌ Parênteses e hífen
11999999999        ❌ Falta código do país (55)
055-11-9999-9999   ❌ Zeros à esquerda e hífens
```

**Validação automática:**

```typescript
// whatsapp.service.v2.ts
public validatePhoneNumber(phoneNumber: string): boolean {
  // Remover espaços e caracteres especiais
  const cleaned = phoneNumber.replace(/[\s\-\(\)\+]/g, '');

  // Validar formato E.164: apenas dígitos, 8-15 caracteres
  const e164Regex = /^\d{8,15}$/;

  if (!e164Regex.test(cleaned)) {
    return false;
  }

  // Validar código do país (não pode começar com 0)
  if (cleaned.startsWith('0')) {
    return false;
  }

  return true;
}

public formatPhoneNumber(phoneNumber: string): string {
  // Remover tudo exceto dígitos
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Remover zeros à esquerda
  cleaned = cleaned.replace(/^0+/, '');

  // Se não tiver código do país e parecer brasileiro, adicionar +55
  if (cleaned.length === 11 && cleaned.startsWith('11')) {
    cleaned = '55' + cleaned;
  }

  return cleaned;
}
```

### 2. Validação de Texto

**Limites da WhatsApp API:**
- Mensagem de texto: **4096 caracteres**
- Caption (mídia): **1024 caracteres**
- Header (interactive): **60 caracteres**
- Footer (interactive): **60 caracteres**
- Button title: **20 caracteres**
- List item title: **24 caracteres**
- List item description: **72 caracteres**

**Validação automática:**

```typescript
// whatsapp.service.v2.ts
if (text.length > 4096) {
  throw new BadRequestError('Texto excede limite de 4096 caracteres');
}

if (!text || text.trim().length === 0) {
  throw new BadRequestError('Texto não pode ser vazio');
}
```

### 3. Validação de Mídia

**Requisitos:**
- URL deve começar com `https://`
- URL deve ser pública (sem autenticação)
- Formato do arquivo deve ser suportado
- Tamanho deve estar dentro dos limites

```typescript
// whatsapp.service.v2.ts
if (!mediaUrl || !mediaUrl.startsWith('http')) {
  throw new BadRequestError('URL de mídia inválida - deve começar com https://');
}

if (caption && caption.length > 1024) {
  throw new BadRequestError('Caption excede limite de 1024 caracteres');
}
```

### 4. Validação de Template

```typescript
// whatsapp.service.v2.ts
if (!templateName || templateName.length === 0) {
  throw new BadRequestError('Nome do template não pode ser vazio');
}

if (parameters.length > 10) {
  throw new BadRequestError('Template não pode ter mais de 10 parâmetros por componente');
}
```

### 5. Validação de Buttons

```typescript
// whatsapp.service.v2.ts
if (buttons.length === 0 || buttons.length > 3) {
  throw new BadRequestError('Número de botões deve ser entre 1 e 3');
}

buttons.forEach((btn, index) => {
  if (!btn.id || btn.id.length === 0) {
    throw new BadRequestError(`Botão ${index + 1}: ID não pode ser vazio`);
  }

  if (!btn.title || btn.title.length === 0) {
    throw new BadRequestError(`Botão ${index + 1}: título não pode ser vazio`);
  }

  if (btn.title.length > 20) {
    throw new BadRequestError(`Botão ${index + 1}: título excede 20 caracteres`);
  }
});

// Validar IDs únicos
const ids = buttons.map((b) => b.id);
if (new Set(ids).size !== ids.length) {
  throw new BadRequestError('IDs dos botões devem ser únicos');
}
```

### 6. Validação de List

```typescript
// whatsapp.service.v2.ts
let totalRows = 0;
sections.forEach((section, sectionIndex) => {
  if (!section.rows || section.rows.length === 0) {
    throw new BadRequestError(`Seção ${sectionIndex + 1}: deve ter pelo menos 1 item`);
  }

  totalRows += section.rows.length;

  section.rows.forEach((row, rowIndex) => {
    if (!row.title || row.title.length === 0) {
      throw new BadRequestError(`Seção ${sectionIndex + 1}, Item ${rowIndex + 1}: título não pode ser vazio`);
    }

    if (row.title.length > 24) {
      throw new BadRequestError(`Seção ${sectionIndex + 1}, Item ${rowIndex + 1}: título excede 24 caracteres`);
    }

    if (row.description && row.description.length > 72) {
      throw new BadRequestError(`Seção ${sectionIndex + 1}, Item ${rowIndex + 1}: descrição excede 72 caracteres`);
    }
  });
});

if (totalRows > 10) {
  throw new BadRequestError('Lista não pode ter mais de 10 itens no total');
}
```

---

## ⏱️ Rate Limiting

### Limites da Meta (WhatsApp Cloud API)

| Tipo | Limite | Janela |
|------|--------|--------|
| **Mensagens de negócio** | 80 mensagens | 1 segundo |
| **Mensagens de marketing** | 20 mensagens | 1 segundo |
| **Mensagens para mesmo número** | 1000 mensagens | 24 horas |
| **Requisições API** | 200 requisições | 1 segundo |

### Implementação no Bull Queue

```typescript
// whatsapp-webhook.queue.ts
export const whatsappOutgoingMessageQueue = new Queue<SendMessageJobData>(
  'whatsapp:outgoing:message',
  {
    redis: REDIS_CONFIG,
    defaultJobOptions: QUEUE_OPTIONS.defaultJobOptions,
    limiter: {
      max: 80,       // Máximo 80 mensagens
      duration: 1000, // Por 1 segundo (1000ms)
    },
  }
);
```

**Como funciona:**
1. Worker processa no máximo 80 jobs por segundo
2. Se limite for atingido, próximos jobs aguardam
3. Não há rejeição, apenas atraso
4. Protege contra erro 80007 (rate limit hit)

### Monitoramento de Rate Limiting

```typescript
// Verificar quantos jobs estão aguardando devido ao rate limit
const queue = whatsappOutgoingMessageQueue;
const counts = await queue.getJobCounts();

console.log({
  waiting: counts.waiting,    // Aguardando processamento
  active: counts.active,      // Sendo processados agora
  delayed: counts.delayed,    // Delayed por rate limit ou retry
  completed: counts.completed,
  failed: counts.failed,
});
```

### Best Practices para Rate Limiting

1. **Não enviar em rajadas:**
   ```typescript
   // ❌ ERRADO - Enfileira 1000 mensagens de uma vez
   for (let i = 0; i < 1000; i++) {
     await messageServiceV2.sendMessage({ ... });
   }

   // ✅ CORRETO - Bull gerencia automaticamente
   for (let i = 0; i < 1000; i++) {
     await messageServiceV2.sendMessage({ ... });
   }
   // Isso é OK porque Bull limita a 80 msg/s internamente
   ```

2. **Usar priority para mensagens importantes:**
   ```typescript
   await enqueueOutgoingMessage(
     {
       tenantId,
       conversationId,
       messageId,
       to,
       type: 'text',
       content: 'Mensagem URGENTE',
     },
     {
       priority: 1, // 1 = alta prioridade, 10 = baixa
     }
   );
   ```

3. **Monitorar jobs falhados por rate limit:**
   ```typescript
   const failed = await queue.getFailed();
   const rateLimitErrors = failed.filter((job) =>
     job.failedReason?.includes('80007')
   );

   // Se muitos erros 80007, considerar aumentar delay entre envios
   ```

---

## 📖 Exemplos de Uso

### Exemplo 1: Enviar Texto Simples

```typescript
import { messageServiceV2 } from '@/services/message.service.v2';

// Em um controller ou route handler
app.post('/api/messages', async (req, res) => {
  try {
    const { conversationId, content, sentById } = req.body;
    const tenantId = req.tenant.id; // Do middleware de auth

    const message = await messageServiceV2.sendMessage(
      {
        conversationId,
        content,
        type: 'TEXT',
        sentById,
      },
      tenantId
    );

    // Retorna imediatamente com status SENT
    // Worker envia em background
    res.status(200).json({ message });
  } catch (error) {
    if (error instanceof BadRequestError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
  }
});
```

### Exemplo 2: Enviar Imagem com Caption

```typescript
const message = await messageServiceV2.sendMessage(
  {
    conversationId: 'conv-abc123',
    content: 'https://cdn.exemplo.com/produtos/camiseta-azul.jpg',
    type: 'IMAGE',
    sentById: 'user-xyz',
    metadata: {
      caption: 'Camiseta Azul - Tamanho M - R$ 49,90 🔥',
    },
  },
  'tenant-hotel-abc'
);
```

### Exemplo 3: Enviar Template de Confirmação

```typescript
const message = await messageServiceV2.sendTemplateMessage(
  'tenant-hotel-abc',
  'conv-abc123',
  'reserva_confirmada',
  [
    'João Silva',           // {{1}} - Nome do cliente
    '15',                   // {{2}} - Dia
    'dezembro',             // {{3}} - Mês
    '14:00',                // {{4}} - Horário
    'Suite Presidential',   // {{5}} - Tipo de quarto
  ],
  'user-xyz',  // sentById
  'pt_BR'
);
```

### Exemplo 4: Menu com Botões

```typescript
import { whatsAppServiceV2 } from '@/services/whatsapp.service.v2';

// Buscar conversa para pegar número do contato
const conversation = await prisma.conversation.findUnique({
  where: { id: 'conv-abc123' },
  include: { contact: true },
});

await whatsAppServiceV2.sendInteractiveButtons(
  'tenant-hotel-abc',
  conversation.contact.phoneNumber,
  'Bem-vindo ao Hotel ABC! Como posso ajudá-lo?',
  [
    { id: 'nova_reserva', title: 'Nova Reserva' },
    { id: 'ver_reservas', title: 'Minhas Reservas' },
    { id: 'falar_atendente', title: 'Falar com Atendente' },
  ],
  {
    headerText: 'Menu Principal',
    footerText: 'Disponível 24/7',
  }
);

// IMPORTANTE: Criar mensagem no banco após enviar
await prisma.message.create({
  data: {
    tenantId: 'tenant-hotel-abc',
    conversationId: 'conv-abc123',
    direction: 'OUTBOUND',
    type: 'INTERACTIVE',
    content: 'Menu de opções',
    metadata: {
      interactiveType: 'button',
      buttons: [...],
    },
    sentById: 'user-xyz',
    timestamp: new Date(),
    status: 'SENT',
  },
});
```

### Exemplo 5: Catálogo com List

```typescript
await whatsAppServiceV2.sendInteractiveList(
  'tenant-hotel-abc',
  '5511999999999',
  'Escolha o tipo de quarto que deseja reservar:',
  'Ver quartos disponíveis',
  [
    {
      title: 'Quartos Standard',
      rows: [
        {
          id: 'quarto_single',
          title: 'Single',
          description: 'Cama de solteiro - R$ 150/noite',
        },
        {
          id: 'quarto_double',
          title: 'Double',
          description: 'Cama de casal - R$ 200/noite',
        },
      ],
    },
    {
      title: 'Quartos Premium',
      rows: [
        {
          id: 'quarto_suite',
          title: 'Suite Master',
          description: 'Cama king size + sala - R$ 350/noite',
        },
        {
          id: 'quarto_presidential',
          title: 'Suite Presidential',
          description: 'Luxo completo - R$ 800/noite',
        },
      ],
    },
  ]
);
```

### Exemplo 6: Envio em Massa (Broadcast)

```typescript
// Buscar todos os contatos que querem receber promoções
const contacts = await prisma.contact.findMany({
  where: {
    tenantId: 'tenant-hotel-abc',
    optInMarketing: true, // Importante: sempre ter opt-in
  },
  include: {
    conversations: {
      take: 1,
      orderBy: { lastMessageAt: 'desc' },
    },
  },
});

// Enviar template de promoção para cada um
for (const contact of contacts) {
  const conversation = contact.conversations[0];

  if (!conversation) continue; // Pular se não tiver conversa

  try {
    await messageServiceV2.sendTemplateMessage(
      'tenant-hotel-abc',
      conversation.id,
      'promocao_fim_de_semana',
      [contact.name || 'Cliente', '30%', 'sexta-feira'],
      'user-xyz',
      'pt_BR'
    );

    // Aguardar um pouco para não sobrecarregar
    // Bull vai limitar automaticamente a 80 msg/s
  } catch (error) {
    logger.error(
      { contactId: contact.id, error: error.message },
      'Erro ao enviar broadcast'
    );
    // Continuar com próximo contato
  }
}
```

### Exemplo 7: Re-engagement após 24h

```typescript
// Verificar se a última mensagem foi há mais de 24h
const lastMessage = await prisma.message.findFirst({
  where: {
    conversationId: 'conv-abc123',
    direction: 'INBOUND', // Última mensagem DO cliente
  },
  orderBy: { timestamp: 'desc' },
});

const hoursSinceLastMessage = lastMessage
  ? (Date.now() - lastMessage.timestamp.getTime()) / (1000 * 60 * 60)
  : 999;

if (hoursSinceLastMessage > 24) {
  // Fora da janela de 24h - DEVE usar template
  await messageServiceV2.sendTemplateMessage(
    'tenant-hotel-abc',
    'conv-abc123',
    'retorno_atendimento',
    ['João Silva'],
    'user-xyz',
    'pt_BR'
  );
} else {
  // Dentro da janela de 24h - pode usar mensagem normal
  await messageServiceV2.sendMessage(
    {
      conversationId: 'conv-abc123',
      content: 'Olá! Posso ajudar com mais alguma coisa?',
      type: 'TEXT',
      sentById: 'user-xyz',
    },
    'tenant-hotel-abc'
  );
}
```

---

## 🐛 Troubleshooting

### Problema 1: Mensagem não é enviada

**Sintomas:**
- Message criada no banco com status SENT
- Mas nunca aparece whatsappMessageId
- Cliente não recebe

**Possíveis causas:**

1. **Worker não está rodando**
   ```bash
   # Verificar logs do backend
   docker logs crm-backend --tail 100 | grep "workers registered"

   # Deve aparecer:
   # ✅ Outgoing message worker registered (concurrency: 3)
   ```

2. **Job ficou preso na fila**
   ```typescript
   const queue = whatsappOutgoingMessageQueue;
   const stalled = await queue.getStalled();
   console.log('Stalled jobs:', stalled.length);

   // Se > 0, limpar:
   await queue.clean(0, 'active');
   ```

3. **Redis desconectado**
   ```bash
   docker exec crm-redis redis-cli -a PASSWORD PING
   # Deve retornar: PONG
   ```

4. **Credenciais WhatsApp inválidas**
   ```sql
   SELECT
     id,
     name,
     whatsapp_phone_number_id,
     whatsapp_access_token
   FROM tenants
   WHERE id = 'tenant-xxx';

   -- Verificar se campos não estão NULL
   ```

**Solução:**
1. Verificar logs do worker para ver erro específico
2. Verificar se credenciais estão corretas
3. Testar credenciais manualmente com curl

---

### Problema 2: Error 131047 (Re-engagement Required)

**Sintoma:**
```json
{
  "error": {
    "code": 131047,
    "title": "Re-engagement message",
    "details": "Use a template message"
  }
}
```

**Causa:**
Cliente não interage há mais de 24 horas e você tentou enviar mensagem regular (não template).

**Solução:**
Usar template message ao invés de mensagem regular:

```typescript
// ❌ ERRADO (após 24h)
await messageServiceV2.sendMessage({
  conversationId,
  content: 'Olá, tudo bem?',
  type: 'TEXT',
  sentById: userId,
}, tenantId);

// ✅ CORRETO
await messageServiceV2.sendTemplateMessage(
  tenantId,
  conversationId,
  'retorno_atendimento',
  ['Nome do Cliente'],
  userId,
  'pt_BR'
);
```

**Prevenção:**
Sempre verificar lastMessageAt antes de enviar:

```typescript
const conversation = await prisma.conversation.findUnique({
  where: { id: conversationId },
});

const hoursSince = (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60);

if (hoursSince > 24) {
  // Usar template
} else {
  // Pode usar mensagem normal
}
```

---

### Problema 3: Error 80007 (Rate Limit)

**Sintoma:**
```json
{
  "error": {
    "code": 80007,
    "title": "Rate limit hit",
    "details": "Too many messages sent"
  }
}
```

**Causa:**
Enviou mais de 80 mensagens em 1 segundo.

**Solução imediata:**
Bull já tenta automaticamente após backoff. Nada a fazer.

**Solução permanente:**
Verificar se limiter está configurado:

```typescript
// whatsapp-webhook.queue.ts
export const whatsappOutgoingMessageQueue = new Queue<SendMessageJobData>(
  'whatsapp:outgoing:message',
  {
    limiter: {
      max: 80,       // ✅ Deve estar configurado
      duration: 1000,
    },
  }
);
```

Se já está configurado e ainda ocorre, significa que há múltiplas instâncias do backend enviando. Nesse caso:
- Reduzir `max` para 40-50 por instância
- Ou usar apenas 1 instância para envio

---

### Problema 4: Template não encontrado (133015)

**Sintoma:**
```json
{
  "error": {
    "code": 133015,
    "title": "Template does not exist",
    "details": "Template name is invalid"
  }
}
```

**Causa:**
- Template não existe no WhatsApp Business Manager
- Nome do template está incorreto
- Template foi deletado

**Solução:**
1. Verificar nome do template no WhatsApp Business Manager:
   - Ir para Meta Business Suite → WhatsApp → Message Templates
   - Copiar nome EXATO (case-sensitive, underscore, etc.)

2. Verificar se template está aprovado:
   - Status deve ser "Approved" (não "Pending" ou "Rejected")

3. Usar nome correto:
   ```typescript
   // ❌ ERRADO
   await messageServiceV2.sendTemplateMessage(
     tenantId,
     conversationId,
     'ReservaConfirmada',  // CamelCase
     ...
   );

   // ✅ CORRETO
   await messageServiceV2.sendTemplateMessage(
     tenantId,
     conversationId,
     'reserva_confirmada', // snake_case, como aparece na Meta
     ...
   );
   ```

---

### Problema 5: Parâmetros do template incorretos (132000)

**Sintoma:**
```json
{
  "error": {
    "code": 132000,
    "title": "Template parameter count mismatch",
    "details": "Expected 3 parameters, got 2"
  }
}
```

**Causa:**
Número de parâmetros passados não corresponde aos placeholders do template.

**Solução:**
1. Verificar template na Meta:
   ```
   Olá {{1}}! Sua reserva para {{2}} às {{3}} foi confirmada.
   ```
   → Tem 3 placeholders ({{1}}, {{2}}, {{3}})

2. Passar exatamente 3 parâmetros:
   ```typescript
   // ❌ ERRADO - Só 2 parâmetros
   await messageServiceV2.sendTemplateMessage(
     tenantId,
     conversationId,
     'reserva_confirmada',
     ['João Silva', '15/12/2025'], // Falta o horário
     userId,
     'pt_BR'
   );

   // ✅ CORRETO - 3 parâmetros
   await messageServiceV2.sendTemplateMessage(
     tenantId,
     conversationId,
     'reserva_confirmada',
     ['João Silva', '15/12/2025', '14:00'], // Todos os parâmetros
     userId,
     'pt_BR'
   );
   ```

---

### Problema 6: Número não tem WhatsApp (131031)

**Sintoma:**
```json
{
  "error": {
    "code": 131031,
    "title": "Phone number not on WhatsApp",
    "details": "Recipient is not on WhatsApp"
  }
}
```

**Causa:**
Número de telefone não tem WhatsApp instalado.

**Solução:**
1. Marcar contato como inválido:
   ```typescript
   await prisma.contact.update({
     where: { id: contactId },
     data: {
       isWhatsAppValid: false,
       lastCheckedAt: new Date(),
     },
   });
   ```

2. Não tentar enviar novamente:
   ```typescript
   const contact = await prisma.contact.findUnique({
     where: { id: contactId },
   });

   if (contact.isWhatsAppValid === false) {
     throw new BadRequestError('Contato não tem WhatsApp');
   }
   ```

3. Considerar validação prévia (opcional):
   - WhatsApp não tem API oficial para validar números
   - Alternativas: Twilio Lookup API, AbstractAPI, etc.

---

## 🎯 Best Practices

### 1. Sempre usar enfileiramento

```typescript
// ❌ ERRADO - Envio direto (síncrono)
const result = await whatsAppServiceV2.sendTextMessage(tenantId, to, text);
await prisma.message.update({
  where: { id: messageId },
  data: { whatsappMessageId: result.whatsappMessageId },
});

// ✅ CORRETO - Enfileirar (assíncrono)
const message = await messageServiceV2.sendMessage(
  { conversationId, content, type: 'TEXT', sentById },
  tenantId
);
// Retorna imediatamente, worker envia em background
```

### 2. Validar janela de 24h antes de enviar

```typescript
function canSendRegularMessage(conversation: Conversation): boolean {
  if (!conversation.lastMessageAt) return false;

  const hoursSince = (Date.now() - conversation.lastMessageAt.getTime()) / (1000 * 60 * 60);
  return hoursSince <= 24;
}

if (canSendRegularMessage(conversation)) {
  await messageServiceV2.sendMessage({ ... });
} else {
  await messageServiceV2.sendTemplateMessage({ ... });
}
```

### 3. Sempre ter opt-in para marketing

```typescript
// ❌ ERRADO - Enviar marketing sem consentimento
const allContacts = await prisma.contact.findMany();
for (const contact of allContacts) {
  await sendMarketingTemplate(contact);
}

// ✅ CORRETO - Apenas para quem deu opt-in
const optedInContacts = await prisma.contact.findMany({
  where: { optInMarketing: true },
});
for (const contact of optedInContacts) {
  await sendMarketingTemplate(contact);
}
```

### 4. Lidar com erros não-retryable

```typescript
try {
  await messageServiceV2.sendMessage({ ... });
} catch (error) {
  if (error instanceof WhatsAppApiError) {
    if (!error.isRetryable) {
      // Erros como "número não tem WhatsApp" não devem retry
      logger.error({ error }, 'Non-retryable error, marking as failed');

      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'FAILED' },
      });

      // Notificar atendente
      await notifyAttendant(tenantId, conversationId, 'Falha ao enviar mensagem');

      return; // Não fazer throw
    }
  }

  // Outros erros: fazer throw para retry
  throw error;
}
```

### 5. Usar logging estruturado

```typescript
// ❌ ERRADO
console.log('Sending message to ' + phoneNumber);

// ✅ CORRETO
logger.info(
  {
    tenantId,
    conversationId,
    messageId,
    to: phoneNumber,
    type: 'TEXT',
  },
  'Sending message'
);
```

### 6. Cachear instâncias Axios

```typescript
// ✅ JÁ IMPLEMENTADO em whatsapp.service.v2.ts
private axiosCache = new Map<string, { instance: AxiosInstance; expiresAt: number }>();

private getAxiosInstance(tenantId: string): AxiosInstance {
  const cached = this.axiosCache.get(tenantId);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.instance; // Usar cache
  }

  // Criar nova instância e cachear por 5 min
  const instance = axios.create({ ... });
  this.axiosCache.set(tenantId, {
    instance,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return instance;
}
```

### 7. Validar antes de enfileirar

```typescript
// ✅ CORRETO - Validar ANTES de criar no banco
if (!whatsAppServiceV2.validatePhoneNumber(phoneNumber)) {
  throw new BadRequestError('Número de telefone inválido');
}

if (text.length > 4096) {
  throw new BadRequestError('Texto excede limite de 4096 caracteres');
}

// Agora sim, criar e enfileirar
const message = await prisma.message.create({ ... });
await enqueueOutgoingMessage({ ... });
```

### 8. Monitorar filas regularmente

```typescript
// Criar endpoint de health check
app.get('/health/queues', async (req, res) => {
  const queues = [
    whatsappIncomingMessageQueue,
    whatsappStatusUpdateQueue,
    whatsappOutgoingMessageQueue,
    whatsappMediaDownloadQueue,
  ];

  const status = await Promise.all(
    queues.map(async (queue) => {
      const counts = await queue.getJobCounts();
      return {
        name: queue.name,
        ...counts,
      };
    })
  );

  res.json({ queues: status });
});
```

### 9. Limpar jobs antigos periodicamente

```typescript
// Criar cron job para limpar jobs completados com mais de 7 dias
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  // Executar às 2h da manhã todos os dias
  const queues = [
    whatsappIncomingMessageQueue,
    whatsappStatusUpdateQueue,
    whatsappOutgoingMessageQueue,
    whatsappMediaDownloadQueue,
  ];

  for (const queue of queues) {
    const removed = await queue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
    logger.info(
      { queueName: queue.name, removed: removed.length },
      'Cleaned old completed jobs'
    );
  }
});
```

### 10. Usar transaction para criar mensagem + enfileirar

```typescript
// ✅ MELHOR PRÁTICA
await prisma.$transaction(async (tx) => {
  // 1. Criar mensagem
  const message = await tx.message.create({
    data: { ... },
  });

  // 2. Enfileirar
  await enqueueOutgoingMessage({
    messageId: message.id,
    ...
  });

  // 3. Atualizar conversa
  await tx.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
});
```

---

## 📚 Referências

- [WhatsApp Cloud API Official Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Business Management API](https://developers.facebook.com/docs/whatsapp/business-management-api)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Zod Validation](https://github.com/colinhacks/zod)
- [Prisma ORM](https://www.prisma.io/docs)

---

**Última atualização:** 12/11/2025
**Versão:** 2.0.0
**Autor:** Sistema CRM WhatsApp Multi-Tenant
