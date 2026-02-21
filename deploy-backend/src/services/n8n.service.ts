import axios from 'axios';
import { prisma } from '@/config/database';
import logger from '@/config/logger';

// Cache de tenant para evitar query ao banco a cada mensagem
const tenantN8nCache = new Map<string, { slug: string; url: string; fetchedAt: number }>();
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Payload enviado para o webhook do N8N
 * Formato compatível com Z-API para facilitar migração
 */
export interface N8NWebhookPayload {
  // Identificador do contato: telefone (WhatsApp) ou PSID (Messenger/Instagram)
  phone: string;

  // Telefone real do contato (quando disponivel). Para WhatsApp = phone, para Messenger/IG = phoneNumber do Contact
  contactPhone?: string;

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
  /** Limpa cache de tenant (usado em testes) */
  clearTenantCache(): void {
    tenantN8nCache.clear();
  }

  /**
   * Envia mensagem recebida para o webhook do N8N
   */
  async forwardToN8N(
    tenantId: string,
    payload: N8NWebhookPayload
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Buscar URL unica do webhook (com cache em memoria)
      const cached = tenantN8nCache.get(tenantId);
      let tenantSlug: string;
      let webhookUrl: string;

      if (cached && Date.now() - cached.fetchedAt < TENANT_CACHE_TTL_MS) {
        tenantSlug = cached.slug;
        webhookUrl = cached.url;
      } else {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { slug: true, n8nWebhookUrl: true },
        });

        if (!tenant) {
          logger.warn({ tenantId }, 'N8N: Tenant not found');
          return { success: false, error: 'Tenant not found' };
        }

        if (!tenant.n8nWebhookUrl) {
          logger.debug({ tenantId, channel: payload.channel }, 'N8N: No webhook URL configured');
          return { success: false, error: 'No webhook URL configured' };
        }

        tenantSlug = tenant.slug;
        webhookUrl = tenant.n8nWebhookUrl;
        tenantN8nCache.set(tenantId, { slug: tenantSlug, url: webhookUrl, fetchedAt: Date.now() });
      }

      logger.info({
        tenantId,
        channel: payload.channel || 'whatsapp',
      }, 'N8N: Forwarding to unified webhook');

      // Enviar para N8N (webhook unico para todos os canais)
      const response = await axios.post(webhookUrl, {
        body: payload,
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info({
        tenantId,
        tenantSlug,
        phone: payload.phone,
        messageId: payload.messageId,
        channel: payload.channel || 'whatsapp',
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
    channel: 'whatsapp' | 'messenger' | 'instagram' = 'whatsapp',
    contactPhone?: string | null
  ): N8NWebhookPayload {
    const basePayload: N8NWebhookPayload = {
      phone: phoneNumber,
      contactPhone: contactPhone || undefined,
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
          basePayload.type = 'button_reply';
          basePayload.buttonReply = {
            id: message.metadata.button.id,
            title: message.metadata.button.title,
          };
          basePayload.buttonResponseMessage = {
            selectedButtonId: message.metadata.button.id,
            selectedButtonText: message.metadata.button.title,
          };
          // Normalizar: popular listResponseMessage tambem para que o N8N
          // encontre selectedRowId independente do canal (Messenger envia quick reply
          // onde WhatsApp envia list reply)
          basePayload.listResponseMessage = {
            selectedRowId: message.metadata.button.id,
            title: message.metadata.button.title,
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
          // Normalizar: popular buttonReply/buttonResponseMessage tambem
          basePayload.buttonReply = {
            id: message.metadata.list.id,
            title: message.metadata.list.title,
          };
          basePayload.buttonResponseMessage = {
            selectedButtonId: message.metadata.list.id,
            selectedButtonText: message.metadata.list.title,
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
