# API Quick Reference Guide

## Base URL
```
Development: http://localhost:3000
Production:  https://api.botreserva.com.br
```

## Authentication

### JWT Token (BearerAuth)
```bash
# 1. Login
POST /auth/login
{
  "email": "admin@hotel.com",
  "password": "senha123",
  "tenantSlug": "hotel-ilhabela"
}

# Response contains:
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { ... }
}

# 2. Use token in requests
Authorization: Bearer eyJ...

# 3. Refresh when expired
POST /auth/refresh
{
  "refreshToken": "eyJ..."
}
```

### N8N API Key
```bash
# Format: tenantSlug:whatsappPhoneNumberId
X-API-Key: hotel-ilhabela:5511987654321000
```

## Core Resources

### Conversations
```bash
# List
GET /api/conversations?skip=0&take=10&status=OPEN

# Get single
GET /api/conversations/{id}

# Create
POST /api/conversations
{ "contactPhoneNumber": "5511987654321" }

# Update
PATCH /api/conversations/{id}
{ "status": "IN_PROGRESS", "hotelUnit": "Ilhabela" }

# Actions
POST /api/conversations/{id}/assign
POST /api/conversations/{id}/unassign
POST /api/conversations/{id}/close
POST /api/conversations/{id}/archive
PATCH /api/conversations/{id}/ia-lock

# Stats
GET /api/conversations/stats
```

### Messages
```bash
# List (nested under conversation)
GET /api/conversations/{conversationId}/messages?skip=0&take=50

# Send
POST /api/conversations/{conversationId}/messages
{
  "content": "Olá!",
  "type": "TEXT"
}

# Search globally
GET /api/messages/search?q=reserva&skip=0&take=20

# Stats
GET /api/conversations/{conversationId}/messages/stats
```

### Contacts
```bash
# List
GET /api/contacts?skip=0&take=10&search=João

# Get by ID
GET /api/contacts/{id}

# Get by phone
GET /api/contacts/phone/5511987654321

# Create
POST /api/contacts
{
  "phoneNumber": "5511987654321",
  "name": "João Silva",
  "email": "joao@email.com"
}

# Update
PATCH /api/contacts/{id}
{ "name": "João Silva Jr" }

# Delete
DELETE /api/contacts/{id}

# Stats
GET /api/contacts/stats
```

### Tags
```bash
# List
GET /api/tags?skip=0&take=10

# Create
POST /api/tags
{
  "name": "VIP",
  "color": "#FF0000"
}

# Associate with conversation
POST /api/tags/conversation
{ "tagId": "uuid", "conversationId": "uuid" }

# Remove from conversation
DELETE /api/tags/conversation
{ "tagId": "uuid", "conversationId": "uuid" }
```

### Users
```bash
# List
GET /api/users?skip=0&take=10&status=ACTIVE

# Get
GET /api/users/{id}

# Create
POST /api/users
{
  "email": "user@hotel.com",
  "password": "senha123",
  "name": "User",
  "role": "ATTENDANT"
}

# Update
PATCH /api/users/{id}
{ "name": "Updated", "role": "MANAGER" }

# Update status
PATCH /api/users/{id}/status
{ "status": "SUSPENDED" }

# Delete
DELETE /api/users/{id}
```

## N8N Endpoints (Automação WhatsApp)

### Messaging
```bash
# Text
POST /api/n8n/send-text
{
  "phone": "5511987654321",
  "message": "Olá!"
}

# Buttons (max 3)
POST /api/n8n/send-buttons
{
  "phone": "5511987654321",
  "message": "Escolha:",
  "buttons": [
    {"id": "btn1", "label": "Opção 1"},
    {"id": "btn2", "label": "Opção 2"}
  ]
}

# List
POST /api/n8n/send-list
{
  "phone": "5511987654321",
  "message": "Menu:",
  "sections": [{
    "title": "Opções",
    "rows": [
      {"id": "opt1", "title": "Opção 1"}
    ]
  }]
}

# Media (image, video, audio, document)
POST /api/n8n/send-media
{
  "phone": "5511987654321",
  "type": "image",
  "url": "https://...",
  "caption": "Foto"
}

# Template (pre-approved)
POST /api/n8n/send-template
{
  "phone": "5511987654321",
  "template": "notificacao_atendente",
  "language": "pt_BR",
  "parameters": ["param1", "param2"]
}

# Carousel (max 10 cards)
POST /api/n8n/send-carousel
{
  "phone": "5511987654321",
  "template": "carousel_quartos_geral",
  "cards": [{
    "imageUrl": "https://...",
    "buttonPayloads": ["detalhes_standard", "menu"]
  }]
}

# WhatsApp Flow (formulário)
POST /api/n8n/send-flow
{
  "phoneNumber": "5511987654321",
  "flowId": "uuid",
  "flowToken": "token",
  "ctaText": "Preencher",
  "headerText": "Orçamento"
}

# Booking Flow (simplificado)
POST /api/n8n/send-booking-flow
{
  "phone": "5511987654321",
  "conversationId": "uuid"
}
```

### HBook Integration
```bash
# Check room availability
GET /api/n8n/check-availability?unidade=Ilhabela&checkin=15/02/2026&checkout=20/02/2026&adults=2

# Check specific room
GET /api/n8n/check-room-availability?unidade=Ilhabela&roomName=Quarto%20Standard&checkin=15/02/2026&checkout=20/02/2026&adults=2
```

### Conversation Management
```bash
# Check if IA is locked
GET /api/n8n/check-ia-lock?phone=5511987654321

# Escalate to human
POST /api/n8n/escalate
{
  "phone": "5511987654321",
  "reason": "USER_REQUESTED",
  "reasonDetail": "Cliente quer falar com humano",
  "priority": "HIGH"
}

# Set hotel unit
POST /api/n8n/set-hotel-unit
{
  "phone": "5511987654321",
  "hotelUnit": "Ilhabela"
}

# Mark followup as sent
POST /api/n8n/mark-followup-sent
{
  "phone": "5511987654321",
  "flowType": "comercial"
}

# Mark as sales opportunity
POST /api/n8n/mark-opportunity
{
  "phone": "5511987654321",
  "reason": "needs_help",
  "flowType": "comercial"
}

# Mark message as read
POST /api/n8n/mark-read
{
  "messageId": "wamid.xxx"
}
```

## Reports & Analytics

```bash
# Overview metrics
GET /api/reports/overview?startDate=2026-02-01&endDate=2026-02-28

# Attendant performance
GET /api/reports/attendants?startDate=2026-02-01&endDate=2026-02-28

# Hourly message volume
GET /api/reports/hourly?startDate=2026-02-01&endDate=2026-02-28
```

## Escalations

```bash
# List
GET /api/escalations?skip=0&take=10&status=PENDING

# Create
POST /api/escalations
{
  "contactPhoneNumber": "5511987654321",
  "reason": "USER_REQUESTED",
  "priority": "HIGH"
}

# Get
GET /api/escalations/{id}

# Update
PATCH /api/escalations/{id}
{ "status": "ASSIGNED" }

# Stats
GET /api/escalations/stats

# Check IA lock
GET /api/escalations/check-ia-lock?phone=5511987654321
```

## Admin Resources

```bash
# Audit logs
GET /api/audit-logs?skip=0&take=10
GET /api/audit-logs/{id}

# Usage tracking
GET /api/usage-tracking?skip=0&take=10
GET /api/usage-tracking/current

# Webhook events
GET /api/webhook-events?skip=0&take=10
GET /api/webhook-events/{id}
POST /api/webhook-events/{id}/replay
DELETE /api/webhook-events/{id}
```

## Error Responses

```json
{
  "error": "Mensagem de erro",
  "message": "Detalhes adicionais",
  "statusCode": 400
}
```

### Common Status Codes
- **200** - OK
- **201** - Created
- **400** - Bad Request (validation error)
- **401** - Unauthorized (not authenticated)
- **403** - Forbidden (no permission)
- **404** - Not Found
- **429** - Rate Limit (too many requests)
- **500** - Server Error

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 | 15 min |
| `/api/n8n/*` | 5000 | 1 min |
| `/api/*` | 100 | 1 min |
| `/webhooks/*` | 1000 | 1 min |

## Common Parameters

### Pagination
```
skip: number (default: 0) - Records to skip
take: number (default: 10) - Records to return
```

### Filters
```
search: string - Search by name/email/phone
status: enum - Filter by status
hotelUnit: enum - Filter by hotel unit
```

### Date Filters
```
startDate: YYYY-MM-DD or DD/MM/YYYY
endDate: YYYY-MM-DD or DD/MM/YYYY
```

## Hotel Units (Enums)
- `Ilhabela`
- `Campos do Jordão`
- `Camburi`
- `Santo Antônio do Pinhal`

## User Roles
- `SUPER_ADMIN` - All tenants
- `TENANT_ADMIN` - Tenant admin
- `MANAGER` - View only
- `ATTENDANT` - Conversations
- `SALES` - Opportunities

## Conversation Status
- `BOT_HANDLING` - IA processing
- `OPEN` - Waiting for response
- `IN_PROGRESS` - Being handled
- `WAITING` - Waiting for customer
- `CLOSED` - Ended
- `ARCHIVED` - Archived

## Message Types
- `TEXT` - Plain text
- `IMAGE` - Image
- `VIDEO` - Video
- `AUDIO` - Audio
- `DOCUMENT` - PDF/DOC
- `TEMPLATE` - Pre-approved template
- `INTERACTIVE` - Buttons/lists
- `LOCATION` - Map location

## Examples

### Complete Flow: Login → Send Message → Close Conversation

```bash
# 1. Login
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@hotel.com",
    "password":"senha123",
    "tenantSlug":"hotel-ilhabela"
  }' | jq -r '.accessToken')

# 2. List conversations
curl -X GET 'http://localhost:3000/api/conversations?status=OPEN' \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0].id' > conv_id.txt

# 3. Send message
CONV_ID=$(cat conv_id.txt | tr -d '"')
curl -X POST http://localhost:3000/api/conversations/$CONV_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Obrigado! Até logo!","type":"TEXT"}'

# 4. Close conversation
curl -X POST http://localhost:3000/api/conversations/$CONV_ID/close \
  -H "Authorization: Bearer $TOKEN"
```

### N8N Flow: Check Availability → Send Results

```bash
# Check availability
ROOMS=$(curl -X GET 'http://localhost:3000/api/n8n/check-availability?unidade=Ilhabela&checkin=15/02/2026&checkout=20/02/2026&adults=2' \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Accept: application/json")

# Send to customer (in N8N flow)
curl -X POST http://localhost:3000/api/n8n/send-text \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"5511987654321\",
    \"message\": \"Encontrei quartos disponíveis! Veja mais detalhes.\"
  }"
```

## Swagger UI

Acesse a documentação interativa:
```
GET /api/docs
```

Baixe especificação OpenAPI:
```
GET /api/docs/swagger.json
```

## Troubleshooting

### 401 Unauthorized
- Token expirado? Use `/auth/refresh`
- Token inválido? Faça novo login

### 403 Forbidden
- Sua role não tem permissão
- Entre em contato com admin

### 429 Too Many Requests
- Aguarde antes de fazer nova requisição
- Verifique limits em SWAGGER_SETUP.md

### 404 Not Found
- ID não existe ou foi deletado
- Verifique o ID/slug fornecido

### 500 Server Error
- Erro interno do servidor
- Verifique logs: `docker logs crm-backend -f`
