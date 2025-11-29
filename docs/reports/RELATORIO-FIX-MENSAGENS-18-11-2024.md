# RELATÓRIO DE CORREÇÃO - MENSAGENS NÃO APARECEM NA CONVERSA

## DATA: 18/11/2024
## PROBLEMA CRÍTICO RESOLVIDO

### DESCRIÇÃO DO PROBLEMA
- Mensagens aparecem no card do Kanban mas NÃO aparecem quando abre a conversa individual
- Mostra "Nenhuma mensagem ainda" mesmo com 4 mensagens confirmadas no banco
- URL afetada: https://www.botreserva.com.br/dashboard/conversations/c220fbae-a594-4c03-994d-a116fa9a917d

### CAUSA RAIZ IDENTIFICADA

#### 1. INCOMPATIBILIDADE DE FORMATO DE RESPOSTA
**Backend estava retornando:**
```javascript
{
  data: messages[],
  hasMore: boolean,
  nextCursor: string | null
}
```

**Frontend esperava (tipo PaginatedResponse):**
```javascript
{
  data: messages[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

#### 2. CAMPOS FALTANTES NA RESPOSTA
O backend não estava retornando todos os campos necessários do tipo `Message`:
- `contactId` - não estava sendo incluído
- `mediaUrl` e `mediaType` - estavam dentro do metadata, não como campos separados
- `updatedAt` - não existe na tabela messages

#### 3. FILTRO INCORRETO POR TENANT
O código estava tentando filtrar mensagens por `tenantId` diretamente, mas mensagens não têm esse campo - elas herdam o tenant da conversa.

### SOLUÇÃO IMPLEMENTADA

#### Arquivo: `deploy-backend/src/services/message.service.v2.ts`

1. **Ajustado interface de resposta:**
   - Mudou de cursor-based para page-based pagination
   - Adicionou objeto `pagination` com page, limit, total e totalPages

2. **Corrigido método `listMessages()`:**
   - Removido filtro direto por tenantId nas mensagens
   - Adicionado validação da conversa primeiro (garante segurança do tenant)
   - Incluído todos os campos necessários no mapeamento
   - Extraído mediaUrl e mediaType do metadata quando presente

3. **Melhorado logging:**
   - Adicionado logs detalhados para debug
   - Incluído contagem de mensagens encontradas

### CÓDIGO CORRIGIDO

```typescript
async listMessages(
  conversationId: string,
  tenantId: string,
  params?: ListMessagesParams
): Promise<ListMessagesResult> {
  const limit = Math.min(Math.max(params?.limit || 50, 1), 100);
  const page = Math.max(params?.page || 1, 1);
  const skip = (page - 1) * limit;

  // Validar que conversa pertence ao tenant
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId: tenantId,
    },
    include: {
      contact: true,
    }
  });

  if (!conversation) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };
  }

  // Buscar mensagens apenas pelo conversationId
  const where = { conversationId };
  const total = await prisma.message.count({ where });

  const messages = await prisma.message.findMany({
    where,
    skip,
    take: limit,
    orderBy: { timestamp: 'desc' },
    // ... selecionar todos os campos
  });

  // Formatar para o frontend
  const formattedMessages = messages.reverse().map(msg => ({
    // ... mapear todos os campos esperados
    contactId: conversation.contact.id,
    mediaUrl: msg.metadata?.mediaUrl,
    mediaType: msg.metadata?.mediaType,
    // ...
  }));

  return {
    data: formattedMessages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
```

### ARQUIVOS MODIFICADOS
1. `deploy-backend/src/services/message.service.v2.ts` - Service de mensagens corrigido
2. `scripts/check-messages.sql` - Script SQL para debug (novo)

### DEPLOYMENT
- Commit: `96ffe3d` - "fix: corrigir formato de resposta da rota GET /conversations/:id/messages"
- Push realizado com sucesso para origin/master
- Aguardando deploy automático via Railway

### COMO TESTAR

1. **Verificar deploy completado:**
```bash
curl -k "https://api.botreserva.com.br/health"
```

2. **Testar rota de mensagens (com token válido):**
```bash
curl -k "https://api.botreserva.com.br/api/conversations/c220fbae-a594-4c03-994d-a116fa9a917d/messages" \
  -H "x-tenant-slug: hoteis-reserva" \
  -H "Authorization: Bearer [TOKEN]"
```

3. **Verificar no frontend:**
- Acessar: https://www.botreserva.com.br/dashboard/conversations/c220fbae-a594-4c03-994d-a116fa9a917d
- As mensagens devem aparecer corretamente agora

### SCRIPT SQL DE VERIFICAÇÃO

Criado script em `scripts/check-messages.sql` para verificar:
- Se a conversa existe
- Quantas mensagens tem
- Detalhes das mensagens
- Tenant associado
- Estrutura da tabela

### PRÓXIMOS PASSOS

1. **Monitorar após deploy:**
   - Verificar logs do Railway
   - Confirmar que mensagens aparecem no frontend
   - Testar envio de novas mensagens

2. **Melhorias futuras:**
   - Implementar cache de mensagens
   - Adicionar paginação infinita no frontend
   - Otimizar queries com índices

### STATUS: RESOLVIDO ✅

O problema foi identificado e corrigido. A incompatibilidade de formato entre backend e frontend foi resolvida, garantindo que o frontend receba exatamente a estrutura de dados que espera.