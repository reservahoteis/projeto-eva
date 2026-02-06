# CI/CD Staging (Develop) - Documentacao Detalhada

## Visao Geral

O workflow de staging e acionado quando ha push na branch `develop` e serve para testar as alteracoes antes de irem para producao.

**Arquivo:** `.github/workflows/deploy-staging.yml`

---

## Trigger (Gatilho)

```yaml
on:
  push:
    branches:
      - develop
    paths:
      - 'deploy-backend/**'
      - '.github/workflows/deploy-staging.yml'
  workflow_dispatch:
```

| Configuracao | Explicacao |
|--------------|------------|
| `branches: develop` | So roda quando o push e na branch develop |
| `paths: deploy-backend/**` | So roda se arquivos dentro de deploy-backend forem alterados |
| `paths: .github/workflows/deploy-staging.yml` | Tambem roda se o proprio workflow for alterado |
| `workflow_dispatch` | Permite executar manualmente pelo GitHub Actions |

**Por que isso?** Evita rodar o CI/CD desnecessariamente quando apenas arquivos de documentacao ou frontend sao alterados.

---

## Variaveis de Ambiente

```yaml
env:
  VPS_HOST: ${{ secrets.VPS_HOST }}
  VPS_USER: ${{ secrets.VPS_USER }}
  VPS_PATH: /root/deploy-backend-dev
```

| Variavel | Explicacao |
|----------|------------|
| `VPS_HOST` | IP ou hostname do servidor (armazenado nos secrets do GitHub) |
| `VPS_USER` | Usuario SSH (geralmente root) |
| `VPS_PATH` | Diretorio no servidor onde o codigo sera colocado |

**Por que secrets?** Nunca expor credenciais no codigo. Secrets sao criptografados pelo GitHub.

---

## Job 1: Test

### Step 1: Checkout

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
```

**O que faz:** Clona o repositorio para a maquina virtual do GitHub Actions.

**Por que?** O runner comeca vazio, precisa baixar o codigo para trabalhar.

---

### Step 2: Setup Node.js

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: deploy-backend/package-lock.json
```

| Configuracao | Explicacao |
|--------------|------------|
| `node-version: '20'` | Instala Node.js versao 20 (LTS) |
| `cache: 'npm'` | Cacheia node_modules para acelerar proximas execucoes |
| `cache-dependency-path` | Usa o package-lock.json para determinar quando invalidar cache |

**Por que cache?** Evita baixar todas as dependencias toda vez, economiza ~2-3 minutos.

---

### Step 3: Install Dependencies

```yaml
- name: Install dependencies
  working-directory: deploy-backend
  run: npm ci
```

| Comando | Explicacao |
|---------|------------|
| `working-directory` | Executa o comando dentro da pasta deploy-backend |
| `npm ci` | Instala dependencias exatamente como no package-lock.json |

**Por que `npm ci` e nao `npm install`?**
- `npm ci` e mais rapido
- Garante instalacao identica ao package-lock.json
- Falha se houver divergencia (mais seguro para CI)

---

### Step 4: Linting

```yaml
- name: Run linting
  working-directory: deploy-backend
  run: npm run lint || echo "::warning::Linting issues found"
```

**O que faz:** Verifica padroes de codigo (ESLint).

**Por que `|| echo "::warning::"`?** Se o lint falhar, apenas mostra warning mas nao para o build. Permite continuar mesmo com avisos de estilo.

---

### Step 5: Type Check

```yaml
- name: Run type check
  working-directory: deploy-backend
  run: npx tsc --noEmit || echo "::warning::Type check issues found"
```

| Comando | Explicacao |
|---------|------------|
| `npx tsc` | Executa o compilador TypeScript |
| `--noEmit` | Apenas verifica tipos, nao gera arquivos .js |

**Por que?** Detecta erros de tipagem antes do deploy.

---

### Step 6: Run Tests

```yaml
- name: Run tests
  working-directory: deploy-backend
  run: npm run test -- --passWithNoTests
  env:
    NODE_ENV: test
```

| Configuracao | Explicacao |
|--------------|------------|
| `--passWithNoTests` | Nao falha se nao houver testes (util no inicio do projeto) |
| `NODE_ENV: test` | Define ambiente de teste (carrega .env.test se existir) |

**Por que?** Garante que nenhum teste quebrou com as alteracoes.

**Nota:** Sem `--coverage` no staging para nao falhar por cobertura baixa.

---

## Job 2: Deploy

```yaml
deploy:
  name: Deploy to Dev VPS
  runs-on: ubuntu-latest
  needs: test
  timeout-minutes: 15
```

| Configuracao | Explicacao |
|--------------|------------|
| `needs: test` | So roda se o job "test" passar |
| `timeout-minutes: 15` | Cancela se demorar mais de 15 minutos |

---

### Step 1: Setup SSH Key

```yaml
- name: Setup SSH key
  run: |
    mkdir -p ~/.ssh
    if echo "${{ secrets.VPS_SSH_KEY }}" | grep -q "BEGIN OPENSSH PRIVATE KEY"; then
      echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/deploy_key
    else
      echo "${{ secrets.VPS_SSH_KEY }}" | base64 -d > ~/.ssh/deploy_key
    fi
    chmod 600 ~/.ssh/deploy_key
    ssh-keyscan -H ${{ env.VPS_HOST }} >> ~/.ssh/known_hosts
```

| Comando | Explicacao |
|---------|------------|
| `mkdir -p ~/.ssh` | Cria diretorio .ssh se nao existir |
| `if ... grep -q "BEGIN OPENSSH"` | Verifica se a chave esta em texto ou base64 |
| `chmod 600` | Permissao obrigatoria para chaves SSH (somente dono le) |
| `ssh-keyscan` | Adiciona servidor aos known_hosts (evita prompt interativo) |

**Por que?** Configura autenticacao SSH para conectar no servidor.

---

### Step 2: Test SSH Connection

```yaml
- name: Test SSH connection
  run: |
    ssh -i ~/.ssh/deploy_key -o ConnectTimeout=10 ${{ env.VPS_USER }}@${{ env.VPS_HOST }} "echo 'SSH OK'"
```

**O que faz:** Testa se consegue conectar no servidor.

**Por que?** Falha rapido se houver problema de conexao, antes de gastar tempo com outras etapas.

---

### Step 3: Sync Files (rsync)

```yaml
- name: Sync files to VPS
  run: |
    rsync -avz --delete \
      --exclude 'node_modules' \
      --exclude 'dist' \
      --exclude '.env' \
      --exclude '.env.*' \
      --exclude 'coverage' \
      --exclude 'backups' \
      --exclude '*.test.ts' \
      --exclude 'src/test' \
      -e "ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no" \
      deploy-backend/ \
      ${{ env.VPS_USER }}@${{ env.VPS_HOST }}:${{ env.VPS_PATH }}/
```

| Flag | Explicacao |
|------|------------|
| `-a` | Archive mode (preserva permissoes, timestamps, etc) |
| `-v` | Verbose (mostra arquivos transferidos) |
| `-z` | Comprime durante transferencia |
| `--delete` | Remove arquivos no destino que nao existem na origem |
| `--exclude` | Nao transfere esses arquivos/pastas |
| `-e "ssh -i ..."` | Usa SSH com a chave especifica |

**Arquivos excluidos e por que:**

| Excluido | Motivo |
|----------|--------|
| `node_modules` | Sera instalado no servidor (diferente por OS) |
| `dist` | Sera compilado no servidor |
| `.env` | Configuracoes sensiveis ficam apenas no servidor |
| `coverage` | Relatorios de teste nao vao para producao |
| `*.test.ts` | Arquivos de teste nao vao para producao |

---

### Step 4: Build and Restart Container

```yaml
- name: Build and restart container
  run: |
    ssh -i ~/.ssh/deploy_key ${{ env.VPS_USER }}@${{ env.VPS_HOST }} << 'EOF'
      set -e
      cd /root/deploy-backend-dev

      echo "Building Docker image..."
      docker compose -f docker-compose.dev.yml build backend-dev

      echo "Stopping and removing old container..."
      docker stop crm-backend-dev 2>/dev/null || true
      docker rm -f crm-backend-dev 2>/dev/null || true

      echo "Starting new container..."
      docker compose -f docker-compose.dev.yml up -d --no-deps backend-dev

      echo "Waiting for container..."
      sleep 10

      echo "Running migrations..."
      docker compose -f docker-compose.dev.yml exec -T backend-dev npx prisma migrate deploy || true

      echo "Container status:"
      docker compose -f docker-compose.dev.yml ps backend-dev
    EOF
```

| Comando | Explicacao |
|---------|------------|
| `<< 'EOF'` | Heredoc - envia multiplos comandos via SSH |
| `set -e` | Para imediatamente se qualquer comando falhar |
| `docker compose build` | Constroi a imagem Docker com o novo codigo |
| `docker stop crm-backend-dev` | Para o container atual |
| `docker rm -f crm-backend-dev` | Remove o container (forcado) |
| `2>/dev/null \|\| true` | Ignora erros (container pode nao existir) |
| `up -d --no-deps` | Inicia container em background, sem recriar dependencias |
| `sleep 10` | Aguarda container inicializar |
| `prisma migrate deploy` | Aplica migrations pendentes no banco |
| `\|\| true` | Nao falha se migration der erro (apenas warning) |

**Por que `docker stop` + `docker rm` direto?**
O `docker compose up --force-recreate` as vezes falha com "container name already in use". Parar e remover diretamente resolve o problema.

---

### Step 5: Health Check

```yaml
- name: Health check
  run: |
    for i in {1..20}; do
      RESPONSE=$(ssh -i ~/.ssh/deploy_key ${{ env.VPS_USER }}@${{ env.VPS_HOST }} "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/health" || echo "000")
      if [ "$RESPONSE" = "200" ]; then
        echo "Health check OK!"
        exit 0
      fi
      echo "Attempt $i/20 - Status: $RESPONSE"
      sleep 5
    done
    echo "Health check failed"
    ssh -i ~/.ssh/deploy_key ${{ env.VPS_USER }}@${{ env.VPS_HOST }} "docker logs crm-backend-dev --tail=30"
    exit 1
```

| Parte | Explicacao |
|-------|------------|
| `for i in {1..20}` | Tenta 20 vezes (20 x 5s = 100s maximo) |
| `curl -s -o /dev/null -w '%{http_code}'` | Faz requisicao e retorna apenas o status HTTP |
| `http://localhost:3002/health` | Endpoint de health check (porta do dev) |
| `exit 0` | Sucesso - para o loop |
| `docker logs --tail=30` | Se falhar, mostra ultimas 30 linhas de log |
| `exit 1` | Falha o workflow |

**Por que?** Verifica se a API realmente subiu e esta respondendo.

---

### Step 6: Cleanup

```yaml
- name: Cleanup
  if: always()
  run: rm -f ~/.ssh/deploy_key
```

| Configuracao | Explicacao |
|--------------|------------|
| `if: always()` | Roda mesmo se steps anteriores falharem |
| `rm -f ~/.ssh/deploy_key` | Remove a chave SSH por seguranca |

**Por que?** Nao deixar chaves SSH em maquinas temporarias.

---

## Fluxo Resumido

```
1. Push em develop
      |
      v
2. [TEST] Checkout -> Node.js -> npm ci -> Lint -> TypeCheck -> Tests
      |
      v (se passar)
3. [DEPLOY] SSH -> rsync -> Build Docker -> Stop/Remove -> Start -> Migrations
      |
      v
4. Health Check (20 tentativas)
      |
      v
5. Cleanup SSH Key
```

---

## Portas e URLs

| Ambiente | Porta | URL |
|----------|-------|-----|
| Staging | 3002 | http://localhost:3002 (interno) |

---

## Troubleshooting

| Problema | Solucao |
|----------|---------|
| "container name already in use" | Corrigido com docker stop/rm direto |
| SSH connection refused | Verificar VPS_HOST e VPS_SSH_KEY nos secrets |
| Health check failed | Ver logs com `docker logs crm-backend-dev` |
| Migration failed | Verificar schema do Prisma e conexao com banco |
