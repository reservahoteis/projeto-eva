# Implementação do papel HEAD

## Resumo

Foi implementado um novo papel de usuário chamado **HEAD** no sistema CRM multi-tenant. O HEAD é um supervisor que fica entre ATTENDANT e TENANT_ADMIN na hierarquia de permissões.

## Hierarquia de Roles

```
SUPER_ADMIN      - Acesso total ao sistema (empresa)
  |
TENANT_ADMIN     - Admin do hotel (gerencia usuários, vê tudo, acessa relatórios)
  |
HEAD             - Supervisor (vê todas conversas, atribui, responde - NÃO gerencia usuários)
  |
ATTENDANT        - Atendente (vê apenas conversas da sua unidade hoteleira)
```

## Permissões do HEAD

### PODE:
- Ver todas as conversas de todas as unidades hoteleiras do tenant
- Enviar mensagens e responder conversas
- Atribuir conversas a outros atendentes (assign)
- Atualizar status, prioridade e tags de conversas
- Fechar e arquivar conversas
- Ver estatísticas gerais do tenant

### NÃO PODE:
- Adicionar, editar ou excluir usuários (rotas `/api/users`)
- Acessar página de contatos (rotas `/api/contacts`)
- Acessar relatórios (rotas `/api/reports`)
- Acessar configurações do tenant

## Arquivos Modificados

### 1. Prisma Schema
**Arquivo:** `deploy-backend/prisma/schema.prisma`

```prisma
enum Role {
  SUPER_ADMIN  // Acesso total ao sistema
  TENANT_ADMIN // Admin do hotel
  HEAD         // Supervisor (novo)
  ATTENDANT    // Atendente
}
```

**Migration:** Executada com `npx prisma migrate dev --name add-head-role`

### 2. Rotas de Contatos
**Arquivo:** `deploy-backend/src/routes/contact.routes.ts`

**Mudança:** Adicionado `authorize(['TENANT_ADMIN', 'SUPER_ADMIN'])` para bloquear HEAD e ATTENDANT de acessarem contatos.

```typescript
router.use(authenticate);
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));
```

### 3. Rotas de Relatórios
**Arquivo:** `deploy-backend/src/routes/report.routes.ts`

**Mudança:** Adicionado `authorize(['TENANT_ADMIN', 'SUPER_ADMIN'])` para bloquear HEAD e ATTENDANT de acessarem relatórios.

```typescript
router.use(authenticate);
router.use(authorize(['TENANT_ADMIN', 'SUPER_ADMIN']));
```

### 4. Rotas de Usuários
**Arquivo:** `deploy-backend/src/routes/user.routes.ts`

**Status:** Já estava correto com `authorize(['TENANT_ADMIN', 'SUPER_ADMIN'])`. HEAD bloqueado por padrão.

### 5. Validador de Usuários
**Arquivo:** `deploy-backend/src/validators/user.validator.ts`

**Mudança:** Atualizado comentário para clarificar que HEAD não precisa de `hotelUnit` (pode ser null).

```typescript
// Apenas ATTENDANT deve ter unidade hoteleira obrigatória
// HEAD e TENANT_ADMIN veem todas as unidades, então hotelUnit deve ser null
```

### 6. Rotas de Conversas
**Arquivo:** `deploy-backend/src/routes/conversation.routes.ts`

**Status:** Nenhuma mudança necessária. Já usa apenas `authenticate` e `requireTenant`, sem restrição de role.

## Lógica de Acesso às Conversas

### ATTENDANT
- Vê apenas conversas:
  - Atribuídas diretamente a ele OU
  - Da mesma unidade hoteleira (`hotelUnit`)

### HEAD e TENANT_ADMIN
- Veem TODAS as conversas do tenant
- Não há filtro por `hotelUnit`
- Podem atribuir conversas a qualquer atendente

### Código no ConversationService

```typescript
// Filtro aplicado apenas para ATTENDANT
if (params.userRole === 'ATTENDANT' && params.userId) {
  // Buscar unidade do atendente
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { hotelUnit: true },
  });

  // Filtrar: atribuídas a mim OU da minha unidade
  where.OR = [
    { assignedToId: params.userId },
    { hotelUnit: user.hotelUnit },
  ];
}
// HEAD e TENANT_ADMIN não entram neste bloco
```

## Banco de Dados

### User Model
- `role`: Enum incluindo agora HEAD
- `hotelUnit`:
  - **ATTENDANT**: Obrigatório (ex: "Ilhabela", "Campos do Jordão")
  - **HEAD**: NULL (vê todas as unidades)
  - **TENANT_ADMIN**: NULL (vê todas as unidades)

## Casos de Uso

### Criar usuário HEAD
```json
POST /api/users
{
  "email": "supervisor@hotel.com",
  "password": "senha123456",
  "name": "João Supervisor",
  "role": "HEAD",
  "hotelUnit": null
}
```

### HEAD visualizando conversas
```
GET /api/conversations
Authorization: Bearer <token_do_head>

Retorna: TODAS as conversas do tenant (sem filtro de unidade)
```

### HEAD atribuindo conversa
```json
POST /api/conversations/{id}/assign
{
  "userId": "uuid-do-atendente"
}

Sucesso: Conversa atribuída ao atendente
```

### HEAD tentando acessar contatos
```
GET /api/contacts
Authorization: Bearer <token_do_head>

Retorna: 403 Forbidden
```

## Testes Recomendados

1. **Criar usuário HEAD** sem `hotelUnit` - deve funcionar
2. **HEAD listar conversas** - deve ver todas as conversas do tenant
3. **HEAD atribuir conversa** - deve conseguir atribuir a qualquer atendente
4. **HEAD acessar /api/contacts** - deve retornar 403
5. **HEAD acessar /api/reports** - deve retornar 403
6. **HEAD acessar /api/users** - deve retornar 403
7. **HEAD enviar mensagem** - deve funcionar normalmente
8. **HEAD ver estatísticas** - deve ver stats de todas as conversas

## Segurança

- **Multi-tenancy:** Todas as queries incluem `tenantId` para isolamento
- **Autorização:** Middleware `authorize()` bloqueia acesso a rotas restritas
- **Validação:** Zod valida que ATTENDANT sempre tem `hotelUnit`, mas HEAD não precisa

## Próximos Passos (Opcional)

1. Atualizar frontend para exibir interface correta para HEAD
2. Adicionar testes automatizados para o papel HEAD
3. Documentar no Swagger/OpenAPI as permissões de cada role
4. Criar seed de usuário HEAD para ambiente de desenvolvimento
