#!/bin/bash

# ============================================
# Let's Encrypt SSL Certificate Setup
# Para PRODUÇÃO com domínio válido
# ============================================
# Requisitos:
# - Domínio apontando para este servidor
# - Portas 80 e 443 abertas no firewall
# - Docker rodando
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Let's Encrypt SSL Certificate Setup${NC}"
echo -e "${BLUE}  Produção - Certificado VÁLIDO${NC}"
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

# Verificar se certbot está instalado (container)
if ! docker compose -f /opt/docker-compose.production.yml ps | grep -q certbot; then
    echo -e "${RED}❌ Container certbot não encontrado${NC}"
    exit 1
fi

# Diretórios
BASE_DIR="/opt"
NGINX_CONF="$BASE_DIR/nginx/conf.d/api.conf"
CERTBOT_DIR="$BASE_DIR/certbot"

# Criar diretórios necessários
mkdir -p "$CERTBOT_DIR/conf"
mkdir -p "$CERTBOT_DIR/www"

# Solicitar informações
echo -e "${YELLOW}📝 Configuração do domínio${NC}"
echo ""
echo -e "${BLUE}IMPORTANTE:${NC}"
echo -e "  1. Seu domínio DEVE estar apontando para este servidor"
echo -e "  2. Registro DNS tipo A: seu-dominio.com -> $(curl -s ifconfig.me)"
echo -e "  3. Aguarde propagação DNS (pode levar até 48h)"
echo ""

read -p "Digite seu domínio completo (ex: api.seudominio.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}❌ Domínio é obrigatório${NC}"
    exit 1
fi

# Validar formato do domínio
if ! echo "$DOMAIN" | grep -qE '^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'; then
    echo -e "${RED}❌ Formato de domínio inválido${NC}"
    exit 1
fi

read -p "Digite seu email (para notificações Let's Encrypt): " EMAIL

if [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Email é obrigatório${NC}"
    exit 1
fi

# Validar email
if ! echo "$EMAIL" | grep -qE '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
    echo -e "${RED}❌ Formato de email inválido${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Configuração:${NC}"
echo -e "  Domínio: $DOMAIN"
echo -e "  Email: $EMAIL"
echo -e "  IP do servidor: $(curl -s ifconfig.me)"
echo ""

# Verificar DNS
echo -e "${YELLOW}🔍 Verificando DNS...${NC}"
DOMAIN_IP=$(dig +short "$DOMAIN" @8.8.8.8 | tail -n1)
SERVER_IP=$(curl -s ifconfig.me)

if [ -z "$DOMAIN_IP" ]; then
    echo -e "${RED}❌ Domínio não encontrado no DNS${NC}"
    echo -e "${YELLOW}Configure o registro DNS antes de continuar${NC}"
    exit 1
fi

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  Aviso: DNS não está apontando para este servidor${NC}"
    echo -e "  DNS aponta para: $DOMAIN_IP"
    echo -e "  Este servidor: $SERVER_IP"
    echo ""
    read -p "Continuar mesmo assim? (yes/no): " FORCE_CONTINUE
    if [ "$FORCE_CONTINUE" != "yes" ]; then
        echo "Cancelado."
        exit 0
    fi
else
    echo -e "${GREEN}✅ DNS configurado corretamente!${NC}"
fi

echo ""
read -p "Prosseguir com a instalação? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelado."
    exit 0
fi

# Fazer backup da configuração atual
echo ""
echo -e "${YELLOW}💾 Criando backup da configuração...${NC}"
BACKUP_FILE="$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
cp "$NGINX_CONF" "$BACKUP_FILE"
echo -e "${GREEN}Backup criado: $BACKUP_FILE${NC}"

# Atualizar server_name na configuração
echo -e "${YELLOW}📝 Atualizando configuração do Nginx...${NC}"
sed -i "s/server_name _;/server_name $DOMAIN;/g" "$NGINX_CONF"

# Garantir que ACME challenge está acessível
echo -e "${YELLOW}🔧 Configurando ACME challenge...${NC}"

# Recarregar nginx para aplicar mudanças
docker compose -f "$BASE_DIR/docker-compose.production.yml" exec nginx nginx -t
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Configuração do Nginx inválida${NC}"
    echo -e "${YELLOW}Restaurando backup...${NC}"
    mv "$BACKUP_FILE" "$NGINX_CONF"
    exit 1
fi

docker compose -f "$BASE_DIR/docker-compose.production.yml" exec nginx nginx -s reload

# Aguardar nginx recarregar
sleep 3

# Testar se ACME challenge está acessível
echo -e "${YELLOW}🧪 Testando acesso ao ACME challenge...${NC}"
mkdir -p "$CERTBOT_DIR/www/.well-known/acme-challenge"
echo "test" > "$CERTBOT_DIR/www/.well-known/acme-challenge/test.txt"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/.well-known/acme-challenge/test.txt")
rm -f "$CERTBOT_DIR/www/.well-known/acme-challenge/test.txt"

if [ "$HTTP_STATUS" != "200" ]; then
    echo -e "${YELLOW}⚠️  Aviso: ACME challenge pode não estar acessível (HTTP $HTTP_STATUS)${NC}"
    read -p "Continuar? (yes/no): " CONTINUE
    if [ "$CONTINUE" != "yes" ]; then
        echo "Cancelado."
        exit 0
    fi
fi

# Obter certificado Let's Encrypt
echo ""
echo -e "${YELLOW}📜 Solicitando certificado Let's Encrypt...${NC}"
echo -e "${BLUE}Isso pode levar alguns minutos...${NC}"
echo ""

docker compose -f "$BASE_DIR/docker-compose.production.yml" run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    --verbose \
    -d "$DOMAIN"

# Verificar se o certificado foi obtido
if [ ! -d "$CERTBOT_DIR/conf/live/$DOMAIN" ]; then
    echo ""
    echo -e "${RED}❌ Falha ao obter certificado${NC}"
    echo ""
    echo -e "${YELLOW}Possíveis causas:${NC}"
    echo -e "  1. DNS não está configurado corretamente"
    echo -e "  2. Porta 80 bloqueada no firewall"
    echo -e "  3. Limite de requisições Let's Encrypt atingido"
    echo -e "  4. Domínio inválido"
    echo ""
    echo -e "${YELLOW}Restaurando configuração anterior...${NC}"
    mv "$BACKUP_FILE" "$NGINX_CONF"
    docker compose -f "$BASE_DIR/docker-compose.production.yml" exec nginx nginx -s reload
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Certificado obtido com sucesso!${NC}"

# Exibir informações do certificado
echo ""
echo -e "${BLUE}Informações do certificado:${NC}"
docker compose -f "$BASE_DIR/docker-compose.production.yml" run --rm certbot certificates -d "$DOMAIN"

# Configurar Nginx para usar HTTPS
echo ""
echo -e "${YELLOW}🔧 Configurando HTTPS no Nginx...${NC}"

# Descomentar o server HTTPS
sed -i 's/^# server {/server {/g' "$NGINX_CONF"
sed -i 's/^#     /    /g' "$NGINX_CONF"
sed -i 's/^# }/}/g' "$NGINX_CONF"

# Atualizar paths do certificado
sed -i "s/ssl_certificate \/etc\/letsencrypt\/live\/DOMAIN\//ssl_certificate \/etc\/letsencrypt\/live\/$DOMAIN\//g" "$NGINX_CONF"
sed -i "s/ssl_certificate_key \/etc\/letsencrypt\/live\/DOMAIN\//ssl_certificate_key \/etc\/letsencrypt\/live\/$DOMAIN\//g" "$NGINX_CONF"
sed -i "s/ssl_trusted_certificate \/etc\/letsencrypt\/live\/DOMAIN\//ssl_trusted_certificate \/etc\/letsencrypt\/live\/$DOMAIN\//g" "$NGINX_CONF"

# Descomentar caminhos Let's Encrypt
sed -i 's/^#    ssl_certificate \/etc\/letsencrypt/    ssl_certificate \/etc\/letsencrypt/g' "$NGINX_CONF"
sed -i 's/^#    ssl_certificate_key \/etc\/letsencrypt/    ssl_certificate_key \/etc\/letsencrypt/g' "$NGINX_CONF"
sed -i 's/^#    ssl_trusted_certificate/    ssl_trusted_certificate/g' "$NGINX_CONF"

# Comentar linhas self-signed
sed -i 's/^    ssl_certificate \/etc\/nginx\/ssl\/selfsigned/#    ssl_certificate \/etc\/nginx\/ssl\/selfsigned/g' "$NGINX_CONF"
sed -i 's/^    ssl_certificate_key \/etc\/nginx\/ssl\/selfsigned/#    ssl_certificate_key \/etc\/nginx\/ssl\/selfsigned/g' "$NGINX_CONF"

# Ativar redirect HTTP -> HTTPS
sed -i 's/^    # location \/ {/    location \/ {/g' "$NGINX_CONF"
sed -i 's/^    #     return 301/        return 301/g' "$NGINX_CONF"
sed -i 's/^    # }/    }/g' "$NGINX_CONF"

# Comentar o proxy temporário HTTP (somente as linhas específicas)
# Criar um arquivo temporário com as alterações
awk '
/# Temporary: Proxy to backend/,/^    }$/ {
    if (!in_temp) { in_temp=1 }
    if ($0 ~ /^    }$/ && in_temp) {
        print "# " $0
        in_temp=0
        next
    }
    if (in_temp) {
        print "# " $0
        next
    }
}
{ print }
' "$NGINX_CONF" > "$NGINX_CONF.tmp"
mv "$NGINX_CONF.tmp" "$NGINX_CONF"

# Testar configuração
echo -e "${YELLOW}🧪 Testando configuração do Nginx...${NC}"
docker compose -f "$BASE_DIR/docker-compose.production.yml" exec nginx nginx -t

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Configuração do Nginx inválida${NC}"
    echo -e "${YELLOW}Restaurando backup...${NC}"
    mv "$BACKUP_FILE" "$NGINX_CONF"
    docker compose -f "$BASE_DIR/docker-compose.production.yml" exec nginx nginx -s reload
    exit 1
fi

# Recarregar Nginx
echo -e "${YELLOW}🔄 Recarregando Nginx...${NC}"
docker compose -f "$BASE_DIR/docker-compose.production.yml" restart nginx

# Aguardar Nginx ficar healthy
echo -e "${YELLOW}⏳ Aguardando Nginx...${NC}"
sleep 8

# Verificar se Nginx está rodando
if ! docker ps | grep -q crm-nginx; then
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    exit 1
fi

# Teste final HTTPS
echo ""
echo -e "${YELLOW}🧪 Testando HTTPS...${NC}"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health")

if [ "$HTTPS_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ HTTPS está funcionando perfeitamente!${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: HTTPS retornou status $HTTPS_STATUS${NC}"
fi

# Teste redirect HTTP -> HTTPS
echo -e "${YELLOW}🧪 Testando redirect HTTP -> HTTPS...${NC}"
REDIRECT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "http://$DOMAIN/health")

if [ "$REDIRECT_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Redirect HTTP -> HTTPS funcionando!${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Redirect retornou status $REDIRECT_STATUS${NC}"
fi

# Configurar renovação automática
echo ""
echo -e "${YELLOW}🔄 Configurando renovação automática...${NC}"

# O container certbot já está configurado para renovar automaticamente
# Vamos apenas testar se a renovação funciona
echo -e "${BLUE}Testando renovação (dry-run)...${NC}"
docker compose -f "$BASE_DIR/docker-compose.production.yml" run --rm certbot renew --dry-run

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Renovação automática configurada!${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Teste de renovação falhou${NC}"
fi

# Informações finais
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  ✅ SSL Let's Encrypt Configurado!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Domínio:${NC} $DOMAIN"
echo -e "${BLUE}Certificado:${NC} $CERTBOT_DIR/conf/live/$DOMAIN/"
echo -e "${BLUE}Validade:${NC} 90 dias (renovação automática)"
echo -e "${BLUE}Próxima renovação:${NC} Automática (container certbot)"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo -e "  HTTP:  http://$DOMAIN (redireciona para HTTPS)"
echo -e "  HTTPS: https://$DOMAIN"
echo ""
echo -e "${GREEN}Teste:${NC}"
echo -e "  curl https://$DOMAIN/health"
echo ""
echo -e "${BLUE}SSL Labs Test:${NC}"
echo -e "  https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
echo -e "${YELLOW}Renovação Automática:${NC}"
echo -e "  O container 'certbot' verificará e renovará o certificado"
echo -e "  automaticamente a cada 12 horas."
echo ""
echo -e "${GREEN}Backup da configuração anterior:${NC}"
echo -e "  $BACKUP_FILE"
echo ""
