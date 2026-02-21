// ============================================
// Worker: Process Incoming Messenger Messages
// ============================================

import { Job } from 'bull';
import { MessageType, Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import { n8nService } from '@/services/n8n.service';
import { getSocketIO } from '@/config/socket';
import type { ProcessMessengerMessageJobData } from '@/queues/whatsapp-webhook.queue';

/**
 * Worker para processar mensagens recebidas do Messenger.
 * Pipeline: findOrCreateContact -> findOrCreateConversation -> saveMessage -> forwardN8N -> emitSocket
 */
export async function processMessengerMessage(job: Job<ProcessMessengerMessageJobData>): Promise<void> {
  const { tenantId, senderId, message, postback } = job.data;

  logger.info(
    { jobId: job.id, tenantId, senderId, messageId: message.mid },
    'Processing Messenger message'
  );

  try {
    // 1. ENCONTRAR OU CRIAR CONTATO
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        channel: 'MESSENGER',
        externalId: senderId,
      },
      select: { id: true, name: true, phoneNumber: true, profilePictureUrl: true },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          channel: 'MESSENGER',
          externalId: senderId,
          name: null,
        },
        select: { id: true, name: true, phoneNumber: true, profilePictureUrl: true },
      });

      logger.info({ tenantId, contactId: contact.id, senderId }, 'Created Messenger contact');
    }

    // 2. ENCONTRAR OU CRIAR CONVERSA
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: contact.id,
        status: { in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'] },
      },
      select: { id: true, status: true, iaLocked: true },
    });

    const isNewConversation = !conversation;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          channel: 'MESSENGER',
          status: 'BOT_HANDLING',
          lastMessageAt: new Date(),
        },
        select: { id: true, status: true, iaLocked: true },
      });

      logger.info({ tenantId, conversationId: conversation.id }, 'Created Messenger conversation');
    }

    // 3. EXTRAIR CONTEUDO
    let messageType: MessageType = MessageType.TEXT;
    let content = '';
    const metadata: Prisma.JsonObject = { source: 'messenger' };

    if (postback) {
      messageType = MessageType.TEXT;
      content = postback.title;
      metadata.postback = { payload: postback.payload, title: postback.title };
      metadata.button = { id: postback.payload, title: postback.title };
    } else if (message.quick_reply?.payload) {
      // Quick Reply: usuario tocou um botao de Quick Reply
      // O texto visivel vem em message.text, o payload programatico em quick_reply.payload
      content = message.text || message.quick_reply.payload;
      metadata.quick_reply = { payload: message.quick_reply.payload };
      metadata.button = { id: message.quick_reply.payload, title: message.text || message.quick_reply.payload };
    } else if (message.text) {
      content = message.text;
    } else if (message.attachments && message.attachments.length > 0) {
      const att = message.attachments[0];
      if (att) {
        const typeMap: Record<string, MessageType> = {
          image: MessageType.IMAGE,
          video: MessageType.VIDEO,
          audio: MessageType.AUDIO,
          file: MessageType.DOCUMENT,
        };
        messageType = typeMap[att.type] || MessageType.TEXT;
        content = att.payload?.url || `[${att.type}]`;
        metadata.mediaUrl = att.payload?.url || null;
        metadata.mediaType = att.type;
      }
    }

    logger.info(
      {
        jobId: job.id,
        tenantId,
        messageType,
        contentLength: content.length,
        contentPreview: content.substring(0, 100),
        hasPostback: !!postback,
        hasAttachments: !!(message.attachments?.length),
      },
      '[MESSENGER WORKER] Conteudo normalizado'
    );

    // 4. SALVAR MENSAGEM NO BANCO
    const savedMessage = await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        externalMessageId: message.mid,
        direction: 'INBOUND',
        type: messageType,
        content,
        metadata,
        status: 'DELIVERED',
        timestamp: new Date(),
      },
    });

    logger.info(
      { jobId: job.id, messageId: savedMessage.id, conversationId: conversation.id },
      '[MESSENGER WORKER] Mensagem salva no banco'
    );

    // 5. ATUALIZAR CONVERSA
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: savedMessage.timestamp },
    });

    // 6. EMITIR SOCKET
    try {
      const io = getSocketIO();
      io.to(`tenant:${tenantId}`).emit('message:new', {
        conversationId: conversation.id,
        message: {
          id: savedMessage.id,
          conversationId: conversation.id,
          direction: 'INBOUND',
          type: messageType,
          content,
          status: 'DELIVERED',
          createdAt: savedMessage.createdAt,
        },
      });
      logger.info(
        { jobId: job.id, conversationId: conversation.id, room: `tenant:${tenantId}` },
        '[MESSENGER WORKER] Socket emitido'
      );
    } catch (socketErr) {
      logger.warn(
        { jobId: job.id, error: socketErr instanceof Error ? socketErr.message : 'Unknown' },
        '[MESSENGER WORKER] Socket emit falhou (nao critico)'
      );
    }

    // 7. ENCAMINHAR PARA N8N (se IA nao bloqueada)
    if (!conversation.iaLocked) {
      logger.info(
        { jobId: job.id, conversationId: conversation.id, iaLocked: false },
        '[MESSENGER WORKER] Encaminhando para N8N'
      );

      const n8nPayload = n8nService.buildPayload(
        senderId,
        {
          id: savedMessage.id,
          type: messageType,
          content,
          metadata,
          timestamp: savedMessage.timestamp,
        },
        conversation.id,
        contact.name,
        isNewConversation,
        'messenger',
        contact.phoneNumber
      );

      // Fire-and-forget: nao bloquear o worker enquanto N8N processa
      n8nService.forwardToN8N(tenantId, n8nPayload).catch((err) => {
        logger.error(
          { jobId: job.id, conversationId: conversation.id, error: err instanceof Error ? err.message : 'Unknown' },
          '[MESSENGER WORKER] Failed to forward to N8N'
        );
      });
    } else {
      logger.info(
        { jobId: job.id, conversationId: conversation.id, iaLocked: true },
        '[MESSENGER WORKER] IA bloqueada, nao encaminhar para N8N'
      );
    }

    logger.info(
      { jobId: job.id, tenantId, contactId: contact.id, conversationId: conversation.id },
      '[MESSENGER WORKER] Pipeline completo'
    );
  } catch (error) {
    logger.error(
      { jobId: job.id, tenantId, senderId, error: error instanceof Error ? error.message : 'Unknown' },
      'Failed to process Messenger message'
    );
    throw error;
  }
}
