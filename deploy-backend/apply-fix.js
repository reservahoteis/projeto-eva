#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ler o arquivo original
const filePath = path.join(__dirname, 'src/services/message.service.v2.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Encontrar e substituir o método listMessages
const methodStart = content.indexOf('  async listMessages(');
const methodEnd = content.indexOf('  }', methodStart) + 3;

if (methodStart === -1 || methodEnd === -1) {
  console.error('Não foi possível encontrar o método listMessages');
  process.exit(1);
}

// Novo método corrigido
const newMethod = `  /**
   * Listar mensagens de uma conversa com paginação por cursor
   * CORREÇÃO: Removido filtro por tenantId das mensagens
   */
  async listMessages(
    conversationId: string,
    tenantId: string,
    params?: ListMessagesParams
  ): Promise<ListMessagesResult> {
    // Validar limit (min: 1, max: 100, default: 50)
    const limit = Math.min(Math.max(params?.limit || 50, 1), 100);

    // NOVO: Primeiro validar que a conversa pertence ao tenant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId: tenantId,
      },
    });

    if (!conversation) {
      logger.warn({
        conversationId,
        tenantId,
        message: 'Conversation not found or does not belong to tenant'
      });
      return {
        data: [],
        hasMore: false,
        nextCursor: null,
      };
    }

    // CORREÇÃO CRÍTICA: Buscar mensagens apenas pelo conversationId
    const where: any = {
      conversationId,
      // tenantId removido - era a causa do bug!
    };

    // Paginação por cursor (ID da mensagem)
    if (params?.before) {
      where.id = { lt: params.before };
    } else if (params?.after) {
      where.id = { gt: params.after };
    }

    // NOVO: Adicionar logs para debug
    logger.info({
      conversationId,
      tenantId,
      where,
      limit,
      message: 'Fetching messages for conversation'
    });

    const messages = await prisma.message.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' }, // Mais recente primeiro
      select: {
        id: true,
        whatsappMessageId: true,
        direction: true,
        type: true,
        content: true,
        metadata: true,
        status: true,
        sentById: true,
        timestamp: true,
        createdAt: true,
      },
    });

    // NOVO: Log do resultado
    logger.info({
      conversationId,
      messagesCount: messages.length,
      message: 'Messages fetched successfully'
    });

    // Reverter para ordem cronológica (mais antiga primeiro)
    const reversedMessages = messages.reverse();

    return {
      data: reversedMessages,
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? (messages[0]?.id ?? null) : null,
    };
  }`;

// Substituir o método antigo pelo novo
const before = content.substring(0, methodStart - 2); // -2 para incluir a indentação
const after = content.substring(methodEnd);
content = before + newMethod + after;

// Salvar o arquivo corrigido
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Arquivo message.service.v2.ts corrigido com sucesso!');
console.log('📝 Mudanças aplicadas:');
console.log('   - Removido filtro por tenantId das mensagens');
console.log('   - Adicionada validação de conversa/tenant');
console.log('   - Adicionados logs para debug');
console.log('\n🔄 Reinicie o servidor backend para aplicar as mudanças');