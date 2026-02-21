import { Job } from 'bull';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import type { ProcessStatusJobData } from '../whatsapp-webhook.queue';
import { emitMessageStatusUpdate } from '@/config/socket';

/**
 * Worker para processar status updates de mensagens enviadas
 */
export async function processStatusUpdate(job: Job<ProcessStatusJobData>): Promise<void> {
  const { tenantId, status } = job.data;
  // metadata disponível em job.data.metadata se necessário no futuro

  logger.debug(
    {
      jobId: job.id,
      tenantId,
      messageId: status.id,
      status: status.status,
      recipientId: status.recipient_id,
    },
    'Processing status update'
  );

  try {
    // 1. ENCONTRAR MENSAGEM PELO externalMessageId
    const message = await prisma.message.findUnique({
      where: {
        externalMessageId: status.id,
      },
      select: {
        id: true,
        tenantId: true,
        conversationId: true,
        status: true,
      },
    });

    if (!message) {
      logger.warn(
        {
          jobId: job.id,
          tenantId,
          externalMessageId: status.id,
        },
        'Message not found for status update'
      );
      return; // Não falhar o job
    }

    // 2. VALIDAR TENANT (segurança)
    if (message.tenantId !== tenantId) {
      logger.error(
        {
          jobId: job.id,
          expectedTenantId: tenantId,
          actualTenantId: message.tenantId,
          externalMessageId: status.id,
        },
        'Tenant mismatch in status update - possible security issue!'
      );
      return; // Não falhar o job, mas logar como erro crítico
    }

    // 3. MAPEAR STATUS DO WHATSAPP PARA NOSSO ENUM
    const mappedStatus = mapWhatsAppStatus(status.status);

    // 4. VERIFICAR SE STATUS MUDOU (evitar updates desnecessários)
    if (message.status === mappedStatus) {
      logger.debug(
        {
          jobId: job.id,
          messageId: message.id,
          currentStatus: message.status,
        },
        'Status unchanged, skipping update'
      );
      return;
    }

    // 5. VALIDAR TRANSIÇÃO DE STATUS (opcional mas recomendado)
    if (!isValidStatusTransition(message.status, mappedStatus)) {
      logger.warn(
        {
          jobId: job.id,
          messageId: message.id,
          from: message.status,
          to: mappedStatus,
        },
        'Invalid status transition detected'
      );
      // Continuar mesmo assim (WhatsApp pode enviar fora de ordem)
    }

    // 6. PREPARAR METADATA DO STATUS
    const statusMetadata: any = {
      whatsappStatus: status.status,
      timestamp: status.timestamp,
      recipientId: status.recipient_id,
    };

    // Adicionar informações de erro se houver
    if (status.errors && status.errors.length > 0) {
      statusMetadata.errors = status.errors.map((err) => ({
        code: err.code,
        title: err.title,
        message: err.message,
        details: err.error_data?.details,
      }));
    }

    // Adicionar informações de conversação (billing)
    if (status.conversation) {
      statusMetadata.conversation = {
        id: status.conversation.id,
        originType: status.conversation.origin?.type,
        expirationTimestamp: status.conversation.expiration_timestamp,
      };
    }

    // Adicionar informações de pricing
    if (status.pricing) {
      statusMetadata.pricing = {
        billable: status.pricing.billable,
        pricingModel: status.pricing.pricing_model,
        category: status.pricing.category,
      };
    }

    // 7. ATUALIZAR MENSAGEM
    const existingMetadata = (message as any).metadata || {};
    const updatedMetadata: any = {
      ...existingMetadata,
      statusUpdates: [
        ...(existingMetadata.statusUpdates || []),
        statusMetadata,
      ],
    };

    // Se FAILED, salvar erro em delivery.error para o frontend exibir no tooltip
    if (mappedStatus === 'FAILED' && statusMetadata.errors?.length > 0) {
      const firstError = statusMetadata.errors[0];
      updatedMetadata.delivery = {
        ...(existingMetadata.delivery || {}),
        error: {
          code: String(firstError.code),
          message: firstError.message || firstError.title || 'Falha na entrega',
          details: firstError.details || undefined,
        },
      };
    }

    await prisma.message.update({
      where: {
        id: message.id,
      },
      data: {
        status: mappedStatus,
        metadata: updatedMetadata,
      },
    });

    logger.info(
      {
        jobId: job.id,
        tenantId,
        messageId: message.id,
        externalMessageId: status.id,
        oldStatus: message.status,
        newStatus: mappedStatus,
        hasErrors: status.errors && status.errors.length > 0,
      },
      'Status updated successfully'
    );

    // 7.5. EMITIR EVENTO WEBSOCKET (TEMPO REAL)
    emitMessageStatusUpdate(tenantId, message.conversationId, message.id, mappedStatus);

    // 8. SE STATUS É FAILED, LOGAR ERRO DETALHADO
    if (mappedStatus === 'FAILED' && status.errors) {
      logger.error(
        {
          tenantId,
          messageId: message.id,
          conversationId: message.conversationId,
          externalMessageId: status.id,
          errors: status.errors,
        },
        'Message failed to deliver'
      );

      // TODO: Notificar atendente sobre falha
      // TODO: Criar alerta se muitas mensagens falhando
    }

    // 9. SE STATUS É READ, MARCAR CONVERSA COMO "WAITING" (aguardando resposta do atendente)
    if (mappedStatus === 'READ') {
      const conversation = await prisma.conversation.findUnique({
        where: { id: message.conversationId },
        select: { status: true },
      });

      if (conversation && conversation.status === 'IN_PROGRESS') {
        await prisma.conversation.update({
          where: { id: message.conversationId },
          data: { status: 'WAITING' },
        });

        logger.debug(
          {
            conversationId: message.conversationId,
            messageId: message.id,
          },
          'Conversation status changed to WAITING (customer read message)'
        );
      }
    }
  } catch (error) {
    logger.error(
      {
        jobId: job.id,
        tenantId,
        messageId: status.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Error processing status update'
    );

    throw error; // Re-throw para Bull tentar novamente
  }
}

/**
 * Mapeia status do WhatsApp para nosso enum
 */
function mapWhatsAppStatus(whatsappStatus: string): 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' {
  switch (whatsappStatus.toUpperCase()) {
    case 'SENT':
      return 'SENT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'READ':
      return 'READ';
    case 'FAILED':
    case 'DELETED': // Tratar DELETED como FAILED
      return 'FAILED';
    default:
      logger.warn({ whatsappStatus }, 'Unknown WhatsApp status, defaulting to SENT');
      return 'SENT';
  }
}

/**
 * Valida se a transição de status é válida
 * Ordem esperada: SENT -> DELIVERED -> READ
 */
function isValidStatusTransition(
  currentStatus: string,
  newStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
): boolean {
  // FAILED pode vir de qualquer status
  if (newStatus === 'FAILED') {
    return true;
  }

  // READ pode vir de DELIVERED ou SENT
  if (newStatus === 'READ') {
    return currentStatus === 'DELIVERED' || currentStatus === 'SENT';
  }

  // DELIVERED pode vir de SENT
  if (newStatus === 'DELIVERED') {
    return currentStatus === 'SENT';
  }

  // SENT não deve receber update (é o status inicial)
  if (newStatus === 'SENT') {
    return false;
  }

  return false;
}
