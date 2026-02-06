# Memories - CRM Hoteis Reserva

## Projeto
- **Tipo**: SaaS multi-tenant CRM para hoteis
- **Status**: Em producao
- **Arquitetura**: Frontend (Vercel) + Backend (VPS Docker)
- **Deploy Frontend**: Vercel (auto-deploy de main)
- **Deploy Backend**: VPS com Docker Compose
- **VPS IP**: 72.61.39.235

## CI/CD
- **GitHub Actions**: Auto-deploy ao push em main
- **Registry**: Imagens Docker locais na VPS
- **Secrets necessarios**:
  - `VPS_HOST` - IP da VPS (72.61.39.235)
  - `VPS_USER` - Usuario SSH
  - `VPS_SSH_KEY` - Chave SSH privada
- **Diretorio VPS**: `/root/deploy-backend/`

## Variaveis de Ambiente

### Vercel (Frontend)
```
NEXT_PUBLIC_API_URL=https://api.hoteisreserva.com.br
NEXTAUTH_SECRET=[secret]
NEXTAUTH_URL=https://hoteisreserva.com.br
```

### VPS (Backend)
```
DATABASE_URL=postgresql://[user]:[password]@crm-postgres:5432/crm_production
REDIS_URL=redis://crm-redis:6379
JWT_SECRET=[secret]
ENCRYPTION_KEY=[key]
WHATSAPP_VERIFY_TOKEN=[token]
```

## Decisoes Arquiteturais

| Data | Decisao | Motivo |
|------|---------|--------|
| 2024-11 | Prisma ORM | Tipagem forte, migrations faceis |
| 2024-11 | Bull + Redis | Filas para processamento assincrono de webhooks |
| 2024-12 | Socket.io | Real-time para atualizacoes de conversas |
| 2025-01 | N8N para IA | Flexibilidade de automacoes sem alterar codigo |
| 2025-01 | Role SALES | Equipe comercial com filtro isOpportunity |

## Integracoes

| Servico | Status | Notas |
|---------|--------|-------|
| WhatsApp Cloud API (Meta) | Configurado | Webhook validado com HMAC |
| N8N | Configurado | Infraestrutura 3ian separada |
| Socket.io | Configurado | Rooms por tenant |

## Licoes Aprendidas

| Problema | Solucao |
|----------|---------|
| Rate limit N8N baixo | Aumentado para 5000 req/min (carousels) |
| IA e humano respondem juntos | Implementado iaLocked + check-ia-lock |
| Prisma migrate dev em prod | NUNCA usar! Sempre migrate deploy |
| Socket sem auth | Adicionar validacao JWT na conexao |
| Oportunidades nao aparecem pra SALES | Filtrar isOpportunity no backend, nao frontend |
| Follow-up nao aparece pra vendas | Marcar isOpportunity ao ENVIAR follow-up, nao ao responder |
| ESLint unescaped quotes | Usar &quot; ao inves de aspas em JSX |
| Query sem tenantId (CRIT-001) | TODA query Prisma DEVE incluir tenantId na WHERE clause |
| window.socket exposto (P0-3) | NUNCA expor socket globalmente, atacante pode manipular via DevTools |
| findUnique vs findFirst | Usar findFirst quando query nao eh por unique key (ex: email+tenantId) |
| pnpm-lock desatualizado | Sempre rodar `pnpm install` apos alterar package.json antes de commit |

## Diario de Desenvolvimento

### 2026-02-04 - Security Fixes Multi-Tenant e Socket

**Problemas identificados:**

1. CRIT-001: auth.service.ts buscava usuario por email globalmente, verificava tenant depois (vulneravel a timing attacks)
2. P0-3: useSocket.ts expunha socket global via window.socket + console.logs em producao

**Solucoes implementadas:**

- auth.service.ts: tenantId agora eh incluido na WHERE clause da query Prisma (nao apenas verificado depois)
- useSocket.ts: removido window.socket global e todos console.logs

**Arquivos modificados:**

- `deploy-backend/src/services/auth.service.ts` - query com tenantId
- `deploy-backend/src/__tests__/services/auth.service.test.ts` - testes TDD (9 testes)
- `apps/frontend/src/hooks/useSocket.ts` - removido vulnerabilidades
- `apps/frontend/tsconfig.json` - adicionado types: ["node"]
- `deploy-backend/jest.setup.ts` - adicionado mock findFirst

**Commits:**

- `aba7018` fix(security): corrigir vulnerabilidades multi-tenant e socket
- `6313e75` fix(deps): atualizar pnpm-lock.yaml para frontend

### 2025-02-02 - Ajuste Follow-up -> Oportunidade
**Problema:** Time de vendas so via oportunidade quando cliente respondia follow-up

**Solucao:** Endpoint mark-followup-sent agora marca isOpportunity=true imediatamente ao enviar

**Arquivos modificados:**
- `deploy-backend/src/routes/n8n.routes.ts`

### 2025-01-28 - Perfil SALES Implementado
**O que foi feito:**
- Role SALES adicionada ao enum
- Filtro isOpportunity no backend
- Dashboard customizado para SALES
- Endpoints N8N: mark-followup-sent, mark-opportunity
- Notificacao real-time via Socket.io

## Debitos Tecnicos
- [ ] Adicionar testes E2E
- [ ] Implementar rate limiting mais granular
- [ ] Adicionar monitoramento (Sentry/DataDog)
- [x] Implementar perfil SALES
- [x] Auto-deploy backend

## Proximos Passos
- [ ] Gestao de quartos/reservas
- [ ] Dashboard de metricas
- [ ] Integracao com OTAs (Booking, Expedia)
- [ ] App mobile
