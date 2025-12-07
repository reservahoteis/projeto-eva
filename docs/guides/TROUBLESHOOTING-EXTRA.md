# 🔧 Troubleshooting - Guia Completo de Soluções

**Última atualização:** 15/11/2025
**Versão:** 1.0.0

---

## 📋 Índice

1. [Erros de Deploy (CI/CD)](#erros-de-deploy-cicd)
2. [Erros de CORS](#erros-de-cors)
3. [Erros de Autenticação](#erros-de-autenticação)
4. [Erros de Tenant](#erros-de-tenant)
5. [Erros de Docker](#erros-de-docker)
6. [Erros de Banco de Dados](#erros-de-banco-de-dados)
7. [Erros de Build/TypeScript](#erros-de-buildtypescript)
8. [Erros de Rate Limiting](#erros-de-rate-limiting)
9. [Erros de Nginx](#erros-de-nginx)
10. [Problemas de Performance](#problemas-de-performance)

---

## 🚀 Erros de Deploy (CI/CD)

### Erro: "Invalid SSH key format"

**Sintoma:**
```
::error::Invalid SSH key format. Please check VPS_SSH_KEY secret.
```

**Causa:**
- Secret `VPS_SSH_KEY` com formato incorreto
- Chave corrompida ou incompleta

**Solução:**

```bash
# 1. Verificar formato da chave local
cat ~/.ssh/id_rsa | head -1
# Deve começar com: -----BEGIN OPENSSH PRIVATE KEY-----
# ou: -----BEGIN RSA PRIVATE KEY-----

# 2. Gerar nova chave se necessário
ssh-keygen -t rsa -b 4096 -m PEM -C "github-actions" -f ~/.ssh/github_deploy

# 3. Copiar chave pública para VPS
ssh-copy-id -i ~/.ssh/github_deploy.pub root@72.61.39.235

# 4. Testar conexão
ssh -i ~/.ssh/github_deploy root@72.61.39.235 "echo 'SSH OK'"

# 5. Atualizar secret no GitHub
cat ~/.ssh/github_deploy
# Copiar TODO o conteúdo (incluindo BEGIN e END)
# Colar em: GitHub → Settings → Secrets → VPS_SSH_KEY

# Opção: Usar base64 (mais seguro)
cat ~/.ssh/github_deploy | base64 -w 0
# Colar o base64 no secret
```

### Erro: "VPS does not respond to ping"

**Sintoma:**
```
::warning::VPS does not respond to ping (ICMP may be blocked by firewall)
```

**Causa:**
- VPS tem firewall bloqueando ICMP
- Comportamento normal em servidores hardened

**Solução:**
- ✅ **IGNORAR** - É apenas um warning informativo
- O workflow continua e testa SSH (que é o crítico)
- Se SSH funciona, está tudo OK

**Se quiser habilitar ping (opcional):**
```bash
ssh root@72.61.39.235

# Habilitar ICMP no firewall (ufw)
ufw allow icmp

# Ou iptables
iptables -A INPUT -p icmp -j ACCEPT
```

### Erro: "Disk usage is above 90%"

**Sintoma:**
```
::error::Disk usage is above 90%. Aborting deployment.
```

**Causa:**
- Disco cheio na VPS
- Logs, backups ou imagens Docker ocupando espaço

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Ver uso de disco
df -h
du -sh /* | sort -h

# 2. Limpar Docker (CUIDADO!)
docker system prune -a --volumes
# Pergunta confirmação - digite 'y'

# 3. Limpar backups antigos
cd /root/deploy-backend/backups
ls -lth
rm -rf pre-deploy-20251110-*  # Exemplo: deletar backups antigos

# 4. Limpar imagens Docker de backup antigas
docker images | grep backup
docker rmi deploy-backend_backend:backup-20251110-120000

# 5. Limpar logs do sistema
journalctl --vacuum-time=7d

# 6. Verificar novamente
df -h
```

### Erro: "Docker is not running"

**Sintoma:**
```
::error::Docker is not running
```

**Causa:**
- Docker daemon parado
- Docker não instalado
- Permissões incorretas

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Verificar status
systemctl status docker

# 2. Iniciar Docker
systemctl start docker

# 3. Habilitar auto-start
systemctl enable docker

# 4. Verificar
docker ps
docker info

# Se Docker não está instalado:
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### Erro: "Health check failed after 30 attempts"

**Sintoma:**
```
::error::Health check failed after 30 attempts
Backend logs (last 50 lines):
[logs do container]
```

**Causa:**
- Backend não inicializa corretamente
- Erro na aplicação Node.js
- Banco de dados não conecta
- Porta 3001 não responde

**Solução:**

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Ver logs completos
docker logs crm-backend --tail 200

# 2. Verificar status do container
docker ps -a | grep crm-backend

# 3. Verificar health
docker inspect crm-backend | grep -A 10 Health

# 4. Testar health endpoint diretamente
docker exec crm-backend curl http://localhost:3001/api/health

# 5. Verificar conectividade com PostgreSQL
docker exec crm-backend node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.\$connect().then(() => console.log('DB OK')).catch(e => console.error('DB ERROR:', e));"

# 6. Verificar conectividade com Redis
docker exec crm-backend node -e "const Redis = require('ioredis'); const r = new Redis({host: 'redis'}); r.ping().then(() => console.log('Redis OK')).catch(e => console.error('Redis ERROR:', e));"

# 7. Restart completo
docker compose -f docker-compose.production.yml restart postgres redis
sleep 10
docker compose -f docker-compose.production.yml restart backend

# 8. Se nada funcionar, rebuild
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build
```

### Erro: "Failed to run migrations"

**Sintoma:**
```
::error::Failed to run migrations
```

**Causa:**
- PostgreSQL não está pronto
- Migration com erro SQL
- Permissões de banco de dados

**Solução:**

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Verificar PostgreSQL
docker logs crm-postgres --tail 50
docker exec crm-postgres pg_isready -U crm_user

# 2. Testar conexão
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT NOW();"

# 3. Ver status das migrations
docker exec crm-backend npx prisma migrate status

# 4. Aplicar migrations manualmente
docker exec crm-backend npx prisma migrate deploy

# 5. Se migration específica falha, ver logs
docker exec crm-backend npx prisma migrate status --schema=./prisma/schema.prisma

# 6. Rollback de migration (último recurso)
docker exec crm-backend npx prisma migrate resolve --rolled-back 20251115000000_migration_name
```

---

## 🌐 Erros de CORS

### Erro: "No 'Access-Control-Allow-Origin' header"

**Sintoma (browser console):**
```
Access to XMLHttpRequest at 'https://api.botreserva.com.br/auth/login'
from origin 'https://www.botreserva.com.br' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Causa:**
- Origem não está em `FRONTEND_URL`
- `.env` não atualizado
- Container não foi recriado após mudar `.env`

**Solução:**

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Verificar FRONTEND_URL atual
cat .env | grep FRONTEND_URL

# 2. Ver o que está no container
docker exec crm-backend printenv FRONTEND_URL

# 3. Atualizar .env (NÃO .env.production)
# Múltiplas URLs separadas por vírgula
vim .env
# Adicionar: FRONTEND_URL=https://url1,https://url2,https://url3

# Ou usar sed:
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://projeto-eva-frontend.vercel.app,https://www.botreserva.com.br,https://botreserva.com.br|" .env

# 4. CRÍTICO: Usar --force-recreate (não apenas restart)
docker compose -f docker-compose.production.yml up -d --force-recreate backend

# 5. Verificar se atualizou
docker exec crm-backend printenv FRONTEND_URL
# Deve exibir: https://projeto-eva-frontend.vercel.app,https://www.botreserva.com.br,https://botreserva.com.br

# 6. Testar CORS
curl -I -X OPTIONS "https://api.botreserva.com.br/auth/login" \
  -H "Origin: https://www.botreserva.com.br" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"

# Resposta esperada:
# HTTP/2 204
# access-control-allow-origin: https://www.botreserva.com.br
# access-control-allow-credentials: true
```

**Documentação:** Ver `docs/CORS-FIX-2025-11-15.md` para detalhes completos.

### Erro: CORS funciona em uma origem mas não em outra

**Sintoma:**
- `https://www.botreserva.com.br` funciona
- `https://botreserva.com.br` (sem www) não funciona

**Causa:**
- Faltou adicionar a origem sem www

**Solução:**

```bash
# Verificar FRONTEND_URL
docker exec crm-backend printenv FRONTEND_URL

# Deve ter TODAS as variações:
# - https://botreserva.com.br (sem www)
# - https://www.botreserva.com.br (com www)
# - https://projeto-eva-frontend.vercel.app (Vercel)

# Atualizar se necessário
ssh root@72.61.39.235
cd /root/deploy-backend
vim .env
# Adicionar todas as URLs separadas por vírgula (SEM espaços extras)

docker compose -f docker-compose.production.yml up -d --force-recreate backend
```

---

## 🔐 Erros de Autenticação

### Erro: "Email ou senha inválidos"

**Sintoma (API response):**
```json
{
  "error": "Email ou senha inválidos"
}
```

**Causa:**
- Senha incorreta
- Usuário não existe para esse tenant
- Hash bcrypt corrompido

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Verificar se usuário existe
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "SELECT id, email, role, \"tenantId\" FROM users WHERE email = 'admin@example.com';"

# Se não retornar nada, usuário não existe

# 2. Criar novo usuário admin (se não existir)
docker exec crm-backend node -e "
const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createAdmin() {
  const password = await bcrypt.hash('Admin123!Change', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: password,
      name: 'Admin',
      role: 'SUPER_ADMIN',
      tenantId: null
    }
  });
  console.log('User created:', user.id);
}

createAdmin().catch(console.error).finally(() => prisma.\$disconnect());
"

# 3. Resetar senha de usuário existente
docker exec crm-backend node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('NovaSenha123!', 10).then(hash => {
  console.log('Hash:', hash);
  console.log('Use este hash no UPDATE abaixo');
});
"

# Copiar o hash e usar no UPDATE:
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "UPDATE users SET password = '\$2b\$10\$HASH_AQUI' WHERE email = 'admin@example.com';"

# 4. Testar login via curl
curl -X POST https://api.botreserva.com.br/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: super-admin" \
  -d '{"email":"admin@example.com","password":"Admin123!Change"}' \
  -v
```

### Erro: Frontend dá erro e recarrega página (Vercel)

**Sintoma (Console do navegador):**
```
Fetch failed loading: GET "https://www.botreserva.com.br/.well-known/vercel/jwe"
Fetch failed loading: HEAD "https://www.botreserva.com.br/login"
```

**Quando acontece:**
- Usuário tenta fazer login
- Página recarrega rapidamente sem mostrar mensagem de erro
- Erros aparecem no console do navegador (F12)

**Causa possível:**
1. Domínio customizado `www.botreserva.com.br` não configurado corretamente na Vercel
2. Recursos da Vercel (`.well-known/vercel/jwe`) não acessíveis
3. Configuração de roteamento do Next.js pode estar faltando

**Solução (A INVESTIGAR):**

```bash
# 1. Verificar configuração do domínio na Vercel
# Acessar: https://vercel.com/[seu-projeto]/settings/domains
# Confirmar:
# - www.botreserva.com.br está adicionado
# - SSL está ativo
# - DNS está configurado (CNAME para cname.vercel-dns.com)

# 2. Verificar se o domínio está respondendo
curl -I https://www.botreserva.com.br

# 3. Testar login diretamente pelo domínio Vercel
# Acessar: https://projeto-eva-frontend.vercel.app
# Tentar fazer login

# 4. Se funcionar no domínio Vercel mas não no customizado:
# - Remover e re-adicionar domínio na Vercel
# - Aguardar propagação DNS (5-15 minutos)
# - Limpar cache do navegador (Ctrl+Shift+Del)

# 5. Verificar logs de build na Vercel
# https://vercel.com/[seu-projeto]/deployments
```

**Status:** ⚠️ **PENDENTE INVESTIGAÇÃO** (documentado em 15/11/2025)

**Próximos passos:**
1. Testar login pelo domínio Vercel direto
2. Se funcionar, problema é DNS/configuração de domínio
3. Se não funcionar, problema é no código/backend
4. Verificar logs do backend durante tentativa de login
5. Adicionar console.log no frontend para capturar erro completo

---

### Erro: "Unauthorized" ou "Invalid token"

**Sintoma:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

**Causa:**
- Token JWT expirado
- Token malformado
- Secret JWT mudou

**Solução:**

```bash
# 1. Fazer login novamente para obter novo token
curl -X POST https://api.botreserva.com.br/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: tenant-slug" \
  -d '{"email":"seu@email.com","password":"suasenha"}'

# 2. Usar o token retornado no campo "access_token"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 3. Testar endpoint protegido
curl https://api.botreserva.com.br/api/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Slug: tenant-slug"

# 4. Se continuar dando erro, verificar JWT_SECRET
ssh root@72.61.39.235
cd /root/deploy-backend
cat .env | grep JWT_SECRET
# Deve ter pelo menos 32 caracteres

# 5. Se JWT_SECRET mudou recentemente, todos os tokens antigos são inválidos
# Usuários precisam fazer login novamente
```

---

## 🏢 Erros de Tenant

### Erro: "Tenant not found"

**Sintoma:**
```json
{
  "error": "Tenant not found",
  "statusCode": 401
}
```

**Causa:**
- Header `X-Tenant-Slug` não enviado
- Slug incorreto
- Tenant não existe no banco

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Ver todos os tenants no banco
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "SELECT id, slug, name, status FROM tenants;"

# 2. Verificar se slug específico existe
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "SELECT id, slug, name FROM tenants WHERE slug = 'hotel-ipanema';"

# 3. Se não existe, criar tenant
# Fazer login como SUPER_ADMIN primeiro:
TOKEN=$(curl -s -X POST https://api.botreserva.com.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@botreserva.com.br","password":"SUA_SENHA_SUPER_ADMIN"}' \
  | jq -r '.access_token')

# Criar tenant:
curl -X POST https://api.botreserva.com.br/api/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Hotel Ipanema",
    "slug": "hotel-ipanema",
    "email": "contato@hotelipanema.com",
    "adminName": "Admin",
    "adminEmail": "admin@hotelipanema.com",
    "adminPassword": "Senha123!"
  }'

# 4. Testar requisição com header correto
curl https://api.botreserva.com.br/api/conversations \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: hotel-ipanema" \
  -H "Authorization: Bearer $TOKEN"
```

### Erro: "Invalid tenant. Reserved subdomain cannot be used"

**Sintoma:**
```json
{
  "error": "Invalid tenant. Reserved subdomain cannot be used as tenant identifier."
}
```

**Causa:**
- Tentando usar subdomínio reservado como tenant
- Exemplos: www, api, admin, app, mail, ftp

**Solução:**
- ✅ **Usar header X-Tenant-Slug** ao invés de subdomínio
- ✅ Escolher slug que não seja reservado

```bash
# ❌ ERRADO - "www" é reservado
curl https://www.botreserva.com.br/api/health
# Retorna erro "Invalid tenant"

# ✅ CORRETO - Usar header
curl https://api.botreserva.com.br/api/health \
  -H "X-Tenant-Slug: hotel-ipanema"
```

**Lista de subdomínios reservados:**
- www
- api
- admin
- app
- mail
- ftp
- localhost

**Documentação:** Ver `deploy-backend/src/middlewares/tenant.middleware.ts` linha 60.

---

## 🐳 Erros de Docker

### Erro: Container reiniciando constantemente

**Sintoma:**
```bash
docker ps
# crm-backend   Restarting (1) 5 seconds ago
```

**Causa:**
- Aplicação crashando na inicialização
- Dependências (DB/Redis) não prontas
- Erro de sintaxe no código

**Solução:**

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Ver logs
docker logs crm-backend --tail 100 -f

# 2. Ver último erro antes do crash
docker logs crm-backend 2>&1 | grep -i error | tail -20

# 3. Verificar dependências
docker ps | grep -E "postgres|redis"
# Devem estar "healthy" ou "Up"

# 4. Testar PostgreSQL
docker exec crm-postgres pg_isready -U crm_user

# 5. Testar Redis
docker exec crm-redis redis-cli -a $(cat .env | grep REDIS_PASSWORD | cut -d'=' -f2) PING

# 6. Verificar health check
docker inspect crm-backend | grep -A 20 Health

# 7. Restart sequencial (DB primeiro, depois app)
docker compose -f docker-compose.production.yml restart postgres redis
sleep 10
docker compose -f docker-compose.production.yml restart backend

# 8. Se continuar crashando, rebuild
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build
```

### Erro: "Error response from daemon: conflict"

**Sintoma:**
```
Error response from daemon: Conflict. The container name "/crm-backend" is already in use
```

**Causa:**
- Container antigo ainda existe (mesmo parado)

**Solução:**

```bash
# 1. Parar e remover container
docker stop crm-backend
docker rm crm-backend

# 2. Recriar
docker compose -f docker-compose.production.yml up -d backend

# Ou forçar recriação:
docker compose -f docker-compose.production.yml up -d --force-recreate backend
```

### Erro: "No space left on device"

**Sintoma:**
```
Error: ENOSPC: no space left on device
```

**Causa:**
- Disco cheio

**Solução:**

```bash
# 1. Ver uso de disco
df -h

# 2. Limpar Docker
docker system df
docker system prune -a --volumes

# 3. Remover logs antigos
journalctl --vacuum-time=7d

# 4. Remover backups antigos
cd /root/deploy-backend/backups
ls -lh
rm -rf pre-deploy-202511*  # Exemplo

# 5. Ver o que está ocupando espaço
du -sh /* | sort -h | tail -20
```

---

## 💾 Erros de Banco de Dados

### Erro: "Connection timeout" ou "ECONNREFUSED"

**Sintoma (logs):**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causa:**
- PostgreSQL não está rodando
- Firewall bloqueando porta
- DATABASE_URL incorreto

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Verificar se PostgreSQL está rodando
docker ps | grep postgres

# 2. Ver logs do PostgreSQL
docker logs crm-postgres --tail 50

# 3. Testar conexão
docker exec crm-postgres pg_isready -U crm_user

# 4. Verificar DATABASE_URL
docker exec crm-backend printenv DATABASE_URL
# Formato correto: postgresql://crm_user:PASSWORD@postgres:5432/crm_whatsapp_saas

# 5. Testar query manual
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT NOW();"

# 6. Restart PostgreSQL
cd /root/deploy-backend
docker compose -f docker-compose.production.yml restart postgres

# 7. Aguardar ficar pronto
sleep 5
docker exec crm-postgres pg_isready -U crm_user

# 8. Restart backend
docker compose -f docker-compose.production.yml restart backend
```

### Erro: "relation does not exist"

**Sintoma:**
```
Error: relation "users" does not exist
```

**Causa:**
- Migrations não foram executadas
- Banco de dados vazio

**Solução:**

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Ver status das migrations
docker exec crm-backend npx prisma migrate status

# 2. Aplicar migrations pendentes
docker exec crm-backend npx prisma migrate deploy

# 3. Verificar tabelas criadas
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "\dt"

# 4. Se não houver tabelas, resetar banco (CUIDADO!)
docker exec crm-backend npx prisma migrate reset --skip-seed
docker exec crm-backend npx prisma migrate deploy

# 5. Ver estrutura da tabela
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "\d users"
```

---

## 🔨 Erros de Build/TypeScript

### Erro: TypeScript compilation errors

**Sintoma (CI/CD logs):**
```
error TS2322: Type 'string | undefined' is not assignable to type 'string'
```

**Causa:**
- Erros de tipo no código TypeScript
- Type assertions faltando

**Solução:**

```bash
# 1. Build local primeiro
cd deploy-backend
npm install
npm run build

# 2. Ver erros TypeScript
npx tsc --noEmit

# 3. Corrigir erros no código
# Exemplo: Adicionar type assertion
# ANTES:
const tenantId = req.tenantId;

# DEPOIS:
const tenantId = req.tenantId as string;

# 4. Commit e push
git add .
git commit -m "fix: TypeScript errors - add type assertions"
git push

# Deploy automático vai rodar
```

### Erro: "Cannot find module '@/...'"

**Sintoma:**
```
Error: Cannot find module '@/config/database'
```

**Causa:**
- Path aliases não resolvidos
- `tsc-alias` não executado

**Solução:**

```bash
# 1. Verificar tsconfig.json
cat deploy-backend/tsconfig.json
# Deve ter:
# "baseUrl": "./src",
# "paths": {
#   "@/*": ["./*"]
# }

# 2. Verificar build script
cat deploy-backend/package.json
# Deve ter:
# "build": "tsc -p tsconfig.production.json && tsc-alias -p tsconfig.production.json"

# 3. Instalar tsc-alias se não estiver
cd deploy-backend
npm install --save-dev tsc-alias

# 4. Rebuild
npm run build

# 5. Verificar dist/ gerado
ls -la dist/
cat dist/config/database.js  # Paths devem estar resolvidos
```

---

## ⏱️ Erros de Rate Limiting

### Erro: "Too many login attempts"

**Sintoma:**
```
HTTP 429 Too Many Requests
{
  "error": "Too many login attempts, please try again later."
}
```

**Causa:**
- Rate limit atingido (padrão: 100 req/15min)
- IP bloqueado temporariamente

**Solução (para usuário):**
```
Aguardar 15 minutos e tentar novamente
```

**Solução (para admin - aumentar limite):**

```bash
ssh root@72.61.39.235

# 1. Ver configuração atual
docker exec crm-backend cat src/middlewares/rate-limit.middleware.ts | grep -A 5 "loginLimiter"

# 2. Editar código (se necessário aumentar limite)
vim deploy-backend/src/middlewares/rate-limit.middleware.ts

# Alterar:
max: 100,  // Para 200 ou mais

# 3. Commit, push e deploy
git add .
git commit -m "fix: aumentar rate limit para 200 req/15min"
git push

# 4. Limpar rate limit de um IP específico (temporário)
docker exec crm-redis redis-cli -a $(cat /root/deploy-backend/.env | grep REDIS_PASSWORD | cut -d'=' -f2) \
  KEYS "*rate-limit*" | xargs docker exec crm-redis redis-cli -a PASSWORD DEL
```

**Documentação:** Ver commit `ee38b3f` para fix aplicado.

---

## 🌐 Erros de Nginx

### Erro: "502 Bad Gateway"

**Sintoma (browser):**
```
502 Bad Gateway
nginx/1.24.0
```

**Causa:**
- Backend não está respondendo
- Backend crashou
- Porta 3001 não acessível

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Verificar backend
docker ps | grep crm-backend
docker logs crm-backend --tail 50

# 2. Testar backend diretamente
docker exec crm-backend curl http://localhost:3001/api/health

# 3. Verificar Nginx config
docker exec crm-nginx nginx -t

# 4. Ver logs Nginx
docker logs crm-nginx --tail 50

# 5. Restart backend
cd /root/deploy-backend
docker compose -f docker-compose.production.yml restart backend

# 6. Restart Nginx
docker compose -f docker-compose.production.yml restart nginx

# 7. Testar novamente
curl https://api.botreserva.com.br/api/health
```

### Erro: "504 Gateway Timeout"

**Sintoma:**
```
504 Gateway Timeout
```

**Causa:**
- Requisição demorou mais de 60s (timeout padrão do Nginx)

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Ver logs do backend (o que está travando?)
docker logs crm-backend --tail 100

# 2. Aumentar timeout do Nginx (se necessário)
vim /root/deploy-backend/nginx/conf.d/api.conf

# Adicionar/aumentar:
proxy_read_timeout 120s;
proxy_connect_timeout 120s;
proxy_send_timeout 120s;

# 3. Recarregar Nginx
docker exec crm-nginx nginx -s reload

# Ou restart:
docker compose -f docker-compose.production.yml restart nginx
```

---

## 🚀 Problemas de Performance

### Problema: API lenta

**Sintoma:**
- Requisições demorando mais de 2s

**Investigação:**

```bash
ssh root@72.61.39.235

# 1. Ver uso de CPU/Memória
docker stats --no-stream

# 2. Ver queries lentas no banco
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# 3. Ver logs do backend para slow queries
docker logs crm-backend 2>&1 | grep -i "slow"

# 4. Verificar se Redis está sendo usado
docker exec crm-redis redis-cli -a PASSWORD INFO stats
# Ver: keyspace_hits e keyspace_misses
```

**Soluções:**

```bash
# 1. Adicionar indexes no banco
# Ver schema.prisma e adicionar @@index

# 2. Implementar cache Redis
# Ver src/config/redis.ts

# 3. Aumentar resources do container
vim /root/deploy-backend/docker-compose.production.yml

# Adicionar em backend:
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G

# Restart:
docker compose -f docker-compose.production.yml up -d backend
```

### Problema: Banco de dados lento

**Sintoma:**
- Queries demorando muito

**Solução:**

```bash
ssh root@72.61.39.235

# 1. Analisar queries
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "EXPLAIN ANALYZE SELECT * FROM conversations WHERE \"tenantId\" = 'uuid-here';"

# 2. Ver tabelas sem index
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c \
  "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public';"

# 3. Vacuum/Analyze
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "VACUUM ANALYZE;"

# 4. Aumentar memória do PostgreSQL
vim /root/deploy-backend/docker-compose.production.yml

# Adicionar em postgres:
command: postgres -c shared_buffers=256MB -c max_connections=100

# Restart:
docker compose -f docker-compose.production.yml restart postgres
```

---

## 📞 Suporte

### Logs Úteis

```bash
# Todos os logs
docker compose -f docker-compose.production.yml logs -f

# Apenas backend
docker logs crm-backend -f

# Apenas erros
docker logs crm-backend 2>&1 | grep -i error

# Últimas 100 linhas
docker logs crm-backend --tail 100
```

### Comandos de Diagnóstico

```bash
# Status de todos os containers
docker ps -a

# Health de todos
docker ps --format "table {{.Names}}\t{{.Status}}"

# Uso de recursos
docker stats --no-stream

# Espaço em disco
df -h
docker system df

# Conectividade
curl -I https://api.botreserva.com.br/api/health
```

---

## 📚 Documentos Relacionados

- [DEPLOY-PRODUCTION.md](./DEPLOY-PRODUCTION.md) - Guia de deploy
- [CORS-FIX-2025-11-15.md](./CORS-FIX-2025-11-15.md) - Fix CORS
- [DOCUMENTACAO-COMPLETA.md](./DOCUMENTACAO-COMPLETA.md) - Documentação técnica
- [GUIA-META-WHATSAPP-API.md](./GUIA-META-WHATSAPP-API.md) - WhatsApp

---

**Última atualização:** 15/11/2025
**Commits relacionados:**
- `ee38b3f` - Rate limiting fix
- `88ac470` - Tenant middleware (www)
- `3fc0216` - CORS múltiplas origens
- `bd04c30` - Ping check opcional
- `9650645` - Docker Compose v2
- `ed5757b` - SSH key format fix
