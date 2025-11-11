# ============================================
# SCRIPT DE DEPLOY - Local → VPS (PowerShell)
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando deploy para VPS..." -ForegroundColor Cyan

$VPS_HOST = "root@72.61.39.235"
$VPS_PATH = "/root/deploy-backend"

# ============================================
# 1. Fazer push das mudanças locais
# ============================================
Write-Host "📤 Fazendo push para GitHub..." -ForegroundColor Yellow

git add .
git status --short

$response = Read-Host "Deseja commitar as mudanças? (s/n)"
if ($response -eq "s" -or $response -eq "S") {
    $commitMsg = Read-Host "Mensagem do commit"
    git commit -m "$commitMsg"
    git push origin master
    Write-Host "✅ Push realizado!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Pulando commit. Fazendo apenas pull na VPS..." -ForegroundColor Yellow
}

# ============================================
# 2. Atualizar código na VPS
# ============================================
Write-Host "🔄 Atualizando código na VPS..." -ForegroundColor Yellow

$sshScript = @'
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
'@

ssh $VPS_HOST $sshScript

Write-Host "🎉 Deploy finalizado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. SSH na VPS: ssh $VPS_HOST"
Write-Host "   2. Reiniciar serviço: cd /root/deploy-backend && docker-compose restart backend"
Write-Host "   3. Ver logs: docker-compose logs -f backend"
