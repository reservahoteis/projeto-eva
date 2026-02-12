# Regras - CRM Hoteis Reserva

## Proibido
- `any` / `@ts-ignore` / `!` assertion
- Query sem `tenantId` (vazamento multi-tenant)
- Secrets hardcoded
- Console.log em prod (usar Pino)
- Catch vazio
- Magic numbers
- .then()/.catch() (usar async/await)

## Obrigatorio
- Tipar retornos de funcao
- Validar inputs com Zod
- Tratar erros em async com try/catch
- Logar erros com Pino (contexto: tenantId, userId)
- tenantId em TODAS as queries (exceto SUPER_ADMIN)
- select ao inves de include (performance)
- Loading states em UI
- Feedback visual (toast)

## Nomenclatura
- Arquivos: `kebab-case.ts`
- Classes: `PascalCase`
- Funcoes: `camelCase`
- Constantes: `SCREAMING_SNAKE`
- Enums: `PascalCase` com valores `UPPER_SNAKE_CASE`

## Git
```
tipo(escopo): titulo

Problema: descricao
Solucao: como resolveu

feat|fix|refactor|docs|test|chore|perf
```

## Pushes
- SEMPRE separar commits/pushes de backend e frontend
- Backend primeiro, frontend depois (ou vice-versa)
- NUNCA misturar backend e frontend no mesmo push

## Testes
- Services: sempre
- APIs: sempre
- Componentes com logica: sempre
- Formato: `should [acao] when [condicao]`

## Rate Limits
- /auth/login: 5 req/15 min
- /webhooks/*: 1000 req/min
- /api/n8n/*: 5000 req/min
- /api/* geral: 100 req/min
