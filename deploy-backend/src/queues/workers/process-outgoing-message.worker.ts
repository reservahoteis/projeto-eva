import { Job } from 'bull';
import { prisma } from '@/config/database';
import { whatsAppService } from '@/services/whatsapp.service';
import logger from '@/config/logger';
import type { SendMessageJobData } from '../whatsapp-webhook.queue';
// InternalServerError disponível para uso futuro se necessário
// import { InternalServerError } from '@/utils/errors';
import { emitNewMessage, emitMessageStatusUpdate } from '@/config/socket';

/**
 * Worker para enviar mensagens para o WhatsApp
 */
export async function processOutgoingMessage(job: Job<SendMessageJobData>): Promise<{ externalMessageId: string }> {
  const { tenantId, conversationId, messageId, to, type, content, metadata } = job.data;

  logger.info(
    {
      jobId: job.id,
      tenantId,
      conversationId,
      messageId,
      to,
      type,
    },
    'Processing outgoing message'
  );

  try {
    // 1. VALIDAR QUE MENSAGEM AINDA EXISTE E NÃO FOI ENVIADA
    const message = await prisma.message.findUnique({
      where: {
        id: messageId,
      },
      select: {
        id: true,
        tenantId: true,
        conversationId: true,
        status: true,
        externalMessageId: true,
        type: true,
        content: true,
        metadata: true,
        timestamp: true,
        direction: true,
      },
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Validar tenant (segurança)
    if (message.tenantId !== tenantId) {
      throw new Error(`Tenant mismatch: expected ${tenantId}, got ${message.tenantId}`);
    }

    // Se já foi enviada (tem externalMessageId), não enviar novamente
    if (message.externalMessageId) {
      logger.warn(
        {
          jobId: job.id,
          messageId,
          externalMessageId: message.externalMessageId,
        },
        'Message already sent, skipping'
      );
      return { externalMessageId: message.externalMessageId };
    }

    // 2. ENVIAR MENSAGEM VIA WHATSAPP SERVICE
    let result: { externalMessageId: string; success: boolean };

    switch (type) {
      case 'text':
        result = await whatsAppService.sendTextMessage(tenantId, to, content);
        break;

      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        if (!metadata?.url) {
          throw new Error(`Media URL required for type ${type}`);
        }
        result = await whatsAppService.sendMediaMessage(tenantId, to, {
          type,
          url: metadata.url,
          caption: metadata.caption,
        });
        break;

      case 'template':
        if (!metadata?.templateName) {
          throw new Error('Template name required for template messages');
        }
        result = await whatsAppService.sendTemplate(
          tenantId,
          to,
          metadata.templateName,
          metadata.languageCode || 'pt_BR',
          metadata.parameters
        );
        break;

      default:
        throw new Error(`Unsupported message type: ${type}`);
    }

    if (!result.success || !result.externalMessageId) {
      throw new Error('Failed to send message - no WhatsApp message ID returned');
    }

    // 3. ATUALIZAR MENSAGEM COM externalMessageId E STATUS
    const updatedMessage = await prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        externalMessageId: result.externalMessageId,
        status: 'SENT',
      },
      select: {
        id: true,
        externalMessageId: true,
        direction: true,
        type: true,
        content: true,
        metadata: true,
        status: true,
        timestamp: true,
      },
    });

    // 4. ATUALIZAR CONVERSA (lastMessageAt)
    await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessageAt: new Date(),
        status: 'IN_PROGRESS', // Conversa agora está em progresso
      },
    });

    // 5. BUSCAR DADOS DO CONTATO PARA EMITIR NO EVENTO
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        contact: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
          },
        },
      },
    });

    // 6. EMITIR EVENTO WEBSOCKET (TEMPO REAL)
    if (conversation?.contact) {
      // CORREÇÃO: Passar conversation completo como 4º parâmetro
      emitNewMessage(
        tenantId,
        conversationId,
        {
          id: updatedMessage.id,
          conversationId: conversationId,
          externalMessageId: updatedMessage.externalMessageId,
          direction: updatedMessage.direction,
          type: updatedMessage.type,
          content: updatedMessage.content,
          metadata: updatedMessage.metadata,
          status: updatedMessage.status,
          timestamp: updatedMessage.timestamp,
          contactId: conversation.contact.id,
        },
        {
          // Objeto conversation completo esperado pelo frontend
          id: conversationId,
          contact: conversation.contact,
        }
      );

      logger.info(
        {
          jobId: job.id,
          tenantId,
          conversationId,
          messageId,
          socketEvent: 'message:new',
        },
        'Socket.io event emitted for outgoing message'
      );
    }

    logger.info(
      {
        jobId: job.id,
        tenantId,
        conversationId,
        messageId,
        externalMessageId: result.externalMessageId,
      },
      'Outgoing message sent successfully'
    );

    return { externalMessageId: result.externalMessageId };
  } catch (error) {
    logger.error(
      {
        jobId: job.id,
        tenantId,
        conversationId,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        attemptsMade: job.attemptsMade,
      },
      'Error sending outgoing message'
    );

    // Atualizar status da mensagem para FAILED
    try {
      await prisma.message.update({
        where: {
          id: messageId,
        },
        data: {
          status: 'FAILED',
          metadata: {
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
              attemptsMade: job.attemptsMade,
            },
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      // Emitir evento de falha com detalhes do erro
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      emitMessageStatusUpdate(tenantId, conversationId, messageId, 'FAILED', {
        code: 'SEND_FAILED',
        message: errorMsg,
      });

      logger.info(
        {
          messageId,
          socketEvent: 'message:status-update',
          status: 'FAILED',
        },
        'Socket.io event emitted for failed message'
      );
    } catch (updateError) {
      logger.error(
        {
          messageId,
          updateError: updateError instanceof Error ? updateError.message : 'Unknown error',
        },
        'Failed to update message status to FAILED'
      );
    }

    throw error; // Re-throw para Bull tentar novamente
  }
}