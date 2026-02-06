# /verify

Executa verificacao completa de qualidade no codigo.

## Execucao

Ao receber este comando:

1. Execute verificacoes em sequencia:
   - TypeScript: `npx tsc --noEmit`
   - ESLint: `npx eslint src/`
   - Multi-tenant: Verificar queries Prisma
   - Testes: `npm test`

2. Gere relatorio consolidado

## Opcoes

```
/verify              # Verifica tudo
/verify [arquivo]    # Verifica arquivo especifico
/verify typescript   # Apenas TypeScript
/verify tests        # Apenas testes
/verify security     # Apenas seguranca
```

## Output Esperado

```
═══════════════════════════════════════════════════════════
  VERIFICATION REPORT
═══════════════════════════════════════════════════════════

🔷 TYPESCRIPT
   Status: ✅ OK
   Arquivos verificados: 156
   Erros: 0

🔷 ESLINT
   Status: ⚠️ 2 avisos
   Warnings:
   - src/utils/format.ts:23 - Unused variable 'temp'
   - src/hooks/useData.ts:45 - Missing dependency in useEffect

🔷 MULTI-TENANT
   Status: ✅ OK
   Queries verificadas: 48
   Todas com tenantId: Sim

🔷 TESTES
   Status: ✅ OK
   Passaram: 124
   Falharam: 0
   Cobertura: 82%

───────────────────────────────────────────────────────────
📊 SCORE FINAL: 95/100
───────────────────────────────────────────────────────────

Recomendacoes:
1. Corrigir warnings do ESLint
2. Aumentar cobertura para 85%

═══════════════════════════════════════════════════════════
```

## Uso

```
/verify
```
