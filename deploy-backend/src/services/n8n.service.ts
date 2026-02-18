import axios from 'axios';
import { prisma } from '@/config/database';
import logger from '@/config/logger';

/**
 * Payload enviado para o webhook do N8N
 * Formato compatível com Z-API para facilitar migração
 */
export interface N8NWebhookPayload {
  // Dados do telefone
  phone: string;

  // Tipo da mensagem
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker' | 'button' | 'list' | 'button_reply';

  // Conteúdo da mensagem
  text?: {
    message: string;
  };

  // Mídia (se aplicável)
  image?: { url?: string; caption?: string };
  video?: { url?: string; caption?: string };
  audio?: { url?: string };
  document?: { url?: string; filename?: string; caption?: string };

  // Localização (se aplicável)
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };

  // Resposta de botão/lista (se aplicável)
  buttonResponseMessage?: {
    selectedButtonId: string;
    selectedButtonText: string;
  };
  listResponseMessage?: {
    selectedRowId: string;
    title: string;
    description?: string;
  };
  // Resposta de Quick Reply de carousel template
  buttonReply?: {
    id: string;
    title: string;
  };

  // Metadados adicionais
  messageId: string;
  timestamp: number;
  contactName?: string;
  conversationId: string;

  // Dados da conversa para contexto
  isNewConversation: boolean;

  // Canal de origem (para N8N saber de onde veio)
  channel?: 'whatsapp' | 'messenger' | 'instagram';
}

/**
 * Serviço para integração com N8N
 */
class N8NService {
  /**
   * Envia mensagem recebida para o webhook do N8N
   */
  async forwardToN8N(
    tenantId: string,
    payload: N8NWebhookPayload
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Buscar URLs do webhook do tenant (por canal)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          slug: true,
          n8nWebhookUrl: true,
          n8nWebhookUrlMessenger: true,
          n8nWebhookUrlInstagram: true,
        },
      });

      if (!tenant) {
        logger.warn({ tenantId }, 'N8N: Tenant not found');
        return { success: false, error: 'Tenant not found' };
      }

      // Rotear para URL especifica do canal (com fallback para URL padrao)
      let webhookUrl: string | null = null;
      let urlSource = 'default';

      if (payload.channel === 'messenger' && tenant.n8nWebhookUrlMessenger) {
        webhookUrl = tenant.n8nWebhookUrlMessenger;
        urlSource = 'messenger';
      } else if (payload.channel === 'instagram' && tenant.n8nWebhookUrlInstagram) {
        webhookUrl = tenant.n8nWebhookUrlInstagram;
        urlSource = 'instagram';
      } else if (tenant.n8nWebhookUrl) {
        webhookUrl = tenant.n8nWebhookUrl;
        urlSource = payload.channel && payload.channel !== 'whatsapp' ? 'default (fallback)' : 'default';
      }

      if (!webhookUrl) {
        logger.debug({ tenantId, tenantSlug: tenant.slug, channel: payload.channel }, 'N8N: No webhook URL configured');
        return { success: false, error: 'No webhook URL configured' };
      }

      logger.info({
        tenantId,
        channel: payload.channel || 'whatsapp',
        urlSource,
        webhookUrl: webhookUrl.substring(0, 60) + '...',
      }, 'N8N: Roteando para webhook por canal');

      // Enviar para N8N
      const response = await axios.post(webhookUrl, {
        body: payload,
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info({
        tenantId,
        tenantSlug: tenant.slug,
        phone: payload.phone,
        messageId: payload.messageId,
        channel: payload.channel || 'whatsapp',
        urlSource,
        n8nStatus: response.status,
      }, 'N8N: Message forwarded successfully');

      return { success: true };
    } catch (error: any) {
      logger.error({
        tenantId,
        phone: payload.phone,
        messageId: payload.messageId,
        channel: payload.channel || 'whatsapp',
        error: error.message,
        response: error.response?.data,
      }, 'N8N: Failed to forward message');

      return { success: false, error: error.message };
    }
  }

  /**
   * Converte dados da mensagem do banco para formato N8N
   */
  buildPayload(
    phoneNumber: string,
    message: {
      id: string;
      type: string;
      content: string;
      metadata: any;
      timestamp: Date;
    },
    conversationId: string,
    contactName: string | null,
    isNewConversation: boolean,
    channel: 'whatsapp' | 'messenger' | 'instagram' = 'whatsapp'
  ): N8NWebhookPayload {
    const basePayload: N8NWebhookPayload = {
      phone: phoneNumber,
      type: 'text',
      messageId: message.id,
      timestamp: Math.floor(message.timestamp.getTime() / 1000),
      contactName: contactName || undefined,
      conversationId,
      isNewConversation,
      channel,
    };

    // Mapear tipo de mensagem
    switch (message.type) {
      case 'TEXT':
        basePayload.type = 'text';
        basePayload.text = { message: message.content };

        // Verificar se é resposta de botão (Quick Reply de carousel ou botão interativo)
        if (message.metadata?.button) {
          // Usar button_reply para Quick Reply de carousel template
          basePayload.type = 'button_reply';
          basePayload.buttonReply = {
            id: message.metadata.button.id,
            title: message.metadata.button.title,
          };
          // Manter compatibilidade com formato antigo
          basePayload.buttonResponseMessage = {
            selectedButtonId: message.metadata.button.id,
            selectedButtonText: message.metadata.button.title,
          };
        }

        // Verificar se é resposta de lista
        if (message.metadata?.list) {
          basePayload.type = 'list';
          basePayload.listResponseMessage = {
            selectedRowId: message.metadata.list.id,
            title: message.metadata.list.title,
            description: message.metadata.list.description,
          };
        }
        break;

      case 'IMAGE':
        basePayload.type = message.metadata?.isSticker ? 'sticker' : 'image';
        basePayload.image = {
          url: message.metadata?.mediaUrl,
          caption: message.metadata?.caption,
        };
        break;

      case 'VIDEO':
        basePayload.type = 'video';
        basePayload.video = {
          url: message.metadata?.mediaUrl,
          caption: message.metadata?.caption,
        };
        break;

      case 'AUDIO':
        basePayload.type = 'audio';
        basePayload.audio = {
          url: message.metadata?.mediaUrl,
        };
        break;

      case 'DOCUMENT':
        basePayload.type = 'document';
        basePayload.document = {
          url: message.metadata?.mediaUrl,
          filename: message.metadata?.filename,
          caption: message.metadata?.caption,
        };
        break;

      case 'LOCATION':
        basePayload.type = 'location';
        try {
          const coords = JSON.parse(message.content);
          basePayload.location = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            name: message.metadata?.name,
            address: message.metadata?.address,
          };
        } catch {
          basePayload.type = 'text';
          basePayload.text = { message: message.content };
        }
        break;

      default:
        basePayload.type = 'text';
        basePayload.text = { message: message.content };
    }

    return basePayload;
  }
}

export const n8nService = new N8NService();
