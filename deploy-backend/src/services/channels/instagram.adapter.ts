// ============================================
// Instagram Channel Adapter
// Instagram Messaging API via Graph API v21.0
// ============================================

import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import { decrypt } from '@/utils/encryption';
import logger from '@/config/logger';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
  QuickReplyPayload,
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

    let accessToken: string | undefined;

    // 1. Tentar config do DB (multi-tenant)
    if (tenant?.instagramAccountId && tenant?.instagramAccessToken) {
      try {
        accessToken = decrypt(tenant.instagramAccessToken);
      } catch {
        logger.error({ tenantId }, '[INSTAGRAM SEND] Failed to decrypt DB access token, tentando env var fallback');
      }
    }

    // 2. Fallback: env var (single-tenant / dev)
    if (!accessToken && env.INSTAGRAM_ACCESS_TOKEN) {
      accessToken = env.INSTAGRAM_ACCESS_TOKEN;
      logger.info({ tenantId }, '[INSTAGRAM SEND] Usando INSTAGRAM_ACCESS_TOKEN env var (fallback)');
    }

    if (!accessToken) {
      throw new BadRequestError('Tenant não tem Instagram configurado (sem token no DB nem env var)');
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

      const result = {
        externalMessageId: response.data.message_id || '',
        success: true,
      };

      logger.info(
        { tenantId, to, externalMessageId: result.externalMessageId, textPreview: text.substring(0, 80) },
        '[INSTAGRAM SEND] sendText OK'
      );

      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.error({ tenantId, to, error: msg, textPreview: text.substring(0, 80) }, '[INSTAGRAM SEND] sendText FAILED');
      throw new InternalServerError(`Falha ao enviar mensagem Instagram: ${msg}`);
    }
  }

  async sendMedia(tenantId: string, to: string, media: MediaPayload): Promise<SendResult> {
    // Instagram suporta imagem nativamente; video/audio/document degradam para texto+link
    if (media.type !== 'image') {
      logger.info(
        { tenantId, to, mediaType: media.type, degradedTo: 'text+link' },
        '[INSTAGRAM SEND] sendMedia degradando para texto (tipo nao suportado)'
      );
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

      const result = {
        externalMessageId: response.data.message_id || '',
        success: true,
      };

      logger.info(
        { tenantId, to, mediaType: 'image', hasCaption: !!media.caption, externalMessageId: result.externalMessageId },
        '[INSTAGRAM SEND] sendMedia OK'
      );

      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.error({ tenantId, to, mediaType: media.type, error: msg }, '[INSTAGRAM SEND] sendMedia FAILED');
      throw new InternalServerError(`Falha ao enviar mídia Instagram: ${msg}`);
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
    logger.info(
      { tenantId, to, buttonCount: buttons.length, degradedTo: 'numbered-text' },
      '[INSTAGRAM SEND] sendButtons degradando para texto numerado'
    );

    const numberedOptions = buttons
      .map((btn, i) => `${i + 1}. ${btn.title}`)
      .join('\n');

    const text = `${bodyText}\n\n${numberedOptions}`;
    return this.sendText(tenantId, to, text);
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
        '[INSTAGRAM SEND] sendQuickReplies OK'
      );

      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown';
      logger.error({ tenantId, to, quickReplyCount: quickReplies.length, error: msg }, '[INSTAGRAM SEND] sendQuickReplies FAILED');
      throw new InternalServerError(`Falha ao enviar Quick Replies Instagram: ${msg}`);
    }
  }

  // Instagram NAO suporta listas, templates ou markAsRead
}

export const instagramAdapter = new InstagramAdapter();
