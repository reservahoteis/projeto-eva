# Plano de Acao - Infraestrutura e Seguranca Backend

## Status Atual

**Data da Analise:** 2025-12-05
**Servidor:** 72.61.39.235 (VPS em producao)
**Uptime:** 17+ horas
**Status Geral:** FUNCIONAL com vulnerabilidades CRITICAS

---

## Vulnerabilidades CRITICAS Identificadas

### 1. PostgreSQL Exposto Publicamente (SEVERIDADE: CRITICA)
**Risco:** Acesso nao autorizado ao banco de dados
**Impacto:** Vazamento de dados, perda de dados, ransomware
**Status:** ABERTO

### 2. Sem Firewall Ativo (SEVERIDADE: CRITICA)
**Risco:** Exposicao de servicos nao necessarios
**Impacto:** Ataques DDoS, brute force, port scanning
**Status:** ABERTO

### 3. Senhas em Texto Claro no .env (SEVERIDADE: ALTA)
**Risco:** Vazamento de credenciais
**Impacto:** Acesso completo aos sistemas
**Status:** ABERTO

### 4. Sem Backup Automatizado (SEVERIDADE: ALTA)
**Risco:** Perda permanente de dados
**Impacto:** Impossibilidade de recuperacao em desastres
**Status:** ABERTO

### 5. Sem Monitoramento/Alertas (SEVERIDADE: MEDIA)
**Risco:** Downtime nao detectado
**Impacto:** Perda de receita, insatisfacao de clientes
**Status:** ABERTO

---

## Plano de Acao Imediato (24-48h)

### Acao 1: Fechar Porta PostgreSQL (URGENTE)

**Prioridade:** CRITICA
**Tempo Estimado:** 15 minutos
**Downtime:** ~2 minutos

#### Passos:

```bash
# 1. SSH na VPS
ssh root@72.61.39.235

# 2. Navegar para diretorio
cd /root/deploy-backend

# 3. Backup do docker-compose atual
cp docker-compose.production.yml docker-compose.production.yml.backup

# 4. Editar docker-compose.production.yml
nano docker-compose.production.yml

# Encontrar secao do PostgreSQL e REMOVER/COMENTAR linha de ports:
services:
  postgres:
    image: postgres:16-alpine
    container_name: crm-postgres
    # ports:
    #   - "5432:5432"  # <-- REMOVER ESTA LINHA
    environment:
      ...

# 5. Recriar container PostgreSQL
docker-compose -f docker-compose.production.yml up -d postgres

# 6. Verificar que porta nao esta mais exposta
netstat -tlnp | grep 5432
# Nao deve mostrar nenhuma linha com 0.0.0.0:5432

# 7. Testar que backend ainda consegue conectar
docker logs crm-backend --tail 20
# Deve mostrar "Database connected successfully"

# 8. Testar API
curl https://api.botreserva.com.br/health
# Deve retornar: {"status":"ok",...}
```

#### Validacao:

```bash
# Tentar conectar de fora (deve FALHAR)
psql -h 72.61.39.235 -U crm_user -d crm_whatsapp_saas
# Esperado: connection refused

# Backend interno deve funcionar
docker exec crm-backend node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$connect().then(()=>console.log('OK')).catch(e=>console.error(e))"
# Esperado: OK
```

---

### Acao 2: Configurar Firewall UFW (URGENTE)

**Prioridade:** CRITICA
**Tempo Estimado:** 10 minutos
**Downtime:** 0 (sem interrupcao)

#### Passos:

```bash
# 1. SSH na VPS
ssh root@72.61.39.235

# 2. Instalar UFW (se nao estiver instalado)
apt update
apt install ufw -y

# 3. Configurar regras ANTES de ativar
ufw default deny incoming
ufw default allow outgoing

# 4. Permitir apenas portas necessarias
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# 5. Negar explicitamente PostgreSQL (redundancia)
ufw deny 5432/tcp

# 6. Verificar regras (NAO ATIVAR AINDA!)
ufw show added

# 7. IMPORTANTE: Antes de ativar, confirme que SSH (22) esta permitido!
# Se bloquear SSH, perdera acesso ao servidor!

# 8. Ativar firewall
ufw enable

# 9. Verificar status
ufw status verbose

# 10. Testar SSH em OUTRA JANELA (nao feche a atual!)
# Em outro terminal:
ssh root@72.61.39.235
# Se conseguir conectar, firewall esta OK
```

#### Validacao:

```bash
# Ver status detalhado
ufw status numbered

# Output esperado:
Status: active

To                         Action      From
--                         ------      ----
[ 1] 22/tcp                 ALLOW IN    Anywhere
[ 2] 80/tcp                 ALLOW IN    Anywhere
[ 3] 443/tcp                ALLOW IN    Anywhere
[ 4] 5432/tcp               DENY IN     Anywhere

# Testar portas de fora
nmap 72.61.39.235
# Deve mostrar apenas: 22, 80, 443 (open)
```

---

### Acao 3: Rotacionar Senhas Criticas (URGENTE)

**Prioridade:** ALTA
**Tempo Estimado:** 30 minutos
**Downtime:** ~5 minutos

#### 3.1. Gerar Novas Senhas Seguras

```bash
# Gerar senhas aleatorias fortes
openssl rand -base64 32  # Para DATABASE_PASSWORD
openssl rand -base64 32  # Para REDIS_PASSWORD
openssl rand -base64 48  # Para JWT_SECRET
openssl rand -base64 48  # Para JWT_REFRESH_SECRET
openssl rand -hex 32     # Para ENCRYPTION_KEY
```

#### 3.2. Atualizar Senhas no .env

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# Backup do .env atual
cp .env .env.backup.$(date +%Y%m%d-%H%M%S)

# Editar .env
nano .env

# Atualizar:
POSTGRES_PASSWORD=<NOVA_SENHA_GERADA>
REDIS_PASSWORD=<NOVA_SENHA_GERADA>
JWT_SECRET=<NOVA_SENHA_GERADA>
JWT_REFRESH_SECRET=<NOVA_SENHA_GERADA>
ENCRYPTION_KEY=<NOVA_CHAVE_GERADA>

# Salvar e sair (Ctrl+X, Y, Enter)
```

#### 3.3. Atualizar DATABASE_URL

```bash
# No mesmo arquivo .env, atualizar DATABASE_URL com a nova senha:
DATABASE_URL=postgresql://crm_user:<NOVA_SENHA>@crm-postgres:5432/crm_whatsapp_saas?schema=public
```

#### 3.4. Recriar Containers

```bash
# Parar containers
docker-compose -f docker-compose.production.yml down

# Recriar com novas senhas
docker-compose -f docker-compose.production.yml up -d

# Verificar logs
docker-compose -f docker-compose.production.yml logs -f

# Aguardar ate ver:
# "Database connected successfully"
# "Redis connected successfully"
# "Server listening on port 3001"
```

#### 3.5. Validacao

```bash
# Testar API
curl https://api.botreserva.com.br/health

# Testar login (vai invalidar tokens antigos, esperado)
curl -X POST https://api.botreserva.com.br/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: hotel-teste" \
  -d '{"email":"admin@example.com","password":"Admin123!Change"}'

# Verificar logs do backend
docker logs crm-backend --tail 50
```

#### 3.6. IMPORTANTE: Atualizar Frontend

```bash
# O frontend tera que fazer login novamente
# Todos os tokens existentes serao invalidados
# Comunicar aos usuarios para fazer novo login
```

---

## Plano de Acao Curto Prazo (7 dias)

### Acao 4: Implementar Backup Automatizado

**Prioridade:** ALTA
**Tempo Estimado:** 1 hora

#### 4.1. Criar Script de Backup

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# Criar diretorio de scripts se nao existir
mkdir -p scripts

# Criar script de backup
cat > scripts/backup-database.sh << 'EOF'
#!/bin/bash
set -e

# Configuracoes
BACKUP_DIR="/root/deploy-backend/backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="backup-${DATE}.sql"
RETENTION_DAYS=7

# Criar diretorio de backup se nao existir
mkdir -p ${BACKUP_DIR}

# Fazer backup
echo "Starting backup at ${DATE}..."
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > ${BACKUP_DIR}/${BACKUP_FILE}

# Comprimir backup
gzip ${BACKUP_DIR}/${BACKUP_FILE}

# Verificar backup
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}.gz" ]; then
    SIZE=$(du -h ${BACKUP_DIR}/${BACKUP_FILE}.gz | cut -f1)
    echo "Backup completed successfully: ${BACKUP_FILE}.gz (${SIZE})"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# Remover backups antigos (mais de 7 dias)
find ${BACKUP_DIR} -name "backup-*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Old backups cleaned up (retention: ${RETENTION_DAYS} days)"

# Listar backups existentes
echo "Available backups:"
ls -lh ${BACKUP_DIR}/backup-*.sql.gz
EOF

# Tornar executavel
chmod +x scripts/backup-database.sh
```

#### 4.2. Testar Backup Manual

```bash
# Executar backup
./scripts/backup-database.sh

# Verificar backup criado
ls -lh backups/
```

#### 4.3. Configurar Cron para Backup Diario

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup diario as 2:00 AM):
0 2 * * * /root/deploy-backend/scripts/backup-database.sh >> /var/log/backup.log 2>&1

# Salvar e sair

# Verificar crontab
crontab -l
```

#### 4.4. Criar Script de Restore

```bash
cat > scripts/restore-database.sh << 'EOF'
#!/bin/bash
set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh /root/deploy-backend/backups/backup-*.sql.gz
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will OVERWRITE the current database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Restoring from: $BACKUP_FILE"

# Descomprimir e restaurar
gunzip -c $BACKUP_FILE | docker exec -i crm-postgres psql -U crm_user -d crm_whatsapp_saas

echo "Restore completed successfully!"
echo "Restarting backend to ensure fresh connections..."
docker-compose -f /root/deploy-backend/docker-compose.production.yml restart backend

echo "Done!"
EOF

chmod +x scripts/restore-database.sh
```

---

### Acao 5: Configurar Backup Offsite (AWS S3)

**Prioridade:** ALTA
**Tempo Estimado:** 1 hora

#### 5.1. Instalar AWS CLI

```bash
ssh root@72.61.39.235

# Instalar AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
apt install unzip -y
unzip awscliv2.zip
sudo ./aws/install

# Verificar instalacao
aws --version
```

#### 5.2. Configurar Credenciais AWS

```bash
# Criar usuario IAM na AWS com permissoes S3
# Copiar Access Key ID e Secret Access Key

# Configurar AWS CLI
aws configure

# Inserir:
# AWS Access Key ID: <sua-access-key>
# AWS Secret Access Key: <sua-secret-key>
# Default region name: us-east-1 (ou sua preferencia)
# Default output format: json
```

#### 5.3. Criar Bucket S3

```bash
# Criar bucket (nome deve ser unico globalmente)
aws s3 mb s3://crm-backups-botreserva-<random-string>

# Verificar bucket criado
aws s3 ls
```

#### 5.4. Script de Sync para S3

```bash
cat > scripts/backup-to-s3.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/root/deploy-backend/backups"
S3_BUCKET="s3://crm-backups-botreserva-<seu-bucket>"

echo "Syncing backups to S3..."

# Upload todos os backups para S3
aws s3 sync ${BACKUP_DIR} ${S3_BUCKET}/database-backups/ \
    --exclude "*" \
    --include "backup-*.sql.gz" \
    --storage-class STANDARD_IA

echo "S3 sync completed!"
aws s3 ls ${S3_BUCKET}/database-backups/
EOF

chmod +x scripts/backup-to-s3.sh
```

#### 5.5. Atualizar Cron para Incluir S3

```bash
crontab -e

# Modificar linha existente:
0 2 * * * /root/deploy-backend/scripts/backup-database.sh && /root/deploy-backend/scripts/backup-to-s3.sh >> /var/log/backup.log 2>&1
```

---

### Acao 6: Implementar Monitoramento Basico

**Prioridade:** MEDIA
**Tempo Estimado:** 2 horas

#### 6.1. Configurar UptimeRobot (Gratuito)

1. Acesse: https://uptimerobot.com/
2. Criar conta gratuita
3. Adicionar monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: Backend API Health
   - URL: https://api.botreserva.com.br/health
   - Monitoring Interval: 5 minutes
4. Configurar alertas:
   - Email: seu-email@example.com
   - Alertar quando: Down

#### 6.2. Script de Health Check Local

```bash
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "==================================="
echo "   Backend Health Check Report"
echo "==================================="
echo ""

# 1. Verificar containers
echo "1. Docker Containers:"
if docker ps | grep -q crm-backend; then
    echo -e "   Backend:    ${GREEN}UP${NC}"
else
    echo -e "   Backend:    ${RED}DOWN${NC}"
fi

if docker ps | grep -q crm-postgres; then
    echo -e "   PostgreSQL: ${GREEN}UP${NC}"
else
    echo -e "   PostgreSQL: ${RED}DOWN${NC}"
fi

if docker ps | grep -q crm-redis; then
    echo -e "   Redis:      ${GREEN}UP${NC}"
else
    echo -e "   Redis:      ${RED}DOWN${NC}"
fi

if docker ps | grep -q crm-nginx; then
    echo -e "   Nginx:      ${GREEN}UP${NC}"
else
    echo -e "   Nginx:      ${RED}DOWN${NC}"
fi

echo ""

# 2. Verificar API
echo "2. API Health:"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://api.botreserva.com.br/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "   Status:     ${GREEN}OK (200)${NC}"
else
    echo -e "   Status:     ${RED}FAILED ($HEALTH_RESPONSE)${NC}"
fi

echo ""

# 3. Verificar uso de disco
echo "3. Disk Usage:"
df -h | grep -E '^/dev' | awk '{print "   " $6 ": " $5 " used (" $4 " free)"}'

echo ""

# 4. Verificar memoria
echo "4. Memory Usage:"
free -h | grep Mem | awk '{print "   Total: " $2 " | Used: " $3 " | Free: " $4}'

echo ""

# 5. Database size
echo "5. Database Size:"
DB_SIZE=$(docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -t -c "SELECT pg_size_pretty(pg_database_size('crm_whatsapp_saas'));" | xargs)
echo "   Size: $DB_SIZE"

echo ""

# 6. Ultimo backup
echo "6. Last Backup:"
LAST_BACKUP=$(ls -t /root/deploy-backend/backups/backup-*.sql.gz 2>/dev/null | head -1)
if [ -n "$LAST_BACKUP" ]; then
    BACKUP_DATE=$(stat -c %y "$LAST_BACKUP" | cut -d' ' -f1,2 | cut -d: -f1,2)
    BACKUP_SIZE=$(du -h "$LAST_BACKUP" | cut -f1)
    echo -e "   Date: $BACKUP_DATE"
    echo -e "   Size: $BACKUP_SIZE"
else
    echo -e "   ${RED}No backups found!${NC}"
fi

echo ""
echo "==================================="
EOF

chmod +x scripts/health-check.sh
```

#### 6.3. Executar Health Check

```bash
./scripts/health-check.sh
```

---

## Plano de Acao Medio Prazo (30 dias)

### Acao 7: Implementar CI/CD Pipeline (GitHub Actions)

**Prioridade:** MEDIA
**Tempo Estimado:** 4 horas

#### 7.1. Criar Workflow de CI/CD

Criar `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to VPS

on:
  push:
    branches:
      - main
    paths:
      - 'deploy-backend/**'
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: deploy-backend/package-lock.json

      - name: Install dependencies
        run: |
          cd deploy-backend
          npm ci

      - name: Run tests
        run: |
          cd deploy-backend
          npm test

      - name: Run linter
        run: |
          cd deploy-backend
          npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /root/deploy-backend

            # Backup pre-deploy
            ./scripts/backup-database.sh

            # Pull latest code
            git pull origin main

            # Build and restart
            docker-compose -f docker-compose.production.yml build backend
            docker-compose -f docker-compose.production.yml up -d backend

            # Wait for health
            sleep 10

            # Health check
            curl -f https://api.botreserva.com.br/health || exit 1

            echo "Deploy completed successfully!"
```

#### 7.2. Configurar Secrets no GitHub

No repositorio GitHub:
1. Settings > Secrets and variables > Actions
2. Adicionar secrets:
   - `VPS_HOST`: 72.61.39.235
   - `VPS_USER`: root
   - `VPS_SSH_KEY`: (chave privada SSH)

---

### Acao 8: Implementar Monitoramento Avancado (Opcional)

**Prioridade:** BAIXA
**Tempo Estimado:** 8 horas

#### Opcao 1: Prometheus + Grafana (Self-hosted)

**Vantagens:**
- Gratuito e open-source
- Total controle
- Metricas detalhadas

**Desvantagens:**
- Requer manutencao
- Consome recursos do servidor

#### Opcao 2: New Relic / Datadog / Sentry (SaaS)

**Vantagens:**
- Zero manutencao
- APM completo
- Alertas inteligentes

**Desvantagens:**
- Custo mensal
- Dependencia de terceiros

---

## Checklist de Execucao

### Fase 1: Seguranca CRITICA (24-48h)
- [ ] Fechar porta 5432 do PostgreSQL
- [ ] Configurar firewall UFW
- [ ] Rotacionar senha do PostgreSQL
- [ ] Rotacionar senha do Redis
- [ ] Rotacionar JWT secrets
- [ ] Rotacionar ENCRYPTION_KEY
- [ ] Testar API apos mudancas
- [ ] Comunicar usuarios sobre invalidacao de tokens

### Fase 2: Backup e Monitoramento (7 dias)
- [ ] Criar script de backup
- [ ] Testar backup manual
- [ ] Configurar cron para backup diario
- [ ] Criar script de restore
- [ ] Testar restore de backup
- [ ] Configurar AWS S3
- [ ] Criar script de sync para S3
- [ ] Configurar UptimeRobot
- [ ] Criar script de health check
- [ ] Testar alertas

### Fase 3: Automacao (30 dias)
- [ ] Criar workflow CI/CD
- [ ] Configurar secrets no GitHub
- [ ] Testar deploy automatico
- [ ] Documentar processo de deploy
- [ ] Treinar equipe
- [ ] Implementar monitoramento avancado (opcional)

---

## Rollback Plan

### Se algo der errado durante as mudancas:

#### 1. Backup imediato
```bash
./scripts/backup-database.sh
```

#### 2. Restaurar docker-compose anterior
```bash
cp docker-compose.production.yml.backup docker-compose.production.yml
docker-compose -f docker-compose.production.yml up -d
```

#### 3. Restaurar .env anterior
```bash
cp .env.backup.<TIMESTAMP> .env
docker-compose -f docker-compose.production.yml restart
```

#### 4. Verificar logs
```bash
docker logs crm-backend --tail 100
```

#### 5. Testar API
```bash
curl https://api.botreserva.com.br/health
```

---

## Contato e Suporte

**Responsavel:** [Seu Nome]
**Email:** [seu-email@example.com]
**Telefone:** [seu-telefone]

**Escalacao:**
1. Tentar resolver seguindo troubleshooting
2. Verificar logs: `docker logs crm-backend`
3. Consultar documentacao: `/docs/*.md`
4. Restaurar backup se necessario
5. Contatar suporte

---

## Metricas de Sucesso

### Seguranca
- [ ] Zero portas desnecessarias expostas
- [ ] Firewall ativo e configurado
- [ ] Todas as senhas rotacionadas
- [ ] Score A+ no SSL Labs (https://www.ssllabs.com/ssltest/)

### Backup
- [ ] Backup diario funcionando
- [ ] Backup offsite configurado
- [ ] Tempo de restore < 10 minutos
- [ ] Testes de restore mensais

### Monitoramento
- [ ] Uptime > 99.9%
- [ ] Alertas configurados
- [ ] Health check respondendo
- [ ] Logs centralizados

### Automacao
- [ ] Deploy automatizado funcionando
- [ ] Testes executando no CI/CD
- [ ] Rollback automatico em caso de falha
- [ ] Documentacao completa

---

**Documento criado em:** 2025-12-05
**Proxima revisao:** 2025-12-12
**Status:** PLANO ATIVO - AGUARDANDO EXECUCAO
