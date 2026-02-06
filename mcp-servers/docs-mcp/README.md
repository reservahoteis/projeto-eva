# docs-mcp - MCP Server de Documentação

MCP Server que indexa e busca padrões nas skills do projeto, economizando tokens ao retornar apenas trechos relevantes.

## Instalação

```bash
cd mcp-servers/docs-mcp
npm install
npm run build
```

## Ferramentas Disponíveis

### `docs_search_pattern`
Busca padrões e exemplos de código nas documentações.

```
query: "prisma transaction"
query: "jwt refresh token"
query: "tanstack optimistic update"
query: "socket room authentication"
```

### `docs_list_skills`
Lista todas as skills disponíveis no projeto.

### `docs_get_checklist`
Retorna apenas o checklist de boas práticas de uma skill.

```
skill: "tech-prisma"
skill: "tech-jwt"
```

### `docs_get_section`
Busca uma seção específica de uma skill.

```
skill: "tech-prisma", section: "Transactions"
skill: "tech-redis-bull", section: "BullMQ"
```

## Configuração no Claude Desktop

Adicione ao seu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docs": {
      "command": "node",
      "args": ["C:/Users/55489/Desktop/Documentos/Dev/projeto-hoteis-reserva/mcp-servers/docs-mcp/dist/index.js"],
      "cwd": "C:/Users/55489/Desktop/Documentos/Dev/projeto-hoteis-reserva"
    }
  }
}
```

## Configuração no Claude Code

Adicione ao seu `.claude/settings.json`:

```json
{
  "mcpServers": {
    "docs": {
      "command": "node",
      "args": ["./mcp-servers/docs-mcp/dist/index.js"]
    }
  }
}
```

## Exemplos de Uso

Ao invés de carregar 500 linhas de documentação:

```
# Antes (carrega skill inteira)
/tech-prisma

# Depois (busca só o necessário)
docs_search_pattern("prisma soft delete")
→ Retorna apenas a seção de Middleware com o padrão de soft delete

docs_get_checklist("tech-jwt")
→ Retorna apenas o checklist de 10 itens, não 300 linhas
```

## Economia de Tokens

| Operação | Antes | Depois |
|----------|-------|--------|
| Buscar padrão Prisma | ~500 tokens | ~100 tokens |
| Verificar checklist | ~500 tokens | ~50 tokens |
| Múltiplas tecnologias | ~2000+ tokens | ~300 tokens |

## Desenvolvimento

```bash
# Rodar em modo dev
npm run dev

# Build para produção
npm run build
```
