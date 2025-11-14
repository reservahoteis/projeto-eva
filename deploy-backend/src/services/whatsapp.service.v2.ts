import axios, { AxiosInstance, AxiosError } from 'axios';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import logger from '@/config/logger';
import { validateMediaUrl } from '@/utils/url-validator';

// ============================================
// Types & Interfaces
// ============================================

export interface SendMessageResult {
  whatsappMessageId: string;
  success: boolean;
}

export interface WhatsAppMediaMessage {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  caption?: string;
  filename?: string; // Para documentos
}

export interface WhatsAppButton {
  id: string;
  title: string; // Max 20 chars
}

export interface WhatsAppListSection {
  title?: string; // Max 24 chars
  rows: Array<{
    id: string;
    title: string; // Max 24 chars
    description?: string; // Max 72 chars
  }>;
}

// ============================================
// WhatsApp API Error Codes
// ============================================

export enum WhatsAppErrorCode {
  // Rate Limiting
  RATE_LIMIT_HIT = 80007,
  TOO_MANY_MESSAGES = 131048,

  // Message Errors
  RECIPIENT_CANNOT_BE_SENDER = 131031,
  MESSAGE_UNDELIVERABLE = 131026,
  RE_ENGAGEMENT_MESSAGE = 131047,
  UNSUPPORTED_MESSAGE_TYPE = 131051,
  MEDIA_DOWNLOAD_ERROR = 131052,
  MEDIA_UPLOAD_ERROR = 131053,

  // Template Errors
  TEMPLATE_DOES_NOT_EXIST = 133015,
  TEMPLATE_PAUSED = 133016,
  TEMPLATE_DISABLED = 133017,
  TEMPLATE_PARAM_COUNT_MISMATCH = 132000,
  TEMPLATE_PARAM_FORMAT_MISMATCH = 132001,

  // Access Errors
  ACCESS_DENIED = 100,
  INVALID_PARAMETER = 100,
  INVALID_OAUTH_TOKEN = 190,

  // Phone Number Errors
  PHONE_NUMBER_NOT_WHATSAPP = 131031,
  PHONE_NUMBER_NOT_REGISTERED = 131016,
  INVALID_PHONE_NUMBER = 131009,
}

export class WhatsAppApiError extends Error {
  constructor(
    public code: number,
    public title: string,
    public details: string,
    public isRetryable: boolean = false
  ) {
    super(`WhatsApp API Error ${code}: ${title} - ${details}`);
    this.name = 'WhatsAppApiError';
  }
}

// ============================================
// WhatsApp Service V2
// ============================================

export class WhatsAppServiceV2 {
  private baseUrl = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;

  // Cache de Axios instances por tenant (evita criar sempre)
  private axiosCache = new Map<string, { instance: AxiosInstance; expiresAt: number }>();
  private cacheExpiration = 5 * 60 * 1000; // 5 minutos

  /**
   * Get Axios instance configurado para um tenant específico
   * Com cache de 5 minutos
   */
  private async getAxiosForTenant(tenantId: string): Promise<AxiosInstance> {
    // Verificar cache
    const cached = this.axiosCache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.instance;
    }

    // Buscar credenciais do tenant
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

    // Criar nova instância
    const instance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${tenant.whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 segundos
    });

    // Interceptor para logging
    instance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleWhatsAppError(error);
        return Promise.reject(error);
      }
    );

    // Cachear
    this.axiosCache.set(tenantId, {
      instance,
      expiresAt: Date.now() + this.cacheExpiration,
    });

    return instance;
  }

  /**
   * Handle WhatsApp API errors e converter para exceções customizadas
   */
  private handleWhatsAppError(error: AxiosError): never {
    if (!error.response) {
      // Network error
      throw new InternalServerError('Falha na conexão com WhatsApp API');
    }

    const data = error.response.data as any;
    const errorInfo = data?.error;

    if (!errorInfo) {
      throw new InternalServerError('Erro desconhecido da WhatsApp API');
    }

    const code = errorInfo.code;
    const message = errorInfo.message || 'Unknown error';
    const details = errorInfo.error_data?.details || '';

    logger.error(
      {
        code,
        message,
        details,
        fbtrace_id: errorInfo.fbtrace_id,
      },
      'WhatsApp API error'
    );

    // Determinar se erro é retryable
    const isRetryable = this.isErrorRetryable(code);

    throw new WhatsAppApiError(code, message, details, isRetryable);
  }

  /**
   * Determina se um erro deve ser retentado
   */
  private isErrorRetryable(code: number): boolean {
    const retryableCodes = [
      WhatsAppErrorCode.RATE_LIMIT_HIT,
      WhatsAppErrorCode.TOO_MANY_MESSAGES,
      WhatsAppErrorCode.MEDIA_DOWNLOAD_ERROR,
      // Network errors (não é um code, mas tratar separadamente)
    ];

    return retryableCodes.includes(code);
  }

  /**
   * Valida número de telefone WhatsApp seguindo padrão E.164
   *
   * Padrão E.164: [+][código país][número nacional]
   * - Tamanho: 7-15 dígitos (sem o +)
   * - Não pode começar com 0
   * - Apenas dígitos (sem espaços, hífens, parênteses)
   *
   * Exemplos válidos:
   * - Brasil: 5511999999999 (13 dígitos)
   * - EUA: 12025551234 (11 dígitos)
   * - Reino Unido: 442071234567 (12 dígitos)
   * - França: 33612345678 (11 dígitos)
   * - Alemanha: 4915123456789 (13 dígitos)
   * - Índia: 919876543210 (12 dígitos)
   * - China: 8613812345678 (13 dígitos)
   * - Japão: 819012345678 (12 dígitos)
   *
   * @param phoneNumber - Número de telefone (com ou sem formatação)
   * @returns true se número é válido para WhatsApp
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    // Remover espaços, hífens, parênteses, e o símbolo +
    const cleaned = phoneNumber.replace(/[\s\-\(\)\+]/g, '');

    // E.164: 7-15 dígitos, não pode começar com 0
    // Mínimo 7: alguns países insulares têm códigos curtos (ex: +1-242 Bahamas = 10 dígitos total)
    // Máximo 15: limite do padrão E.164
    const phoneRegex = /^[1-9][0-9]{6,14}$/;

    if (!phoneRegex.test(cleaned)) {
      return false;
    }

    // Validações adicionais opcionais
    const length = cleaned.length;

    // Números muito curtos provavelmente inválidos (menos de 8 dígitos total)
    if (length < 8) {
      return false;
    }

    // Números muito longos definitivamente inválidos (mais de 15 é fora do E.164)
    if (length > 15) {
      return false;
    }

    return true;
  }

  /**
   * Formata número de telefone para padrão WhatsApp (apenas dígitos)
   * Remove: espaços, hífens, parênteses, e o símbolo +
   *
   * @param phoneNumber - Número com formatação
   * @returns Número apenas com dígitos
   *
   * @example
   * formatPhoneNumber('+55 (11) 99999-9999') // '5511999999999'
   * formatPhoneNumber('+1 (202) 555-1234')   // '12025551234'
   */
  formatPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  }

  /**
   * Enviar mensagem de texto
   */
  async sendTextMessage(
    tenantId: string,
    to: string,
    text: string,
    options?: {
      previewUrl?: boolean;
    }
  ): Promise<SendMessageResult> {
    try {
      // Validar e formatar número
      const formattedTo = this.formatPhoneNumber(to);
      if (!this.validatePhoneNumber(formattedTo)) {
        throw new BadRequestError(`Número inválido: ${to}`);
      }

      // Validar texto
      if (!text || text.trim().length === 0) {
        throw new BadRequestError('Texto da mensagem não pode ser vazio');
      }

      if (text.length > 4096) {
        throw new BadRequestError('Texto excede limite de 4096 caracteres');
      }

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
          to: formattedTo,
          type: 'text',
          text: {
            preview_url: options?.previewUrl ?? false,
            body: text,
          },
        }
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      if (!whatsappMessageId) {
        throw new InternalServerError('WhatsApp não retornou message ID');
      }

      logger.info(
        {
          tenantId,
          to: formattedTo,
          whatsappMessageId,
          textLength: text.length,
        },
        'Text message sent successfully'
      );

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error) {
      if (error instanceof WhatsAppApiError || error instanceof BadRequestError) {
        throw error;
      }

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
          to,
        },
        'Failed to send text message'
      );

      throw new InternalServerError('Falha ao enviar mensagem de texto');
    }
  }

  /**
   * Enviar mensagem de mídia (imagem, vídeo, áudio, documento)
   */
  async sendMediaMessage(
    tenantId: string,
    to: string,
    media: WhatsAppMediaMessage
  ): Promise<SendMessageResult> {
    try {
      // Validar número
      const formattedTo = this.formatPhoneNumber(to);
      if (!this.validatePhoneNumber(formattedTo)) {
        throw new BadRequestError(`Número inválido: ${to}`);
      }

      // ✅ SEGURANÇA: Validação completa contra SSRF e URLs maliciosas
      validateMediaUrl(media.url, {
        allowAnyHost: false, // Apenas hosts whitelist
        maxLength: 2048,
      });

      // Validar caption (máximo 1024 caracteres)
      if (media.caption && media.caption.length > 1024) {
        throw new BadRequestError('Caption excede limite de 1024 caracteres');
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      // Construir payload baseado no tipo
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: media.type,
      };

      payload[media.type] = {
        link: media.url,
      };

      // Adicionar caption (se houver)
      if (media.caption) {
        payload[media.type].caption = media.caption;
      }

      // Adicionar filename para documentos
      if (media.type === 'document' && media.filename) {
        payload[media.type].filename = media.filename;
      }

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      if (!whatsappMessageId) {
        throw new InternalServerError('WhatsApp não retornou message ID');
      }

      logger.info(
        {
          tenantId,
          to: formattedTo,
          type: media.type,
          whatsappMessageId,
          hasCaption: !!media.caption,
        },
        'Media message sent successfully'
      );

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error) {
      if (error instanceof WhatsAppApiError || error instanceof BadRequestError) {
        throw error;
      }

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
          to,
          mediaType: media.type,
        },
        'Failed to send media message'
      );

      throw new InternalServerError(`Falha ao enviar ${media.type}`);
    }
  }

  /**
   * Enviar template (mensagens pré-aprovadas pela Meta)
   */
  async sendTemplate(
    tenantId: string,
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    parameters?: string[]
  ): Promise<SendMessageResult> {
    try {
      const formattedTo = this.formatPhoneNumber(to);
      if (!this.validatePhoneNumber(formattedTo)) {
        throw new BadRequestError(`Número inválido: ${to}`);
      }

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
        to: formattedTo,
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

      if (!whatsappMessageId) {
        throw new InternalServerError('WhatsApp não retornou message ID');
      }

      logger.info(
        {
          tenantId,
          to: formattedTo,
          templateName,
          whatsappMessageId,
        },
        'Template sent successfully'
      );

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error) {
      if (error instanceof WhatsAppApiError || error instanceof BadRequestError) {
        throw error;
      }

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
          to,
          templateName,
        },
        'Failed to send template'
      );

      throw new InternalServerError('Falha ao enviar template');
    }
  }

  /**
   * Enviar mensagem com botões de resposta rápida (máximo 3 botões)
   */
  async sendInteractiveButtons(
    tenantId: string,
    to: string,
    bodyText: string,
    buttons: WhatsAppButton[],
    headerText?: string,
    footerText?: string
  ): Promise<SendMessageResult> {
    try {
      const formattedTo = this.formatPhoneNumber(to);
      if (!this.validatePhoneNumber(formattedTo)) {
        throw new BadRequestError(`Número inválido: ${to}`);
      }

      // Validações
      if (buttons.length === 0 || buttons.length > 3) {
        throw new BadRequestError('Número de botões deve ser entre 1 e 3');
      }

      if (bodyText.length > 1024) {
        throw new BadRequestError('Body text excede 1024 caracteres');
      }

      // Validar títulos dos botões (max 20 chars cada)
      buttons.forEach((btn, index) => {
        if (btn.title.length > 20) {
          throw new BadRequestError(`Botão ${index + 1}: título excede 20 caracteres`);
        }
      });

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
        to: formattedTo,
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
                title: btn.title.substring(0, 20),
              },
            })),
          },
        },
      };

      if (headerText) {
        payload.interactive.header = {
          type: 'text',
          text: headerText.substring(0, 60), // Max 60 chars
        };
      }

      if (footerText) {
        payload.interactive.footer = {
          text: footerText.substring(0, 60), // Max 60 chars
        };
      }

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      if (!whatsappMessageId) {
        throw new InternalServerError('WhatsApp não retornou message ID');
      }

      logger.info(
        {
          tenantId,
          to: formattedTo,
          buttonCount: buttons.length,
          whatsappMessageId,
        },
        'Interactive buttons sent successfully'
      );

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error) {
      if (error instanceof WhatsAppApiError || error instanceof BadRequestError) {
        throw error;
      }

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
          to,
        },
        'Failed to send interactive buttons'
      );

      throw new InternalServerError('Falha ao enviar botões interativos');
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
    sections: WhatsAppListSection[]
  ): Promise<SendMessageResult> {
    try {
      const formattedTo = this.formatPhoneNumber(to);
      if (!this.validatePhoneNumber(formattedTo)) {
        throw new BadRequestError(`Número inválido: ${to}`);
      }

      // Validações
      if (sections.length === 0 || sections.length > 10) {
        throw new BadRequestError('Número de seções deve ser entre 1 e 10');
      }

      // Contar total de rows
      const totalRows = sections.reduce((acc, section) => acc + section.rows.length, 0);
      if (totalRows > 10) {
        throw new BadRequestError('Total de opções não pode exceder 10');
      }

      if (bodyText.length > 1024) {
        throw new BadRequestError('Body text excede 1024 caracteres');
      }

      if (buttonText.length > 20) {
        throw new BadRequestError('Button text excede 20 caracteres');
      }

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
        to: formattedTo,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: bodyText,
          },
          action: {
            button: buttonText,
            sections: sections.map((section) => ({
              ...(section.title && { title: section.title.substring(0, 24) }),
              rows: section.rows.map((row) => ({
                id: row.id,
                title: row.title.substring(0, 24),
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

      if (!whatsappMessageId) {
        throw new InternalServerError('WhatsApp não retornou message ID');
      }

      logger.info(
        {
          tenantId,
          to: formattedTo,
          sectionCount: sections.length,
          totalRows,
          whatsappMessageId,
        },
        'Interactive list sent successfully'
      );

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error) {
      if (error instanceof WhatsAppApiError || error instanceof BadRequestError) {
        throw error;
      }

      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
          to,
        },
        'Failed to send interactive list'
      );

      throw new InternalServerError('Falha ao enviar lista interativa');
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
        // Silencioso se não configurado
        return;
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      await axiosInstance.post(`/${tenant.whatsappPhoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: whatsappMessageId,
      });

      logger.debug(
        {
          tenantId,
          whatsappMessageId,
        },
        'Message marked as read'
      );
    } catch (error) {
      // Não falhar se não conseguir marcar como lido (não crítico)
      logger.warn(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
          whatsappMessageId,
        },
        'Failed to mark message as read'
      );
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

      if (!mediaUrl) {
        throw new InternalServerError('WhatsApp não retornou URL de mídia');
      }

      // 2. Download media (binary)
      const downloadResponse = await axiosInstance.get(mediaUrl, {
        responseType: 'arraybuffer',
      });

      const buffer = Buffer.from(downloadResponse.data);

      logger.info(
        {
          tenantId,
          mediaId,
          size: buffer.length,
        },
        'Media downloaded successfully'
      );

      return buffer;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          tenantId,
          mediaId,
        },
        'Failed to download media'
      );

      throw new InternalServerError('Falha ao baixar mídia do WhatsApp');
    }
  }

  /**
   * Limpar cache de Axios instances (útil em hot reload)
   */
  clearCache(): void {
    this.axiosCache.clear();
    logger.debug('Axios cache cleared');
  }
}

export const whatsAppServiceV2 = new WhatsAppServiceV2();

// Backward compatibility (export default)
export default whatsAppServiceV2;
