#!/bin/bash

# Script de Teste - WhatsApp Número de Teste da Meta
# Data: 17/11/2025
# Número: +1 555 639 8497

set -e

echo "=========================================="
echo "🧪 TESTE WHATSAPP - NÚMERO DE TESTE META"
echo "=========================================="
echo ""

# Configurações
TENANT_SLUG="hoteis-reserva"
API_URL="https://api.botreserva.com.br"
PHONE_NUMBER_ID="796628440207853"
ACCESS_TOKEN="EAAhLVq96CJ8BP38MrFZCNyrHhSjOTuZC3RmVtOr9jZC4FtA879NJHWLoqnTcpXHmycTSLyZCzUzZAatLBnblKOqQoaOZBhnPpdbe5JO0ST1TZANxr5mcqZCE2odZBZCEGN7CKXhiUjZC0k2xysMES0y1ilLQTgpAb8P1txjAddL53SQIPIfrm0IAXumEGZBaIwpWCUH8ZCApD5y8UWNTIZBvBNLkLZBnvdt10rXWC3BUuznfUXV8eOiYcRPGfRgF5ctnobRngZDZD"
TEST_NUMBER="+15556398497"  # Número de teste da Meta

echo "📋 Configuração:"
echo "  - Tenant: $TENANT_SLUG"
echo "  - Phone Number ID: $PHONE_NUMBER_ID"
echo "  - Test Number: $TEST_NUMBER"
echo ""

# 1. Testar Health Check
echo "1️⃣ Testando Health Check..."
curl -s "$API_URL/health" | jq '.'
echo ""

# 2. Testar Webhook Verification
echo "2️⃣ Testando Webhook Verification..."
CHALLENGE="test_challenge_123"
VERIFY_TOKEN="webhook_verify_token_secure_2024"

curl -s -X GET "$API_URL/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=$CHALLENGE" \
  -H "X-Tenant-Slug: $TENANT_SLUG"
echo ""
echo ""

# 3. Enviar mensagem de teste via WhatsApp API
echo "3️⃣ Enviando mensagem de teste via WhatsApp API..."
RESPONSE=$(curl -s -X POST "https://graph.facebook.com/v21.0/$PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "'"$TEST_NUMBER"'",
    "type": "text",
    "text": {
      "body": "🧪 Teste de mensagem do CRM Hoteis Reserva - Número de Teste Meta"
    }
  }')

echo "$RESPONSE" | jq '.'
MESSAGE_ID=$(echo "$RESPONSE" | jq -r '.messages[0].id // empty')

if [ ! -z "$MESSAGE_ID" ]; then
  echo "✅ Mensagem enviada com sucesso! ID: $MESSAGE_ID"
else
  echo "❌ Erro ao enviar mensagem"
  echo "$RESPONSE"
fi
echo ""

# 4. Instruções para receber mensagem
echo "=========================================="
echo "📱 PRÓXIMO PASSO - RECEBER MENSAGEM"
echo "=========================================="
echo ""
echo "Para testar o recebimento:"
echo ""
echo "1. Acesse: https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business/wa-dev-console/"
echo ""
echo "2. Na seção 'Send and receive messages', você vai ver o número de teste"
echo ""
echo "3. Use o botão 'Send message' para enviar uma mensagem de teste"
echo ""
echo "4. A mensagem vai chegar no webhook:"
echo "   URL: $API_URL/webhooks/whatsapp"
echo "   Header: X-Tenant-Slug: $TENANT_SLUG"
echo ""
echo "5. Verifique no frontend se a mensagem apareceu no Kanban:"
echo "   https://www.botreserva.com.br"
echo ""
echo "=========================================="
echo "🔍 MONITORAR LOGS"
echo "=========================================="
echo ""
echo "Para ver os logs em tempo real:"
echo "ssh root@72.61.39.235 \"docker logs -f crm-backend | grep -i webhook\""
echo ""
