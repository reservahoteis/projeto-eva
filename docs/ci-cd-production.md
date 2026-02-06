# CI/CD Production (Main) - Documentacao Detalhada

## Visao Geral

O workflow de producao e acionado quando ha push na branch `main` e faz deploy para o servidor de producao com **rollback automatico** em caso de falha.

**Arquivo:** `.github/workflows/deploy-production.yml`

---

## Diferencas do Staging

| Caracteristica | Staging | Production |
|----------------|---------|------------|
| Branch | develop | main |
| Porta | 3002 | 3001 |
| Container | crm-backend-dev | crm-backend |
| Backup DB | Nao | Sim |
| Rollback | Nao | Sim (automatico) |
| Health Check | 20 tentativas | 30 tentativas |

---

## Trigger (Gatilho)

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'deploy-backend/**'
      - '.github/workflows/deploy-production.yml'
  workflow_dispatch:
```

**Igual ao staging, mas para branch `main`.**

---

## Variaveis de Ambiente

```yaml
env:
  VPS_HOST: ${{ secrets.VPS_HOST }}
  VPS_USER: ${{ secrets.VPS_USER }}
  VPS_PATH: /root/deploy-backend
```

**Nota:** `VPS_PATH` aponta para `/root/deploy-backend` (producao), nao `/root/deploy-backend-dev`.

---

## Job 1: Test

**Identico ao staging.** Roda lint, type check e testes antes de fazer deploy.

---

## Job 2: Deploy

### Step 1-2: SSH Setup

**Identico ao staging.** Configura chave SSH e testa conexao.

---

### Step 3: Create Backup and Save Current Image (EXCLUSIVO PRODUCAO)

```yaml
- name: Create backup and save current image
  run: |
    ssh -i ~/.ssh/deploy_key ${{ env.VPS_USER }}@${{ env.VPS_HOST }} << 'EOF'
      set -e
      cd /root/deploy-backend
      mkdir -p backups

      # Backup do banco de dados
      if docker ps | grep -q crm-postgres; then
        echo "Creating database backup..."
        docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > "backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sql" 2>/dev/null || echo "Warning: Database backup failed"
      fi

      # Salvar imagem atual para rollback
      if docker images | grep -q "deploy-backend-backend"; then
        echo "Saving current image for rollback..."
        docker tag deploy-backend-backend:latest deploy-backend-backend:rollback 2>/dev/null || true
      fi

      # Limpar backups antigos (manter ultimos 5)
      ls -t backups/*.sql 2>/dev/null | tail -n +6 | xargs -r rm -f || true
    EOF
```

| Comando | Explicacao |
|---------|------------|
| `mkdir -p backups` | Cria pasta de backups se nao existir |
| `docker ps \| grep -q crm-postgres` | Verifica se container do Postgres esta rodando |
| `docker exec crm-postgres pg_dump` | Faz dump do banco de dados |
| `-U crm_user crm_whatsapp_saas` | Usuario e nome do banco |
| `> "backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sql"` | Salva com timestamp no nome |
| `docker tag ... :rollback` | Cria tag da imagem atual para rollback |
| `ls -t backups/*.sql \| tail -n +6 \| xargs -r rm -f` | Mantem apenas os 5 backups mais recentes |

**Por que backup?**
- Se algo der errado, pode restaurar o banco
- Backup automatico antes de cada deploy
- Mantem historico dos ultimos 5 deploys

**Por que salvar imagem para rollback?**
- Se o novo deploy falhar, pode voltar para a versao anterior
- Tag `:rollback` guarda a imagem que estava funcionando

---

### Step 4: Sync Files (rsync)

```yaml
- name: Sync files to VPS
  run: |
    rsync -avz \
      --exclude 'node_modules' \
      --exclude 'dist' \
      --exclude '.env' \
      --exclude '.env.*' \
      --exclude 'coverage' \
      --exclude 'backups' \
      --exclude 'certbot' \
      --exclude '*.test.ts' \
      --exclude 'src/test' \
      --exclude 'logs' \
      --exclude 'uploads' \
      -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no" \
      deploy-backend/ \
      ${{ env.VPS_USER }}@${{ env.VPS_HOST }}:${{ env.VPS_PATH }}/
```

**Diferencas do staging:**

| Diferenca | Staging | Production |
|-----------|---------|------------|
| `--delete` | Sim | **Nao** |
| `--exclude logs` | Nao | Sim |
| `--exclude uploads` | Nao | Sim |
| `--exclude certbot` | Nao | Sim |

**Por que sem `--delete` em producao?**
- Nao apaga arquivos criados manualmente no servidor
- Preserva logs, uploads de usuarios, certificados SSL
- Mais seguro para ambiente de producao

---

### Step 5: Build and Restart Container (COM ROLLBACK)

```yaml
- name: Build and restart container
  run: |
    ssh -i ~/.ssh/deploy_key ${{ env.VPS_USER }}@${{ env.VPS_HOST }} << 'EOF'
      set -e
      cd /root/deploy-backend

      echo "Building Docker image..."
      docker compose -f docker-compose.production.yml build backend

      echo "Stopping and removing old container..."
      docker stop crm-backend 2>/dev/null || true
      docker rm -f crm-backend 2>/dev/null || true

      echo "Starting new container..."
      docker compose -f docker-compose.production.yml up -d --no-deps backend

      echo "Waiting for container to start..."
      sleep 10

      echo "Running migrations..."
      if ! docker compose -f docker-compose.production.yml exec -T backend npx prisma migrate deploy; then
        echo "ERROR: Migration failed!"
        echo "Rolling back to previous image..."
        if docker images | grep -q "deploy-backend-backend:rollback"; then
          docker tag deploy-backend-backend:rollback deploy-backend-backend:latest
          docker stop crm-backend 2>/dev/null || true
          docker rm -f crm-backend 2>/dev/null || true
          docker compose -f docker-compose.production.yml up -d --no-deps backend
          echo "Rollback completed. Please check migrations manually."
        fi
        exit 1
      fi

      echo "Container status:"
      docker compose -f docker-compose.production.yml ps backend
    EOF
```

| Comando | Explicacao |
|---------|------------|
| `if ! ... prisma migrate deploy; then` | Se migration falhar, entra no bloco de rollback |
| `docker tag :rollback :latest` | Restaura imagem anterior como "latest" |
| `docker stop/rm/up` | Reinicia container com imagem anterior |
| `exit 1` | Falha o workflow (mas sistema voltou a funcionar) |

**Fluxo de Rollback por Migration:**

```
1. Migration falha
      |
      v
2. Restaura imagem :rollback como :latest
      |
      v
3. Para e remove container atual
      |
      v
4. Inicia container com imagem anterior
      |
      v
5. Workflow falha (para alertar), mas sistema funciona
```

---

### Step 6: Health Check with Rollback (EXCLUSIVO PRODUCAO)

```yaml
- name: Health check with rollback
  run: |
    for i in {1..30}; do
      RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' https://api.botreserva.com.br/api/health || echo "000")
      if [ "$RESPONSE" = "200" ]; then
        echo "Health check OK!"
        curl -s https://api.botreserva.com.br/api/health | jq '.' || true

        # Limpar imagem de rollback apos sucesso
        ssh -i ~/.ssh/deploy_key ${{ env.VPS_USER }}@${{ env.VPS_HOST }} "docker rmi deploy-backend-backend:rollback 2>/dev/null || true"
        exit 0
      fi
      echo "Attempt $i/30 - Status: $RESPONSE"
      sleep 5
    done

    echo "Health check failed! Initiating rollback..."
    ssh -i ~/.ssh/deploy_key ${{ env.VPS_USER }}@${{ env.VPS_HOST }} << 'EOF'
      cd /root/deploy-backend
      echo "Container logs before rollback:"
      docker logs crm-backend --tail=50

      if docker images | grep -q "deploy-backend-backend:rollback"; then
        echo "Rolling back to previous version..."
        docker tag deploy-backend-backend:rollback deploy-backend-backend:latest
        docker stop crm-backend 2>/dev/null || true
        docker rm -f crm-backend 2>/dev/null || true
        docker compose -f docker-compose.production.yml up -d --no-deps backend
        sleep 10
        echo "Rollback completed. Checking health..."
        docker compose -f docker-compose.production.yml ps backend
      else
        echo "No rollback image available!"
      fi
    EOF
    exit 1
```

**Diferencas do staging:**

| Caracteristica | Staging | Production |
|----------------|---------|------------|
| URL | localhost:3002 | https://api.botreserva.com.br |
| Tentativas | 20 | 30 |
| Rollback | Nao | Sim |
| Limpa imagem rollback | Nao | Sim (apos sucesso) |

**Fluxo de Rollback por Health Check:**

```
1. Health check falha (30 tentativas)
      |
      v
2. Mostra logs do container
      |
      v
3. Restaura imagem :rollback como :latest
      |
      v
4. Para e remove container atual
      |
      v
5. Inicia container com imagem anterior
      |
      v
6. Workflow falha (para alertar), mas sistema funciona
```

**Por que limpar imagem de rollback apos sucesso?**
- Libera espaco em disco
- Evita confusao sobre qual imagem e a atual
- Proximo deploy criara nova imagem de rollback

---

### Step 7: Cleanup

```yaml
- name: Cleanup
  if: always()
  run: rm -f ~/.ssh/deploy_key
```

**Identico ao staging.** Remove chave SSH.

---

## Fluxo Completo de Producao

```
1. Push em main
      |
      v
2. [TEST] Checkout -> Node.js -> npm ci -> Lint -> TypeCheck -> Tests
      |
      v (se passar)
3. [BACKUP] Dump do banco + Tag imagem :rollback
      |
      v
4. [SYNC] rsync (sem --delete, preserva arquivos)
      |
      v
5. [BUILD] docker compose build
      |
      v
6. [DEPLOY] Stop -> Remove -> Start container
      |
      v
7. [MIGRATION] prisma migrate deploy
      |
      +---> Se falhar: ROLLBACK -> Restaura imagem anterior
      |
      v (se passar)
8. [HEALTH] 30 tentativas em https://api.botreserva.com.br
      |
      +---> Se falhar: ROLLBACK -> Restaura imagem anterior
      |
      v (se passar)
9. [CLEANUP] Remove imagem :rollback + chave SSH
```

---

## Portas e URLs

| Ambiente | Porta | URL |
|----------|-------|-----|
| Production | 3001 | https://api.botreserva.com.br |

---

## Cenarios de Rollback

### Cenario 1: Migration Falha

```
Situacao: Nova migration tem erro de SQL
Resultado: Rollback automatico para versao anterior
Acao necessaria: Corrigir migration e fazer novo deploy
```

### Cenario 2: Health Check Falha

```
Situacao: App nao inicia (erro de codigo, config, etc)
Resultado: Rollback automatico para versao anterior
Acao necessaria: Ver logs, corrigir erro e fazer novo deploy
```

### Cenario 3: Primeiro Deploy (sem imagem rollback)

```
Situacao: Nao existe imagem :rollback ainda
Resultado: Rollback nao e possivel
Acao necessaria: Corrigir manualmente no servidor
```

---

## Arquivos de Backup

```
/root/deploy-backend/backups/
  ├── pre-deploy-20260112-103300.sql
  ├── pre-deploy-20260111-150000.sql
  ├── pre-deploy-20260110-090000.sql
  ├── pre-deploy-20260109-140000.sql
  └── pre-deploy-20260108-110000.sql  (maximo 5 backups)
```

**Para restaurar um backup:**

```bash
# No servidor
cd /root/deploy-backend
docker exec -i crm-postgres psql -U crm_user crm_whatsapp_saas < backups/pre-deploy-XXXXXXXX-XXXXXX.sql
```

---

## Troubleshooting

| Problema | Solucao |
|----------|---------|
| "container name already in use" | Corrigido com docker stop/rm direto |
| Rollback nao funcionou | Verificar se imagem :rollback existe com `docker images` |
| Health check timeout | Aumentar tentativas ou verificar logs |
| Migration falhou | Ver erro especifico, corrigir schema e fazer novo deploy |
| Backup falhou | Verificar se container crm-postgres esta rodando |

---

## Comandos Uteis no Servidor

```bash
# Ver status dos containers
docker compose -f docker-compose.production.yml ps

# Ver logs do backend
docker logs crm-backend --tail=100 -f

# Ver imagens disponiveis
docker images | grep deploy-backend

# Rollback manual
docker tag deploy-backend-backend:rollback deploy-backend-backend:latest
docker stop crm-backend && docker rm -f crm-backend
docker compose -f docker-compose.production.yml up -d --no-deps backend

# Restaurar backup do banco
docker exec -i crm-postgres psql -U crm_user crm_whatsapp_saas < backups/ARQUIVO.sql
```

---

## Seguranca

| Item | Implementacao |
|------|---------------|
| Credenciais | Armazenadas nos GitHub Secrets |
| SSH Key | Removida apos cada execucao |
| .env | Nunca transferido (fica apenas no servidor) |
| Backups | Armazenados localmente no servidor |
| HTTPS | Health check usa URL segura |
