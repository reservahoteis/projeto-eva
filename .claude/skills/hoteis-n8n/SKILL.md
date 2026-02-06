---
name: hoteis-n8n
description: Integracoes N8N, WhatsApp e automacoes para o CRM Hoteis
version: 1.0.0
author: Hoteis Reserva Team
---

# Skill: Integracao N8N - CRM Hoteis Reserva

Esta skill documenta todas as integracoes N8N e WhatsApp do CRM.

## Arquitetura

```
WhatsApp Cloud API (Meta)
         |
         v
    Webhook POST /webhooks/whatsapp
         |
         v
    Bull Queue (Redis)
         |
         v
    N8N (via endpoints /api/n8n/*)
         |
         v
    CRM Backend (respostas, escalacoes)
```

---

## Autenticacao N8N

**Header:** `X-API-Key: {tenantSlug}:{whatsappPhoneNumberId}`

**Exemplo:** `X-API-Key: hotelcopacabana:123456789012345`

---

## Endpoints Disponiveis

### Envio de Mensagens

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/n8n/send-text` | POST | Enviar texto simples |
| `/api/n8n/send-buttons` | POST | Enviar botoes (max 3) |
| `/api/n8n/send-list` | POST | Enviar lista (max 10 itens) |
| `/api/n8n/send-carousel` | POST | Enviar carousel de cards |
| `/api/n8n/send-template` | POST | Enviar template aprovado |
| `/api/n8n/send-media` | POST | Enviar imagem/video/audio/documento |

### Controle de Fluxo

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/n8n/check-ia-lock` | GET | Verificar se IA pode responder |
| `/api/n8n/escalate` | POST | Escalar para atendente humano |
| `/api/n8n/set-hotel-unit` | POST | Definir unidade hoteleira |

### Oportunidades (SALES)

| Endpoint | Metodo | Descricao |
|----------|--------|-----------|
| `/api/n8n/mark-followup-sent` | POST | Marcar follow-up enviado (cria oportunidade) |
| `/api/n8n/mark-opportunity` | POST | Atualizar motivo da oportunidade |

---

## Payloads de Exemplo

### Send Text
```json
{
  "phone": "5511999999999",
  "message": "Ola! Bem-vindo ao Hotel Reserva."
}
```

### Send Buttons
```json
{
  "phone": "5511999999999",
  "message": "Escolha uma opcao:",
  "buttons": [
    { "id": "reservar", "label": "Fazer Reserva" },
    { "id": "duvidas", "label": "Tirar Duvidas" },
    { "id": "falar_humano", "label": "Falar com Atendente" }
  ]
}
```

### Send Carousel (Template)
```json
{
  "phone": "5511999999999",
  "template": "carousel_quartos_geral",
  "cards": [
    {
      "imageUrl": "https://exemplo.com/quarto-standard.jpg",
      "buttonPayloads": ["detalhes_standard", "menu"]
    }
  ]
}
```

### Escalate
```json
{
  "phone": "5511999999999",
  "reason": "USER_REQUESTED",
  "reasonDetail": "Cliente pediu atendente",
  "hotelUnit": "Campos do Jordao",
  "priority": "HIGH"
}
```

### Check IA Lock
```
GET /api/n8n/check-ia-lock?phone=5511999999999

Response:
{
  "locked": true,
  "conversationId": "uuid"
}
```

### Mark Followup Sent
```json
{
  "phone": "5511999999999",
  "flowType": "comercial"
}
```

**IMPORTANTE:** Este endpoint agora:
- Marca `isOpportunity = true`
- Muda status para `OPEN`
- Trava IA (`iaLocked = true`)
- Emite evento Socket.io para SALES

---

## IA Lock - Regra Critica

Quando atendente assume ou N8N escala:
1. `iaLocked = true` na conversa
2. N8N **SEMPRE** checa `GET /api/n8n/check-ia-lock` ANTES de responder
3. Se locked, N8N **NAO** envia mensagem

---

## Rate Limits

| Endpoint | Limite |
|----------|--------|
| `/api/n8n/*` | 5000 req/min |
| `/webhooks/*` | 1000 req/min |

---

## Fluxo de Oportunidades (SALES)

```
1. Bot encerra atendimento
         |
         v
2. N8N agenda follow-up (5 min)
         |
         v
3. N8N envia follow-up
         |
         v
4. N8N chama /mark-followup-sent
         |
         v
5. Conversa aparece para SALES (isOpportunity=true)
         |
         v
6. Se cliente responde negativamente:
   N8N chama /mark-opportunity (atualiza motivo)
```

---

## Quando Usar

Use `/hoteis-n8n` quando precisar:
- Criar novo endpoint de integracao N8N
- Debugar fluxo de mensagens
- Entender como funciona IA Lock
- Configurar fluxo de oportunidades
- Adicionar novo tipo de mensagem
