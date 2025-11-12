import Queue from 'bull';
import { env } from '@/config/env';
import logger from '@/config/logger';
import type { WhatsAppMessage, WhatsAppStatus } from '@/validators/whatsapp-webhook.validator';

// ============================================
// Queue Configuration
// ============================================

const QUEUE_OPTIONS = {
  redis: {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT),
    password: env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    attempts: 3, // Tentar 3 vezes
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: 100, // Manter últimos 100 jobs completos
    removeOnFail: 500, // Manter últimos 500 jobs falhados (para debug)
  },
  settings: {
    lockDuration: 30000, // 30 segundos
    stalledInterval: 60000, // 60 segundos
    maxStalledCount: 2, // Max 2 retries para jobs travados
  },
};

// ============================================
// Job Data Types
// ============================================

export interface ProcessMessageJobData {
  tenantId: string;
  message: WhatsAppMessage;
  contactName?: string;
  metadata: {
    phoneNumberId: string;
    displayPhoneNumber: string;
  };
}

export interface ProcessStatusJobData {
  tenantId: string;
  status: WhatsAppStatus;
  metadata: {
    phoneNumberId: string;
  };
}

export interface SendMessageJobData {
  tenantId: string;
  conversationId: string;
  messageId: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';
  content: string;
  metadata?: Record<string, any>;
}

export interface DownloadMediaJobData {
  tenantId: string;
  messageId: string;
  mediaId: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
}

// ============================================
// Queues
// ============================================

/**
 * Fila para processar mensagens recebidas do WhatsApp
 * Priority: alta (mensagens de clientes devem ser processadas rápido)
 */
export const whatsappIncomingMessageQueue = new Queue<ProcessMessageJobData>(
  'whatsapp:incoming:message',
  QUEUE_OPTIONS
);

/**
 * Fila para processar status updates de mensagens enviadas
 * Priority: média (status não é crítico)
 */
export const whatsappStatusUpdateQueue = new Queue<ProcessStatusJobData>(
  'whatsapp:status:update',
  QUEUE_OPTIONS
);

/**
 * Fila para enviar mensagens para o WhatsApp
 * Priority: alta (responder cliente é crítico)
 */
export const whatsappOutgoingMessageQueue = new Queue<SendMessageJobData>(
  'whatsapp:outgoing:message',
  {
    ...QUEUE_OPTIONS,
    limiter: {
      max: 80, // 80 mensagens
      duration: 1000, // por segundo (limite da Meta)
    },
  }
);

/**
 * Fila para baixar mídias do WhatsApp
 * Priority: baixa (pode ser processado depois)
 */
export const whatsappMediaDownloadQueue = new Queue<DownloadMediaJobData>(
  'whatsapp:media:download',
  {
    ...QUEUE_OPTIONS,
    defaultJobOptions: {
      ...QUEUE_OPTIONS.defaultJobOptions,
      attempts: 5, // Mais tentativas para download
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s, 40s, 80s
      },
    },
  }
);

// ============================================
// Queue Events (Monitoring & Logging)
// ============================================

// Incoming Messages Queue
whatsappIncomingMessageQueue.on('completed', (job, result) => {
  logger.info(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      messageId: job.data.message.id,
      duration: Date.now() - job.timestamp,
    },
    'Incoming message processed successfully'
  );
});

whatsappIncomingMessageQueue.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      messageId: job.data.message.id,
      error: err.message,
      stack: err.stack,
      attemptsMade: job.attemptsMade,
    },
    'Failed to process incoming message'
  );
});

whatsappIncomingMessageQueue.on('stalled', (job) => {
  logger.warn(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      messageId: job.data.message.id,
    },
    'Incoming message job stalled'
  );
});

// Status Update Queue
whatsappStatusUpdateQueue.on('completed', (job) => {
  logger.debug(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      messageId: job.data.status.id,
      status: job.data.status.status,
    },
    'Status update processed'
  );
});

whatsappStatusUpdateQueue.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      messageId: job.data.status.id,
      error: err.message,
      attemptsMade: job.attemptsMade,
    },
    'Failed to process status update'
  );
});

// Outgoing Messages Queue
whatsappOutgoingMessageQueue.on('completed', (job, result) => {
  logger.info(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      conversationId: job.data.conversationId,
      whatsappMessageId: result?.whatsappMessageId,
    },
    'Message sent successfully'
  );
});

whatsappOutgoingMessageQueue.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      conversationId: job.data.conversationId,
      error: err.message,
      stack: err.stack,
      attemptsMade: job.attemptsMade,
    },
    'Failed to send message'
  );
});

// Media Download Queue
whatsappMediaDownloadQueue.on('completed', (job, result) => {
  logger.info(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      mediaId: job.data.mediaId,
      mediaType: job.data.mediaType,
      fileSize: result?.size,
    },
    'Media downloaded successfully'
  );
});

whatsappMediaDownloadQueue.on('failed', (job, err) => {
  logger.error(
    {
      jobId: job.id,
      tenantId: job.data.tenantId,
      mediaId: job.data.mediaId,
      mediaType: job.data.mediaType,
      error: err.message,
      attemptsMade: job.attemptsMade,
    },
    'Failed to download media'
  );
});

// ============================================
// Global Queue Events
// ============================================

const queues = [
  whatsappIncomingMessageQueue,
  whatsappStatusUpdateQueue,
  whatsappOutgoingMessageQueue,
  whatsappMediaDownloadQueue,
];

queues.forEach((queue) => {
  queue.on('error', (error) => {
    logger.error({ queueName: queue.name, error: error.message }, 'Queue error');
  });

  queue.on('waiting', (jobId) => {
    logger.debug({ queueName: queue.name, jobId }, 'Job waiting');
  });

  queue.on('active', (job) => {
    logger.debug(
      {
        queueName: queue.name,
        jobId: job.id,
        tenantId: job.data.tenantId,
      },
      'Job started'
    );
  });
});

// ============================================
// Queue Helpers
// ============================================

/**
 * Adiciona mensagem recebida à fila
 */
export async function enqueueIncomingMessage(data: ProcessMessageJobData): Promise<void> {
  await whatsappIncomingMessageQueue.add(data, {
    priority: 1, // Alta prioridade
    jobId: `msg-${data.message.id}`, // Deduplicação
  });

  logger.debug(
    {
      tenantId: data.tenantId,
      messageId: data.message.id,
    },
    'Incoming message enqueued'
  );
}

/**
 * Adiciona status update à fila
 */
export async function enqueueStatusUpdate(data: ProcessStatusJobData): Promise<void> {
  await whatsappStatusUpdateQueue.add(data, {
    priority: 3, // Prioridade média
    jobId: `status-${data.status.id}-${data.status.timestamp}`, // Deduplicação
  });

  logger.debug(
    {
      tenantId: data.tenantId,
      messageId: data.status.id,
      status: data.status.status,
    },
    'Status update enqueued'
  );
}

/**
 * Adiciona mensagem para envio à fila
 */
export async function enqueueOutgoingMessage(data: SendMessageJobData): Promise<void> {
  await whatsappOutgoingMessageQueue.add(data, {
    priority: 1, // Alta prioridade
    jobId: `send-${data.messageId}`, // Deduplicação
  });

  logger.debug(
    {
      tenantId: data.tenantId,
      messageId: data.messageId,
      conversationId: data.conversationId,
    },
    'Outgoing message enqueued'
  );
}

/**
 * Adiciona download de mídia à fila
 */
export async function enqueueMediaDownload(data: DownloadMediaJobData): Promise<void> {
  await whatsappMediaDownloadQueue.add(data, {
    priority: 5, // Baixa prioridade
    jobId: `media-${data.mediaId}`, // Deduplicação
  });

  logger.debug(
    {
      tenantId: data.tenantId,
      mediaId: data.mediaId,
      mediaType: data.mediaType,
    },
    'Media download enqueued'
  );
}

/**
 * Limpa jobs antigos de todas as filas
 */
export async function cleanOldJobs(): Promise<void> {
  for (const queue of queues) {
    // Limpar jobs completos mais antigos que 24h
    await queue.clean(24 * 60 * 60 * 1000, 'completed');

    // Limpar jobs falhados mais antigos que 7 dias
    await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed');

    logger.info({ queueName: queue.name }, 'Cleaned old jobs');
  }
}

/**
 * Pausa todas as filas (para manutenção)
 */
export async function pauseAllQueues(): Promise<void> {
  await Promise.all(queues.map((q) => q.pause()));
  logger.warn('All queues paused');
}

/**
 * Resume todas as filas
 */
export async function resumeAllQueues(): Promise<void> {
  await Promise.all(queues.map((q) => q.resume()));
  logger.info('All queues resumed');
}

/**
 * Fecha todas as filas (graceful shutdown)
 */
export async function closeAllQueues(): Promise<void> {
  await Promise.all(queues.map((q) => q.close()));
  logger.info('All queues closed');
}

/**
 * Obt health status de todas as filas
 */
export async function getQueuesHealth() {
  const health = await Promise.all(
    queues.map(async (queue) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        name: queue.name,
        counts: {
          waiting,
          active,
          completed,
          failed,
          delayed,
        },
        isPaused: await queue.isPaused(),
      };
    })
  );

  return health;
}

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing queues...');
  await closeAllQueues();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing queues...');
  await closeAllQueues();
  process.exit(0);
});

// ============================================
// Exports
// ============================================

export default {
  incoming: whatsappIncomingMessageQueue,
  status: whatsappStatusUpdateQueue,
  outgoing: whatsappOutgoingMessageQueue,
  media: whatsappMediaDownloadQueue,
  enqueueIncomingMessage,
  enqueueStatusUpdate,
  enqueueOutgoingMessage,
  enqueueMediaDownload,
  cleanOldJobs,
  pauseAllQueues,
  resumeAllQueues,
  closeAllQueues,
  getQueuesHealth,
};
