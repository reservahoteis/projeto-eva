/**
 * WhatsApp Business API Type Definitions
 *
 * Type-safe definitions for WhatsApp Business Cloud API
 * Based on official Meta WhatsApp Business Platform API documentation
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/
 */

// ============================================
// WEBHOOK TYPES
// ============================================

/**
 * Main webhook payload structure received from WhatsApp
 */
export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppWebhookEntry[];
}

/**
 * Individual entry in webhook payload
 * Can contain multiple changes
 */
export interface WhatsAppWebhookEntry {
  id: string; // WhatsApp Business Account ID
  changes: WhatsAppWebhookChange[];
}

/**
 * Individual change notification
 * Contains the actual data (messages, statuses, etc.)
 */
export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: 'messages' | 'message_template_status_update' | string;
}

/**
 * Value object containing message data or status updates
 */
export interface WhatsAppWebhookValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppMessageStatus[];
}

/**
 * Metadata about the WhatsApp phone number
 */
export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

/**
 * Contact information in webhook
 */
export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string; // WhatsApp ID (phone number)
}

// ============================================
// INCOMING MESSAGE TYPES
// ============================================

/**
 * Base structure for all incoming messages
 */
export interface WhatsAppIncomingMessageBase {
  from: string; // Sender's phone number
  id: string; // Message ID
  timestamp: string; // Unix timestamp
  type: WhatsAppMessageTypeIncoming;
  context?: WhatsAppMessageContext;
}

/**
 * Context for messages that are replies
 */
export interface WhatsAppMessageContext {
  from: string;
  id: string; // ID of the message being replied to
  referred_product?: {
    catalog_id: string;
    product_retailer_id: string;
  };
}

/**
 * All possible incoming message types
 */
export type WhatsAppMessageTypeIncoming =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'order'
  | 'system'
  | 'unknown';

/**
 * Discriminated union for all incoming message types
 */
export type WhatsAppIncomingMessage =
  | WhatsAppTextMessageIncoming
  | WhatsAppImageMessageIncoming
  | WhatsAppVideoMessageIncoming
  | WhatsAppAudioMessageIncoming
  | WhatsAppDocumentMessageIncoming
  | WhatsAppStickerMessageIncoming
  | WhatsAppLocationMessageIncoming
  | WhatsAppContactsMessageIncoming
  | WhatsAppInteractiveMessageIncoming
  | WhatsAppButtonMessageIncoming
  | WhatsAppUnknownMessageIncoming;

/**
 * Text message
 */
export interface WhatsAppTextMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'text';
  text: {
    body: string;
  };
}

/**
 * Image message
 */
export interface WhatsAppImageMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'image';
  image: WhatsAppMediaObject & {
    caption?: string;
  };
}

/**
 * Video message
 */
export interface WhatsAppVideoMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'video';
  video: WhatsAppMediaObject & {
    caption?: string;
  };
}

/**
 * Audio message
 */
export interface WhatsAppAudioMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'audio';
  audio: WhatsAppMediaObject;
}

/**
 * Document message
 */
export interface WhatsAppDocumentMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'document';
  document: WhatsAppMediaObject & {
    caption?: string;
    filename?: string;
  };
}

/**
 * Sticker message
 */
export interface WhatsAppStickerMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'sticker';
  sticker: WhatsAppMediaObject;
}

/**
 * Location message
 */
export interface WhatsAppLocationMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'location';
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

/**
 * Contacts message
 */
export interface WhatsAppContactsMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'contacts';
  contacts: WhatsAppContactCard[];
}

/**
 * Interactive message (button/list reply)
 */
export interface WhatsAppInteractiveMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'interactive';
  interactive: WhatsAppInteractiveReply;
}

/**
 * Button reply (deprecated, use interactive)
 */
export interface WhatsAppButtonMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'button';
  button: {
    payload: string;
    text: string;
  };
}

/**
 * Unknown message type
 */
export interface WhatsAppUnknownMessageIncoming extends WhatsAppIncomingMessageBase {
  type: 'unknown';
  errors?: WhatsAppError[];
}

/**
 * Media object structure
 */
export interface WhatsAppMediaObject {
  id: string; // Media ID for download
  mime_type: string;
  sha256?: string;
}

/**
 * Contact card structure
 */
export interface WhatsAppContactCard {
  addresses?: Array<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    country_code?: string;
    type?: 'HOME' | 'WORK';
  }>;
  birthday?: string;
  emails?: Array<{
    email?: string;
    type?: 'HOME' | 'WORK';
  }>;
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    suffix?: string;
    prefix?: string;
  };
  org?: {
    company?: string;
    department?: string;
    title?: string;
  };
  phones?: Array<{
    phone?: string;
    type?: 'CELL' | 'MAIN' | 'IPHONE' | 'HOME' | 'WORK';
    wa_id?: string;
  }>;
  urls?: Array<{
    url?: string;
    type?: 'HOME' | 'WORK';
  }>;
}

/**
 * Interactive reply from user
 */
export type WhatsAppInteractiveReply =
  | WhatsAppButtonReply
  | WhatsAppListReply;

/**
 * Button reply
 */
export interface WhatsAppButtonReply {
  type: 'button_reply';
  button_reply: {
    id: string;
    title: string;
  };
}

/**
 * List reply
 */
export interface WhatsAppListReply {
  type: 'list_reply';
  list_reply: {
    id: string;
    title: string;
    description?: string;
  };
}

// ============================================
// MESSAGE STATUS TYPES
// ============================================

/**
 * Message status update
 */
export interface WhatsAppMessageStatus {
  id: string; // Message ID
  status: WhatsAppStatusType;
  timestamp: string;
  recipient_id: string;
  conversation?: WhatsAppConversationInfo;
  pricing?: WhatsAppPricingInfo;
  errors?: WhatsAppError[];
}

/**
 * Possible message status values
 */
export type WhatsAppStatusType =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'deleted';

/**
 * Conversation category information
 */
export interface WhatsAppConversationInfo {
  id: string;
  origin: WhatsAppConversationOrigin;
  expiration_timestamp?: string;
}

/**
 * Conversation origin types
 */
export interface WhatsAppConversationOrigin {
  type: 'authentication' | 'marketing' | 'utility' | 'service' | 'referral_conversion';
}

/**
 * Pricing information
 */
export interface WhatsAppPricingInfo {
  billable: boolean;
  pricing_model: 'CBP'; // Conversation-Based Pricing
  category: 'authentication' | 'marketing' | 'utility' | 'service' | 'referral_conversion';
}

/**
 * Error object
 */
export interface WhatsAppError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details: string;
  };
}

// ============================================
// OUTGOING MESSAGE TYPES
// ============================================

/**
 * Base request for sending messages
 */
export interface WhatsAppSendMessageRequest {
  messaging_product: 'whatsapp';
  recipient_type?: 'individual';
  to: string; // Recipient phone number
  type: WhatsAppMessageTypeOutgoing;
  context?: {
    message_id: string; // For replies
  };
}

/**
 * Outgoing message types
 */
export type WhatsAppMessageTypeOutgoing =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'template';

/**
 * Text message request
 */
export interface WhatsAppTextMessageRequest extends WhatsAppSendMessageRequest {
  type: 'text';
  text: {
    body: string;
    preview_url?: boolean;
  };
}

/**
 * Media message request (image, video, audio, document)
 */
export interface WhatsAppMediaMessageRequest extends WhatsAppSendMessageRequest {
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  image?: WhatsAppMediaPayload;
  video?: WhatsAppMediaPayload;
  audio?: WhatsAppMediaPayload;
  document?: WhatsAppMediaPayload & { filename?: string };
  sticker?: WhatsAppMediaPayload;
}

/**
 * Media payload (by ID or URL)
 */
export type WhatsAppMediaPayload =
  | { id: string; caption?: string }
  | { link: string; caption?: string };

/**
 * Location message request
 */
export interface WhatsAppLocationMessageRequest extends WhatsAppSendMessageRequest {
  type: 'location';
  location: {
    longitude: number;
    latitude: number;
    name?: string;
    address?: string;
  };
}

/**
 * Contacts message request
 */
export interface WhatsAppContactsMessageRequest extends WhatsAppSendMessageRequest {
  type: 'contacts';
  contacts: WhatsAppContactCard[];
}

/**
 * Interactive message request
 */
export interface WhatsAppInteractiveMessageRequest extends WhatsAppSendMessageRequest {
  type: 'interactive';
  interactive: WhatsAppInteractiveContent;
}

/**
 * Interactive content types
 */
export type WhatsAppInteractiveContent =
  | WhatsAppInteractiveButton
  | WhatsAppInteractiveList
  | WhatsAppInteractiveProduct
  | WhatsAppInteractiveProductList;

/**
 * Interactive buttons (up to 3)
 */
export interface WhatsAppInteractiveButton {
  type: 'button';
  header?: WhatsAppInteractiveHeader;
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    buttons: Array<{
      type: 'reply';
      reply: {
        id: string;
        title: string; // Max 20 chars
      };
    }>;
  };
}

/**
 * Interactive list (up to 10 items per section)
 */
export interface WhatsAppInteractiveList {
  type: 'list';
  header?: {
    type: 'text';
    text: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    button: string; // Button text (max 20 chars)
    sections: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string; // Max 24 chars
        description?: string; // Max 72 chars
      }>;
    }>;
  };
}

/**
 * Interactive header types
 */
export type WhatsAppInteractiveHeader =
  | { type: 'text'; text: string }
  | { type: 'image'; image: { id: string } | { link: string } }
  | { type: 'video'; video: { id: string } | { link: string } }
  | { type: 'document'; document: { id: string; filename?: string } | { link: string; filename?: string } };

/**
 * Interactive product (single product)
 */
export interface WhatsAppInteractiveProduct {
  type: 'product';
  body?: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    catalog_id: string;
    product_retailer_id: string;
  };
}

/**
 * Interactive product list (multiple products)
 */
export interface WhatsAppInteractiveProductList {
  type: 'product_list';
  header: {
    type: 'text';
    text: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    catalog_id: string;
    sections: Array<{
      title: string;
      product_items: Array<{
        product_retailer_id: string;
      }>;
    }>;
  };
}

/**
 * Template message request
 */
export interface WhatsAppTemplateMessageRequest extends WhatsAppSendMessageRequest {
  type: 'template';
  template: {
    name: string;
    language: {
      code: string; // e.g., 'pt_BR', 'en_US'
      policy?: 'deterministic';
    };
    components?: WhatsAppTemplateComponent[];
  };
}

/**
 * Template component
 */
export type WhatsAppTemplateComponent =
  | WhatsAppTemplateHeaderComponent
  | WhatsAppTemplateBodyComponent
  | WhatsAppTemplateButtonComponent;

/**
 * Template header component
 */
export interface WhatsAppTemplateHeaderComponent {
  type: 'header';
  parameters: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; image: { id: string } | { link: string } }
    | { type: 'video'; video: { id: string } | { link: string } }
    | { type: 'document'; document: { id: string; filename?: string } | { link: string; filename?: string } }
  >;
}

/**
 * Template body component
 */
export interface WhatsAppTemplateBodyComponent {
  type: 'body';
  parameters: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Template button component
 */
export interface WhatsAppTemplateButtonComponent {
  type: 'button';
  sub_type: 'quick_reply' | 'url';
  index: number; // Button index (0-based)
  parameters: Array<
    | { type: 'text'; text: string }
    | { type: 'payload'; payload: string }
  >;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Successful send message response
 */
export interface WhatsAppSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string; // Phone number sent to
    wa_id: string; // WhatsApp ID
  }>;
  messages: Array<{
    id: string; // Message ID
    message_status?: 'accepted' | 'held_for_quality_assessment';
  }>;
}

/**
 * Error response from WhatsApp API
 */
export interface WhatsAppErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: 'whatsapp';
      details: string;
    };
    error_subcode?: number;
    fbtrace_id: string;
  };
}

/**
 * Media upload response
 */
export interface WhatsAppMediaUploadResponse {
  id: string; // Media ID
}

/**
 * Media info response
 */
export interface WhatsAppMediaInfoResponse {
  messaging_product: 'whatsapp';
  url: string; // Download URL (valid for 5 minutes)
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
}

// ============================================
// WEBHOOK VERIFICATION
// ============================================

/**
 * Webhook verification parameters
 */
export interface WhatsAppWebhookVerification {
  'hub.mode': 'subscribe';
  'hub.challenge': string;
  'hub.verify_token': string;
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard for webhook payload
 */
export function isWhatsAppWebhookPayload(payload: unknown): payload is WhatsAppWebhookPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'object' in payload &&
    payload.object === 'whatsapp_business_account' &&
    'entry' in payload &&
    Array.isArray(payload.entry)
  );
}

/**
 * Type guard for text message
 */
export function isTextMessage(message: WhatsAppIncomingMessage): message is WhatsAppTextMessageIncoming {
  return message.type === 'text';
}

/**
 * Type guard for interactive message
 */
export function isInteractiveMessage(message: WhatsAppIncomingMessage): message is WhatsAppInteractiveMessageIncoming {
  return message.type === 'interactive';
}

/**
 * Type guard for media messages
 */
export function isMediaMessage(
  message: WhatsAppIncomingMessage
): message is WhatsAppImageMessageIncoming | WhatsAppVideoMessageIncoming | WhatsAppAudioMessageIncoming | WhatsAppDocumentMessageIncoming {
  return ['image', 'video', 'audio', 'document'].includes(message.type);
}

/**
 * Type guard for error response
 */
export function isWhatsAppError(response: unknown): response is WhatsAppErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as WhatsAppErrorResponse).error === 'object'
  );
}
