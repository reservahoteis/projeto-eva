# GitHub Secrets Configuration

Este arquivo documenta os secrets necessários para o workflow de deploy automático.

**IMPORTANTE**: Estes valores NUNCA devem ser commitados no repositório. Configure-os em:

```
Settings > Secrets and variables > Actions > New repository secret
```

---

## Secrets Obrigatórios

### VPS_SSH_KEY

**Descrição**: Chave SSH privada para conectar ao VPS

**Como obter**:

```bash
# Execute no VPS:
cat /root/.ssh/github_actions_deploy

# Ou use o script auxiliar:
wget https://raw.githubusercontent.com/SEU-USUARIO/SEU-REPO/master/.github/scripts/setup-deploy-keys.sh
chmod +x setup-deploy-keys.sh
sudo ./setup-deploy-keys.sh
```

**Formato**:

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXAA
...
(toda a chave)
...
-----END OPENSSH PRIVATE KEY-----
```

**IMPORTANTE**:
- Cole a chave COMPLETA (incluindo BEGIN/END)
- Não adicione espaços antes/depois
- Não modifique o conteúdo

---

### VPS_HOST

**Descrição**: Endereço IP do VPS de produção

**Valor**:

```
72.61.39.235
```

**Notas**:
- Pode ser IP ou domínio
- Se usar domínio, certifique-se que resolve corretamente

---

### VPS_USER

**Descrição**: Usuário SSH para conectar ao VPS

**Valor**:

```
root
```

**Notas**:
- Usar root é OK se o VPS é dedicado
- Alternativamente, crie um usuário dedicado com permissões Docker

**Como criar usuário dedicado (opcional)**:

```bash
# No VPS:
sudo adduser deploy
sudo usermod -aG docker deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp /root/.ssh/github_actions_deploy.pub /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Dar permissões para /root/deploy-backend
sudo chown -R deploy:deploy /root/deploy-backend

# Atualizar VPS_USER para "deploy" no GitHub Secret
```

---

### VPS_PATH

**Descrição**: Caminho completo onde o backend está deployado no VPS

**Valor**:

```
/root/deploy-backend
```

**Notas**:
- DEVE ser caminho absoluto (começar com /)
- Diretório DEVE existir no VPS
- Usuário SSH DEVE ter permissão de escrita

**Criar diretório no VPS**:

```bash
mkdir -p /root/deploy-backend
chmod 755 /root/deploy-backend
```

---

## Secrets Opcionais

Estes secrets são opcionais mas recomendados para notificações e monitoramento:

### SLACK_WEBHOOK_URL

**Descrição**: Webhook do Slack para notificações de deploy

**Como obter**:
1. Acesse https://api.slack.com/messaging/webhooks
2. Crie novo webhook para seu canal
3. Copie a URL

**Formato**:

```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**Uso no workflow** (adicionar step):

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    text: 'Deploy to production completed'
```

---

### DISCORD_WEBHOOK_URL

**Descrição**: Webhook do Discord para notificações

**Como obter**:
1. Discord > Server Settings > Integrations > Webhooks
2. Create Webhook
3. Copie a URL

**Formato**:

```
https://discord.com/api/webhooks/1234567890/XXXXXXXXXXXXXXXXXXXX
```

---

### TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID

**Descrição**: Bot do Telegram para notificações

**Como obter**:
1. Telegram > @BotFather
2. /newbot
3. Copie o token
4. Use @userinfobot para obter seu chat_id

**Formato**:

```
TELEGRAM_BOT_TOKEN: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID: 123456789
```

---

## Secrets de Ambiente (.env.production no VPS)

Estes secrets devem estar no arquivo `.env.production` **no VPS**, não no GitHub:

```env
# Database
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=SuaSenhaSeguraAqui123!
POSTGRES_DB=crm_whatsapp_saas

# Redis
REDIS_PASSWORD=OutraSenhaSegura456!

# JWT
JWT_SECRET=super-secret-jwt-key-min-32-chars-aqui
JWT_REFRESH_SECRET=outro-secret-para-refresh-token-aqui

# URLs
FRONTEND_URL=https://app.botreserva.com.br
BASE_DOMAIN=botreserva.com.br

# WhatsApp
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu-token-verificacao-webhook

# n8n
N8N_API_KEY=sua-api-key-n8n

# Super Admin
SUPER_ADMIN_EMAIL=admin@botreserva.com.br
SUPER_ADMIN_PASSWORD=SenhaDoSuperAdmin789!
```

**Como criar no VPS**:

```bash
ssh root@72.61.39.235
cd /root/deploy-backend
cp .env.production.example .env.production
nano .env.production
# Preencher com valores reais
chmod 600 .env.production  # Proteger arquivo
```

---

## Segurança

### Boas Práticas

1. **Nunca commite secrets**
   - Use `.gitignore` para `.env*`
   - Use GitHub Secrets para CI/CD

2. **Rotação de chaves**
   - SSH keys: a cada 90 dias
   - Passwords: a cada 180 dias
   - Tokens: quando suspeitar de vazamento

3. **Princípio do menor privilégio**
   - SSH key só tem acesso ao VPS necessário
   - User SSH tem apenas permissões necessárias

4. **Auditoria**
   - Monitore logs de acesso SSH
   - Revise GitHub Actions logs
   - Configure alertas de falha

### Rotação de SSH Key

```bash
# 1. Gerar nova chave no VPS
ssh root@72.61.39.235
ssh-keygen -t ed25519 -C "github-actions-deploy-$(date +%Y%m)" -f ~/.ssh/github_actions_deploy_new -N ""

# 2. Adicionar ao authorized_keys
cat ~/.ssh/github_actions_deploy_new.pub >> ~/.ssh/authorized_keys

# 3. Atualizar secret VPS_SSH_KEY no GitHub
cat ~/.ssh/github_actions_deploy_new
# Copiar e colar no GitHub Secret

# 4. Testar deploy
# GitHub > Actions > Deploy to Production VPS > Run workflow

# 5. Se funcionar, remover chave antiga
rm ~/.ssh/github_actions_deploy ~/.ssh/github_actions_deploy.pub
mv ~/.ssh/github_actions_deploy_new ~/.ssh/github_actions_deploy
mv ~/.ssh/github_actions_deploy_new.pub ~/.ssh/github_actions_deploy.pub
```

### Detectar Vazamento

Se suspeitar que algum secret vazou:

1. **Revogue imediatamente**
   - Gere novas chaves/senhas
   - Atualize GitHub Secrets
   - Atualize .env.production no VPS

2. **Verifique logs**
   - GitHub Actions logs
   - VPS SSH logs: `sudo journalctl -u ssh`
   - Database logs

3. **Notifique equipe**
   - Informe sobre incidente
   - Revise processos de segurança

---

## Checklist de Configuração

Use esta checklist ao configurar secrets pela primeira vez:

### GitHub Secrets

- [ ] VPS_SSH_KEY configurado
- [ ] VPS_HOST configurado
- [ ] VPS_USER configurado
- [ ] VPS_PATH configurado
- [ ] (Opcional) SLACK_WEBHOOK_URL configurado
- [ ] (Opcional) DISCORD_WEBHOOK_URL configurado
- [ ] (Opcional) TELEGRAM_BOT_TOKEN configurado
- [ ] (Opcional) TELEGRAM_CHAT_ID configurado

### VPS Configuration

- [ ] SSH key pública adicionada ao authorized_keys
- [ ] Diretório /root/deploy-backend criado
- [ ] Arquivo .env.production criado e preenchido
- [ ] Docker instalado e rodando
- [ ] Nginx configurado
- [ ] SSL/TLS certificado instalado

### Testes

- [ ] Teste SSH com chave privada
- [ ] Teste workflow manual (Run workflow)
- [ ] Teste deploy automático (push para master)
- [ ] Teste health check endpoint
- [ ] Teste rollback

---

## Validação

Execute estes comandos para validar a configuração:

### No VPS

```bash
# Verificar SSH key
cat ~/.ssh/authorized_keys | grep github-actions-deploy

# Verificar diretório deploy
ls -la /root/deploy-backend

# Verificar .env.production
test -f /root/deploy-backend/.env.production && echo "OK" || echo "MISSING"

# Verificar Docker
docker info > /dev/null && echo "Docker OK" || echo "Docker NOT RUNNING"

# Verificar espaço em disco
df -h /root/deploy-backend
```

### No GitHub

1. Settings > Secrets > Verificar se 4 secrets obrigatórios existem
2. Actions > Deploy to Production VPS > Run workflow
3. Acompanhar execução
4. Se success, tudo OK

---

## Referências

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [SSH Key Management](https://www.ssh.com/academy/ssh/key)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

---

**ATENÇÃO**: Este arquivo pode ser commitado. Ele NÃO contém valores reais, apenas exemplos e instruções.

Se você acidentalmente commitar um secret real, revogue-o IMEDIATAMENTE e gere um novo.

---

**Última atualização**: 2025-11-15
