# Bot Reserva Hotéis - API Documentation

**Version:** 1.0.0
**Base URL:** `https://api.botreserva.com.br`
**Last Updated:** November 2025

---

## Overview

A API do Bot Reserva Hotéis permite integrar sistemas externos (como N8N, Make, Zapier) com o WhatsApp Business API oficial da Meta. Esta documentação cobre todos os endpoints disponíveis para envio de mensagens, gerenciamento de conversas e escalação para atendimento humano.

### Principais Recursos

- Envio de mensagens de texto, mídia, botões e listas
- Integração com WhatsApp Business API oficial (Cloud API)
- Sistema de escalação para atendimento humano
- Verificação de status de atendimento (IA bloqueada)
- Suporte a templates pré-aprovados
- Arquitetura multi-tenant

---

## Authentication

Todas as requisições à API devem incluir uma chave de API no header.

### Header Auth

| Header | Descrição |
|--------|-----------|
| `X-API-Key` | Chave de autenticação no formato `{tenant-slug}:{secret-key}` |

### Exemplo

```http
POST /api/n8n/send-text HTTP/1.1
Host: api.botreserva.com.br
X-API-Key: hoteis-reserva:782115004996178
Content-Type: application/json
```

### Erros de Autenticação

| Status | Erro | Descrição |
|--------|------|-----------|
| 401 | `API Key não fornecida` | Header X-API-Key ausente |
| 401 | `Formato de API Key inválido` | Formato incorreto (deve ser `slug:key`) |
| 401 | `API Key inválida` | Chave não encontrada ou incorreta |
| 403 | `Tenant não encontrado` | Slug do tenant não existe |

---

## Base URL

```
https://api.botreserva.com.br/api/n8n
```

Todos os endpoints abaixo são relativos a esta base URL.

---

## Endpoints

### Mensagens

#### POST /send-text

Envia uma mensagem de texto simples.

**Request Body**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | Sim | Número do destinatário (com DDI, ex: `5511999999999`) |
| `message` | string | Sim | Texto da mensagem (máx 4096 caracteres) |

**Exemplo de Request**

```json
{
  "phone": "5511999999999",
  "message": "Olá! Bem-vindo ao Hotel Reserva. Como posso ajudar?"
}
```

**Exemplo de Response (200 OK)**

```json
{
  "success": true,
  "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
  "botReservaResponse": {
    "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
    "id": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE="
  }
}
```

**cURL**

```bash
curl -X POST https://api.botreserva.com.br/api/n8n/send-text \
  -H "X-API-Key: hoteis-reserva:782115004996178" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "message": "Olá! Como posso ajudar?"
  }'
```

---

#### POST /send-buttons

Envia uma mensagem com botões interativos.

> **Limitação:** Máximo de 3 botões por mensagem (limitação da API do WhatsApp)

**Request Body**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | Sim | Número do destinatário |
| `message` | string | Sim | Texto da mensagem (corpo) |
| `buttons` | array | Sim | Array de botões (máx 3) |
| `buttons[].id` | string | Sim | ID único do botão (retornado quando clicado) |
| `buttons[].label` | string | Sim | Texto exibido no botão (máx 20 caracteres) |
| `title` | string | Não | Título da mensagem (máx 60 caracteres) |
| `footer` | string | Não | Rodapé da mensagem (máx 60 caracteres) |

**Exemplo de Request**

```json
{
  "phone": "5511999999999",
  "message": "Como posso ajudar você hoje?",
  "buttons": [
    { "id": "fazer_reserva", "label": "Fazer Reserva" },
    { "id": "ver_disponibilidade", "label": "Ver Disponibilidade" },
    { "id": "falar_atendente", "label": "Falar com Atendente" }
  ],
  "title": "Menu Principal",
  "footer": "Hotel Reserva"
}
```

**Exemplo de Response (200 OK)**

```json
{
  "success": true,
  "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
  "botReservaResponse": {
    "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
    "id": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE="
  }
}
```

**Erros Específicos**

| Status | Erro | Descrição |
|--------|------|-----------|
| 400 | `Máximo de 3 botões permitidos` | Enviou mais de 3 botões |
| 400 | `Campos obrigatórios: phone, message, buttons` | Campos faltando |

---

#### POST /send-list

Envia uma mensagem com lista de opções (menu interativo).

> **Vantagem:** Permite mais opções que botões (até 10 itens por seção, até 10 seções)

**Request Body (Formato Simplificado)**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | Sim | Número do destinatário |
| `message` | string | Sim | Texto da mensagem (corpo) |
| `buttonText` | string | Sim | Texto do botão que abre a lista (máx 20 caracteres) |
| `sections` | array | Sim | Array de seções |
| `sections[].title` | string | Não | Título da seção |
| `sections[].rows` | array | Sim | Itens da seção |
| `sections[].rows[].id` | string | Sim | ID único do item |
| `sections[].rows[].title` | string | Sim | Título do item (máx 24 caracteres) |
| `sections[].rows[].description` | string | Não | Descrição do item (máx 72 caracteres) |

**Exemplo de Request**

```json
{
  "phone": "5511999999999",
  "message": "Selecione qual unidade do Hotel Reserva você deseja informações:",
  "buttonText": "Ver unidades",
  "sections": [
    {
      "title": "Litoral",
      "rows": [
        { "id": "ilhabela", "title": "Ilhabela", "description": "Litoral Norte de SP" },
        { "id": "camburi", "title": "Camburi", "description": "Praia de Camburi" }
      ]
    },
    {
      "title": "Serra",
      "rows": [
        { "id": "campos", "title": "Campos do Jordão", "description": "Serra da Mantiqueira" },
        { "id": "santo_antonio", "title": "Santo Antônio do Pinhal", "description": "Interior de SP" }
      ]
    }
  ]
}
```

**Request Body (Formato Alternativo - Compatível Z-API)**

```json
{
  "phone": "5511999999999",
  "message": "Escolha uma opção:",
  "optionList": {
    "title": "Menu Principal",
    "buttonLabel": "Ver opções",
    "options": [
      { "id": "opt1", "title": "Opção 1", "description": "Descrição da opção 1" },
      { "id": "opt2", "title": "Opção 2", "description": "Descrição da opção 2" }
    ]
  }
}
```

**Exemplo de Response (200 OK)**

```json
{
  "success": true,
  "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
  "botReservaResponse": {
    "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
    "id": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE="
  }
}
```

---

#### POST /send-media

Envia mensagem com mídia (imagem, vídeo, áudio ou documento).

**Request Body**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | Sim | Número do destinatário |
| `type` | string | Sim* | Tipo de mídia: `image`, `video`, `audio`, `document` |
| `url` | string | Sim* | URL pública da mídia |
| `caption` | string | Não | Legenda (não disponível para áudio) |

*Alternativamente, pode usar formato específico por tipo (ver abaixo)

**Formatos Alternativos**

```json
// Formato com image
{
  "phone": "5511999999999",
  "image": {
    "url": "https://example.com/foto.jpg",
    "caption": "Foto do quarto"
  }
}

// Formato com document
{
  "phone": "5511999999999",
  "document": {
    "url": "https://example.com/contrato.pdf",
    "caption": "Contrato de hospedagem"
  }
}

// Formato com mediaUrl (auto-detecta tipo)
{
  "phone": "5511999999999",
  "mediaUrl": "https://example.com/video.mp4",
  "caption": "Tour pelo hotel"
}
```

**Exemplo de Request**

```json
{
  "phone": "5511999999999",
  "type": "image",
  "url": "https://example.com/quarto-luxo.jpg",
  "caption": "Quarto Luxo - Vista para o mar"
}
```

**Exemplo de Response (200 OK)**

```json
{
  "success": true,
  "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
  "botReservaResponse": {
    "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
    "id": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE="
  }
}
```

**Tipos de Mídia Suportados**

| Tipo | Extensões | Tamanho Máximo |
|------|-----------|----------------|
| `image` | jpg, jpeg, png, webp | 5 MB |
| `video` | mp4, 3gpp | 16 MB |
| `audio` | aac, mp3, ogg, opus | 16 MB |
| `document` | pdf, doc, docx, xls, xlsx, ppt, pptx | 100 MB |

---

#### POST /send-template

Envia um template de mensagem pré-aprovado pela Meta.

> **Nota:** Templates precisam ser criados e aprovados no Meta Business Manager antes de usar.

**Request Body**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | Sim | Número do destinatário |
| `template` | string | Sim | Nome do template aprovado |
| `language` | string | Não | Código do idioma (padrão: `pt_BR`) |
| `parameters` | array | Não | Parâmetros do template (em ordem) |

**Exemplo de Request**

```json
{
  "phone": "5511999999999",
  "template": "confirmacao_reserva",
  "language": "pt_BR",
  "parameters": ["João Silva", "15/12/2025", "Campos do Jordão"]
}
```

**Exemplo de Response (200 OK)**

```json
{
  "success": true,
  "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
  "botReservaResponse": {
    "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
    "id": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE="
  }
}
```

---

#### POST /send-carousel

Envia mensagem carousel (múltiplos cards com imagem e botões).

> **Nota:** Cada card é enviado como mensagem interativa separada. Máximo de 3 botões por card.

**Request Body**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | Sim | Número do destinatário |
| `message` | string | Não | Texto introdutório (enviado antes dos cards) |
| `carousel` | array | Sim | Array de cards |
| `carousel[].text` | string | Sim | Texto do card |
| `carousel[].image` | string | Não | URL da imagem do card |
| `carousel[].buttons` | array | Sim | Botões do card (máx 3) |
| `carousel[].buttons[].id` | string | Sim | ID do botão |
| `carousel[].buttons[].label` | string | Sim | Texto do botão |

**Exemplo de Request**

```json
{
  "phone": "5511999999999",
  "message": "Confira nossas opções de quartos:",
  "carousel": [
    {
      "text": "Quarto Luxo - Vista para o mar, ar condicionado, frigobar",
      "image": "https://example.com/quarto-luxo.jpg",
      "buttons": [
        { "id": "reservar_luxo", "label": "Reservar" },
        { "id": "ver_fotos_luxo", "label": "Ver fotos" }
      ]
    },
    {
      "text": "Quarto Standard - Confortável e econômico",
      "image": "https://example.com/quarto-standard.jpg",
      "buttons": [
        { "id": "reservar_standard", "label": "Reservar" },
        { "id": "ver_fotos_standard", "label": "Ver fotos" }
      ]
    },
    {
      "text": "Suíte Master - Experiência premium completa",
      "image": "https://example.com/suite-master.jpg",
      "buttons": [
        { "id": "reservar_master", "label": "Reservar" },
        { "id": "ver_fotos_master", "label": "Ver fotos" }
      ]
    }
  ]
}
```

**Exemplo de Response (200 OK)**

```json
{
  "success": true,
  "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
  "messageIds": [
    "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE=",
    "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDI=",
    "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDM=",
    "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDQ="
  ],
  "cardsCount": 3,
  "botReservaResponse": {
    "messageIds": ["..."],
    "cardsCount": 3
  }
}
```

**Erros Específicos**

| Status | Erro | Descrição |
|--------|------|-----------|
| 400 | `Campo obrigatório: carousel` | Array carousel não fornecido |
| 400 | `Card X: campo "text" é obrigatório` | Card sem texto |
| 400 | `Card X: máximo de 3 botões por card` | Mais de 3 botões em um card |

---

### Gerenciamento de Conversas

#### GET /check-ia-lock

Verifica se a IA está bloqueada para um determinado telefone (conversa foi escalada para humano).

**Query Parameters**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `phone` | string | Sim | Número do telefone a verificar |

**Exemplo de Request**

```
GET /api/n8n/check-ia-lock?phone=5511999999999
```

**Exemplo de Response (200 OK)**

```json
{
  "locked": true,
  "conversationId": "665bd12e-f978-4c7f-b2cd-7e6d7db597f0",
  "escalation": {
    "id": "811e3997-a906-4974-aaec-6d4dcc671829",
    "reason": "USER_REQUESTED",
    "createdAt": "2025-11-30T02:30:00.000Z"
  }
}
```

**Response quando IA NÃO está bloqueada**

```json
{
  "locked": false,
  "conversationId": "665bd12e-f978-4c7f-b2cd-7e6d7db597f0"
}
```

**Response quando não existe conversa**

```json
{
  "locked": false,
  "conversationId": null
}
```

**cURL**

```bash
curl -X GET "https://api.botreserva.com.br/api/n8n/check-ia-lock?phone=5511999999999" \
  -H "X-API-Key: hoteis-reserva:782115004996178"
```

---

#### POST /escalate

Cria uma escalação (transferência para atendimento humano).

Quando uma escalação é criada:
1. A IA é bloqueada para aquele telefone (`iaLocked = true`)
2. Uma notificação sonora é emitida no painel do atendente
3. A conversa é marcada com prioridade alta

**Request Body**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `phone` | string | Sim | Número do telefone do cliente |
| `reason` | string | Não | Motivo da escalação (ver tabela abaixo) |
| `reasonDetail` | string | Não | Detalhes adicionais do motivo |
| `hotelUnit` | string | Não | Unidade do hotel relacionada |
| `messageHistory` | array | Não | Histórico de mensagens para contexto |
| `aiContext` | string | Não | Contexto/resumo da conversa com IA |
| `priority` | string | Não | Prioridade: `LOW`, `MEDIUM`, `HIGH`, `URGENT` (padrão: `HIGH`) |

**Valores de `reason`**

| Valor | Descrição |
|-------|-----------|
| `USER_REQUESTED` | Cliente solicitou falar com humano |
| `AI_LIMIT_REACHED` | IA não conseguiu resolver |
| `COMPLEX_ISSUE` | Assunto complexo que requer humano |
| `PAYMENT_ISSUE` | Problema com pagamento |
| `COMPLAINT` | Reclamação |
| `URGENT` | Urgência |
| `OTHER` | Outro motivo |

**Exemplo de Request**

```json
{
  "phone": "5511999999999",
  "reason": "USER_REQUESTED",
  "reasonDetail": "Cliente pediu para falar com atendente sobre cancelamento",
  "hotelUnit": "Campos do Jordão",
  "aiContext": "Cliente perguntou sobre cancelamento de reserva para 15/12. Política não permite cancelamento gratuito.",
  "priority": "HIGH"
}
```

**Exemplo de Response (201 Created)**

```json
{
  "success": true,
  "escalation": {
    "id": "811e3997-a906-4974-aaec-6d4dcc671829",
    "reason": "USER_REQUESTED",
    "reasonDetail": "Cliente pediu para falar com atendente sobre cancelamento",
    "hotelUnit": "Campos do Jordão",
    "status": "PENDING",
    "priority": "HIGH",
    "createdAt": "2025-11-30T02:30:00.000Z"
  },
  "conversation": {
    "id": "665bd12e-f978-4c7f-b2cd-7e6d7db597f0",
    "status": "WAITING",
    "iaLocked": true
  },
  "contact": {
    "id": "7c21a5d2-a4f1-4640-97c5-85ce75ab5200",
    "phoneNumber": "5511999999999",
    "name": "João Silva"
  }
}
```

---

#### POST /mark-read

Marca uma mensagem como lida.

**Request Body**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `messageId` | string | Sim | ID da mensagem do WhatsApp (wamid) |

**Exemplo de Request**

```json
{
  "messageId": "wamid.HBgMNTU0ODk4NDQ4NzIyFQIAERgSMkE1RUE1OUYxMEZFNDU5RjlCMDE="
}
```

**Exemplo de Response (200 OK)**

```json
{
  "success": true
}
```

---

## Webhook (Recebendo Mensagens)

Para receber mensagens do WhatsApp, configure a URL do webhook no seu tenant.

### URL do Webhook

Configure no painel de administração ou solicite ao suporte:

```
n8nWebhookUrl: https://seu-n8n.com/webhook/seu-path
```

### Payload Recebido

Quando uma mensagem chega, seu webhook receberá:

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "text",
    "text": {
      "message": "Olá, gostaria de fazer uma reserva"
    },
    "messageId": "572fe4c1-5052-4bf6-a0b5-fc5db5843a17",
    "timestamp": 1732930571,
    "contactName": "João Silva",
    "conversationId": "665bd12e-f978-4c7f-b2cd-7e6d7db597f0",
    "isNewConversation": false
  }
}
```

### Tipos de Mensagem Recebidas

#### Texto

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "text",
    "text": {
      "message": "Conteúdo da mensagem"
    }
  }
}
```

#### Resposta de Botão

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "button",
    "text": {
      "message": "Fazer Reserva"
    },
    "buttonResponseMessage": {
      "selectedButtonId": "fazer_reserva",
      "selectedButtonText": "Fazer Reserva"
    }
  }
}
```

#### Resposta de Lista

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "list",
    "text": {
      "message": "Campos do Jordão"
    },
    "listResponseMessage": {
      "selectedRowId": "campos",
      "title": "Campos do Jordão",
      "description": "Serra da Mantiqueira"
    }
  }
}
```

#### Imagem

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "image",
    "image": {
      "url": "https://api.botreserva.com.br/media/abc123.jpg",
      "caption": "Foto do documento"
    }
  }
}
```

#### Áudio

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "audio",
    "audio": {
      "url": "https://api.botreserva.com.br/media/audio123.ogg"
    }
  }
}
```

#### Documento

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "document",
    "document": {
      "url": "https://api.botreserva.com.br/media/doc123.pdf",
      "filename": "comprovante.pdf"
    }
  }
}
```

#### Localização

```json
{
  "body": {
    "phone": "5511999999999",
    "type": "location",
    "location": {
      "latitude": -23.5505,
      "longitude": -46.6333,
      "name": "Hotel Reserva",
      "address": "Av. Paulista, 1000"
    }
  }
}
```

---

## Códigos de Erro

### Erros HTTP

| Código | Significado | Descrição |
|--------|-------------|-----------|
| 200 | OK | Requisição bem sucedida |
| 201 | Created | Recurso criado com sucesso |
| 400 | Bad Request | Parâmetros inválidos ou faltando |
| 401 | Unauthorized | Autenticação falhou |
| 403 | Forbidden | Sem permissão para o recurso |
| 404 | Not Found | Recurso não encontrado |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Erro interno do servidor |

### Formato de Erro

```json
{
  "error": "Descrição do erro",
  "message": "Detalhes adicionais (quando disponível)"
}
```

---

## Rate Limits

| Recurso | Limite |
|---------|--------|
| Mensagens por segundo | 80 |
| Requisições por minuto | 1000 |
| Webhooks por segundo | 100 |

---

## Boas Práticas

### 1. Tratamento de Telefone

Sempre envie o número com código do país, sem caracteres especiais:

```
✅ Correto: "5511999999999"
❌ Errado: "+55 (11) 99999-9999"
❌ Errado: "11999999999"
```

### 2. Verificar Lock Antes de Enviar

Sempre verifique se a IA está bloqueada antes de enviar mensagens automáticas:

```javascript
// 1. Verificar se está bloqueado
const check = await fetch('/api/n8n/check-ia-lock?phone=5511999999999');
const { locked } = await check.json();

// 2. Só enviar se não estiver bloqueado
if (!locked) {
  await fetch('/api/n8n/send-text', {
    method: 'POST',
    body: JSON.stringify({ phone: '5511999999999', message: 'Resposta da IA' })
  });
}
```

### 3. Usar Listas ao Invés de Botões

Quando tiver mais de 3 opções, use `/send-list` ao invés de `/send-buttons`:

```
✅ 4+ opções: use /send-list
✅ 1-3 opções: pode usar /send-buttons
```

### 4. Templates para Mensagens Proativas

Para iniciar conversa com cliente que não mandou mensagem nas últimas 24h, use templates:

```javascript
// Cliente não respondeu há mais de 24h
await fetch('/api/n8n/send-template', {
  method: 'POST',
  body: JSON.stringify({
    phone: '5511999999999',
    template: 'lembrete_checkin',
    parameters: ['João', '15/12/2025']
  })
});
```

---

## Suporte

- **Email:** suporte@botreserva.com.br
- **Documentação:** https://docs.botreserva.com.br
- **Status:** https://status.botreserva.com.br

---

## Changelog

### v1.0.0 (Novembro 2025)

- Release inicial
- Endpoints de envio: text, buttons, list, media, template
- Endpoints de gerenciamento: check-ia-lock, escalate, mark-read
- Integração com WhatsApp Cloud API oficial da Meta
- Sistema de escalação com notificação sonora
