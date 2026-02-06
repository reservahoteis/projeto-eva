# Continuous Learning Skill

Skill para aprendizado continuo e evolucao de instincts.

## Invocacao

```
/learn                    # Extrai padroes da sessao atual
/instinct-status          # Lista instincts ativos
/instinct-create [nome]   # Cria novo instinct
/evolve                   # Evolui instincts com novos dados
```

## Como Funciona

### 1. Extracao de Padroes
O sistema monitora:
- Arquivos modificados frequentemente
- Erros que se repetem
- Solucoes aplicadas
- Decisoes tomadas

### 2. Validacao
Padroes sao validados contra:
- Multiplas sessoes (minimo 3)
- Resultados positivos (codigo funcionou)
- Consistencia (mesmo padrao aplicado)

### 3. Promocao a Instinct
Quando um padrao atinge:
- 80%+ de confianca
- 5+ ocorrencias
- 0 falhas recentes

Ele e promovido a instinct e carregado automaticamente.

## Estrutura de Instinct

```markdown
# Nome do Padrao

## Metadados
- Confidence: 95%
- Learned from: 47 sessions
- Last validated: 2025-02-04
- Category: [Security|Quality|Workflow|Architecture]

## Regra
Descricao clara e objetiva.

## Exemplos
### Correto
\`\`\`typescript
// ...
\`\`\`

### Incorreto
\`\`\`typescript
// ...
\`\`\`

## Contexto
Quando aplicar e excecoes.
```

## Workflow de Aprendizado

```
┌─────────────────────────────────────────────┐
│         CONTINUOUS LEARNING                  │
├─────────────────────────────────────────────┤
│                                             │
│  SESSION                                    │
│    │                                        │
│    ▼                                        │
│  OBSERVE ──────────────────────────────────│
│    │ Monitora acoes, erros, solucoes       │
│    ▼                                        │
│  EXTRACT ──────────────────────────────────│
│    │ Identifica padroes recorrentes        │
│    ▼                                        │
│  VALIDATE ─────────────────────────────────│
│    │ Compara com sessoes anteriores        │
│    ▼                                        │
│  STORE ────────────────────────────────────│
│    │ Salva em patterns/ (JSON)             │
│    ▼                                        │
│  PROMOTE ──────────────────────────────────│
│    │ Se confianca >= 80%                   │
│    ▼                                        │
│  INSTINCT ─────────────────────────────────│
│      Salva em instincts/ (MD)              │
│      Carrega em proximas sessoes           │
│                                             │
└─────────────────────────────────────────────┘
```

## Comandos Detalhados

### /learn
Analisa a sessao atual e extrai padroes:
```
[LEARN] Analisando sessao...
[LEARN] Padroes detectados:
  - Uso consistente de Zod em validators (5x)
  - Sempre adiciona tenantId em queries (12x)
  - Commits seguem formato (8x)
[LEARN] Padroes salvos em .claude/memory/patterns/
```

### /instinct-status
Lista instincts ativos e suas metricas:
```
[INSTINCTS] Ativos:
  1. multi-tenant-queries (99% confianca)
  2. typescript-strict (95% confianca)
  3. commit-convention (100% confianca)
  4. tdd-first (90% confianca)

[INSTINCTS] Em validacao:
  1. zod-schemas (75% - precisa +2 sessoes)
```

### /instinct-create [nome]
Cria novo instinct manualmente:
```
/instinct-create error-handling

[INSTINCT] Criando: error-handling
[INSTINCT] Template criado em .claude/memory/instincts/error-handling.md
[INSTINCT] Preencha os campos e execute /evolve para validar
```

### /evolve
Reavalia todos os patterns e promove os qualificados:
```
[EVOLVE] Analisando patterns...
[EVOLVE] zod-schemas: 75% -> 85% (PROMOVIDO)
[EVOLVE] api-versioning: 60% -> 65% (em validacao)
[EVOLVE] 1 novo instinct criado
```

## Integracao com SessionEnd

O hook de SessionEnd automaticamente:
1. Salva resumo da sessao
2. Extrai padroes
3. Atualiza metricas de confianca
4. Limpa sessoes antigas

## Exportar/Importar Instincts

```bash
# Exportar para compartilhar
/instinct-export > meus-instincts.json

# Importar de outro projeto
/instinct-import meus-instincts.json
```
