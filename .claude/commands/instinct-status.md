# /instinct-status

Lista todos os instincts ativos e suas metricas de confianca.

## Execucao

Ao receber este comando, execute:

1. Liste todos os arquivos em `.claude/memory/instincts/`
2. Para cada instinct, extraia:
   - Nome (titulo do arquivo)
   - Confianca (campo Confidence)
   - Categoria (campo Category)
   - Ultima validacao
3. Formate como tabela

## Output Esperado

```
═══════════════════════════════════════════════════════════
  INSTINCTS ATIVOS - CRM Hoteis Reserva
═══════════════════════════════════════════════════════════

| Instinct | Confianca | Categoria | Ultima Validacao |
|----------|-----------|-----------|------------------|
| multi-tenant-queries | 99% | Security | 2025-02-04 |
| typescript-strict | 95% | Code Quality | 2025-02-04 |
| commit-convention | 100% | Git Workflow | 2025-02-04 |
| tdd-first | 90% | Workflow | 2025-02-04 |

Total: 4 instincts ativos
Confianca media: 96%

═══════════════════════════════════════════════════════════
```

## Uso

```
/instinct-status
```
