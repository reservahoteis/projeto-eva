# 🚀 Guia Completo de Deploy em Produção

**Última atualização:** 15/11/2025
**Versão:** 1.0.0

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [CI/CD Automático via GitHub Actions](#cicd-automático-via-github-actions)
3. [Secrets do GitHub](#secrets-do-github)
4. [Etapas do Pipeline](#etapas-do-pipeline)
5. [Deploy Manual](#deploy-manual)
6. [Rollback](#rollback)
7. [Troubleshooting](#troubleshooting)
8. [Melhores Práticas](#melhores-práticas)

---

## 🎯 Visão Geral

Este projeto utiliza **GitHub Actions** para deploy automático na VPS sempre que houver mudanças na pasta `deploy-backend/` da branch `master`.

**Infraestrutura:**
- **VPS:** 72.61.39.235 (Ubuntu)
- **Usuário:** root
- **Path:** /root/deploy-backend
- **Método:** SSH + Docker Compose
- **SSL:** Let's Encrypt (auto-renovação)

**URLs em Produção:**
- Backend API: https://api.botreserva.com.br
- Frontend: https://www.botreserva.com.br
- Health Check: https://api.botreserva.com.br/api/health

---

## ⚙️ CI/CD Automático via GitHub Actions

### Arquivo de Workflow

**Localização:** `.github/workflows/deploy-production.yml`

### Triggers

1. **Push automático:**
   ```yaml
   on:
     push:
       branches:
         - master
       paths:
         - 'deploy-backend/**'
         - '.github/workflows/deploy-production.yml'
   ```

2. **Manual (workflow_dispatch):**
   - Via GitHub UI: Actions → Deploy to Production VPS → Run workflow
   - Via GitHub CLI: `gh workflow run deploy-production.yml`

### Tempo de Execução

- **Média:** 3-5 minutos
- **Máximo (timeout):** 15 minutos

---

## 🔑 Secrets do GitHub

### Configuração

1. Ir em: **Repository → Settings → Secrets and variables → Actions**
2. Clicar em: **New repository secret**
3. Adicionar os seguintes secrets:

| Secret Name | Valor | Descrição |
|-------------|-------|-----------|
| `VPS_HOST` | `72.61.39.235` | IP do servidor VPS |
| `VPS_USER` | `root` | Usuário SSH |
| `VPS_PATH` | `/root/deploy-backend` | Path do projeto na VPS |
| `VPS_SSH_KEY` | `<chave-privada>` | Chave SSH privada (base64 ou raw) |

### Como obter a chave SSH

**Opção 1: Chave existente**
```bash
# Na sua máquina local
cat ~/.ssh/id_rsa

# Copiar todo o conteúdo (incluindo BEGIN e END)
# Colar diretamente no secret VPS_SSH_KEY
```

**Opção 2: Criar nova chave**
```bash
# Gerar nova chave
ssh-keygen -t rsa -b 4096 -C "github-actions@deploy" -f ~/.ssh/github_deploy

# Copiar chave pública para VPS
ssh-copy-id -i ~/.ssh/github_deploy.pub root@72.61.39.235

# Copiar chave privada
cat ~/.ssh/github_deploy

# Colar no secret VPS_SSH_KEY
```

**Opção 3: Base64 (mais seguro)**
```bash
# Encodar em base64
cat ~/.ssh/id_rsa | base64 -w 0

# Colar o output base64 no secret VPS_SSH_KEY
# O workflow detecta automaticamente e faz decode
```

---

## 🔄 Etapas do Pipeline

### 1. Checkout Code
- Faz checkout do repositório
- Fetch dos últimos 2 commits (para rollback se necessário)

### 2. Setup SSH
- Configura chave SSH privada
- Detecta formato automaticamente (base64 ou raw)
- Valida formato da chave
- Adiciona VPS ao known_hosts
- Testa conectividade SSH

### 3. Pre-deployment Checks
- ✅ **SSH connectivity** (obrigatório)
- ⚠️ **Ping VPS** (informativo - pode estar bloqueado)
- ✅ **Disk space** (aborta se >90%)
- ✅ **Docker running** (verifica se Docker está ativo)

### 4. Create Backup
- Tag da imagem Docker atual como backup
- Backup do banco PostgreSQL (pg_dump)
- Mantém apenas últimos 5 backups em disco
- Mantém apenas últimas 3 imagens Docker de backup

### 5. Sync Files to VPS
- Usa `rsync` para transferência incremental
- Exclui arquivos desnecessários:
  - `node_modules/`
  - `dist/`
  - `.env` (mantém o da VPS)
  - `.env.production` (mantém o da VPS)
  - `coverage/`
  - `backups/`
  - `test-*.ts`

### 6. Build Docker Image
```bash
docker compose -f docker-compose.production.yml build backend
```
- Build multi-stage (builder → production)
- Instala dependências com pnpm
- Compila TypeScript
- Gera Prisma Client
- Copia apenas arquivos necessários para imagem final

### 7. Start Backend Container
```bash
docker compose -f docker-compose.production.yml up -d --force-recreate backend
```
- `--force-recreate`: Garante que variáveis de ambiente sejam recarregadas
- `--no-deps`: Não recria dependências (postgres, redis)
- Aguarda container ficar healthy (timeout 60s)

### 8. Run Database Migrations
```bash
docker compose exec -T backend npx prisma migrate deploy
```
- Aguarda PostgreSQL ficar ready
- Executa migrations pendentes
- Rollback automático em caso de erro

### 9. Health Check
- URL: `https://api.botreserva.com.br/api/health`
- Máximo 30 tentativas (intervalo 5s)
- Timeout total: 2.5 minutos
- Exibe logs do container em caso de falha

### 10. Post-deployment Verification
- Lista status de todos os containers
- Verifica health dos services
- Exibe uso de disco

### 11. Cleanup
- Remove chave SSH do runner (segurança)
- Executado sempre, mesmo em caso de falha

### 12. Deployment Summary
- Exibe resultado final (sucesso ou falha)
- URL do health check
- Link para logs (se falhar)

---

## 🛠️ Deploy Manual

### Quando usar deploy manual?

- Testar mudanças locais antes de commitar
- GitHub Actions está fora do ar
- Precisa de mais controle sobre o processo
- Debugging de problemas

### Passo a Passo

```bash
# 1. Conectar na VPS
ssh root@72.61.39.235

# 2. Navegar para o diretório do projeto
cd /root/deploy-backend

# 3. Fazer backup (recomendado)
docker tag deploy-backend_backend:latest deploy-backend_backend:backup-$(date +%Y%m%d-%H%M%S)
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup-$(date +%Y%m%d-%H%M%S).sql

# 4. Atualizar código (se usar Git na VPS)
git pull origin master

# Ou usar rsync da sua máquina local:
# rsync -avz --delete --exclude 'node_modules' --exclude 'dist' \
#   deploy-backend/ root@72.61.39.235:/root/deploy-backend/

# 5. Build e deploy
docker compose -f docker-compose.production.yml build backend
docker compose -f docker-compose.production.yml up -d --force-recreate backend

# 6. Executar migrations (se houver)
docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy

# 7. Verificar logs
docker logs crm-backend -f

# 8. Health check
curl -f https://api.botreserva.com.br/api/health
```

### Deploy Rápido (sem rebuild)

Se você só alterou código TypeScript (sem mudanças em dependencies):

```bash
# 1. Sync apenas src/
rsync -avz deploy-backend/src/ root@72.61.39.235:/root/deploy-backend/src/

# 2. Rebuild dentro do container (mais rápido)
ssh root@72.61.39.235 << 'EOF'
  cd /root/deploy-backend
  docker compose exec backend npm run build
  docker compose restart backend
EOF
```

---

## 🔙 Rollback

### Rollback Automático (via workflow)

O workflow tem um job `rollback` que é executado automaticamente em caso de falha (apenas em trigger manual).

### Rollback Manual

**Opção 1: Usar backup de imagem Docker (mais rápido)**

```bash
ssh root@72.61.39.235

# 1. Ver backups disponíveis
docker images | grep "deploy-backend_backend:backup"

# Output exemplo:
# deploy-backend_backend   backup-20251115-143022   abc123def456   2 hours ago   500MB
# deploy-backend_backend   backup-20251115-120045   def456abc789   5 hours ago   500MB

# 2. Tag o backup como latest
docker tag deploy-backend_backend:backup-20251115-120045 deploy-backend_backend:latest

# 3. Recriar container com a imagem de backup
cd /root/deploy-backend
docker compose -f docker-compose.production.yml up -d --force-recreate backend

# 4. Verificar
docker logs crm-backend -f
curl -f https://api.botreserva.com.br/api/health
```

**Opção 2: Reverter código Git (mais seguro)**

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Ver commits recentes
git log --oneline -10

# 2. Reverter para commit anterior
git reset --hard abc123def

# 3. Rebuild e deploy
docker compose -f docker-compose.production.yml build backend
docker compose -f docker-compose.production.yml up -d --force-recreate backend

# 4. Verificar
curl -f https://api.botreserva.com.br/api/health
```

**Opção 3: Restaurar backup do banco (caso de emergência)**

```bash
ssh root@72.61.39.235
cd /root/deploy-backend/backups

# 1. Ver backups disponíveis
ls -lh pre-deploy-*/database.sql

# 2. Restaurar backup
docker exec -i crm-postgres psql -U crm_user crm_whatsapp_saas < pre-deploy-20251115-143022/database.sql

# 3. Restart backend
docker compose -f docker-compose.production.yml restart backend
```

---

## 🔧 Troubleshooting

### Problema: Workflow falha no step "Setup SSH"

**Erro:**
```
Invalid SSH key format. Please check VPS_SSH_KEY secret.
```

**Solução:**
```bash
# Verificar formato da chave
cat ~/.ssh/id_rsa | head -1
# Deve começar com: -----BEGIN OPENSSH PRIVATE KEY-----

# Se começar diferente, gerar nova chave:
ssh-keygen -t rsa -b 4096 -m PEM -C "github-actions" -f ~/.ssh/github_deploy

# Copiar para VPS
ssh-copy-id -i ~/.ssh/github_deploy.pub root@72.61.39.235

# Atualizar secret VPS_SSH_KEY com conteúdo de:
cat ~/.ssh/github_deploy
```

### Problema: "Disk usage is above 90%"

**Solução:**
```bash
ssh root@72.61.39.235

# Ver uso de disco
df -h

# Limpar Docker (⚠️ CUIDADO - apaga containers/imagens não usados)
docker system prune -a --volumes

# Limpar backups antigos
cd /root/deploy-backend/backups
ls -td pre-deploy-* | tail -n +3 | xargs rm -rf

# Limpar logs
journalctl --vacuum-time=7d
```

### Problema: "Docker is not running"

**Solução:**
```bash
ssh root@72.61.39.235

# Verificar status
systemctl status docker

# Iniciar Docker
systemctl start docker

# Habilitar auto-start
systemctl enable docker

# Verificar
docker ps
```

### Problema: Health check timeout

**Sintomas:**
```
Health check failed after 30 attempts
```

**Investigação:**
```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Ver logs do backend
docker logs crm-backend --tail 100

# 2. Verificar se container está rodando
docker ps | grep crm-backend

# 3. Verificar health do container
docker inspect crm-backend | grep -A 10 Health

# 4. Testar health endpoint manualmente
docker exec crm-backend curl http://localhost:3001/api/health

# 5. Verificar porta
netstat -tulpn | grep 3001

# 6. Verificar Nginx
docker logs crm-nginx --tail 50
curl -I http://localhost/api/health
```

**Soluções comuns:**
```bash
# Solução 1: Restart backend
docker compose -f docker-compose.production.yml restart backend

# Solução 2: Verificar variáveis de ambiente
docker exec crm-backend printenv

# Solução 3: Verificar conectividade com banco
docker exec crm-backend node -e "const {PrismaClient} = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => console.log('DB OK')).catch(console.error);"

# Solução 4: Rebuild completo
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build
```

### Problema: TypeScript build errors

**Erro:**
```
Error: TS2322: Type 'string | undefined' is not assignable to type 'string'
```

**Solução:**
```bash
# 1. Build local primeiro para verificar erros
cd deploy-backend
npm install
npm run build

# 2. Corrigir erros TypeScript no código

# 3. Commit e push
git add .
git commit -m "fix: TypeScript errors"
git push

# Workflow vai rodar automaticamente
```

### Problema: Migrations falham

**Erro:**
```
Failed to run migrations
```

**Investigação:**
```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Ver logs do postgres
docker logs crm-postgres --tail 50

# 2. Verificar se DB está pronto
docker exec crm-postgres pg_isready -U crm_user

# 3. Testar conexão manual
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT NOW();"

# 4. Ver migrations pendentes
docker exec crm-backend npx prisma migrate status

# 5. Aplicar migrations manualmente
docker exec crm-backend npx prisma migrate deploy
```

### Problema: CORS bloqueado após deploy

**Sintomas:**
- Frontend retorna erro CORS
- Preflight OPTIONS request falha

**Solução:**
```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Verificar variável FRONTEND_URL
cat .env | grep FRONTEND_URL

# 2. Deve ter múltiplas origens separadas por vírgula:
# FRONTEND_URL=https://projeto-eva-frontend.vercel.app,https://www.botreserva.com.br,https://botreserva.com.br

# 3. Se precisar atualizar:
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://url1,https://url2,https://url3|" .env

# 4. IMPORTANTE: Recriar container (não apenas restart)
docker compose -f docker-compose.production.yml up -d --force-recreate backend

# 5. Verificar se atualizou
docker exec crm-backend printenv FRONTEND_URL

# 6. Testar CORS
curl -I -X OPTIONS "https://api.botreserva.com.br/auth/login" \
  -H "Origin: https://www.botreserva.com.br" \
  -H "Access-Control-Request-Method: POST"

# Deve retornar:
# access-control-allow-origin: https://www.botreserva.com.br
```

---

## ✅ Melhores Práticas

### 1. Sempre criar backup antes de deploy manual

```bash
# Script de backup rápido
ssh root@72.61.39.235 << 'EOF'
  cd /root/deploy-backend
  docker tag deploy-backend_backend:latest deploy-backend_backend:backup-$(date +%Y%m%d-%H%M%S)
  docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup-$(date +%Y%m%d-%H%M%S).sql
  echo "✓ Backup criado"
EOF
```

### 2. Testar mudanças localmente antes de commit

```bash
cd deploy-backend

# Build local
npm install
npm run build

# Rodar testes
npm test

# Verificar TypeScript
npm run type-check
```

### 3. Usar commits descritivos

```bash
# ❌ Ruim
git commit -m "fix"

# ✅ Bom
git commit -m "fix: CORS aceitar múltiplas origens para Vercel + domínio próprio"
```

### 4. Monitorar logs após deploy

```bash
# Em um terminal, manter logs abertos
ssh root@72.61.39.235
docker logs crm-backend -f

# Em outro terminal, fazer deploy

# Observar logs em tempo real para detectar erros rapidamente
```

### 5. Verificar health check após cada deploy

```bash
# Health check básico
curl -f https://api.botreserva.com.br/api/health

# Health check detalhado
curl -s https://api.botreserva.com.br/api/health | jq '.'

# Deve retornar:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-15T...",
#   "uptime": 123456,
#   "database": "connected",
#   "redis": "connected"
# }
```

### 6. Nunca commitar arquivos .env

```bash
# Verificar antes de commit
git status

# Se .env aparecer:
git reset HEAD .env
git checkout -- .env

# Adicionar ao .gitignore se ainda não estiver
echo ".env" >> .gitignore
echo ".env.production" >> .gitignore
```

### 7. Usar --force-recreate ao mudar .env

```bash
# ❌ ERRADO - Não recarrega .env
docker compose restart backend

# ✅ CORRETO - Recarrega .env
docker compose up -d --force-recreate backend
```

### 8. Manter documentação atualizada

Sempre que fizer mudanças significativas:
- Atualizar `docs/DOCUMENTACAO-COMPLETA.md`
- Atualizar `README.md`
- Criar documento específico se for um fix complexo

---

## 📞 Suporte

### Logs do Workflow

- **GitHub UI:** Actions → Deploy to Production VPS → Click no run → Click no step
- **GitHub CLI:** `gh run list --workflow=deploy-production.yml`

### Ver último deploy

```bash
gh run list --workflow=deploy-production.yml --limit 1
gh run view --log
```

### Contato

- **Issues:** https://github.com/fredcast/projeto-eva/issues
- **Documentação:** `docs/`

---

## 📚 Documentos Relacionados

- [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) - Documentação técnica completa
- [CORS-FIX-2025-11-15.md](./CORS-FIX-2025-11-15.md) - Fix de CORS múltiplas origens
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Guia completo de troubleshooting
- [GUIA-META-WHATSAPP-API.md](./GUIA-META-WHATSAPP-API.md) - Integração WhatsApp

---

**Última atualização:** 15/11/2025
**Versão:** 1.0.0
**Status:** ✅ CI/CD AUTOMÁTICO FUNCIONANDO
