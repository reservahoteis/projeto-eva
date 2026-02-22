// ============================================
// Worker: Process Incoming Instagram Messages
// Uses EVA AI Engine (replaces N8N fire-and-forget)
// ============================================

import { Job } from 'bull';
import { ConversationStatus, MessageType, Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import { getSocketIO } from '@/config/socket';
import { evaOrchestrator } from '@/services/eva/eva-orchestrator.service';
import type { ProcessInstagramMessageJobData } from '@/queues/whatsapp-webhook.queue';

/**
 * Worker para processar mensagens recebidas do Instagram.
 * Pipeline: findOrCreateContact -> findOrCreateConversation -> saveMessage -> emitSocket -> EVA AI
 */
export async function processInstagramMessage(job: Job<ProcessInstagramMessageJobData>): Promise<void> {
  const { tenantId, senderId, message, postback } = job.data;

  logger.info(
    { jobId: job.id, tenantId, senderIdPrefix: senderId.substring(0, 8), messageId: message.mid },
    'Processing Instagram message'
  );

  try {
    // 1. ENCONTRAR OU CRIAR CONTATO
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        channel: 'INSTAGRAM',
        externalId: senderId,
      },
      select: { id: true, name: true, phoneNumber: true, profilePictureUrl: true },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          channel: 'INSTAGRAM',
          externalId: senderId,
          name: null,
        },
        select: { id: true, name: true, phoneNumber: true, profilePictureUrl: true },
      });

      logger.info({ tenantId, contactId: contact.id }, 'Created Instagram contact');
    }

    // 2. ENCONTRAR OU CRIAR CONVERSA (inclui CLOSED para smart reopen)
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        contactId: contact.id,
        status: { in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'] },
      },
      select: { id: true, status: true, iaLocked: true },
    });

    const isNewConversation = !conversation;

    // Smart reopen: se nao achou ativa, verificar CLOSED recente (30min)
    if (!conversation) {
      const recentClosed = await prisma.conversation.findFirst({
        where: {
          tenantId,
          contactId: contact.id,
          status: 'CLOSED',
          lastMessageAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000), // 30 min
          },
        },
        select: { id: true, status: true, iaLocked: true },
        orderBy: { lastMessageAt: 'desc' },
      });

      if (recentClosed) {
        // Reabrir conversa fechada recentemente
        await prisma.conversation.update({
          where: { id: recentClosed.id, tenantId },
          data: { status: 'OPEN' },
        });
        conversation = { ...recentClosed, status: 'OPEN' };
        logger.info(
          { tenantId, conversationId: conversation.id },
          '[INSTAGRAM WORKER] Reopened recently closed conversation'
        );
      }
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          channel: 'INSTAGRAM',
          status: 'BOT_HANDLING',
          lastMessageAt: new Date(),
        },
        select: { id: true, status: true, iaLocked: true },
      });

      logger.info({ tenantId, conversationId: conversation.id }, 'Created Instagram conversation');
    }

    // 3. EXTRAIR CONTEUDO
    let messageType: MessageType = MessageType.TEXT;
    let content = '';
    const metadata: Prisma.JsonObject = { source: 'instagram' };

    if (postback) {
      messageType = MessageType.TEXT;
      content = postback.title;
      metadata.postback = { payload: postback.payload, title: postback.title };
      metadata.button = { id: postback.payload, title: postback.title };
    } else if (message.quick_reply?.payload) {
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
        };
        messageType = typeMap[att.type] || MessageType.IMAGE;
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
        contentPreview: content.substring(0, 40),
        hasPostback: !!postback,
        hasAttachments: !!(message.attachments?.length),
      },
      '[INSTAGRAM WORKER] Conteudo normalizado'
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
      '[INSTAGRAM WORKER] Mensagem salva no banco'
    );

    // 5. ATUALIZAR CONVERSA (smart status: CLOSED -> OPEN)
    const newStatus: ConversationStatus = conversation.status === 'CLOSED'
      ? ConversationStatus.OPEN
      : (conversation.status as ConversationStatus);

    await prisma.conversation.update({
      where: { id: conversation.id, tenantId },
      data: {
        lastMessageAt: savedMessage.timestamp,
        status: newStatus,
      },
    });

    // 6. EMITIR SOCKET (inbound message)
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
        '[INSTAGRAM WORKER] Socket emitido'
      );
    } catch (socketErr) {
      logger.warn(
        { jobId: job.id, error: socketErr instanceof Error ? socketErr.message : 'Unknown' },
        '[INSTAGRAM WORKER] Socket emit falhou (nao critico)'
      );
    }

    // 7. PROCESSAR COM EVA AI (se IA nao bloqueada)
    if (!conversation.iaLocked) {
      logger.info(
        { jobId: job.id, conversationId: conversation.id, iaLocked: false },
        '[INSTAGRAM WORKER] Processando com EVA AI'
      );

      try {
        await evaOrchestrator.processMessage({
          tenantId,
          conversationId: conversation.id,
          contactId: contact.id,
          contactName: contact.name,
          senderId,
          channel: 'instagram',
          messageType: String(messageType),
          content,
          metadata: metadata as Record<string, unknown>,
          isNewConversation,
        });
      } catch (evaErr) {
        // EVA has its own fallback, but log if it completely fails
        logger.error(
          {
            jobId: job.id,
            conversationId: conversation.id,
            error: evaErr instanceof Error ? evaErr.message : 'Unknown',
          },
          '[INSTAGRAM WORKER] EVA processing failed (fallback should have fired)'
        );
      }
    } else {
      logger.info(
        { jobId: job.id, conversationId: conversation.id, iaLocked: true },
        '[INSTAGRAM WORKER] IA bloqueada, mensagem salva sem processamento EVA'
      );
    }

    logger.info(
      { jobId: job.id, tenantId, contactId: contact.id, conversationId: conversation.id },
      '[INSTAGRAM WORKER] Pipeline completo'
    );
  } catch (error) {
    logger.error(
      { jobId: job.id, tenantId, error: error instanceof Error ? error.message : 'Unknown' },
      'Failed to process Instagram message'
    );
    throw error;
  }
}
