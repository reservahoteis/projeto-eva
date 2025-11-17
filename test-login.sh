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
if echo "$RESPONSE" | grep -q "token"; then
    echo "✅ Login bem sucedido!"
    TOKEN=$(echo "$RESPONSE" | python -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

    if [ ! -z "$TOKEN" ]; then
        echo "✅ Token JWT recebido"
        echo ""
        echo "Testando endpoint autenticado..."

        # Testar endpoint autenticado
        curl -k -s -X GET "https://api.botreserva.com.br/contacts" \
          -H "Authorization: Bearer $TOKEN" \
          -H "x-tenant-slug: hoteis-reserva" \
          -w "\nHTTP Status: %{http_code}\n"
    fi
else
    echo "❌ Erro no login:"
    echo "$RESPONSE" | python -m json.tool
fi

echo ""
echo "======================================"