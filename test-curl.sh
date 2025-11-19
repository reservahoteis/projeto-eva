#!/bin/bash

# ================================================
# TESTE RÁPIDO COM CURL
# ================================================

# CONFIGURAÇÃO - AJUSTE ESTES VALORES
AUTH_TOKEN="Bearer SEU_TOKEN_AQUI"
TENANT_ID="cm3y4buz50007cl8xn7wrmyyu"
CONVERSATION_ID="c220fbae-a594-4c03-994d-a116fa9a917d"

echo "================================================"
echo "TESTE DO ENDPOINT DE MENSAGENS"
echo "================================================"
echo ""
echo "URL: https://www.botreserva.com.br/api/conversations/$CONVERSATION_ID/messages"
echo "Tenant ID: $TENANT_ID"
echo ""

# Fazer requisição
curl -X GET \
  "https://www.botreserva.com.br/api/conversations/$CONVERSATION_ID/messages" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  --verbose \
  | python -m json.tool

echo ""
echo "================================================"
echo "FIM DO TESTE"
echo "================================================"