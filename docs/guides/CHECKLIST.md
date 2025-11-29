# GitHub Actions Deploy - Setup Checklist

Lista de verificação completa para configurar e validar o deploy automático.

---

## Checklist de Setup Inicial

### Fase 1: Preparação do VPS (5 minutos)

- [ ] **VPS acessível via SSH**
  ```bash
  ssh root@72.61.39.235
  # Deve conectar sem erros
  ```

- [ ] **Docker instalado e rodando**
  ```bash
  docker --version
  systemctl status docker
  # Deve mostrar "active (running)"
  ```

- [ ] **Gerar SSH key para GitHub Actions**
  ```bash
  ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_actions_deploy -N ""
  # OU usar script:
  wget https://raw.githubusercontent.com/SEU-USUARIO/SEU-REPO/master/.github/scripts/setup-deploy-keys.sh
  chmod +x setup-deploy-keys.sh
  sudo ./setup-deploy-keys.sh
  ```

- [ ] **Adicionar chave pública ao authorized_keys**
  ```bash
  cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  ```

- [ ] **Testar chave SSH**
  ```bash
  ssh -i ~/.ssh/github_actions_deploy root@localhost "echo OK"
  # Deve retornar "OK"
  ```

- [ ] **Criar diretório de deploy**
  ```bash
  mkdir -p /root/deploy-backend
  mkdir -p /root/deploy-backend/backups
  mkdir -p /root/deploy-backend/nginx/conf.d
  mkdir -p /root/deploy-backend/certbot/{conf,www}
  ```

- [ ] **Criar arquivo .env.production**
  ```bash
  cd /root/deploy-backend
  nano .env.production
  # Preencher com credenciais reais
  chmod 600 .env.production
  ```

---

### Fase 2: Configuração do GitHub (3 minutos)

- [ ] **Copiar chave privada SSH**
  ```bash
  cat ~/.ssh/github_actions_deploy
  # Copiar TODA a saída (incluindo BEGIN/END)
  ```

- [ ] **Configurar GitHub Secret: VPS_SSH_KEY**
  - Acessar: `https://github.com/SEU-USUARIO/SEU-REPO/settings/secrets/actions`
  - New repository secret
  - Name: `VPS_SSH_KEY`
  - Value: (colar chave privada completa)
  - Add secret

- [ ] **Configurar GitHub Secret: VPS_HOST**
  - New repository secret
  - Name: `VPS_HOST`
  - Value: `72.61.39.235`
  - Add secret

- [ ] **Configurar GitHub Secret: VPS_USER**
  - New repository secret
  - Name: `VPS_USER`
  - Value: `root`
  - Add secret

- [ ] **Configurar GitHub Secret: VPS_PATH**
  - New repository secret
  - Name: `VPS_PATH`
  - Value: `/root/deploy-backend`
  - Add secret

- [ ] **Verificar secrets configurados**
  - Settings > Secrets > Actions
  - Deve haver 4 secrets: VPS_SSH_KEY, VPS_HOST, VPS_USER, VPS_PATH

---

### Fase 3: Primeiro Deploy (2 minutos)

- [ ] **Testar deploy manual**
  - Acessar: `https://github.com/SEU-USUARIO/SEU-REPO/actions`
  - Selecionar workflow: "Deploy to Production VPS"
  - Click "Run workflow"
  - Branch: master
  - Click "Run workflow"

- [ ] **Acompanhar execução**
  - Ver logs em tempo real
  - Todos steps devem ficar verdes (✓)
  - Tempo esperado: ~2-3 minutos

- [ ] **Verificar deploy no VPS**
  ```bash
  ssh root@72.61.39.235
  cd /root/deploy-backend
  docker-compose -f docker-compose.production.yml ps
  # Todos containers devem estar "Up"
  ```

- [ ] **Testar health check**
  ```bash
  curl http://localhost:3001/health
  # Deve retornar JSON com "status": "healthy"
  
  curl https://api.botreserva.com.br/api/health
  # Deve retornar HTTP 200
  ```

---

### Fase 4: Validação (2 minutos)

- [ ] **Verificar containers rodando**
  ```bash
  docker ps --format "table {{.Names}}\t{{.Status}}"
  # Deve listar: crm-backend, crm-postgres, crm-redis, crm-nginx
  ```

- [ ] **Verificar logs sem erros**
  ```bash
  docker logs crm-backend --tail=50 | grep -i error
  # Não deve haver erros críticos
  ```

- [ ] **Verificar database conectado**
  ```bash
  docker exec crm-postgres pg_isready -U crm_user
  # Deve retornar "accepting connections"
  ```

- [ ] **Verificar Redis conectado**
  ```bash
  docker exec crm-redis redis-cli -a $REDIS_PASSWORD ping
  # Deve retornar "PONG"
  ```

- [ ] **Verificar backup criado**
  ```bash
  ls -lth /root/deploy-backend/backups/
  # Deve haver backup com nome pre-deploy-*
  ```

---

## Checklist de Operação Diária

### Deploy Automático

- [ ] Fazer mudanças no código (em `deploy-backend/`)
- [ ] Commit: `git commit -m "feat: nova feature"`
- [ ] Push: `git push origin master`
- [ ] Aguardar deploy automático (~2-3 min)
- [ ] Verificar em GitHub Actions se passou
- [ ] Verificar health check: `curl https://api.botreserva.com.br/api/health`

### Monitoramento

- [ ] Ver logs: `docker logs crm-backend -f`
- [ ] Ver status: `docker-compose ps`
- [ ] Ver uso de recursos: `docker stats --no-stream`
- [ ] Ver espaço em disco: `df -h`

---

## Checklist de Troubleshooting

Se algo der errado, siga esta ordem:

- [ ] **Ver logs do GitHub Actions**
  - Actions > Click no workflow falhado
  - Identificar step com erro
  - Ler mensagem de erro

- [ ] **Ver logs do backend**
  ```bash
  docker logs crm-backend --tail=100
  ```

- [ ] **Verificar containers**
  ```bash
  docker-compose -f docker-compose.production.yml ps
  docker ps -a
  ```

- [ ] **Verificar conectividade**
  ```bash
  ping 72.61.39.235
  ssh root@72.61.39.235 "echo OK"
  ```

- [ ] **Verificar disk space**
  ```bash
  df -h /root/deploy-backend
  ```

- [ ] **Consultar TROUBLESHOOTING.md**
  - Procurar erro específico
  - Seguir solução sugerida

- [ ] **Fazer rollback se necessário**
  ```bash
  cd /root/deploy-backend
  ls -lth backups/
  # Restaurar último backup
  ```

---

## Checklist de Segurança

### Mensal

- [ ] Rotacionar SSH key (trimestral recomendado)
- [ ] Verificar logs de acesso SSH
- [ ] Atualizar dependências npm
- [ ] Atualizar imagens Docker
- [ ] Limpar backups antigos
- [ ] Verificar certificado SSL (validade)

### Auditoria

- [ ] Revisar GitHub Actions logs
- [ ] Verificar acessos SSH não autorizados
- [ ] Verificar uso de disco
- [ ] Verificar containers rodando como non-root
- [ ] Verificar permissões de arquivos sensíveis

---

## Checklist de Manutenção

### Semanal

- [ ] Verificar espaço em disco: `df -h`
- [ ] Verificar logs para erros: `docker logs crm-backend | grep -i error`
- [ ] Verificar health dos containers: `docker-compose ps`
- [ ] Verificar backups: `ls -lth backups/ | head -10`

### Mensal

- [ ] Limpar backups antigos (manter últimos 10)
- [ ] Limpar Docker cache: `docker system prune -f`
- [ ] Atualizar dependências
- [ ] Backup completo offsite
- [ ] Verificar certificados SSL

---

## Checklist de Emergência

### Se o site estiver fora do ar

1. [ ] **Verificar VPS está online**
   ```bash
   ping 72.61.39.235
   ```

2. [ ] **Verificar Nginx rodando**
   ```bash
   docker ps | grep nginx
   ```

3. [ ] **Verificar backend rodando**
   ```bash
   docker ps | grep backend
   ```

4. [ ] **Reiniciar containers se necessário**
   ```bash
   docker-compose -f docker-compose.production.yml restart
   ```

5. [ ] **Verificar logs**
   ```bash
   docker logs crm-backend --tail=50
   docker logs crm-nginx --tail=50
   ```

6. [ ] **Fazer rollback se necessário**
   ```bash
   cd /root/deploy-backend
   BACKUP=$(ls -t backups/ | head -1)
   rm -rf dist
   cp -r backups/$BACKUP/dist .
   docker-compose -f docker-compose.production.yml restart backend
   ```

---

## Status Final

Após completar todos os checklists acima, você deve ter:

✅ Deploy automático funcionando
✅ Backup automático antes de cada deploy
✅ Health check validando aplicação
✅ Rollback disponível em caso de falha
✅ Logs detalhados no GitHub Actions
✅ Monitoramento via Docker
✅ Documentação completa disponível

**Próximo passo**: Comece a usar! Faça mudanças em `deploy-backend/` e dê push para `master`.

---

**Documentação completa**: `.github/INDEX.md`
**Suporte**: `.github/TROUBLESHOOTING.md`

---

**Última atualização**: 2025-11-15
