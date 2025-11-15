# Backend Deploy Package

Este pacote contém apenas o backend para deploy na VPS.

## 📦 Estrutura

```
deploy-backend/
├── src/              # Código fonte
├── prisma/           # Database schema
├── nginx/            # Configurações Nginx
├── scripts/          # Scripts de deploy
├── docker-compose.production.yml
├── Dockerfile.standalone
└── .env.production.example
```

## 🚀 Deploy Rápido

### 1. Fazer upload para VPS

```bash
# Na sua máquina local:
tar -czf backend.tar.gz deploy-backend/
scp backend.tar.gz root@seu-ip-vps:/opt/

# Na VPS:
ssh root@seu-ip-vps
cd /opt
tar -xzf backend.tar.gz
cd deploy-backend
```

### 2. Configurar variáveis

```bash
cp .env.production.example .env.production
nano .env.production
# Preencher com seus valores
```

### 3. Deploy

```bash
# Dar permissão aos scripts
chmod +x scripts/*.sh

# Subir containers
docker-compose -f docker-compose.production.yml up -d --build

# Executar migrations
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy

# Configurar SSL
./scripts/setup-ssl.sh
```

## 📋 Comandos Úteis

```bash
# Ver logs
docker-compose -f docker-compose.production.yml logs -f backend

# Restart
docker-compose -f docker-compose.production.yml restart backend

# Backup
./scripts/backup.sh

# Stop
docker-compose -f docker-compose.production.yml down
```

---

✅ **Backend pronto para deploy!**

# CI/CD

Deploy automático configurado via GitHub Actions.


