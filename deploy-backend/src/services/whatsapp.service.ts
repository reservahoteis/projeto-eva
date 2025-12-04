import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import logger from '@/config/logger';
import { decrypt } from '@/utils/encryption';
import { processImageForWhatsApp, uploadImageToWhatsApp } from '@/utils/image-processor';

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

    // Descriptografar access token
    let accessToken: string;
    try {
      accessToken = decrypt(tenant.whatsappAccessToken);
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to decrypt WhatsApp access token');
      throw new BadRequestError('Configuração WhatsApp inválida');
    }

    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Obter URL da mídia do WhatsApp
   * A URL é temporária e requer auth header para download
   */
  async getMediaUrl(tenantId: string, mediaId: string): Promise<string | null> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      // Chamar API do WhatsApp para obter URL da mídia
      const response = await axiosInstance.get(`/${mediaId}`);

      if (response.data?.url) {
        logger.info({ tenantId, mediaId }, 'Media URL retrieved');
        return response.data.url;
      }

      return null;
    } catch (error: any) {
      logger.error({ error, tenantId, mediaId }, 'Failed to get media URL');
      return null;
    }
  }

  /**
   * Baixar mídia e retornar como base64 data URL
   * Útil para mídias que precisam ser exibidas diretamente
   */
  async downloadMediaAsDataUrl(tenantId: string, mediaId: string, mimeType: string): Promise<string | null> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      // 1. Obter URL da mídia
      const mediaResponse = await axiosInstance.get(`/${mediaId}`);
      const mediaUrl = mediaResponse.data?.url;

      if (!mediaUrl) {
        logger.warn({ tenantId, mediaId }, 'No media URL found');
        return null;
      }

      // 2. Baixar a mídia (a URL requer o mesmo token de auth)
      const downloadResponse = await axiosInstance.get(mediaUrl, {
        responseType: 'arraybuffer',
      });

      // 3. Converter para base64
      const base64 = Buffer.from(downloadResponse.data).toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      logger.info({ tenantId, mediaId, size: downloadResponse.data.length }, 'Media downloaded as data URL');
      return dataUrl;
    } catch (error: any) {
      logger.error({ error, tenantId, mediaId }, 'Failed to download media as data URL');
      return null;
    }
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
   * Buscar foto de perfil do contato no WhatsApp
   * @param tenantId - ID do tenant
   * @param phoneNumber - Número do contato (formato: 5511999999999)
   * @returns URL da foto de perfil ou null se não disponível
   */
  async getProfilePicture(tenantId: string, phoneNumber: string): Promise<string | null> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      // A API do WhatsApp Business usa o endpoint /{phone_number_id}/contacts
      // para buscar informações do contato, incluindo a foto de perfil
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        return null;
      }

      // Buscar foto de perfil via API do WhatsApp
      // Endpoint: GET /{phone-number-id}/contacts/{contact-phone}
      const response = await axiosInstance.get(
        `/${tenant.whatsappPhoneNumberId}`,
        {
          params: {
            fields: 'profile_picture_url',
          },
        }
      );

      // A foto pode estar no campo profile_picture_url
      if (response.data?.profile_picture_url) {
        return response.data.profile_picture_url;
      }

      // Tentar via endpoint alternativo - buscar diretamente pelo número do contato
      // Documentação da Meta: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/contacts
      try {
        const contactResponse = await axiosInstance.post(
          `/${tenant.whatsappPhoneNumberId}/contacts`,
          {
            blocking: 'wait',
            contacts: [phoneNumber],
            force_check: true,
          }
        );

        // Buscar a URL da foto do contato
        const contacts = contactResponse.data?.contacts;
        if (contacts && contacts.length > 0 && contacts[0].profile?.photo) {
          return contacts[0].profile.photo;
        }
      } catch (contactError) {
        // Se o endpoint de contacts não funcionar, tentar o endpoint de perfil
        logger.debug({ tenantId, phoneNumber, error: contactError }, 'Contacts endpoint not available');
      }

      return null;
    } catch (error: any) {
      // Não é crítico - apenas logar e retornar null
      logger.debug(
        { error: error.message, tenantId, phoneNumber },
        'Could not fetch profile picture'
      );
      return null;
    }
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

  /**
   * Enviar mensagem carousel (múltiplos cards com imagem e botões)
   * Usa o formato de template da Meta Cloud API
   *
   * Nota: Carousel na API oficial do WhatsApp requer um template aprovado
   * ou usa múltiplas mensagens interativas sequenciais
   */
  async sendCarousel(
    tenantId: string,
    to: string,
    bodyText: string,
    cards: Array<{
      text: string;
      image?: string;
      buttons: Array<{
        id: string;
        label: string;
        type?: 'reply' | 'url';
        url?: string;
      }>;
    }>
  ): Promise<SendMessageResult[]> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);
      const results: SendMessageResult[] = [];

      // Enviar texto introdutório se fornecido
      if (bodyText) {
        const textResponse = await axiosInstance.post(
          `/${tenant.whatsappPhoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: 'text',
            text: {
              preview_url: false,
              body: bodyText,
            },
          }
        );

        results.push({
          whatsappMessageId: textResponse.data.messages[0]?.id,
          success: true,
        });
      }

      // Enviar cada card como mensagem interativa separada
      for (const card of cards) {
        const payload: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: card.text,
            },
            action: {
              buttons: card.buttons.slice(0, 3).map((btn) => {
                if (btn.type === 'url' && btn.url) {
                  // Botão de URL não é suportado em interactive buttons
                  // Converter para reply e adicionar URL no texto
                  return {
                    type: 'reply',
                    reply: {
                      id: btn.id,
                      title: btn.label.substring(0, 20),
                    },
                  };
                }
                return {
                  type: 'reply',
                  reply: {
                    id: btn.id,
                    title: btn.label.substring(0, 20),
                  },
                };
              }),
            },
          },
        };

        // Adicionar imagem como header se fornecida
        if (card.image) {
          payload.interactive.header = {
            type: 'image',
            image: {
              link: card.image,
            },
          };
        }

        const response = await axiosInstance.post(
          `/${tenant.whatsappPhoneNumberId}/messages`,
          payload
        );

        results.push({
          whatsappMessageId: response.data.messages[0]?.id,
          success: true,
        });

        // Pequeno delay entre mensagens para evitar rate limit
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      logger.info({ tenantId, to, cardsCount: cards.length }, 'Carousel messages sent');

      return results;
    } catch (error: any) {
      logger.error({ error, tenantId, to }, 'Failed to send carousel');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Enviar carousel usando template aprovado da Meta
   * Templates de carousel têm conteúdo fixo - só os payloads dos botões são dinâmicos
   *
   * @param tenantId - ID do tenant
   * @param to - Número do destinatário
   * @param templateName - Nome do template aprovado (ex: 'carousel_quartos_geral')
   * @param cards - Array de cards com payloads dos botões
   */
  async sendCarouselTemplate(
    tenantId: string,
    to: string,
    templateName: string,
    cards: Array<{
      imageUrl?: string; // Opcional - usado se template aceita imagem dinâmica
      bodyParams?: string[]; // Opcional - usado se template tem variáveis {{1}}, {{2}}
      buttonPayloads: string[]; // Payloads para cada botão quick_reply do card
    }>
  ): Promise<SendMessageResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneNumberId: true,
          whatsappAccessToken: true,
        },
      });

      if (!tenant?.whatsappPhoneNumberId || !tenant?.whatsappAccessToken) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      // Limitar a 10 cards (máximo do carousel)
      if (cards.length > 10) {
        throw new BadRequestError('Máximo de 10 cards no carousel');
      }

      // Descriptografar access token para upload de mídia
      let accessToken: string;
      try {
        accessToken = decrypt(tenant.whatsappAccessToken);
      } catch (error) {
        logger.error({ tenantId, error }, 'Failed to decrypt WhatsApp access token');
        throw new BadRequestError('Configuração WhatsApp inválida');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      // Processar imagens dos cards (redimensionar se necessário e fazer upload)
      logger.info({ tenantId, cardsCount: cards.length }, 'Processing carousel images...');

      const processedCards = await Promise.all(
        cards.map(async (card, index) => {
          if (!card.imageUrl) {
            return { ...card, mediaId: undefined };
          }

          try {
            // Processar imagem (redimensionar se necessário)
            const processedImage = await processImageForWhatsApp(card.imageUrl);

            if (!processedImage) {
              logger.warn({ imageUrl: card.imageUrl, cardIndex: index }, 'Failed to process image, using original URL');
              return { ...card, mediaId: undefined };
            }

            // Fazer upload da imagem processada para WhatsApp Media API
            const mediaId = await uploadImageToWhatsApp(
              processedImage.buffer,
              accessToken,
              tenant.whatsappPhoneNumberId!
            );

            if (mediaId) {
              logger.info({
                cardIndex: index,
                originalUrl: card.imageUrl,
                processedSize: processedImage.size,
                mediaId,
              }, 'Image processed and uploaded successfully');
              return { ...card, mediaId };
            }

            logger.warn({ imageUrl: card.imageUrl, cardIndex: index }, 'Failed to upload image, using original URL');
            return { ...card, mediaId: undefined };
          } catch (error: any) {
            logger.error({ error: error.message, imageUrl: card.imageUrl, cardIndex: index }, 'Error processing image');
            return { ...card, mediaId: undefined };
          }
        })
      );

      // Construir componentes do carousel
      // IMPORTANTE: Templates de carousel SEMPRE precisam de header image params
      const carouselCards = processedCards.map((card, index) => {
        const components: any[] = [];

        // Header com imagem - OBRIGATÓRIO para carousel templates
        // Usar mediaId se disponível (imagem processada), senão usar URL original
        if (card.mediaId) {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  id: card.mediaId,
                },
              },
            ],
          });
        } else if (card.imageUrl) {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: {
                  link: card.imageUrl,
                },
              },
            ],
          });
        }

        // Body params (se template tem variáveis)
        if (card.bodyParams && card.bodyParams.length > 0) {
          components.push({
            type: 'body',
            parameters: card.bodyParams.map((param) => ({
              type: 'text',
              text: param,
            })),
          });
        }

        // Botões quick_reply - cada um precisa de um payload
        card.buttonPayloads.forEach((payload, btnIndex) => {
          components.push({
            type: 'button',
            sub_type: 'quick_reply',
            index: btnIndex,
            parameters: [
              {
                type: 'payload',
                payload: payload,
              },
            ],
          });
        });

        return {
          card_index: index,
          components,
        };
      });

      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'pt_BR',
          },
          components: [
            {
              type: 'carousel',
              cards: carouselCards,
            },
          ],
        },
      };

      logger.debug({ payload: JSON.stringify(payload) }, 'Sending carousel template');

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      logger.info(
        { tenantId, to, templateName, cardsCount: cards.length, whatsappMessageId },
        'Carousel template sent'
      );

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error: any) {
      logger.error({ error: error.response?.data || error, tenantId, to, templateName }, 'Failed to send carousel template');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp: ${errorMessage}`);
      }

      throw error;
    }
  }
}

export const whatsAppService = new WhatsAppService();
