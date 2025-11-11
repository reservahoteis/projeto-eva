#!/bin/bash
# ============================================
# SCRIPT DE SETUP VPS - Configuração Inicial
# Rodar UMA vez na VPS
# ============================================

set -e

echo "🚀 Configurando VPS para deploy automático..."

VPS_IP="72.61.39.235"
REPO_URL="git@github.com:fredcast/projeto-eva.git"

# ============================================
# Executar na VPS
# ============================================

cd /root

# Backup do deploy-backend atual se existir
if [ -d "deploy-backend" ]; then
    echo "📦 Fazendo backup do deploy-backend atual..."
    mv deploy-backend deploy-backend.backup-$(date +%Y%m%d-%H%M%S)
fi

# Clonar repositório completo (temporário)
echo "📥 Clonando repositório..."
git clone --depth 1 $REPO_URL temp-clone

# Copiar apenas deploy-backend
echo "📂 Extraindo deploy-backend..."
cp -r temp-clone/deploy-backend /root/

# Configurar Git
cd /root/deploy-backend
rm -rf .git
git init
git remote add origin $REPO_URL

# Configurar para rastrear apenas deploy-backend
git config core.sparseCheckout true
echo "deploy-backend/*" > .git/info/sparse-checkout

# Fetch e checkout
git fetch --depth 1 origin master
git checkout master

# Copiar .env.production do backup se existir
if ls ../deploy-backend.backup-*/.env.production 1> /dev/null 2>&1; then
    cp ../deploy-backend.backup-*/.env.production .env.production
    echo "✅ .env.production recuperado do backup"
else
    echo "⚠️  Criar .env.production manualmente"
fi

# Limpar temp
cd /root
rm -rf temp-clone

echo ""
echo "✅ VPS configurada com sucesso!"
echo ""
echo "📝 Estrutura:"
ls -la /root/deploy-backend/ | head -15
echo ""
echo "🎯 Próximos passos:"
echo "   1. Verificar .env.production: nano /root/deploy-backend/.env.production"
echo "   2. Testar pull: cd /root/deploy-backend && git pull origin master"
echo "   3. Build: npm install && npm run build"
echo "   4. Deploy: docker-compose up -d"
