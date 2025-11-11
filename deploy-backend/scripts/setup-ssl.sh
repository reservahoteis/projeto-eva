#!/bin/bash

# ============================================
# SSL Setup Script - Let's Encrypt
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get domain from user
echo -e "${YELLOW}🔐 SSL Certificate Setup${NC}"
echo ""
read -p "Enter your domain (e.g., api.seudominio.com): " DOMAIN
read -p "Enter your email for Let's Encrypt: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Domain and email are required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Domain: $DOMAIN${NC}"
echo -e "${YELLOW}Email: $EMAIL${NC}"
echo ""
read -p "Proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

# Update nginx config with domain
echo -e "${YELLOW}📝 Updating nginx configuration...${NC}"
sed -i "s/api.seudominio.com/$DOMAIN/g" infra/nginx/conf.d/api.conf

# Restart nginx to apply changes
docker-compose -f docker-compose.production.yml restart nginx

# Obtain certificate
echo -e "${YELLOW}📜 Obtaining SSL certificate...${NC}"
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Check if certificate was obtained
if [ -d "infra/certbot/conf/live/$DOMAIN" ]; then
    echo -e "${GREEN}✅ Certificate obtained successfully!${NC}"

    # Uncomment HTTPS section in nginx config
    echo -e "${YELLOW}📝 Enabling HTTPS in nginx...${NC}"
    sed -i 's/# location \/ {/location \/ {/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     return 301/    return 301/g' infra/nginx/conf.d/api.conf
    sed -i 's/# }/}/g' infra/nginx/conf.d/api.conf
    sed -i 's/# server {/server {/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     listen/    listen/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     server_name/    server_name/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     ssl/    ssl/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     add_header/    add_header/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     location/    location/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     proxy/    proxy/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     access_log/    access_log/g' infra/nginx/conf.d/api.conf
    sed -i 's/#     if/    if/g' infra/nginx/conf.d/api.conf
    sed -i 's/#         /        /g' infra/nginx/conf.d/api.conf

    # Reload nginx
    docker-compose -f docker-compose.production.yml exec nginx nginx -s reload

    echo -e "${GREEN}✅ HTTPS enabled!${NC}"
    echo ""
    echo -e "${GREEN}🎉 SSL setup completed successfully!${NC}"
    echo -e "${GREEN}Your API is now available at: https://$DOMAIN${NC}"
else
    echo -e "${RED}❌ Failed to obtain certificate${NC}"
    echo "Please check your domain DNS settings and try again"
    exit 1
fi
