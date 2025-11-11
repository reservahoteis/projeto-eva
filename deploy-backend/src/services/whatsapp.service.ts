import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import logger from '@/config/logger';

interface SendMessageResult {
  whatsappMessageId: string;
  success: boolean;
}

interface WhatsAppMediaMessage {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  caption?: string;
}

export class WhatsAppService {
  private baseUrl = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;

  /**
   * Get Axios instance configurado para um tenant específico
   */
  private async getAxiosForTenant(tenantId: string): Promise<AxiosInstance> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
      },
    });

    if (!tenant?.whatsappPhoneNumberId || !tenant?.whatsappAccessToken) {
      throw new BadRequestError('Tenant não tem WhatsApp configurado');
    }

    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${tenant.whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Enviar mensagem de texto
   */
  async sendTextMessage(
    tenantId: string,
    to: string,
    text: string
  ): Promise<SendMessageResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        }
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      logger.info({ tenantId, to, whatsappMessageId }, 'WhatsApp message sent');

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error: any) {
      logger.error({ error, tenantId, to }, 'Failed to send WhatsApp message');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Enviar mensagem de mídia (imagem, vídeo, etc)
   */
  async sendMediaMessage(
    tenantId: string,
    to: string,
    media: WhatsAppMediaMessage
  ): Promise<SendMessageResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: media.type,
      };

      // Construir payload específico do tipo de mídia
      payload[media.type] = {
        link: media.url,
        ...(media.caption && { caption: media.caption }),
      };

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      logger.info({ tenantId, to, type: media.type, whatsappMessageId }, 'Media message sent');

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error: any) {
      logger.error({ error, tenantId, to, mediaType: media.type }, 'Failed to send media');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Enviar template (mensagens pré-aprovadas)
   */
  async sendTemplate(
    tenantId: string,
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    parameters?: string[]
  ): Promise<SendMessageResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const payload: any = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
        },
      };

      // Adicionar parâmetros se houver
      if (parameters && parameters.length > 0) {
        payload.template.components = [
          {
            type: 'body',
            parameters: parameters.map((param) => ({
              type: 'text',
              text: param,
            })),
          },
        ];
      }

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      logger.info({ tenantId, to, templateName, whatsappMessageId }, 'Template sent');

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error: any) {
      logger.error({ error, tenantId, to, templateName }, 'Failed to send template');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Marcar mensagem como lida
   */
  async markAsRead(tenantId: string, whatsappMessageId: string): Promise<void> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        return; // Silencioso
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      await axiosInstance.post(`/${tenant.whatsappPhoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: whatsappMessageId,
      });

      logger.debug({ tenantId, whatsappMessageId }, 'Message marked as read');
    } catch (error: any) {
      // Não falhar se não conseguir marcar como lido
      logger.error({ error, tenantId, whatsappMessageId }, 'Failed to mark as read');
    }
  }

  /**
   * Baixar mídia do WhatsApp
   */
  async downloadMedia(tenantId: string, mediaId: string): Promise<Buffer> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      // 1. Get media URL
      const mediaResponse = await axiosInstance.get(`/${mediaId}`);
      const mediaUrl = mediaResponse.data.url;

      // 2. Download media
      const downloadResponse = await axiosInstance.get(mediaUrl, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(downloadResponse.data);
    } catch (error: any) {
      logger.error({ error, tenantId, mediaId }, 'Failed to download media');
      throw new InternalServerError('Failed to download media from WhatsApp');
    }
  }

  /**
   * Validar número de telefone WhatsApp
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Formato esperado: 5511999999999 (país + DDD + número)
    const phoneRegex = /^[1-9][0-9]{10,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Enviar mensagem com botões de resposta rápida
   */
  async sendInteractiveButtons(
    tenantId: string,
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<SendMessageResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      // Limitar a 3 botões (regra da Meta)
      if (buttons.length > 3) {
        throw new BadRequestError('Máximo de 3 botões permitidos');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: bodyText,
          },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title.substring(0, 20), // Max 20 caracteres
              },
            })),
          },
        },
      };

      if (headerText) {
        payload.interactive.header = {
          type: 'text',
          text: headerText,
        };
      }

      if (footerText) {
        payload.interactive.footer = {
          text: footerText,
        };
      }

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      logger.info({ tenantId, to, buttons: buttons.length, whatsappMessageId }, 'Interactive buttons sent');

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error: any) {
      logger.error({ error, tenantId, to }, 'Failed to send interactive buttons');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Enviar mensagem com lista de opções (até 10 itens)
   */
  async sendInteractiveList(
    tenantId: string,
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<SendMessageResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: bodyText,
          },
          action: {
            button: buttonText.substring(0, 20), // Max 20 caracteres
            sections: sections.map((section) => ({
              ...(section.title && { title: section.title }),
              rows: section.rows.map((row) => ({
                id: row.id,
                title: row.title.substring(0, 24), // Max 24 caracteres
                ...(row.description && { description: row.description.substring(0, 72) }),
              })),
            })),
          },
        },
      };

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      logger.info({ tenantId, to, whatsappMessageId }, 'Interactive list sent');

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error: any) {
      logger.error({ error, tenantId, to }, 'Failed to send interactive list');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp: ${errorMessage}`);
      }

      throw error;
    }
  }
}

export const whatsAppService = new WhatsAppService();
