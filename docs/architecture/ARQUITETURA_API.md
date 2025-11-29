# Documentação da Arquitetura da API

## Padrões de Design RESTful

Este documento descreve a arquitetura da API RESTful implementada neste sistema, seguindo as melhores práticas da indústria conforme REST API Design Rulebook (O'Reilly), Google API Design Guide e Microsoft REST API Guidelines.

## Princípios Fundamentais

### 1. Design Baseado em Recursos
- Recursos são substantivos (conversas, mensagens, usuários)
- Verbos HTTP definem ações (GET, POST, PATCH, DELETE)
- URLs identificam recursos, não ações

### 2. Relacionamentos Hierárquicos
Mensagens pertencem a conversas, portanto são recursos aninhados:
```
/api/conversations/:id/messages
```

### 3. Padrões Consistentes
- Coleção: `/api/conversations`
- Item: `/api/conversations/:id`
- Coleção aninhada: `/api/conversations/:id/messages`
- Item aninhado: `/api/conversations/:id/messages/:messageId`

## Estrutura das Rotas da API

### API de Conversas

#### Rotas de Nível Superior
```
GET    /api/conversations              # Listar todas as conversas
GET    /api/conversations/stats        # Estatísticas globais
GET    /api/conversations/:id          # Obter conversa específica
PATCH  /api/conversations/:id          # Atualizar conversa
POST   /api/conversations/:id/assign   # Atribuir conversa a agente
POST   /api/conversations/:id/close    # Fechar conversa
```

#### Rotas de Mensagens Aninhadas (NOVO - Padrão RESTful)
```
GET    /api/conversations/:id/messages              # Listar mensagens da conversa
POST   /api/conversations/:id/messages              # Enviar mensagem para conversa
GET    /api/conversations/:id/messages/stats        # Estatísticas de mensagens da conversa
POST   /api/conversations/:id/messages/template     # Enviar mensagem template
POST   /api/conversations/:id/messages/buttons      # Enviar botões interativos
POST   /api/conversations/:id/messages/list         # Enviar lista interativa
```

### API de Mensagens (Apenas Operações Globais)

```
GET    /api/messages/search            # Busca global em todas as conversas
POST   /api/messages/:id/read          # Marcar mensagem específica como lida
```

## Caminho de Migração

### Antes (Não-RESTful)
```
GET  /api/messages/conversations/:conversationId/messages    # Estrutura aninhada confusa
POST /api/messages                                           # Sem relacionamento claro
```

### Depois (RESTful)
```
GET  /api/conversations/:conversationId/messages             # Relacionamento pai-filho claro
POST /api/conversations/:conversationId/messages             # Mensagem pertence à conversa
```

## Por Que Esta Arquitetura?

### 1. Propriedade Clara dos Recursos
- Mensagens pertencem a conversas
- Estrutura de URL reflete este relacionamento
- Mais fácil de entender e manter

### 2. Melhor Controle de Acesso
- Pode aplicar permissões no nível da conversa
- Mais fácil implementar isolamento de tenant
- Limites de segurança claros

### 3. Cache Aprimorado
- URLs hierárquicas permitem melhores estratégias de cache
- Pode invalidar cache da conversa quando mensagens mudam
- Uso mais eficiente de CDN

### 4. Benefícios para o Frontend
- Padrões de URL previsíveis
- Gerenciamento de estado mais fácil
- Lógica de roteamento mais limpa

## Compatibilidade Retroativa

Rotas depreciadas são mantidas com logs de aviso:
```javascript
// Rota antiga ainda funciona mas registra aviso de depreciação
GET /api/messages/conversations/:id/messages
// Redireciona para nova rota
GET /api/conversations/:id/messages
```

## Testando as Novas Rotas

### Usando curl
```bash
# Listar mensagens em uma conversa
curl -X GET http://localhost:3001/api/conversations/{conversationId}/messages \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-slug: {tenant}"

# Enviar uma mensagem para uma conversa
curl -X POST http://localhost:3001/api/conversations/{conversationId}/messages \
  -H "Authorization: Bearer {token}" \
  -H "x-tenant-slug: {tenant}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Olá, Mundo!",
    "type": "TEXT"
  }'
```

### Usando JavaScript/TypeScript
```typescript
// Listar mensagens
const response = await fetch(`/api/conversations/${conversationId}/messages`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-tenant-slug': tenantSlug
  }
});

// Enviar mensagem
const response = await fetch(`/api/conversations/${conversationId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-tenant-slug': tenantSlug,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: 'Olá, Mundo!',
    type: 'TEXT'
  })
});
```

## Considerações de Performance

### 1. Consultas ao Banco de Dados
- Rotas aninhadas permitem consultas otimizadas
- Pode fazer JOIN de conversas e mensagens eficientemente
- Melhor utilização de índices

### 2. Estratégia de Cache
```
Cache-Control: private, max-age=0    # Mensagens em tempo real
Cache-Control: public, max-age=3600  # Metadados da conversa
```

### 3. Rate Limiting
- Aplicado no nível da conversa
- Previne spam em conversas específicas
- Melhor alocação de recursos

## Melhores Práticas de Segurança

### 1. Autenticação e Autorização
- Todas as rotas exigem autenticação
- Isolamento de tenant forçado
- Propriedade da conversa validada

### 2. Validação de Entrada
- Schemas Zod para todas as entradas
- Validação de UUID para IDs
- Limites de tamanho de conteúdo

### 3. Rate Limiting
- Limites por endpoint
- Limites por usuário
- Limites por conversa

## Melhorias Futuras

### Fase 1 (Atual)
- Recursos aninhados básicos
- Compatibilidade retroativa
- Avisos de depreciação

### Fase 2 (Planejada)
```
GET    /api/conversations/:id/messages/:messageId    # Obter mensagem específica
PATCH  /api/conversations/:id/messages/:messageId    # Editar mensagem
DELETE /api/conversations/:id/messages/:messageId    # Deletar mensagem
```

### Fase 3 (Futuro)
```
GET    /api/conversations/:id/messages/unread        # Filtrar mensagens não lidas
GET    /api/conversations/:id/messages/attachments   # Listar todos os anexos
POST   /api/conversations/:id/messages/bulk          # Operações em lote
```

## Referências

1. **REST API Design Rulebook** - Mark Masse (O'Reilly)
   - Regra: Use relacionamentos hierárquicos para recursos aninhados
   - Regra: Mantenha URLs simples e previsíveis

2. **Google API Design Guide**
   - Design orientado a recursos
   - Métodos padrão mapeados para verbos HTTP
   - Padrões de coleções e métodos customizados

3. **Microsoft REST API Guidelines**
   - Melhores práticas de estrutura de URL
   - Estratégias de versionamento
   - Padrões de tratamento de erros

4. **Especificação HTTP/1.1 (RFC 7231)**
   - Uso adequado de métodos HTTP
   - Semântica de códigos de status
   - Negociação de conteúdo

## Monitoramento e Métricas

Acompanhe as seguintes métricas para garantir migração suave:
1. Uso de endpoints depreciados
2. Tempos de resposta para rotas aninhadas vs planas
3. Taxas de acerto de cache
4. Taxas de erro por endpoint

## Decisões Arquiteturais

### Por que mensagens são recursos aninhados?
- **Propriedade**: Uma mensagem sempre pertence a uma conversa
- **Ciclo de vida**: Quando uma conversa é deletada, suas mensagens também são
- **Segurança**: Permissões da conversa se aplicam às suas mensagens
- **Performance**: Queries otimizadas com JOINs naturais

### Por que manter rotas depreciadas?
- **Migração gradual**: Frontend pode migrar sem quebrar
- **Monitoramento**: Podemos rastrear uso das rotas antigas
- **Zero downtime**: Sem interrupção do serviço

## Contato

Para dúvidas sobre esta arquitetura:
- Revise o código em `/src/routes/`
- Verifique os controllers em `/src/controllers/`
- Consulte a camada de serviço em `/src/services/`