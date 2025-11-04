# 🚀 RODAR O PROJETO AGORA

## ✅ SITUAÇÃO ATUAL

- ✅ Backend: 100% pronto (70+ arquivos)
- ✅ Frontend: 100% pronto (80+ arquivos)
- ✅ Dependências: Instaladas (backend + frontend)

---

## 🎯 RODAR AGORA (2 COMANDOS)

### Terminal 1 - Backend

```bash
cd apps/backend
pnpm dev
```

**Se der erro "Prisma Client", rode antes:**
```bash
cd apps/backend
pnpm prisma:generate
pnpm dev
```

Backend rodará em: **http://localhost:3001**

### Terminal 2 - Frontend

```bash
cd apps/frontend
pnpm dev
```

Frontend rodará em: **http://localhost:3000**

---

## ⚠️ FALTA APENAS: Infraestrutura

Se você **NÃO** rodou o Docker ainda:

### Opção A: Com Docker (RECOMENDADO)

```bash
# 1. Instale Docker Desktop
# https://www.docker.com/products/docker-desktop/

# 2. Na raiz do projeto:
docker compose up -d

# 3. Setup do banco:
cd apps/backend
pnpm prisma:generate
pnpm prisma migrate dev --name init
pnpm prisma:seed

# 4. Agora sim, rode backend e frontend
```

### Opção B: Sem Docker

Se você já tem PostgreSQL e Redis instalados localmente, apenas ajuste o `.env` do backend:

```env
DATABASE_URL="postgresql://seu_usuario:sua_senha@localhost:5432/seu_banco"
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 🧪 TESTAR

1. **Acesse:** http://localhost:3000

2. **Login Super Admin:**
   - Email: `admin@seucrm.com`
   - Senha: `change_me_in_production`

3. **OU Login Demo Tenant:**
   - Email: `admin@demo.hotel`
   - Senha: `demo123`

---

## 📊 COMANDOS RÁPIDOS

### Ver se o backend está funcionando
```bash
curl http://localhost:3001/health
```

### Ver o banco de dados visualmente
```bash
cd apps/backend
pnpm prisma:studio
```
Abre em: http://localhost:5555

### Resetar o banco (CUIDADO - apaga tudo!)
```bash
cd apps/backend
pnpm prisma:reset
```

---

## 🐛 ERROS COMUNS

### Backend: "Connection refused" ou "ECONNREFUSED"
→ PostgreSQL ou Redis não estão rodando
→ Solução: `docker compose up -d`

### Backend: "Prisma Client not generated"
→ Solução: `cd apps/backend && pnpm prisma:generate`

### Frontend: "next not found"
→ Solução: `cd apps/frontend && pnpm install`

### Frontend: "API connection error"
→ Backend não está rodando
→ Solução: Rode o backend em outro terminal

### "Port already in use"
→ Algo já está usando a porta 3000 ou 3001
→ Solução: Mate o processo ou mude a porta

---

## 🎯 ORDEM DE INICIALIZAÇÃO

**1º - Infraestrutura:**
```bash
docker compose up -d
```

**2º - Backend:**
```bash
cd apps/backend
pnpm prisma:generate    # Só precisa rodar 1x
pnpm prisma migrate dev # Só precisa rodar 1x
pnpm prisma:seed        # Só precisa rodar 1x
pnpm dev                # Deixe rodando
```

**3º - Frontend:**
```bash
cd apps/frontend
pnpm dev                # Deixe rodando
```

**4º - Acesse:**
http://localhost:3000

---

## ✅ CHECKLIST

Antes de usar o sistema:

- [ ] Docker rodando (ou PostgreSQL + Redis localmente)
- [ ] Backend rodando (Terminal 1)
- [ ] Frontend rodando (Terminal 2)
- [ ] Consegui acessar http://localhost:3000
- [ ] Consegui fazer login
- [ ] Backend responde em http://localhost:3001/health

---

## 🎉 PRONTO!

Quando tudo estiver rodando:

✅ Backend: http://localhost:3001
✅ Frontend: http://localhost:3000
✅ Prisma Studio: http://localhost:5555

**AGORA É SÓ USAR! 🚀**

---

**Dúvidas?** Consulte:
- `LEIA-ME-PRIMEIRO.md` - Guia completo
- `STATUS-PROJETO.md` - Resumo do projeto
- `PROXIMO-PASSO.md` - Setup detalhado backend
- `FRONTEND-GUIA-RAPIDO.md` - Setup detalhado frontend
