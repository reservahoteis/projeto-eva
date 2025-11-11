#!/bin/bash

# ============================================
# Deploy Script - CRM WhatsApp SaaS
# ============================================

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production not found!${NC}"
    echo "Please create .env.production file with required variables"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

echo -e "${YELLOW}📦 Pulling latest code from git...${NC}"
git pull origin master

echo -e "${YELLOW}🏗️  Building Docker images...${NC}"
docker-compose -f docker-compose.production.yml build --no-cache

echo -e "${YELLOW}🛑 Stopping old containers...${NC}"
docker-compose -f docker-compose.production.yml down

echo -e "${YELLOW}🚀 Starting new containers...${NC}"
docker-compose -f docker-compose.production.yml up -d

echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check if backend is healthy
if docker-compose -f docker-compose.production.yml ps | grep -q "healthy"; then
    echo -e "${GREEN}✅ Services are healthy!${NC}"
else
    echo -e "${RED}❌ Some services are not healthy. Check logs:${NC}"
    docker-compose -f docker-compose.production.yml logs --tail=50
    exit 1
fi

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker-compose -f docker-compose.production.yml exec -T backend sh -c "cd apps/backend && npx prisma migrate deploy"

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📊 Check logs with: docker-compose -f docker-compose.production.yml logs -f"
echo "📈 Check status with: docker-compose -f docker-compose.production.yml ps"
