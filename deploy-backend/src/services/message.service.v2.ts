import { prisma } from '@/config/database';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import { Direction, MessageType, MessageStatus } from '@prisma/client';
import { whatsAppServiceV2 } from './whatsapp.service.v2';
import { conversationService } from './conversation.service';
import { enqueueOutgoingMessage } from '@/queues/whatsapp-webhook.queue';
import logger from '@/config/logger';
import { validateMediaUrl } from '@/utils/url-validator';
import { emitNewMessage } from '@/config/socket';

// ============================================
// Types & Interfaces
// ============================================

interface SendMessageData {
  conversationId: string;
  content: string;
  type?: MessageType;
  sentById: string;
  metadata?: Record<string, any>;
}

interface ListMessagesParams {
  limit?: number;
  page?: number;
  before?: string; // Message ID para paginação
  after?: string;
}

interface ListMessagesResult {
  data: Array<{
    id: string;
    tenantId: string;
    conversationId: string;
    contactId?: string;
    userId?: string;
    whatsappMessageId: string | null;
    direction: Direction;
    type: MessageType;
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    metadata: any;
    status: MessageStatus;
    sentById: string | null;
    timestamp: string; // ISO string para compatibilidade com frontend
    createdAt: string; // ISO string para compatibilidade com frontend
    updatedAt: string; // ISO string para compatibilidade com frontend
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ReceiveMessageData {
  tenantId: string;
  contactPhoneNumber: string;
  contactName?: string;
  whatsappMessageId: string;
  type: MessageType;
  content: string;
  metadata?: any;
  timestamp: Date;
}

// ============================================
// Message Service V2 (com filas)
// ============================================

export class MessageServiceV2 {
  /**
   * Listar mensagens de uma conversa com paginação
   * CORREÇÃO: Removido filtro por tenantId das mensagens e ajustado formato de resposta
   */
  async listMessages(
    conversationId: string,
    tenantId: string,
    params?: ListMessagesParams
  ): Promise<ListMessagesResult> {
    // Validar limit (min: 1, max: 100, default: 50)
    const limit = Math.min(Math.max(params?.limit || 50, 1), 100);
    const page = Math.max(params?.page || 1, 1);
    const skip = (page - 1) * limit;

    // Primeiro validar que a conversa pertence ao tenant
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
      logger.warn({
        conversationId,
        tenantId,
        message: 'Conversation not found or does not belong to tenant'
      });
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

    // CORREÇÃO CRÍTICA: Buscar mensagens apenas pelo conversationId
    const where: any = {
      conversationId,
      // tenantId removido - mensagens não têm tenantId direto, herdam da conversation
    };

    // Adicionar logs para debug DETALHADO
    logger.info({
      conversationId,
      tenantId,
      where,
      limit,
      skip,
      page,
      conversationFound: !!conversation,
      contactPhone: conversation?.contact?.phoneNumber,
      message: 'Fetching messages for conversation'
    });

    // Contar total de mensagens
    const total = await prisma.message.count({ where });

    // Buscar mensagens com todos os campos necessários
    const messages = await prisma.message.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' }, // Mais recente primeiro
      select: {
        id: true,
        tenantId: true,
        conversationId: true,
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

    // Log do resultado
    logger.info({
      conversationId,
      messagesCount: messages.length,
      total,
      message: 'Messages fetched successfully'
    });

    // Reverter para ordem cronológica (mais antiga primeiro) e formatar para o frontend
    const formattedMessages = messages.reverse().map(msg => {
      // Extrair mediaUrl e mediaType do metadata se existir
      const mediaUrl = (msg.metadata as any)?.mediaUrl || undefined;
      const mediaType = (msg.metadata as any)?.mediaType || undefined;

      return {
        id: msg.id,
        tenantId: msg.tenantId,
        conversationId: msg.conversationId,
        contactId: conversation.contact.id, // Sempre preenchido
        userId: msg.sentById || undefined, // Converter null para undefined
        whatsappMessageId: msg.whatsappMessageId,
        direction: msg.direction,
        type: msg.type,
        status: msg.status,
        content: msg.content,
        mediaUrl,
        mediaType,
        metadata: msg.metadata || null,
        sentById: msg.sentById,
        timestamp: msg.timestamp.toISOString(), // Converter para ISO string
        createdAt: msg.createdAt.toISOString(), // Converter para ISO string
        updatedAt: msg.createdAt.toISOString(), // Converter para ISO string
      };
    });

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

  /**
   * Enviar mensagem (atendente → cliente)
   * VERSÃO V2: Usa filas para processamento assíncrono
   */
  async sendMessage(data: SendMessageData, tenantId: string) {
    logger.info(
      {
        conversationId: data.conversationId,
        type: data.type || 'TEXT',
        sentById: data.sentById,
      },
      'Sending message (enqueuing)'
    );

    // 1. BUSCAR CONVERSA E VALIDAR
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: data.conversationId,
        tenantId,
      },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // 2. VALIDAR NÚMERO DO CONTATO
    if (!whatsAppServiceV2.validatePhoneNumber(conversation.contact.phoneNumber)) {
      throw new BadRequestError('Número de telefone inválido');
    }

    // 3. VALIDAR CONTEÚDO BASEADO NO TIPO
    const messageType = data.type || 'TEXT';

    if (messageType === 'TEXT') {
      if (!data.content || data.content.trim().length === 0) {
        throw new BadRequestError('Conteúdo da mensagem não pode ser vazio');
      }

      if (data.content.length > 4096) {
        throw new BadRequestError('Mensagem excede limite de 4096 caracteres');
      }
    }

    if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(messageType)) {
      // Para mídia, content deve ser uma URL válida e segura
      if (!data.content) {
        throw new BadRequestError('URL de mídia é obrigatória');
      }

      // ✅ SEGURANÇA: Validação completa contra SSRF e URLs maliciosas
      validateMediaUrl(data.content, {
        allowAnyHost: false, // Apenas hosts whitelist
        maxLength: 2048,
      });
    }

    // 4. CRIAR MENSAGEM NO BANCO COM STATUS "PENDING"
    // Worker vai atualizar para SENT após enviar
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId: data.conversationId,
        direction: 'OUTBOUND',
        type: messageType,
        content: data.content,
        metadata: data.metadata || undefined,
        sentById: data.sentById,
        timestamp: new Date(),
        status: 'SENT', // Será SENT após worker processar (ou FAILED se falhar)
        // whatsappMessageId será preenchido pelo worker
      },
    });

    logger.info(
      {
        messageId: message.id,
        conversationId: data.conversationId,
        type: messageType,
      },
      'Message created in database'
    );

    // 5. ✅ EMITIR SOCKET.IO IMEDIATAMENTE (ANTES DE ENFILEIRAR)
    // Isso garante que o frontend vê a mensagem instantaneamente, mesmo que o worker falhe
    // FIX: Formatar datas como ISO strings para o frontend
    try {
      emitNewMessage(
        tenantId,
        data.conversationId,
        {
          id: message.id,
          conversationId: data.conversationId,
          whatsappMessageId: message.whatsappMessageId,
          direction: message.direction,
          type: message.type,
          content: message.content,
          metadata: message.metadata,
          status: message.status,
          timestamp: message.timestamp.toISOString(), // FIX: Converter para ISO string
          createdAt: message.createdAt.toISOString(), // FIX: Adicionar createdAt como ISO string
          updatedAt: message.updatedAt?.toISOString() || message.createdAt.toISOString(), // FIX: Adicionar updatedAt
          sentById: message.sentById,
        },
        {
          id: conversation.id,
          contact: {
            id: conversation.contact.id,
            phoneNumber: conversation.contact.phoneNumber,
            name: conversation.contact.name,
          },
        }
      );

      logger.info(
        {
          messageId: message.id,
          conversationId: data.conversationId,
          socketEvent: 'message:new',
        },
        '✅ Socket.io event emitted IMMEDIATELY (before queue)'
      );
    } catch (socketError) {
      logger.error(
        {
          error: socketError instanceof Error ? socketError.message : 'Unknown error',
          messageId: message.id,
          conversationId: data.conversationId,
        },
        'Failed to emit Socket.io event (non-fatal)'
      );
      // Não falhar a requisição por causa de erro no Socket.io
    }

    // 6. ENFILEIRAR PARA ENVIO (ASSÍNCRONO)
    try {
      await enqueueOutgoingMessage({
        tenantId,
        conversationId: data.conversationId,
        messageId: message.id,
        to: conversation.contact.phoneNumber,
        type: messageType.toLowerCase() as any,
        content: data.content,
        metadata: data.metadata,
      });

      logger.info(
        {
          messageId: message.id,
          conversationId: data.conversationId,
        },
        'Message enqueued for sending to WhatsApp'
      );
    } catch (error) {
      // Se falhar ao enfileirar, marcar como FAILED
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(data.metadata || {}),
            error: {
              message: 'Failed to enqueue message',
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          messageId: message.id,
        },
        'Failed to enqueue message'
      );

      throw new BadRequestError('Falha ao enfileirar mensagem para envio');
    }

    // 7. ATUALIZAR CONVERSA (lastMessageAt e status)
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === 'CLOSED' ? 'IN_PROGRESS' : conversation.status,
      },
    });

    logger.info(
      {
        messageId: message.id,
        conversationId: data.conversationId,
      },
      'Message sent successfully (queued)'
    );

    // 8. RETORNAR MENSAGEM IMEDIATAMENTE
    // Frontend já recebeu via Socket.io
    // Worker irá enviar para WhatsApp em background
    // Status será atualizado via Socket.io quando worker processar
    return message;
  }

  /**
   * Enviar mensagem de template
   * Templates são mensagens pré-aprovadas pela Meta
   */
  async sendTemplateMessage(
    tenantId: string,
    conversationId: string,
    templateName: string,
    parameters: string[],
    sentById: string,
    languageCode: string = 'pt_BR'
  ) {
    logger.info(
      {
        conversationId,
        templateName,
        parameterCount: parameters.length,
      },
      'Sending template message'
    );

    // Buscar conversa
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Criar mensagem
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTBOUND',
        type: 'TEMPLATE',
        content: `Template: ${templateName}`,
        metadata: {
          templateName,
          parameters,
          languageCode,
        },
        sentById,
        timestamp: new Date(),
        status: 'SENT',
      },
    });

    // Enfileirar
    await enqueueOutgoingMessage({
      tenantId,
      conversationId,
      messageId: message.id,
      to: conversation.contact.phoneNumber,
      type: 'template',
      content: templateName,
      metadata: {
        templateName,
        parameters,
        languageCode,
      },
    });

    // Atualizar conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === 'CLOSED' ? 'IN_PROGRESS' : conversation.status,
      },
    });

    return message;
  }

  /**
   * Enviar mensagem com botões interativos (até 3 botões)
   * Segue o mesmo padrão: criar no BD → enfileirar → retornar
   */
  async sendInteractiveButtons(
    tenantId: string,
    conversationId: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    sentById: string,
    headerText?: string,
    footerText?: string
  ) {
    logger.info(
      {
        conversationId,
        buttonCount: buttons.length,
      },
      'Sending interactive buttons message'
    );

    // Validações
    if (buttons.length === 0 || buttons.length > 3) {
      throw new BadRequestError('Número de botões deve ser entre 1 e 3');
    }

    if (bodyText.length > 1024) {
      throw new BadRequestError('Body text excede 1024 caracteres');
    }

    buttons.forEach((btn, index) => {
      if (btn.title.length > 20) {
        throw new BadRequestError(`Botão ${index + 1}: título excede 20 caracteres`);
      }
    });

    // Buscar conversa
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Validar número
    if (!whatsAppServiceV2.validatePhoneNumber(conversation.contact.phoneNumber)) {
      throw new BadRequestError('Número de telefone inválido');
    }

    // Criar mensagem no banco
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTBOUND',
        type: 'INTERACTIVE',
        content: bodyText,
        metadata: {
          interactiveType: 'button',
          buttons,
          headerText,
          footerText,
        },
        sentById,
        timestamp: new Date(),
        status: 'SENT',
      },
    });

    // Enfileirar para envio
    try {
      await enqueueOutgoingMessage({
        tenantId,
        conversationId,
        messageId: message.id,
        to: conversation.contact.phoneNumber,
        type: 'interactive_buttons',
        content: bodyText,
        metadata: {
          buttons,
          headerText,
          footerText,
        },
      });

      logger.info(
        {
          messageId: message.id,
          conversationId,
        },
        'Interactive buttons message enqueued'
      );
    } catch (error) {
      // Marcar como FAILED se não conseguir enfileirar
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(message.metadata as Record<string, any> || {}),
            error: {
              message: 'Failed to enqueue message',
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          messageId: message.id,
        },
        'Failed to enqueue interactive buttons message'
      );

      throw new BadRequestError('Falha ao enfileirar mensagem para envio');
    }

    // Atualizar conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === 'CLOSED' ? 'IN_PROGRESS' : conversation.status,
      },
    });

    return message;
  }

  /**
   * Enviar mensagem com lista interativa (até 10 itens)
   * Segue o mesmo padrão: criar no BD → enfileirar → retornar
   */
  async sendInteractiveList(
    tenantId: string,
    conversationId: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    sentById: string
  ) {
    logger.info(
      {
        conversationId,
        sectionCount: sections.length,
      },
      'Sending interactive list message'
    );

    // Validações
    if (sections.length === 0 || sections.length > 10) {
      throw new BadRequestError('Número de seções deve ser entre 1 e 10');
    }

    const totalRows = sections.reduce((acc, section) => acc + section.rows.length, 0);
    if (totalRows > 10) {
      throw new BadRequestError('Total de opções não pode exceder 10');
    }

    if (bodyText.length > 1024) {
      throw new BadRequestError('Body text excede 1024 caracteres');
    }

    if (buttonText.length > 20) {
      throw new BadRequestError('Button text excede 20 caracteres');
    }

    // Buscar conversa
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa não encontrada');
    }

    // Validar número
    if (!whatsAppServiceV2.validatePhoneNumber(conversation.contact.phoneNumber)) {
      throw new BadRequestError('Número de telefone inválido');
    }

    // Criar mensagem no banco
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTBOUND',
        type: 'INTERACTIVE',
        content: bodyText,
        metadata: {
          interactiveType: 'list',
          buttonText,
          sections,
        },
        sentById,
        timestamp: new Date(),
        status: 'SENT',
      },
    });

    // Enfileirar para envio
    try {
      await enqueueOutgoingMessage({
        tenantId,
        conversationId,
        messageId: message.id,
        to: conversation.contact.phoneNumber,
        type: 'interactive_list',
        content: bodyText,
        metadata: {
          buttonText,
          sections,
        },
      });

      logger.info(
        {
          messageId: message.id,
          conversationId,
        },
        'Interactive list message enqueued'
      );
    } catch (error) {
      // Marcar como FAILED se não conseguir enfileirar
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(message.metadata as Record<string, any> || {}),
            error: {
              message: 'Failed to enqueue message',
              timestamp: new Date().toISOString(),
            },
          },
        },
      });

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          messageId: message.id,
        },
        'Failed to enqueue interactive list message'
      );

      throw new BadRequestError('Falha ao enfileirar mensagem para envio');
    }

    // Atualizar conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === 'CLOSED' ? 'IN_PROGRESS' : conversation.status,
      },
    });

    return message;
  }

  /**
   * Receber mensagem do webhook (cliente → atendente)
   * NOTA: Este método é chamado pelo worker, não diretamente
   */
  async receiveMessage(data: ReceiveMessageData) {
    logger.info(
      {
        tenantId: data.tenantId,
        phoneNumber: data.contactPhoneNumber,
        type: data.type,
        whatsappMessageId: data.whatsappMessageId,
      },
      'Receiving message from webhook'
    );

    // 1. BUSCAR OU CRIAR CONTATO
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: data.tenantId,
        phoneNumber: data.contactPhoneNumber,
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: data.tenantId,
          phoneNumber: data.contactPhoneNumber,
          name: data.contactName || null,
        },
      });

      logger.info(
        {
          contactId: contact.id,
          phoneNumber: data.contactPhoneNumber,
        },
        'New contact created'
      );
    } else if (data.contactName && data.contactName !== contact.name) {
      // Atualizar nome se mudou
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: { name: data.contactName },
      });

      logger.debug(
        {
          contactId: contact.id,
          oldName: contact.name,
          newName: data.contactName,
        },
        'Contact name updated'
      );
    }

    // 2. BUSCAR OU CRIAR CONVERSA - FIX: Usar novo formato { conversation, isNew }
    const { conversation, isNew: isNewConversation } = await conversationService.getOrCreateConversation(
      data.tenantId,
      contact.id
    );

    // 3. VERIFICAR IDEMPOTÊNCIA (mensagem já existe?)
    const existingMessage = await prisma.message.findUnique({
      where: { whatsappMessageId: data.whatsappMessageId },
    });

    if (existingMessage) {
      logger.debug(
        {
          whatsappMessageId: data.whatsappMessageId,
          messageId: existingMessage.id,
        },
        'Message already exists (idempotent)'
      );
      return existingMessage;
    }

    // 4. CRIAR MENSAGEM
    const message = await prisma.message.create({
      data: {
        tenantId: data.tenantId,
        conversationId: conversation.id,
        whatsappMessageId: data.whatsappMessageId,
        direction: 'INBOUND',
        type: data.type,
        content: data.content,
        metadata: data.metadata || undefined,
        timestamp: data.timestamp,
        status: 'DELIVERED',
      },
    });

    // 5. ATUALIZAR CONVERSA
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: data.timestamp,
        // Se estava fechada, reabrir
        status: conversation.status === 'CLOSED' ? 'OPEN' : conversation.status,
      },
    });

    logger.info(
      {
        messageId: message.id,
        conversationId: conversation.id,
        contactId: contact.id,
        whatsappMessageId: data.whatsappMessageId,
        isNewConversation,
      },
      'Message received and saved'
    );

    // 6. EMITIR EVENTOS SOCKET.IO
    try {
      const { emitNewConversation } = await import('@/config/socket');

      // Se conversa é nova, emitir conversation:new primeiro
      if (isNewConversation) {
        emitNewConversation(data.tenantId, conversation);
        logger.debug({ conversationId: conversation.id }, 'Socket.io: New conversation emitted');
      }

      // Formatar mensagem com datas como ISO strings para o frontend
      const messageForSocket = {
        ...message,
        timestamp: message.timestamp.toISOString(),
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt?.toISOString() || message.createdAt.toISOString(),
      };

      // Emitir nova mensagem
      emitNewMessage(data.tenantId, conversation.id, messageForSocket, conversation);
    } catch (socketError) {
      logger.warn({ error: socketError }, 'Failed to emit Socket.io events for inbound message');
    }

    return message;
  }

  /**
   * Marcar mensagem como lida (atendente leu mensagem do cliente)
   */
  async markAsRead(messageId: string, tenantId: string): Promise<void> {
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        tenantId,
        direction: 'INBOUND', // Apenas mensagens recebidas
      },
    });

    if (!message) {
      throw new NotFoundError('Mensagem não encontrada');
    }

    // Atualizar status no banco
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'READ' },
    });

    // Enviar confirmação para WhatsApp (se tiver whatsappMessageId)
    if (message.whatsappMessageId) {
      await whatsAppServiceV2.markAsRead(tenantId, message.whatsappMessageId);
    }

    logger.debug(
      {
        messageId,
        whatsappMessageId: message.whatsappMessageId,
      },
      'Message marked as read'
    );
  }

  /**
   * Atualizar status de mensagem (chamado pelo webhook status update worker)
   */
  async updateMessageStatus(
    whatsappMessageId: string,
    status: MessageStatus
  ): Promise<void> {
    const message = await prisma.message.findUnique({
      where: { whatsappMessageId },
    });

    if (!message) {
      logger.warn(
        {
          whatsappMessageId,
          status,
        },
        'Message not found for status update'
      );
      return;
    }

    await prisma.message.update({
      where: { whatsappMessageId },
      data: { status },
    });

    logger.debug(
      {
        messageId: message.id,
        whatsappMessageId,
        oldStatus: message.status,
        newStatus: status,
      },
      'Message status updated'
    );
  }

  /**
   * Obter estatísticas de mensagens de uma conversa
   */
  async getConversationStats(conversationId: string, tenantId: string) {
    const stats = await prisma.message.groupBy({
      by: ['direction', 'status'],
      where: {
        conversationId,
        tenantId,
      },
      _count: true,
    });

    const total = await prisma.message.count({
      where: {
        conversationId,
        tenantId,
      },
    });

    return {
      total,
      byDirection: stats.reduce((acc, item) => {
        acc[item.direction] = (acc[item.direction] || 0) + item._count;
        return acc;
      }, {} as Record<string, number>),
      byStatus: stats.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Buscar mensagens por texto (full-text search)
   */
  async searchMessages(
    tenantId: string,
    query: string,
    options?: {
      conversationId?: string;
      limit?: number;
    }
  ) {
    const limit = Math.min(options?.limit || 50, 100);

    const where: any = {
      tenantId,
      content: {
        contains: query,
        mode: 'insensitive', // Case-insensitive
      },
    };

    if (options?.conversationId) {
      where.conversationId = options.conversationId;
    }

    const messages = await prisma.message.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        conversationId: true,
        direction: true,
        type: true,
        content: true,
        timestamp: true,
        conversation: {
          select: {
            id: true,
            contact: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    return {
      data: messages,
      count: messages.length,
    };
  }
}

export const messageServiceV2 = new MessageServiceV2();

// Backward compatibility
export default messageServiceV2;
