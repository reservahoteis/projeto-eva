import { Job } from 'bull';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import { emitConversationUpdate } from '@/config/socket';
import type { IaReactivationJobData } from '../whatsapp-webhook.queue';

/**
 * Worker: Reativar IA automaticamente apos follow-up
 *
 * Executado como delayed job (1 hora apos follow-up).
 * So reativa se iaLockedBy ainda e 'system:followup'
 * (se atendente assumiu manualmente, nao interfere).
 */
export async function processIaReactivation(job: Job<IaReactivationJobData>): Promise<void> {
  const { conversationId, tenantId } = job.data;

  logger.info({ conversationId, tenantId, jobId: job.id }, 'Processing IA reactivation');

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      tenantId,
    },
    select: {
      id: true,
      iaLocked: true,
      iaLockedBy: true,
      status: true,
    },
  });

  if (!conversation) {
    logger.warn({ conversationId, tenantId }, 'IA reactivation: conversation not found, skipping');
    return;
  }

  // Nao reativar se conversa esta fechada ou arquivada
  if (conversation.status === 'CLOSED' || conversation.status === 'ARCHIVED') {
    logger.info({ conversationId, status: conversation.status }, 'IA reactivation: conversation closed/archived, skipping');
    return;
  }

  // Nao reativar se ja esta desbloqueado
  if (!conversation.iaLocked) {
    logger.info({ conversationId }, 'IA reactivation: already unlocked, skipping');
    return;
  }

  // So reativar se foi travado pelo follow-up (nao por atendente manual)
  if (conversation.iaLockedBy !== 'system:followup') {
    logger.info(
      { conversationId, iaLockedBy: conversation.iaLockedBy },
      'IA reactivation: locked by different source, skipping (attendant may have taken over)'
    );
    return;
  }

  // Reativar IA
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      iaLocked: false,
      iaLockedAt: null,
      iaLockedBy: null,
    },
  });

  // Notificar frontend via Socket.io
  try {
    emitConversationUpdate(tenantId, conversationId, {
      iaLocked: false,
    });
  } catch (error) {
    logger.warn({ error, conversationId }, 'IA reactivation: failed to emit socket event');
  }

  logger.info(
    { conversationId, tenantId },
    'IA reactivated automatically after follow-up timeout'
  );
}
