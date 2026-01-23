# Hotéis Reserva - Diretrizes de Desenvolvimento

## MISSÃO

Sistema de CRM e atendimento WhatsApp multi-tenant para rede de hotéis no Brasil, integrando IA conversacional, automações N8N e painel de atendimento em tempo real.

**PADRÃO DE DESENVOLVIMENTO: ENTERPRISE-LEVEL**

- **Meta** - Ship Fast, Fix Fast
- **Google** - Build for Scale
- **Amazon** - Customer Obsession
- **Netflix** - Data-Driven Decisions

---

## FILOSOFIA CORE

### SEGURANÇA EM PRIMEIRO LUGAR

```text
Ordem de Prioridade:
1. SEGURANÇA - Código seguro sempre
2. CORRETUDE - Código que funciona corretamente
3. CLAREZA - Código legível e manutenível
4. PERFORMANCE - Código otimizado
```

### ZERO GAMBIARRAS

```text
❌ PROIBIDO:
- "Depois a gente arruma"
- "TODO: fix later"
- any no TypeScript
- Ignorar erros silenciosamente
- Skip de testes

✅ OBRIGATÓRIO:
- Solução definitiva desde o início
- Código production-ready sempre
- Refatorar ANTES de adicionar mais código ruim
```

### QUALIDADE NÃO NEGOCIÁVEL

```text
├── Cobertura de Testes: ≥ 80%
├── Code Review: 100% do código
├── Zero Bugs Críticos em Produção
├── Documentação: 100% das APIs
└── LGPD Compliance
```

---

## STACK TECNOLÓGICO

### Backend (deploy-backend/)

| Tecnologia | Propósito |
|------------|-----------|
| Node.js 20+ | Runtime |
| Express | Framework HTTP |
| Prisma 5+ | ORM (type-safe) |
| PostgreSQL 16 | Database |
| Redis | Cache e filas |
| Socket.io | Real-time |
| BullMQ | Job queues |
| Pino | Logging |
| Zod | Validação |

### Frontend (apps/frontend/)

| Tecnologia | Propósito |
|------------|-----------|
| Next.js 14 | Framework (App Router) |
| React 18 | UI Library |
| TypeScript 5+ | Type Safety |
| Zustand | Client State |
| TanStack Query | Server State |
| Tailwind CSS | Styling |
| shadcn/ui | Componentes |
| Socket.io-client | Real-time |

### Integrações

| Sistema | Propósito |
|---------|-----------|
| WhatsApp Cloud API | Mensagens |
| N8N | Automações/Workflows |
| OpenAI/Anthropic | IA Conversacional |
| HSystem | Motor de reservas |

---

## ARQUITETURA DO PROJETO

```text
projeto-hoteis-reserva/
├── deploy-backend/           # Backend principal
│   ├── src/
│   │   ├── config/           # Configurações (database, redis, socket)
│   │   ├── controllers/      # Controllers HTTP
│   │   ├── services/         # Lógica de negócio
│   │   ├── routes/           # Rotas Express
│   │   ├── middlewares/      # Auth, validation, etc
│   │   ├── queues/           # BullMQ workers
│   │   ├── validators/       # Schemas Zod
│   │   └── types/            # TypeScript types
│   └── prisma/               # Schema e migrations
├── apps/frontend/            # Frontend Next.js
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   ├── components/       # React components
│   │   ├── services/         # API clients
│   │   ├── stores/           # Zustand stores
│   │   └── hooks/            # Custom hooks
└── docs/                     # Documentação
```

---

## TYPESCRIPT - REGRAS ABSOLUTAS

### NUNCA usar any

```typescript
// ❌ PROIBIDO
const processData = (data: any) => {};

// ✅ CORRETO
const processData = <T extends Record<string, unknown>>(data: T) => {};
```

### SEMPRE tipar retornos

```typescript
// ❌ ERRADO
const getConversation = async (id) => { ... };

// ✅ CORRETO
const getConversation = async (id: string): Promise<Conversation> => { ... };
```

---

## BACKEND - PADRÕES

### Controllers (apenas orquestração)

```typescript
router.get('/conversations', async (req: Request, res: Response) => {
  const conversations = await conversationService.findAll(req.tenantId!);
  return res.json(conversations);
});
```

### Services (lógica de negócio)

```typescript
class ConversationService {
  async findAll(tenantId: string): Promise<Conversation[]> {
    // SEMPRE filtrar por tenantId
    return prisma.conversation.findMany({
      where: { tenantId },
      include: { contact: true, messages: true },
    });
  }
}
```

### Validação com Zod

```typescript
export const createMessageSchema = z.object({
  content: z.string().min(1).max(4096),
  conversationId: z.string().uuid(),
  type: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT']),
});
```

---

## PRISMA - SCHEMA IMPORTANTE

### Modelo Message (ATENÇÃO)

```text
⚠️ CRÍTICO: O modelo Message NÃO possui campo updatedAt!

Campos disponíveis:
├── id: String
├── tenantId: String
├── conversationId: String
├── whatsappMessageId: String?
├── direction: MessageDirection (INBOUND/OUTBOUND)
├── type: MessageType
├── content: String
├── metadata: Json?
├── status: MessageStatus
├── sentById: String?
├── timestamp: DateTime       ← Data da mensagem
├── createdAt: DateTime       ← Data de criação no banco
└── NÃO TEM updatedAt!        ❌ NUNCA usar message.updatedAt
```

### Modelo Conversation

```text
Campos disponíveis:
├── id: String
├── tenantId: String
├── contactId: String
├── assignedToId: String?
├── status: ConversationStatus
├── lastMessageAt: DateTime?
├── createdAt: DateTime
├── updatedAt: DateTime       ← Conversation TEM updatedAt
├── closedAt: DateTime?
└── metadata: Json?
```

### Formatação de Datas para Socket.io

```typescript
// ✅ CORRETO - Message (sem updatedAt)
const messageForSocket = {
  ...message,
  timestamp: message.timestamp.toISOString(),
  createdAt: message.createdAt.toISOString(),
  // NÃO incluir updatedAt - não existe!
};

// ✅ CORRETO - Conversation (tem updatedAt)
const conversationForSocket = {
  ...conversation,
  createdAt: conversation.createdAt.toISOString(),
  updatedAt: conversation.updatedAt.toISOString(),
  lastMessageAt: conversation.lastMessageAt?.toISOString(),
};
```

---

## FRONTEND - PADRÕES

### Componentes React

```typescript
'use client'

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, onSelect }: ConversationListProps) {
  // SEMPRE validar arrays
  const items = Array.isArray(conversations) ? conversations : [];

  return items.map(conv => (
    <ConversationItem key={conv.id} conversation={conv} onClick={onSelect} />
  ));
}
```

### React Query

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['conversations', tenantId],
  queryFn: () => conversationService.getAll(),
  staleTime: 30 * 1000, // 30 segundos
});

// SEMPRE tratar estados
if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
```

---

## MULTI-TENANCY - CRÍTICO

### Regras Absolutas

1. **TODA query DEVE filtrar por tenantId**
2. **NUNCA confiar em tenantId do frontend** - usar do token JWT
3. **Middleware de tenant** em todas as rotas

```typescript
// Middleware obrigatório
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) throw new UnauthorizedException();
  req.tenantId = tenantId;
  next();
};
```

### Unidades Hoteleiras

```text
├── Ilha Bela
├── Campos do Jordão
├── Camburi
└── Santo Antônio do Pinhal
```

---

## WHATSAPP INTEGRATION

### Fluxo de Mensagens

```text
WhatsApp → Webhook → Queue → Process → Save DB → Socket.io → Frontend
```

### Templates Aprovados

```text
├── carousel_geral_Xcards     # Carrosséis de quartos
├── notificacao_atendente     # Notificação de escalação
└── confirmacao_reserva       # Confirmação de booking
```

### N8N Routes (/api/n8n/*)

```text
POST /send-text       # Texto simples
POST /send-buttons    # Botões interativos
POST /send-list       # Lista de opções
POST /send-carousel   # Carrossel de cards
POST /send-template   # Template aprovado
POST /escalate        # Escalar para humano
GET  /check-ia-lock   # Verificar se IA travada
POST /set-hotel-unit  # Definir unidade
```

---

## GIT WORKFLOW

### Branches

```text
main      → Produção
develop   → Staging
feature/* → Novas features
fix/*     → Correções
hotfix/*  → Urgente produção
```

### Commits (Conventional Commits)

```bash
feat(whatsapp): adicionar suporte a carrosséis

Problema:
Não havia forma de enviar múltiplos quartos de uma vez.

Solução:
Implementar endpoint /send-carousel com templates Meta.

Resultado:
Carrosséis funcionando com até 10 cards.
```

### REGRA ABSOLUTA: Commits no perfil do desenvolvedor

```bash
# Configuração Git OBRIGATÓRIA
git config user.name "Vinicius-Almeeida"
git config user.email "vinicius.mansao@gmail.com"

# ❌ PROIBIDO - Commits com assinatura de IA
feat: add feature

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>

# ✅ CORRETO - Commits limpos no perfil do dev
feat(scope): descrição clara

Problema: ...
Solução: ...
Resultado: ...
```

---

## DEPLOY

### Infraestrutura

```text
┌─────────────────────────────────────────────────────┐
│  VPS: 72.61.39.235                                  │
│  SSH: ssh root@72.61.39.235                         │
├─────────────────────────────────────────────────────┤
│  Containers Docker:                                 │
│  ├── crm-backend (produção)                         │
│  ├── crm-backend-dev (desenvolvimento)              │
│  ├── crm-postgres / crm-postgres-dev                │
│  ├── crm-redis / crm-redis-dev                      │
│  └── crm-nginx (reverse proxy + SSL)                │
├─────────────────────────────────────────────────────┤
│  Frontend: Vercel (auto-deploy)                     │
│  Backend API: https://api.hoteisreserva.com.br      │
└─────────────────────────────────────────────────────┘
```

### Comandos Úteis VPS

```bash
# Ver containers
docker ps

# Logs backend
docker logs crm-backend --tail 100 -f

# Rebuild e deploy
docker compose down
docker compose build --no-cache
docker compose up -d

# Migrations
docker exec crm-backend npx prisma migrate deploy
```

---

## SEGURANÇA

### Autenticação

```text
├── JWT Access Token (15min)
├── Refresh Token (7 dias)
├── API Key para N8N (header X-API-Key)
└── Webhook signature verification
```

### Tenant Isolation

```typescript
// TODA query deve ter tenantId
prisma.conversation.findMany({
  where: {
    tenantId,  // OBRIGATÓRIO
    status: 'OPEN'
  }
});
```

### O que NUNCA logar

```text
├── Senhas
├── Tokens
├── WhatsApp Access Token
├── API Keys
└── Dados pessoais completos
```

---

## REAL-TIME (Socket.io)

### Eventos

```typescript
// Backend emite
socket.to(`tenant:${tenantId}`).emit('message:new', message);
socket.to(`conversation:${id}`).emit('message:status', status);

// Frontend escuta
socket.on('message:new', handleNewMessage);
socket.on('conversation:updated', handleUpdate);
```

### Rooms

```text
├── tenant:{tenantId}           # Todos do tenant
├── conversation:{id}           # Conversa específica
└── user:{userId}               # Usuário específico
```

---

## FILAS (BullMQ)

### Queues

```text
├── whatsapp-webhook    # Processar webhooks
├── send-message        # Enviar mensagens
├── process-ai          # Processar com IA
└── status-update       # Atualizar status
```

### Workers

```typescript
// Worker pattern
new Worker('whatsapp-webhook', async (job) => {
  const { tenantId, payload } = job.data;
  await processWebhook(tenantId, payload);
}, { connection: redis });
```

---

## TESTES

### Mínimos Obrigatórios

```text
├── Unit Tests: ≥ 80%
├── Integration: Rotas críticas
└── E2E: Fluxos principais
```

### Padrão AAA

```typescript
describe('ConversationService', () => {
  it('should create conversation', async () => {
    // Arrange
    const dto = { contactId: 'uuid', tenantId: 'uuid' };

    // Act
    const result = await service.create(dto);

    // Assert
    expect(result.id).toBeDefined();
  });
});
```

---

## API PATTERNS

### Status Codes

| Code | Uso |
|------|-----|
| 200 | GET, PATCH sucesso |
| 201 | POST criação |
| 204 | DELETE sucesso |
| 400 | Validação falhou |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 500 | Erro interno |

### Resposta de Erro

```json
{
  "error": "Validation failed",
  "message": "Campo obrigatório",
  "statusCode": 400
}
```

---

## CHECKLIST PRÉ-IMPLEMENTAÇÃO

### Segurança
- [ ] Inputs validados (Zod)
- [ ] Tenant isolation
- [ ] Auth middleware aplicado
- [ ] Sem dados sensíveis em logs

### Código
- [ ] TypeScript strict, ZERO any
- [ ] Parâmetros e retornos tipados
- [ ] DRY - sem repetição
- [ ] Funções pequenas e focadas

### Frontend
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Arrays validados

### Git
- [ ] Commit convencional
- [ ] SEM assinatura Claude/IA
- [ ] Commit no perfil @Vinicius-Almeeida
- [ ] Branch correta

---

## NOMENCLATURA

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Arquivos | kebab-case | `conversation-service.ts` |
| Classes | PascalCase | `ConversationService` |
| Variáveis | camelCase | `conversationId` |
| Constantes | UPPER_SNAKE | `MAX_MESSAGE_LENGTH` |
| Componentes | PascalCase | `ConversationList` |
| Hooks | useCamelCase | `useConversations` |

---

## COMUNICAÇÃO

```text
├── Usuário → Português Brasil
├── Código/Variáveis → Inglês
├── Commits → Português
├── Logs → Inglês
└── UI → Português Brasil
```

---

## LEMA DO PROJETO

> **"Real-time Excellence, Security First"**
>
> Atendimento em tempo real com segurança enterprise.
> Multi-tenant isolation é inegociável.
> Zero gambiarras, sempre definitivo.
