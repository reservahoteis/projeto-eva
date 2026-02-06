# TDD Workflow Skill

Skill para desenvolvimento orientado a testes no CRM Hoteis Reserva.

## Invocacao

```
/tdd [descricao da funcionalidade]
```

## Workflow

### Fase 1: Especificacao
1. Entenda o requisito
2. Identifique casos de teste
3. Defina inputs e outputs esperados

### Fase 2: RED - Escreva Testes
```typescript
// Escreva TODOS os testes antes de qualquer codigo
describe('NovaFuncionalidade', () => {
  it('deve fazer X quando Y', () => {
    // Arrange
    // Act
    // Assert
  });

  it('deve retornar erro quando Z', () => {
    // Arrange
    // Act
    // Assert
  });

  it('deve validar tenantId', () => {
    // SEMPRE incluir teste de multi-tenant
  });
});
```

### Fase 3: GREEN - Implemente
```typescript
// Escreva o MINIMO codigo para passar os testes
// NAO adicione funcionalidades extras
// NAO otimize prematuramente
```

### Fase 4: REFACTOR
```typescript
// Melhore o codigo mantendo os testes passando
// Extraia funcoes
// Remova duplicacao
// Melhore nomes
```

### Fase 5: Commit
```
test(escopo): adicionar testes para X
feat(escopo): implementar X
refactor(escopo): melhorar implementacao de X
```

## Regras Obrigatorias

### 1. Teste Antes de Codigo
```
❌ PROIBIDO: Escrever service antes do teste
✅ CORRETO: Escrever teste, ver falhar, implementar
```

### 2. Um Teste por Comportamento
```
❌ PROIBIDO: Testar multiplas coisas em um it()
✅ CORRETO: Um it() para cada comportamento
```

### 3. Testes Isolados
```
❌ PROIBIDO: Testes que dependem de ordem
✅ CORRETO: Cada teste limpa seu estado (beforeEach/afterEach)
```

### 4. Nomes Descritivos
```
❌ PROIBIDO: it('test1', ...)
✅ CORRETO: it('deve retornar erro quando email invalido', ...)
```

## Templates

### Service Test
```typescript
import { PrismaClient } from '@prisma/client';
import { NomeService } from './nome.service';

describe('NomeService', () => {
  let prisma: PrismaClient;
  let service: NomeService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    service = new NomeService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpa dados de teste
    await prisma.tabela.deleteMany({
      where: { tenantId: 'test-tenant' }
    });
  });

  describe('metodo', () => {
    it('deve fazer algo', async () => {
      // Arrange
      const input = { ... };

      // Act
      const result = await service.metodo(input);

      // Assert
      expect(result).toEqual({ ... });
    });

    it('deve validar tenantId', async () => {
      // Arrange
      const input = { tenantId: 'outro-tenant' };

      // Act & Assert
      await expect(service.metodo(input))
        .rejects.toThrow('Tenant nao autorizado');
    });
  });
});
```

### Controller Test
```typescript
import request from 'supertest';
import { app } from '../app';

describe('POST /api/recurso', () => {
  it('deve criar recurso', async () => {
    const response = await request(app)
      .post('/api/recurso')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Teste' });

    expect(response.status).toBe(201);
    expect(response.body.nome).toBe('Teste');
  });

  it('deve retornar 401 sem token', async () => {
    const response = await request(app)
      .post('/api/recurso')
      .send({ nome: 'Teste' });

    expect(response.status).toBe(401);
  });

  it('deve retornar 400 com dados invalidos', async () => {
    const response = await request(app)
      .post('/api/recurso')
      .set('Authorization', `Bearer ${token}`)
      .send({ }); // faltando nome

    expect(response.status).toBe(400);
  });
});
```

## Checklist Pre-Commit

- [ ] Todos os testes passam (`pnpm test`)
- [ ] Cobertura minima atingida
- [ ] Testes de multi-tenant incluidos
- [ ] Testes de erro/edge cases incluidos
- [ ] Nomes de testes descritivos
