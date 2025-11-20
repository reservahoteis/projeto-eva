#!/bin/bash

# Script de teste para validar correção de mensagens em tempo real
# Uso: ./test-realtime-fix.sh <JWT_TOKEN> <CONVERSATION_ID>

echo "========================================"
echo "TESTE: Mensagens em Tempo Real"
echo "========================================"
echo ""

# Variáveis
JWT_TOKEN="$1"
CONVERSATION_ID="$2"
BACKEND_URL="${BACKEND_URL:-http://localhost:3333}"

# Validar parâmetros
if [ -z "$JWT_TOKEN" ] || [ -z "$CONVERSATION_ID" ]; then
  echo "❌ ERRO: Parâmetros obrigatórios faltando"
  echo ""
  echo "Uso:"
  echo "  ./test-realtime-fix.sh <JWT_TOKEN> <CONVERSATION_ID>"
  echo ""
  echo "Exemplo:"
  echo "  ./test-realtime-fix.sh eyJhbGc... abc-123-def-456"
  echo ""
  exit 1
fi

echo "Configuração:"
echo "  Backend URL: $BACKEND_URL"
echo "  Conversation ID: $CONVERSATION_ID"
echo "  Token: ${JWT_TOKEN:0:20}..."
echo ""

# Teste 1: Enviar mensagem de texto
echo "📤 Teste 1: Enviando mensagem de texto..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/conversations/$CONVERSATION_ID/messages" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Teste tempo real - '$(date +%H:%M:%S)'",
    "type": "TEXT"
  }')

# Separar body e status code
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_STATUS=$(echo "$RESPONSE" | tail -n 1)

echo "Status HTTP: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "201" ]; then
  echo "✅ Mensagem enviada com sucesso!"
  echo ""
  echo "Resposta:"
  echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
  echo ""

  # Extrair messageId
  MESSAGE_ID=$(echo "$HTTP_BODY" | jq -r '.id' 2>/dev/null)

  echo "========================================"
  echo "VALIDAÇÃO MANUAL NECESSÁRIA:"
  echo "========================================"
  echo ""
  echo "1. Abra o frontend em: http://localhost:3000"
  echo "2. Navegue para a conversa: $CONVERSATION_ID"
  echo "3. Abra o console do navegador (F12)"
  echo ""
  echo "Logs esperados no console:"
  echo "  ✅ 📩 NEW MESSAGE RECEIVED { hasMessage: true, hasConversation: true }"
  echo "  ✅ ✅ MESSAGE IS FOR THIS CONVERSATION - UPDATING UI NOW!"
  echo "  ✅ 🎉 Cache updated successfully, new count: X"
  echo ""
  echo "Comportamento esperado:"
  echo "  ✅ Mensagem aparece IMEDIATAMENTE (sem F5)"
  echo "  ✅ Sem necessidade de refresh manual"
  echo ""

  if [ -n "$MESSAGE_ID" ] && [ "$MESSAGE_ID" != "null" ]; then
    echo "Message ID criado: $MESSAGE_ID"
  fi

else
  echo "❌ Falha ao enviar mensagem!"
  echo ""
  echo "Resposta completa:"
  echo "$HTTP_BODY"
  echo ""
  exit 1
fi

echo ""
echo "========================================"
echo "VERIFICAR LOGS DO BACKEND"
echo "========================================"
echo ""
echo "No terminal do backend, procure por:"
echo ""
echo "1. Log do worker:"
echo '   "Socket.io event emitted for outgoing message"'
echo ""
echo "2. Log do Socket.io:"
echo '   "New message event emitted"'
echo '   {  hasConversation: true  } ← DEVE SER TRUE'
echo ""
echo "Se hasConversation: false → Correção não funcionou"
echo "Se hasConversation: true  → Correção funcionou! ✅"
echo ""

exit 0
