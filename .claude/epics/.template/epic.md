# Epic: [NOME DO EPIC]

## Metadados
- **ID:** EPIC-XXX
- **Status:** draft | planning | in_progress | review | done
- **Prioridade:** critical | high | medium | low
- **Criado:** YYYY-MM-DD
- **Estimativa:** X tasks paralelas

## Objetivo
Descricao clara do que sera entregue ao final deste epic.

## Contexto
Por que este epic e necessario? Qual problema resolve?

## Requisitos

### Funcionais
- [ ] RF01: Descricao do requisito funcional
- [ ] RF02: ...

### Nao-Funcionais
- [ ] RNF01: Performance - resposta em < 200ms
- [ ] RNF02: Seguranca - validar tenantId em todas queries

## Tasks

| ID | Task | Responsavel | Paralelo | Status |
|----|------|-------------|----------|--------|
| T1 | [Backend API](./task-1.md) | elite-principal-engineer | sim | pending |
| T2 | [Frontend UI](./task-2.md) | frontend-developer | sim | pending |
| T3 | [Testes](./task-3.md) | test-engineer | sim | pending |
| T4 | [Integracao](./task-4.md) | fullstack-developer | nao | pending |

## Dependencias

```
T1 ─┐
    ├──► T4 (depende de T1, T2, T3)
T2 ─┤
    │
T3 ─┘
```

## Criterios de Aceite

- [ ] Todos os testes passam
- [ ] Code review aprovado
- [ ] Documentacao atualizada
- [ ] Deploy em staging testado
- [ ] Multi-tenant validado

## Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| API externa instavel | Media | Alto | Implementar retry com backoff |

## Notas
Observacoes adicionais relevantes.

---

## Historico

| Data | Evento | Autor |
|------|--------|-------|
| YYYY-MM-DD | Epic criado | Commander |
