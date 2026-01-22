import axios from 'axios';
import logger from '@/config/logger';

/**
 * Serviço para replicar webhooks do ambiente de produção para desenvolvimento
 *
 * Funciona de forma assíncrona (fire-and-forget) para não impactar
 * a performance do ambiente de produção.
 */
class WebhookReplicatorService {
  private devWebhookUrl: string | null;
  private isEnabled: boolean;
  private timeout: number;

  constructor() {
    this.devWebhookUrl = process.env.DEV_WEBHOOK_URL || null;
    this.isEnabled = process.env.REPLICATE_WEBHOOKS_TO_DEV === 'true';
    this.timeout = parseInt(process.env.DEV_WEBHOOK_TIMEOUT || '5000', 10);
  }

  /**
   * Verifica se a replicação está habilitada
   */
  isReplicationEnabled(): boolean {
    return this.isEnabled && !!this.devWebhookUrl;
  }

  /**
   * Replica um webhook para o ambiente de desenvolvimento
   * Executa de forma assíncrona (fire-and-forget) para não bloquear produção
   */
  async replicateWebhook(
    payload: any,
    headers: Record<string, string | string[] | undefined>
  ): Promise<void> {
    if (!this.isReplicationEnabled()) {
      return;
    }

    // Fire-and-forget: não aguarda resposta
    this.sendToDevAsync(payload, headers).catch((error) => {
      // Log do erro mas não propaga (não deve afetar produção)
      logger.warn(
        { error: error.message, devUrl: this.devWebhookUrl },
        'Failed to replicate webhook to dev environment'
      );
    });
  }

  /**
   * Envia o webhook para o ambiente de desenvolvimento
   */
  private async sendToDevAsync(
    payload: any,
    originalHeaders: Record<string, string | string[] | undefined>
  ): Promise<void> {
    if (!this.devWebhookUrl) {
      return;
    }

    try {
      // Headers relevantes para replicar
      const headersToReplicate: Record<string, string> = {};

      // Copiar headers importantes do webhook original
      const relevantHeaders = [
        'x-hub-signature-256',
        'x-hub-signature',
        'content-type',
      ];

      for (const header of relevantHeaders) {
        const value = originalHeaders[header];
        if (value) {
          headersToReplicate[header] = Array.isArray(value) ? value[0] : value;
        }
      }

      // Adicionar header indicando que é uma réplica
      headersToReplicate['x-replicated-from'] = 'production';
      headersToReplicate['x-replicated-at'] = new Date().toISOString();

      await axios.post(this.devWebhookUrl, payload, {
        headers: headersToReplicate,
        timeout: this.timeout,
        // Não lançar erro para status 4xx/5xx (dev pode estar offline)
        validateStatus: () => true,
      });

      logger.debug(
        { devUrl: this.devWebhookUrl },
        'Webhook replicated to dev environment'
      );
    } catch (error: any) {
      // Erros de conexão (dev offline, timeout, etc)
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.debug(
          { error: error.code },
          'Dev environment unavailable for webhook replication'
        );
      } else {
        throw error;
      }
    }
  }
}

export const webhookReplicatorService = new WebhookReplicatorService();
