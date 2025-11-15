# GitHub Actions Deploy Setup

Este guia explica como configurar o deploy automático usando GitHub Actions para o projeto **BotReserva**.

## Visão Geral

- **Workflow**: `.github/workflows/deploy-production.yml`
- **Trigger**: Push para `master` com mudanças em `deploy-backend/`
- **Método**: GitHub Actions + SSH + rsync
- **Target**: VPS 72.61.39.235 (api.botreserva.com.br)
- **Path**: `/root/deploy-backend`

## Pré-requisitos

- VPS Ubuntu 24.04 com Docker instalado
- Acesso SSH ao VPS (usuário root ou com sudo)
- Repositório no GitHub
- Permissões de admin no repositório (para configurar Secrets)

---

## Passo 1: Gerar SSH Key no VPS

Execute no VPS:

```bash
# Conectar ao VPS
ssh root@72.61.39.235

# Criar diretório .ssh se não existir
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Gerar nova SSH key dedicada para deploy
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Adicionar a chave pública ao authorized_keys
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Exibir a chave PRIVADA (copie todo o conteúdo)
echo "============================================"
echo "COPIE A CHAVE PRIVADA ABAIXO:"
echo "============================================"
cat ~/.ssh/github_actions_deploy
echo "============================================"
```

**IMPORTANTE**: Copie **toda** a chave privada (incluindo as linhas `-----BEGIN OPENSSH PRIVATE KEY-----` e `-----END OPENSSH PRIVATE KEY-----`).

### Testar a Chave SSH

```bash
# Em outra janela/terminal, teste a conexão
ssh -i ~/.ssh/github_actions_deploy root@72.61.39.235 "echo 'SSH key works!'"

# Se funcionar, você verá: "SSH key works!"
```

---

## Passo 2: Configurar GitHub Secrets

1. Acesse seu repositório no GitHub
2. Vá em **Settings** > **Secrets and variables** > **Actions**
3. Clique em **New repository secret**
4. Adicione os seguintes secrets:

### 2.1. VPS_SSH_KEY

- **Name**: `VPS_SSH_KEY`
- **Value**: Cole a chave privada completa que você copiou no Passo 1

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
(todo o conteúdo da chave)
...
-----END OPENSSH PRIVATE KEY-----
```

### 2.2. VPS_HOST

- **Name**: `VPS_HOST`
- **Value**: `72.61.39.235`

### 2.3. VPS_USER

- **Name**: `VPS_USER`
- **Value**: `root`

### 2.4. VPS_PATH

- **Name**: `VPS_PATH`
- **Value**: `/root/deploy-backend`

---

## Passo 3: Preparar o VPS

Execute no VPS:

```bash
# 1. Criar diretório de deploy se não existir
mkdir -p /root/deploy-backend
cd /root/deploy-backend

# 2. Garantir que Docker está rodando
systemctl status docker
# Se não estiver rodando:
# systemctl start docker

# 3. Criar diretórios necessários
mkdir -p backups
mkdir -p certbot/conf
mkdir -p certbot/www
mkdir -p nginx/conf.d

# 4. Verificar se .env.production existe
if [ ! -f .env.production ]; then
  echo "⚠️  ATENÇÃO: Crie o arquivo .env.production antes do primeiro deploy!"
  echo "Copie .env.production.example e ajuste os valores."
fi

# 5. Garantir permissões corretas
chmod 755 /root/deploy-backend
```

---

## Passo 4: Criar .env.production no VPS

Se ainda não existe, crie o arquivo de variáveis de ambiente:

```bash
cd /root/deploy-backend

# Copiar exemplo
cp .env.production.example .env.production

# Editar com seus valores reais
nano .env.production
```

**Variáveis obrigatórias**:

```env
# Database
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=<senha-segura-aqui>
POSTGRES_DB=crm_whatsapp_saas

# Redis
REDIS_PASSWORD=<senha-redis-aqui>

# JWT
JWT_SECRET=<secret-jwt-aqui>
JWT_REFRESH_SECRET=<refresh-secret-aqui>

# URLs
FRONTEND_URL=https://app.botreserva.com.br
BASE_DOMAIN=botreserva.com.br

# WhatsApp
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<token-verificacao-webhook>

# n8n (opcional)
N8N_API_KEY=<api-key-n8n>

# Super Admin
SUPER_ADMIN_EMAIL=admin@botreserva.com.br
SUPER_ADMIN_PASSWORD=<senha-super-admin>
```

---

## Passo 5: Testar o Workflow

### 5.1. Teste Manual

1. Vá para **Actions** no GitHub
2. Selecione o workflow **Deploy to Production VPS**
3. Clique em **Run workflow**
4. Selecione a branch `master`
5. Clique em **Run workflow**

### 5.2. Teste Automático

Faça uma mudança em `deploy-backend/` e dê push para `master`:

```bash
# Exemplo: adicionar um comentário em algum arquivo
cd deploy-backend/src
# Faça uma mudança qualquer
git add .
git commit -m "test: trigger deploy workflow"
git push origin master
```

O workflow será acionado automaticamente.

---

## Passo 6: Monitorar o Deploy

### No GitHub Actions

1. Acesse **Actions** no repositório
2. Clique no workflow em execução
3. Acompanhe cada step em tempo real
4. Logs detalhados estão disponíveis

### No VPS

```bash
# Ver logs do backend em tempo real
cd /root/deploy-backend
docker-compose -f docker-compose.production.yml logs -f backend

# Ver status dos containers
docker-compose -f docker-compose.production.yml ps

# Ver logs de todos os containers
docker-compose -f docker-compose.production.yml logs --tail=100
```

---

## Estrutura do Workflow

O workflow executa as seguintes etapas:

1. **Checkout**: Baixa o código do repositório
2. **Setup SSH**: Configura a chave SSH para conectar ao VPS
3. **Pre-deployment checks**: Verifica conectividade, espaço em disco, Docker
4. **Create backup**: Backup automático antes do deploy
5. **Sync files**: Rsync de `deploy-backend/` para VPS
6. **Install & Build**: `npm ci`, `prisma generate`, `npm run build`
7. **Database migrations**: `prisma migrate deploy`
8. **Restart backend**: `docker-compose up -d --build backend`
9. **Health check**: Verifica `https://api.botreserva.com.br/api/health`
10. **Verification**: Valida estado dos containers
11. **Cleanup**: Remove chaves SSH temporárias

---

## Troubleshooting

### Erro: "Permission denied (publickey)"

**Causa**: SSH key não configurada corretamente

**Solução**:

```bash
# No VPS, verifique:
cat ~/.ssh/authorized_keys
# Deve conter a chave pública (github_actions_deploy.pub)

# Teste a conexão:
ssh -i ~/.ssh/github_actions_deploy root@72.61.39.235 "echo OK"

# Verifique permissões:
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Erro: "Health check failed"

**Causa**: Aplicação não iniciou corretamente

**Solução**:

```bash
# Ver logs do backend
docker-compose -f docker-compose.production.yml logs backend

# Verificar se porta 3001 está aberta
docker exec crm-backend netstat -tuln | grep 3001

# Testar health check manualmente
curl http://localhost:3001/health
```

### Erro: "Disk usage is above 90%"

**Causa**: Pouco espaço em disco no VPS

**Solução**:

```bash
# Ver uso de disco
df -h

# Limpar containers antigos
docker system prune -a

# Limpar backups antigos (mantém últimos 5)
cd /root/deploy-backend/backups
ls -t | tail -n +6 | xargs rm -rf

# Limpar logs Docker
docker logs crm-backend 2>&1 | tail -1000 > /tmp/backend.log
# Configure log rotation no docker-compose (já configurado)
```

### Erro: "Docker is not running"

**Causa**: Docker daemon parado

**Solução**:

```bash
# Iniciar Docker
systemctl start docker

# Habilitar Docker para iniciar automaticamente
systemctl enable docker

# Verificar status
systemctl status docker
```

### Erro: "Failed to run migrations"

**Causa**: PostgreSQL não está pronto ou erro nas migrations

**Solução**:

```bash
# Verificar se PostgreSQL está rodando
docker-compose -f docker-compose.production.yml ps postgres

# Ver logs do PostgreSQL
docker-compose -f docker-compose.production.yml logs postgres

# Testar conexão com banco
docker exec crm-postgres pg_isready -U crm_user

# Executar migrations manualmente
cd /root/deploy-backend
npx prisma migrate deploy
```

### Deploy está muito lento

**Causa**: `npm ci` baixando muitas dependências

**Solução**:

Considere usar cache de node_modules:

```bash
# No VPS, após primeiro deploy bem-sucedido
cd /root/deploy-backend
tar -czf node_modules-cache.tar.gz node_modules/

# O workflow já exclui node_modules do rsync
# Isso evita transferir +200MB a cada deploy
```

---

## Rollback Manual

Se um deploy falhar e você precisar voltar:

```bash
# Conectar ao VPS
ssh root@72.61.39.235
cd /root/deploy-backend

# Listar backups disponíveis
ls -lh backups/

# Identificar o último backup antes do problema
# Exemplo: backups/pre-deploy-20251115-143022

# Restaurar dist/
rm -rf dist
cp -r backups/pre-deploy-20251115-143022/dist .

# Restaurar package.json se necessário
cp backups/pre-deploy-20251115-143022/package.json .

# Reiniciar backend
docker-compose -f docker-compose.production.yml restart backend

# Verificar logs
docker-compose -f docker-compose.production.yml logs -f backend
```

---

## Segurança

### Boas Práticas

1. **SSH Key dedicada**: Use uma chave SSH única para GitHub Actions
2. **Secrets no GitHub**: Nunca commite credenciais no código
3. **Backup automático**: O workflow cria backup antes de cada deploy
4. **Non-root user Docker**: Containers rodam com usuário nodejs (UID 1001)
5. **Read-only volumes**: Configs Nginx são montadas como `:ro`

### Rotação de Chaves

Recomendado a cada 90 dias:

```bash
# 1. Gerar nova chave no VPS
ssh-keygen -t ed25519 -C "github-actions-deploy-$(date +%Y%m)" -f ~/.ssh/github_actions_deploy_new -N ""

# 2. Adicionar ao authorized_keys
cat ~/.ssh/github_actions_deploy_new.pub >> ~/.ssh/authorized_keys

# 3. Atualizar secret VPS_SSH_KEY no GitHub com conteúdo de:
cat ~/.ssh/github_actions_deploy_new

# 4. Testar novo deploy

# 5. Remover chave antiga
rm ~/.ssh/github_actions_deploy ~/.ssh/github_actions_deploy.pub
mv ~/.ssh/github_actions_deploy_new ~/.ssh/github_actions_deploy
```

---

## Otimizações Futuras

### 1. Cache de Dependencies

Adicione cache ao workflow para acelerar builds:

```yaml
- name: Cache node modules on VPS
  run: |
    ssh ... "cd /root/deploy-backend && npm ci --cache .npm --prefer-offline"
```

### 2. Deploy Blue-Green

Para zero downtime:

```bash
# Executar novo container na porta 3002
# Testar health check
# Trocar no Nginx
# Desligar container antigo
```

### 3. Notificações

Integre com Slack/Discord/Telegram:

```yaml
- name: Notify deployment
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Compatibilidade com deploy.sh

O workflow mantém compatibilidade com o método manual (`deploy.sh`). Você pode continuar usando:

```bash
# Deploy manual (quando necessário)
ssh root@72.61.39.235
cd /root/deploy-backend
./scripts/deploy.sh
```

---

## Health Check Endpoint

O workflow verifica `https://api.botreserva.com.br/api/health` que deve retornar:

```json
{
  "status": "healthy",
  "timestamp": "2025-11-15T14:30:22.000Z",
  "uptime": 12345,
  "database": "connected",
  "redis": "connected"
}
```

Se seu endpoint for diferente, ajuste `HEALTH_CHECK_URL` no workflow.

---

## Suporte

- **Documentação completa**: `docs/GUIA-DEPLOY.md`
- **Arquitetura**: `docs/ARQUITETURA-IDEAL.md`
- **Issues**: GitHub Issues do repositório

---

## Checklist Pré-Deploy

Antes do primeiro deploy via GitHub Actions:

- [ ] SSH key gerada no VPS
- [ ] Secrets configurados no GitHub (VPS_SSH_KEY, VPS_HOST, VPS_USER, VPS_PATH)
- [ ] Diretório `/root/deploy-backend` existe no VPS
- [ ] Arquivo `.env.production` criado no VPS com valores corretos
- [ ] Docker instalado e rodando no VPS
- [ ] Testado conexão SSH com a chave gerada
- [ ] PostgreSQL e Redis configurados (via docker-compose)
- [ ] Nginx configurado com domínio api.botreserva.com.br
- [ ] SSL/TLS certificado instalado (ou usando Certbot)
- [ ] Health check endpoint `/api/health` funcionando

---

**Última atualização**: 2025-11-15
**Versão do Workflow**: 1.0.0
