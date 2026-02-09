# Swagger/OpenAPI Documentation - CRM Hoteis Reserva

## Summary

A documentação completa da API foi configurada em OpenAPI 3.0 com interface Swagger UI interativa. Todos os endpoints estão documentados com schemas, exemplos e validações.

## What's New

### Files Added

1. **Backend Configuration**
   - `/deploy-backend/src/config/swagger.ts` - Configuração principal do OpenAPI 3.0
   - `/deploy-backend/src/config/swagger-endpoints.ts` - Definição de todos os endpoints
   - Updated: `/deploy-backend/src/server.ts` - Registro do Swagger UI

2. **Dependencies Installed**
   - `swagger-jsdoc` - Gerador OpenAPI a partir de código
   - `swagger-ui-express` - Interface Swagger interativa
   - `@types/swagger-jsdoc` - Tipagem TypeScript
   - `@types/swagger-ui-express` - Tipagem TypeScript

3. **Documentation Files**
   - `/docs/SWAGGER_SETUP.md` - Guia completo de setup e uso
   - `/docs/API_QUICK_REFERENCE.md` - Referência rápida com exemplos
   - `/docs/CRM-Hoteis-API.postman_collection.json` - Coleção Postman pronta

## Quick Start

### 1. Access Swagger UI
```bash
# Development
http://localhost:3000/api/docs

# Production
https://api.botreserva.com.br/api/docs
```

### 2. Download OpenAPI Spec
```bash
# JSON format
http://localhost:3000/api/docs/swagger.json
```

### 3. Import in Postman/Insomnia
- Postman: `Import > Link > http://localhost:3000/api/docs/swagger.json`
- Insomnia: `Create > Request Collection > Import OpenAPI 3.0`

## API Overview

### 13 Main Resource Groups
- **Auth** (6 endpoints) - Login, refresh, logout, password change
- **Users** (6 endpoints) - CRUD de usuários do tenant
- **Conversations** (8 endpoints) - CRUD + assign/close/archive
- **Messages** (3 endpoints) - Send, list, search
- **Contacts** (6 endpoints) - CRUD + phone lookup + stats
- **Tags** (5 endpoints) - CRUD + conversation association
- **Reports** (3 endpoints) - Overview, attendants, hourly volume
- **Escalations** (5 endpoints) - CRUD + IA lock check + stats
- **N8N** (20+ endpoints) - Integração automação WhatsApp
- **AuditLogs** (2 endpoints) - Audit trail
- **UsageTracking** (2 endpoints) - Métricas de uso
- **WebhookEvents** (4 endpoints) - Gerenciamento de webhooks

**Total: 70+ endpoints documentados**

## Authentication Methods

### 1. JWT Bearer Token
```bash
# Login
POST /auth/login
{
  "email": "admin@hotel.com",
  "password": "senha123",
  "tenantSlug": "hotel-ilhabela"
}

# Use in requests
Authorization: Bearer eyJ...
```

### 2. N8N API Key
```bash
# Format: tenantSlug:whatsappPhoneNumberId
X-API-Key: hotel-ilhabela:5511987654321000
```

## Key Features

### Complete Documentation
- All endpoints documented with OpenAPI 3.0
- Request/response schemas with examples
- Parameter validation with Zod
- Error codes and status descriptions
- Rate limit information

### Interactive Testing
- Try endpoints directly in Swagger UI
- Test with real data
- See response examples
- Authorize with tokens

### SDK Generation Ready
- OpenAPI spec compatible with CodeGen
- Generate SDKs for any language:
  - JavaScript/TypeScript
  - Python
  - Java
  - Go
  - Ruby
  - PHP
  - etc.

### Security Documented
- Bearer token authentication
- API Key authentication (N8N)
- Permission levels (RBAC)
- Multi-tenant isolation

## Core Concepts

### Multi-Tenant Architecture
- Each request isolated by `tenantId`
- All queries include tenant filtering
- No cross-tenant data leakage

### Conversation Lifecycle
1. **BOT_HANDLING** - IA processing
2. **OPEN** - Waiting for human response
3. **IN_PROGRESS** - Being handled
4. **WAITING** - Waiting for customer
5. **CLOSED** - Conversation ended
6. **ARCHIVED** - Archived

### N8N Automation
- 20+ endpoints for WhatsApp messaging
- Text, buttons, lists, media, templates, carousels, flows
- HBook integration for availability checking
- IA lock management for human takeover
- Followup tracking and sales opportunities

## Example Usage

### Complete Chat Flow
```bash
# 1. Authenticate
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hotel.com",
    "password": "senha123",
    "tenantSlug": "hotel-ilhabela"
  }'

# 2. List open conversations
curl -X GET 'http://localhost:3000/api/conversations?status=OPEN' \
  -H "Authorization: Bearer TOKEN"

# 3. Send message
curl -X POST http://localhost:3000/api/conversations/{id}/messages \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Olá!", "type": "TEXT"}'

# 4. Close conversation
curl -X POST http://localhost:3000/api/conversations/{id}/close \
  -H "Authorization: Bearer TOKEN"
```

### N8N Automation
```bash
# Check room availability
curl -X GET 'http://localhost:3000/api/n8n/check-availability?unidade=Ilhabela&checkin=15/02/2026&checkout=20/02/2026&adults=2' \
  -H "X-API-Key: hotel-ilhabela:5511987654321000"

# Send promotional buttons
curl -X POST http://localhost:3000/api/n8n/send-buttons \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "message": "Escolha sua suite:",
    "buttons": [
      {"id": "luxo", "label": "Luxo"},
      {"id": "master", "label": "Master"},
      {"id": "standard", "label": "Standard"}
    ]
  }'

# Escalate to human
curl -X POST http://localhost:3000/api/n8n/escalate \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "reason": "USER_REQUESTED",
    "priority": "HIGH"
  }'
```

## Data Models

### User
- id, tenantId, email, name, role, status
- Roles: SUPER_ADMIN, TENANT_ADMIN, MANAGER, ATTENDANT, SALES

### Conversation
- id, tenantId, contactId, status, assignedToId
- hotelUnit, isOpportunity, iaLocked, lastMessageAt

### Message
- id, conversationId, tenantId, type, content, direction
- whatsappMessageId, isRead, sentAt

### Contact
- id, tenantId, phoneNumber, name, email, profilePictureUrl

### Tag
- id, tenantId, name, color
- Associations with conversations

### Escalation
- id, tenantId, conversationId, reason, status, priority

## Response Format

### Success (200, 201)
```json
{
  "data": { ... } OR [ ... ],
  "pagination": {
    "total": 42,
    "count": 10,
    "skip": 0,
    "hasMore": true
  }
}
```

### Error (400, 401, 403, 404, 500)
```json
{
  "error": "Mensagem de erro",
  "message": "Detalhes adicionais",
  "statusCode": 400
}
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 | 15 min |
| `/api/n8n/*` | 5000 | 1 min |
| `/api/*` | 100 | 1 min |
| `/webhooks/*` | 1000 | 1 min |

## Best Practices

### 1. Authentication
- Store tokens securely (not in localStorage)
- Refresh before expiration
- Logout when done

### 2. Error Handling
- Check HTTP status code
- Parse error message for user feedback
- Implement retry logic for 429/500

### 3. Performance
- Use pagination (skip/take)
- Filter by status/date to reduce data
- Cache results when possible

### 4. Security
- Never expose API keys in frontend
- Validate all inputs server-side
- Use HTTPS in production

## Files Reference

| File | Purpose |
|------|---------|
| `swagger.ts` | OpenAPI 3.0 spec definition |
| `swagger-endpoints.ts` | All endpoint descriptions |
| `server.ts` | Swagger UI registration |
| `SWAGGER_SETUP.md` | Complete setup guide |
| `API_QUICK_REFERENCE.md` | Quick reference with examples |
| `postman_collection.json` | Postman import file |

## Troubleshooting

### Swagger UI not loading
- Check if server is running: `http://localhost:3000/health`
- Verify URL: `http://localhost:3000/api/docs`

### 401 Unauthorized
- Login first to get token
- Use correct token in Authorization header

### 429 Rate Limited
- Wait before retrying
- Check rate limits in SWAGGER_SETUP.md

### Spec download fails
- Verify endpoint: `GET /api/docs/swagger.json`
- Check Content-Type header: `application/json`

## Next Steps

1. **Test Endpoints** - Use Swagger UI or Postman
2. **Generate SDKs** - Use OpenAPI CodeGen for client libraries
3. **Document Flows** - Create runbooks for N8N automation
4. **Monitor API** - Set up logging and analytics
5. **Version API** - Plan for v2 when needed

## Support

For issues with documentation:
1. Check SWAGGER_SETUP.md
2. Review API_QUICK_REFERENCE.md
3. Test in Swagger UI
4. Check server logs

For API changes:
1. Update swagger-endpoints.ts
2. Regenerate spec (automatic)
3. Test in Swagger UI
4. Deploy to production
