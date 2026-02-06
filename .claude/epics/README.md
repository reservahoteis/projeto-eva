# Sistema de Epics - Execucao Paralela

Sistema de gerenciamento de epics para execucao paralela de tasks por multiplos agentes.

## Conceito

Inspirado no CCPM (Claude Code Project Management), este sistema permite:

1. **Quebrar features grandes** em tasks menores e independentes
2. **Executar tasks em paralelo** quando nao ha dependencias
3. **Coordenar agentes especializados** para cada tipo de task
4. **Manter rastreabilidade** completa do que foi feito

## Estrutura

```
epics/
├── .template/
│   ├── epic.md          # Template de epic
│   └── task.md          # Template de task
├── README.md            # Esta documentacao
└── [nome-do-epic]/      # Epics ativos
    ├── epic.md          # Especificacao do epic
    ├── task-1.md        # Task 1 (paralela)
    ├── task-2.md        # Task 2 (paralela)
    ├── task-3.md        # Task 3 (paralela)
    └── task-4.md        # Task 4 (depende de 1,2,3)
```

## Workflow

### 1. Criar Epic
```bash
Commander, criar epic para [descricao da feature]
```

O Commander:
1. Analisa a feature
2. Quebra em tasks
3. Identifica dependencias
4. Cria arquivos de epic e tasks
5. Atribui agentes especializados

### 2. Executar Tasks Paralelas
```
┌─────────────────────────────────────────────┐
│              EXECUCAO PARALELA               │
├─────────────────────────────────────────────┤
│                                             │
│  Task 1 (Backend API)                       │
│  └─ elite-principal-engineer                │
│     ├─ Cria branch: feature/epic-xxx-t1     │
│     ├─ Implementa                           │
│     └─ PR pronto                            │
│                          ║                  │
│  Task 2 (Frontend UI)    ║ PARALELO         │
│  └─ frontend-developer   ║                  │
│     ├─ Cria branch: feature/epic-xxx-t2     │
│     ├─ Implementa                           │
│     └─ PR pronto                            │
│                          ║                  │
│  Task 3 (Testes)         ║                  │
│  └─ test-engineer                           │
│     ├─ Cria branch: feature/epic-xxx-t3     │
│     ├─ Implementa                           │
│     └─ PR pronto                            │
│                                             │
│  ════════════════════════════════════════   │
│                                             │
│  Task 4 (Integracao) - AGUARDA 1,2,3        │
│  └─ fullstack-developer                     │
│     ├─ Merge de T1, T2, T3                  │
│     ├─ Testes de integracao                 │
│     └─ PR final                             │
│                                             │
└─────────────────────────────────────────────┘
```

### 3. Merge e Deploy
Apos todas as tasks:
1. Review do epic completo
2. Merge para develop
3. Deploy em staging
4. Validacao
5. Merge para main
6. Deploy em producao

## Comandos

```
/epic-create [nome]       # Cria novo epic
/epic-status [nome]       # Status do epic
/epic-start [nome]        # Inicia execucao paralela
/task-status [epic] [id]  # Status de task especifica
/epic-complete [nome]     # Finaliza epic
```

## Exemplo Pratico

### Feature: Gestao de Reservas

```
Commander, criar epic para gestao de reservas de quartos
```

**Epic criado:**
```
epics/gestao-reservas/
├── epic.md
├── task-1-backend-api.md      # API de reservas
├── task-2-frontend-ui.md      # UI de calendario
├── task-3-testes.md           # Testes E2E
└── task-4-integracao.md       # Integracao com OTAs
```

**Execucao:**
1. T1, T2, T3 iniciam em paralelo (3 agentes)
2. T4 aguarda conclusao de T1, T2, T3
3. Merge final e deploy

**Resultado:** Feature entregue em 1/3 do tempo!

## Beneficios

| Aspecto | Sem Epics | Com Epics |
|---------|-----------|-----------|
| Tempo | Serial | Paralelo |
| Contexto | Poluido | Isolado |
| Rastreabilidade | Baixa | Total |
| Qualidade | Variavel | Consistente |

## Integracao com GitHub Issues

(Opcional) Sincronizar epics com GitHub Issues:

```bash
/epic-sync [nome]  # Cria issues no GitHub
```

Cada task vira uma issue com labels e assignees.
