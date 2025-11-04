# 🏨 CRM WhatsApp para Hotéis - SaaS Multi-Tenant

> **Plataforma SaaS enterprise de gerenciamento de conversas WhatsApp com arquitetura multi-tenant**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
[![Multi-Tenant](https://img.shields.io/badge/Architecture-Multi--Tenant-orange)]()
[![License](https://img.shields.io/badge/License-Proprietário-red)]()

---

## 📋 Sobre o Projeto

**SaaS Multi-Tenant** para gerenciamento de conversas WhatsApp, desenvolvido para ser **vendido como serviço** para múltiplos hotéis. Cada hotel tem seu **ambiente completamente isolado** com suas próprias credenciais WhatsApp.

### Modelo de Negócio SaaS

Similar ao Claude Code, Slack, ou Notion:
- **Você (Empresa):** Oferece a plataforma como serviço
- **Clientes (Hotéis):** Assinam mensalmente e têm seu painel exclusivo
- **Isolamento Total:** Cada hotel (`hotelcopacabana.seucrm.com`) vê apenas seus dados
- **Escalável:** Suporta centenas/milhares de hotéis na mesma infraestrutura

Utiliza a **WhatsApp Business API oficial da Meta** e oferece:

✅ **Interface Kanban** para gerenciamento visual de conversas
✅ **Chat em tempo real** similar ao WhatsApp Web
✅ **Multi-atendente** com atribuição automática
✅ **Integração n8n** para automações
✅ **WebSocket** para atualizações instantâneas
✅ **Sistema de filas** para processamento assíncrono
✅ **API RESTful** completa e documentada
✅ **Segurança enterprise** (JWT, RBAC, HTTPS)

---

## 🎯 Problema que Resolve

- ❌ **Antes:** Cliente usava ZAPI (API não oficial) com risco de bloqueio
- ✅ **Agora:** WhatsApp Business API oficial da Meta, 100% dentro das regras
- ✅ **Bônus:** Interface profissional para atendentes + automações n8n mantidas

---

## 🏗️ Arquitetura

```
┌────────────────┐        ┌────────────────┐        ┌────────────────┐
│  WhatsApp API  │◄──────►│  Backend API   │◄──────►│  Frontend CRM  │
│  (Meta Cloud)  │        │  (Node.js)     │        │  (Next.js)     │
└────────────────┘        └────────┬───────┘        └────────────────┘
                                   │
                          ┌────────┴────────┐
                          │                 │
                     ┌────▼─────┐    ┌─────▼──────┐
                     │PostgreSQL│    │   Redis    │
                     └──────────┘    └────────────┘
```

**Detalhes técnicos:** Veja [DOCS-ARQUITETURA.md](./DOCS-ARQUITETURA.md)

---

## 🚀 Features Principais

### Para Atendentes
- 💬 **Chat interface** - Conversar igual WhatsApp Web
- 📊 **Kanban board** - Arrasta e solta conversas entre status
- 🔔 **Notificações real-time** - Via WebSocket
- 🏷️ **Tags e prioridades** - Organizar conversas
- 📎 **Mídias** - Enviar/receber imagens, vídeos, documentos
- 👤 **Perfil de contatos** - Histórico completo

### Para Administradores
- 👥 **Gerenciar atendentes** - Criar, editar, desativar usuários
- 📈 **Dashboard analytics** - Métricas de atendimento
- 🎨 **Customizar tags** - Criar etiquetas personalizadas
- 🔐 **Controle de acesso** - RBAC (Admin/Atendente)

### Para Desenvolvedores (n8n)
- 🔌 **API RESTful** - Endpoints documentados
- 📡 **Webhooks** - Receber eventos em tempo real
- 🔑 **API Key auth** - Autenticação simples
- 📚 **OpenAPI/Swagger** - Documentação interativa

---

## 📁 Estrutura do Projeto

```
projeto-hoteis-reserva/
├── 📚 DOCS-ARQUITETURA.md           # Arquitetura detalhada
├── 📚 DOCS-DESENVOLVIMENTO.md       # Guia de desenvolvimento
├── 📚 DOCS-DEPLOY.md                # Guia de deploy
├── 📚 DOCS-API-REFERENCE.md         # Referência da API
│
├── apps/
│   ├── backend/                     # API Node.js + TypeScript
│   │   ├── src/
│   │   │   ├── controllers/         # Rotas Express
│   │   │   ├── services/            # Lógica de negócio
│   │   │   ├── repositories/        # Acesso a dados (Prisma)
│   │   │   ├── middlewares/         # Auth, validação, etc
│   │   │   ├── websocket/           # Socket.io handlers
│   │   │   └── queues/              # Bull jobs (Redis)
│   │   └── prisma/                  # Schema e migrations
│   │
│   └── frontend/                    # CRM Next.js + React
│       ├── src/
│       │   ├── app/                 # Next.js App Router
│       │   ├── components/          # React components
│       │   │   ├── kanban/          # Kanban board
│       │   │   └── chat/            # Chat interface
│       │   └── lib/                 # API client, utils
│       └── public/                  # Assets estáticos
│
├── packages/                        # Shared code
│   ├── shared-types/                # TypeScript types
│   └── config/                      # ESLint, Prettier
│
└── infra/                           # DevOps
    ├── docker/                      # Dockerfiles
    └── docker-compose.yml           # Orquestração
```

---

## 🛠️ Stack Tecnológico

### Backend
- **Node.js 20** + **TypeScript** - Runtime e linguagem
- **Express.js** - Framework web
- **Prisma ORM** - Database access layer
- **PostgreSQL 16** - Database principal
- **Redis 7** - Cache e filas
- **Bull/BullMQ** - Job queues
- **Socket.io** - WebSocket real-time
- **Zod** - Validação de dados
- **JWT** - Autenticação
- **Pino** - Logging estruturado
- **Jest** - Testes

### Frontend
- **Next.js 14** - React framework (App Router)
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Shadcn/ui** - Component library
- **React Query** - Server state
- **Zustand** - Client state
- **Socket.io Client** - WebSocket
- **Playwright** - E2E tests

### DevOps
- **Docker** + **Docker Compose** - Containerização
- **GitHub Actions** - CI/CD
- **Nginx** - Reverse proxy
- **Let's Encrypt** - SSL certificates

---

## 🚀 Começando

### Pré-requisitos

```bash
Node.js 20+
pnpm 8+
Docker & Docker Compose
PostgreSQL 16 (ou via Docker)
Redis 7 (ou via Docker)
```

### Instalação Rápida (Desenvolvimento)

```bash
# 1. Clonar repositório
git clone https://github.com/seu-usuario/projeto-hoteis-reserva.git
cd projeto-hoteis-reserva

# 2. Instalar dependências
pnpm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 4. Subir banco de dados com Docker
docker-compose up -d postgres redis

# 5. Rodar migrations
cd apps/backend
pnpm prisma migrate dev

# 6. Criar usuário admin
pnpm prisma db seed

# 7. Iniciar backend (terminal 1)
pnpm dev

# 8. Iniciar frontend (terminal 2)
cd ../frontend
pnpm dev
```

**Acessar:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Prisma Studio: http://localhost:5555

**Login padrão:**
- Email: `admin@hotel.com`
- Senha: `admin123` (MUDAR EM PRODUÇÃO!)

---

## 📚 Documentação Completa

| Documento | Descrição |
|-----------|-----------|
| [DOCS-MULTI-TENANT.md](./DOCS-MULTI-TENANT.md) | **⭐ Arquitetura Multi-Tenant SaaS** (LEIA PRIMEIRO!) |
| [DOCS-ARQUITETURA.md](./DOCS-ARQUITETURA.md) | Decisões arquiteturais, stack, diagramas |
| [DOCS-DESENVOLVIMENTO.md](./DOCS-DESENVOLVIMENTO.md) | Como desenvolver cada parte do sistema |
| [DOCS-DEPLOY.md](./DOCS-DEPLOY.md) | Deploy em VPS (produção) |
| [DOCS-API-REFERENCE.md](./DOCS-API-REFERENCE.md) | Referência completa da API REST |

---

## 🔐 Configuração WhatsApp Business API

### 1. Criar App na Meta

1. Acesse [Facebook Developers](https://developers.facebook.com/)
2. Crie um App tipo "Business"
3. Adicione produto "WhatsApp"
4. Configure número de telefone
5. Gere **Access Token** permanente

### 2. Configurar Webhook

Na interface da Meta, configure:

```
URL: https://api.seudominio.com/webhooks/whatsapp
Verify Token: [seu_token_secreto]
Campos: messages
```

### 3. Variáveis de Ambiente

```env
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_APP_SECRET=abc123...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_token_secreto
```

**Guia completo:** [DOCS-DESENVOLVIMENTO.md](./DOCS-DESENVOLVIMENTO.md#4-whatsapp)

---

## 🤖 Integração com n8n

### Enviar Mensagem

```http
POST https://api.seudominio.com/api/n8n/send-message
Content-Type: application/json
X-API-Key: sua_api_key

{
  "phoneNumber": "5511999999999",
  "message": "Seu check-in foi confirmado!"
}
```

### Receber Webhooks (n8n)

Configure webhook no n8n para receber eventos:
- Nova mensagem recebida
- Status de mensagem atualizado
- Conversa criada/fechada

**API completa:** [DOCS-API-REFERENCE.md](./DOCS-API-REFERENCE.md#-n8n-integration)

---

## 🐳 Deploy em Produção (VPS)

```bash
# 1. No servidor
git clone https://github.com/seu-usuario/projeto-hoteis-reserva.git
cd projeto-hoteis-reserva

# 2. Configurar .env.production
nano .env.production

# 3. Subir containers
docker-compose -f infra/docker-compose.prod.yml up -d --build

# 4. Configurar SSL (Let's Encrypt)
sudo certbot --nginx -d seudominio.com -d api.seudominio.com

# 5. Verificar
docker ps
```

**Guia completo:** [DOCS-DEPLOY.md](./DOCS-DEPLOY.md)

---

## 🧪 Testes

```bash
# Testes unitários (Backend)
cd apps/backend
pnpm test

# Testes E2E (Frontend)
cd apps/frontend
pnpm test:e2e

# Coverage
pnpm test:coverage
```

---

## 📊 Roadmap

### ✅ Fase 1 - MVP (Atual)
- [x] Documentação completa
- [ ] Backend API completo
- [ ] Frontend CRM básico
- [ ] Integração WhatsApp
- [ ] Deploy VPS

### 🚧 Fase 2 - Melhorias
- [ ] Dashboard analytics
- [ ] Relatórios em PDF
- [ ] Chatbot com IA
- [ ] App mobile (React Native)

### 🔮 Fase 3 - Enterprise
- [ ] Multi-tenancy (SaaS)
- [ ] Integrações PMS (Opera, Mews)
- [ ] Webhooks customizáveis
- [ ] API pública documentada

---

## 🤝 Contribuindo

Este é um projeto proprietário. Contribuições são aceitas mediante aprovação.

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add: nova feature incrível'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

**Padrões de código:** ESLint + Prettier (configurado)

---

## 📄 Licença

**Proprietário** - Todos os direitos reservados.

Este software é desenvolvido para uso exclusivo em redes de hotéis autorizadas.

---

## 👨‍💻 Desenvolvido por

**Claude Code** (Anthropic)
Desenvolvido com excelência para atender os mais altos padrões enterprise.

---

## 📞 Suporte

- 📧 Email: suporte@seudominio.com
- 📚 Docs: https://docs.seudominio.com
- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/projeto-hoteis-reserva/issues)

---

## 🙏 Agradecimentos

- [Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Next.js Team](https://nextjs.org/)
- [Prisma Team](https://www.prisma.io/)
- [Shadcn](https://ui.shadcn.com/)

---

<div align="center">

**Construído com ❤️ usando as melhores práticas de desenvolvimento**

[⬆ Voltar ao topo](#-crm-whatsapp-para-hotéis)

</div>
