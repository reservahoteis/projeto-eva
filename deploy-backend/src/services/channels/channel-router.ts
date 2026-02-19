// ============================================
// Channel Router
// Roteia mensagens para o adapter correto
// com degradacao automatica para canais limitados
// ============================================

import logger from '@/config/logger';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
  ListSection,
  QuickReplyPayload,
} from './channel-send.interface';
import { whatsappAdapter } from './whatsapp.adapter';
import { messengerAdapter } from './messenger.adapter';
import { instagramAdapter } from './instagram.adapter';

type Channel = 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM';

export class ChannelRouter {
  private adapters: Record<Channel, ChannelSendAdapter> = {
    WHATSAPP: whatsappAdapter,
    MESSENGER: messengerAdapter,
    INSTAGRAM: instagramAdapter,
  };

  getAdapter(channel: Channel): ChannelSendAdapter {
    return this.adapters[channel];
  }

  async sendText(channel: Channel, tenantId: string, to: string, text: string): Promise<SendResult> {
    const adapter = this.getAdapter(channel);
    return adapter.sendText(tenantId, to, text);
  }

  async sendMedia(channel: Channel, tenantId: string, to: string, media: MediaPayload): Promise<SendResult> {
    const adapter = this.getAdapter(channel);
    return adapter.sendMedia(tenantId, to, media);
  }

  async sendButtons(
    channel: Channel,
    tenantId: string,
    to: string,
    bodyText: string,
    buttons: ButtonPayload[],
    headerText?: string,
    footerText?: string
  ): Promise<SendResult> {
    const adapter = this.getAdapter(channel);
    return adapter.sendButtons(tenantId, to, bodyText, buttons, headerText, footerText);
  }

  /**
   * Envia Quick Replies com degradacao:
   * - Messenger/Instagram: Quick Replies nativos
   * - WhatsApp: degradar para botoes interativos (max 3)
   */
  async sendQuickReplies(
    channel: Channel,
    tenantId: string,
    to: string,
    text: string,
    quickReplies: QuickReplyPayload[]
  ): Promise<SendResult> {
    const adapter = this.getAdapter(channel);

    // Se o adapter suporta Quick Replies nativos (Messenger/Instagram)
    if (adapter.sendQuickReplies) {
      return adapter.sendQuickReplies(tenantId, to, text, quickReplies);
    }

    // WhatsApp: degradar para botoes interativos (max 3)
    if (channel === 'WHATSAPP') {
      const buttons: ButtonPayload[] = quickReplies.slice(0, 3).map((qr) => ({
        id: qr.payload,
        title: qr.title.substring(0, 20),
      }));

      logger.info({ channel, tenantId, originalReplies: quickReplies.length, degradedButtons: buttons.length }, 'Quick Replies degraded to buttons for WhatsApp');
      return adapter.sendButtons(tenantId, to, text, buttons);
    }

    // Fallback: texto numerado
    const numberedItems = quickReplies.map((qr, i) => `${i + 1}. ${qr.title}`);
    const fullText = `${text}\n\n${numberedItems.join('\n')}`;
    logger.info({ channel, tenantId }, 'Quick Replies degraded to numbered text');
    return adapter.sendText(tenantId, to, fullText);
  }

  /**
   * Envia lista interativa com degradacao:
   * - WhatsApp: lista nativa
   * - Messenger: generic template (botoes postback por secao)
   * - Instagram: texto numerado
   */
  async sendList(
    channel: Channel,
    tenantId: string,
    to: string,
    bodyText: string,
    buttonText: string,
    sections: ListSection[],
    headerText?: string,
    footerText?: string
  ): Promise<SendResult> {
    const adapter = this.getAdapter(channel);

    // Se o adapter suporta sendList, usar nativo
    if (adapter.sendList) {
      return adapter.sendList(tenantId, to, bodyText, buttonText, sections, headerText, footerText);
    }

    // Degradacao: converter para Quick Replies (Messenger/Instagram) ou texto
    if (channel === 'MESSENGER' || channel === 'INSTAGRAM') {
      const allRows = sections.flatMap((s) => s.rows);

      // Quick Replies suportam ate 13 itens (muito melhor que botoes max 3)
      if (adapter.sendQuickReplies && allRows.length <= 13) {
        const quickReplies: QuickReplyPayload[] = allRows.map((row) => ({
          title: row.title.substring(0, 20),
          payload: row.id,
        }));

        logger.info({ channel, tenantId, originalRows: allRows.length, quickReplies: quickReplies.length }, 'List degraded to Quick Replies');
        return adapter.sendQuickReplies(tenantId, to, bodyText, quickReplies);
      }

      // Fallback: texto numerado (se mais de 13 itens ou sem sendQuickReplies)
      const numberedItems = allRows.map((row, i) =>
        `${i + 1}. ${row.title}${row.description ? ` - ${row.description}` : ''}`
      );
      const text = `${bodyText}\n\n${numberedItems.join('\n')}`;
      logger.info({ channel, tenantId, originalRows: allRows.length }, 'List degraded to numbered text');
      return adapter.sendText(tenantId, to, text);
    }

    // Outros canais: texto numerado
    const numberedItems = sections.flatMap((section) => {
      const items: string[] = [];
      if (section.title) items.push(`*${section.title}*`);
      section.rows.forEach((row, i) => {
        items.push(`${i + 1}. ${row.title}${row.description ? ` - ${row.description}` : ''}`);
      });
      return items;
    });

    const text = `${bodyText}\n\n${numberedItems.join('\n')}`;
    logger.info({ channel, tenantId }, 'List degraded to numbered text');
    return adapter.sendText(tenantId, to, text);
  }

  /**
   * Envia template com degradacao:
   * - WhatsApp: template nativo
   * - Messenger/Instagram: texto simples
   */
  async sendTemplate(
    channel: Channel,
    tenantId: string,
    to: string,
    templateName: string,
    parameters: string[],
    languageCode: string = 'pt_BR'
  ): Promise<SendResult> {
    const adapter = this.getAdapter(channel);

    if (adapter.sendTemplate) {
      return adapter.sendTemplate(tenantId, to, templateName, parameters, languageCode);
    }

    // Degradacao: enviar como texto simples
    const paramText = parameters.length > 0
      ? `\n\nParâmetros: ${parameters.join(', ')}`
      : '';
    const text = `[Template: ${templateName}]${paramText}`;

    logger.info({ channel, tenantId, templateName }, 'Template degraded to text');
    return adapter.sendText(tenantId, to, text);
  }

  /**
   * Marca mensagem como lida (apenas WhatsApp suporta)
   */
  async markAsRead(channel: Channel, tenantId: string, externalMessageId: string): Promise<void> {
    const adapter = this.getAdapter(channel);

    if (adapter.markAsRead) {
      return adapter.markAsRead(tenantId, externalMessageId);
    }

    // Silenciosamente ignorar para canais que nao suportam
    logger.debug({ channel }, 'markAsRead not supported for channel, skipping');
  }
}

export const channelRouter = new ChannelRouter();
