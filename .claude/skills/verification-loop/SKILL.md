# Verification Loop Skill

Skill para verificacao continua de qualidade no CRM Hoteis Reserva.

## Invocacao

```
/verify [arquivo ou area]
```

## O Que Verifica

### 1. TypeScript
- Erros de tipo (`tsc --noEmit`)
- Uso de `any` ou `@ts-ignore`
- Non-null assertions desnecessarias

### 2. Multi-Tenant
- Queries Prisma com `tenantId`
- Middlewares de autenticacao
- Isolamento de dados

### 3. Seguranca
- Inputs validados com Zod
- Tokens nao expostos em logs
- Rate limiting configurado

### 4. Padroes do Projeto
- Formato de commit
- Estrutura de arquivos
- Nomenclatura

### 5. Testes
- Cobertura minima
- Testes de multi-tenant
- Testes de erro

## Workflow

```
┌─────────────────────────────────────────────┐
│           VERIFICATION LOOP                  │
├─────────────────────────────────────────────┤
│                                             │
│  1. STATIC ANALYSIS                         │
│     └─ tsc --noEmit                         │
│     └─ eslint                               │
│                                             │
│  2. SECURITY CHECK                          │
│     └─ tenant isolation                     │
│     └─ input validation                     │
│     └─ auth middleware                      │
│                                             │
│  3. PATTERN CHECK                           │
│     └─ instincts compliance                 │
│     └─ naming conventions                   │
│     └─ file structure                       │
│                                             │
│  4. TEST VERIFICATION                       │
│     └─ run related tests                    │
│     └─ check coverage                       │
│                                             │
│  5. REPORT                                  │
│     └─ issues found                         │
│     └─ suggestions                          │
│     └─ auto-fix available                   │
│                                             │
└─────────────────────────────────────────────┘
```

## Comandos

### Verificacao Completa
```bash
/verify
```

### Verificar Arquivo Especifico
```bash
/verify deploy-backend/src/services/conversation.service.ts
```

### Verificar Area
```bash
/verify controllers
/verify services
/verify frontend
```

## Output

```
═══════════════════════════════════════════════
  VERIFICATION REPORT
═══════════════════════════════════════════════

📁 Arquivos verificados: 15

✅ TypeScript: OK
✅ Multi-tenant: OK
⚠️  Seguranca: 1 aviso
   └─ services/email.service.ts:45 - Validar input com Zod

❌ Testes: 2 problemas
   └─ services/new.service.ts - Sem testes
   └─ Cobertura: 65% (minimo: 70%)

📊 Score: 85/100

═══════════════════════════════════════════════
```

## Integracao com Hooks

A verificacao e executada automaticamente via hooks:

| Evento | Verificacao |
|--------|-------------|
| PostToolUse (Edit .ts) | TypeScript |
| PostToolUse (Edit controller) | Multi-tenant |
| PostToolUse (git commit) | Formato commit |
| Stop | Relatorio completo |

## Checklist Manual

Quando `/verify` nao e suficiente:

- [ ] Revisar manualmente queries complexas
- [ ] Verificar fluxo de autenticacao end-to-end
- [ ] Testar com dados reais (staging)
- [ ] Revisar logs em busca de vazamentos
