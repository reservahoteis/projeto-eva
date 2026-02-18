// ============================================
// Instagram Channel Adapter
// Instagram Messaging API via Graph API v21.0
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

export class InstagramAdapter implements ChannelSendAdapter {
  readonly channel = 'INSTAGRAM' as const;
  private axiosCache = new Map<string, AxiosInstance>();

  private async getAxiosForTenant(tenantId: string): Promise<AxiosInstance> {
    const cached = this.axiosCache.get(tenantId);
    if (cached) return cached;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        instagramAccountId: true,
        instagramAccessToken: true,
      },
    });

    if (!tenant?.instagramAccountId || !tenant?.instagramAccessToken) {
      throw new BadRequestError('Tenant não tem Instagram configurado');
    }

    let accessToken: string;
    try {
      accessToken = decrypt(tenant.instagramAccessToken);
    } catch {
      logger.error({ tenantId }, 'Failed to decrypt Instagram access token');
      throw new BadRequestError('Configuração Instagram inválida');
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
      logger.error({ tenantId, to, error: error.message }, 'Instagram sendText failed');
      throw new InternalServerError(`Falha ao enviar mensagem Instagram: ${error.message}`);
    }
  }

  async sendMedia(tenantId: string, to: string, media: MediaPayload): Promise<SendResult> {
    // Instagram suporta imagem nativamente; video/audio/document degradam para texto+link
    if (media.type !== 'image') {
      const linkText = media.caption
        ? `${media.caption}\n${media.url}`
        : media.url;
      return this.sendText(tenantId, to, linkText);
    }

    const api = await this.getAxiosForTenant(tenantId);

    try {
      const response = await api.post('/me/messages', {
        recipient: { id: to },
        message: {
          attachment: {
            type: 'image',
            payload: { url: media.url },
          },
        },
      });

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
      logger.error({ tenantId, to, error: error.message }, 'Instagram sendMedia failed');
      throw new InternalServerError(`Falha ao enviar mídia Instagram: ${error.message}`);
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
    // Instagram nao suporta botoes inline - degradar para texto numerado
    const numberedOptions = buttons
      .map((btn, i) => `${i + 1}. ${btn.title}`)
      .join('\n');

    const text = `${bodyText}\n\n${numberedOptions}`;
    return this.sendText(tenantId, to, text);
  }

  // Instagram NAO suporta listas, templates ou markAsRead
}

export const instagramAdapter = new InstagramAdapter();
