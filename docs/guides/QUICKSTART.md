# GitHub Actions Deploy - Quickstart

Guia rápido de 5 minutos para configurar deploy automático.

---

## TL;DR

```bash
# 1. No VPS - Gerar SSH key
ssh root@72.61.39.235
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_actions_deploy -N ""
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions_deploy  # Copie isto

# 2. No GitHub - Configurar Secrets
# Settings > Secrets > New secret
# VPS_SSH_KEY = (cole a chave privada acima)
# VPS_HOST = 72.61.39.235
# VPS_USER = root
# VPS_PATH = /root/deploy-backend

# 3. No VPS - Preparar deploy
mkdir -p /root/deploy-backend
cd /root/deploy-backend
# Criar .env.production com suas credenciais

# 4. No GitHub - Testar
# Actions > Deploy to Production VPS > Run workflow

# 5. Pronto! 🚀
```

---

## Passo a Passo (Detalhado)

### 1. Gerar SSH Key (2 min)

Execute no VPS:

```bash
ssh root@72.61.39.235
```

```bash
# Gerar chave
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Autorizar chave
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Exibir chave PRIVADA (copie TUDO)
cat ~/.ssh/github_actions_deploy
```

**Copie** a saída completa (incluindo BEGIN/END).

---

### 2. Configurar GitHub Secrets (1 min)

1. Acesse: `https://github.com/SEU-USUARIO/SEU-REPO/settings/secrets/actions`

2. Clique **New repository secret** 4 vezes:

| Name | Value |
|------|-------|
| `VPS_SSH_KEY` | (cole a chave privada do passo 1) |
| `VPS_HOST` | `72.61.39.235` |
| `VPS_USER` | `root` |
| `VPS_PATH` | `/root/deploy-backend` |

---

### 3. Preparar VPS (2 min)

Execute no VPS:

```bash
# Criar diretório
mkdir -p /root/deploy-backend
cd /root/deploy-backend

# Criar .env.production
cat > .env.production << 'EOF'
# Database
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=SuaSenhaAqui123
POSTGRES_DB=crm_whatsapp_saas

# Redis
REDIS_PASSWORD=SuaSenhaRedis456

# JWT
JWT_SECRET=seu-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=seu-refresh-secret

# URLs
FRONTEND_URL=https://app.botreserva.com.br
BASE_DOMAIN=botreserva.com.br

# WhatsApp
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu-token

# Super Admin
SUPER_ADMIN_EMAIL=admin@botreserva.com.br
SUPER_ADMIN_PASSWORD=SenhaAdmin789
EOF

# Proteger arquivo
chmod 600 .env.production

# Criar estrutura
mkdir -p backups nginx/conf.d certbot/conf certbot/www

# Verificar Docker
docker info
```

Se Docker não estiver rodando:

```bash
sudo systemctl start docker
sudo systemctl enable docker
```

---

### 4. Testar Deploy (30 seg)

1. Acesse: `https://github.com/SEU-USUARIO/SEU-REPO/actions`

2. Clique em **Deploy to Production VPS**

3. Clique em **Run workflow**

4. Selecione branch `master`

5. Clique em **Run workflow**

6. Aguarde ~2-3 minutos

7. Se todos os steps ficarem verdes ✓, **sucesso!**

---

### 5. Verificar (30 seg)

```bash
# No VPS
ssh root@72.61.39.235
cd /root/deploy-backend

# Ver containers rodando
docker-compose -f docker-compose.production.yml ps

# Ver logs
docker-compose -f docker-compose.production.yml logs -f backend

# Testar health check
curl http://localhost:3001/health
curl https://api.botreserva.com.br/api/health
```

Se retornar JSON com `"status": "healthy"`, está **funcionando!** 🎉

---

## Uso Diário

### Deploy Automático

Apenas faça push para `master` com mudanças em `deploy-backend/`:

```bash
# Fazer mudanças no código
cd deploy-backend/src
# ... editar arquivos ...

# Commit e push
git add .
git commit -m "feat: nova funcionalidade"
git push origin master
```

Deploy acontece **automaticamente** em ~2-3 minutos.

### Deploy Manual

Se preferir controle manual:

```bash
# GitHub > Actions > Deploy to Production VPS > Run workflow
```

### Monitorar

```bash
# Ver logs em tempo real
ssh root@72.61.39.235
docker-compose -f /root/deploy-backend/docker-compose.production.yml logs -f backend
```

---

## Troubleshooting Rápido

### Deploy falhou?

1. **Ver logs**: GitHub Actions > Click no workflow falhado > Ver step com erro

2. **Erros comuns**:

   **SSH Permission denied**:
   ```bash
   # No VPS, verificar:
   cat ~/.ssh/authorized_keys | grep github
   chmod 600 ~/.ssh/authorized_keys
   ```

   **Health check failed**:
   ```bash
   # Ver logs do backend
   docker logs crm-backend --tail=50
   ```

   **Disk space**:
   ```bash
   # Limpar Docker
   docker system prune -a -f
   ```

3. **Documentação completa**: Veja `.github/TROUBLESHOOTING.md`

### Rollback

Se algo der errado:

```bash
ssh root@72.61.39.235
cd /root/deploy-backend

# Ver backups
ls -lth backups/

# Restaurar último backup
BACKUP=$(ls -t backups/ | head -1)
rm -rf dist
cp -r backups/$BACKUP/dist .
docker-compose -f docker-compose.production.yml restart backend
```

---

## Próximos Passos

Configuração básica completa! Explore:

- **Deploy avançado**: `.github/DEPLOY-SETUP.md`
- **Troubleshooting**: `.github/TROUBLESHOOTING.md`
- **Segurança**: `.github/SECRETS-EXAMPLE.md`
- **Estrutura completa**: `.github/README.md`

---

## Checklist

Use isto para garantir que fez tudo:

- [ ] SSH key gerada no VPS
- [ ] 4 GitHub Secrets configurados (VPS_SSH_KEY, VPS_HOST, VPS_USER, VPS_PATH)
- [ ] Diretório /root/deploy-backend criado
- [ ] Arquivo .env.production criado com valores reais
- [ ] Docker rodando no VPS
- [ ] Primeiro deploy testado manualmente
- [ ] Health check retorna 200 OK
- [ ] Containers rodando (docker-compose ps)

Se todos os itens estão ✓, você está **pronto para produção!**

---

## Suporte

- **Erro específico?** Veja `.github/TROUBLESHOOTING.md`
- **Dúvida sobre secrets?** Veja `.github/SECRETS-EXAMPLE.md`
- **Quer entender o workflow?** Veja `.github/README.md`

---

**Tempo total**: ~5 minutos
**Complexidade**: Baixa
**Resultado**: Deploy automático funcionando! 🚀

---

**Última atualização**: 2025-11-15
