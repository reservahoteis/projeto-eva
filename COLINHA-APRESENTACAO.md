# Colinha de Apresentacao - CRM Hoteis Reserva

> **Dica:** Use Ctrl+F para buscar rapidamente por palavras-chave

---

## 1. ELEVATOR PITCH (30 segundos)

**O que e:**
"E um CRM SaaS multi-tenant para hoteis e pousadas brasileiras. Automatiza o atendimento via WhatsApp usando IA, mas permite escalacao para humano quando necessario. O sistema funciona em tempo real, com dashboard estilo Kanban para atendentes."

**Diferencial:**
"Cada hotel tem isolamento total de dados. A IA via N8N e plugavel - mudamos fluxos sem alterar codigo. E o time comercial ve apenas oportunidades de venda, sem poluir o atendimento."

---

## 2. ARQUITETURA VISUAL

```
                    +------------------+
                    |   CLIENTE        |
                    |   WhatsApp       |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   META CLOUD     |
                    |   WhatsApp API   |
                    +--------+---------+
                             | Webhook
          +------------------+------------------+
          |                                     |
+---------v---------+               +-----------v-----------+
|                   |   forward    |                       |
|   BACKEND (VPS)   +------------->+   N8N (3ian infra)    |
|   Express + TS    |              |   Automacoes IA       |
|   72.61.39.235    |<-------------+                       |
|                   |   API calls  +-----------------------+
+---------+---------+
          |
+---------v---------+      +-------------------+
|   PostgreSQL 16   |      |   Redis + Bull    |
|   Prisma ORM      |      |   Filas/Cache     |
+-------------------+      +-------------------+
          |
+---------v---------+
|   Socket.io       |
|   Real-time       |
+-------------------+
          |
+---------v---------+
|   FRONTEND        |
|   Next.js 14      |
|   Vercel          |
|   hoteisreserva   |
|     .com.br       |
+-------------------+
```

---

## 3. STACK TECNOLOGICA

| Camada | Tecnologia | Por que escolhemos |
|--------|------------|-------------------|
| **Frontend** | Next.js 14 (App Router) | Server Components, SEO, performance |
| **UI** | TailwindCSS + Radix UI | Acessibilidade + produtividade |
| **State** | TanStack Query + Zustand | Cache inteligente + estado global |
| **Backend** | Express.js + TypeScript | Maduro, tipado, bom ecossistema |
| **ORM** | Prisma | Tipagem forte, migrations faceis |
| **Banco** | PostgreSQL 16 | JSONB, performance, confiabilidade |
| **Cache/Filas** | Redis + BullMQ | Processamento assincrono de webhooks |
| **Real-time** | Socket.io | Rooms por tenant, eventos tipados |
| **Validacao** | Zod | Runtime validation + inferencia TS |
| **IA** | N8N | Flexibilidade sem alterar codigo |

---

## 4. MODELO DE DADOS (PRINCIPAIS)

```
Tenant (Hotel)
├── Users (Atendentes)
├── Contacts (Clientes WhatsApp)
├── Conversations (Atendimentos)
│   ├── Messages
│   ├── Tags
│   └── Escalations (IA → Humano)
└── UsageTracking (Billing)
```

### Campos importantes:

**Tenant:**
- `whatsappPhoneNumberId` - Numero do WhatsApp
- `whatsappAccessToken` - Token criptografado (AES-256)
- `n8nWebhookUrl` - URL para encaminhar mensagens

**Conversation:**
- `iaLocked` - Quando true, IA NAO responde
- `isOpportunity` - Oportunidade de venda
- `hotelUnit` - Unidade do hotel (filtro)

---

## 5. SISTEMA DE ROLES

| Role | O que faz | Acesso |
|------|-----------|--------|
| **SUPER_ADMIN** | Voce (dono SaaS) | Todos tenants, tudo |
| **TENANT_ADMIN** | Admin do hotel | Seu tenant, gerencia users |
| **HEAD** | Supervisor | Seu tenant, ve tudo, NAO gerencia users |
| **ATTENDANT** | Atendente | Conversas da sua unidade |
| **SALES** | Comercial | Apenas `isOpportunity=true` |

---

## 6. FLUXO DE ATENDIMENTO

```
1. Cliente manda mensagem WhatsApp
          ↓
2. Meta envia webhook → Backend
          ↓
3. Backend salva + envia para N8N
          ↓
4. N8N processa com IA (se iaLocked=false)
          ↓
5. IA responde OU escala para humano
          ↓
6. Se escalou: Socket.io notifica atendentes
          ↓
7. Atendente assume no dashboard Kanban
```

---

## 7. FAQ - PERGUNTAS TECNICAS

### Arquitetura

**P: Por que separar frontend e backend?**
> Frontend no Vercel (CDN global, auto-scale) e backend na VPS (controle, custos). A separacao permite escalar independentemente.

**P: Por que VPS e nao AWS/GCP?**
> Custo-beneficio. Para o volume atual, VPS e mais barato. A arquitetura e cloud-agnostic - podemos migrar facilmente com Docker.

**P: Por que N8N e nao IA direto no backend?**
> Flexibilidade. O cliente pode ajustar fluxos de IA sem deploy. Mudou o prompt? Muda no N8N. Adicionou FAQ? Muda no N8N.

---

### Multi-Tenant

**P: Como garante isolamento de dados?**
> TODA query Prisma tem `tenantId`. Middleware extrai do JWT e injeta em `req.tenantId`. Impossivel acessar dados de outro tenant.

**P: Um hotel consegue ver dados de outro?**
> Nao. Mesmo se tentar passar outro tenantId na request, o middleware sobrescreve com o do JWT.

**P: Como funciona o WhatsApp para cada tenant?**
> Cada tenant configura suas proprias credenciais Meta (Business Account, Phone Number ID, Access Token). O webhook identifica o tenant pelo WABA ID.

---

### Seguranca

**P: Como armazena tokens WhatsApp?**
> Criptografados com AES-256. Chave na env var `ENCRYPTION_KEY`. Descriptografa apenas no momento do uso.

**P: Como valida webhooks da Meta?**
> HMAC-SHA256. O `whatsappAppSecret` do tenant valida assinatura do payload. Rejeita se invalido.

**P: Como funciona auth?**
> JWT com access token (15min) + refresh token (7d). Middleware valida em toda request autenticada.

---

### Real-time

**P: Como funciona o Socket.io?**
> Rooms por tenant + conversa. Quando mensagem chega, emite para sala da conversa. Atendente ve instantaneamente.

**P: Se cair a conexao?**
> TanStack Query faz polling de fallback. Reconecta automaticamente.

---

### IA e Automacao

**P: Como evita IA e humano responderem juntos?**
> Campo `iaLocked`. Quando atendente assume, marca true. N8N verifica via endpoint `check-ia-lock` antes de responder.

**P: Como funciona a escalacao?**
> IA chama endpoint `escalate`. Backend salva Escalation, marca `iaLocked=true`, emite evento Socket para notificar atendentes.

**P: E se N8N cair?**
> Mensagens continuam sendo salvas. Quando volta, pode reprocessar. Fila Bull mantem jobs pendentes.

---

### Performance

**P: Como lida com muitas mensagens?**
> BullMQ processa webhooks em fila. Nao bloqueia. Rate limit de 5000 req/min (carousels pesados).

**P: Tem cache?**
> Redis para sessoes, rate limiting, e cache de queries frequentes.

---

### CI/CD

**P: Como faz deploy?**
> GitHub Actions. Push em `main` dispara build e deploy automatico. Frontend vai pra Vercel, backend pra VPS via SSH.

**P: Tem ambiente de staging?**
> Sim. Branch `develop` deploya em ambiente dev (porta 3002).

---

## 8. METRICAS ATUAIS

| Metrica | Valor |
|---------|-------|
| Tenants ativos | 1 (Hoteis Reserva) |
| Usuarios | ~10 atendentes |
| Conversas/mes | ~500-1000 |
| Uptime | 99.9% |
| Tempo resposta API | <100ms (p95) |

---

## 9. DEBITOS TECNICOS (Honestidade)

| Debito | Impacto | Plano |
|--------|---------|-------|
| Sem testes E2E | Risco em refactors | Implementar com Playwright |
| Sem monitoramento (Sentry) | Debug dificil | Adicionar Sentry/DataDog |
| i18n hardcoded pt_BR | Nao escala internacional | Implementar next-intl |
| Rate limiting basico | Pode ter abuso | Granularizar por endpoint |

---

## 10. ROADMAP

| Fase | Features |
|------|----------|
| **Atual** | CRM WhatsApp, IA, Kanban, SALES |
| **Q1 2025** | Gestao de quartos/reservas |
| **Q2 2025** | Dashboard metricas |
| **Q3 2025** | Integracao OTAs (Booking, Expedia) |
| **Futuro** | App mobile, multi-WABA |

---

## 11. PONTOS FORTES DO PROJETO

1. **Arquitetura limpa** - Separacao clara de responsabilidades
2. **Multi-tenant robusto** - Isolamento total por design
3. **TypeScript strict** - Menos bugs, melhor DX
4. **IA plugavel** - N8N permite iteracao rapida
5. **Real-time** - UX moderna com Socket.io
6. **Deploy automatizado** - CI/CD funcional
7. **Documentacao interna** - Skills e MCPs para produtividade

---

## 12. COMANDOS UTEIS

```bash
# Backend (VPS)
cd deploy-backend
pnpm dev                    # Dev local
pnpm build                  # Build
pnpm prisma:generate        # Gerar client
pnpm prisma migrate deploy  # Migrations

# Frontend
cd apps/frontend
pnpm dev                    # Dev local (porta 3000)
pnpm build                  # Build
npx tsc --noEmit            # Verificar tipos

# VPS
ssh root@72.61.39.235
docker logs crm-backend --tail 100
docker compose restart crm-backend
```

---

## 13. LINKS IMPORTANTES

| O que | URL |
|-------|-----|
| Frontend Prod | https://hoteisreserva.com.br |
| API Prod | https://api.hoteisreserva.com.br |
| VPS IP | 72.61.39.235 |

---

## 14. RESPOSTAS RAPIDAS

**"Quanto tempo pra onboarding de dev?"**
> 1-2 dias para entender arquitetura, 1 semana para produtividade.

**"Qual a maior complexidade?"**
> Fluxo WhatsApp → N8N → Backend → Socket → Frontend. Muitas partes moveis.

**"O que mais precisa melhorar?"**
> Testes automatizados e monitoramento. Sao os maiores debitos.

**"Porque nao usou [X tecnologia]?"**
> Stack escolhida por familiaridade do time e maturidade. Nao reinventamos roda.

**"Ta pronto pra escalar?"**
> Horizontalmente sim (mais VPS, mais containers). Verticalmente depende de otimizacoes.

---

*Documento gerado em 2025-02-03 para apresentacao do projeto.*
