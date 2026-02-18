// ============================================
// Channel Send Adapter Interface
// Abstraction layer for multi-channel messaging
// ============================================

export interface SendResult {
  externalMessageId: string;
  success: boolean;
}

export interface MediaPayload {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  caption?: string;
  filename?: string;
}

export interface ButtonPayload {
  id: string;
  title: string;
}

export interface ListSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface TemplateParameter {
  type: 'text' | 'image' | 'video' | 'document';
  value: string;
}

/**
 * Interface que todo adapter de canal deve implementar.
 * Metodos opcionais retornam null se o canal nao suporta.
 */
export interface ChannelSendAdapter {
  readonly channel: 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM';

  sendText(tenantId: string, to: string, text: string): Promise<SendResult>;

  sendMedia(tenantId: string, to: string, media: MediaPayload): Promise<SendResult>;

  sendButtons(
    tenantId: string,
    to: string,
    bodyText: string,
    buttons: ButtonPayload[],
    headerText?: string,
    footerText?: string
  ): Promise<SendResult>;

  sendList?(
    tenantId: string,
    to: string,
    bodyText: string,
    buttonText: string,
    sections: ListSection[],
    headerText?: string,
    footerText?: string
  ): Promise<SendResult>;

  sendTemplate?(
    tenantId: string,
    to: string,
    templateName: string,
    parameters: string[],
    languageCode?: string
  ): Promise<SendResult>;

  markAsRead?(tenantId: string, externalMessageId: string): Promise<void>;
}
