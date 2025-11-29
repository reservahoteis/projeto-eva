# GitHub Actions Deploy - Maintenance Guide

Guia de manutenção e operações para o deploy automático via GitHub Actions.

---

## Manutenção Regular

### Semanal

```bash
# Conectar ao VPS
ssh root@72.61.39.235
cd /root/deploy-backend

# 1. Verificar espaço em disco
df -h
du -sh /root/deploy-backend

# 2. Verificar logs para erros
docker-compose -f docker-compose.production.yml logs backend | grep -i error | tail -20

# 3. Verificar health dos containers
docker-compose -f docker-compose.production.yml ps

# 4. Verificar backups
ls -lth backups/ | head -10

# 5. Verificar uso de memória
docker stats --no-stream
```

### Mensal

```bash
# 1. Limpar backups antigos (mantém últimos 10)
cd /root/deploy-backend/backups
ls -t | tail -n +11 | xargs -r rm -rf

# 2. Limpar Docker cache
docker system prune -f

# 3. Verificar atualizações de imagens
docker-compose -f docker-compose.production.yml pull

# 4. Backup completo (database + arquivos)
./scripts/backup.sh  # Se existir

# OU manual:
DATE=$(date +%Y%m%d-%H%M%S)
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup-$DATE.sql
tar -czf backup-full-$DATE.tar.gz dist/ prisma/ .env.production backup-$DATE.sql

# 5. Verificar certificados SSL
openssl x509 -in /root/deploy-backend/certbot/conf/live/api.botreserva.com.br/fullchain.pem -noout -dates
```

### Trimestral

```bash
# 1. Rotação de SSH key
ssh-keygen -t ed25519 -C "github-deploy-$(date +%Y%m)" -f ~/.ssh/github_actions_deploy_new -N ""
cat ~/.ssh/github_actions_deploy_new.pub >> ~/.ssh/authorized_keys
# Atualizar VPS_SSH_KEY no GitHub
# Testar deploy
# Remover chave antiga

# 2. Atualizar senhas
# Atualizar .env.production
# Recriar containers

# 3. Revisar logs de acesso SSH
sudo journalctl -u ssh --since "3 months ago" | grep Accepted

# 4. Auditoria de segurança
sudo apt update && sudo apt upgrade -y
docker scan crm-backend  # Se disponível
```

---

## Comandos Úteis

### Logs

```bash
# Logs em tempo real
docker-compose -f docker-compose.production.yml logs -f backend

# Logs com timestamp
docker-compose -f docker-compose.production.yml logs -f -t backend

# Últimas 100 linhas
docker logs crm-backend --tail=100

# Logs de erro apenas
docker logs crm-backend 2>&1 | grep -i error

# Logs de um período específico
docker logs crm-backend --since "2025-11-15T10:00:00" --until "2025-11-15T11:00:00"

# Logs de todos containers
docker-compose -f docker-compose.production.yml logs -f

# Salvar logs em arquivo
docker logs crm-backend > backend-logs-$(date +%Y%m%d).log
```

### Status e Health

```bash
# Status de containers
docker-compose -f docker-compose.production.yml ps

# Status detalhado
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health check
docker inspect crm-backend | jq '.[0].State.Health'

# Testar endpoints
curl http://localhost:3001/health
curl https://api.botreserva.com.br/api/health

# Ver processos dentro do container
docker exec crm-backend ps aux

# Ver uso de recursos
docker stats --no-stream

# Ver uso de recursos em tempo real
docker stats
```

### Restart

```bash
# Restart apenas backend
docker-compose -f docker-compose.production.yml restart backend

# Restart todos containers
docker-compose -f docker-compose.production.yml restart

# Stop e start (reinicia tudo)
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d

# Force recreate (rebuild)
docker-compose -f docker-compose.production.yml up -d --force-recreate --build backend
```

### Database

```bash
# Conectar ao PostgreSQL
docker exec -it crm-postgres psql -U crm_user crm_whatsapp_saas

# Backup database
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup-$(date +%Y%m%d).sql

# Restore database
docker exec -i crm-postgres psql -U crm_user crm_whatsapp_saas < backup.sql

# Ver migrations aplicadas
cd /root/deploy-backend
npx prisma migrate status

# Executar migrations
npx prisma migrate deploy

# Abrir Prisma Studio (dev only)
npx prisma studio
```

### Redis

```bash
# Conectar ao Redis
docker exec -it crm-redis redis-cli -a ${REDIS_PASSWORD}

# Ver keys
docker exec crm-redis redis-cli -a ${REDIS_PASSWORD} KEYS '*'

# Ver info
docker exec crm-redis redis-cli -a ${REDIS_PASSWORD} INFO

# Limpar cache
docker exec crm-redis redis-cli -a ${REDIS_PASSWORD} FLUSHALL

# Monitor em tempo real
docker exec -it crm-redis redis-cli -a ${REDIS_PASSWORD} MONITOR
```

### Nginx

```bash
# Testar configuração
docker exec crm-nginx nginx -t

# Reload (sem downtime)
docker exec crm-nginx nginx -s reload

# Ver configuração atual
docker exec crm-nginx cat /etc/nginx/nginx.conf
docker exec crm-nginx cat /etc/nginx/conf.d/api.conf

# Ver access logs
docker exec crm-nginx tail -f /var/log/nginx/access.log

# Ver error logs
docker exec crm-nginx tail -f /var/log/nginx/error.log
```

### Limpeza

```bash
# Limpar containers parados
docker container prune -f

# Limpar imagens não usadas
docker image prune -a -f

# Limpar volumes não usados
docker volume prune -f

# Limpar tudo (CUIDADO!)
docker system prune -a --volumes -f

# Limpar backups antigos (mantém últimos 5)
cd /root/deploy-backend/backups
ls -t | tail -n +6 | xargs -r rm -rf

# Limpar logs do sistema
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=500M
```

---

## Monitoramento

### Health Checks Automatizados

Adicione ao crontab:

```bash
# Editar crontab
crontab -e

# Adicionar (verifica a cada 5 minutos)
*/5 * * * * curl -f https://api.botreserva.com.br/api/health || echo "Health check failed at $(date)" >> /var/log/health-check-failures.log
```

### Alertas de Disco

```bash
# Script de verificação de disco
cat > /root/scripts/check-disk.sh << 'EOF'
#!/bin/bash
THRESHOLD=80
USAGE=$(df /root/deploy-backend | tail -1 | awk '{print $5}' | sed 's/%//')

if [ $USAGE -gt $THRESHOLD ]; then
  echo "ALERT: Disk usage at ${USAGE}% (threshold: ${THRESHOLD}%)"
  # Enviar alerta (email, Slack, etc)
fi
EOF

chmod +x /root/scripts/check-disk.sh

# Adicionar ao crontab (diário às 9h)
crontab -e
# 0 9 * * * /root/scripts/check-disk.sh
```

### Logs de Deploy

Todos os deploys são registrados no GitHub Actions:

```
https://github.com/SEU-USUARIO/SEU-REPO/actions
```

Mantenha um log local também:

```bash
# Adicionar ao final do deploy.sh (se usar manual)
echo "$(date): Deploy completed" >> /root/deploy-backend/deploy-history.log
```

---

## Backup e Restore

### Backup Completo

```bash
#!/bin/bash
# Script: /root/scripts/full-backup.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/root/deploy-backend/backups/manual-$DATE"

mkdir -p "$BACKUP_DIR"

# Backup arquivos
echo "Backing up files..."
cp -r /root/deploy-backend/dist "$BACKUP_DIR/"
cp /root/deploy-backend/package.json "$BACKUP_DIR/"
cp /root/deploy-backend/.env.production "$BACKUP_DIR/"

# Backup database
echo "Backing up database..."
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > "$BACKUP_DIR/database.sql"

# Backup Redis (opcional)
echo "Backing up Redis..."
docker exec crm-redis redis-cli -a ${REDIS_PASSWORD} SAVE
cp /var/lib/docker/volumes/deploy-backend_redis_data/_data/dump.rdb "$BACKUP_DIR/"

# Comprimir
echo "Compressing..."
cd /root/deploy-backend/backups
tar -czf "manual-$DATE.tar.gz" "manual-$DATE/"
rm -rf "manual-$DATE/"

echo "Backup completed: manual-$DATE.tar.gz"
```

### Restore Completo

```bash
#!/bin/bash
# Script: /root/scripts/full-restore.sh

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  exit 1
fi

BACKUP_FILE="$1"
TEMP_DIR="/tmp/restore-$(date +%s)"

# Extrair backup
echo "Extracting backup..."
mkdir -p "$TEMP_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_DIR=$(ls -d "$TEMP_DIR"/*/)

# Stop backend
echo "Stopping backend..."
docker-compose -f /root/deploy-backend/docker-compose.production.yml stop backend

# Restore files
echo "Restoring files..."
rm -rf /root/deploy-backend/dist
cp -r "$BACKUP_DIR/dist" /root/deploy-backend/
cp "$BACKUP_DIR/package.json" /root/deploy-backend/

# Restore database
echo "Restoring database..."
docker exec -i crm-postgres psql -U crm_user crm_whatsapp_saas < "$BACKUP_DIR/database.sql"

# Start backend
echo "Starting backend..."
docker-compose -f /root/deploy-backend/docker-compose.production.yml start backend

# Cleanup
rm -rf "$TEMP_DIR"

echo "Restore completed!"
```

### Backup Offsite

Envie backups para local externo:

```bash
# Exemplo: rsync para outro servidor
rsync -avz /root/deploy-backend/backups/ user@backup-server:/backups/botreserva/

# Exemplo: S3 (se tiver AWS CLI)
aws s3 sync /root/deploy-backend/backups/ s3://seu-bucket/backups/

# Exemplo: Google Drive (com rclone)
rclone sync /root/deploy-backend/backups/ gdrive:backups/botreserva/
```

---

## Performance

### Análise de Performance

```bash
# Tempo de resposta do backend
time curl https://api.botreserva.com.br/api/health

# Requests por segundo (com Apache Bench)
ab -n 1000 -c 10 https://api.botreserva.com.br/api/health

# Uso de memória
docker stats --no-stream crm-backend

# Logs de query lentas (PostgreSQL)
docker exec crm-postgres psql -U crm_user crm_whatsapp_saas -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

### Otimizações

```bash
# Aumentar memória do Redis (se necessário)
# Editar docker-compose.production.yml:
# command: redis-server --maxmemory 512mb

# Aumentar pool de conexões PostgreSQL
# Editar docker-compose.production.yml environment:
# POSTGRES_MAX_CONNECTIONS=200

# Otimizar Nginx buffer
# Editar nginx/nginx.conf:
# client_body_buffer_size 16k;
# client_max_body_size 10m;
```

---

## Segurança

### Auditoria de Logs

```bash
# Verificar tentativas de login SSH
sudo journalctl -u ssh | grep "Failed password"

# Verificar logins bem-sucedidos
sudo journalctl -u ssh | grep "Accepted publickey"

# Verificar containers rodando como root (não deveria)
docker ps -q | xargs docker inspect --format '{{.Id}}: User={{.Config.User}}'
```

### Atualização de Dependências

```bash
# Verificar dependências desatualizadas
cd /root/deploy-backend
npm outdated

# Atualizar dependências (cuidado!)
npm update
npm audit fix

# Rebuild
npm run build

# Testar
npm test

# Deploy
docker-compose -f docker-compose.production.yml up -d --build backend
```

### Firewall

```bash
# Ver regras atuais
sudo ufw status

# Permitir apenas portas necessárias
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Troubleshooting Avançado

### Container não inicia

```bash
# Ver logs de erro
docker logs crm-backend

# Ver último comando executado
docker inspect crm-backend | jq '.[0].Config.Cmd'

# Executar shell manualmente
docker run -it --entrypoint sh crm-backend

# Verificar variáveis de ambiente
docker exec crm-backend env | sort
```

### Database corrupto

```bash
# Verificar integridade
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > /dev/null

# Reindex
docker exec crm-postgres psql -U crm_user crm_whatsapp_saas -c "REINDEX DATABASE crm_whatsapp_saas;"

# Vacuum
docker exec crm-postgres psql -U crm_user crm_whatsapp_saas -c "VACUUM FULL;"
```

### Network issues

```bash
# Ver networks Docker
docker network ls

# Inspecionar network
docker network inspect deploy-backend_crm-network

# Verificar conectividade entre containers
docker exec crm-backend ping -c 3 postgres
docker exec crm-backend ping -c 3 redis

# Verificar DNS
docker exec crm-backend nslookup postgres
```

---

## Documentação Relacionada

- **Setup inicial**: `.github/QUICKSTART.md`
- **Configuração completa**: `.github/DEPLOY-SETUP.md`
- **Troubleshooting**: `.github/TROUBLESHOOTING.md`
- **Segurança**: `.github/SECRETS-EXAMPLE.md`
- **Estrutura**: `.github/README.md`

---

**Última atualização**: 2025-11-15
