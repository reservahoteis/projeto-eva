#!/bin/bash
# ============================================
# SCRIPT DE DEPLOY - Local → VPS
# ============================================

set -e  # Para em caso de erro

echo "🚀 Iniciando deploy para VPS..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

VPS_HOST="root@72.61.39.235"
VPS_PATH="/root/deploy-backend"
REPO_URL="git@github.com:fredcast/projeto-eva.git"

# ============================================
# 1. Fazer push das mudanças locais
# ============================================
echo -e "${YELLOW}📤 Fazendo push para GitHub...${NC}"
git add .
git status --short

read -p "Deseja commitar as mudanças? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    read -p "Mensagem do commit: " COMMIT_MSG
    git commit -m "$COMMIT_MSG"
    git push origin master
    echo -e "${GREEN}✅ Push realizado!${NC}"
else
    echo -e "${YELLOW}⚠️  Pulando commit. Fazendo apenas pull na VPS...${NC}"
fi

# ============================================
# 2. Atualizar código na VPS
# ============================================
echo -e "${YELLOW}🔄 Atualizando código na VPS...${NC}"

ssh $VPS_HOST << 'ENDSSH'
set -e

cd /root/deploy-backend

echo "📥 Fazendo pull do repositório..."
git pull origin master

echo "📦 Verificando dependências..."
if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
        echo "🔨 Instalando dependências (primeira vez)..."
        npm install --production
    else
        echo "✅ node_modules já existe"
    fi
fi

echo "🏗️  Compilando TypeScript..."
npm run build

echo "✅ Deploy concluído!"
ENDSSH

echo -e "${GREEN}🎉 Deploy finalizado com sucesso!${NC}"
echo ""
echo "🔗 Próximos passos:"
echo "   1. SSH na VPS: ssh $VPS_HOST"
echo "   2. Reiniciar serviço: cd /root/deploy-backend && docker-compose restart backend"
echo "   3. Ver logs: docker-compose logs -f backend"
