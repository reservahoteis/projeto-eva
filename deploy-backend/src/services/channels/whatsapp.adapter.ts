// ============================================
// WhatsApp Channel Adapter
// Wrapper around existing WhatsAppService
// ============================================

import { whatsAppService } from '@/services/whatsapp.service';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
  ListSection,
} from './channel-send.interface';

export class WhatsAppAdapter implements ChannelSendAdapter {
  readonly channel = 'WHATSAPP' as const;

  async sendText(tenantId: string, to: string, text: string): Promise<SendResult> {
    return whatsAppService.sendTextMessage(tenantId, to, text);
  }

  async sendMedia(tenantId: string, to: string, media: MediaPayload): Promise<SendResult> {
    return whatsAppService.sendMediaMessage(tenantId, to, {
      type: media.type,
      url: media.url,
      caption: media.caption,
    });
  }

  async sendButtons(
    tenantId: string,
    to: string,
    bodyText: string,
    buttons: ButtonPayload[],
    headerText?: string,
    footerText?: string
  ): Promise<SendResult> {
    return whatsAppService.sendInteractiveButtons(
      tenantId,
      to,
      bodyText,
      buttons,
      headerText,
      footerText
    );
  }

  async sendList(
    tenantId: string,
    to: string,
    bodyText: string,
    buttonText: string,
    sections: ListSection[]
  ): Promise<SendResult> {
    return whatsAppService.sendInteractiveList(
      tenantId,
      to,
      bodyText,
      buttonText,
      sections
    );
  }

  async sendTemplate(
    tenantId: string,
    to: string,
    templateName: string,
    parameters: string[],
    languageCode: string = 'pt_BR'
  ): Promise<SendResult> {
    return whatsAppService.sendTemplate(tenantId, to, templateName, languageCode, parameters);
  }

  async markAsRead(tenantId: string, externalMessageId: string): Promise<void> {
    return whatsAppService.markAsRead(tenantId, externalMessageId);
  }
}

export const whatsappAdapter = new WhatsAppAdapter();
