// ============================================
// SMS Channel Adapter (Twilio)
// Implements ChannelSendAdapter for SMS messaging
// ============================================

import logger from '@/config/logger';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
} from './channel-send.interface';

/**
 * SMS adapter using Twilio API.
 * SMS is text-only — buttons, media, and templates degrade to text.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER  (E.164 format, e.g. +15551234567)
 */
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

class SmsAdapter implements ChannelSendAdapter {
  readonly channel = 'SMS' as const;

  private get accountSid(): string {
    return process.env.TWILIO_ACCOUNT_SID || '';
  }

  private get authToken(): string {
    return process.env.TWILIO_AUTH_TOKEN || '';
  }

  private get fromNumber(): string {
    return process.env.TWILIO_PHONE_NUMBER || '';
  }

  private get isConfigured(): boolean {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }

  private async twilioSend(to: string, body: string): Promise<SendResult> {
    if (!this.isConfigured) {
      logger.warn('SMS adapter not configured — missing TWILIO env vars');
      return { externalMessageId: '', success: false };
    }

    if (!E164_REGEX.test(to)) {
      logger.warn({ to }, 'Invalid phone number format — must be E.164');
      return { externalMessageId: '', success: false };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('To', to);
      params.append('From', this.fromNumber);
      params.append('Body', body);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const result = (await response.json()) as { sid?: string; message?: string };

      if (!response.ok) {
        logger.error({ status: response.status, error: result }, 'Twilio SMS send failed');
        return { externalMessageId: '', success: false };
      }

      logger.info({ sid: result.sid, to }, 'SMS sent via Twilio');
      return { externalMessageId: result.sid || '', success: true };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown', to }, 'SMS send error');
      return { externalMessageId: '', success: false };
    }
  }

  async sendText(_tenantId: string, to: string, text: string): Promise<SendResult> {
    return this.twilioSend(to, text);
  }

  async sendMedia(_tenantId: string, to: string, media: MediaPayload): Promise<SendResult> {
    // SMS with MMS: include media URL in body
    const body = media.caption
      ? `${media.caption}\n\n${media.url}`
      : media.url;
    return this.twilioSend(to, body);
  }

  async sendButtons(
    _tenantId: string,
    to: string,
    bodyText: string,
    buttons: ButtonPayload[],
  ): Promise<SendResult> {
    // Degrade buttons to numbered text
    const buttonLines = buttons.map((b, i) => `${i + 1}. ${b.title}`);
    const fullText = `${bodyText}\n\n${buttonLines.join('\n')}`;
    return this.twilioSend(to, fullText);
  }
}

export const smsAdapter = new SmsAdapter();
