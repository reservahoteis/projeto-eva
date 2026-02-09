#!/bin/bash

# CRM Hoteis Reserva API - cURL Examples
# Complete examples for testing all endpoints

BASE_URL="http://localhost:3000"
TENANT_SLUG="hotel-ilhabela"
EMAIL="admin@hotel.com"
PASSWORD="senha123"
N8N_API_KEY="hotel-ilhabela:5511987654321000"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}CRM Hoteis Reserva API - cURL Test Suite${NC}\n"

# ============================================
# AUTHENTICATION
# ============================================

echo -e "${BLUE}=== AUTH: Login ===${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"tenantSlug\": \"$TENANT_SLUG\"
  }")

echo "$LOGIN_RESPONSE" | jq '.'

# Extract tokens (you need jq installed)
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // empty')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${GREEN}ERROR: Could not extract access token${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Logged in successfully${NC}"
echo -e "${GREEN}Token: ${ACCESS_TOKEN:0:20}...${NC}\n"

# ============================================
# AUTH ENDPOINTS
# ============================================

echo -e "${BLUE}=== AUTH: Get Current User ===${NC}"
curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo -e "\n${BLUE}=== AUTH: Refresh Token ===${NC}"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "$REFRESH_RESPONSE" | jq '.'
NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.accessToken // empty')

if [ ! -z "$NEW_ACCESS_TOKEN" ]; then
  ACCESS_TOKEN=$NEW_ACCESS_TOKEN
  echo -e "${GREEN}✓ Token refreshed${NC}\n"
fi

# ============================================
# USERS
# ============================================

echo -e "${BLUE}=== USERS: List ===${NC}"
curl -s -X GET "$BASE_URL/api/users?skip=0&take=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data[0] // .data'

echo -e "\n${BLUE}=== USERS: Create ===${NC}"
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@hotel.com",
    "password": "senha123",
    "name": "Test User",
    "role": "ATTENDANT"
  }')

echo "$USER_RESPONSE" | jq '.'
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.id // empty')

if [ ! -z "$USER_ID" ]; then
  echo -e "${GREEN}✓ User created: $USER_ID${NC}\n"

  echo -e "${BLUE}=== USERS: Get by ID ===${NC}"
  curl -s -X GET "$BASE_URL/api/users/$USER_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
fi

# ============================================
# CONVERSATIONS
# ============================================

echo -e "\n${BLUE}=== CONVERSATIONS: Stats ===${NC}"
curl -s -X GET "$BASE_URL/api/conversations/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo -e "\n${BLUE}=== CONVERSATIONS: List ===${NC}"
CONV_RESPONSE=$(curl -s -X GET "$BASE_URL/api/conversations?skip=0&take=5&status=OPEN" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$CONV_RESPONSE" | jq '.data[0] // .data'

# Get first conversation ID for testing
CONVERSATION_ID=$(echo "$CONV_RESPONSE" | jq -r '.data[0].id // empty')

if [ ! -z "$CONVERSATION_ID" ]; then
  echo -e "${GREEN}✓ Found conversation: $CONVERSATION_ID${NC}\n"

  echo -e "${BLUE}=== CONVERSATIONS: Get by ID ===${NC}"
  curl -s -X GET "$BASE_URL/api/conversations/$CONVERSATION_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

  # ============================================
  # MESSAGES
  # ============================================

  echo -e "\n${BLUE}=== MESSAGES: List ===${NC}"
  curl -s -X GET "$BASE_URL/api/conversations/$CONVERSATION_ID/messages?skip=0&take=10" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data[0] // .data'

  echo -e "\n${BLUE}=== MESSAGES: Send Text ===${NC}"
  curl -s -X POST "$BASE_URL/api/conversations/$CONVERSATION_ID/messages" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "content": "Teste via cURL - Olá!",
      "type": "TEXT"
    }' | jq '.'

  echo -e "\n${BLUE}=== CONVERSATIONS: Check Stats ===${NC}"
  curl -s -X GET "$BASE_URL/api/conversations/$CONVERSATION_ID/messages/stats" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
fi

# ============================================
# CONTACTS
# ============================================

echo -e "\n${BLUE}=== CONTACTS: List ===${NC}"
curl -s -X GET "$BASE_URL/api/contacts?skip=0&take=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data[0] // .data'

echo -e "\n${BLUE}=== CONTACTS: Create ===${NC}"
CONTACT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/contacts" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "5511999999999",
    "name": "Teste Contato",
    "email": "contato@test.com"
  }')

echo "$CONTACT_RESPONSE" | jq '.'
CONTACT_ID=$(echo "$CONTACT_RESPONSE" | jq -r '.id // empty')

echo -e "\n${BLUE}=== CONTACTS: Stats ===${NC}"
curl -s -X GET "$BASE_URL/api/contacts/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# ============================================
# TAGS
# ============================================

echo -e "\n${BLUE}=== TAGS: List ===${NC}"
curl -s -X GET "$BASE_URL/api/tags?skip=0&take=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data[0] // .data'

echo -e "\n${BLUE}=== TAGS: Create ===${NC}"
TAG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tags" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP",
    "color": "#FF0000"
  }')

echo "$TAG_RESPONSE" | jq '.'

# ============================================
# REPORTS
# ============================================

echo -e "\n${BLUE}=== REPORTS: Overview ===${NC}"
curl -s -X GET "$BASE_URL/api/reports/overview" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo -e "\n${BLUE}=== REPORTS: Attendants ===${NC}"
curl -s -X GET "$BASE_URL/api/reports/attendants" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data[0] // .data'

echo -e "\n${BLUE}=== REPORTS: Hourly ===${NC}"
curl -s -X GET "$BASE_URL/api/reports/hourly" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# ============================================
# N8N INTEGRATION
# ============================================

echo -e "\n${BLUE}=== N8N: Send Text Message ===${NC}"
curl -s -X POST "$BASE_URL/api/n8n/send-text" \
  -H "X-API-Key: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "message": "Olá! Teste via N8N API"
  }' | jq '.'

echo -e "\n${BLUE}=== N8N: Send Buttons ===${NC}"
curl -s -X POST "$BASE_URL/api/n8n/send-buttons" \
  -H "X-API-Key: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511987654321",
    "message": "Qual é sua escolha?",
    "buttons": [
      {"id": "opt1", "label": "Opção 1"},
      {"id": "opt2", "label": "Opção 2"},
      {"id": "opt3", "label": "Opção 3"}
    ],
    "title": "Menu de Opções"
  }' | jq '.'

echo -e "\n${BLUE}=== N8N: Check Availability ===${NC}"
curl -s -X GET "$BASE_URL/api/n8n/check-availability?unidade=Ilhabela&checkin=15/02/2026&checkout=20/02/2026&adults=2" \
  -H "X-API-Key: $N8N_API_KEY" | jq '.rooms[0] // .rooms'

echo -e "\n${BLUE}=== N8N: Check IA Lock ===${NC}"
curl -s -X GET "$BASE_URL/api/n8n/check-ia-lock?phone=5511987654321" \
  -H "X-API-Key: $N8N_API_KEY" | jq '.'

# ============================================
# ESCALATIONS
# ============================================

echo -e "\n${BLUE}=== ESCALATIONS: List ===${NC}"
curl -s -X GET "$BASE_URL/api/escalations?skip=0&take=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data[0] // .data'

echo -e "\n${BLUE}=== ESCALATIONS: Stats ===${NC}"
curl -s -X GET "$BASE_URL/api/escalations/stats" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# ============================================
# AUDIT LOGS
# ============================================

echo -e "\n${BLUE}=== AUDIT LOGS: List ===${NC}"
curl -s -X GET "$BASE_URL/api/audit-logs?skip=0&take=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data[0] // .data'

# ============================================
# USAGE TRACKING
# ============================================

echo -e "\n${BLUE}=== USAGE TRACKING: Current ===${NC}"
curl -s -X GET "$BASE_URL/api/usage-tracking/current" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# ============================================
# CLEANUP (Optional)
# ============================================

if [ ! -z "$USER_ID" ]; then
  echo -e "\n${BLUE}=== CLEANUP: Delete Test User ===${NC}"
  curl -s -X DELETE "$BASE_URL/api/users/$USER_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'
  echo -e "${GREEN}✓ Test user deleted${NC}"
fi

echo -e "\n${BLUE}=== AUTH: Logout ===${NC}"
curl -s -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo -e "\n${GREEN}✓ Test suite completed${NC}"
