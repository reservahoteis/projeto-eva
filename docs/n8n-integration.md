# Integracao N8N com WhatsApp Business API

Este documento descreve como integrar o N8N com o CRM usando a API oficial do WhatsApp Business.

## Arquitetura

```
WhatsApp Business API (Meta)
        |
        v
   N8N Workflow
   (IA Chatbot)
        |
        v
  CRM Backend API
  (Escalation)
        |
        v
  Frontend Dashboard
  (Atendentes)
```

## Fluxo de Escalacao

1. Cliente envia mensagem via WhatsApp
2. N8N recebe webhook da Meta e processa com IA
3. Quando IA nao consegue resolver, chama API de escalacao
4. CRM cria conversa, importa historico e notifica atendentes
5. Atendente assume conversa (IA fica travada)
6. Atendente responde via CRM, mensagem vai para WhatsApp

## Endpoints da API

### POST /api/escalations

Criar nova escalacao (chamado pelo N8N quando IA precisa transferir para humano).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
X-Tenant-ID: <tenant-id>
```

**Body:**
```json
{
  "contactPhoneNumber": "5511999999999",
  "reason": "USER_REQUESTED",
  "reasonDetail": "Cliente pediu para falar com atendente",
  "hotelUnit": "Campos do Jordao",
  "priority": "HIGH",
  "messageHistory": [
    {
      "role": "user",
      "content": "Ola, quero fazer uma reserva",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "Ola! Ficarei feliz em ajudar com sua reserva...",
      "timestamp": "2024-01-15T10:30:05Z"
    },
    {
      "role": "user",
      "content": "Quero falar com um atendente",
      "timestamp": "2024-01-15T10:31:00Z"
    }
  ],
  "aiContext": {
    "intent": "reservation",
    "sentiment": "neutral",
    "language": "pt-BR"
  }
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

**Response (201):**
```json
{
  "escalation": {
    "id": "uuid",
    "conversationId": "uuid",
    "reason": "USER_REQUESTED",
    "status": "PENDING",
    "hotelUnit": "Campos do Jordao",
    "createdAt": "2024-01-15T10:31:05Z"
  },
  "conversation": {
    "id": "uuid",
    "contactId": "uuid",
    "status": "OPEN",
    "iaLocked": true,
    "contact": {
      "phoneNumber": "5511999999999",
      "name": "Joao Silva"
    }
  },
  "contact": {
    "id": "uuid",
    "phoneNumber": "5511999999999"
  }
}
```

### GET /api/escalations/check-ia-lock

Verificar se IA esta travada para um telefone (N8N chama antes de responder).

**Query params:**
- `phoneNumber` - Numero do telefone (formato: 5511999999999)

**Response:**
```json
{
  "locked": true,
  "conversationId": "uuid"
}
```

Se `locked: true`, N8N NAO deve responder - atendente humano esta no controle.

### PATCH /api/conversations/:id/ia-lock

Toggle do lock de IA (atendente usa para reativar IA).

**Body:**
```json
{
  "locked": false
}
```

## Configuracao no N8N

### 1. Webhook WhatsApp (Meta Cloud API)

Configure um webhook no N8N para receber mensagens:

```
POST https://seu-n8n.com/webhook/whatsapp
```

### 2. Verificar IA Lock

Antes de processar com IA, verifique se conversa esta bloqueada:

```javascript
// HTTP Request node
const response = await $http.get(
  `${CRM_API_URL}/api/escalations/check-ia-lock`,
  {
    params: { phoneNumber: message.from },
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'X-Tenant-ID': TENANT_ID
    }
  }
);

if (response.data.locked) {
  // NAO responder - atendente no controle
  return [];
}

// Continuar com processamento IA
```

### 3. Escalar para Humano

Quando IA detectar necessidade de escalacao:

```javascript
// HTTP Request node
await $http.post(
  `${CRM_API_URL}/api/escalations`,
  {
    contactPhoneNumber: message.from,
    reason: 'AI_UNABLE',
    reasonDetail: 'Cliente solicitou informacao que requer atendente',
    hotelUnit: detectHotelUnit(message),
    messageHistory: conversationHistory,
    priority: 'HIGH'
  },
  {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'X-Tenant-ID': TENANT_ID,
      'Content-Type': 'application/json'
    }
  }
);
```

### 4. Enviar Mensagem de Transicao

Apos escalar, envie mensagem informando o cliente:

```javascript
// WhatsApp Cloud API
await sendWhatsAppMessage(
  message.from,
  'Estou transferindo voce para um de nossos atendentes. Por favor, aguarde um momento.'
);
```

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

## Autenticacao

Use o token de API do tenant para autenticar requisicoes:

```bash
curl -X POST https://api.seudominio.com/api/escalations \
  -H "Authorization: Bearer seu-token-aqui" \
  -H "X-Tenant-ID: tenant-uuid" \
  -H "Content-Type: application/json" \
  -d '{"contactPhoneNumber": "5511999999999", "reason": "USER_REQUESTED"}'
```

## Boas Praticas

1. **Sempre verificar IA lock** antes de responder automaticamente
2. **Incluir historico completo** da conversa atual na escalacao
3. **Detectar unidade do hotel** pelo contexto para roteamento correto
4. **Usar priority HIGH** para reclamacoes e urgencias
5. **Monitorar logs** do N8N para debugging

## Troubleshooting

### Escalacao nao aparece no dashboard

1. Verifique se o tenant ID esta correto
2. Confira se o token de API e valido
3. Verifique logs do backend: `docker logs crm-backend`

### Som de notificacao nao toca

1. Usuario precisa interagir com a pagina primeiro (clique)
2. Verifique se browser suporta Web Audio API
3. Confira console do browser para erros

### Mensagens duplicadas

1. Verifique se IA lock esta sendo checado corretamente
2. Confirme que webhook nao esta sendo chamado multiplas vezes
