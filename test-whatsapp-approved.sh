#!/bin/bash

# ========================================================
# SCRIPT DE TESTE APÓS APROVAÇÃO DO WHATSAPP
# Para executar quando o número for aprovado pela Meta
# ========================================================

# Configurações
API_BASE_URL="https://api.botreserva.com.br"
TENANT_SLUG="hoteis-reserva"
PHONE_NUMBER_ID="782115004996178"
ACCESS_TOKEN="SEU_ACCESS_TOKEN_META_AQUI"  # Substituir pelo token da Meta
RECIPIENT_NUMBER="5511999999999"  # Número para enviar teste

echo "========================================================="
echo "   TESTE DE INTEGRAÇÃO WHATSAPP - PÓS APROVAÇÃO"
echo "========================================================="
echo ""

# ----------------------------------------
# 1. VERIFICAR TOKEN DE VERIFICAÇÃO
# ----------------------------------------
echo "[1/5] Verificando webhook token..."
echo ""

curl -X GET "$API_BASE_URL/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=botreserva_webhook_2024&hub.challenge=test_challenge"

echo ""
echo ""

# ----------------------------------------
# 2. ENVIAR MENSAGEM DE TEMPLATE
# ----------------------------------------
echo "[2/5] Enviando mensagem de template hello_world..."
echo ""

curl -X POST "https://graph.facebook.com/v18.0/$PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "'$RECIPIENT_NUMBER'",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": {
        "code": "pt_BR"
      }
    }
  }'

echo ""
echo ""

# ----------------------------------------
# 3. VERIFICAR LOGS DO BACKEND
# ----------------------------------------
echo "[3/5] Verificando logs do backend (últimas 20 linhas)..."
echo ""

ssh root@72.61.39.235 "docker logs crm-backend --tail 20"

echo ""

# ----------------------------------------
# 4. VERIFICAR MENSAGENS NO BANCO
# ----------------------------------------
echo "[4/5] Verificando mensagens no banco de dados..."
echo ""

ssh root@72.61.39.235 << 'EOF'
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas << 'EOSQL'
-- Últimas 5 mensagens
SELECT
    m.id,
    m.type,
    m.direction,
    m.status,
    m.content,
    m."createdAt"
FROM messages m
ORDER BY m."createdAt" DESC
LIMIT 5;

-- Conversas ativas
SELECT
    c.id,
    c.phone,
    c.status,
    c."lastMessageAt",
    COUNT(m.id) as total_messages
FROM conversations c
LEFT JOIN messages m ON m."conversationId" = c.id
WHERE c.status = 'ACTIVE'
GROUP BY c.id, c.phone, c.status, c."lastMessageAt"
ORDER BY c."lastMessageAt" DESC
LIMIT 5;
EOSQL
EOF

echo ""

# ----------------------------------------
# 5. MONITORAMENTO EM TEMPO REAL
# ----------------------------------------
echo "[5/5] Instruções para monitoramento em tempo real..."
echo ""

cat << 'MONITOR'
Para monitorar em tempo real, execute em terminais separados:

1. Logs do Backend:
   ssh root@72.61.39.235 "docker logs -f crm-backend"

2. Logs do PostgreSQL:
   ssh root@72.61.39.235 "docker logs -f crm-postgres"

3. Monitor de Webhooks (criar arquivo monitor.js):
   const io = require('socket.io-client');
   const socket = io('https://api.botreserva.com.br');
   socket.on('webhook_received', (data) => {
     console.log('Webhook recebido:', data);
   });

4. Queries SQL em tempo real:
   watch -n 5 'ssh root@72.61.39.235 "docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \"SELECT COUNT(*) FROM messages WHERE \\\"createdAt\\\" > NOW() - INTERVAL '"'"'5 minutes'"'"';\""'

MONITOR

echo ""
echo "========================================================="
echo "Teste concluído! Verifique os resultados acima."
echo "========================================================="