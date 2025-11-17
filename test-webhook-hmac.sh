#!/bin/bash

# Configurações
APP_SECRET="286cb2bd03d39b0a1b572aa4d84e6dbb"
WEBHOOK_URL="https://api.botreserva.com.br/webhooks/whatsapp"
TIMESTAMP=$(date +%s)

# Payload de teste simulando mensagem recebida
PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "1377104410568104",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "5511996750075",
          "phone_number_id": "782115004996178"
        },
        "contacts": [{
          "profile": {
            "name": "Teste DevOps"
          },
          "wa_id": "5511999999999"
        }],
        "messages": [{
          "from": "5511999999999",
          "id": "wamid.HBgNNTUxMTk5OTk5OTk5OQ",
          "timestamp": "'$TIMESTAMP'",
          "text": {
            "body": "Teste de integração DevOps - 17/11/2025"
          },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
}'

# Calcular HMAC SHA256
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$APP_SECRET" -binary | xxd -p)

echo "======================================"
echo "TESTE DE WEBHOOK COM HMAC VÁLIDO"
echo "======================================"
echo "Timestamp: $TIMESTAMP"
echo "Signature: sha256=$SIGNATURE"
echo ""
echo "Enviando webhook de teste..."
echo ""

# Enviar requisição
curl -k -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v 2>&1 | grep -E "< HTTP|< X-|HTTP Status"

echo ""
echo "======================================"
echo "Teste concluído!"