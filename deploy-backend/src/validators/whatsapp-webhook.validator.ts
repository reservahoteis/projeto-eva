import { z } from 'zod';

// ============================================
// WhatsApp Cloud API v21.0 - Webhook Schemas
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
// ============================================

// ============================================
// Base Schemas
// ============================================

const WhatsAppProfileSchema = z.object({
  name: z.string(),
});

const WhatsAppContactSchema = z.object({
  profile: WhatsAppProfileSchema,
  wa_id: z.string(),
});

// ============================================
// Message Types
// ============================================

const TextMessageSchema = z.object({
  body: z.string(),
});

const ImageMessageSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  caption: z.string().optional(),
});

const VideoMessageSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  caption: z.string().optional(),
});

const AudioMessageSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  voice: z.boolean().optional(),
});

const DocumentMessageSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  caption: z.string().optional(),
});

const StickerMessageSchema = z.object({
  id: z.string(),
  mime_type: z.string(),
  sha256: z.string(),
  animated: z.boolean().optional(),
});

const LocationMessageSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

// Reaction Message (emoji reactions to messages)
const ReactionMessageSchema = z.object({
  message_id: z.string(), // ID da mensagem que recebeu a reação
  emoji: z.string(), // Emoji da reação (pode ser vazio se reação foi removida)
});

const ContactMessageSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.object({
        formatted_name: z.string(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
      }),
      phones: z.array(
        z.object({
          phone: z.string(),
          type: z.string().optional(),
          wa_id: z.string().optional(),
        })
      ).optional(),
      emails: z.array(
        z.object({
          email: z.string(),
          type: z.string().optional(),
        })
      ).optional(),
    })
  ),
});

// Interactive Messages (Buttons & Lists)
const ButtonReplySchema = z.object({
  button_reply: z.object({
    id: z.string(),
    title: z.string(),
  }),
});

// Template Quick Reply Button (formato usado por carousel templates)
const TemplateButtonSchema = z.object({
  payload: z.string(),
  text: z.string(),
});

const ListReplySchema = z.object({
  list_reply: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
  }),
});

// WhatsApp Flow Reply (nfm_reply)
const NfmReplySchema = z.object({
  nfm_reply: z.object({
    response_json: z.string(), // JSON string com respostas do formulário
    body: z.string().optional(), // Texto opcional (ex: "Sent")
    name: z.string(), // Nome do flow
  }),
});

// Context (Reply/Quote or Forwarded Message)
// Quando é reply: tem from e id
// Quando é forwarded: tem apenas forwarded: true (ou frequently_forwarded: true)
const ContextSchema = z.object({
  from: z.string().optional(),
  id: z.string().optional(),
  forwarded: z.boolean().optional(),
  frequently_forwarded: z.boolean().optional(),
});

// Referral (From ads)
const ReferralSchema = z.object({
  source_url: z.string(),
  source_type: z.string(),
  source_id: z.string().optional(),
  headline: z.string().optional(),
  body: z.string().optional(),
  media_type: z.string().optional(),
  image_url: z.string().optional(),
  video_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

// ============================================
// Message Schema (Union of all types)
// ============================================

export const WhatsAppMessageSchema = z.object({
  from: z.string(), // Phone number do remetente (ex: 5511999999999)
  id: z.string(), // WhatsApp message ID
  timestamp: z.string(), // Unix timestamp em string
  type: z.enum([
    'text',
    'image',
    'video',
    'audio',
    'document',
    'sticker',
    'location',
    'contacts',
    'button',
    'interactive',
    'reaction',
    'order',
    'system',
    'unknown',
  ]),

  // Message content (based on type)
  text: TextMessageSchema.optional(),
  image: ImageMessageSchema.optional(),
  video: VideoMessageSchema.optional(),
  audio: AudioMessageSchema.optional(),
  document: DocumentMessageSchema.optional(),
  sticker: StickerMessageSchema.optional(),
  location: LocationMessageSchema.optional(),
  contacts: ContactMessageSchema.optional(),
  // button pode ser ButtonReplySchema (interactive button reply) ou TemplateButtonSchema (carousel template quick reply)
  button: z.union([ButtonReplySchema, TemplateButtonSchema]).optional(),
  interactive: z.union([ButtonReplySchema, ListReplySchema, NfmReplySchema]).optional(),
  reaction: ReactionMessageSchema.optional(),

  // Context (reply/quote)
  context: ContextSchema.optional(),

  // Referral (from ads)
  referral: ReferralSchema.optional(),

  // Errors (quando mensagem falha)
  errors: z.array(
    z.object({
      code: z.number(),
      title: z.string(),
      message: z.string(),
      error_data: z.object({
        details: z.string(),
      }),
    })
  ).optional(),
});

// ============================================
// Status Update Schema
// ============================================

export const WhatsAppStatusSchema = z.object({
  id: z.string(), // WhatsApp message ID
  status: z.enum(['sent', 'delivered', 'read', 'failed', 'deleted']),
  timestamp: z.string(), // Unix timestamp em string
  recipient_id: z.string(), // Phone number do destinatário

  // Errors (quando status = failed)
  errors: z.array(
    z.object({
      code: z.number(),
      title: z.string(),
      message: z.string().optional(),
      error_data: z.object({
        details: z.string(),
      }).optional(),
    })
  ).optional(),

  // Conversation (billing info)
  conversation: z.object({
    id: z.string(),
    origin: z.object({
      type: z.string(),
    }),
    expiration_timestamp: z.string().optional(),
  }).optional(),

  // Pricing
  pricing: z.object({
    billable: z.boolean(),
    pricing_model: z.string(),
    category: z.string(),
  }).optional(),
});

// ============================================
// Value Schema (messages or statuses)
// ============================================

export const WhatsAppValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),

  // Contacts info (quando message)
  contacts: z.array(WhatsAppContactSchema).optional(),

  // Messages array
  messages: z.array(WhatsAppMessageSchema).optional(),

  // Statuses array
  statuses: z.array(WhatsAppStatusSchema).optional(),

  // Errors (account level)
  errors: z.array(
    z.object({
      code: z.number(),
      title: z.string(),
      message: z.string().optional(),
    })
  ).optional(),
});

// ============================================
// Change Schema
// ============================================

export const WhatsAppChangeSchema = z.object({
  value: WhatsAppValueSchema,
  field: z.enum(['messages', 'message_status', 'account_update', 'account_alerts', 'message_template_status_update']),
});

// ============================================
// Entry Schema
// ============================================

export const WhatsAppEntrySchema = z.object({
  id: z.string(), // WhatsApp Business Account ID
  changes: z.array(WhatsAppChangeSchema),
});

// ============================================
// Root Webhook Schema
// ============================================

export const WhatsAppWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(WhatsAppEntrySchema),
});

// ============================================
// Verification Schema (GET request)
// ============================================

export const WhatsAppVerificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

// ============================================
// Type Exports (para uso no código)
// ============================================

export type WhatsAppWebhook = z.infer<typeof WhatsAppWebhookSchema>;
export type WhatsAppEntry = z.infer<typeof WhatsAppEntrySchema>;
export type WhatsAppChange = z.infer<typeof WhatsAppChangeSchema>;
export type WhatsAppValue = z.infer<typeof WhatsAppValueSchema>;
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;
export type WhatsAppStatus = z.infer<typeof WhatsAppStatusSchema>;
export type WhatsAppVerification = z.infer<typeof WhatsAppVerificationSchema>;

// ============================================
// Validation Helpers
// ============================================

/**
 * Valida payload do webhook WhatsApp
 * Retorna dados validados ou lança ZodError
 */
export function validateWhatsAppWebhook(data: unknown): WhatsAppWebhook {
  return WhatsAppWebhookSchema.parse(data);
}

/**
 * Valida payload do webhook WhatsApp (safe)
 * Retorna { success: true, data } ou { success: false, error }
 */
export function validateWhatsAppWebhookSafe(data: unknown) {
  return WhatsAppWebhookSchema.safeParse(data);
}

/**
 * Valida parâmetros de verificação do webhook
 */
export function validateWhatsAppVerification(query: unknown): WhatsAppVerification {
  return WhatsAppVerificationSchema.parse(query);
}

/**
 * Valida parâmetros de verificação do webhook (safe)
 */
export function validateWhatsAppVerificationSafe(query: unknown) {
  return WhatsAppVerificationSchema.safeParse(query);
}

// ============================================
// Type Guards
// ============================================

export function isTextMessage(message: WhatsAppMessage): message is WhatsAppMessage & { text: NonNullable<WhatsAppMessage['text']> } {
  return message.type === 'text' && !!message.text;
}

export function isImageMessage(message: WhatsAppMessage): message is WhatsAppMessage & { image: NonNullable<WhatsAppMessage['image']> } {
  return message.type === 'image' && !!message.image;
}

export function isVideoMessage(message: WhatsAppMessage): message is WhatsAppMessage & { video: NonNullable<WhatsAppMessage['video']> } {
  return message.type === 'video' && !!message.video;
}

export function isAudioMessage(message: WhatsAppMessage): message is WhatsAppMessage & { audio: NonNullable<WhatsAppMessage['audio']> } {
  return message.type === 'audio' && !!message.audio;
}

export function isDocumentMessage(message: WhatsAppMessage): message is WhatsAppMessage & { document: NonNullable<WhatsAppMessage['document']> } {
  return message.type === 'document' && !!message.document;
}

export function isLocationMessage(message: WhatsAppMessage): message is WhatsAppMessage & { location: NonNullable<WhatsAppMessage['location']> } {
  return message.type === 'location' && !!message.location;
}

export function isInteractiveMessage(message: WhatsAppMessage): message is WhatsAppMessage & { interactive: NonNullable<WhatsAppMessage['interactive']> } {
  return message.type === 'interactive' && !!message.interactive;
}

export function isButtonReply(message: WhatsAppMessage): boolean {
  return message.type === 'button' && !!message.button;
}

export function isListReply(message: WhatsAppMessage): boolean {
  return message.type === 'interactive' && !!message.interactive && 'list_reply' in message.interactive;
}

/**
 * Verifica se é resposta de botão via interactive (Quick Reply de carousel template)
 * Formato: type: 'interactive' com interactive.button_reply
 */
export function isInteractiveButtonReply(message: WhatsAppMessage): boolean {
  return message.type === 'interactive' && !!message.interactive && 'button_reply' in message.interactive;
}

/**
 * Verifica se é resposta de Quick Reply de template (carousel ou outro template)
 * Formato: type: 'button' com button.payload e button.text
 */
export function isTemplateButtonReply(message: WhatsAppMessage): boolean {
  return message.type === 'button' && !!message.button && 'payload' in message.button && 'text' in message.button;
}

/**
 * Verifica se é resposta de WhatsApp Flow (nfm_reply)
 * Formato: type: 'interactive' com interactive.nfm_reply
 */
export function isNfmReply(message: WhatsAppMessage): boolean {
  return message.type === 'interactive' && !!message.interactive && 'nfm_reply' in message.interactive;
}
