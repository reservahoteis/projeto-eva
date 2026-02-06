# Commit Convention

## Metadados
- Confidence: 100%
- Learned from: Project rules
- Last validated: 2025-02-04
- Category: Git Workflow

## Regra
**Commits DEVEM seguir o formato: `tipo(escopo): descricao`**

## Formato Completo

```
tipo(escopo): titulo resumido

Problema: descricao do problema

Solucao: como foi resolvido
```

## Tipos Permitidos

| Tipo | Quando Usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correcao de bug |
| `refactor` | Refatoracao sem mudar comportamento |
| `docs` | Apenas documentacao |
| `style` | Formatacao, espacos, ponto-virgula |
| `test` | Adicionar ou corrigir testes |
| `chore` | Manutencao, deps, configs |
| `perf` | Melhoria de performance |

## Escopos Comuns

| Escopo | Area |
|--------|------|
| `auth` | Autenticacao, JWT, login |
| `chat` | Conversas, mensagens |
| `sales` | Oportunidades, SALES role |
| `n8n` | Integracoes N8N |
| `webhook` | Webhooks WhatsApp |
| `dashboard` | UI do dashboard |
| `api` | Endpoints gerais |
| `db` | Banco de dados, migrations |
| `socket` | Real-time, Socket.io |

## Exemplos

### Feature
```
feat(sales): adicionar filtro por periodo no dashboard

Problema: vendedores nao conseguiam filtrar oportunidades por data

Solucao: adicionado date picker com filtro de periodo no dashboard SALES
```

### Fix
```
fix(webhook): corrigir validacao HMAC para mensagens de status

Problema: mensagens de status do WhatsApp retornavam 401

Solucao: ajustado calculo do HMAC para usar raw body ao inves de parsed
```

### Refactor
```
refactor(chat): extrair logica de notificacao para service dedicado

Problema: controller de mensagens estava com muitas responsabilidades

Solucao: criado NotificationService para gerenciar envio de notificacoes
```

## Regras Obrigatorias

1. **Idioma:** Portugues (pt-BR), SEM acentos
2. **Primeira letra:** Minuscula apos o tipo
3. **Sem ponto final:** No titulo
4. **Sem Co-Authored-By:** NAO usar neste projeto
5. **Problema/Solucao:** Sempre incluir em fixes

## Validacao Automatica

O hook `validate-commit.js` verifica o formato apos cada `git commit`.

## Anti-patterns

```
# ERRADO - ingles
feat(auth): add login functionality

# ERRADO - muito vago
fix: corrigir bug

# ERRADO - muito longo
feat(sales): adicionar funcionalidade de filtragem de oportunidades por periodo com date picker e validacao de datas

# ERRADO - com Co-Authored-By
feat(api): criar endpoint
Co-Authored-By: Claude <noreply@anthropic.com>
```
