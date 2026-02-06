---
name: hoteis-fix
description: Corrigir bugs e problemas no CRM Hoteis Reserva
version: 1.0.0
author: Hoteis Reserva Team
---

# Skill: Corrigir Bug - CRM Hoteis Reserva

Esta skill auxilia na correcao de bugs seguindo um processo sistematico.

## Quando Usar

Use `/hoteis-fix` quando precisar:
- Corrigir um bug reportado
- Investigar um erro no sistema
- Resolver problemas de performance

## Processo de Correcao

### 1. Identificar o Problema

```
Coletar informacoes:
- Mensagem de erro exata
- Stack trace (se disponivel)
- Passos para reproduzir
- Ambiente (dev/staging/prod)
- Usuario/tenant afetado
```

### 2. Localizar o Codigo

```
Estrutura do projeto:

Backend:
deploy-backend/src/
├── routes/          # Rotas HTTP
├── controllers/     # Request handlers
├── services/        # Logica de negocio
├── middlewares/     # Auth, validation, tenant
└── config/          # Database, logger

Frontend:
frontend/src/
├── app/             # Pages (App Router)
├── components/      # Componentes React
├── hooks/           # Custom hooks
└── lib/             # Utilitarios, API client
```

### 3. Tipos Comuns de Bugs

#### Bug de Autenticacao
```typescript
// Verificar middleware de auth
// deploy-backend/src/middlewares/auth.middleware.ts

// Sintomas:
// - 401 Unauthorized
// - "Token invalido"
// - "Token expirado"

// Checklist:
// [ ] Token esta sendo enviado no header?
// [ ] Token nao expirou?
// [ ] Secret esta correto no .env?
// [ ] Middleware esta na rota?
```

#### Bug de Multi-tenant
```typescript
// CRITICO: Sempre filtrar por tenantId

// ERRADO - Vazamento de dados
const items = await prisma.conversation.findMany();

// CORRETO
const items = await prisma.conversation.findMany({
  where: { tenantId: req.tenantId }
});

// Checklist:
// [ ] tenantId no WHERE de todas queries
// [ ] tenantMiddleware na rota
// [ ] req.tenantId sendo usado no service
```

#### Bug de Validacao
```typescript
// Verificar schema Zod

// Sintomas:
// - 400 Bad Request
// - "Dados invalidos"

// Verificar:
// [ ] Schema esta correto?
// [ ] Campos obrigatorios estao sendo enviados?
// [ ] Tipos estao corretos (string vs number)?
// [ ] Middleware validate() esta na rota?
```

#### Bug de Query N+1
```typescript
// ERRADO - N+1 queries
const conversations = await prisma.conversation.findMany();
for (const conv of conversations) {
  const messages = await prisma.message.findMany({
    where: { conversationId: conv.id }
  });
}

// CORRETO - Include
const conversations = await prisma.conversation.findMany({
  include: { messages: true }
});
```

#### Bug de Estado React
```typescript
// Sintomas:
// - Estado nao atualiza
// - Loop infinito de renders
// - Dados desatualizados

// Verificar:
// [ ] Dependencias do useEffect corretas?
// [ ] Nao mutando estado diretamente?
// [ ] QueryClient invalidando queries?

// ERRADO
state.items.push(newItem);
setState(state);

// CORRETO
setState([...state.items, newItem]);
```

### 4. Debugar

#### Backend - Adicionar Logs
```typescript
import logger from '@/config/logger';

// No service
logger.info({ tenantId, data }, 'Service: Input');

try {
  const result = await prisma.conversation.findMany({ ... });
  logger.info({ count: result.length }, 'Service: Result');
  return result;
} catch (error) {
  logger.error({ error: error.message, stack: error.stack }, 'Service: Error');
  throw error;
}
```

#### Frontend - Console e DevTools
```typescript
// No hook
console.log('[Hook] Query data:', data);
console.log('[Hook] Error:', error);

// React Query DevTools
// Verificar status da query: loading, error, success
// Verificar cache: dados stale?
```

#### Database - Query Raw
```sql
-- Verificar dados diretamente
SELECT * FROM "Conversation"
WHERE "tenantId" = 'xxx'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Verificar indices
EXPLAIN ANALYZE SELECT ...;
```

### 5. Aplicar Correcao

```typescript
// 1. Criar branch
git checkout -b fix/descricao-do-bug

// 2. Implementar correcao
// ... editar arquivos ...

// 3. Testar localmente
npm run dev
// Reproduzir o bug - deve estar corrigido

// 4. Verificar ESLint/TypeScript
npm run lint
npm run build

// 5. Commit com contexto
git commit -m "fix: corrigir [descricao]

- Problema: [o que estava errado]
- Solucao: [o que foi feito]
- Afetado: [arquivos/areas]"
```

### 6. Verificar Correcao

```
Checklist pos-correcao:
[ ] Bug nao reproduz mais
[ ] Nao introduziu novos bugs
[ ] Build passa sem erros
[ ] Lint passa sem erros
[ ] Funcionalidades relacionadas funcionam
```

## Erros Comuns e Solucoes

| Erro | Causa Provavel | Solucao |
|------|----------------|---------|
| 401 Unauthorized | Token invalido/expirado | Verificar auth middleware |
| 403 Forbidden | Role sem permissao | Verificar roleMiddleware |
| 404 Not Found | Recurso nao existe ou outro tenant | Verificar tenantId na query |
| 400 Validation Error | Dados invalidos | Verificar schema Zod |
| 500 Internal Error | Erro no service/database | Ver logs do backend |
| CORS Error | Config de CORS | Verificar cors() no server |
| Query retorna vazio | TenantId errado | Verificar middleware |

## Comandos Uteis

```bash
# Ver logs do backend
docker logs -f crm-backend

# Ver queries do Prisma
DEBUG=prisma:query npm run dev

# Testar endpoint manualmente
curl -X GET http://localhost:3001/api/conversations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"

# Ver migrações pendentes
npx prisma migrate status

# Reset banco dev
npx prisma migrate reset
```

## Checklist Final

- [ ] Bug identificado e documentado
- [ ] Causa raiz encontrada
- [ ] Correcao implementada
- [ ] Testado localmente
- [ ] Build/Lint passam
- [ ] PR criado com descricao

## Exemplo de Uso

```
/hoteis-fix conversas nao aparecem para usuario
```

Investiga e corrige bug de listagem de conversas.
