# GitHub Configuration

Esta pasta contém configurações e automações do GitHub para o projeto **BotReserva**.

## Estrutura

```
.github/
├── workflows/
│   └── deploy-production.yml    # Workflow de deploy automático
├── scripts/
│   └── setup-deploy-keys.sh     # Script auxiliar para setup SSH
├── DEPLOY-SETUP.md              # Guia completo de configuração
├── TROUBLESHOOTING.md           # Guia de solução de problemas
└── README.md                    # Este arquivo
```

---

## Workflows

### deploy-production.yml

Deploy automático para VPS de produção via SSH + rsync.

**Trigger**:
- Push para `master` com mudanças em `deploy-backend/`
- Manual via workflow_dispatch

**Secrets necessários**:
- `VPS_SSH_KEY` - Chave SSH privada para conectar ao VPS
- `VPS_HOST` - IP do VPS (72.61.39.235)
- `VPS_USER` - Usuário SSH (root)
- `VPS_PATH` - Caminho no VPS (/root/deploy-backend)

**Etapas**:
1. Checkout do código
2. Setup SSH
3. Pre-deployment checks (conectividade, disco, Docker)
4. Backup automático
5. Rsync de deploy-backend/ para VPS
6. npm ci + build
7. Database migrations
8. Restart backend container
9. Health check (30 tentativas, 5s intervalo)
10. Post-deployment verification

**Logs**:
- Todos os steps têm logs detalhados agrupados
- Em caso de falha, mostra logs dos últimos 50 linhas do backend

---

## Scripts

### setup-deploy-keys.sh

Script auxiliar para executar **NO VPS** e configurar SSH keys automaticamente.

**Uso**:

```bash
# No VPS:
wget https://raw.githubusercontent.com/SEU-USUARIO/SEU-REPO/master/.github/scripts/setup-deploy-keys.sh
chmod +x setup-deploy-keys.sh
sudo ./setup-deploy-keys.sh
```

**O que faz**:
- Cria diretório `.ssh` com permissões corretas
- Gera chave SSH ed25519 dedicada
- Adiciona ao `authorized_keys`
- Testa a chave localmente
- Prepara diretórios de deploy
- Exibe a chave privada para copiar ao GitHub

---

## Documentação

### DEPLOY-SETUP.md

Guia completo passo-a-passo para configurar o deploy automático pela primeira vez.

**Inclui**:
- Pré-requisitos
- Como gerar SSH keys no VPS
- Como configurar GitHub Secrets
- Como preparar o VPS
- Como criar .env.production
- Como testar o workflow
- Como monitorar deploys
- Troubleshooting básico
- Segurança e boas práticas
- Otimizações futuras

### TROUBLESHOOTING.md

Guia de solução de problemas organizado por tipo de erro.

**Seções**:
- Erros de SSH
- Erros de Build
- Erros de Database
- Erros de Health Check
- Erros de Docker
- Erros de Disco
- Rollback (automático e manual)
- Comandos úteis
- Checklist de diagnóstico

---

## Como Usar

### Primeiro Deploy

1. **No VPS**, execute o script de setup:

```bash
wget https://raw.githubusercontent.com/SEU-USUARIO/SEU-REPO/master/.github/scripts/setup-deploy-keys.sh
chmod +x setup-deploy-keys.sh
sudo ./setup-deploy-keys.sh
```

2. Copie a chave privada exibida

3. **No GitHub**, configure os Secrets:
   - Settings > Secrets and variables > Actions > New repository secret
   - Adicione: VPS_SSH_KEY, VPS_HOST, VPS_USER, VPS_PATH

4. **No VPS**, crie o arquivo `.env.production`:

```bash
cd /root/deploy-backend
cp .env.production.example .env.production
nano .env.production
# Preencha com valores reais
```

5. Teste o workflow:
   - GitHub > Actions > Deploy to Production VPS > Run workflow

### Deploys Subsequentes

Apenas faça push para `master` com mudanças em `deploy-backend/`:

```bash
git add deploy-backend/
git commit -m "feat: nova feature XYZ"
git push origin master
```

O deploy será automático.

### Monitorar Deploy

**No GitHub**:
- Actions > Deploy to Production VPS > Ver execução em andamento

**No VPS**:

```bash
# Logs em tempo real
ssh root@72.61.39.235
cd /root/deploy-backend
docker-compose -f docker-compose.production.yml logs -f backend
```

### Em Caso de Falha

1. Veja logs detalhados no GitHub Actions
2. Conecte ao VPS e verifique:

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# Ver logs
docker-compose -f docker-compose.production.yml logs backend

# Ver status
docker-compose -f docker-compose.production.yml ps

# Testar health
curl http://localhost:3001/health
```

3. Consulte `TROUBLESHOOTING.md` para erros específicos

4. Se necessário, faça rollback:

```bash
cd /root/deploy-backend
ls -lth backups/
# Copie o nome do último backup

rm -rf dist
cp -r backups/pre-deploy-YYYYMMDD-HHMMSS/dist .
docker-compose -f docker-compose.production.yml restart backend
```

---

## Segurança

### SSH Key

- Chave dedicada exclusiva para GitHub Actions
- Tipo: ed25519 (mais segura que RSA)
- Armazenada como Secret (nunca commitada)
- Rotação recomendada a cada 90 dias

### Secrets

Nunca commite:
- VPS_SSH_KEY (chave privada)
- Senhas de database
- JWT secrets
- API keys

Use GitHub Secrets para todos valores sensíveis.

### Backup

- Backup automático antes de cada deploy
- Mantém últimos 5 backups
- Backup de dist/, package.json e database
- Rollback disponível a qualquer momento

### Permissões

- Containers rodam com usuário non-root (nodejs:1001)
- Volumes Nginx montados read-only
- SSH limitado ao usuário root do VPS

---

## Compatibilidade

O workflow mantém compatibilidade com deploy manual.

Você ainda pode usar `deploy.sh` se necessário:

```bash
ssh root@72.61.39.235
cd /root/deploy-backend
./scripts/deploy.sh
```

---

## Métricas

### Tempo Médio de Deploy

- Sync: ~10-30s (depende de mudanças)
- Build: ~60-90s
- Migrations: ~5-10s
- Restart: ~10-20s
- Health check: ~5-30s

**Total**: ~2-3 minutos

### Downtime

- ~10-20 segundos (durante restart do container)
- Para zero downtime, considere blue-green deployment

---

## Roadmap

Melhorias futuras planejadas:

- [ ] Cache de node_modules no VPS
- [ ] Blue-green deployment (zero downtime)
- [ ] Notificações Slack/Discord
- [ ] Rollback automático em caso de falha
- [ ] Deploy de staging antes de production
- [ ] Testes automatizados antes do deploy
- [ ] Performance monitoring pós-deploy
- [ ] Changelog automático

---

## Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [SSH Key Management](https://www.ssh.com/academy/ssh/key)

---

## Suporte

- **Documentação completa**: `DEPLOY-SETUP.md`
- **Problemas comuns**: `TROUBLESHOOTING.md`
- **Deploy manual**: `docs/GUIA-DEPLOY.md`
- **Arquitetura**: `docs/ARQUITETURA-IDEAL.md`

---

**Versão**: 1.0.0
**Última atualização**: 2025-11-15
**Autor**: DevOps Engineer Agent
