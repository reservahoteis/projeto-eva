# 🧪 Guia Completo de Teste - Envio e Recebimento de Mensagens WhatsApp

**Data:** 16/11/2025
**Versão:** 1.0.0
**Status:** ✅ Pronto para uso

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Tenant Configurado](#tenant-configurado)
3. [Como Enviar Mensagens](#como-enviar-mensagens)
4. [Como Receber Mensagens](#como-receber-mensagens)
5. [Verificar Mensagens no Painel](#verificar-mensagens-no-painel)
6. [Tipos de Mensagens Suportadas](#tipos-de-mensagens-suportadas)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Pré-requisitos

### Credenciais

**Super Admin:**
- Email: `admin@botreserva.com.br`
- Senha: `SUA_SENHA_SUPER_ADMIN`
- Tenant Slug: `super-admin`

> **IMPORTANTE:** Substitua os placeholders pelas credenciais reais obtidas do ambiente de producao.

**Tenant Admin (Hotel Ipanema):**
- Email: `contato@hotelipanema.com.br`
- Senha: (gerada automaticamente - verificar no banco)
- Tenant Slug: `hotel-ipanema`

### URLs

- **Backend API:** https://api.botreserva.com.br
- **Frontend:** https://www.botreserva.com.br
- **Webhook:** https://api.botreserva.com.br/api/webhooks

---

## 🏨 Tenant Configurado

### Hotel Ipanema

**Informações:**
- **ID:** `3ad64831-b32a-42b6-a58d-5a90277571b1`
- **Slug:** `hotel-ipanema`
- **Nome:** Hotel Ipanema
- **WhatsApp Phone Number ID:** `796628440207853`
- **Status:** ✅ Configurado

**Verificar credenciais do tenant:**
```bash
ssh root@72.61.39.235
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas \
  -c "SELECT email, role FROM users WHERE \"tenantId\" = '3ad64831-b32a-42b6-a58d-5a90277571b1';"
```

---

## 📤 Como Enviar Mensagens

### 1. Obter Token JWT

Primeiro, faça login para obter o token de acesso:

```bash
curl -X POST "https://api.botreserva.com.br/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{
    "email": "contato@hotelipanema.com.br",
    "password": "SUA_SENHA_AQUI"
  }'
```

**Resposta esperada:**
```json
{
  "user": {
    "id": "...",
    "email": "contato@hotelipanema.com.br",
    "name": "Hotel Ipanema",
    "role": "TENANT_ADMIN",
    "tenantId": "3ad64831-b32a-42b6-a58d-5a90277571b1"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**Salve o `accessToken`** para usar nos próximos passos.

---

### 2. Criar um Contato (Se não existir)

```bash
curl -X POST "https://api.botreserva.com.br/api/contacts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{
    "phoneNumber": "5511999999999",
    "name": "João Silva",
    "email": "joao@example.com"
  }'
```

---

### 3. Criar uma Conversa

```bash
curl -X POST "https://api.botreserva.com.br/api/conversations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{
    "contactId": "ID_DO_CONTATO_CRIADO"
  }'
```

---

### 4. Enviar Mensagem de Texto

```bash
curl -X POST "https://api.botreserva.com.br/api/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{
    "conversationId": "ID_DA_CONVERSA_CRIADA",
    "type": "TEXT",
    "content": "Olá! Esta é uma mensagem de teste do Hotel Ipanema.",
    "to": "5511999999999"
  }'
```

**Resposta esperada:**
```json
{
  "id": "msg-123",
  "conversationId": "conv-456",
  "tenantId": "3ad64831-b32a-42b6-a58d-5a90277571b1",
  "type": "TEXT",
  "content": "Olá! Esta é uma mensagem de teste do Hotel Ipanema.",
  "direction": "OUTBOUND",
  "status": "SENT",
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

---

### 5. Enviar Template Message

**Importante:** Templates precisam estar aprovados pelo Meta primeiro!

```bash
curl -X POST "https://api.botreserva.com.br/api/messages/template" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{
    "conversationId": "ID_DA_CONVERSA",
    "to": "5511999999999",
    "templateName": "hello_world",
    "languageCode": "pt_BR",
    "parameters": []
  }'
```

---

### 6. Enviar Mensagem com Botões

```bash
curl -X POST "https://api.botreserva.com.br/api/messages/buttons" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{
    "conversationId": "ID_DA_CONVERSA",
    "to": "5511999999999",
    "bodyText": "Como podemos ajudar?",
    "buttons": [
      {
        "id": "btn1",
        "title": "Fazer Reserva"
      },
      {
        "id": "btn2",
        "title": "Ver Preços"
      },
      {
        "id": "btn3",
        "title": "Falar com Atendente"
      }
    ]
  }'
```

---

### 7. Enviar Mensagem com Lista

```bash
curl -X POST "https://api.botreserva.com.br/api/messages/list" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -d '{
    "conversationId": "ID_DA_CONVERSA",
    "to": "5511999999999",
    "bodyText": "Escolha uma opção:",
    "buttonText": "Ver Opções",
    "sections": [
      {
        "title": "Serviços",
        "rows": [
          {
            "id": "opt1",
            "title": "Check-in Online",
            "description": "Faça check-in pelo WhatsApp"
          },
          {
            "id": "opt2",
            "title": "Solicitar Toalhas",
            "description": "Peça toalhas extras"
          }
        ]
      }
    ]
  }'
```

---

## 📥 Como Receber Mensagens

### Fluxo de Recebimento

```
┌─────────────────────────────────────────┐
│   Cliente envia mensagem no WhatsApp   │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│      Meta WhatsApp Cloud API            │
│   (detecta nova mensagem)               │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│   POST https://api.botreserva.com.br    │
│          /api/webhooks                  │
│   (webhook configurado no Meta)         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│   WebhookController valida HMAC         │
│   e enfileira para processamento        │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│   Worker processa mensagem:             │
│   - Cria/busca contato                  │
│   - Cria/busca conversa                 │
│   - Salva mensagem no banco             │
│   - Emite evento WebSocket              │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│   Mensagem aparece no painel frontend   │
│   em tempo real (via WebSocket)         │
└─────────────────────────────────────────┘
```

### Webhook Configurado

**URL do Webhook:** `https://api.botreserva.com.br/api/webhooks`

**Verificar configuração no Meta:**
1. Acesse https://developers.facebook.com
2. Vá para seu app WhatsApp
3. Configurações → Webhooks
4. Verifique se a URL está ativa

### Verificar Logs de Webhook

```bash
# Ver logs do backend em tempo real
ssh root@72.61.39.235
docker logs crm-backend -f --tail 100

# Filtrar apenas mensagens recebidas
docker logs crm-backend -f | grep "Incoming message"
```

---

## 👀 Verificar Mensagens no Painel

### Via Frontend (Recomendado)

1. **Acesse:** https://www.botreserva.com.br/login

2. **Login com credenciais do Hotel Ipanema:**
   - Email: `contato@hotelipanema.com.br`
   - Senha: (sua senha)

3. **Navegue para:**
   - **Dashboard** → Ver Kanban com conversas
   - **Conversas** → Lista completa de conversas
   - **Clique em uma conversa** → Ver todas as mensagens

4. **O que você verá:**
   - 🟢 **Mensagens enviadas** (OUTBOUND) - alinhadas à direita
   - 🔵 **Mensagens recebidas** (INBOUND) - alinhadas à esquerda
   - ⏰ **Timestamp** de cada mensagem
   - ✅ **Status** (SENT, DELIVERED, READ)

### Via API (Para debugging)

```bash
# Listar todas as conversas
curl -X GET "https://api.botreserva.com.br/api/conversations" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema"

# Listar mensagens de uma conversa
curl -X GET "https://api.botreserva.com.br/api/conversations/CONVERSATION_ID/messages" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "X-Tenant-Slug: hotel-ipanema"
```

### Via Banco de Dados (Debug direto)

```bash
ssh root@72.61.39.235
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas

# Listar últimas mensagens
SELECT
  m.id,
  m.content,
  m.direction,
  m.type,
  m.status,
  m."timestamp",
  c.name as contact_name
FROM messages m
JOIN conversations conv ON m."conversationId" = conv.id
JOIN contacts c ON conv."contactId" = c.id
WHERE conv."tenantId" = '3ad64831-b32a-42b6-a58d-5a90277571b1'
ORDER BY m."timestamp" DESC
LIMIT 10;
```

---

## 📊 Tipos de Mensagens Suportadas

| Tipo | Endpoint | Status | Janela 24h |
|------|----------|--------|------------|
| **Texto** | `POST /api/messages` | ✅ | Não |
| **Imagem** | `POST /api/messages` (type: IMAGE) | ✅ | Não |
| **Áudio** | `POST /api/messages` (type: AUDIO) | ✅ | Não |
| **Vídeo** | `POST /api/messages` (type: VIDEO) | ✅ | Não |
| **Documento** | `POST /api/messages` (type: DOCUMENT) | ✅ | Não |
| **Template** | `POST /api/messages/template` | ✅ | Sim (necessário) |
| **Botões** | `POST /api/messages/buttons` | ✅ | Não |
| **Lista** | `POST /api/messages/list` | ✅ | Não |

**Janela 24h:** Templates são a única forma de iniciar conversa após 24h da última mensagem do cliente.

---

## 🐛 Troubleshooting

### Mensagem não enviada

**1. Verificar status no banco:**
```sql
SELECT id, status, "errorCode", "errorMessage"
FROM messages
WHERE id = 'SEU_MESSAGE_ID';
```

**2. Verificar logs do worker:**
```bash
docker logs crm-backend | grep "process-outgoing-message"
```

**3. Erros comuns:**
- `Recipient phone number not on WhatsApp` - Número não tem WhatsApp
- `Template not found` - Template não existe ou não aprovado
- `Message undeliverable` - Número bloqueou o business
- `Rate limit exceeded` - Muitas mensagens em pouco tempo (>80/s)

### Mensagem não recebida no painel

**1. Webhook funcionando?**
```bash
# Ver últimos webhooks recebidos
docker logs crm-backend | grep "Webhook received"
```

**2. Worker processando?**
```bash
docker logs crm-backend | grep "process-incoming-message"
```

**3. WebSocket conectado?**
- Abra DevTools do navegador
- Aba Network → WS
- Deve haver conexão ativa com `wss://api.botreserva.com.br`

---

## 🎯 Fluxo de Teste Completo

### Teste End-to-End

**1. Enviar mensagem do painel:**
- Login no frontend
- Criar/abrir conversa
- Digitar mensagem
- Clicar "Enviar"
- ✅ Mensagem deve aparecer na conversa

**2. Responder pelo WhatsApp:**
- Abrir WhatsApp no celular
- Responder a mensagem recebida
- ✅ Resposta deve aparecer no painel em tempo real

**3. Verificar histórico:**
- ✅ Todas as mensagens devem estar salvas
- ✅ Status correto (SENT, DELIVERED, READ)
- ✅ Timestamps corretos

---

## 📞 Suporte

**Problemas?**
- Verificar logs: `docker logs crm-backend -f`
- Documentação: [API-ENDPOINTS.md](./API-ENDPOINTS.md)
- Troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

**Data de criação:** 16/11/2025
**Última atualização:** 16/11/2025
**Responsável:** Claude Code + Fred Castro
