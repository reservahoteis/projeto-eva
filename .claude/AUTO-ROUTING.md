# AUTO-ROUTING INTELIGENTE

Este arquivo define as regras de roteamento automatico. O Commander (e Claude em geral) DEVE seguir estas regras para invocar skills e MCP automaticamente.

---

## Principio Central

**NAO espere o usuario pedir.** Detecte o contexto e use a ferramenta certa automaticamente.

---

## Matriz de Deteccao Automatica

### 1. Deteccao por PALAVRAS-CHAVE

| Detectou no pedido | Acao Automatica |
|--------------------|-----------------|
| "endpoint", "rota", "API", "controller", "service" | Usar `/hoteis-api` |
| "componente", "botao", "modal", "form", "tabela", "UI" | Usar `/hoteis-component` |
| "feature", "funcionalidade", "modulo", "full-stack" | Usar `/hoteis-feature` |
| "bug", "erro", "nao funciona", "quebrou", "fix" | Usar `/hoteis-fix` |
| "deploy", "CI/CD", "VPS", "Docker", "producao" | Usar `/hoteis-deploy` |
| "N8N", "WhatsApp", "webhook", "automacao", "fluxo" | Usar `/hoteis-n8n` |
| "sistema de", "implementar novo", "criar modulo" (complexo) | Usar `/hoteis-plan` PRIMEIRO |

### 1.1. Deteccao de COMPLEXIDADE (Novo - superpowers pattern)

**ANTES de qualquer implementacao complexa, usar `/hoteis-plan`:**

| Indicadores de Complexidade | Acao |
|-----------------------------|------|
| Pedido vago ou ambiguo | `/hoteis-plan` primeiro |
| Estimativa > 30 minutos | `/hoteis-plan` primeiro |
| Multiplas formas de resolver | `/hoteis-plan` primeiro |
| Afeta multiplos arquivos (>3) | `/hoteis-plan` primeiro |
| Envolve backend + frontend | `/hoteis-plan` primeiro |
| Usuario diz "sistema de..." | `/hoteis-plan` primeiro |

### 2. Deteccao por CONTEXTO TECNICO

| Contexto | MCP/Skill a usar ANTES de implementar |
|----------|---------------------------------------|
| Vai escrever query Prisma | `docs_search_pattern("prisma [operacao]")` |
| Vai criar componente React | `docs_search_pattern("radix [componente]")` ou `docs_search_pattern("tanstack [hook]")` |
| Vai mexer em autenticacao | `docs_search_pattern("jwt [operacao]")` |
| Vai criar validacao | `docs_search_pattern("zod [tipo]")` |
| Vai mexer em fila/job | `docs_search_pattern("bullmq [operacao]")` |
| Vai mexer em real-time | `docs_search_pattern("socket [operacao]")` |
| Vai otimizar query SQL | `docs_search_pattern("postgresql [operacao]")` |
| Vai cachear dados | `docs_search_pattern("redis cache")` |

### 3. Deteccao por ARQUIVO sendo editado

| Caminho do arquivo | Contexto | Buscar padrao |
|--------------------|----------|---------------|
| `*/routes/*.ts` | Backend routing | Express middleware, auth |
| `*/controllers/*.ts` | Request handling | Response patterns |
| `*/services/*.ts` | Business logic | Prisma queries, transactions |
| `*/validators/*.ts` | Validation | Zod schemas |
| `*/components/*.tsx` | UI Components | Radix, TailwindCSS |
| `*/hooks/*.ts` | Data fetching | TanStack Query |
| `*/app/**/page.tsx` | Page components | Next.js patterns |
| `prisma/schema.prisma` | Database | Prisma relations |

---

## Fluxo de Auto-Routing

```
PEDIDO DO USUARIO
       |
       v
[1] DETECTAR PALAVRAS-CHAVE
    - Tem "endpoint"? → /hoteis-api
    - Tem "bug"? → /hoteis-fix
    - Tem "componente"? → /hoteis-component
       |
       v
[2] BUSCAR PADRAO NO MCP (se implementando codigo)
    - Vai usar Prisma? → docs_search_pattern("prisma ...")
    - Vai usar Zod? → docs_search_pattern("zod ...")
    - Economiza tokens, garante padrao correto
       |
       v
[3] DELEGAR PARA ESPECIALISTA (se Commander)
    - Banco? → elite-database-architect
    - Auth? → elite-security-architect
    - Infra? → elite-devops-architect
       |
       v
[4] EXECUTAR COM PADRAO DO PROJETO
    - Usar codigo do MCP/skill como base
    - Adaptar para o caso especifico
```

---

## Regras de Invocacao Automatica

### Skills (usar SEM o usuario pedir)

```
SE pedido contem "criar endpoint" OU "nova rota" OU "API de"
   ENTAO invocar /hoteis-api AUTOMATICAMENTE

SE pedido contem "criar componente" OU "botao" OU "modal" OU "form"
   ENTAO invocar /hoteis-component AUTOMATICAMENTE

SE pedido contem "implementar" E ("frontend" OU "backend" OU "feature")
   ENTAO invocar /hoteis-feature AUTOMATICAMENTE

SE pedido contem "bug" OU "erro" OU "nao funciona" OU "consertar"
   ENTAO invocar /hoteis-fix AUTOMATICAMENTE

SE pedido contem "deploy" OU "producao" OU "VPS" OU "CI/CD"
   ENTAO invocar /hoteis-deploy AUTOMATICAMENTE

SE pedido contem "N8N" OU "WhatsApp" OU "webhook" OU "automacao"
   ENTAO invocar /hoteis-n8n AUTOMATICAMENTE
```

### MCP docs (usar ANTES de escrever codigo)

```
SE vou escrever query Prisma
   ENTAO primeiro: docs_search_pattern("prisma [tipo de query]")

SE vou criar validacao Zod
   ENTAO primeiro: docs_search_pattern("zod [tipo]")

SE vou implementar auth/JWT
   ENTAO primeiro: docs_search_pattern("jwt [operacao]")

SE vou criar componente com Radix
   ENTAO primeiro: docs_search_pattern("radix [componente]")

SE vou usar TanStack Query
   ENTAO primeiro: docs_search_pattern("tanstack [hook/pattern]")

SE vou mexer em Socket.io
   ENTAO primeiro: docs_search_pattern("socket [operacao]")

SE vou otimizar PostgreSQL
   ENTAO primeiro: docs_search_pattern("postgresql [operacao]")
```

---

## Checklist de Verificacao (para todo codigo)

Antes de entregar codigo, verificar automaticamente:

```
[ ] Multi-tenant: tenantId em TODAS as queries?
    → docs_get_checklist("tech-prisma")

[ ] Validacao: Zod no input?
    → docs_get_checklist("tech-zod")

[ ] Auth: middleware aplicado?
    → docs_get_checklist("tech-jwt")

[ ] Response: formato padrao { success, data/error }?
    → docs_get_checklist("tech-express")

[ ] TypeScript: sem any, sem @ts-ignore?
    → docs_get_checklist("tech-typescript")
```

---

## Exemplos de Auto-Routing em Acao

### Exemplo 1: Usuario pede endpoint
```
Usuario: "Preciso de um endpoint para listar reservas"

Auto-Routing:
1. Detecta "endpoint" → invoca /hoteis-api
2. Detecta "reservas" (Prisma) → docs_search_pattern("prisma findMany pagination")
3. Delega para especialista com skill + padrao MCP
```

### Exemplo 2: Usuario pede corrigir bug
```
Usuario: "O modal de contato nao esta fechando"

Auto-Routing:
1. Detecta "modal" + "nao esta" → invoca /hoteis-fix
2. Detecta "modal" (Radix) → docs_search_pattern("radix dialog controlled")
3. Segue processo de debug do /hoteis-fix
```

### Exemplo 3: Usuario pede feature completa
```
Usuario: "Implementar sistema de tags para conversas"

Auto-Routing:
1. Detecta "implementar" + "sistema" → invoca /hoteis-feature
2. Detecta "tags" (many-to-many) → docs_search_pattern("prisma many-to-many")
3. Detecta UI necessaria → docs_search_pattern("radix select")
4. Segue template do /hoteis-feature
```

---

## Integracao com Commander

Quando o Commander recebe um pedido, ele DEVE:

1. **Analisar o pedido** usando as regras acima
2. **Invocar skills/MCP relevantes** ANTES de delegar
3. **Passar o contexto** (padroes, checklists) para o especialista
4. **Cobrar conformidade** com os padroes buscados

```
Commander recebe: "Criar endpoint de avaliacoes"

Commander executa:
1. Detecta: "endpoint" → skill /hoteis-api
2. Busca: docs_search_pattern("prisma create relations")
3. Busca: docs_get_checklist("tech-express")
4. Delega para elite-principal-engineer COM os padroes
5. Valida entrega contra checklist
```

---

## Economia de Tokens

Este sistema economiza tokens porque:

| Antes | Depois |
|-------|--------|
| Carrega skill inteira (500 linhas) | Busca só o padrao necessario (~50 linhas) |
| Repete padroes de memoria | Busca padrao atualizado do MCP |
| Usuario precisa lembrar de pedir | Sistema detecta e busca automaticamente |

---

## Ativacao

Este arquivo e **SEMPRE ATIVO**. Nao precisa de trigger especial.

O Claude (e o Commander) devem seguir estas regras em TODA interacao.

---

## Changelog

| Data | Mudanca | Referencia |
|------|---------|------------|
| 2026-02-05 | Adicionado `/hoteis-plan` e deteccao de complexidade | superpowers pattern |
| 2026-02-05 | TDD enforcement rigoroso via hooks | superpowers pattern |
| 2026-02-02 | Versao inicial | - |
