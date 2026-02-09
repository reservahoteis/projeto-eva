# Documentation Index - CRM Hoteis Reserva API

## Getting Started

### Quick Links
1. **[README_SWAGGER.md](README_SWAGGER.md)** - Start here! Overview of the implementation
2. **[API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)** - Cheat sheet with all endpoints
3. **[SWAGGER_SETUP.md](SWAGGER_SETUP.md)** - Complete setup and authentication guide

### Interactive Documentation
- **Swagger UI**: `http://localhost:3000/api/docs`
- **OpenAPI Spec**: `http://localhost:3000/api/docs/swagger.json`

## Documentation Files

### 📖 Main Guides

| File | Size | Purpose |
|------|------|---------|
| [README_SWAGGER.md](README_SWAGGER.md) | 10 KB | **START HERE** - Overview & quick start |
| [SWAGGER_SETUP.md](SWAGGER_SETUP.md) | 14 KB | Complete setup guide with all details |
| [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) | 12 KB | Quick lookup reference |

### 🛠️ Tools & Examples

| File | Purpose |
|------|---------|
| [CRM-Hoteis-API.postman_collection.json](CRM-Hoteis-API.postman_collection.json) | Postman collection (import this!) |
| [CURL_EXAMPLES.sh](CURL_EXAMPLES.sh) | Complete bash script with cURL examples |

## Endpoint Groups (70+ Endpoints)

### 🔐 Authentication (6 endpoints)
- Login, register, refresh token, logout, change password, get current user
- **Guide**: [SWAGGER_SETUP.md](SWAGGER_SETUP.md)

### 👥 Users (6 endpoints)
- CRUD operations for team members
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 💬 Conversations (8+ endpoints)
- Chat management, assign, close, archive
- IA lock control for human takeover
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 📝 Messages (3+ endpoints)
- Send text, media, templates
- Search and stats
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 📞 Contacts (6+ endpoints)
- Contact management
- Phone number lookup
- Stats
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 🏷️ Tags (5+ endpoints)
- Tag creation and management
- Associate with conversations
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 📊 Reports (3 endpoints)
- Overview metrics
- Attendant performance
- Hourly volume
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 🔼 Escalations (5+ endpoints)
- Escalate conversations to humans
- Check IA lock status
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 🤖 N8N Automation (20+ endpoints)
- Send text, buttons, lists, media, templates, flows
- Check hotel availability (HBook)
- Manage hotel units and followups
- **Guide**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)

### 📋 Audit Logs (2 endpoints)
- View audit trail

### 📈 Usage Tracking (2 endpoints)
- View usage metrics

### 🪝 Webhook Events (4 endpoints)
- Manage webhook events
- Replay failed webhooks

## How to Use This Documentation

### For First-Time Users
1. Read [README_SWAGGER.md](README_SWAGGER.md) - 5 min overview
2. Access Swagger UI at `http://localhost:3000/api/docs`
3. Try a test endpoint in Swagger UI
4. Import [CRM-Hoteis-API.postman_collection.json](CRM-Hoteis-API.postman_collection.json) into Postman

### For API Testing
1. **Interactive**: Use Swagger UI at `http://localhost:3000/api/docs`
2. **Postman**: Import the collection file
3. **cURL**: Run the bash script: `bash CURL_EXAMPLES.sh`

### For Development
1. Read [SWAGGER_SETUP.md](SWAGGER_SETUP.md) for complete details
2. Keep [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) handy
3. Use Swagger UI for endpoint exploration
4. Refer to schemas for request/response structure

### For Integration
1. Download OpenAPI spec: `GET /api/docs/swagger.json`
2. Generate SDK: Use OpenAPI CodeGen
3. Use spec in Postman/Insomnia
4. Document your endpoints similarly

## Common Workflows

### Login and Test an Endpoint
```bash
# 1. Get token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hotel.com",
    "password": "senha123",
    "tenantSlug": "hotel-ilhabela"
  }'

# 2. Use token
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Send WhatsApp Message via N8N
```bash
curl -X POST http://localhost:3000/api/n8n/send-text \
  -H "X-API-Key: hotel-ilhabela:5511987654321000" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "message": "Hello from N8N!"
  }'
```

### Check Room Availability
```bash
curl -X GET 'http://localhost:3000/api/n8n/check-availability?unidade=Ilhabela&checkin=15/02/2026&checkout=20/02/2026&adults=2' \
  -H "X-API-Key: hotel-ilhabela:5511987654321000"
```

## API Features

✓ **70+ endpoints** documented with OpenAPI 3.0
✓ **Interactive Swagger UI** for testing
✓ **JWT authentication** with token refresh
✓ **N8N API Key** authentication for automation
✓ **Multi-tenant** isolation with tenantId
✓ **Rate limiting** documented
✓ **Error handling** with status codes
✓ **Postman collection** ready to import
✓ **cURL examples** for all endpoints
✓ **Ready for SDK generation**

## File Structure

```
docs/
├── INDEX.md (this file)
├── README_SWAGGER.md (START HERE)
├── SWAGGER_SETUP.md
├── API_QUICK_REFERENCE.md
├── CRM-Hoteis-API.postman_collection.json
└── CURL_EXAMPLES.sh

deploy-backend/src/
├── config/
│   ├── swagger.ts
│   └── swagger-endpoints.ts
└── server.ts (updated)
```

## External Tools

### Access Points
- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI Spec**: http://localhost:3000/api/docs/swagger.json
- **Health Check**: http://localhost:3000/health

### Import Locations
- **Postman**: File > Import > [CRM-Hoteis-API.postman_collection.json](CRM-Hoteis-API.postman_collection.json)
- **Insomnia**: Create > Import > OpenAPI 3.0 > http://localhost:3000/api/docs/swagger.json
- **Redoc**: Run locally with: `redoc-cli serve http://localhost:3000/api/docs/swagger.json`

## Support & Troubleshooting

### API Not Responding?
- Check if server is running: `http://localhost:3000/health`
- Review [SWAGGER_SETUP.md](SWAGGER_SETUP.md)

### Authentication Issues?
- Read [SWAGGER_SETUP.md](SWAGGER_SETUP.md)
- Check token in Swagger "Authorize" button

### N8N Integration Help?
- See [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)
- Review examples in [CURL_EXAMPLES.sh](CURL_EXAMPLES.sh)

## Quick Links

| Need | See |
|------|-----|
| Overview | [README_SWAGGER.md](README_SWAGGER.md) |
| All endpoints | [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) |
| Complete setup | [SWAGGER_SETUP.md](SWAGGER_SETUP.md) |
| Test instantly | Swagger UI: http://localhost:3000/api/docs |
| Postman import | [CRM-Hoteis-API.postman_collection.json](CRM-Hoteis-API.postman_collection.json) |
| cURL examples | [CURL_EXAMPLES.sh](CURL_EXAMPLES.sh) |

---

**Last Updated**: 2026-02-09
**API Version**: 1.0.0
**OpenAPI Version**: 3.0.3
