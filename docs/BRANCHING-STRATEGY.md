# Estrategia de Branches e Deploy

## Visao Geral

Este projeto utiliza uma estrategia de branches baseada em **Git Flow simplificado** com dois ambientes:

- **Production** (master) - Ambiente de producao em `api.botreserva.com.br`
- **Staging** (develop) - Ambiente de desenvolvimento/testes na porta 3002

```
┌─────────────────────────────────────────────────────────────┐
│                      FLUXO DE DEPLOY                        │
└─────────────────────────────────────────────────────────────┘

  develop                          master
     │                                │
     │ push                           │
     ▼                                │
 ┌───────────┐                        │
 │  Testes   │                        │
 │  Lint     │                        │
 │  Type     │                        │
 └─────┬─────┘                        │
       │ passou                       │
       ▼                              │
 ┌───────────────┐                    │
 │ Deploy        │                    │
 │ STAGING       │                    │
 │ (porta 3002)  │                    │
 └───────┬───────┘                    │
         │                            │
         │ testou e aprovou           │
         │                            │
         ▼                            │
    ┌─────────┐                       │
    │  Merge  │ ─────────────────────►│
    │  PR     │                       │
    └─────────┘                       │
                                      ▼
                              ┌───────────┐
                              │  Testes   │
                              │  Security │
                              └─────┬─────┘
                                    │ passou
                                    ▼
                              ┌───────────────┐
                              │ Deploy        │
                              │ PRODUCTION    │
                              │ (porta 443)   │
                              └───────────────┘
```

## Branches

### `master` (Producao)
- Branch principal e protegida
- Somente recebe merges de `develop` via Pull Request
- Deploy automatico para producao quando alteracoes em `deploy-backend/`
- URL: https://api.botreserva.com.br

### `develop` (Desenvolvimento)
- Branch de desenvolvimento
- Recebe features e bug fixes
- Deploy automatico para staging quando alteracoes em `deploy-backend/`
- URL: http://VPS_IP:3002

## Ambientes

### Production
- **URL:** https://api.botreserva.com.br
- **Porta:** 443 (HTTPS via nginx)
- **Database:** crm_whatsapp_saas (porta 5432)
- **Redis:** porta 6379
- **Diretorio VPS:** /root/deploy-backend

### Staging
- **URL:** http://VPS_IP:3002
- **Porta:** 3002
- **Database:** staging_whatsapp_saas (porta 5433)
- **Redis:** porta 6379 (separado)
- **Diretorio VPS:** /root/staging-backend

## CI/CD Pipelines

### Staging (deploy-staging.yml)
Triggered: Push para `develop` com alteracoes em `deploy-backend/`

```yaml
Jobs:
1. test          - Executa testes, lint, type check
2. deploy        - Deploy para staging (se testes passarem)
   - Sync files (rsync)
   - Build Docker image
   - Start containers
   - Run migrations
   - Health check
   - Smoke tests
```

### Production (deploy-production.yml)
Triggered: Push para `master` com alteracoes em `deploy-backend/`

```yaml
Jobs:
1. test          - Executa testes, lint, type check
2. security      - npm audit, dependency check
3. deploy        - Deploy para producao (se testes e security passarem)
   - Backup (Docker image + database)
   - Sync files (rsync)
   - Build Docker image
   - Start containers
   - Run migrations
   - Health check
   - Post-deployment verification
```

## Fluxo de Trabalho

### 1. Desenvolvimento de Nova Feature

```bash
# Partir da develop atualizada
git checkout develop
git pull origin develop

# Criar feature branch (opcional para features grandes)
git checkout -b feature/nome-da-feature

# Desenvolver e commitar
git add .
git commit -m "feat: descricao da feature"

# Push para develop (ou merge da feature branch)
git push origin develop
```

### 2. Deploy para Staging (Automatico)

Apos push para `develop`:
1. CI executa testes
2. Se passar, faz deploy para staging
3. Testar em http://VPS_IP:3002

### 3. Promover para Producao

```bash
# Criar PR de develop -> master
# Via GitHub ou:
git checkout master
git pull origin master
git merge develop
git push origin master
```

### 4. Deploy para Producao (Automatico)

Apos merge para `master`:
1. CI executa testes + security check
2. Cria backup automatico
3. Deploy para producao
4. Health check e verificacao

## Comandos Uteis

### Ver status dos containers

```bash
# Producao
ssh root@VPS_IP "cd /root/deploy-backend && docker compose -f docker-compose.production.yml ps"

# Staging
ssh root@VPS_IP "cd /root/staging-backend && docker compose -f docker-compose.staging.yml ps"
```

### Ver logs

```bash
# Producao
ssh root@VPS_IP "docker logs crm-backend --tail=100"

# Staging
ssh root@VPS_IP "docker logs staging-backend --tail=100"
```

### Rollback Manual

```bash
# Listar backups disponiveis
ssh root@VPS_IP "docker images | grep backup"

# Restaurar backup especifico
ssh root@VPS_IP "docker tag deploy-backend-backend:backup-YYYYMMDD deploy-backend-backend:latest"
ssh root@VPS_IP "cd /root/deploy-backend && docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate backend"
```

## Arquivos de Configuracao

### Docker Compose

| Arquivo | Ambiente | Uso |
|---------|----------|-----|
| `docker-compose.production.yml` | Production | Deploy em producao |
| `docker-compose.staging.yml` | Staging | Deploy em staging |
| `docker-compose.yml` | Local | Desenvolvimento local |

### Workflows

| Arquivo | Trigger | Ambiente |
|---------|---------|----------|
| `.github/workflows/deploy-production.yml` | Push master | Production |
| `.github/workflows/deploy-staging.yml` | Push develop | Staging |

## Secrets Necessarios (GitHub)

```
VPS_HOST        - IP do servidor VPS
VPS_USER        - Usuario SSH (root)
VPS_PATH        - Caminho producao (/root/deploy-backend)
VPS_SSH_KEY     - Chave SSH privada (base64 ou raw)
```

## Boas Praticas

1. **Nunca fazer push direto para master**
2. **Sempre testar em staging antes de producao**
3. **Manter develop atualizado com master**
4. **Commits atomicos e bem descritos**
5. **PRs com descricao clara das mudancas**
6. **Revisar logs apos cada deploy**
