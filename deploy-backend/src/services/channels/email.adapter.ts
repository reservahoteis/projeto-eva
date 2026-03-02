// ============================================
// Email Channel Adapter (SendGrid)
// Implements ChannelSendAdapter for email messaging
// ============================================

import logger from '@/config/logger';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
  QuickReplyPayload,
} from './channel-send.interface';

/**
 * Email adapter using SendGrid API v3.
 * Email messages are sent as HTML — buttons become links, media become images.
 *
 * Required env vars:
 *   SENDGRID_API_KEY
 *   SENDGRID_FROM_EMAIL   (verified sender, e.g. noreply@hoteisreserva.com.br)
 *   SENDGRID_FROM_NAME    (e.g. "Hoteis Reserva")
 */
class EmailAdapter implements ChannelSendAdapter {
  readonly channel = 'WHATSAPP' as const; // reuse union type for now

  private get apiKey(): string {
    return process.env.SENDGRID_API_KEY || '';
  }

  private get fromEmail(): string {
    return process.env.SENDGRID_FROM_EMAIL || '';
  }

  private get fromName(): string {
    return process.env.SENDGRID_FROM_NAME || 'Hoteis Reserva';
  }

  private get isConfigured(): boolean {
    return !!(this.apiKey && this.fromEmail);
  }

  private async sendGridSend(to: string, subject: string, htmlContent: string): Promise<SendResult> {
    if (!this.isConfigured) {
      logger.warn('Email adapter not configured — missing SENDGRID env vars');
      return { externalMessageId: '', success: false };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: this.fromEmail, name: this.fromName },
          subject,
          content: [
            { type: 'text/html', value: htmlContent },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'SendGrid send failed');
        return { externalMessageId: '', success: false };
      }

      // SendGrid returns message ID in x-message-id header
      const messageId = response.headers.get('x-message-id') || `sg-${Date.now()}`;
      logger.info({ messageId, to }, 'Email sent via SendGrid');
      return { externalMessageId: messageId, success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown', to }, 'Email send error');
      return { externalMessageId: '', success: false };
    }
  }

  private textToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  async sendText(_tenantId: string, to: string, text: string): Promise<SendResult> {
    return this.sendGridSend(to, 'Hoteis Reserva', this.textToHtml(text));
  }

  async sendMedia(_tenantId: string, to: string, media: MediaPayload): Promise<SendResult> {
    let html: string;
    if (media.type === 'image') {
      html = `<img src="${media.url}" alt="${media.caption || 'Image'}" style="max-width:600px">`;
      if (media.caption) html += `<p>${this.textToHtml(media.caption)}</p>`;
    } else {
      html = `<p>${media.caption || ''}</p><p><a href="${media.url}">Download ${media.filename || media.type}</a></p>`;
    }
    return this.sendGridSend(to, media.caption || 'Hoteis Reserva', html);
  }

  async sendButtons(
    _tenantId: string,
    to: string,
    bodyText: string,
    buttons: ButtonPayload[],
  ): Promise<SendResult> {
    const buttonHtml = buttons
      .map((b) => {
        if (b.url) {
          return `<a href="${b.url}" style="display:inline-block;padding:10px 20px;margin:5px;background:#2563EB;color:#fff;text-decoration:none;border-radius:6px">${b.title}</a>`;
        }
        return `<span style="display:inline-block;padding:10px 20px;margin:5px;background:#E5E7EB;border-radius:6px">${b.title}</span>`;
      })
      .join('');

    const html = `<p>${this.textToHtml(bodyText)}</p><div style="margin-top:16px">${buttonHtml}</div>`;
    return this.sendGridSend(to, 'Hoteis Reserva', html);
  }
}

export const emailAdapter = new EmailAdapter();
