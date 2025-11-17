#!/bin/bash

# Script de teste para verificar correções na API
# Executa testes nas rotas /api/conversations e /api/conversations/stats

API_URL="http://localhost:4000"
TENANT_SLUG="hotelcopacabana"
AUTH_TOKEN="seu_token_aqui"  # Substitua com um token válido

echo "=========================================="
echo "TESTE DE CORREÇÕES DA API"
echo "=========================================="
echo ""

# 1. Testar rota de debug/tenant-info (sem auth)
echo "1. Testando /api/debug/tenant-info (sem header de tenant)..."
curl -X GET "$API_URL/api/debug/tenant-info" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "2. Testando /api/debug/tenant-info (COM header de tenant)..."
curl -X GET "$API_URL/api/debug/tenant-info" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: $TENANT_SLUG" \
  -s | jq '.'

echo ""
echo "3. Testando /api/debug/test-tenant/$TENANT_SLUG..."
curl -X GET "$API_URL/api/debug/test-tenant/$TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -s | jq '.'

echo ""
echo "4. Testando /api/conversations (SEM header de tenant - deve dar erro 400)..."
curl -X GET "$API_URL/api/conversations?limit=10" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -s | jq '.'

echo ""
echo "5. Testando /api/conversations (COM header de tenant)..."
curl -X GET "$API_URL/api/conversations?limit=10" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "X-Tenant-Slug: $TENANT_SLUG" \
  -s | jq '.'

echo ""
echo "6. Testando /api/conversations/stats (nova rota)..."
curl -X GET "$API_URL/api/conversations/stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "X-Tenant-Slug: $TENANT_SLUG" \
  -s | jq '.'

echo ""
echo "=========================================="
echo "TESTES CONCLUÍDOS"
echo "=========================================="
echo ""
echo "PRÓXIMOS PASSOS:"
echo "1. Substitua AUTH_TOKEN no script com um token válido"
echo "2. Certifique-se que o backend está rodando na porta 4000"
echo "3. Execute: chmod +x test-api-fixes.sh && ./test-api-fixes.sh"
echo ""
echo "VERIFICAÇÕES:"
echo "✓ Rota /api/debug/tenant-info mostra informações de debug"
echo "✓ Rota /api/conversations retorna erro 400 sem header X-Tenant-Slug"
echo "✓ Rota /api/conversations funciona com header X-Tenant-Slug"
echo "✓ Rota /api/conversations/stats retorna estatísticas"