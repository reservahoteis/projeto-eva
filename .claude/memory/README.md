# Sistema de Memoria - CRM Hoteis Reserva

Sistema de memoria persistente inspirado em claude-mem e everything-claude-code.

## Estrutura

```
memory/
├── sessions/       # Resumos de cada sessao de desenvolvimento
├── patterns/       # Padroes detectados automaticamente (JSON)
├── decisions/      # Decisoes arquiteturais importantes
└── instincts/      # Padroes aprendidos de alta confianca
```

## Como Funciona

### Sessions
- Criadas automaticamente ao final de cada sessao (hook `Stop`)
- Contem: arquivos modificados, commits, notas
- Ultimas 20 sessoes sao mantidas

### Patterns
- Extraidos automaticamente apos `git push` (hook `PostToolUse`)
- Formato JSON com contagem e historico
- Usados para identificar areas de maior atividade

### Decisions
- Criadas manualmente quando decisoes importantes sao tomadas
- Formato: `YYYY-MM-DD-titulo.md`
- Devem explicar PROBLEMA, OPCOES e DECISAO

### Instincts
- Padroes de alta confianca extraidos de multiplas sessoes
- Formato Markdown com metadados
- Carregados no inicio de cada sessao

## Criando um Instinct

```markdown
# Nome do Padrao

## Metadados
- Confidence: 95%
- Learned from: 47 sessions
- Last validated: 2025-02-04

## Regra
Descricao clara do padrao a ser seguido.

## Exemplos

### Correto
\`\`\`typescript
// Exemplo de uso correto
\`\`\`

### Incorreto
\`\`\`typescript
// Exemplo de uso incorreto
\`\`\`

## Contexto
Quando e por que este padrao deve ser aplicado.
```

## Comandos Uteis

- `/instinct-status` - Ver instincts ativos
- `/instinct-create [nome]` - Criar novo instinct
- `/session-review` - Revisar ultima sessao
- `/pattern-report` - Ver padroes detectados
