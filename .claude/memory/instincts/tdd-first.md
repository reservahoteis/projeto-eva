# TDD First - Test Driven Development

## Metadados
- Confidence: 90%
- Learned from: Best practices (Superpowers framework)
- Last validated: 2025-02-04
- Category: Development Workflow

## Regra
**NUNCA escrever codigo de producao ANTES do teste falhar.**

TDD garante que todo codigo tem cobertura de testes e que a implementacao atende aos requisitos.

## Ciclo RED-GREEN-REFACTOR

### 1. RED (Teste Falha)
```typescript
// Primeiro: escreva o teste
describe('ConversationService', () => {
  it('deve retornar apenas conversas do tenant', async () => {
    const result = await conversationService.findByTenant('tenant-1');

    expect(result).toHaveLength(2);
    expect(result.every(c => c.tenantId === 'tenant-1')).toBe(true);
  });
});

// Execute: npm test
// Resultado: FAIL (metodo nao existe ainda)
```

### 2. GREEN (Codigo Minimo)
```typescript
// Segundo: escreva o MINIMO para passar
class ConversationService {
  async findByTenant(tenantId: string) {
    return prisma.conversation.findMany({
      where: { tenantId }
    });
  }
}

// Execute: npm test
// Resultado: PASS
```

### 3. REFACTOR (Melhore)
```typescript
// Terceiro: melhore sem quebrar o teste
class ConversationService {
  async findByTenant(tenantId: string, options?: FindOptions) {
    return prisma.conversation.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: options?.includeMessages ? { messages: true } : undefined,
    });
  }
}

// Execute: npm test
// Resultado: PASS (teste original ainda passa)
```

## Quando Aplicar TDD

| Situacao | TDD? |
|----------|------|
| Novo service | SIM |
| Nova funcao de negocio | SIM |
| Bug fix | SIM (escreva teste que reproduz o bug primeiro) |
| Refatoracao | Testes ja existem, apenas refatore |
| Prototipo rapido | NAO (mas adicione testes depois) |
| UI/Componentes | Opcional (use Storybook) |

## Estrutura de Testes

```
deploy-backend/
├── src/
│   └── services/
│       └── conversation.service.ts
└── tests/
    └── services/
        └── conversation.service.test.ts

apps/frontend/
├── src/
│   └── components/
│       └── ChatList.tsx
└── __tests__/
    └── components/
        └── ChatList.test.tsx
```

## Exemplo Completo: Bug Fix com TDD

### 1. Bug Reportado
"Conversas de outros tenants aparecem no dashboard"

### 2. Escreva Teste que Reproduz
```typescript
it('nao deve retornar conversas de outros tenants', async () => {
  // Arrange: crie dados de 2 tenants
  await createConversation({ tenantId: 'tenant-1' });
  await createConversation({ tenantId: 'tenant-2' });

  // Act: busque conversas do tenant-1
  const result = await conversationService.findByTenant('tenant-1');

  // Assert: deve ter apenas do tenant-1
  expect(result).toHaveLength(1);
  expect(result[0].tenantId).toBe('tenant-1');
});
```

### 3. Execute e Veja Falhar
```
FAIL: Expected 1, received 2
```

### 4. Corrija o Bug
```typescript
// Adicione filtro de tenantId que estava faltando
async findByTenant(tenantId: string) {
  return prisma.conversation.findMany({
    where: { tenantId } // <-- correção
  });
}
```

### 5. Execute e Veja Passar
```
PASS: All tests passed
```

## Ferramentas

| Ferramenta | Uso |
|------------|-----|
| Jest | Testes unitarios e integracao |
| Supertest | Testes de API |
| Testing Library | Testes de componentes React |
| Playwright | Testes E2E |

## Comandos

```bash
# Backend
cd deploy-backend
pnpm test              # Todos os testes
pnpm test:watch        # Watch mode
pnpm test:coverage     # Com cobertura

# Frontend
cd apps/frontend
pnpm test              # Jest
pnpm test:e2e          # Playwright
```

## Metricas de Cobertura

| Metrica | Minimo | Ideal |
|---------|--------|-------|
| Statements | 70% | 85%+ |
| Branches | 60% | 80%+ |
| Functions | 70% | 85%+ |
| Lines | 70% | 85%+ |
