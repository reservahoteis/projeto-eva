# 🚀 Guia Rápido de Deploy (Passo a Passo Simplificado)

## 📍 PARTE 1: Na sua máquina (Windows)

### 1.1 Preparar o pacote do backend

**Opção A: Git Bash**
```bash
# Abrir Git Bash na pasta do projeto
cd C:\Users\55489\Desktop\projeto-hoteis-reserva

# Executar script
bash infra/scripts/prepare-backend-deploy.sh
```

**Resultado:** Arquivo `backend-deploy.tar.gz` criado! ✅

### 1.2 Enviar para VPS

**Você tem 3 opções:**

#### 🟢 **Opção 1: Git Bash (Linha de comando)**

```bash
# No Git Bash (mesma janela)
scp backend-deploy.tar.gz root@SEU-IP-VPS:/opt/

# Exemplo:
# scp backend-deploy.tar.gz root@123.456.789.10:/opt/
```

Vai pedir a senha da VPS. Digite e pressione Enter.

---

#### 🟢 **Opção 2: WinSCP (Visual - MAIS FÁCIL)** ⭐

1. **Baixar e instalar:** https://winscp.net/eng/download.php

2. **Abrir WinSCP e conectar:**
   - **File Protocol:** SFTP
   - **Host name:** `seu-ip-vps` (ex: 123.456.789.10)
   - **Port number:** 22
   - **User name:** root
   - **Password:** sua-senha
   - Clicar em **Login**

3. **Navegar e enviar arquivo:**
   - Lado ESQUERDO: Navegar até `C:\Users\55489\Desktop\projeto-hoteis-reserva\`
   - Lado DIREITO: Navegar até `/opt/`
   - ARRASTAR `backend-deploy.tar.gz` da esquerda para direita

**Pronto! Arquivo enviado!** 🎉

---

#### 🟢 **Opção 3: FileZilla (Alternativa ao WinSCP)**

1. **Baixar e instalar:** https://filezilla-project.org/

2. **Conectar:**
   - **Host:** `sftp://seu-ip-vps`
   - **Username:** root
   - **Password:** sua-senha
   - **Port:** 22
   - Clicar em **Quickconnect**

3. **Enviar arquivo:**
   - Lado esquerdo: Local (seu computador)
   - Lado direito: Servidor VPS
   - Arrastar `backend-deploy.tar.gz` para `/opt/`

---

## 📍 PARTE 2: Na VPS (Linux)

### 2.1 Conectar na VPS via SSH

**No Windows (PowerShell ou Git Bash):**

```bash
ssh root@SEU-IP-VPS

# Exemplo:
# ssh root@123.456.789.10
```

Digite a senha quando solicitado.

---

### 2.2 Verificar se arquivo chegou

```bash
ls -lh /opt/backend-deploy.tar.gz
```

Deve mostrar o arquivo e seu tamanho.

---

### 2.3 Extrair o pacote

```bash
cd /opt
tar -xzf backend-deploy.tar.gz
cd deploy-backend
ls -la
```

Você verá:
```
deploy-backend/
├── src/
├── prisma/
├── nginx/
├── scripts/
├── docker-compose.production.yml
└── ...
```

---

### 2.4 Configurar variáveis de ambiente

```bash
# Copiar template
cp .env.production.example .env.production

# Gerar secrets (copie os valores que aparecerem!)
echo "=== COPIE ESTES VALORES ==="
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "WHATSAPP_WEBHOOK_VERIFY_TOKEN=$(openssl rand -base64 32)"
echo "==========================="

# Editar arquivo .env.production
nano .env.production
```

**Preencha com os valores:**

```env
# DATABASE
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=COLE_AQUI_O_POSTGRES_PASSWORD_GERADO
POSTGRES_DB=crm_whatsapp_saas

# REDIS
REDIS_PASSWORD=COLE_AQUI_O_REDIS_PASSWORD_GERADO

# JWT
JWT_SECRET=COLE_AQUI_O_JWT_SECRET_GERADO
JWT_REFRESH_SECRET=COLE_AQUI_O_JWT_REFRESH_SECRET_GERADO

# APPLICATION
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://seu-frontend.vercel.app
BASE_DOMAIN=api.seudominio.com

# WHATSAPP
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=COLE_AQUI_O_WEBHOOK_TOKEN_GERADO

# N8N (opcional - pode deixar em branco)
N8N_API_KEY=

# SUPER ADMIN
SUPER_ADMIN_EMAIL=admin@seudominio.com
SUPER_ADMIN_PASSWORD=SuaSenhaForte123!
```

**Salvar:** `Ctrl + O`, Enter, `Ctrl + X`

---

### 2.5 Atualizar domínio no Nginx

```bash
nano nginx/conf.d/api.conf
```

Procure por `api.seudominio.com` e substitua pelo seu domínio real.

Exemplo:
- De: `api.seudominio.com`
- Para: `api.meuhotel.com.br`

**Salvar:** `Ctrl + O`, Enter, `Ctrl + X`

---

### 2.6 Dar permissão aos scripts

```bash
chmod +x scripts/*.sh
```

---

### 2.7 Fazer deploy!

```bash
docker-compose -f docker-compose.production.yml up -d --build
```

**Aguardar o build (~5-10 minutos)...**

---

### 2.8 Verificar se subiu

```bash
docker-compose -f docker-compose.production.yml ps
```

Deve mostrar:
```
NAME            STATUS          PORTS
crm-backend     Up (healthy)
crm-postgres    Up (healthy)
crm-redis       Up (healthy)
crm-nginx       Up (healthy)    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

Todos devem estar **Up** e **healthy**! ✅

---

### 2.9 Ver logs (se quiser acompanhar)

```bash
docker-compose -f docker-compose.production.yml logs -f
```

Pressionar `Ctrl+C` para sair.

---

### 2.10 Executar migrations

```bash
docker-compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
```

---

### 2.11 Criar super admin

```bash
docker-compose -f docker-compose.production.yml exec backend npx prisma db seed
```

---

### 2.12 Testar API

```bash
curl http://api.seudominio.com/health
```

Deve retornar:
```json
{"status":"ok"}
```

---

### 2.13 Configurar SSL (HTTPS)

```bash
./scripts/setup-ssl.sh
```

Siga as instruções:
1. Digite seu domínio: `api.seudominio.com`
2. Digite seu email: `seuemail@dominio.com`
3. Digite `yes` para confirmar

---

### 2.14 Testar HTTPS

```bash
curl https://api.seudominio.com/health
```

Deve retornar:
```json
{"status":"ok"}
```

---

## 📍 PARTE 3: Atualizar Vercel

### 3.1 Ir para Vercel

1. Acesse: https://vercel.com
2. Selecione seu projeto do frontend

### 3.2 Atualizar variáveis

1. **Settings** → **Environment Variables**
2. Editar:
   - `NEXT_PUBLIC_API_URL` → `https://api.seudominio.com`
   - `NEXT_PUBLIC_WS_URL` → `https://api.seudominio.com`
3. Clicar em **Save**

### 3.3 Redeploy

1. Ir em **Deployments**
2. Clicar nos 3 pontinhos do último deploy
3. Clicar em **Redeploy**
4. Aguardar deploy (~2 minutos)

---

## ✅ TESTAR TUDO

1. **Abrir frontend:** https://seu-frontend.vercel.app
2. **Ir para login**
3. **Tentar fazer login:**
   - Email: `admin@seudominio.com`
   - Senha: `SuaSenhaForte123!` (que você colocou no .env)
4. **Deve entrar no dashboard!** 🎉

---

## 🐛 Se algo der errado

### Logs do backend:
```bash
docker-compose -f docker-compose.production.yml logs -f backend
```

### Logs do nginx:
```bash
docker-compose -f docker-compose.production.yml logs -f nginx
```

### Reiniciar tudo:
```bash
docker-compose -f docker-compose.production.yml restart
```

### Parar tudo:
```bash
docker-compose -f docker-compose.production.yml down
```

### Subir novamente:
```bash
docker-compose -f docker-compose.production.yml up -d
```

---

## 📊 Resumo Visual

```
┌─────────────────┐
│  Sua Máquina    │
│  (Windows)      │
│                 │
│  1. Preparar    │
│  2. Enviar      │
└────────┬────────┘
         │ SCP/WinSCP
         │
┌────────▼────────┐
│      VPS        │
│    (Linux)      │
│                 │
│  3. Extrair     │
│  4. Configurar  │
│  5. Deploy      │
│  6. SSL         │
└────────┬────────┘
         │
         │
┌────────▼────────┐
│     Vercel      │
│   (Frontend)    │
│                 │
│  7. Atualizar   │
│     variáveis   │
│  8. Redeploy    │
└─────────────────┘
```

---

## ⏱️ Tempo Total Estimado

- Preparar pacote (Windows): **2 min**
- Enviar para VPS: **5 min**
- Configurar VPS: **10 min**
- Deploy: **10 min**
- SSL: **5 min**
- Atualizar Vercel: **3 min**

**TOTAL: ~35 minutos** ⚡

---

## ✅ Checklist Final

- [ ] Arquivo `backend-deploy.tar.gz` criado
- [ ] Arquivo enviado para VPS
- [ ] Pacote extraído em `/opt/deploy-backend`
- [ ] `.env.production` configurado
- [ ] Domínio DNS configurado (A record)
- [ ] Nginx com domínio atualizado
- [ ] `docker-compose up` executado
- [ ] Containers rodando e healthy
- [ ] Migrations executadas
- [ ] Super admin criado (seed)
- [ ] API respondendo HTTP
- [ ] SSL configurado
- [ ] API respondendo HTTPS
- [ ] Vercel atualizado
- [ ] Login funcionando no frontend

---

**🎉 Parabéns! Backend no ar!**
