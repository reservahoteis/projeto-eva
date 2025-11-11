# Script de Teste - Verificar Deploy Key

Write-Host "🔍 Testando conexão VPS → GitHub..." -ForegroundColor Cyan

$VPS_HOST = "root@72.61.39.235"

$result = ssh $VPS_HOST "ssh -T git@github.com 2>&1"

if ($result -like "*successfully authenticated*") {
    Write-Host "✅ Deploy Key configurada corretamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Você pode usar o deploy automático agora:" -ForegroundColor Green
    Write-Host "   .\deploy.ps1" -ForegroundColor Yellow
} elseif ($result -like "*Permission denied*") {
    Write-Host "❌ Deploy Key ainda não configurada!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Siga os passos:" -ForegroundColor Yellow
    Write-Host "   1. Acesse: https://github.com/fredcast/projeto-eva/settings/keys"
    Write-Host "   2. Clique em 'Add deploy key'"
    Write-Host "   3. Title: VPS Production Server"
    Write-Host "   4. Key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJTx3yc6weTugaeygV6mb/IxKeOVU+eAXFVkLd/+2kOK"
    Write-Host "   5. ✅ Marque 'Allow write access'"
    Write-Host "   6. Clique em 'Add key'"
    Write-Host ""
    Write-Host "   Depois rode este script novamente: .\test-deploy.ps1"
} else {
    Write-Host "⚠️  Resultado inesperado:" -ForegroundColor Yellow
    Write-Host $result
}
