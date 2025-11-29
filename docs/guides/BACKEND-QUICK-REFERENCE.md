# 🚀 GUIA RÁPIDO DE REFERÊNCIA

## Comandos Mais Usados

### Deploy & Build
```bash
# Build local
cd deploy-backend
pnpm install
pnpm build

# Deploy para VPS
scp -r deploy-backend/* root@72.61.39.235:/opt/

# Rebuild container backend
ssh root@72.61.39.235 "cd /opt && docker compose -f docker-compose.production.yml up -d --build backend"
```

### Docker Management
```bash
# Ver containers
docker ps

# Logs
docker logs crm-backend --tail 100 --follow
docker logs crm-postgres
docker logs crm-nginx

# Restart
docker compose -f docker-compose.production.yml restart backend
docker compose -f docker-compose.production.yml restart nginx

# Stop/Start tudo
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### Database
```bash
# Conectar ao PostgreSQL
docker exec -it crm-postgres psql -U crm_user -d crm_whatsapp_saas

# Rodar migrations
docker exec crm-backend pnpm prisma migrate deploy

# Ver tenants
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT id, slug, name, status FROM tenants;"

# Ver usuários
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT id, email, name, role FROM users;"

# Backup manual
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup_$(date +%Y%m%d).sql
```

### Redis
```bash
# Conectar ao Redis
docker exec -it crm-redis redis-cli -a $(grep REDIS_PASSWORD /opt/.env.production | cut -d'=' -f2)

# Ver keys
KEYS *

# Flush cache (⚠️ apaga tudo!)
FLUSHALL
```

### Testes de API
```bash
# Health check
curl http://72.61.39.235/health

# Login
curl -X POST http://72.61.39.235/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: smarthoteis" \
  -d '{"email":"admin@smarthoteis.com","password":"secret123"}'

# Com autenticação
TOKEN="eyJhbGc..."
curl http://72.61.39.235/api/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Slug: smarthoteis"
```

## Checklist de Deploy

- [ ] Atualizar código em `deploy-backend/`
- [ ] Testar build local: `pnpm build`
- [ ] Copiar para VPS: `scp -r deploy-backend/* root@72.61.39.235:/opt/`
- [ ] SSH na VPS: `ssh root@72.61.39.235`
- [ ] Backup do banco: `docker exec crm-postgres pg_dump...`
- [ ] Rebuild: `cd /opt && docker compose -f docker-compose.production.yml up -d --build backend`
- [ ] Verificar logs: `docker logs crm-backend --tail 50`
- [ ] Testar health: `curl http://72.61.39.235/health`
- [ ] Testar login: `curl -X POST http://72.61.39.235/auth/login...`

## Troubleshooting Rápido

### Backend não inicia
```bash
docker logs crm-backend
docker compose -f docker-compose.production.yml restart postgres redis
sleep 10
docker compose -f docker-compose.production.yml restart backend
```

### Erro de TypeScript no build
```bash
cd deploy-backend
pnpm install
pnpm build  # Se funcionar local, problema é no Docker
```

### 502 Bad Gateway
```bash
docker exec crm-backend curl http://localhost:3001/health
docker compose -f docker-compose.production.yml restart backend nginx
```

### "Tenant not found"
```bash
# Verificar tenant existe
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT slug FROM tenants;"

# Verificar middleware
docker logs crm-backend | grep "Tenant from X-Tenant-Slug"
```

### Senha inválida
```bash
# Gerar novo hash
docker exec crm-backend node -e "const bcrypt = require('bcrypt'); bcrypt.hash('secret123', 10).then(console.log);"

# Atualizar (substituir HASH_AQUI pelo output acima)
docker exec -i crm-postgres psql -U crm_user -d crm_whatsapp_saas <<EOF
UPDATE users SET password = E'\$2b\$10\$HASH_AQUI' WHERE email = 'admin@smarthoteis.com';
EOF
```

## Arquivos Importantes

| Arquivo | Localização | Descrição |
|---------|------------|-----------|
| Código fonte | `deploy-backend/src/` | TypeScript source |
| Build config | `deploy-backend/tsconfig.production.json` | Compilação TS |
| Dockerfile | `deploy-backend/Dockerfile.standalone` | Build da imagem |
| Docker Compose | `/opt/docker-compose.production.yml` | Orquestração |
| Variáveis ambiente | `/opt/.env.production` | Secrets (NÃO commitar) |
| Nginx config | `/opt/nginx/conf.d/api.conf` | Reverse proxy |
| Schema DB | `deploy-backend/prisma/schema.prisma` | Modelo de dados |
| Migrations | `deploy-backend/prisma/migrations/` | Histórico SQL |

## Diretórios

**✅ USAR:**
- `C:/Users/55489/Desktop/projeto-hoteis-reserva/deploy-backend/`
- `/opt/` (VPS)

**❌ IGNORAR:**
- `C:/Users/55489/Desktop/projeto-hoteis-reserva/packages/`
- `C:/Users/55489/Desktop/projeto-hoteis-reserva/apps/`

## Regras de Ouro

1. **SEMPRE** trabalhar em `deploy-backend/`
2. **SEMPRE** incluir `tenantId` em queries
3. **SEMPRE** usar `X-Tenant-Slug` header
4. **SEMPRE** validar com Zod
5. **SEMPRE** hashear senhas com bcrypt
6. **NUNCA** commitar `.env.production`
7. **NUNCA** fazer queries sem WHERE tenantId
8. **NUNCA** usar console.log em produção
9. **NUNCA** modificar migrations aplicadas
10. **NUNCA** dar acesso a dados de outro tenant
