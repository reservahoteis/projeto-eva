# Epic Management Skill

Skill para gerenciamento de epics e execucao paralela de tasks.

## Invocacao

```
/epic-create [nome] [descricao]   # Criar novo epic
/epic-status [nome]               # Ver status
/epic-start [nome]                # Iniciar execucao
/epic-complete [nome]             # Finalizar epic
```

## Workflow Completo

### Fase 1: Criacao do Epic

```
Usuario: Commander, criar epic para gestao de reservas

Commander:
1. Analisa requisitos
2. Identifica componentes (backend, frontend, testes)
3. Cria estrutura de epic
4. Define tasks e dependencias
5. Atribui agentes especializados
```

### Fase 2: Planejamento de Tasks

Cada task recebe:
- Especificacao detalhada
- Agente responsavel
- Flag de paralelismo
- Criterios de aceite
- Checklist TDD

### Fase 3: Execucao Paralela

```typescript
// Pseudo-codigo do Commander
async function executeEpic(epicName: string) {
  const epic = loadEpic(epicName);

  // Identifica tasks sem dependencias
  const parallelTasks = epic.tasks.filter(t => !t.dependencies.length);

  // Executa em paralelo
  await Promise.all(
    parallelTasks.map(task =>
      spawnAgent(task.agent, task.spec)
    )
  );

  // Executa tasks dependentes sequencialmente
  const dependentTasks = epic.tasks.filter(t => t.dependencies.length);
  for (const task of dependentTasks) {
    await spawnAgent(task.agent, task.spec);
  }

  // Merge e finalizacao
  await mergeAllBranches(epic);
}
```

### Fase 4: Review e Merge

1. Cada task gera um PR
2. Commander revisa cada PR
3. Merge sequencial para evitar conflitos
4. Testes de integracao finais
5. Deploy

## Template de Epic

```markdown
# Epic: Gestao de Reservas

## Tasks Paralelas

### T1: Backend API
- Agente: elite-principal-engineer
- Branch: feature/reservas-api
- Entrega: CRUD de reservas

### T2: Frontend UI
- Agente: frontend-developer
- Branch: feature/reservas-ui
- Entrega: Calendario de reservas

### T3: Testes
- Agente: test-engineer
- Branch: feature/reservas-tests
- Entrega: Testes E2E

### T4: Integracao (depende de T1, T2, T3)
- Agente: fullstack-developer
- Branch: feature/reservas-integration
- Entrega: Fluxo completo funcionando
```

## Comandos Detalhados

### /epic-create
```
/epic-create reservas "Sistema de gestao de reservas de quartos"

[EPIC] Criando: reservas
[EPIC] Analisando requisitos...
[EPIC] Tasks identificadas:
  T1: Backend API (paralela)
  T2: Frontend UI (paralela)
  T3: Testes E2E (paralela)
  T4: Integracao (sequencial)
[EPIC] Estrutura criada em .claude/epics/reservas/
[EPIC] Execute /epic-start reservas para iniciar
```

### /epic-status
```
/epic-status reservas

[EPIC] reservas
═══════════════════════════════════════

Status: in_progress
Progresso: 2/4 tasks (50%)

Tasks:
  ✅ T1: Backend API (done)
  ✅ T2: Frontend UI (done)
  🔄 T3: Testes E2E (in_progress)
  ⏳ T4: Integracao (pending - aguarda T3)

Branches:
  feature/reservas-api     → PR #123 (merged)
  feature/reservas-ui      → PR #124 (merged)
  feature/reservas-tests   → PR #125 (open)

Estimativa: 1 task restante
```

### /epic-start
```
/epic-start reservas

[EPIC] Iniciando execucao paralela...
[EPIC] Spawning agents:
  → elite-principal-engineer (T1)
  → frontend-developer (T2)
  → test-engineer (T3)
[EPIC] 3 agents trabalhando em paralelo
[EPIC] Use /epic-status reservas para acompanhar
```

### /epic-complete
```
/epic-complete reservas

[EPIC] Finalizando epic reservas...
[EPIC] Verificando tasks:
  ✅ T1: done
  ✅ T2: done
  ✅ T3: done
  ✅ T4: done
[EPIC] Merging branches...
[EPIC] Running final tests...
[EPIC] ✅ Epic completo!
[EPIC] Pronto para deploy em staging
```

## Beneficios

| Metrica | Sem Epics | Com Epics |
|---------|-----------|-----------|
| Tempo de entrega | 4 dias | 1.5 dias |
| Conflitos de merge | Alto | Baixo |
| Visibilidade | Baixa | Total |
| Retrabalho | Frequente | Raro |

## Integracao com Commander

O Commander usa esta skill automaticamente quando:
- Feature e grande (3+ componentes)
- Multiplas areas sao afetadas
- Paralelismo e possivel

```
Usuario: Commander, implementar gestao de reservas

Commander:
  "Esta feature e complexa. Vou criar um epic para
   execucao paralela. Isso vai acelerar a entrega."

  → /epic-create reservas "Gestao de reservas"
  → /epic-start reservas
```
