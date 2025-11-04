# 🚀 GUIA DE DEPLOY - VPS Production

> **Como fazer deploy do CRM WhatsApp em um VPS (Virtual Private Server)**

---

## 📋 REQUISITOS DO SERVIDOR

### Especificações Mínimas

```
CPU: 2 vCPUs
RAM: 4 GB
Disco: 40 GB SSD
OS: Ubuntu 22.04 LTS
```

### Especificações Recomendadas (10 atendentes)

```
CPU: 4 vCPUs
RAM: 8 GB
Disco: 80 GB SSD
OS: Ubuntu 22.04 LTS
Backup: Diário automatizado
```

### Provedores Recomendados

- **DigitalOcean** - Droplets (simples, bom custo)
- **Linode/Akamai** - Compute Instances
- **Vultr** - Cloud Compute
- **AWS EC2** - t3.medium ou t3.large
- **Contabo** - VPS (mais barato, Europa)

---

## 🔧 PREPARAÇÃO DO SERVIDOR

### 1. Acesso Inicial

```bash
# SSH no servidor
ssh root@seu-servidor-ip

# Atualizar sistema
apt update && apt upgrade -y

# Criar usuário não-root
adduser deploy
usermod -aG sudo deploy

# Configurar SSH key
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Desabilitar login root
nano /etc/ssh/sshd_config
# Mudar: PermitRootLogin no
systemctl restart sshd

# Logout e login como deploy
exit
ssh deploy@seu-servidor-ip
```

### 2. Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar
docker --version
docker-compose --version

# Logout e login novamente para aplicar grupo
exit
ssh deploy@seu-servidor-ip
```

### 3. Instalar Dependências

```bash
# Git
sudo apt install git -y

# Nginx (reverse proxy)
sudo apt install nginx -y

# Certbot (SSL gratuito)
sudo apt install certbot python3-certbot-nginx -y

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 📦 ESTRUTURA DE DEPLOY

```
/home/deploy/
└── crm-whatsapp/              # Repositório clonado
    ├── apps/
    │   ├── backend/
    │   └── frontend/
    ├── infra/
    │   ├── docker-compose.prod.yml
    │   └── nginx/
    │       └── nginx.conf
    ├── .env.production        # Variáveis de ambiente
    └── scripts/
        ├── deploy.sh          # Script de deploy
        └── backup.sh          # Script de backup
```

---

## 🐳 DOCKER COMPOSE (Produção)

### infra/docker-compose.prod.yml

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: crm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups  # Para backups
    ports:
      - "127.0.0.1:5432:5432"  # Apenas localhost
    networks:
      - crm-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Cache + Queues)
  redis:
    image: redis:7-alpine
    container_name: crm-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - crm-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile.prod
    container_name: crm-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      WHATSAPP_PHONE_NUMBER_ID: ${WHATSAPP_PHONE_NUMBER_ID}
      WHATSAPP_ACCESS_TOKEN: ${WHATSAPP_ACCESS_TOKEN}
      WHATSAPP_APP_SECRET: ${WHATSAPP_APP_SECRET}
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: ${WHATSAPP_WEBHOOK_VERIFY_TOKEN}
      N8N_API_KEY: ${N8N_API_KEY}
      PORT: 3001
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:3001:3001"
    networks:
      - crm-network
    volumes:
      - ./logs/backend:/app/logs

  # Frontend (Next.js)
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile.prod
      args:
        NEXT_PUBLIC_API_URL: https://api.seudominio.com
        NEXT_PUBLIC_WS_URL: wss://api.seudominio.com
    container_name: crm-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: production
    depends_on:
      - backend
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - crm-network

  # Nginx (Reverse Proxy + SSL)
  nginx:
    image: nginx:alpine
    container_name: crm-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infra/nginx/sites:/etc/nginx/sites-enabled:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro  # Certificados SSL
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - crm-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  crm-network:
    driver: bridge
```

---

## 🔒 CONFIGURAÇÃO NGINX + SSL

### infra/nginx/sites/crm.conf

```nginx
# Redirecionar HTTP para HTTPS
server {
    listen 80;
    server_name seudominio.com www.seudominio.com api.seudominio.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Frontend (CRM)
server {
    listen 443 ssl http2;
    server_name seudominio.com www.seudominio.com;

    # SSL
    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.seudominio.com;

    # SSL (mesmo certificado)
    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    limit_req zone=api_limit burst=20 nodelay;

    # API
    location / {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout para WebSocket
        proxy_read_timeout 86400;
    }

    # WebSocket específico (se necessário)
    location /socket.io/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

---

## 📝 DOCKERFILES OTIMIZADOS

### apps/backend/Dockerfile.prod

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Copiar código
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copiar node_modules e build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

### apps/frontend/Dockerfile.prod

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Argumentos de build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci && npm cache clean --force

# Copiar código
COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copiar apenas o necessário
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

---

## 🚀 PROCESSO DE DEPLOY

### 1. Configurar DNS

Adicionar registros DNS:
```
A    seudominio.com          → IP_DO_SERVIDOR
A    www.seudominio.com      → IP_DO_SERVIDOR
A    api.seudominio.com      → IP_DO_SERVIDOR
```

Aguardar propagação (pode levar até 24h).

### 2. Clonar Repositório

```bash
cd /home/deploy
git clone https://github.com/seu-usuario/crm-whatsapp.git
cd crm-whatsapp
```

### 3. Configurar Variáveis de Ambiente

```bash
# Criar .env.production
nano .env.production
```

```env
# .env.production
DB_USER=crm_user
DB_PASSWORD=senha_super_segura_aqui_min_32_chars
DB_NAME=crm_whatsapp

REDIS_PASSWORD=redis_senha_segura_min_32_chars

JWT_SECRET=jwt_secret_super_seguro_min_32_chars_random
JWT_REFRESH_SECRET=jwt_refresh_outro_secret_diferente_min_32

WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAG...seu_token_aqui
WHATSAPP_APP_SECRET=abc123...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=token_webhook_verificacao

N8N_API_KEY=chave_api_para_n8n_min_32_chars
```

### 4. Obter Certificado SSL

```bash
# Parar Nginx se estiver rodando
sudo systemctl stop nginx

# Obter certificado
sudo certbot certonly --standalone -d seudominio.com -d www.seudominio.com -d api.seudominio.com

# Certificados estarão em:
# /etc/letsencrypt/live/seudominio.com/fullchain.pem
# /etc/letsencrypt/live/seudominio.com/privkey.pem

# Auto-renovação (já vem configurado no Ubuntu)
sudo certbot renew --dry-run
```

### 5. Deploy Inicial

```bash
# Build e iniciar containers
docker-compose -f infra/docker-compose.prod.yml up -d --build

# Ver logs
docker-compose -f infra/docker-compose.prod.yml logs -f

# Verificar se tudo está rodando
docker ps
```

### 6. Criar Usuário Admin

```bash
# Acessar container do backend
docker exec -it crm-backend sh

# Rodar script de seed (criar admin)
npx prisma db seed

# Ou criar manualmente via Prisma Studio
npx prisma studio
# Acesse http://SEU_IP:5555 e crie usuário
```

---

## 🔄 ATUALIZAÇÕES (CI/CD)

### Script de Deploy Automático

```bash
# scripts/deploy.sh

#!/bin/bash
set -e

echo "🚀 Iniciando deploy..."

# Pull latest code
git pull origin main

# Build e restart containers
docker-compose -f infra/docker-compose.prod.yml up -d --build

# Run migrations
docker exec crm-backend npx prisma migrate deploy

# Prune old images
docker image prune -f

echo "✅ Deploy concluído!"
```

Tornar executável:
```bash
chmod +x scripts/deploy.sh
```

### GitHub Actions (CI/CD Automático)

```yaml
# .github/workflows/deploy.yml

name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/deploy/crm-whatsapp
            ./scripts/deploy.sh
```

Adicionar secrets no GitHub:
- `VPS_HOST`: IP do servidor
- `SSH_PRIVATE_KEY`: Chave SSH privada

---

## 💾 BACKUP AUTOMÁTICO

### Script de Backup

```bash
# scripts/backup.sh

#!/bin/bash
set -e

BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec crm-postgres pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads (se houver)
# tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/deploy/crm-whatsapp/uploads

# Manter apenas últimos 7 dias
find $BACKUP_DIR -type f -mtime +7 -delete

echo "✅ Backup concluído: $DATE"
```

### Cron para Backup Diário

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diário às 3am)
0 3 * * * /home/deploy/crm-whatsapp/scripts/backup.sh >> /home/deploy/logs/backup.log 2>&1
```

---

## 📊 MONITORAMENTO

### Logs

```bash
# Ver logs de todos os serviços
docker-compose -f infra/docker-compose.prod.yml logs -f

# Ver logs específicos
docker logs -f crm-backend
docker logs -f crm-frontend
docker logs -f crm-postgres
```

### Health Checks

```bash
# Verificar saúde dos containers
docker ps

# Status do sistema
docker stats

# Uso de disco
df -h

# Memória
free -h
```

### Ferramentas Externas (Opcional)

- **Uptime Robot** - Monitoramento de uptime (gratuito)
- **Sentry** - Error tracking
- **LogTail** - Centralização de logs
- **Grafana + Prometheus** - Métricas avançadas

---

## 🔧 TROUBLESHOOTING

### Container não inicia

```bash
# Ver logs completos
docker-compose -f infra/docker-compose.prod.yml logs backend

# Reconstruir do zero
docker-compose -f infra/docker-compose.prod.yml down -v
docker-compose -f infra/docker-compose.prod.yml up -d --build
```

### Erro de conexão ao PostgreSQL

```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Verificar variáveis de ambiente
docker exec crm-backend printenv | grep DATABASE

# Testar conexão
docker exec crm-backend npx prisma db pull
```

### SSL não funciona

```bash
# Verificar certificados
sudo ls -la /etc/letsencrypt/live/seudominio.com/

# Testar Nginx config
sudo nginx -t

# Renovar certificado
sudo certbot renew
```

### Alto uso de memória

```bash
# Ver consumo
docker stats

# Limpar recursos não usados
docker system prune -a
```

---

## 🎯 CHECKLIST FINAL

- [ ] Servidor configurado e atualizado
- [ ] Docker e Docker Compose instalados
- [ ] DNS configurado e propagado
- [ ] Certificado SSL obtido
- [ ] Repositório clonado
- [ ] Variáveis de ambiente configuradas
- [ ] Containers rodando (docker ps)
- [ ] Migrations aplicadas
- [ ] Usuário admin criado
- [ ] Backup automático configurado
- [ ] Firewall configurado (ufw)
- [ ] Webhooks WhatsApp configurados apontando para https://api.seudominio.com/webhooks/whatsapp
- [ ] Testado envio de mensagem
- [ ] Testado recebimento de mensagem
- [ ] Monitoramento configurado

---

## 🌐 URLs Finais

Após deploy completo:

- **CRM Frontend:** https://seudominio.com
- **API Backend:** https://api.seudominio.com
- **Webhook WhatsApp:** https://api.seudominio.com/webhooks/whatsapp
- **API para n8n:** https://api.seudominio.com/api/n8n

---

**Sistema pronto para produção! 🎉**
