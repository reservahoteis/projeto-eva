# ✅ DEPLOY CONFIGURADO E FUNCIONANDO!

## 🎉 Status Atual

- ✅ Deploy Key configurada no GitHub
- ✅ SSH funcionando (VPS → GitHub)
- ✅ Git configurado na VPS
- ✅ Teste de deploy realizado com sucesso
- ✅ Scripts de deploy criados

---

## 🚀 COMO USAR (Simples)

### **Sempre que fizer mudanças no código:**

**Windows:**
```powershell
.\deploy.ps1
```

**Linux/Mac:**
```bash
./deploy.sh
```

Isso vai:
1. Fazer commit das suas mudanças
2. Push para GitHub
3. Pull na VPS
4. Build do projeto

---

## 📝 Estrutura Atual

### **Local (seu computador):**
```
projeto-hoteis-reserva/
├── apps/backend/           ← Desenvolvimento aqui
├── deploy-backend/         ← Versão standalone (sincronizar manual)
├── deploy.sh              ← Script Linux/Mac
├── deploy.ps1             ← Script Windows
└── test-deploy.ps1        ← Testar configuração
```

### **VPS (72.61.39.235):**
```
/root/deploy-backend/      ← Apenas isso (conteúdo da pasta)
├── src/
├── prisma/
├── package.json
├── .env.production
└── ...
```

---

## 🔄 Workflow de Deploy

```
1. VOCÊ EDITA CÓDIGO
   ↓
2. .\deploy.ps1 (Windows) ou ./deploy.sh (Linux/Mac)
   ↓
3. Script faz automaticamente:
   - git add .
   - git commit
   - git push origin master
   - ssh vps "cd /root/deploy-backend && git pull origin master"
   - ssh vps "cd /root/deploy-backend && npm run build"
   ↓
4. ✅ CÓDIGO ATUALIZADO NA VPS!
```

---

## ⚙️ Configuração da VPS (JÁ FEITO)

A VPS já está configurada com:

```bash
/root/deploy-backend/
├── Git inicializado ✅
├── Remote: git@github.com:fredcast/projeto-eva.git ✅
├── Branch: master tracking origin/master ✅
├── .env.production ✅
└── Pronto para git pull ✅
```

---

## 🔧 Comandos Úteis

### **Verificar status na VPS:**
```bash
ssh root@72.61.39.235 "cd /root/deploy-backend && git status"
```

### **Ver logs na VPS:**
```bash
ssh root@72.61.39.235 "cd /root/deploy-backend && git log --oneline -5"
```

### **Verificar se está sincronizado:**
```bash
# Local
git rev-parse HEAD

# VPS
ssh root@72.61.39.235 "cd /root/deploy-backend && git rev-parse HEAD"

# Se os hashes forem iguais = sincronizado ✅
```

### **Forçar sincronização (se necessário):**
```bash
ssh root@72.61.39.235 "cd /root/deploy-backend && git fetch origin && git reset --hard origin/master"
```

### **Build e restart na VPS:**
```bash
ssh root@72.61.39.235 "cd /root/deploy-backend && npm run build && docker-compose restart backend"
```

---

## 📂 Sincronizar apps/backend → deploy-backend

Se você fizer mudanças em `apps/backend/` e quiser atualizar `deploy-backend/`:

**Windows (PowerShell):**
```powershell
robocopy apps\backend deploy-backend /E /XD node_modules dist .git /XF .env .env.local CREDENTIALS.md
cd deploy-backend
git add .
git commit -m "Sync from apps/backend"
git push origin master
```

**Linux/Mac:**
```bash
rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='.env*' --exclude='CREDENTIALS.md' apps/backend/ deploy-backend/
cd deploy-backend
git add .
git commit -m "Sync from apps/backend"
git push origin master
```

---

## 🆘 Troubleshooting

### Erro: "Permission denied (publickey)"
**Solução:** Deploy Key no GitHub não está configurada ou sem "Write access"
- Acesse: https://github.com/fredcast/projeto-eva/settings/keys
- Verifique se a key está lá e com "Write access" marcado

### Erro: "divergent branches"
**Solução:**
```bash
ssh root@72.61.39.235 "cd /root/deploy-backend && git reset --hard origin/master"
```

### VPS está com código antigo
**Solução:**
```bash
ssh root@72.61.39.235 "cd /root/deploy-backend && git fetch origin && git reset --hard origin/master"
```

### Quero reconfigurar tudo do zero na VPS
**Solução:**
```bash
ssh root@72.61.39.235

cd /root
rm -rf deploy-backend
git clone --depth 1 git@github.com:fredcast/projeto-eva.git temp-clone
cp -r temp-clone/deploy-backend /root/
cd /root/deploy-backend
rm -rf .git
git init
git remote add origin git@github.com:fredcast/projeto-eva.git
git config pull.rebase false
git fetch --depth 1 origin master
git add .
git commit -m "VPS setup"
git branch -M master
git branch --set-upstream-to=origin/master master
git reset --hard origin/master
cd /root && rm -rf temp-clone
echo "✅ Reconfigurado!"
```

---

## ✨ Pronto para usar!

Agora é só editar o código e rodar:
```powershell
.\deploy.ps1
```

**Simples assim! 🚀**
