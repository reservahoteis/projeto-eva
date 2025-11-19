# Teste das Novas Rotas RESTful

## Configuração Inicial

Primeiro, certifique-se de que o servidor está rodando:
```bash
npm run dev
```

## 1. Obter Token de Autenticação

```bash
# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: seu-tenant" \
  -d '{
    "email": "admin@example.com",
    "password": "sua-senha"
  }'
```

Guarde o token retornado para usar nas próximas requisições.

## 2. Testar Rotas Antigas (Devem Funcionar com Avisos)

### Rota Antiga - Listar Mensagens
```bash
# Esta rota ainda funciona mas mostra deprecation warning no console do servidor
curl -X GET "http://localhost:3001/api/messages/conversations/uuid-da-conversa/messages" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant"
```

Você verá no console do servidor:
```
DEPRECATED: GET /api/messages/conversations/:conversationId/messages is deprecated. Use GET /api/conversations/:conversationId/messages instead
```

## 3. Testar Novas Rotas RESTful

### Nova Rota - Listar Mensagens (Padrão RESTful)
```bash
# Nova rota seguindo padrão RESTful
curl -X GET "http://localhost:3001/api/conversations/uuid-da-conversa/messages" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant"
```

### Nova Rota - Enviar Mensagem
```bash
# Enviar mensagem usando a nova rota aninhada
curl -X POST "http://localhost:3001/api/conversations/uuid-da-conversa/messages" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Teste da nova rota RESTful",
    "type": "TEXT"
  }'
```

### Nova Rota - Enviar Template
```bash
# Enviar template message
curl -X POST "http://localhost:3001/api/conversations/uuid-da-conversa/messages/template" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant" \
  -H "Content-Type: application/json" \
  -d '{
    "templateName": "hello_world",
    "parameters": ["João"],
    "languageCode": "pt_BR"
  }'
```

### Nova Rota - Enviar Botões Interativos
```bash
# Enviar mensagem com botões
curl -X POST "http://localhost:3001/api/conversations/uuid-da-conversa/messages/buttons" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant" \
  -H "Content-Type: application/json" \
  -d '{
    "bodyText": "Escolha uma opção:",
    "buttons": [
      {"id": "btn1", "title": "Opção 1"},
      {"id": "btn2", "title": "Opção 2"}
    ],
    "headerText": "Menu de Opções"
  }'
```

### Nova Rota - Estatísticas de Mensagens
```bash
# Obter estatísticas de mensagens de uma conversa
curl -X GET "http://localhost:3001/api/conversations/uuid-da-conversa/messages/stats" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant"
```

## 4. Testar Rotas Globais (Não Aninhadas)

### Busca Global de Mensagens
```bash
# Buscar mensagens em todas as conversas
curl -X GET "http://localhost:3001/api/messages/search?query=teste" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant"
```

### Marcar Mensagem como Lida
```bash
# Marcar mensagem específica como lida (por ID da mensagem)
curl -X POST "http://localhost:3001/api/messages/uuid-da-mensagem/read" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-slug: seu-tenant"
```

## 5. Teste com JavaScript/TypeScript

```javascript
// Exemplo de migração no frontend

// ANTES (rota antiga)
const oldRoute = `/api/messages/conversations/${conversationId}/messages`;

// DEPOIS (rota nova RESTful)
const newRoute = `/api/conversations/${conversationId}/messages`;

// Função para listar mensagens
async function listMessages(conversationId) {
  const response = await fetch(
    `/api/conversations/${conversationId}/messages`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-slug': tenantSlug
      }
    }
  );
  return response.json();
}

// Função para enviar mensagem
async function sendMessage(conversationId, content) {
  const response = await fetch(
    `/api/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-slug': tenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content,
        type: 'TEXT'
      })
    }
  );
  return response.json();
}
```

## 6. Verificar Logs do Servidor

Ao usar rotas depreciadas, você verá avisos no console:
```
DEPRECATED: GET /api/messages/conversations/:conversationId/messages is deprecated. Use GET /api/conversations/:conversationId/messages instead
DEPRECATED: POST /api/messages is deprecated. Use POST /api/conversations/:conversationId/messages instead
```

## 7. Comparação de Performance

### Teste de Latência
```bash
# Testar rota antiga (com redirecionamento)
time curl -X GET "http://localhost:3001/api/messages/conversations/uuid/messages" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: tenant"

# Testar rota nova (direta)
time curl -X GET "http://localhost:3001/api/conversations/uuid/messages" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: tenant"
```

A rota nova deve ser ligeiramente mais rápida por não ter o overhead do middleware de depreciação.

## 8. Validação de Erros

### Conversa não encontrada
```bash
curl -X GET "http://localhost:3001/api/conversations/invalid-uuid/messages" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: tenant"

# Resposta esperada: 404 Not Found
```

### Mensagem inválida
```bash
curl -X POST "http://localhost:3001/api/conversations/uuid/messages" \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-slug: tenant" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "",
    "type": "INVALID_TYPE"
  }'

# Resposta esperada: 400 Bad Request com detalhes da validação
```

## Resultado Esperado

✅ Rotas antigas continuam funcionando (backward compatibility)
✅ Rotas novas seguem padrão RESTful
✅ Frontend pode migrar gradualmente
✅ Logs de depreciação ajudam no monitoramento
✅ Performance melhorada nas rotas novas
✅ Estrutura mais clara e intuitiva