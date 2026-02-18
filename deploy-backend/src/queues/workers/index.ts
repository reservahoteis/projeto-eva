import logger from '@/config/logger';
import {
  whatsappIncomingMessageQueue,
  whatsappStatusUpdateQueue,
  whatsappOutgoingMessageQueue,
  whatsappMediaDownloadQueue,
  messengerIncomingMessageQueue,
  instagramIncomingMessageQueue,
  iaReactivationQueue,
} from '../whatsapp-webhook.queue';
import { processIncomingMessage } from './process-incoming-message.worker';
import { processStatusUpdate } from './process-status-update.worker';
import { processOutgoingMessage } from './process-outgoing-message.worker';
import { processMediaDownload } from './process-media-download.worker';
import { processMessengerMessage } from './process-messenger-message.worker';
import { processInstagramMessage } from './process-instagram-message.worker';
import { processIaReactivation } from './process-ia-reactivation.worker';

/**
 * Registra todos os workers nas suas respectivas filas
 * Deve ser chamado na inicialização do servidor
 */
export function registerWorkers(): void {
  logger.info('Registering queue workers...');

  // Worker: Processar mensagens recebidas
  whatsappIncomingMessageQueue.process(5, processIncomingMessage); // 5 jobs concorrentes
  logger.info('✅ Incoming message worker registered (concurrency: 5)');

  // Worker: Processar status updates
  whatsappStatusUpdateQueue.process(10, processStatusUpdate); // 10 jobs concorrentes (mais leve)
  logger.info('✅ Status update worker registered (concurrency: 10)');

  // Worker: Enviar mensagens
  whatsappOutgoingMessageQueue.process(3, processOutgoingMessage); // 3 jobs concorrentes (rate limited)
  logger.info('✅ Outgoing message worker registered (concurrency: 3)');

  // Worker: Download de mídias
  whatsappMediaDownloadQueue.process(2, processMediaDownload); // 2 jobs concorrentes (I/O intensivo)
  logger.info('✅ Media download worker registered (concurrency: 2)');

  // Worker: Processar mensagens Messenger
  messengerIncomingMessageQueue.process(3, processMessengerMessage);
  logger.info('✅ Messenger message worker registered (concurrency: 3)');

  // Worker: Processar mensagens Instagram
  instagramIncomingMessageQueue.process(3, processInstagramMessage);
  logger.info('✅ Instagram message worker registered (concurrency: 3)');

  // Worker: Reativacao automatica de IA apos follow-up
  iaReactivationQueue.process(1, processIaReactivation); // 1 job por vez (nao e critico)
  logger.info('✅ IA reactivation worker registered (concurrency: 1)');

  logger.info('All queue workers registered successfully');
}

/**
 * Para todos os workers (graceful shutdown)
 */
export async function stopWorkers(): Promise<void> {
  logger.info('Stopping queue workers...');

  const queues = [
    whatsappIncomingMessageQueue,
    whatsappStatusUpdateQueue,
    whatsappOutgoingMessageQueue,
    whatsappMediaDownloadQueue,
    messengerIncomingMessageQueue,
    instagramIncomingMessageQueue,
    iaReactivationQueue,
  ];

  await Promise.all(
    queues.map(async (queue) => {
      await queue.close();
      logger.info(`Queue ${queue.name} closed`);
    })
  );

  logger.info('All queue workers stopped');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, stopping workers...');
  await stopWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, stopping workers...');
  await stopWorkers();
  process.exit(0);
});
