// ============================================
// Booking.com Channel Adapter (STUB)
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
 * Booking.com messaging adapter — STUB.
 *
 * Booking.com Connectivity Partner API does NOT provide a direct messaging
 * endpoint. Guest communication happens through the Booking.com extranet
 * or the Messaging API (requires Connectivity Partner approval).
 *
 * When the partnership is active, this adapter will:
 * 1. Use the Booking.com Messaging API to send/receive guest messages
 * 2. Map reservations to CRM contacts automatically
 * 3. Sync booking statuses with deal pipeline
 *
 * Required env vars (future):
 *   BOOKING_PARTNER_ID
 *   BOOKING_API_KEY
 *   BOOKING_API_SECRET
 */
class BookingAdapter implements ChannelSendAdapter {
  readonly channel = 'WHATSAPP' as const; // placeholder until union type is extended

  private readonly STUB_MSG = 'Booking.com adapter not yet active — awaiting partnership approval';

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

export const bookingAdapter = new BookingAdapter();
