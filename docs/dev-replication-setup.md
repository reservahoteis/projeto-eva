# Replicacao Producao para Desenvolvimento

Este documento descreve como configurar a replicacao unidirecional de dados
do ambiente de producao para o ambiente de desenvolvimento.

## Visao Geral

A replicacao funciona de forma **hibrida**:

1. **Webhooks em tempo real**: Todos os webhooks do WhatsApp recebidos em producao
   sao replicados instantaneamente para desenvolvimento (fire-and-forget)

2. **Banco de dados periodico**: A cada 5 minutos, o banco de producao e copiado
   para desenvolvimento via pg_dump/restore

```
+-------------+         +-------------+
|  PRODUCAO   |         |   DEV       |
|-------------|         |-------------|
| WhatsApp -> | ------> | Webhook     |  (tempo real)
|             |         |             |
| PostgreSQL  | ------> | PostgreSQL  |  (a cada 5 min)
+-------------+         +-------------+
```

**IMPORTANTE**: A replicacao e UNIDIRECIONAL. Alteracoes no dev NAO afetam producao.

## Pre-requisitos

- Ambos os ambientes rodando na mesma VPS (containers Docker diferentes)
- Containers de banco acessiveis entre si
- Permissao para configurar cron jobs

## Configuracao

### 1. Variaveis de Ambiente (Producao)

Adicione ao `.env` do ambiente de PRODUCAO:

```bash
# Habilitar replicacao de webhooks
REPLICATE_WEBHOOKS_TO_DEV=true

# URL do webhook de desenvolvimento
# Use o nome do container se estiver na mesma rede Docker
DEV_WEBHOOK_URL=http://crm-backend-dev:3001/webhooks/whatsapp

# Timeout para chamadas ao dev (ms)
DEV_WEBHOOK_TIMEOUT=5000
```

### 2. Script de Sync do Banco

O script esta localizado em `deploy-backend/scripts/sync-prod-to-dev.sh`.

#### Variaveis de ambiente (opcionais):

```bash
# Container PostgreSQL de producao
export PROD_DB_CONTAINER=crm-postgres

# Nome do banco de producao
export PROD_DATABASE=crm_production

# Usuario do banco de producao
export PROD_DB_USER=postgres

# Container PostgreSQL de desenvolvimento
export DEV_DB_CONTAINER=crm-postgres-dev

# Nome do banco de desenvolvimento
export DEV_DATABASE=crm_development

# Usuario do banco de desenvolvimento
export DEV_DB_USER=postgres
```

#### Teste manual:

```bash
# Teste simulado (nao faz alteracoes)
./deploy-backend/scripts/sync-prod-to-dev.sh --dry-run

# Executar sync real
./deploy-backend/scripts/sync-prod-to-dev.sh
```

### 3. Configurar Cron Job

Use o script de setup para instalar o cron:

```bash
# Instalar cron (executa a cada 5 minutos)
./deploy-backend/scripts/setup-sync-cron.sh --install

# Verificar status
./deploy-backend/scripts/setup-sync-cron.sh --status

# Remover cron
./deploy-backend/scripts/setup-sync-cron.sh --remove
```

Para alterar o intervalo:

```bash
export SYNC_CRON_INTERVAL=10  # 10 minutos
./deploy-backend/scripts/setup-sync-cron.sh --install
```

## Monitoramento

### Logs de Webhook Replication

Os logs aparecem no output do backend de producao:

```bash
docker logs crm-backend -f | grep -i "replicate"
```

Mensagens esperadas:
- `Webhook replicated to dev environment` - Sucesso
- `Failed to replicate webhook to dev environment` - Falha (nao afeta prod)
- `Dev environment unavailable for webhook replication` - Dev offline

### Logs do Sync de Banco

```bash
# Ver logs do dia atual
tail -f /var/log/crm-sync/sync-$(date +%Y%m%d).log

# Ver ultimos 50 logs
tail -50 /var/log/crm-sync/sync-*.log
```

## Comportamento

### Webhook Replication

- **Fire-and-forget**: Producao nao espera resposta do dev
- **Timeout**: 5 segundos (configuravel)
- **Falhas silenciosas**: Erros sao logados mas nao afetam producao
- **Headers replicados**: `x-hub-signature-256`, `content-type`
- **Headers adicionados**: `x-replicated-from: production`, `x-replicated-at`

### Database Sync

- **pg_dump completo**: Todas as tabelas exceto as listadas em EXCLUDE_TABLES
- **Conexoes encerradas**: Mata conexoes ativas no dev antes do restore
- **Sequences atualizadas**: Atualiza sequences apos restore
- **Limpeza automatica**: Mantem apenas os ultimos 5 dumps

## Resolucao de Problemas

### Webhook nao esta sendo replicado

1. Verificar se `REPLICATE_WEBHOOKS_TO_DEV=true` na producao
2. Verificar se `DEV_WEBHOOK_URL` esta correto
3. Verificar se o container de dev esta acessivel:
   ```bash
   docker exec crm-backend curl -I http://crm-backend-dev:3001/health
   ```

### Sync de banco falhando

1. Verificar se os containers estao rodando:
   ```bash
   docker ps | grep crm-postgres
   ```

2. Testar conexao com os bancos:
   ```bash
   docker exec crm-postgres psql -U postgres -d crm_production -c "SELECT 1"
   docker exec crm-postgres-dev psql -U postgres -d crm_development -c "SELECT 1"
   ```

3. Verificar espaco em disco:
   ```bash
   df -h /tmp
   ```

### Dev recebendo dados duplicados

Isso e esperado! Os webhooks vem em tempo real E o banco sincroniza periodicamente.
A aplicacao deve tratar duplicatas via `whatsappMessageId` unico.

## Seguranca

- **NUNCA** habilite replicacao no ambiente de desenvolvimento
- Os secrets do WhatsApp sao compartilhados (mesmo tenant)
- Dados sensiveis (tokens, senhas) sao copiados - OK para dev interno
- Se dev for externo, considere sanitizar dados antes do sync

## Excluindo Tabelas do Sync

Edite o script `sync-prod-to-dev.sh` e adicione tabelas ao array:

```bash
EXCLUDE_TABLES=(
    "_prisma_migrations"
    "sensitive_data"
)
```
