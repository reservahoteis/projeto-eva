import { z } from 'zod';

/**
 * Regex para telefone brasileiro (formato WhatsApp: 55 + DDD + numero)
 * Aceita 10-15 digitos (permite internacionais tambem)
 */
const phoneSchema = z.string().min(10, 'Telefone deve ter no minimo 10 digitos').max(15, 'Telefone deve ter no maximo 15 digitos');

/**
 * Schema para POST /api/n8n/send-text
 */
export const sendTextSchema = z.object({
  phone: phoneSchema,
  message: z.string().min(1, 'Mensagem e obrigatoria').max(4096, 'Mensagem deve ter no maximo 4096 caracteres'),
  delayTyping: z.coerce.number().optional(),
});

/**
 * Schema para POST /api/n8n/send-buttons
 */
export const sendButtonsSchema = z.object({
  phone: phoneSchema,
  message: z.string().min(1, 'Mensagem e obrigatoria').max(1024),
  buttons: z.array(
    z.object({
      id: z.string().min(1).max(256),
      label: z.string().min(1).max(20).optional(),
      title: z.string().min(1).max(20).optional(),
      text: z.string().min(1).max(20).optional(),
      buttonId: z.string().optional(),
    })
  ).min(1, 'Minimo 1 botao').max(3, 'Maximo 3 botoes'),
  title: z.string().max(60).optional(),
  footer: z.string().max(60).optional(),
});

/**
 * Schema para POST /api/n8n/send-list
 */
const listRowSchema = z.object({
  id: z.string().min(1).max(200),
  rowId: z.string().optional(),
  title: z.string().min(1).max(24),
  description: z.string().max(72).optional(),
});

const listSectionSchema = z.object({
  title: z.string().max(24).optional(),
  rows: z.array(listRowSchema).min(1),
  options: z.array(listRowSchema).optional(),
});

export const sendListSchema = z.object({
  phone: phoneSchema,
  message: z.string().min(1).max(1024),
  optionList: z.object({
    title: z.string().max(24).optional(),
    buttonLabel: z.string().max(20).optional(),
    options: z.array(listRowSchema).min(1).max(10),
  }).optional(),
  buttonText: z.string().max(20).optional(),
  sections: z.array(listSectionSchema).optional(),
}).refine(
  (data) => data.optionList || data.sections,
  { message: 'Forneca optionList ou sections' }
);

/**
 * Schema para POST /api/n8n/send-media
 */
export const sendMediaSchema = z.object({
  phone: phoneSchema,
  type: z.enum(['image', 'video', 'audio', 'document']).optional(),
  url: z.string().url().optional(),
  caption: z.string().max(1024).optional(),
  mediaUrl: z.string().url().optional(),
  image: z.union([
    z.string().url(),
    z.object({ url: z.string().url(), caption: z.string().optional() }),
  ]).optional(),
  video: z.union([
    z.string().url(),
    z.object({ url: z.string().url(), caption: z.string().optional() }),
  ]).optional(),
  audio: z.union([
    z.string().url(),
    z.object({ url: z.string().url() }),
  ]).optional(),
  document: z.union([
    z.string().url(),
    z.object({ url: z.string().url(), caption: z.string().optional() }),
  ]).optional(),
}).refine(
  (data) => data.type && data.url || data.image || data.video || data.audio || data.document || data.mediaUrl,
  { message: 'Forneca type+url ou image/video/audio/document ou mediaUrl' }
);

/**
 * Schema para POST /api/n8n/send-template
 */
export const sendTemplateSchema = z.object({
  phone: phoneSchema,
  template: z.string().min(1).optional(),
  templateName: z.string().min(1).optional(),
  language: z.string().optional(),
  languageCode: z.string().optional(),
  parameters: z.array(z.string()).optional(),
  components: z.array(z.object({
    type: z.string(),
    parameters: z.array(z.object({
      text: z.string().optional(),
      value: z.string().optional(),
    })).optional(),
  })).optional(),
}).refine(
  (data) => data.template || data.templateName,
  { message: 'Forneca template ou templateName' }
);

/**
 * Schema para POST /api/n8n/escalate
 */
export const escalateSchema = z.object({
  phone: phoneSchema.optional(),
  contactPhoneNumber: phoneSchema.optional(),
  reason: z.enum([
    'USER_REQUESTED',
    'AI_UNABLE',
    'COMPLEX_QUERY',
    'COMPLAINT',
    'SALES_OPPORTUNITY',
    'URGENCY',
    'OTHER',
  ]).optional().default('OTHER'),
  reasonDetail: z.string().max(500).optional(),
  hotelUnit: z.string().max(100).optional(),
  messageHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional(),
  })).optional(),
  aiContext: z.record(z.any()).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('HIGH'),
}).refine(
  (data) => data.phone || data.contactPhoneNumber,
  { message: 'Forneca phone ou contactPhoneNumber' }
);

/**
 * Schema para POST /api/n8n/send-carousel
 */
const carouselCardTemplateSchema = z.object({
  imageUrl: z.string().url('imageUrl deve ser uma URL valida'),
  bodyParams: z.array(z.string()).optional(),
  buttonPayloads: z.array(z.string()).min(1, 'buttonPayloads e obrigatorio'),
});

const carouselCardInteractiveSchema = z.object({
  text: z.string().min(1),
  image: z.string().url().optional(),
  buttons: z.array(z.object({
    id: z.string().min(1).max(256),
    label: z.string().min(1).max(20).optional(),
    title: z.string().min(1).max(20).optional(),
    text: z.string().min(1).max(20).optional(),
    buttonId: z.string().optional(),
    type: z.string().optional(),
    url: z.string().url().optional(),
  })).min(1).max(3),
});

export const sendCarouselSchema = z.object({
  phone: phoneSchema,
  template: z.string().optional(),
  cards: z.array(carouselCardTemplateSchema).min(1).max(10).optional(),
  message: z.string().optional(),
  carousel: z.array(carouselCardInteractiveSchema).min(1).optional(),
}).refine(
  (data) => (data.template && data.cards) || data.carousel,
  { message: 'Forneca template+cards ou carousel' }
);

/**
 * Schema para POST /api/n8n/set-hotel-unit
 */
export const setHotelUnitSchema = z.object({
  phone: phoneSchema.optional(),
  phoneNumber: phoneSchema.optional(),
  hotelUnit: z.string().min(1, 'hotelUnit e obrigatorio'),
}).refine(
  (data) => data.phone || data.phoneNumber,
  { message: 'Forneca phone ou phoneNumber' }
);

/**
 * Schema para POST /api/n8n/mark-followup-sent
 */
export const markFollowupSentSchema = z.object({
  phone: phoneSchema.optional(),
  phoneNumber: phoneSchema.optional(),
  flowType: z.enum(['comercial', 'duvidas']).optional(),
}).refine(
  (data) => data.phone || data.phoneNumber,
  { message: 'Forneca phone ou phoneNumber' }
);

/**
 * Schema para POST /api/n8n/mark-opportunity
 */
export const markOpportunitySchema = z.object({
  phone: phoneSchema.optional(),
  phoneNumber: phoneSchema.optional(),
  reason: z.enum(['not_completed', 'needs_help', 'wants_human', 'wants_reservation']).optional(),
  flowType: z.enum(['comercial', 'duvidas']).optional(),
  followupResponse: z.string().optional(),
}).refine(
  (data) => data.phone || data.phoneNumber,
  { message: 'Forneca phone ou phoneNumber' }
);

/**
 * Schema para POST /api/n8n/mark-read
 */
export const markReadSchema = z.object({
  messageId: z.string().optional(),
  whatsappMessageId: z.string().optional(),
}).refine(
  (data) => data.messageId || data.whatsappMessageId,
  { message: 'Forneca messageId ou whatsappMessageId' }
);

/**
 * Schema para GET /api/n8n/check-ia-lock
 */
export const checkIaLockSchema = z.object({
  phone: phoneSchema.optional(),
  phoneNumber: phoneSchema.optional(),
}).refine(
  (data) => data.phone || data.phoneNumber,
  { message: 'Forneca phone ou phoneNumber' }
);

/**
 * Schema para GET /api/n8n/check-availability
 */
export const checkAvailabilitySchema = z.object({
  unidade: z.string().min(1),
  checkin: z.string().min(1),
  checkout: z.string().min(1),
  adults: z.coerce.number().int().positive(),
  children: z.coerce.number().int().nonnegative().optional(),
  childrenAges: z.string().optional(),
});

/**
 * Schema para GET /api/n8n/check-room-availability
 */
export const checkRoomAvailabilitySchema = z.object({
  unidade: z.string().min(1),
  roomName: z.string().min(1),
  checkin: z.string().min(1),
  checkout: z.string().min(1),
  adults: z.coerce.number().int().positive(),
  children: z.coerce.number().int().nonnegative().optional(),
  childrenAges: z.string().optional(),
});

/**
 * Schema para POST /api/n8n/send-booking-flow
 */
export const sendBookingFlowSchema = z.object({
  phone: phoneSchema.optional(),
  phoneNumber: phoneSchema.optional(),
  conversationId: z.string().uuid().optional(),
  bodyText: z.string().max(1024).optional(),
}).refine(
  (data) => data.phone || data.phoneNumber,
  { message: 'Forneca phone ou phoneNumber' }
);

// Types inferidos
export type SendTextInput = z.infer<typeof sendTextSchema>;
export type SendButtonsInput = z.infer<typeof sendButtonsSchema>;
export type SendListInput = z.infer<typeof sendListSchema>;
export type SendMediaInput = z.infer<typeof sendMediaSchema>;
export type SendTemplateInput = z.infer<typeof sendTemplateSchema>;
export type EscalateInput = z.infer<typeof escalateSchema>;
export type SendCarouselInput = z.infer<typeof sendCarouselSchema>;
export type SetHotelUnitInput = z.infer<typeof setHotelUnitSchema>;
export type MarkFollowupSentInput = z.infer<typeof markFollowupSentSchema>;
export type MarkOpportunityInput = z.infer<typeof markOpportunitySchema>;
