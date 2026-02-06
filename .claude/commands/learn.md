# /learn

Extrai padroes da sessao atual e atualiza o sistema de aprendizado.

## Execucao

Ao receber este comando:

1. Analise as acoes da sessao atual:
   - Arquivos criados/modificados
   - Comandos executados
   - Erros encontrados e solucoes
   - Decisoes tomadas

2. Identifique padroes:
   - Repeticoes de codigo
   - Solucoes aplicadas multiplas vezes
   - Boas praticas seguidas

3. Atualize `.claude/memory/patterns/`

4. Se padrao atingir alta confianca, promova a instinct

## Output Esperado

```
═══════════════════════════════════════════════════════════
  CONTINUOUS LEARNING - Sessao Atual
═══════════════════════════════════════════════════════════

🔍 ANALISANDO SESSAO...

📊 PADROES DETECTADOS:

1. [NOVO] Uso de useCallback para handlers
   Ocorrencias: 4
   Confianca: 60%
   Status: Em observacao

2. [ATUALIZADO] Validacao Zod em endpoints
   Ocorrencias: +3 (total: 28)
   Confianca: 85% → 88%
   Status: Instinct ativo

3. [ATUALIZADO] TenantId em todas queries
   Ocorrencias: +5 (total: 67)
   Confianca: 99%
   Status: Instinct ativo

💾 SALVANDO EM:
   .claude/memory/patterns/usecallback-handlers.json
   .claude/memory/patterns/zod-validation.json (atualizado)

✨ NENHUM NOVO INSTINCT PROMOVIDO
   (useCallback precisa de mais sessoes)

═══════════════════════════════════════════════════════════
```

## Uso

```
/learn
```
