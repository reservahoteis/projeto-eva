import { prisma } from '@/config/database';
import { NotFoundError, BadRequestError } from '@/utils/errors';
import { Direction, MessageType } from '@prisma/client';
import { whatsAppService } from './whatsapp.service';
import { conversationService } from './conversation.service';
import logger from '@/config/logger';

interface SendMessageData {
  conversationId: string;
  content: string;
  type?: MessageType;
  sentById: string;
}

export class MessageService {
  /**
   * Listar mensagens de uma conversa
   */
  async listMessages(conversationId: string, tenantId: string, params?: {
    limit?: number;
    before?: string; // Message ID para paginação
    after?: string;
  }) {
    const limit = Math.min(params?.limit || 50, 100);

    const where: any = {
      conversationId,
      tenantId,
    };

    // Paginação por cursor (ID da mensagem)
    if (params?.before) {
      where.id = { lt: params.before };
    } else if (params?.after) {
      where.id = { gt: params.after };
    }

    const messages = await prisma.message.findMany({
      where,
      take: limit,
      orderBy: { timestamp: 'desc' },
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

    return {
      data: messages.reverse(), // Mais antiga primeiro
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[0]?.id : null,
    };
  }

  /**
   * Enviar mensagem (atendente → cliente)
   */
  async sendMessage(data: SendMessageData, tenantId: string) {
    // Buscar conversa
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

    // Validar número do contato
    if (!whatsAppService.validatePhoneNumber(conversation.contact.phoneNumber)) {
      throw new BadRequestError('Número de telefone inválido');
    }

    // 1. Salvar mensagem no banco (status: SENT)
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId: data.conversationId,
        direction: 'OUTBOUND',
        type: data.type || 'TEXT',
        content: data.content,
        sentById: data.sentById,
        timestamp: new Date(),
        status: 'SENT',
      },
    });

    // 2. Enviar para WhatsApp (assíncrono - será processado pela fila)
    // Por enquanto, enviar direto
    try {
      let whatsappResult;

      if (data.type === 'TEXT' || !data.type) {
        whatsappResult = await whatsAppService.sendTextMessage(
          tenantId,
          conversation.contact.phoneNumber,
          data.content
        );
      } else {
        // Mídia
        whatsappResult = await whatsAppService.sendMediaMessage(
          tenantId,
          conversation.contact.phoneNumber,
          {
            type: data.type as 'image' | 'video' | 'audio' | 'document',
            url: data.content,
          }
        );
      }

      // Atualizar com whatsappMessageId
      await prisma.message.update({
        where: { id: message.id },
        data: {
          whatsappMessageId: whatsappResult.whatsappMessageId,
        },
      });
    } catch (error) {
      // Marcar como FAILED
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED' },
      });

      logger.error({ error, messageId: message.id }, 'Failed to send message to WhatsApp');
      throw error;
    }

    // 3. Atualizar lastMessageAt da conversa
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === 'OPEN' ? 'IN_PROGRESS' : conversation.status,
      },
    });

    logger.info({ messageId: message.id, conversationId: data.conversationId }, 'Message sent');

    return message;
  }

  /**
   * Receber mensagem do webhook (cliente → atendente)
   */
  async receiveMessage(data: {
    tenantId: string;
    contactPhoneNumber: string;
    contactName?: string;
    whatsappMessageId: string;
    type: MessageType;
    content: string;
    metadata?: any;
    timestamp: Date;
  }) {
    // 1. Buscar ou criar contato
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

      logger.info({ contactId: contact.id, phoneNumber: data.contactPhoneNumber }, 'New contact created');
    } else if (data.contactName && !contact.name) {
      // Atualizar nome se não tinha
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: { name: data.contactName },
      });
    }

    // 2. Buscar ou criar conversa
    const conversation = await conversationService.getOrCreateConversation(
      data.tenantId,
      contact.id
    );

    // 3. Verificar se mensagem já existe (idempotência)
    const existingMessage = await prisma.message.findUnique({
      where: { whatsappMessageId: data.whatsappMessageId },
    });

    if (existingMessage) {
      logger.debug({ whatsappMessageId: data.whatsappMessageId }, 'Message already exists');
      return existingMessage;
    }

    // 4. Criar mensagem
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

    // 5. Atualizar lastMessageAt da conversa
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: data.timestamp },
    });

    logger.info({ messageId: message.id, conversationId: conversation.id }, 'Message received');

    // TODO: Emitir evento WebSocket para atendentes conectados

    return message;
  }

  /**
   * Marcar mensagem como lida
   */
  async markAsRead(messageId: string, tenantId: string) {
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

    // Atualizar no banco
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'READ' },
    });

    // Enviar confirmação para WhatsApp
    if (message.whatsappMessageId) {
      await whatsAppService.markAsRead(tenantId, message.whatsappMessageId);
    }

    logger.debug({ messageId }, 'Message marked as read');
  }

  /**
   * Atualizar status de mensagem (via webhook status update)
   */
  async updateMessageStatus(whatsappMessageId: string, status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED') {
    const message = await prisma.message.findUnique({
      where: { whatsappMessageId },
    });

    if (!message) {
      logger.warn({ whatsappMessageId }, 'Message not found for status update');
      return;
    }

    await prisma.message.update({
      where: { whatsappMessageId },
      data: { status },
    });

    logger.debug({ whatsappMessageId, status }, 'Message status updated');
  }
}

export const messageService = new MessageService();
