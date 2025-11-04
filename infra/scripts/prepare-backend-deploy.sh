#!/bin/bash

# ============================================
# Prepare Backend for VPS Deploy
# Cria um pacote apenas com o backend
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Preparando backend para deploy...${NC}"

# Diretório de deploy
DEPLOY_DIR="deploy-backend"

# Limpar diretório anterior se existir
if [ -d "$DEPLOY_DIR" ]; then
    echo -e "${YELLOW}🗑️  Removendo deploy anterior...${NC}"
    rm -rf "$DEPLOY_DIR"
fi

# Criar estrutura de diretórios
echo -e "${YELLOW}📁 Criando estrutura...${NC}"
mkdir -p "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/nginx/conf.d"
mkdir -p "$DEPLOY_DIR/scripts"
mkdir -p "$DEPLOY_DIR/backups"
mkdir -p "$DEPLOY_DIR/certbot/conf"
mkdir -p "$DEPLOY_DIR/certbot/www"

# Copiar backend
echo -e "${YELLOW}📋 Copiando backend...${NC}"
cp -r apps/backend/* "$DEPLOY_DIR/"

# Copiar configurações nginx
echo -e "${YELLOW}🌐 Copiando configurações nginx...${NC}"
cp infra/nginx/nginx.conf "$DEPLOY_DIR/nginx/"
cp infra/nginx/conf.d/api.conf "$DEPLOY_DIR/nginx/conf.d/"

# Copiar scripts
echo -e "${YELLOW}🔧 Copiando scripts...${NC}"
cp infra/scripts/deploy.sh "$DEPLOY_DIR/scripts/" 2>/dev/null || true
cp infra/scripts/backup.sh "$DEPLOY_DIR/scripts/" 2>/dev/null || true
cp infra/scripts/restore.sh "$DEPLOY_DIR/scripts/" 2>/dev/null || true
cp infra/scripts/setup-ssl.sh "$DEPLOY_DIR/scripts/" 2>/dev/null || true

# Ajustar scripts para novo caminho
sed -i 's|docker-compose -f docker-compose.production.yml|docker-compose -f docker-compose.production.yml|g' "$DEPLOY_DIR/scripts/"*.sh 2>/dev/null || true

# Copiar .env.production.example
echo -e "${YELLOW}📝 Copiando template de variáveis...${NC}"
cp .env.production.example "$DEPLOY_DIR/"

# Criar README no deploy
cat > "$DEPLOY_DIR/README.md" << 'EOF'
# Backend Deploy Package

Este pacote contém apenas o backend para deploy na VPS.

## 📦 Estrutura

```
deploy-backend/
├── src/              # Código fonte
├── prisma/           # Database schema
├── nginx/            # Configurações Nginx
├── scripts/          # Scripts de deploy
├── docker-compose.production.yml
├── Dockerfile.standalone
└── .env.production.example
```

## 🚀 Deploy Rápido

### 1. Fazer upload para VPS

```bash
# Na sua máquina local:
tar -czf backend.tar.gz deploy-backend/
scp backend.tar.gz root@seu-ip-vps:/opt/

# Na VPS:
ssh root@seu-ip-vps
cd /opt
tar -xzf backend.tar.gz
cd deploy-backend
```

### 2. Configurar variáveis

```bash
cp .env.production.example .env.production
nano .env.production
# Preencher com seus valores
```

### 3. Deploy

```bash
# Dar permissão aos scripts
chmod +x scripts/*.sh

# Subir containers
docker-compose -f docker-compose.production.yml up -d --build

# Executar migrations
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy

# Configurar SSL
./scripts/setup-ssl.sh
```

## 📋 Comandos Úteis

```bash
# Ver logs
docker-compose -f docker-compose.production.yml logs -f backend

# Restart
docker-compose -f docker-compose.production.yml restart backend

# Backup
./scripts/backup.sh

# Stop
docker-compose -f docker-compose.production.yml down
```

---

✅ **Backend pronto para deploy!**
EOF

# Criar arquivo tar.gz
echo -e "${YELLOW}📦 Compactando pacote...${NC}"
tar -czf backend-deploy.tar.gz "$DEPLOY_DIR/"

# Mostrar tamanho
SIZE=$(du -h backend-deploy.tar.gz | cut -f1)

echo ""
echo -e "${GREEN}✅ Backend preparado para deploy!${NC}"
echo ""
echo -e "${GREEN}📦 Pacote: backend-deploy.tar.gz (${SIZE})${NC}"
echo -e "${GREEN}📁 Pasta: $DEPLOY_DIR/${NC}"
echo ""
echo -e "${YELLOW}📤 Próximos passos:${NC}"
echo "1. Fazer upload do backend-deploy.tar.gz para VPS:"
echo "   scp backend-deploy.tar.gz root@seu-ip-vps:/opt/"
echo ""
echo "2. Na VPS, extrair e fazer deploy:"
echo "   ssh root@seu-ip-vps"
echo "   cd /opt"
echo "   tar -xzf backend-deploy.tar.gz"
echo "   cd deploy-backend"
echo "   cp .env.production.example .env.production"
echo "   nano .env.production"
echo "   docker-compose -f docker-compose.production.yml up -d --build"
echo ""
