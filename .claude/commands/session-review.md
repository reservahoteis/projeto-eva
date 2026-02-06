# /session-review

Revisa a ultima sessao de desenvolvimento e extrai insights.

## Execucao

Ao receber este comando:

1. Leia o arquivo mais recente em `.claude/memory/sessions/`
2. Analise:
   - Arquivos modificados
   - Commits realizados
   - Padroes identificados
   - Decisoes tomadas
3. Gere relatorio com sugestoes

## Output Esperado

```
═══════════════════════════════════════════════════════════
  REVISAO DE SESSAO - [DATA]
═══════════════════════════════════════════════════════════

📁 ARQUIVOS MODIFICADOS (5):
   - deploy-backend/src/controllers/sales.controller.ts
   - deploy-backend/src/services/opportunity.service.ts
   - apps/frontend/src/components/SalesDashboard.tsx
   - ...

📝 COMMITS (3):
   - feat(sales): adicionar filtro de oportunidades
   - fix(dashboard): corrigir erro de TypeScript
   - test(sales): adicionar testes unitarios

🧠 PADROES IDENTIFICADOS:
   - Uso consistente de tenantId em queries (4x)
   - Validacao com Zod em todos inputs (3x)

💡 SUGESTOES:
   - Considere extrair logica de filtro para um hook
   - Adicionar testes E2E para o fluxo de vendas

═══════════════════════════════════════════════════════════
```

## Uso

```
/session-review
```
