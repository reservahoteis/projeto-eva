#!/bin/bash

# Teste de Login no Tenant Hoteis Reserva
LOGIN_URL="https://api.botreserva.com.br/auth/login"

echo "======================================"
echo "TESTE DE LOGIN - TENANT HOTEIS-RESERVA"
echo "======================================"
echo ""

# Fazer login
echo "Fazendo login..."
RESPONSE=$(curl -k -s -X POST "$LOGIN_URL" \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: hoteis-reserva" \
  -d '{
    "email": "admin@hoteisreserva.com.br",
    "password": "Admin@123"
  }')

# Verificar se tem token
if echo "$RESPONSE" | grep -q "accessToken"; then
    echo "✅ Login bem sucedido!"
    TOKEN=$(echo "$RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin).get('accessToken', ''))" 2>/dev/null)

    if [ ! -z "$TOKEN" ]; then
        echo "✅ Token JWT recebido"
        echo ""
        echo "Testando endpoint de contatos..."

        # Testar endpoint autenticado
        CONTACTS=$(curl -k -s -X GET "https://api.botreserva.com.br/contacts" \
          -H "Authorization: Bearer $TOKEN" \
          -H "x-tenant-slug: hoteis-reserva")

        echo "Resposta do endpoint /contacts:"
        echo "$CONTACTS" | python -m json.tool 2>/dev/null || echo "$CONTACTS"

        echo ""
        echo "Testando endpoint de conversas..."
        CONVERSATIONS=$(curl -k -s -X GET "https://api.botreserva.com.br/conversations" \
          -H "Authorization: Bearer $TOKEN" \
          -H "x-tenant-slug: hoteis-reserva")

        echo "Resposta do endpoint /conversations:"
        echo "$CONVERSATIONS" | python -m json.tool 2>/dev/null || echo "$CONVERSATIONS"
    fi
else
    echo "❌ Erro no login:"
    echo "$RESPONSE" | python -m json.tool
fi

echo ""
echo "======================================"