# 🚀 Deploy do Backend na VPS com Docker

Guia completo para fazer deploy do backend com PostgreSQL, Redis e Nginx na sua VPS.

## 📋 Pré-requisitos

- ✅ VPS com Ubuntu 20.04+ ou Debian 11+
- ✅ Docker e Docker Compose instalados
- ✅ Domínio configurado (ex: api.seudominio.com)
- ✅ Acesso SSH à VPS
- ✅ Git instalado na VPS

---

## 🎯 Arquitetura do Deploy

```
┌─────────────────────────────────────────┐
│            Internet                      │
└──────────────┬──────────────────────────┘
               │
        ┌──────▼──────┐
        │   Nginx     │ (Port 80/443)
        │  + SSL      │
        └──────┬──────┘
               │
        ┌──────▼──────┐
        │   Backend   │ (Port 3001)
        │   Node.js   │
        └──┬───────┬──┘
           │       │
     ┌─────▼─┐  ┌─▼────┐
     │ PostgreSQL│ Redis │
     │  (DB)   │ (Cache)│
     └─────────┘  └──────┘
```

---

## 🔧 Parte 1: Preparar a VPS

### 1.1 Conectar via SSH

```bash
ssh root@seu-ip-vps
# ou
ssh usuario@seu-ip-vps
```

### 1.2 Atualizar sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Verificar instalação
docker --version
docker-compose --version
```

### 1.4 Instalar Git

```bash
sudo apt install git -y
git --version
```

### 1.5 Configurar Firewall (UFW)

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status
```

---

## 📦 Parte 2: Clonar o Projeto

### 2.1 Criar diretório para aplicação

```bash
mkdir -p /opt/crm-whatsapp
cd /opt/crm-whatsapp
```

### 2.2 Clonar repositório

```bash
git clone https://github.com/fredcast/projeto-eva.git .
```

### 2.3 Verificar arquivos

```bash
ls -la
# Deve mostrar: apps/, infra/, docker-compose.production.yml, etc.
```

---

## 🔐 Parte 3: Configurar Variáveis de Ambiente

### 3.1 Copiar template

```bash
cp .env.production.example .env.production
```

### 3.2 Gerar secrets seguros

```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Gerar JWT_REFRESH_SECRET
openssl rand -base64 32

# Gerar POSTGRES_PASSWORD
openssl rand -base64 24

# Gerar REDIS_PASSWORD
openssl rand -base64 24

# Gerar WHATSAPP_WEBHOOK_VERIFY_TOKEN
openssl rand -base64 32
```

### 3.3 Editar .env.production

```bash
nano .env.production
```

**Preencha com seus valores:**

```env
# DATABASE
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=cole_aqui_o_password_gerado
POSTGRES_DB=crm_whatsapp_saas

# REDIS
REDIS_PASSWORD=cole_aqui_o_redis_password

# JWT
JWT_SECRET=cole_aqui_o_jwt_secret
JWT_REFRESH_SECRET=cole_aqui_o_refresh_secret

# APPLICATION
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://seu-frontend.vercel.app
BASE_DOMAIN=api.seudominio.com

# WHATSAPP
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=cole_aqui_o_webhook_token

# N8N (opcional)
N8N_API_KEY=sua_chave_n8n

# SUPER ADMIN
SUPER_ADMIN_EMAIL=admin@seudominio.com
SUPER_ADMIN_PASSWORD=senha_forte_admin
```

Salvar: `Ctrl + O`, Enter, `Ctrl + X`

---

## 🌐 Parte 4: Configurar DNS do Domínio

No seu provedor de domínio (Registro.br, Cloudflare, etc):

### Criar registro A:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | api | IP_DA_VPS | 300 |

Exemplo: `api.seudominio.com` → `123.456.789.10`

**Aguarde 5-15 minutos para propagação DNS**

### Verificar DNS:

```bash
nslookup api.seudominio.com
# Deve retornar o IP da sua VPS
```

---

## 🚀 Parte 5: Deploy Inicial (HTTP)

### 5.1 Atualizar domínio no nginx

```bash
nano infra/nginx/conf.d/api.conf
```

Altere todas as ocorrências de:
- `api.seudominio.com` → **seu domínio real**

### 5.2 Dar permissão aos scripts

```bash
chmod +x infra/scripts/*.sh
```

### 5.3 Build e start dos containers

```bash
docker-compose -f docker-compose.production.yml up -d --build
```

### 5.4 Verificar containers

```bash
docker-compose -f docker-compose.production.yml ps
```

Todos devem estar **Up** e **healthy**.

### 5.5 Ver logs

```bash
# Todos os logs
docker-compose -f docker-compose.production.yml logs -f

# Apenas backend
docker-compose -f docker-compose.production.yml logs -f backend

# Apenas postgres
docker-compose -f docker-compose.production.yml logs -f postgres
```

### 5.6 Executar migrations

```bash
docker-compose -f docker-compose.production.yml exec backend sh -c "cd /app && npx prisma migrate deploy"
```

### 5.7 Criar seed (super admin)

```bash
docker-compose -f docker-compose.production.yml exec backend sh -c "cd /app && npx prisma db seed"
```

### 5.8 Testar API

```bash
curl http://api.seudominio.com/health
# Deve retornar: {"status":"ok"}
```

---

## 🔐 Parte 6: Configurar SSL (HTTPS)

### 6.1 Executar script de SSL

```bash
./infra/scripts/setup-ssl.sh
```

Siga as instruções:
1. Digite seu domínio: `api.seudominio.com`
2. Digite seu email: `seuemail@dominio.com`
3. Confirme com `yes`

### 6.2 Verificar certificado

```bash
ls -la infra/certbot/conf/live/api.seudominio.com/
```

Deve mostrar:
- `fullchain.pem`
- `privkey.pem`

### 6.3 Testar HTTPS

```bash
curl https://api.seudominio.com/health
# Deve retornar: {"status":"ok"}
```

---

## 🔄 Parte 7: Atualizações Futuras

### 7.1 Deploy automático

```bash
./infra/scripts/deploy.sh
```

Este script:
1. Puxa código do GitHub
2. Rebuilda imagens Docker
3. Para containers antigos
4. Inicia novos containers
5. Roda migrations

### 7.2 Deploy manual

```bash
# Pull código
git pull origin master

# Rebuild e restart
docker-compose -f docker-compose.production.yml up -d --build

# Migrations
docker-compose -f docker-compose.production.yml exec backend sh -c "cd /app && npx prisma migrate deploy"
```

---

## 💾 Parte 8: Backups

### 8.1 Backup manual

```bash
./infra/scripts/backup.sh
```

Backups salvos em: `backups/postgres/`

### 8.2 Backup automático (cron)

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diário às 3h da manhã)
0 3 * * * cd /opt/crm-whatsapp && ./infra/scripts/backup.sh >> /var/log/crm-backup.log 2>&1
```

### 8.3 Restaurar backup

```bash
./infra/scripts/restore.sh backup_20240101_120000.sql.gz
```

---

## 📊 Parte 9: Monitoramento

### 9.1 Ver status dos containers

```bash
docker-compose -f docker-compose.production.yml ps
```

### 9.2 Ver logs em tempo real

```bash
docker-compose -f docker-compose.production.yml logs -f backend
```

### 9.3 Ver uso de recursos

```bash
docker stats
```

### 9.4 Health check da API

```bash
curl https://api.seudominio.com/health
```

---

## 🔧 Parte 10: Atualizar Vercel

Após backend online, atualize as variáveis no Vercel:

1. Vá em **Settings** → **Environment Variables**
2. Atualize:
   ```
   NEXT_PUBLIC_API_URL = https://api.seudominio.com
   NEXT_PUBLIC_WS_URL = https://api.seudominio.com
   ```
3. **Redeploy** o frontend

---

## 🐛 Troubleshooting

### Container não inicia

```bash
docker-compose -f docker-compose.production.yml logs <service-name>
```

### Erro de migração

```bash
# Resetar banco (CUIDADO: apaga dados!)
docker-compose -f docker-compose.production.yml exec postgres psql -U crm_user -d crm_whatsapp_saas -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Rodar migrations novamente
docker-compose -f docker-compose.production.yml exec backend sh -c "cd /app && npx prisma migrate deploy"
```

### SSL não funciona

1. Verifique DNS: `nslookup api.seudominio.com`
2. Verifique firewall: `sudo ufw status`
3. Verifique logs nginx: `docker-compose -f docker-compose.production.yml logs nginx`

### Backend não conecta ao banco

```bash
# Verificar se postgres está healthy
docker-compose -f docker-compose.production.yml ps

# Testar conexão
docker-compose -f docker-compose.production.yml exec postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT 1;"
```

---

## 📝 Comandos Úteis

```bash
# Parar tudo
docker-compose -f docker-compose.production.yml down

# Restart serviço específico
docker-compose -f docker-compose.production.yml restart backend

# Ver logs
docker-compose -f docker-compose.production.yml logs -f

# Executar comando no container
docker-compose -f docker-compose.production.yml exec backend sh

# Limpar volumes (CUIDADO: apaga dados!)
docker-compose -f docker-compose.production.yml down -v
```

---

## ✅ Checklist Final

- [ ] VPS preparada e atualizada
- [ ] Docker e Docker Compose instalados
- [ ] Repositório clonado
- [ ] .env.production configurado com secrets
- [ ] DNS configurado (api.seudominio.com → IP VPS)
- [ ] Containers rodando e healthy
- [ ] Migrations executadas
- [ ] Super admin criado (seed)
- [ ] SSL configurado e funcionando
- [ ] API acessível via HTTPS
- [ ] Backup configurado
- [ ] Variáveis do Vercel atualizadas
- [ ] Frontend conectando com backend

---

## 🎉 Conclusão

Se tudo estiver ✅, seu backend está no ar!

- 🌐 **API**: https://api.seudominio.com
- 🗄️ **PostgreSQL**: Rodando internamente
- 📦 **Redis**: Rodando internamente
- 🔐 **SSL**: Certificado válido
- 💾 **Backups**: Automáticos

**Próximos passos:**
1. Testar login no frontend
2. Criar primeiro tenant
3. Configurar WhatsApp Business API
4. Monitorar logs e performance

---

**✅ Deploy completo!** 🚀
