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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

class EmailAdapter implements ChannelSendAdapter {
  readonly channel = 'EMAIL' as const;

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

    if (!EMAIL_REGEX.test(to)) {
      logger.warn({ to }, 'Invalid email address format');
      return { externalMessageId: '', success: false };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: this.fromEmail, name: this.fromName },
          subject: escapeHtml(subject),
          content: [
            { type: 'text/html', value: htmlContent },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

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
    if (!validateUrl(media.url)) {
      logger.warn({ url: media.url }, 'Invalid media URL — must be http/https');
      return { externalMessageId: '', success: false };
    }

    const safeUrl = escapeHtml(media.url);
    const safeCaption = media.caption ? escapeHtml(media.caption) : '';
    const safeFilename = media.filename ? escapeHtml(media.filename) : escapeHtml(media.type);

    let html: string;
    if (media.type === 'image') {
      html = `<img src="${safeUrl}" alt="${safeCaption || 'Image'}" style="max-width:600px">`;
      if (media.caption) html += `<p>${this.textToHtml(media.caption)}</p>`;
    } else {
      html = `<p>${safeCaption}</p><p><a href="${safeUrl}">Download ${safeFilename}</a></p>`;
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
        const safeTitle = escapeHtml(b.title);
        if (b.url && validateUrl(b.url)) {
          const safeUrl = escapeHtml(b.url);
          return `<a href="${safeUrl}" style="display:inline-block;padding:10px 20px;margin:5px;background:#2563EB;color:#fff;text-decoration:none;border-radius:6px">${safeTitle}</a>`;
        }
        return `<span style="display:inline-block;padding:10px 20px;margin:5px;background:#E5E7EB;border-radius:6px">${safeTitle}</span>`;
      })
      .join('');

    const html = `<p>${this.textToHtml(bodyText)}</p><div style="margin-top:16px">${buttonHtml}</div>`;
    return this.sendGridSend(to, 'Hoteis Reserva', html);
  }
}

export const emailAdapter = new EmailAdapter();
