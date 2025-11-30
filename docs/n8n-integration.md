# Integracao N8N com WhatsApp Business API

Este documento descreve como integrar o N8N com o CRM usando a API oficial do WhatsApp Business.

## Autenticacao N8N (API Key)

Todas as rotas `/api/n8n/*` usam autenticacao por API Key no header `X-API-Key`.

**Formato da API Key:** `{tenant-slug}:{secret-key}`

**Exemplo:** `hoteis-reserva:abc123xyz`

A secret-key pode ser:

- O campo `n8nApiKey` configurado no tenant (recomendado)
- Ou o `whatsappPhoneNumberId` do tenant (fallback)

## Endpoints N8N (Compativeis com Z-API)

Estes endpoints aceitam payloads no formato Z-API para facilitar a migracao.

### POST /api/n8n/send-text

Envia mensagem de texto simples.

**Headers:**

```text
X-API-Key: hoteis-reserva:sua-secret-key
Content-Type: application/json
```

**Body (formato Z-API):**

```json
{
  "phone": "5511999999999",
  "message": "Texto da mensagem",
  "delayTyping": 1
}
```

**Response:**

```json
{
  "success": true,
  "messageId": "wamid.xxx",
  "zapiResponse": {
    "messageId": "wamid.xxx",
    "id": "wamid.xxx"
  }
}
```

### POST /api/n8n/send-buttons

Envia mensagem com botoes interativos (maximo 3).

**Body:**

```json
{
  "phone": "5511999999999",
  "message": "Escolha uma opcao:",
  "buttons": [
    { "id": "btn1", "label": "Opcao 1" },
    { "id": "btn2", "label": "Opcao 2" },
    { "id": "btn3", "label": "Opcao 3" }
  ],
  "title": "Titulo opcional",
  "footer": "Rodape opcional"
}
```

### POST /api/n8n/send-list

Envia mensagem com lista de opcoes (ate 10 itens).

**Body (formato Z-API):**

```json
{
  "phone": "5511999999999",
  "message": "Escolha uma opcao:",
  "optionList": {
    "title": "Menu Principal",
    "buttonLabel": "Ver opcoes",
    "options": [
      { "id": "opt1", "title": "Opcao 1", "description": "Descricao 1" },
      { "id": "opt2", "title": "Opcao 2", "description": "Descricao 2" }
    ]
  }
}
```

**Body (formato Cloud API):**

```json
{
  "phone": "5511999999999",
  "message": "Escolha uma opcao:",
  "buttonText": "Ver opcoes",
  "sections": [
    {
      "title": "Secao 1",
      "rows": [
        { "id": "opt1", "title": "Opcao 1", "description": "Descricao" }
      ]
    }
  ]
}
```

### POST /api/n8n/send-media

Envia mensagem com midia (imagem, video, audio, documento).

**Body:**

```json
{
  "phone": "5511999999999",
  "type": "image",
  "url": "https://example.com/image.jpg",
  "caption": "Legenda opcional"
}
```

**Tipos suportados:** `image`, `video`, `audio`, `document`

### POST /api/n8n/send-template

Envia template pre-aprovado pela Meta.

**Body:**

```json
{
  "phone": "5511999999999",
  "template": "nome_do_template",
  "language": "pt_BR",
  "parameters": ["param1", "param2"]
}
```

### GET /api/n8n/check-ia-lock

Verifica se IA esta travada para um telefone. N8N deve chamar antes de responder.

**Query params:**

- `phone` - Numero do telefone (formato: 5511999999999)

**Response:**

```json
{
  "locked": true,
  "conversationId": "uuid"
}
```

Se `locked: true`, N8N NAO deve responder - atendente humano esta no controle.

### POST /api/n8n/escalate

Criar escalacao (transferir para humano).

**Body:**

```json
{
  "phone": "5511999999999",
  "reason": "USER_REQUESTED",
  "reasonDetail": "Cliente pediu atendente",
  "hotelUnit": "Campos do Jordao",
  "messageHistory": [
    { "role": "user", "content": "Mensagem do cliente" },
    { "role": "assistant", "content": "Resposta da IA" }
  ],
  "priority": "HIGH"
}
```

**Reasons disponiveis:**

- `USER_REQUESTED` - Cliente solicitou atendente
- `AI_UNABLE` - IA nao conseguiu resolver
- `COMPLEX_QUERY` - Consulta complexa
- `COMPLAINT` - Reclamacao
- `SALES_OPPORTUNITY` - Oportunidade de venda
- `URGENCY` - Urgencia detectada
- `OTHER` - Outro motivo

**Priorities disponiveis:**

- `LOW`
- `MEDIUM`
- `HIGH`
- `URGENT`

### POST /api/n8n/mark-read

Marcar mensagem como lida.

**Body:**

```json
{
  "messageId": "wamid.xxx"
}
```

## Mapeamento Z-API para Cloud API

| Z-API Endpoint | N8N Endpoint | Notas |
|----------------|--------------|-------|
| `/send-text` | `/api/n8n/send-text` | Compativel |
| `/send-buttons` | `/api/n8n/send-buttons` | Max 3 botoes |
| `/send-option-list` | `/api/n8n/send-list` | Formato convertido |
| `/send-image` | `/api/n8n/send-media` | type=image |
| `/send-video` | `/api/n8n/send-media` | type=video |
| `/send-audio` | `/api/n8n/send-media` | type=audio |
| `/send-document` | `/api/n8n/send-media` | type=document |
| `/send-carousel` | Templates | Requer template aprovado |

## Exemplo de Configuracao N8N

### HTTP Request Node - Enviar Texto

```text
Method: POST
URL: https://api.seudominio.com/api/n8n/send-text
Headers:
  X-API-Key: hoteis-reserva:sua-secret-key
  Content-Type: application/json
Body:
{
  "phone": "{{ $json.phone }}",
  "message": "{{ $json.resposta }}"
}
```

### HTTP Request Node - Verificar IA Lock

```text
Method: GET
URL: https://api.seudominio.com/api/n8n/check-ia-lock?phone={{ $json.phone }}
Headers:
  X-API-Key: hoteis-reserva:sua-secret-key
```

### HTTP Request Node - Escalar

```text
Method: POST
URL: https://api.seudominio.com/api/n8n/escalate
Headers:
  X-API-Key: hoteis-reserva:sua-secret-key
  Content-Type: application/json
Body:
{
  "phone": "{{ $json.phone }}",
  "reason": "USER_REQUESTED",
  "hotelUnit": "{{ $json.unidade }}",
  "messageHistory": {{ JSON.stringify($json.historico) }}
}
```

## Fluxo Recomendado no N8N

1. Webhook recebe mensagem do WhatsApp
2. Verificar IA Lock: `GET /api/n8n/check-ia-lock?phone=xxx`
3. Se `locked: true`, ignorar (atendente no controle)
4. Se `locked: false`, processar com IA
5. Se IA detectar necessidade de humano, chamar `/api/n8n/escalate`
6. Enviar resposta via `/api/n8n/send-text` ou `/api/n8n/send-buttons`

## Unidades de Hotel

O sistema suporta 4 unidades:

- Campos do Jordao
- Ilhabela
- Camburi
- Santo Antonio do Pinhal

A unidade pode ser detectada pelo N8N baseado no contexto da conversa.

## Notificacoes em Tempo Real

Quando uma escalacao e criada:

1. **Socket.io Event**: `escalation:new` e emitido para todos atendentes do tenant
2. **Som de Alerta**: Frontend toca som de notificacao (3 beeps)
3. **Toast Notification**: Popup com detalhes da escalacao
4. **Browser Notification**: Se permissao concedida

## Troubleshooting

### Erro 401 - API Key invalida

1. Verifique o formato: `tenant-slug:secret-key`
2. Confira se o tenant existe e esta ACTIVE
3. Verifique se a secret-key corresponde ao `n8nApiKey` ou `whatsappPhoneNumberId`

### Erro 400 - WhatsApp nao configurado

1. O tenant precisa ter `whatsappPhoneNumberId` e `whatsappAccessToken` configurados
2. Verifique as credenciais da Meta Business Suite

### Escalacao nao aparece no dashboard

1. Verifique logs do backend: `docker logs crm-backend`
2. Confira se o Socket.io esta conectado no frontend
3. Verifique se o tenant ID esta correto

### Som de notificacao nao toca

1. Usuario precisa interagir com a pagina primeiro (clique)
2. Verifique se browser suporta Web Audio API
3. Confira console do browser para erros
