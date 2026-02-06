# Multi-Tenant Query Pattern

## Metadados

- Confidence: 99%
- Learned from: Core architecture + CRIT-001 fix (2026-02-04)
- Last validated: 2026-02-04
- Category: Security

## Regra

**TODA query Prisma que acessa dados de tenant DEVE incluir filtro `tenantId` NA PROPRIA QUERY.**

Vazamento de dados entre tenants e uma falha de seguranca critica.

### CRIT-001: tenantId NA query, nao APOS

O tenantId DEVE estar na WHERE clause da query Prisma, NAO apenas verificado depois de buscar.

```typescript
// ERRADO - vulneravel a timing attacks
const user = await prisma.user.findFirst({ where: { email } });
if (user.tenantId !== tenantId) throw new Error('Unauthorized');

// CORRETO - isolamento na query
const user = await prisma.user.findFirst({
  where: { email, tenantId }  // tenantId NA query
});
```

**Por que isso importa:**

1. Timing attacks: resposta mais rapida quando email nao existe no tenant
2. Isolamento real: banco retorna apenas dados do tenant
3. Defense in depth: multiplas camadas de protecao

## Entidades que DEVEM ter tenantId

| Entidade | tenantId Obrigatorio |
|----------|---------------------|
| Conversation | SIM |
| Contact | SIM |
| Message | SIM |
| User | SIM |
| Tag | SIM |
| Escalation | SIM |
| QuickReply | SIM |
| Template | SIM |
| Channel | SIM |
| Attachment | SIM |

## Exemplos

### Correto
```typescript
// SEMPRE incluir tenantId no where
const conversations = await prisma.conversation.findMany({
  where: {
    tenantId: req.tenantId, // OBRIGATORIO
    status: 'OPEN',
  },
});

// Em updates tambem
await prisma.contact.update({
  where: {
    id: contactId,
    tenantId: req.tenantId, // OBRIGATORIO
  },
  data: { name: newName },
});

// Em deletes
await prisma.tag.delete({
  where: {
    id: tagId,
    tenantId: req.tenantId, // OBRIGATORIO
  },
});
```

### Incorreto
```typescript
// NUNCA fazer isso - vazamento de dados!
const conversations = await prisma.conversation.findMany({
  where: { status: 'OPEN' }, // FALTA tenantId!
});

// NUNCA confiar apenas no ID
const contact = await prisma.contact.findUnique({
  where: { id: contactId }, // FALTA tenantId!
});
```

## Excecoes

Apenas queries de SUPER_ADMIN podem omitir tenantId:

```typescript
// Somente em rotas de admin
if (req.user.role === 'SUPER_ADMIN') {
  // Pode acessar todos os tenants
  const allConversations = await prisma.conversation.findMany();
}
```

## Validacao Automatica

O hook `verify-tenant-id.js` verifica automaticamente apos cada edicao em:
- `**/controllers/**/*.ts`
- `**/services/**/*.ts`

## Consequencias de Violacao

- Vazamento de dados entre hoteis
- Violacao de LGPD
- Perda de confianca de clientes
- Possivel acao legal
