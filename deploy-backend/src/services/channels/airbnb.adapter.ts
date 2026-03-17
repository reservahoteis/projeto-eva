// ============================================
// Airbnb Channel Adapter (STUB)
// Preparado para ativação quando parceria for assinada
// ============================================

import logger from '@/config/logger';
import type {
  ChannelSendAdapter,
  SendResult,
  MediaPayload,
  ButtonPayload,
} from './channel-send.interface';

/**
 * Airbnb messaging adapter — STUB.
 *
 * Airbnb Host Messaging API is available through the Airbnb API (v2).
 * Requires Partner approval and OAuth 2.0 credentials.
 *
 * When the partnership is active, this adapter will:
 * 1. Use the Airbnb Messaging API to communicate with guests
 * 2. Map reservations to CRM contacts
 * 3. Sync check-in/check-out events with deal pipeline
 *
 * Required env vars (future):
 *   AIRBNB_CLIENT_ID
 *   AIRBNB_CLIENT_SECRET
 *   AIRBNB_ACCESS_TOKEN
 */
class AirbnbAdapter implements ChannelSendAdapter {
  readonly channel = 'WHATSAPP' as const; // placeholder — no AIRBNB union member yet

  private readonly STUB_MSG = 'Airbnb adapter not yet active — awaiting partnership approval';

  async sendText(_tenantId: string, _to: string, _text: string): Promise<SendResult> {
    logger.warn(this.STUB_MSG);
    return { externalMessageId: '', success: false };
  }

  async sendMedia(_tenantId: string, _to: string, _media: MediaPayload): Promise<SendResult> {
    logger.warn(this.STUB_MSG);
    return { externalMessageId: '', success: false };
  }

  async sendButtons(
    _tenantId: string,
    _to: string,
    _bodyText: string,
    _buttons: ButtonPayload[],
  ): Promise<SendResult> {
    logger.warn(this.STUB_MSG);
    return { externalMessageId: '', success: false };
  }
}

export const airbnbAdapter = new AirbnbAdapter();
