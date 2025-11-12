#!/bin/bash

# ============================================
# Self-Signed SSL Certificate Setup
# Para DESENVOLVIMENTO E TESTES apenas
# ============================================
# Este script cria um certificado SSL auto-assinado
# NÃO usar em produção!
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Self-Signed SSL Certificate Setup${NC}"
echo -e "${BLUE}  Para DESENVOLVIMENTO/TESTES apenas${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Verificar se está rodando na VPS
if [ ! -d "/opt" ]; then
    echo -e "${RED}❌ Erro: Este script deve rodar na VPS em /opt/${NC}"
    exit 1
fi

# Verificar se Docker está rodando
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando${NC}"
    exit 1
fi

# Diretório base
BASE_DIR="/opt"
SSL_DIR="$BASE_DIR/nginx/ssl"

# Criar diretório SSL se não existir
echo -e "${YELLOW}📁 Criando diretório SSL...${NC}"
mkdir -p "$SSL_DIR"

# Perguntar detalhes do certificado
echo ""
echo -e "${YELLOW}Por favor, forneça as informações para o certificado:${NC}"
echo ""

read -p "Country (2 letters) [BR]: " COUNTRY
COUNTRY=${COUNTRY:-BR}

read -p "State/Province [Sao Paulo]: " STATE
STATE=${STATE:-Sao Paulo}

read -p "City [Sao Paulo]: " CITY
CITY=${CITY:-Sao Paulo}

read -p "Organization [CRM WhatsApp SaaS]: " ORG
ORG=${ORG:-CRM WhatsApp SaaS}

read -p "Common Name (domain or IP) [72.61.39.235]: " COMMON_NAME
COMMON_NAME=${COMMON_NAME:-72.61.39.235}

echo ""
echo -e "${BLUE}Configuração:${NC}"
echo -e "  Country: $COUNTRY"
echo -e "  State: $STATE"
echo -e "  City: $CITY"
echo -e "  Organization: $ORG"
echo -e "  Common Name: $COMMON_NAME"
echo ""

read -p "Continuar? (yes/no) [yes]: " CONFIRM
CONFIRM=${CONFIRM:-yes}

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelado."
    exit 0
fi

# Gerar chave privada (2048 bits RSA)
echo ""
echo -e "${YELLOW}🔑 Gerando chave privada...${NC}"
openssl genrsa -out "$SSL_DIR/selfsigned.key" 2048

# Gerar certificado auto-assinado (válido por 365 dias)
echo -e "${YELLOW}📜 Gerando certificado auto-assinado...${NC}"
openssl req -new -x509 -key "$SSL_DIR/selfsigned.key" \
    -out "$SSL_DIR/selfsigned.crt" \
    -days 365 \
    -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$COMMON_NAME"

# Verificar certificado gerado
if [ ! -f "$SSL_DIR/selfsigned.crt" ] || [ ! -f "$SSL_DIR/selfsigned.key" ]; then
    echo -e "${RED}❌ Erro ao gerar certificado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Certificado gerado com sucesso!${NC}"
echo ""

# Exibir informações do certificado
echo -e "${BLUE}Informações do certificado:${NC}"
openssl x509 -in "$SSL_DIR/selfsigned.crt" -text -noout | grep -E "Subject:|Not Before|Not After"
echo ""

# Configurar permissões
echo -e "${YELLOW}🔐 Configurando permissões...${NC}"
chmod 644 "$SSL_DIR/selfsigned.crt"
chmod 600 "$SSL_DIR/selfsigned.key"

# Atualizar nginx.conf para usar o certificado
echo -e "${YELLOW}📝 Atualizando configuração do Nginx...${NC}"

NGINX_CONF="$BASE_DIR/nginx/conf.d/api.conf"

# Fazer backup do arquivo original
cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"

# Descomentar o server HTTPS
sed -i 's/^# server {/server {/g' "$NGINX_CONF"
sed -i 's/^#     /    /g' "$NGINX_CONF"
sed -i 's/^# }/}/g' "$NGINX_CONF"

# Comentar as linhas de Let's Encrypt
sed -i 's/^    ssl_certificate \/etc\/letsencrypt/#    ssl_certificate \/etc\/letsencrypt/g' "$NGINX_CONF"
sed -i 's/^    ssl_certificate_key \/etc\/letsencrypt/#    ssl_certificate_key \/etc\/letsencrypt/g' "$NGINX_CONF"
sed -i 's/^    ssl_trusted_certificate/#    ssl_trusted_certificate/g' "$NGINX_CONF"

# Descomentar linhas self-signed
sed -i 's/^#     ssl_certificate \/etc\/nginx\/ssl\/selfsigned/    ssl_certificate \/etc\/nginx\/ssl\/selfsigned/g' "$NGINX_CONF"
sed -i 's/^#     ssl_certificate_key \/etc\/nginx\/ssl\/selfsigned/    ssl_certificate_key \/etc\/nginx\/ssl\/selfsigned/g' "$NGINX_CONF"

# Comentar OCSP stapling (não funciona com self-signed)
sed -i 's/^    ssl_stapling /#    ssl_stapling /g' "$NGINX_CONF"
sed -i 's/^    ssl_stapling_verify/#    ssl_stapling_verify/g' "$NGINX_CONF"
sed -i 's/^    resolver /#    resolver /g' "$NGINX_CONF"

# Ativar redirect HTTP -> HTTPS
sed -i 's/^    # location \/ {/    location \/ {/g' "$NGINX_CONF" | sed -i 's/^    #     return 301/        return 301/g' "$NGINX_CONF" | sed -i 's/^    # }/    }/g' "$NGINX_CONF"

# Comentar o proxy temporário HTTP
sed -i '/# Temporary: Proxy to backend/,/^    }$/ s/^/# /' "$NGINX_CONF"

# Atualizar docker-compose para montar o diretório SSL
echo -e "${YELLOW}📝 Atualizando docker-compose.production.yml...${NC}"

COMPOSE_FILE="$BASE_DIR/docker-compose.production.yml"

# Verificar se o volume já existe
if ! grep -q "./nginx/ssl:/etc/nginx/ssl:ro" "$COMPOSE_FILE"; then
    # Adicionar volume SSL ao nginx
    sed -i '/- .\/nginx\/conf.d:\/etc\/nginx\/conf.d:ro/a\      - ./nginx/ssl:/etc/nginx/ssl:ro' "$COMPOSE_FILE"
fi

# Testar configuração do Nginx
echo ""
echo -e "${YELLOW}🧪 Testando configuração do Nginx...${NC}"

docker compose -f "$BASE_DIR/docker-compose.production.yml" exec nginx nginx -t

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Configuração do Nginx inválida${NC}"
    echo -e "${YELLOW}Restaurando backup...${NC}"
    mv "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONF"
    exit 1
fi

# Recarregar Nginx
echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
docker compose -f "$BASE_DIR/docker-compose.production.yml" restart nginx

# Aguardar Nginx ficar healthy
echo -e "${YELLOW}⏳ Aguardando Nginx...${NC}"
sleep 5

# Verificar se Nginx está rodando
if ! docker ps | grep -q crm-nginx; then
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    exit 1
fi

# Teste final
echo ""
echo -e "${YELLOW}🧪 Testando HTTPS...${NC}"
HEALTH_CHECK=$(curl -sk https://$COMMON_NAME/health | grep -o "ok" || echo "fail")

if [ "$HEALTH_CHECK" == "ok" ]; then
    echo -e "${GREEN}✅ HTTPS está funcionando!${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Health check falhou, mas SSL pode estar configurado${NC}"
fi

# Informações finais
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✅ SSL Self-Signed Configurado!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Certificado:${NC} $SSL_DIR/selfsigned.crt"
echo -e "${BLUE}Chave Privada:${NC} $SSL_DIR/selfsigned.key"
echo -e "${BLUE}Validade:${NC} 365 dias"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo -e "  HTTP:  http://$COMMON_NAME"
echo -e "  HTTPS: https://$COMMON_NAME"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo -e "  - Este é um certificado AUTO-ASSINADO"
echo -e "  - Navegadores mostrarão aviso de segurança"
echo -e "  - ${RED}NÃO usar em produção!${NC}"
echo -e "  - Para produção, use: ${GREEN}./setup-ssl-letsencrypt.sh${NC}"
echo ""
echo -e "${BLUE}Para testar:${NC}"
echo -e "  curl -k https://$COMMON_NAME/health"
echo ""
