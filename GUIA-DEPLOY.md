# 🚀 GUIA DE DEPLOY - Local → VPS

## 📋 Setup Inicial (Fazer UMA vez)

### 1. Adicionar Deploy Key no GitHub

✅ **JÁ FEITO:** SSH Key gerada na VPS

**AGORA VOCÊ PRECISA:**
1. Acesse: https://github.com/fredcast/projeto-eva/settings/keys
2. Clique em **"Add deploy key"**
3. **Title:** `VPS Production Server`
4. **Key:**
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJTx3yc6weTugaeygV6mb/IxKeOVU+eAXFVkLd/+2kOK vps-deploy@projeto-eva
   ```
5. ✅ **IMPORTANTE:** Marque **"Allow write access"**
6. Clique em **"Add key"**

### 2. Configurar Git na VPS

Depois de adicionar a Deploy Key no GitHub, rode:

```bash
ssh root@72.61.39.235
```

Dentro da VPS:

```bash
# Remover diretório antigo (se existir)
cd /root
rm -rf deploy-backend

# Clonar repositório
git clone git@github.com:fredcast/projeto-eva.git temp-clone
cd temp-clone
git sparse-checkout init --cone
git sparse-checkout set deploy-backend
mv deploy-backend /root/
cd /root
rm -rf temp-clone

# Configurar Git
cd deploy-backend
git init
git remote add origin git@github.com:fredcast/projeto-eva.git
git fetch origin
git checkout master
git branch --set-upstream-to=origin/master master

# Copiar .env de volta
cp ../deploy-backend.backup-*/.env.production .env.production 2>/dev/null || echo "Criar .env.production manualmente"

echo "✅ Git configurado!"
```

---

## 🎯 Como Usar (Dia a Dia)

### **Opção 1: Script Automático (Recomendado)**

**Windows (PowerShell):**
```powershell
.\deploy.ps1
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

O script faz automaticamente:
1. ✅ Commit das mudanças locais
2. ✅ Push para GitHub
3. ✅ Pull na VPS
4. ✅ Build do projeto

### **Opção 2: Manual**

**1. Local (seu computador):**
```bash
git add .
git commit -m "Suas mudanças"
git push origin master
```

**2. VPS:**
```bash
ssh root@72.61.39.235
cd /root/deploy-backend
git pull origin master
npm run build
docker-compose restart backend
```

---

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────┐
│ 1. DESENVOLVIMENTO LOCAL                │
│    Você edita código em:                │
│    - apps/backend/                      │
│    - deploy-backend/                    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 2. COMMIT & PUSH                        │
│    git add .                            │
│    git commit -m "mensagem"             │
│    git push origin master               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 3. GITHUB                               │
│    Repositório atualizado               │
│    github.com/fredcast/projeto-eva      │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 4. VPS (72.61.39.235)                   │
│    cd /root/deploy-backend              │
│    git pull origin master               │
│    npm run build                        │
│    docker-compose restart backend       │
└─────────────────────────────────────────┘
```

---

## 🛠️ Sincronizar apps/backend → deploy-backend

Se você fizer mudanças em `apps/backend/` e quiser copiar para `deploy-backend/`:

**Windows (PowerShell):**
```powershell
robocopy apps\backend deploy-backend /E /XD node_modules dist .git /XF .env .env.local CREDENTIALS.md
```

**Linux/Mac:**
```bash
rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='.env*' --exclude='CREDENTIALS.md' apps/backend/ deploy-backend/
```

Depois:
```bash
cd deploy-backend
git add .
git commit -m "Sync from apps/backend"
git push origin master
```

---

## 🔍 Verificar Status

**Local:**
```bash
git status
git log --oneline -5
```

**VPS:**
```bash
ssh root@72.61.39.235 "cd /root/deploy-backend && git log --oneline -5"
```

**Verificar se estão sincronizados:**
```bash
# Local
git rev-parse HEAD

# VPS
ssh root@72.61.39.235 "cd /root/deploy-backend && git rev-parse HEAD"

# Se os hashes forem iguais = sincronizado ✅
```

---

## ⚠️ Troubleshooting

### Erro: Permission denied (publickey)
**Causa:** Deploy key não adicionada no GitHub
**Solução:** Adicione a key no GitHub (passo 1)

### Erro: fatal: refusing to merge unrelated histories
**Solução:**
```bash
ssh root@72.61.39.235
cd /root/deploy-backend
git pull origin master --allow-unrelated-histories
```

### VPS está com código antigo
**Solução:**
```bash
ssh root@72.61.39.235
cd /root/deploy-backend
git fetch origin
git reset --hard origin/master
npm run build
```

### Quero limpar tudo e começar do zero
**Solução:**
```bash
ssh root@72.61.39.235
cd /root
rm -rf deploy-backend
git clone git@github.com:fredcast/projeto-eva.git
cd projeto-eva
git sparse-checkout init --cone
git sparse-checkout set deploy-backend
mv deploy-backend /root/
cd /root && rm -rf projeto-eva
```

---

## 📚 Comandos Úteis

```bash
# Ver diferenças entre local e VPS
git diff origin/master

# Ver arquivos modificados
git status --short

# Desfazer mudanças locais
git reset --hard HEAD

# Ver histórico
git log --graph --oneline -10

# SSH rápido na VPS
ssh root@72.61.39.235

# Ver logs do backend na VPS
ssh root@72.61.39.235 "cd /root/deploy-backend && docker-compose logs -f backend"

# Reiniciar backend na VPS
ssh root@72.61.39.235 "cd /root/deploy-backend && docker-compose restart backend"
```

---

**✅ Setup completo! Agora é só usar `./deploy.ps1` ou `./deploy.sh` quando fizer mudanças!**
