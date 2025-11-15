# GitHub Actions Deploy - Troubleshooting Guide

Guia rápido de solução de problemas para o deploy automatizado via GitHub Actions.

---

## Índice

1. [Erros de SSH](#erros-de-ssh)
2. [Erros de Build](#erros-de-build)
3. [Erros de Database](#erros-de-database)
4. [Erros de Health Check](#erros-de-health-check)
5. [Erros de Docker](#erros-de-docker)
6. [Erros de Disco](#erros-de-disco)
7. [Rollback](#rollback)
8. [Comandos Úteis](#comandos-úteis)

---

## Erros de SSH

### Error: "Permission denied (publickey)"

**Sintoma**: Workflow falha no step "Setup SSH key" ou "Sync files to VPS"

**Causas possíveis**:
- SSH key não configurada corretamente no GitHub Secrets
- Chave pública não está no `authorized_keys` do VPS
- Permissões incorretas no diretório `.ssh`

**Solução**:

```bash
# 1. Verificar no VPS se a chave está presente
ssh root@72.61.39.235
cat ~/.ssh/authorized_keys

# 2. Verificar permissões
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# 3. Verificar se a chave privada está correta no GitHub Secret
# Acesse: Settings > Secrets > VPS_SSH_KEY
# Deve incluir as linhas BEGIN/END completas

# 4. Testar localmente
# Copie a chave privada do GitHub Secret para um arquivo local
nano /tmp/test_key
chmod 600 /tmp/test_key
ssh -i /tmp/test_key root@72.61.39.235 "echo OK"
rm /tmp/test_key
```

### Error: "Host key verification failed"

**Sintoma**: SSH não consegue conectar por questão de host key

**Solução**:

```bash
# No VPS, adicionar host key ao known_hosts
ssh-keyscan -H 72.61.39.235 >> ~/.ssh/known_hosts

# OU aceitar automaticamente (menos seguro)
# Já está configurado no workflow com StrictHostKeyChecking=no
```

### Error: "Connection timeout"

**Sintoma**: Workflow fica travado tentando conectar ao VPS

**Causas**:
- VPS offline
- Firewall bloqueando porta 22
- IP do VPS mudou

**Solução**:

```bash
# 1. Verificar se VPS está online
ping 72.61.39.235

# 2. Verificar se porta 22 está aberta
nc -zv 72.61.39.235 22

# 3. Verificar firewall no VPS
sudo ufw status
sudo ufw allow 22/tcp

# 4. Verificar se SSH está rodando
sudo systemctl status sshd
```

---

## Erros de Build

### Error: "npm ci failed"

**Sintoma**: Falha ao instalar dependências

**Solução**:

```bash
# 1. Conectar ao VPS e tentar manualmente
ssh root@72.61.39.235
cd /root/deploy-backend

# 2. Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# 3. Verificar se há espaço em disco
df -h

# 4. Verificar permissões
ls -la package.json
```

### Error: "Prisma generate failed"

**Sintoma**: Falha ao gerar Prisma Client

**Solução**:

```bash
# 1. Verificar schema
cd /root/deploy-backend
cat prisma/schema.prisma

# 2. Limpar e regenerar
rm -rf node_modules/.prisma
npx prisma generate

# 3. Verificar se DATABASE_URL está correto
cat .env.production | grep DATABASE_URL
```

### Error: "TypeScript build failed"

**Sintoma**: Erros de compilação TypeScript

**Solução**:

```bash
# 1. Verificar erros específicos
cd /root/deploy-backend
npm run build

# 2. Verificar se dist/ antiga está causando problema
rm -rf dist
npm run build

# 3. Verificar versão do TypeScript
npm list typescript
```

---

## Erros de Database

### Error: "Database connection refused"

**Sintoma**: Aplicação não consegue conectar ao PostgreSQL

**Solução**:

```bash
# 1. Verificar se PostgreSQL está rodando
docker ps | grep postgres

# 2. Verificar logs do PostgreSQL
docker logs crm-postgres

# 3. Testar conexão
docker exec crm-postgres pg_isready -U crm_user

# 4. Verificar se container está na mesma network
docker network inspect deploy-backend_crm-network

# 5. Verificar DATABASE_URL
cat /root/deploy-backend/.env.production | grep DATABASE_URL
# Deve ser: postgresql://crm_user:senha@postgres:5432/crm_whatsapp_saas
```

### Error: "Migration failed"

**Sintoma**: Falha ao executar migrations

**Solução**:

```bash
# 1. Verificar status das migrations
cd /root/deploy-backend
npx prisma migrate status

# 2. Forçar deploy das migrations
npx prisma migrate deploy --skip-seed

# 3. Se houver migrations pendentes com problema, marcar como aplicadas
npx prisma migrate resolve --applied "20231215_migration_name"

# 4. Resetar database (CUIDADO: apaga dados!)
# npx prisma migrate reset --force
```

### Error: "Database does not exist"

**Sintoma**: Banco de dados não foi criado

**Solução**:

```bash
# 1. Criar banco manualmente
docker exec -it crm-postgres psql -U crm_user -c "CREATE DATABASE crm_whatsapp_saas;"

# 2. OU recriar container PostgreSQL
cd /root/deploy-backend
docker-compose -f docker-compose.production.yml down postgres
docker-compose -f docker-compose.production.yml up -d postgres

# 3. Aguardar PostgreSQL estar pronto
docker exec crm-postgres pg_isready -U crm_user

# 4. Executar migrations
npx prisma migrate deploy
```

---

## Erros de Health Check

### Error: "Health check failed after 30 attempts"

**Sintoma**: Aplicação não responde no endpoint de health

**Causas**:
- Aplicação não iniciou
- Porta 3001 não está aberta
- Nginx não está roteando corretamente
- Erro interno na aplicação

**Solução**:

```bash
# 1. Verificar logs do backend
docker logs crm-backend --tail=100

# 2. Verificar se porta 3001 está escutando
docker exec crm-backend netstat -tuln | grep 3001

# 3. Testar health check diretamente no container
docker exec crm-backend curl http://localhost:3001/health

# 4. Testar health check via Nginx
curl http://localhost/api/health

# 5. Verificar se aplicação iniciou corretamente
docker exec crm-backend ps aux

# 6. Verificar variáveis de ambiente
docker exec crm-backend env | grep NODE_ENV
```

### Error: "HTTP 502 Bad Gateway"

**Sintoma**: Nginx retorna 502

**Solução**:

```bash
# 1. Verificar se backend está rodando
docker ps | grep crm-backend

# 2. Verificar logs do Nginx
docker logs crm-nginx --tail=50

# 3. Verificar configuração Nginx
docker exec crm-nginx nginx -t

# 4. Verificar upstream no Nginx config
docker exec crm-nginx cat /etc/nginx/conf.d/api.conf

# 5. Reiniciar Nginx
docker-compose -f docker-compose.production.yml restart nginx
```

### Error: "HTTP 404 Not Found"

**Sintoma**: Endpoint /health não encontrado

**Solução**:

```bash
# 1. Verificar rota no código
cd /root/deploy-backend
grep -r "'/health'" src/

# 2. Verificar se é /health ou /api/health
curl http://localhost:3001/health
curl http://localhost:3001/api/health

# 3. Ajustar HEALTH_CHECK_URL no workflow se necessário
# Editar: .github/workflows/deploy-production.yml
# Linha: HEALTH_CHECK_URL: https://api.botreserva.com.br/api/health
```

---

## Erros de Docker

### Error: "Docker is not running"

**Sintoma**: Workflow falha no pre-deployment check

**Solução**:

```bash
# 1. Iniciar Docker
sudo systemctl start docker

# 2. Habilitar para iniciar com sistema
sudo systemctl enable docker

# 3. Verificar status
sudo systemctl status docker

# 4. Se continuar com problema, reinstalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Error: "Cannot connect to Docker daemon"

**Sintoma**: Comandos docker falham

**Solução**:

```bash
# 1. Verificar se user tem permissão
sudo usermod -aG docker $USER
newgrp docker

# 2. Verificar socket
ls -la /var/run/docker.sock
sudo chmod 666 /var/run/docker.sock

# 3. Reiniciar Docker
sudo systemctl restart docker
```

### Error: "Container unhealthy"

**Sintoma**: Container está em estado unhealthy

**Solução**:

```bash
# 1. Verificar health check do container
docker inspect crm-backend | jq '.[0].State.Health'

# 2. Ver logs do health check
docker logs crm-backend | grep health

# 3. Executar health check manualmente
docker exec crm-backend node -e "require('http').get('http://localhost:3001/health', (r) => console.log(r.statusCode))"

# 4. Recriar container
docker-compose -f docker-compose.production.yml up -d --force-recreate backend
```

---

## Erros de Disco

### Error: "Disk usage is above 90%"

**Sintoma**: Deploy bloqueado por falta de espaço

**Solução**:

```bash
# 1. Verificar uso de disco
df -h

# 2. Limpar Docker
docker system prune -a --volumes -f

# 3. Limpar backups antigos
cd /root/deploy-backend/backups
ls -t | tail -n +6 | xargs rm -rf

# 4. Limpar logs
sudo journalctl --vacuum-time=7d

# 5. Encontrar arquivos grandes
du -h /root | sort -rh | head -20

# 6. Limpar cache npm
npm cache clean --force
```

### Error: "No space left on device"

**Sintoma**: Operações de escrita falham

**Solução**:

```bash
# 1. Verificar inodes (pode estar cheio mesmo com espaço)
df -i

# 2. Liberar espaço emergencialmente
docker stop $(docker ps -aq)
docker system prune -a --volumes -f

# 3. Remover node_modules antigos
find /root -name "node_modules" -type d -prune -exec rm -rf {} +

# 4. Limpar /tmp
sudo rm -rf /tmp/*
```

---

## Rollback

### Rollback Automático (via workflow)

Se o deploy falhar e você executou via workflow_dispatch:

```
O job "rollback" será executado automaticamente
```

### Rollback Manual

```bash
# 1. Conectar ao VPS
ssh root@72.61.39.235
cd /root/deploy-backend

# 2. Listar backups disponíveis
ls -lth backups/

# 3. Identificar backup anterior ao problema
# Exemplo: backups/pre-deploy-20251115-143022

# 4. Restaurar arquivos
BACKUP_DIR="backups/pre-deploy-20251115-143022"

rm -rf dist
cp -r "$BACKUP_DIR/dist" .

if [ -f "$BACKUP_DIR/package.json" ]; then
  cp "$BACKUP_DIR/package.json" .
fi

# 5. Reinstalar dependências (se package.json mudou)
npm ci

# 6. Reiniciar container
docker-compose -f docker-compose.production.yml restart backend

# 7. Verificar logs
docker-compose -f docker-compose.production.yml logs -f backend

# 8. Testar health check
curl https://api.botreserva.com.br/api/health
```

### Rollback de Database

```bash
# 1. Listar backups de database
ls -lth /root/deploy-backend/backups/*/database.sql

# 2. Restaurar database
BACKUP_FILE="/root/deploy-backend/backups/pre-deploy-20251115-143022/database.sql"

docker exec -i crm-postgres psql -U crm_user crm_whatsapp_saas < "$BACKUP_FILE"

# 3. Reiniciar backend
docker-compose -f docker-compose.production.yml restart backend
```

---

## Comandos Úteis

### Logs

```bash
# Logs do backend em tempo real
docker-compose -f docker-compose.production.yml logs -f backend

# Logs de todos containers
docker-compose -f docker-compose.production.yml logs -f

# Últimas 100 linhas
docker logs crm-backend --tail=100

# Logs com timestamp
docker logs crm-backend --timestamps
```

### Status

```bash
# Status de todos containers
docker-compose -f docker-compose.production.yml ps

# Status detalhado
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health de containers
docker inspect crm-backend | jq '.[0].State.Health.Status'
```

### Restart

```bash
# Restart apenas backend
docker-compose -f docker-compose.production.yml restart backend

# Restart todos containers
docker-compose -f docker-compose.production.yml restart

# Force recreate
docker-compose -f docker-compose.production.yml up -d --force-recreate backend
```

### Debug

```bash
# Executar shell no container
docker exec -it crm-backend sh

# Ver variáveis de ambiente
docker exec crm-backend env

# Ver processos rodando
docker exec crm-backend ps aux

# Testar conexões de dentro do container
docker exec crm-backend nc -zv postgres 5432
docker exec crm-backend nc -zv redis 6379
```

### Limpeza

```bash
# Limpar tudo (CUIDADO!)
docker-compose -f docker-compose.production.yml down -v

# Limpar apenas stopped containers
docker container prune

# Limpar images não usadas
docker image prune -a

# Limpar tudo no Docker
docker system prune -a --volumes
```

---

## Checklist de Diagnóstico

Quando algo der errado, siga esta ordem:

- [ ] VPS está online? (`ping 72.61.39.235`)
- [ ] SSH funciona? (`ssh root@72.61.39.235`)
- [ ] Docker está rodando? (`docker ps`)
- [ ] Containers estão UP? (`docker-compose ps`)
- [ ] Logs mostram erros? (`docker logs crm-backend`)
- [ ] Health check funciona? (`curl localhost:3001/health`)
- [ ] Database está conectado? (`docker exec crm-postgres pg_isready`)
- [ ] Redis está conectado? (`docker exec crm-redis redis-cli ping`)
- [ ] Nginx está roteando? (`curl localhost/api/health`)
- [ ] Variáveis de ambiente corretas? (`docker exec crm-backend env`)
- [ ] Espaço em disco suficiente? (`df -h`)
- [ ] Backup disponível para rollback? (`ls -lth backups/`)

---

## Contatos de Emergência

Se nada funcionar:

1. Verifique logs completos no GitHub Actions
2. Conecte ao VPS e inspecione manualmente
3. Considere rollback para última versão estável
4. Revise documentação em `docs/GUIA-DEPLOY.md`

---

**Última atualização**: 2025-11-15
