# 🚀 GUIA DE DEPLOY

## Deploy Completo para Produção

---

## 📋 PRÉ-REQUISITOS

### **VPS/Servidor:**
- Ubuntu 22.04 LTS ou superior
- Mínimo 2 GB RAM
- 20 GB de espaço em disco
- Acesso root via SSH

### **Local (Desenvolvimento):**
- Git instalado
- SSH configurado
- Node.js 20+ (para testar localmente)

---

## 🎯 OPÇÕES DE DEPLOY

### **Opção 1: Deploy Automático (Recomendado)**

Use o script de deploy automático:

**Windows (PowerShell):**
```powershell
.\deploy.ps1
```

**Linux/Mac:**
```bash
bash deploy.sh
```

O script faz automaticamente:
1. Commit e push das mudanças locais
2. Pull do código na VPS
3. Instalação de dependências
4. Build do projeto
5. Migrations do banco
6. Restart dos containers

---

### **Opção 2: Deploy Manual**

#### **1. Configurar VPS (Primeira vez)**

```bash
# SSH na VPS
ssh root@YOUR_VPS_IP

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Instalar Git
apt install git -y

# Gerar SSH Key para GitHub
ssh-keygen -t ed25519 -C "vps-deploy@projeto"
cat ~/.ssh/id_ed25519.pub
# Copiar a chave e adicionar no GitHub como Deploy Key
```

#### **2. Clonar Repositório**

```bash
# Na VPS
cd /root
git clone git@github.com:seu-usuario/seu-repo.git deploy-backend
cd deploy-backend
```

#### **3. Configurar Variáveis de Ambiente**

```bash
# Criar .env.production
nano .env.production
```

Adicione:
```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

DATABASE_URL="postgresql://postgres:SUA_SENHA_FORTE@postgres:5432/crm_production?schema=public"

DB_NAME=crm_production
DB_PASSWORD=SUA_SENHA_FORTE

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=SUA_SENHA_REDIS

JWT_SECRET=sua-chave-super-secreta-minimo-32-caracteres
JWT_EXPIRES_IN=7d

CORS_ORIGIN=https://seu-frontend.com

LOG_LEVEL=info
```

#### **4. Build e Deploy**

```bash
# Instalar dependências
npm install

# Gerar Prisma Client
npx prisma generate

# Build
npm run build

# Subir containers
docker-compose -f docker-compose.production.yml up -d

# Aplicar migrations
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy

# Ver logs
docker-compose -f docker-compose.production.yml logs -f backend
```

#### **5. Configurar Nginx e SSL**

```bash
# Instalar Certbot
apt install certbot python3-certbot-nginx -y

# Obter certificado SSL
certbot --nginx -d api.seudominio.com

# Configurar renovação automática
certbot renew --dry-run
```

---

## 🔄 ATUALIZAR CÓDIGO (Deploy de Mudanças)

### **Método Automático:**
```bash
# No seu computador
./deploy.ps1  # Windows
bash deploy.sh  # Linux/Mac
```

### **Método Manual:**

```bash
# SSH na VPS
ssh root@YOUR_VPS_IP

cd /root/deploy-backend

# Pull código novo
git pull origin master

# Instalar novas dependências (se houver)
npm install

# Build
npm run build

# Migrations (se houver)
npx prisma migrate deploy

# Rebuild container
docker-compose -f docker-compose.production.yml build backend

# Restart
docker-compose -f docker-compose.production.yml restart backend

# Verificar logs
docker-compose -f docker-compose.production.yml logs -f backend
```

---

## ✅ VERIFICAÇÕES PÓS-DEPLOY

### **1. Health Check**
```bash
curl http://YOUR_VPS_IP/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-11-11T...",
  "uptime": 123.45
}
```

### **2. Verificar Containers**
```bash
docker ps
```

Todos devem estar com status "healthy":
- backend
- nginx
- postgres
- redis
- certbot

### **3. Verificar Logs**
```bash
# Logs do backend
docker logs crm-backend -f

# Logs do Nginx
docker logs crm-nginx -f

# Logs do PostgreSQL
docker logs crm-postgres -f
```

### **4. Testar API**
```bash
# Teste básico
curl http://YOUR_VPS_IP/api/auth/health

# Teste com HTTPS (se configurado)
curl https://api.seudominio.com/health
```

---

## 🐛 TROUBLESHOOTING

### **Container não sobe:**
```bash
# Ver logs detalhados
docker-compose -f docker-compose.production.yml logs backend

# Reconstruir do zero
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --build
```

### **Erro de conexão com banco:**
```bash
# Verificar se o PostgreSQL está rodando
docker ps | grep postgres

# Ver logs do PostgreSQL
docker logs crm-postgres

# Testar conexão
docker-compose -f docker-compose.production.yml exec backend npx prisma db push
```

### **Migrations falhando:**
```bash
# Reset migrations (CUIDADO - apaga dados!)
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate reset

# Ou aplicar manualmente
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
```

### **Erro 502 Bad Gateway:**
```bash
# Verificar se backend está respondendo
docker exec crm-backend curl http://localhost:3001/health

# Verificar configuração Nginx
docker exec crm-nginx nginx -t

# Restart Nginx
docker restart crm-nginx
```

---

## 📊 MONITORAMENTO

### **Comandos Úteis:**

```bash
# Status dos containers
docker ps

# Uso de recursos
docker stats

# Logs em tempo real
docker-compose -f docker-compose.production.yml logs -f

# Espaço em disco
df -h

# Processos
top
```

### **Health Checks Automáticos:**

Configurar no cron para verificar a cada 5 minutos:
```bash
crontab -e
```

Adicionar:
```
*/5 * * * * curl -f http://localhost/health || systemctl restart docker
```

---

## 🔐 BACKUP

### **Backup do Banco de Dados:**

```bash
# Criar backup
docker exec crm-postgres pg_dump -U postgres crm_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
cat backup_20251111_120000.sql | docker exec -i crm-postgres psql -U postgres crm_production
```

### **Backup Automático:**

Criar script em `/root/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR

# Backup do banco
docker exec crm-postgres pg_dump -U postgres crm_production | gzip > $BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

Adicionar ao cron (todo dia às 3h):
```bash
0 3 * * * /root/backup.sh
```

---

## 🎯 CHECKLIST DE DEPLOY

### **Antes do Deploy:**
- [ ] Código testado localmente
- [ ] .env.production configurado na VPS
- [ ] Backup do banco atual
- [ ] Git commit e push
- [ ] Migrations testadas

### **Durante o Deploy:**
- [ ] Pull do código
- [ ] npm install executado
- [ ] Build sem erros
- [ ] Migrations aplicadas
- [ ] Containers reconstruídos

### **Após o Deploy:**
- [ ] Health check respondendo
- [ ] Todos os containers healthy
- [ ] Logs sem erros
- [ ] API respondendo corretamente
- [ ] Banco de dados conectado
- [ ] Redis conectado
- [ ] CORS funcionando

---

## 📞 COMANDOS RÁPIDOS

```bash
# SSH na VPS
ssh root@YOUR_VPS_IP

# Status geral
docker ps && df -h

# Logs
docker logs crm-backend -f

# Restart backend
docker restart crm-backend

# Rebuild completo
cd /root/deploy-backend && \
git pull && \
npm install && \
npm run build && \
docker-compose -f docker-compose.production.yml build backend && \
docker-compose -f docker-compose.production.yml restart backend

# Health check
curl http://localhost/health
```

---

## 🌐 DEPLOY FRONTEND (Vercel)

### **1. Conectar Repositório no Vercel**

1. Acesse https://vercel.com
2. Clique em "Add New Project"
3. Selecione seu repositório
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** apps/frontend
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

### **2. Configurar Variáveis de Ambiente**

No painel da Vercel, adicione:
```
NEXT_PUBLIC_API_URL=https://api.seudominio.com
```

### **3. Deploy**

O Vercel faz deploy automático a cada push na branch master.

---

## ✅ PRONTO!

Seu backend está no ar! 🚀

**Links úteis:**
- API: http://YOUR_VPS_IP
- Health: http://YOUR_VPS_IP/health
- Logs: `ssh root@YOUR_VPS_IP "docker logs crm-backend -f"`

---

**Última atualização:** 11/11/2025
