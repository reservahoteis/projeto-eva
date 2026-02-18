// ============================================
// Messenger Channel Adapter
// Facebook Messenger Send API via Graph API v21.0
// ============================================

import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/config/database';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import { decrypt } from '@/utils/encryption';
import logger from '@/config/logger';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
} from './channel-send.interface';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MessengerAdapter implements ChannelSendAdapter {
  readonly channel = 'MESSENGER' as const;
  private axiosCache = new Map<string, AxiosInstance>();

  private async getAxiosForTenant(tenantId: string): Promise<AxiosInstance> {
    const cached = this.axiosCache.get(tenantId);
    if (cached) return cached;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        messengerPageId: true,
        messengerAccessToken: true,
      },
    });

    if (!tenant?.messengerPageId || !tenant?.messengerAccessToken) {
      throw new BadRequestError('Tenant não tem Messenger configurado');
    }

    let accessToken: string;
    try {
      accessToken = decrypt(tenant.messengerAccessToken);
    } catch {
      logger.error({ tenantId }, 'Failed to decrypt Messenger access token');
      throw new BadRequestError('Configuração Messenger inválida');
    }

    const instance = axios.create({
      baseURL: GRAPH_API_BASE,
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    this.axiosCache.set(tenantId, instance);
    return instance;
  }

  async sendText(tenantId: string, to: string, text: string): Promise<SendResult> {
    const api = await this.getAxiosForTenant(tenantId);

    try {
      const response = await api.post('/me/messages', {
        recipient: { id: to },
        message: { text },
      });

      return {
        externalMessageId: response.data.message_id || '',
        success: true,
      };
    } catch (error: any) {
      logger.error({ tenantId, to, error: error.message }, 'Messenger sendText failed');
      throw new InternalServerError(`Falha ao enviar mensagem Messenger: ${error.message}`);
    }
  }

  async sendMedia(tenantId: string, to: string, media: MediaPayload): Promise<SendResult> {
    const api = await this.getAxiosForTenant(tenantId);

    // Messenger suporta: image, video, audio, file
    const messengerType = media.type === 'document' ? 'file' : media.type;

    try {
      const response = await api.post('/me/messages', {
        recipient: { id: to },
        message: {
          attachment: {
            type: messengerType,
            payload: { url: media.url, is_reusable: true },
          },
        },
      });

      // Se tem caption, enviar como mensagem de texto separada
      if (media.caption) {
        await api.post('/me/messages', {
          recipient: { id: to },
          message: { text: media.caption },
        });
      }

      return {
        externalMessageId: response.data.message_id || '',
        success: true,
      };
    } catch (error: any) {
      logger.error({ tenantId, to, mediaType: media.type, error: error.message }, 'Messenger sendMedia failed');
      throw new InternalServerError(`Falha ao enviar mídia Messenger: ${error.message}`);
    }
  }

  async sendButtons(
    tenantId: string,
    to: string,
    bodyText: string,
    buttons: ButtonPayload[],
    _headerText?: string,
    _footerText?: string
  ): Promise<SendResult> {
    const api = await this.getAxiosForTenant(tenantId);

    try {
      const response = await api.post('/me/messages', {
        recipient: { id: to },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: bodyText,
              buttons: buttons.map((btn) => ({
                type: 'postback',
                title: btn.title.substring(0, 20),
                payload: btn.id,
              })),
            },
          },
        },
      });

      return {
        externalMessageId: response.data.message_id || '',
        success: true,
      };
    } catch (error: any) {
      logger.error({ tenantId, to, error: error.message }, 'Messenger sendButtons failed');
      throw new InternalServerError(`Falha ao enviar botões Messenger: ${error.message}`);
    }
  }

  // Messenger NAO suporta listas nativas - sera degradado pelo router
  // sendList nao implementado

  // Messenger NAO suporta templates pre-aprovados
  // sendTemplate nao implementado

  // markAsRead nao e necessario no Messenger
}

export const messengerAdapter = new MessengerAdapter();
