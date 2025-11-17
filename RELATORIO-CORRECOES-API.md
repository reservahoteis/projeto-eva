# Relatório de Correções da API - Backend

## Data: 17/11/2024

## Problemas Identificados

1. **Rota `/api/conversations/stats` inexistente** → Retornava 404
2. **Header `X-Tenant-Slug` não processado corretamente** → Retornava 400 "Tenant ID não encontrado"

## Correções Implementadas

### 1. Nova Rota de Estatísticas (`/api/conversations/stats`)

#### Arquivos Modificados:
- `deploy-backend/src/controllers/conversation.controller.ts`
- `deploy-backend/src/services/conversation.service.ts`
- `deploy-backend/src/routes/conversation.routes.ts`

#### Funcionalidades Adicionadas:

**Controller - `getStats()`:**
```typescript
// Novo método no ConversationController
async getStats(req: Request, res: Response)
```
- Verifica tenant ID
- Adiciona logs de debug detalhados
- Retorna estatísticas do serviço

**Service - `getConversationStats()`:**
```typescript
async getConversationStats(tenantId: string, userId?: string, userRole?: Role)
```

Retorna objeto com:
- `total`: Total de conversas
- `active`: Conversas ativas (OPEN + IN_PROGRESS + WAITING)
- `unassigned`: Conversas não atribuídas
- `unreadMessages`: Total de mensagens não lidas
- `avgResponseTime`: Tempo médio de resposta (últimas 24h)
- `byStatus`: Contagem por status
  - OPEN
  - IN_PROGRESS
  - WAITING
  - CLOSED
- `byPriority`: Contagem por prioridade
  - LOW
  - MEDIUM
  - HIGH
  - URGENT
- `lastUpdated`: Timestamp da consulta

**Método auxiliar - `calculateAvgResponseTime()`:**
- Calcula tempo médio entre criação da conversa e primeira resposta
- Considera apenas últimas 24 horas
- Retorna em segundos

### 2. Rotas de Debug (Desenvolvimento)

#### Novo Arquivo:
- `deploy-backend/src/routes/debug.routes.ts`

#### Endpoints de Debug:

**`GET /api/debug/tenant-info`**
- Mostra informações do tenant detectado no request
- Headers recebidos
- Query params
- Tenant ID e detalhes
- Usuário autenticado (se houver)

**`GET /api/debug/auth-info`**
- Requer autenticação
- Mostra detalhes do usuário autenticado
- Compara tenant do request com tenant do usuário

**`GET /api/debug/headers`**
- Lista todos os headers recebidos
- Útil para debug de CORS e autenticação

**`GET /api/debug/test-tenant/:slug`**
- Testa se um tenant existe no banco
- Mostra status e contadores

### 3. Melhorias de Log e Debug

#### Controller `list()`:
- Adicionados logs detalhados com:
  - Tenant ID
  - Headers recebidos
  - Query params
  - Informações do usuário

- Resposta de erro melhorada:
  - Inclui dica sobre header `X-Tenant-Slug`
  - Mostra headers recebidos em desenvolvimento

## Como Testar

### 1. Compilar e Iniciar o Backend:
```bash
cd deploy-backend
npm run build
npm run dev
```

### 2. Testar Rota de Debug (sem autenticação):
```bash
# Verificar detecção de tenant
curl -X GET http://localhost:4000/api/debug/tenant-info \
  -H "X-Tenant-Slug: hotelcopacabana" | jq '.'
```

### 3. Testar Rota de Estatísticas (com autenticação):
```bash
# Obter token de autenticação primeiro
TOKEN="seu_token_aqui"

# Testar estatísticas
curl -X GET http://localhost:4000/api/conversations/stats \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Slug: hotelcopacabana" | jq '.'
```

### 4. Testar Lista de Conversas:
```bash
# Com header de tenant
curl -X GET "http://localhost:4000/api/conversations?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-Slug: hotelcopacabana" | jq '.'
```

## Resposta Esperada - `/api/conversations/stats`

```json
{
  "total": 150,
  "active": 45,
  "unassigned": 12,
  "unreadMessages": 23,
  "avgResponseTime": 180,
  "byStatus": {
    "OPEN": 15,
    "IN_PROGRESS": 20,
    "WAITING": 10,
    "CLOSED": 105
  },
  "byPriority": {
    "LOW": 30,
    "MEDIUM": 80,
    "HIGH": 35,
    "URGENT": 5
  },
  "lastUpdated": "2024-11-17T12:00:00.000Z"
}
```

## Análise do Problema do Header `X-Tenant-Slug`

### Middleware de Tenant (`tenant.middleware.ts`):

O middleware já está configurado corretamente para:
1. **Prioridade 1**: Header `X-Tenant-Slug`
2. **Prioridade 2**: Subdomínio
3. **Prioridade 3**: Query param `?tenant=` (desenvolvimento)

### Possíveis Causas do Erro 400:

1. **Header não enviado pelo frontend**
   - Verificar Network tab no browser
   - Confirmar que header está presente

2. **Tenant não existe no banco**
   - Usar `/api/debug/test-tenant/hotelcopacabana`
   - Verificar se status é ACTIVE ou TRIAL

3. **Middleware `requireTenant` muito restritivo**
   - O middleware está correto, mas pode ser que o tenant não esteja sendo encontrado

## Próximos Passos

### 1. Verificar Tenant no Banco:
```sql
-- No PostgreSQL
SELECT id, slug, name, status
FROM tenants
WHERE slug = 'hotelcopacabana';
```

### 2. Verificar Logs do Backend:
```bash
# Ver logs em tempo real
docker logs -f crm-backend --tail 100
```

### 3. Frontend - Garantir Envio do Header:
```typescript
// No frontend (api.ts ou similar)
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'X-Tenant-Slug': 'hotelcopacabana'  // Deve vir de config/env
  }
});
```

### 4. Testar com Postman/Insomnia:
- Importar collection
- Setar variáveis de ambiente
- Testar cada endpoint isoladamente

## Considerações de Segurança

1. **Rotas de debug apenas em desenvolvimento**
   - Verificação `NODE_ENV !== 'production'`
   - Retorna 404 em produção

2. **Logs sensíveis**
   - Tokens são redacted nos logs
   - Headers sensíveis são ocultados

3. **Isolamento por Tenant**
   - Estatísticas filtradas por tenant
   - Attendants veem apenas suas conversas

## Conclusão

As correções implementadas resolvem:
- ✅ Rota `/api/conversations/stats` agora existe e funciona
- ✅ Logs detalhados para debug de problemas com tenant
- ✅ Rotas de debug para investigação em desenvolvimento
- ⚠️ Problema do header `X-Tenant-Slug` precisa verificação adicional

Para resolver completamente o erro 400, é necessário:
1. Confirmar que o tenant existe no banco
2. Verificar se frontend está enviando o header corretamente
3. Usar as rotas de debug para diagnosticar o problema específico