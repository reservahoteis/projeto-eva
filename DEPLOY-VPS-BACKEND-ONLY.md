# 🚀 Deploy do Backend na VPS (Apenas Backend)

Guia simplificado para fazer deploy **apenas do backend** na VPS, sem precisar clonar o monorepo inteiro.

## 📋 Pré-requisitos

- ✅ VPS com Ubuntu 20.04+ ou Debian 11+
- ✅ Docker e Docker Compose instalados
- ✅ Domínio configurado (ex: api.seudominio.com)
- ✅ Acesso SSH à VPS

---

## 🎯 Visão Geral

Vamos fazer deploy **apenas do backend**, sem o frontend. O processo é:

1. **Na sua máquina local**: Preparar pacote do backend
2. **Fazer upload** do pacote para VPS
3. **Na VPS**: Extrair e fazer deploy

---

## 📦 Parte 1: Preparar Pacote do Backend (Local)

### 1.1 Na pasta do projeto

```bash
cd C:\Users\55489\Desktop\projeto-hoteis-reserva
```

### 1.2 Executar script de preparação

```bash
# No Windows (Git Bash):
bash infra/scripts/prepare-backend-deploy.sh

# Ou no Linux/Mac:
chmod +x infra/scripts/prepare-backend-deploy.sh
./infra/scripts/prepare-backend-deploy.sh
```

Este script cria:
- 📁 `deploy-backend/` - Pasta com apenas o backend
- 📦 `backend-deploy.tar.gz` - Pacote compactado (~10-20MB)

---

## 🔧 Parte 2: Preparar a VPS

### 2.1 Conectar via SSH

```bash
ssh root@seu-ip-vps
# ou
ssh usuario@seu-ip-vps
```

### 2.2 Atualizar sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.3 Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Recarregar grupos (ou fazer logout/login)
newgrp docker

# Verificar instalação
docker --version
docker-compose --version
```

### 2.4 Configurar Firewall

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status
```

---

## 📤 Parte 3: Fazer Upload do Backend

### 3.1 Na sua máquina local

```bash
# Fazer upload do pacote
scp backend-deploy.tar.gz root@seu-ip-vps:/opt/
```

Se estiver no Windows, pode usar WinSCP ou Git Bash.

---

## 🚀 Parte 4: Deploy na VPS

### 4.1 Conectar na VPS

```bash
ssh root@seu-ip-vps
```

### 4.2 Extrair pacote

```bash
cd /opt
tar -xzf backend-deploy.tar.gz
cd deploy-backend
ls -la
```

Você verá:
```
deploy-backend/
├── src/
├── prisma/
├── nginx/
├── scripts/
├── docker-compose.production.yml
├── Dockerfile.standalone
└── .env.production.example
```

### 4.3 Configurar variáveis de ambiente

```bash
# Copiar template
cp .env.production.example .env.production

# Gerar secrets seguros
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "WHATSAPP_WEBHOOK_VERIFY_TOKEN=$(openssl rand -base64 32)"
```

```bash
# Editar arquivo
nano .env.production
```

**Preencha com seus valores:**

```env
# DATABASE
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=cole_aqui_password_gerado
POSTGRES_DB=crm_whatsapp_saas

# REDIS
REDIS_PASSWORD=cole_aqui_redis_password

# JWT
JWT_SECRET=cole_aqui_jwt_secret
JWT_REFRESH_SECRET=cole_aqui_refresh_secret

# APPLICATION
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://seu-frontend.vercel.app
BASE_DOMAIN=api.seudominio.com

# WHATSAPP
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=cole_aqui_webhook_token

# N8N (opcional)
N8N_API_KEY=sua_chave_n8n

# SUPER ADMIN
SUPER_ADMIN_EMAIL=admin@seudominio.com
SUPER_ADMIN_PASSWORD=senha_forte_admin
```

Salvar: `Ctrl + O`, Enter, `Ctrl + X`

---

## 🌐 Parte 5: Configurar DNS

No seu provedor de domínio (Registro.br, Cloudflare, etc):

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | api | IP_DA_VPS | 300 |

**Aguarde 5-15 minutos para propagação**

Verificar:
```bash
nslookup api.seudominio.com
# Deve retornar o IP da VPS
```

---

## 🐳 Parte 6: Deploy com Docker

### 6.1 Atualizar domínio no nginx

```bash
nano nginx/conf.d/api.conf
```

Altere:
- `api.seudominio.com` → **seu domínio real**

Salvar e fechar.

### 6.2 Dar permissão aos scripts

```bash
chmod +x scripts/*.sh
```

### 6.3 Subir containers

```bash
docker-compose -f docker-compose.production.yml up -d --build
```

### 6.4 Verificar se subiu

```bash
docker-compose -f docker-compose.production.yml ps
```

Todos devem estar **Up** e **healthy**.

### 6.5 Ver logs

```bash
docker-compose -f docker-compose.production.yml logs -f
```

Pressione `Ctrl+C` para sair.

### 6.6 Executar migrations

```bash
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
```

### 6.7 Criar super admin (seed)

```bash
docker-compose -f docker-compose.production.yml exec backend npx prisma db seed
```

### 6.8 Testar API

```bash
curl http://api.seudominio.com/health
# Deve retornar: {"status":"ok"}
```

---

## 🔐 Parte 7: Configurar SSL (HTTPS)

### 7.1 Executar script de SSL

```bash
./scripts/setup-ssl.sh
```

Siga as instruções:
1. Digite seu domínio: `api.seudominio.com`
2. Digite seu email: `seuemail@dominio.com`
3. Confirme com `yes`

### 7.2 Testar HTTPS

```bash
curl https://api.seudominio.com/health
# Deve retornar: {"status":"ok"}
```

---

## 🔄 Parte 8: Atualizações Futuras

### Método 1: Via Git (Recomendado)

Se você clonou o repositório na VPS:

```bash
cd /opt/deploy-backend
git pull origin master
docker-compose -f docker-compose.production.yml up -d --build
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
```

### Método 2: Upload Manual

Na sua máquina:
```bash
./infra/scripts/prepare-backend-deploy.sh
scp backend-deploy.tar.gz root@seu-ip-vps:/opt/
```

Na VPS:
```bash
cd /opt
rm -rf deploy-backend
tar -xzf backend-deploy.tar.gz
cd deploy-backend
cp /opt/deploy-backend-old/.env.production ./.env.production  # Copiar .env antigo
docker-compose -f docker-compose.production.yml up -d --build
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
```

---

## 💾 Parte 9: Backups

### Backup manual

```bash
./scripts/backup.sh
```

Backups salvos em: `backups/`

### Backup automático (cron)

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diário às 3h)
0 3 * * * cd /opt/deploy-backend && ./scripts/backup.sh >> /var/log/crm-backup.log 2>&1
```

### Restaurar backup

```bash
./scripts/restore.sh backup_20240101_120000.sql.gz
```

---

## 📊 Parte 10: Monitoramento

### Ver status

```bash
docker-compose -f docker-compose.production.yml ps
```

### Ver logs

```bash
# Todos os logs
docker-compose -f docker-compose.production.yml logs -f

# Apenas backend
docker-compose -f docker-compose.production.yml logs -f backend

# Apenas postgres
docker-compose -f docker-compose.production.yml logs -f postgres
```

### Ver recursos (CPU/RAM)

```bash
docker stats
```

---

## 🔧 Parte 11: Atualizar Vercel

Após backend online, atualize o frontend:

1. Vá em **https://vercel.com** → Seu projeto
2. **Settings** → **Environment Variables**
3. Atualizar:
   ```
   NEXT_PUBLIC_API_URL = https://api.seudominio.com
   NEXT_PUBLIC_WS_URL = https://api.seudominio.com
   ```
4. **Deployments** → **Redeploy** último deploy

---

## 🐛 Troubleshooting

### Container não inicia

```bash
docker-compose -f docker-compose.production.yml logs backend
```

### Erro de conexão com banco

```bash
# Testar conexão
docker-compose -f docker-compose.production.yml exec postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT 1;"
```

### SSL não funciona

1. Verifique DNS: `nslookup api.seudominio.com`
2. Verifique firewall: `sudo ufw status`
3. Verifique logs: `docker-compose -f docker-compose.production.yml logs nginx`

### Reiniciar tudo

```bash
docker-compose -f docker-compose.production.yml restart
```

---

## 📝 Comandos Úteis

```bash
# Parar tudo
docker-compose -f docker-compose.production.yml down

# Restart serviço específico
docker-compose -f docker-compose.production.yml restart backend

# Ver logs em tempo real
docker-compose -f docker-compose.production.yml logs -f backend

# Executar comando no container
docker-compose -f docker-compose.production.yml exec backend sh

# Acessar PostgreSQL
docker-compose -f docker-compose.production.yml exec postgres psql -U crm_user -d crm_whatsapp_saas
```

---

## ✅ Checklist Final

- [ ] VPS preparada com Docker
- [ ] Pacote do backend criado
- [ ] Upload feito para VPS
- [ ] .env.production configurado
- [ ] DNS configurado (api.seudominio.com → IP)
- [ ] Containers rodando e healthy
- [ ] Migrations executadas
- [ ] Super admin criado
- [ ] SSL configurado
- [ ] API acessível via HTTPS
- [ ] Vercel atualizado
- [ ] Login funcionando no frontend

---

## 🎉 Resumo

✅ **Vantagens deste método:**
- Deploy apenas do backend (não precisa clonar monorepo)
- Pacote pequeno (~10-20MB vs projeto inteiro)
- Deploy mais rápido
- Fácil de atualizar

✅ **O que você tem:**
- PostgreSQL rodando na VPS
- Redis rodando na VPS
- Backend rodando com Node.js
- Nginx com SSL/HTTPS
- Backups automáticos

---

**Tempo estimado:** 45 minutos

**✅ Backend pronto!** 🚀
