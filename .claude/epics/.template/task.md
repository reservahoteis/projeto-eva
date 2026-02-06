# Task: [NOME DA TASK]

## Metadados
- **Epic:** EPIC-XXX
- **ID:** T-XXX
- **Status:** pending | in_progress | review | done | blocked
- **Agente:** nome-do-agente
- **Paralelo:** sim | nao
- **Branch:** feature/epic-xxx-task-xxx

## Objetivo
O que esta task entrega especificamente.

## Contexto
Informacoes necessarias para executar esta task.

## Especificacao

### Arquivos a Criar/Modificar
```
deploy-backend/src/
├── controllers/
│   └── nome.controller.ts    # CRIAR
├── services/
│   └── nome.service.ts       # CRIAR
├── routes/
│   └── nome.routes.ts        # MODIFICAR
└── validators/
    └── nome.validator.ts     # CRIAR
```

### Interfaces/Tipos
```typescript
interface NomeInput {
  campo: string;
  tenantId: string; // OBRIGATORIO
}

interface NomeOutput {
  id: string;
  campo: string;
  createdAt: Date;
}
```

### Endpoints (se aplicavel)
```
POST   /api/v1/nome         # Criar
GET    /api/v1/nome         # Listar
GET    /api/v1/nome/:id     # Buscar por ID
PUT    /api/v1/nome/:id     # Atualizar
DELETE /api/v1/nome/:id     # Remover
```

### Regras de Negocio
1. DEVE validar tenantId em todas as operacoes
2. DEVE usar Zod para validacao de input
3. DEVE retornar erro 404 se recurso nao encontrado
4. DEVE logar operacoes importantes com Pino

## Checklist TDD

### Testes a Escrever PRIMEIRO
- [ ] `nome.service.test.ts` - Testes unitarios do service
- [ ] `nome.controller.test.ts` - Testes de integracao da API
- [ ] Teste de multi-tenant (isolamento)
- [ ] Testes de erro (404, 400, 401)

### Implementacao
- [ ] Service com logica de negocio
- [ ] Controller com handlers HTTP
- [ ] Validator com schemas Zod
- [ ] Routes registradas

### Validacao
- [ ] `tsc --noEmit` passa
- [ ] Todos os testes passam
- [ ] Cobertura >= 80%

## Dependencias

### Depende de
- Nenhuma (pode iniciar imediatamente)
- OU: Task T-XXX deve estar concluida

### Bloqueia
- Task T-YYY (integracao)

## Criterios de Aceite

- [ ] Endpoints funcionando conforme especificacao
- [ ] Testes com cobertura >= 80%
- [ ] Sem erros de TypeScript
- [ ] tenantId validado em todas queries
- [ ] Documentacao inline adequada

## Notas para o Agente

### Contexto do Projeto
- Multi-tenant: SEMPRE filtrar por tenantId
- Auth: req.tenantId e req.user disponibilizados pelo middleware
- Validacao: usar Zod, schemas em `/validators`
- Logs: usar logger do Pino (req.logger)

### Padroes a Seguir
```typescript
// Controller padrao
export const nomeController = {
  async create(req: Request, res: Response) {
    const validated = nomeSchema.parse(req.body);
    const result = await nomeService.create({
      ...validated,
      tenantId: req.tenantId, // OBRIGATORIO
    });
    return res.status(201).json(result);
  }
};
```

---

## Historico

| Data | Evento | Autor |
|------|--------|-------|
| YYYY-MM-DD | Task criada | Commander |
