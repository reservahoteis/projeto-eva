# 🚀 GETTING STARTED - Primeiros Passos

> **Guia rápido para rodar o projeto localmente em 5 minutos**

---

## ✅ Pré-requisitos

Certifique-se de ter instalado:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 8+** - `npm install -g pnpm`
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)

Verificar versões:
```bash
node --version   # v20.x.x
pnpm --version   # 8.x.x
docker --version # xx.x.x
```

---

## 📦 Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/projeto-hoteis-reserva.git
cd projeto-hoteis-reserva
```

### 2. Instalar dependências

```bash
pnpm install
```

Isso instala todas as dependências do monorepo (backend + frontend + packages).

### 3. Configurar variáveis de ambiente

```bash
# Copiar .env.example
cp .env.example .env

# Editar .env e configurar suas credenciais
# (Pode deixar os valores padrão para desenvolvimento local)
```

**Importante:** Gere secrets fortes para produção:
```bash
# Gerar JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Iniciar banco de dados (Docker)

```bash
# Subir PostgreSQL + Redis
pnpm docker:up

# Verificar se estão rodando
docker ps
```

Você verá:
- `crm-postgres-dev` na porta 5432
- `crm-redis-dev` na porta 6379
- `crm-adminer-dev` na porta 8080 (UI do banco)
- `crm-redis-insight-dev` na porta 8001 (UI do Redis)

### 5. Rodar migrations do Prisma

```bash
cd apps/backend

# Gerar Prisma Client
pnpm prisma:generate

# Criar banco de dados e aplicar migrations
pnpm prisma:migrate

# Seed (criar super admin inicial)
pnpm prisma:seed
```

### 6. Iniciar servidores de desenvolvimento

**Terminal 1 - Backend:**
```bash
pnpm backend:dev
```

Backend rodando em: http://localhost:3001

**Terminal 2 - Frontend:**
```bash
pnpm frontend:dev
```

Frontend rodando em: http://localhost:3000

---

## 🎉 Pronto!

Acesse:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Adminer (DB UI):** http://localhost:8080
  - Sistema: PostgreSQL
  - Servidor: postgres
  - Usuário: crm_user
  - Senha: crm_password
  - Base: crm_whatsapp_saas

**Login padrão (Super Admin):**
- Email: `admin@seucrm.com`
- Senha: `change_me_in_production`

---

## 📚 Próximos Passos

1. **Ler a documentação:** [DOCS-MULTI-TENANT.md](./DOCS-MULTI-TENANT.md)
2. **Criar primeiro tenant:** Via painel Super Admin
3. **Configurar WhatsApp:** Via painel do tenant
4. **Testar envio de mensagem**

---

## 🐛 Problemas Comuns

### Erro: "Port 5432 already in use"
Já tem PostgreSQL rodando localmente. Pare ele ou mude a porta no docker-compose.yml.

### Erro: "pnpm not found"
Instale o pnpm: `npm install -g pnpm`

### Erro: "Docker daemon not running"
Inicie o Docker Desktop.

### Migrations não rodam
```bash
# Resetar banco (CUIDADO: apaga dados!)
cd apps/backend
pnpm prisma:reset
```

---

## 🔧 Comandos Úteis

```bash
# Instalar dependências
pnpm install

# Desenvolvimento (backend + frontend juntos)
pnpm dev

# Apenas backend
pnpm backend:dev

# Apenas frontend
pnpm frontend:dev

# Build de produção
pnpm build

# Testes
pnpm test

# Lint
pnpm lint

# Formatar código
pnpm format

# Prisma Studio (GUI do banco)
pnpm prisma:studio

# Ver logs do Docker
docker-compose logs -f

# Parar Docker
pnpm docker:down

# Limpar tudo
pnpm clean
```

---

## 🆘 Suporte

- **Documentação:** Veja pasta `/docs`
- **Issues:** [GitHub Issues](https://github.com/seu-usuario/projeto-hoteis-reserva/issues)
- **Email:** suporte@seucrm.com

---

**Bora codar! 🚀**
