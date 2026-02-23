// ============================================
// Messenger Channel Adapter
// Facebook Messenger Send API via Graph API v21.0
// ============================================

import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import { decrypt } from '@/utils/encryption';
import logger from '@/config/logger';
import { addRetryInterceptor } from '@/utils/axios-retry';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
  QuickReplyPayload,
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

    let accessToken: string | undefined;

    // 1. Tentar config do DB (multi-tenant)
    if (tenant?.messengerPageId && tenant?.messengerAccessToken) {
      try {
        accessToken = decrypt(tenant.messengerAccessToken);
      } catch {
        logger.error({ tenantId }, '[MESSENGER SEND] Failed to decrypt DB access token, tentando env var fallback');
      }
    }

    // 2. Fallback: env var (single-tenant / dev)
    if (!accessToken && env.MESSENGER_PAGE_ACCESS_TOKEN) {
      accessToken = env.MESSENGER_PAGE_ACCESS_TOKEN;
      logger.info({ tenantId }, '[MESSENGER SEND] Usando MESSENGER_PAGE_ACCESS_TOKEN env var (fallback)');
    }

    if (!accessToken) {
      throw new BadRequestError('Tenant não tem Messenger configurado (sem token no DB nem env var)');
    }

    const instance = axios.create({
      baseURL: GRAPH_API_BASE,
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    addRetryInterceptor(instance, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 15000,
      logPrefix: 'Messenger',
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

      const result = {
        externalMessageId: response.data.message_id || '',
        success: true,
      };

      logger.info(
        { tenantId, to, externalMessageId: result.externalMessageId, textPreview: text.substring(0, 80) },
        '[MESSENGER SEND] sendText OK'
      );

      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.error({ tenantId, to, error: msg, textPreview: text.substring(0, 80) }, '[MESSENGER SEND] sendText FAILED');
      throw new InternalServerError(`Falha ao enviar mensagem Messenger: ${msg}`);
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

      const result = {
        externalMessageId: response.data.message_id || '',
        success: true,
      };

      logger.info(
        { tenantId, to, mediaType: messengerType, hasCaption: !!media.caption, externalMessageId: result.externalMessageId },
        '[MESSENGER SEND] sendMedia OK'
      );

      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.error({ tenantId, to, mediaType: media.type, error: msg }, '[MESSENGER SEND] sendMedia FAILED');
      throw new InternalServerError(`Falha ao enviar mídia Messenger: ${msg}`);
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
              buttons: buttons.map((btn) =>
                btn.url
                  ? { type: 'web_url', title: btn.title.substring(0, 20), url: btn.url }
                  : { type: 'postback', title: btn.title.substring(0, 20), payload: btn.id }
              ),
            },
          },
        },
      });

      const result = {
        externalMessageId: response.data.message_id || '',
        success: true,
      };

      logger.info(
        { tenantId, to, buttonCount: buttons.length, externalMessageId: result.externalMessageId },
        '[MESSENGER SEND] sendButtons OK'
      );

      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.error({ tenantId, to, buttonCount: buttons.length, error: msg }, '[MESSENGER SEND] sendButtons FAILED');
      throw new InternalServerError(`Falha ao enviar botões Messenger: ${msg}`);
    }
  }

  async sendQuickReplies(
    tenantId: string,
    to: string,
    text: string,
    quickReplies: QuickReplyPayload[]
  ): Promise<SendResult> {
    const api = await this.getAxiosForTenant(tenantId);

    try {
      const response = await api.post('/me/messages', {
        recipient: { id: to },
        message: {
          text,
          quick_replies: quickReplies.map((qr) => ({
            content_type: 'text',
            title: qr.title.substring(0, 20),
            payload: qr.payload,
          })),
        },
      });

      const result = {
        externalMessageId: response.data.message_id || '',
        success: true,
      };

      logger.info(
        { tenantId, to, quickReplyCount: quickReplies.length, externalMessageId: result.externalMessageId },
        '[MESSENGER SEND] sendQuickReplies OK'
      );

      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.error({ tenantId, to, quickReplyCount: quickReplies.length, error: msg }, '[MESSENGER SEND] sendQuickReplies FAILED');
      throw new InternalServerError(`Falha ao enviar Quick Replies Messenger: ${msg}`);
    }
  }

  /**
   * Envia Generic Template (cards com imagem, titulo e botoes)
   * Ideal para carousel degradado
   */
  async sendGenericTemplate(
    tenantId: string,
    to: string,
    elements: Array<{
      title: string;
      subtitle?: string;
      imageUrl?: string;
      buttons?: ButtonPayload[];
    }>
  ): Promise<SendResult> {
    const api = await this.getAxiosForTenant(tenantId);

    try {
      const response = await api.post('/me/messages', {
        recipient: { id: to },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: elements.slice(0, 10).map((el) => ({
                title: el.title.substring(0, 80),
                subtitle: el.subtitle?.substring(0, 80),
                image_url: el.imageUrl,
                buttons: el.buttons?.slice(0, 3).map((btn) =>
                  btn.url
                    ? { type: 'web_url', title: btn.title.substring(0, 20), url: btn.url }
                    : { type: 'postback', title: btn.title.substring(0, 20), payload: btn.id }
                ),
              })),
            },
          },
        },
      });

      const result = {
        externalMessageId: response.data.message_id || '',
        success: true,
      };

      logger.info(
        { tenantId, to, elementCount: elements.length, externalMessageId: result.externalMessageId },
        '[MESSENGER SEND] sendGenericTemplate OK'
      );

      return result;
    } catch (error: any) {
      const msg = error?.message || 'Unknown';
      const responseData = error?.response?.data;
      logger.error(
        { tenantId, to, elementCount: elements.length, error: msg, responseData },
        '[MESSENGER SEND] sendGenericTemplate FAILED'
      );
      throw new InternalServerError(`Falha ao enviar Generic Template Messenger: ${msg}`);
    }
  }
}

export const messengerAdapter = new MessengerAdapter();
