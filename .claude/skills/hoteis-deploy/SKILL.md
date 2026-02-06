---
name: hoteis-deploy
description: Configurar CI/CD e Docker para o CRM Hoteis Reserva
version: 1.0.0
author: Hoteis Reserva Team
---

# Skill: Deploy CRM Hoteis Reserva

Esta skill configura deploy automatizado para o CRM de Hoteis.

## Arquitetura Atual

```
Frontend (Vercel) <---> Backend/API (VPS Docker)
hoteisreserva.com.br    72.61.39.235
apps/frontend/          deploy-backend/
```

---

## CI/CD Configurado

### Backend (VPS)
- **Workflow:** Push para main trigger deploy automatico
- **VPS IP:** 72.61.39.235
- **VPS Path:** `/root/deploy-backend`
- **Containers:** crm-nginx, crm-backend, crm-postgres, crm-redis

### Frontend (Vercel)
- **Deploy automatico** via integracao GitHub
- **Root Directory:** `apps/frontend`
- **Build Command:** `pnpm build`

---

## Variaveis de Ambiente

### Vercel (Frontend)
```
NEXT_PUBLIC_API_URL=https://api.hoteisreserva.com.br
NEXTAUTH_SECRET=[secret]
NEXTAUTH_URL=https://hoteisreserva.com.br
```

### VPS (Backend) - .env
```
DATABASE_URL=postgresql://[user]:[password]@crm-postgres:5432/crm_production
REDIS_URL=redis://crm-redis:6379
JWT_SECRET=[secret]
JWT_REFRESH_SECRET=[secret]
ENCRYPTION_KEY=[key]
WHATSAPP_VERIFY_TOKEN=[token]
```

---

## Comandos de Deploy

### Deploy Manual Backend (VPS)
```bash
# SSH na VPS
ssh root@72.61.39.235

# Atualizar codigo
cd /root/deploy-backend
git pull origin main
pnpm install
pnpm prisma:generate
pnpm prisma migrate deploy
pnpm build

# Reiniciar container
docker-compose -f docker-compose.production.yml up -d --build
```

### Verificar Logs
```bash
# VPS
docker logs -f crm-backend

# Status dos containers
docker-compose -f docker-compose.production.yml ps
```

### Acessar Banco de Dados
```bash
docker exec -it crm-postgres psql -U postgres -d crm_production
```

---

## Erros Comuns e Solucoes

### 1. Prisma Migration em Producao
**NUNCA usar:** `prisma migrate dev`
**SEMPRE usar:** `prisma migrate deploy`

### 2. Build TypeScript Falhando
```bash
# Verificar erros
npx tsc --noEmit
```

### 3. Container Nao Inicia
```bash
# Verificar logs
docker logs crm-backend --tail 100

# Reconstruir
docker-compose -f docker-compose.production.yml build --no-cache
```

---

## Checklist Pre-Deploy

### Frontend (Vercel)
- [ ] `pnpm build` passa localmente
- [ ] `npx tsc --noEmit` sem erros
- [ ] Variaveis configuradas na Vercel

### Backend (VPS)
- [ ] Migrations testadas em staging
- [ ] `.env` com todas variaveis
- [ ] Containers saudaveis

---

## Quando Usar

Use `/hoteis-deploy` quando precisar:
- Debugar problemas de deploy
- Verificar status do CI/CD
- Configurar novo ambiente
- Atualizar variaveis de ambiente
- Verificar logs de producao
