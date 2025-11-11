# 🏨 CRM WhatsApp SaaS Multi-Tenant

> **Sistema completo de CRM com integração WhatsApp Business API para gestão de múltiplos hotéis**

[![Node.js](https://img.shields.io/badge/Node.js-20.11.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.9.1-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.1-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Production](https://img.shields.io/badge/Production-Ready-success.svg)](https://github.com/fredcast/projeto-eva)

---

## 📋 Sobre o Projeto

Sistema SaaS Multi-Tenant completo para gestão de atendimento via WhatsApp, desenvolvido especificamente para o setor hoteleiro. Cada hotel opera de forma isolada com seu próprio subdomínio, credenciais WhatsApp Business API e dados segregados.

### ✨ Principais Funcionalidades

- 🔐 **Multi-Tenant Architecture** - Isolamento completo de dados por tenant (hotel)
- 💬 **WhatsApp Business API** - Integração oficial com Meta API v21.0
- 📊 **CRM Completo** - Gestão de contatos, conversas e mensagens
- 🤖 **Webhook Handling** - Recebimento e processamento de eventos em tempo real
- 🔒 **Autenticação JWT** - Sistema seguro de autenticação e autorização
- 📱 **API REST** - Endpoints completos e documentados
- 🐳 **Docker** - Containerização completa para deploy facilitado
- 🚀 **Deploy Automático** - Scripts prontos para VPS

---

## 🏗️ Arquitetura

### **Stack Tecnológico**

- **Runtime:** Node.js 20.11.0 LTS
- **Language:** TypeScript 5.3.3
- **Framework:** Express 4.18.2
- **ORM:** Prisma 5.9.1
- **Database:** PostgreSQL 16.1
- **Cache:** Redis 7.2
- **Validation:** Zod 3.22.4
- **Logs:** Pino 8.17.2
- **Containerization:** Docker + Docker Compose

### **Arquitetura em Camadas**

```
┌─────────────────────────────────────────┐
│         Routes (Rotas da API)           │
├─────────────────────────────────────────┤
│      Middlewares (Validação, Auth)      │
├─────────────────────────────────────────┤
│    Controllers (Orquestração)           │
├─────────────────────────────────────────┤
│     Services (Lógica de Negócio)        │
├─────────────────────────────────────────┤
│   Repositories (Acesso ao Banco)        │
├─────────────────────────────────────────┤
│      Database (PostgreSQL + Prisma)     │
└─────────────────────────────────────────┘
```

### **Multi-Tenant por Subdomínio**

```
hotel1.seudominio.com ──┐
                        ├──► Backend ──► DB (tenantId: hotel1)
hotel2.seudominio.com ──┤
                        └──► Backend ──► DB (tenantId: hotel2)
```

---

## 📁 Estrutura do Projeto

```
projeto-hoteis-reserva/
│
├── 📘 DOCUMENTACAO-DEFINITIVA.md      # Documentação completa do projeto
├── 🏗️  ARQUITETURA-IDEAL.md            # Guia de boas práticas e anti-patterns
├── 🎯 MODELO-PROJETO-SUCESSO.md       # Template copy-paste para novos projetos
├── 📋 README.md                       # Este arquivo
│
├── 📂 apps/
│   ├── backend/                       # Backend em desenvolvimento
│   │   ├── src/
│   │   │   ├── config/               # Configurações (env, logger, database)
│   │   │   ├── controllers/          # Controladores da API
│   │   │   ├── middlewares/          # Middlewares (auth, tenant, validation)
│   │   │   ├── services/             # Lógica de negócio
│   │   │   ├── repositories/         # Acesso ao banco de dados
│   │   │   ├── routes/               # Rotas da API
│   │   │   ├── validators/           # Schemas de validação Zod
│   │   │   ├── utils/                # Utilitários
│   │   │   └── server.ts             # Entry point
│   │   ├── prisma/                   # Prisma schema e migrations
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── frontend/                      # Frontend (Next.js) - Em desenvolvimento
│
├── 📂 deploy-backend/                 # Backend standalone para VPS (produção)
│
├── 📂 infra/                          # Infraestrutura
│   ├── docker-compose.production.yml
│   └── nginx/                         # Configuração Nginx
│
├── 📂 docs/                           # Documentação específica
│   ├── GUIA-DEPLOY.md                # Guia de deploy completo
│   ├── GUIA-META-WHATSAPP-API.md     # Configuração WhatsApp Business API
│   └── FRONTEND-GUIA-RAPIDO.md       # Setup do frontend
│
├── 📜 deploy.ps1                      # Script de deploy (Windows)
├── 📜 deploy.sh                       # Script de deploy (Linux/Mac)
│
└── 📜 package.json                    # Root workspace
```

---

## 🚀 Quick Start

### **Pré-requisitos**

- Node.js 20.11.0 ou superior
- PostgreSQL 16+
- Redis 7+ (opcional para desenvolvimento)
- Docker + Docker Compose (para produção)

### **Instalação Local**

```bash
# 1. Clonar repositório
git clone https://github.com/fredcast/projeto-eva.git
cd projeto-eva

# 2. Instalar dependências
npm install
cd apps/backend
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env.development
# Edite .env.development com suas credenciais

# 4. Configurar banco de dados
npx prisma generate
npx prisma migrate dev

# 5. Rodar em desenvolvimento
npm run dev
```

O servidor estará rodando em `http://localhost:3001`

### **Deploy para Produção**

```bash
# Usar script automático
./deploy.ps1  # Windows
bash deploy.sh  # Linux/Mac
```

Ou veja o [Guia de Deploy Completo](docs/GUIA-DEPLOY.md) para deploy manual.

---

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [DOCUMENTACAO-DEFINITIVA.md](DOCUMENTACAO-DEFINITIVA.md) | 📘 Documentação completa - História, arquitetura, problemas e soluções |
| [ARQUITETURA-IDEAL.md](ARQUITETURA-IDEAL.md) | 🏗️ Boas práticas e anti-patterns - O que fazer e o que NÃO fazer |
| [MODELO-PROJETO-SUCESSO.md](MODELO-PROJETO-SUCESSO.md) | 🎯 Template copy-paste para novos projetos similares |
| [docs/GUIA-DEPLOY.md](docs/GUIA-DEPLOY.md) | 🚀 Guia completo de deploy para VPS |
| [docs/GUIA-META-WHATSAPP-API.md](docs/GUIA-META-WHATSAPP-API.md) | 💬 Configuração WhatsApp Business API |
| [docs/FRONTEND-GUIA-RAPIDO.md](docs/FRONTEND-GUIA-RAPIDO.md) | 🎨 Setup e desenvolvimento do frontend |

---

## 🔌 API Endpoints

### **Autenticação**

```http
POST   /api/auth/login              # Login
POST   /api/auth/register           # Registro
POST   /api/auth/refresh            # Refresh token
GET    /api/auth/me                 # Dados do usuário
```

### **Contatos**

```http
GET    /api/contacts                # Listar contatos
GET    /api/contacts/:id            # Buscar contato
POST   /api/contacts                # Criar contato
PUT    /api/contacts/:id            # Atualizar contato
DELETE /api/contacts/:id            # Deletar contato
```

### **Conversas**

```http
GET    /api/conversations           # Listar conversas
GET    /api/conversations/:id       # Buscar conversa
POST   /api/conversations           # Criar conversa
PUT    /api/conversations/:id       # Atualizar conversa
```

### **Mensagens**

```http
GET    /api/messages                # Listar mensagens
POST   /api/messages                # Enviar mensagem
POST   /api/messages/template       # Enviar template
POST   /api/messages/media          # Enviar mídia
```

### **Webhooks**

```http
GET    /api/webhooks                # Verificação WhatsApp
POST   /api/webhooks                # Receber eventos WhatsApp
```

### **Tenant**

```http
GET    /api/tenant                  # Dados do tenant
PUT    /api/tenant                  # Atualizar tenant
POST   /api/tenant/whatsapp/setup   # Configurar WhatsApp
```

Veja exemplos completos de requisições na [Documentação da API](DOCUMENTACAO-DEFINITIVA.md#api-endpoints).

---

## 🐳 Docker

### **Desenvolvimento**

```bash
docker-compose up -d
```

### **Produção**

```bash
cd deploy-backend
docker-compose -f docker-compose.production.yml up -d
```

**Containers:**
- `crm-backend` - Aplicação Node.js/Express
- `crm-postgres` - Banco de dados PostgreSQL
- `crm-redis` - Cache Redis
- `crm-nginx` - Reverse proxy
- `crm-certbot` - Certificados SSL

---

## 🧪 Testes

```bash
# Rodar todos os testes
npm test

# Testes unitários
npm run test:unit

# Testes de integração
npm run test:integration

# Coverage
npm run test:coverage
```

---

## 🔐 Segurança

### **Implementado:**

- ✅ Autenticação JWT
- ✅ Bcrypt para senhas (10 rounds)
- ✅ Validação de entrada com Zod
- ✅ Isolamento de dados por tenant
- ✅ CORS configurado
- ✅ Rate limiting
- ✅ Helmet.js para headers de segurança
- ✅ HMAC validation para webhooks WhatsApp
- ✅ Sanitização de logs (não expõe secrets)

### **Boas Práticas:**

- Variáveis sensíveis apenas em `.env` (nunca commitadas)
- Senhas com mínimo 8 caracteres
- JWT com expiração configurável
- HTTPS obrigatório em produção
- Backup automático do banco de dados

---

## 📊 Status do Projeto

| Componente | Status | Progresso |
|------------|--------|-----------|
| **Backend API** | ✅ Completo | 100% |
| **Multi-Tenant** | ✅ Completo | 100% |
| **WhatsApp Integration** | ✅ Completo | 100% |
| **Autenticação** | ✅ Completo | 100% |
| **Deploy VPS** | ✅ Completo | 100% |
| **Documentação** | ✅ Completo | 100% |
| **Frontend** | 🔄 Em Desenvolvimento | 40% |
| **Testes E2E** | 🔄 Em Desenvolvimento | 30% |
| **Dashboard Admin** | ⏳ Planejado | 0% |

**Status Geral:** 🟢 **Produção** - Backend funcionando em produção

---

## 🛠️ Comandos Úteis

```bash
# Desenvolvimento
npm run dev                    # Rodar servidor dev
npm run build                  # Build TypeScript
npm start                      # Rodar produção

# Prisma
npx prisma studio              # Abrir Prisma Studio
npx prisma migrate dev         # Criar migration
npx prisma migrate deploy      # Aplicar migrations (produção)
npx prisma generate            # Gerar Prisma Client

# Docker
docker ps                      # Ver containers rodando
docker logs crm-backend -f     # Ver logs do backend
docker restart crm-backend     # Restart backend

# Deploy
./deploy.ps1                   # Deploy automático (Windows)
bash deploy.sh                 # Deploy automático (Linux/Mac)
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Add: Minha feature incrível'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para mais detalhes.

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja [LICENSE](LICENSE) para mais informações.

---

## 👥 Autores

**Fred Castro**
- GitHub: [@fredcast](https://github.com/fredcast)
- Projeto: [projeto-eva](https://github.com/fredcast/projeto-eva)

---

## 🙏 Agradecimentos

- [Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Prisma](https://www.prisma.io/)
- [Express](https://expressjs.com/)
- Comunidade Open Source

---

## 📞 Suporte

- 📧 Email: [Criar issue no GitHub](https://github.com/fredcast/projeto-eva/issues)
- 📖 Documentação: [DOCUMENTACAO-DEFINITIVA.md](DOCUMENTACAO-DEFINITIVA.md)
- 🐛 Bugs: [GitHub Issues](https://github.com/fredcast/projeto-eva/issues)

---

## 🎯 Roadmap

- [x] Backend API REST completo
- [x] Multi-Tenant Architecture
- [x] WhatsApp Business API Integration
- [x] Deploy em VPS
- [x] Documentação completa
- [ ] Frontend completo (Dashboard + Chat)
- [ ] Testes E2E com Playwright
- [ ] CI/CD com GitHub Actions
- [ ] Monitoramento e alertas
- [ ] Internacionalização (i18n)
- [ ] Mobile App (React Native)

---

<div align="center">

**[⬆ Voltar ao topo](#-crm-whatsapp-saas-multi-tenant)**

---

Feito com ❤️ para o setor hoteleiro

[![GitHub](https://img.shields.io/badge/GitHub-fredcast-181717?logo=github)](https://github.com/fredcast/projeto-eva)

</div>
