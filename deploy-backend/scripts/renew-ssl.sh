#!/bin/bash

# ============================================
# SSL Certificate Renewal Script
# ============================================
# Renova manualmente o certificado SSL
# Normalmente não é necessário (renovação automática)
# Use apenas se precisar forçar renovação
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  SSL Certificate Renewal${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar se está na VPS
if [ ! -d "/opt" ]; then
    echo -e "${RED}❌ Erro: Este script deve rodar na VPS em /opt/${NC}"
    exit 1
fi

# Verificar Docker
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando${NC}"
    exit 1
fi

BASE_DIR="/opt"

# Listar certificados existentes
echo -e "${YELLOW}📜 Certificados instalados:${NC}"
echo ""
docker compose -f "$BASE_DIR/docker-compose.production.yml" run --rm certbot certificates

# Perguntar se deseja continuar
echo ""
read -p "Renovar TODOS os certificados? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelado."
    exit 0
fi

# Renovar certificados
echo ""
echo -e "${YELLOW}🔄 Renovando certificados...${NC}"
echo ""

docker compose -f "$BASE_DIR/docker-compose.production.yml" run --rm certbot renew \
    --force-renewal \
    --verbose

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ Falha ao renovar certificados${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Certificados renovados!${NC}"

# Recarregar Nginx
echo ""
echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
docker compose -f "$BASE_DIR/docker-compose.production.yml" exec nginx nginx -s reload

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Falha ao recarregar Nginx, tentando restart...${NC}"
    docker compose -f "$BASE_DIR/docker-compose.production.yml" restart nginx
fi

sleep 5

# Verificar se Nginx está rodando
if ! docker ps | grep -q crm-nginx; then
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Nginx recarregado!${NC}"

# Exibir informações atualizadas
echo ""
echo -e "${YELLOW}📋 Informações dos certificados:${NC}"
echo ""
docker compose -f "$BASE_DIR/docker-compose.production.yml" run --rm certbot certificates

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✅ Renovação Concluída!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
