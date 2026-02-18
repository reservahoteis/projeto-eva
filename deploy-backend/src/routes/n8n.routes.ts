import { Router, Request, Response } from 'express';
import { Channel } from '@prisma/client';
import { n8nAuthMiddleware } from '@/middlewares/n8n-auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { whatsAppService } from '@/services/whatsapp.service';
import { channelRouter } from '@/services/channels';

import { escalationService } from '@/services/escalation.service';
import { messageService } from '@/services/message.service';
import { hbookScraperService } from '@/services/hbook-scraper.service';

import {
  sendTextSchema,
  sendButtonsSchema,
  sendListSchema,
  sendMediaSchema,
  sendTemplateSchema,
  escalateSchema,
  sendCarouselSchema,
  setHotelUnitSchema,
  markFollowupSentSchema,
  markOpportunitySchema,
  markReadSchema,
  checkIaLockSchema,
  checkAvailabilitySchema,
  checkRoomAvailabilitySchema,
} from '@/validators/n8n.validator';
import { prisma } from '@/config/database';
import { emitNewConversation, emitConversationUpdate } from '@/config/socket';
import logger from '@/config/logger';
import { enqueueIaReactivation } from '@/queues/whatsapp-webhook.queue';

const router = Router();

/**
 * Converte channel string do payload N8N para enum Channel do Prisma.
 * Default: WHATSAPP (compatibilidade retroativa)
 */
function resolveChannel(channel?: string): Channel {
  if (!channel) return 'WHATSAPP';
  const map: Record<string, Channel> = {
    whatsapp: 'WHATSAPP',
    messenger: 'MESSENGER',
    instagram: 'INSTAGRAM',
  };
  return map[channel.toLowerCase()] || 'WHATSAPP';
}

/**
 * Auto-detecta o canal correto quando N8N nao envia o parametro `channel`.
 *
 * Problema: N8N recebe `channel: "messenger"` no payload inbound, mas ao responder
 * via /api/n8n/send-text, NAO envia o channel de volta. O default era WHATSAPP,
 * causando envio errado (PSID nao e telefone) e conversas duplicadas.
 *
 * Solucao: Antes de enviar, verificar se o `phone` (que pode ser PSID) pertence
 * a um contato MESSENGER ou INSTAGRAM. Se sim, usar esse canal.
 */
async function autoDetectChannel(tenantId: string, phoneOrExternalId: string, channelStr?: string): Promise<Channel> {
  // Se N8N passou channel explicitamente, usar
  if (channelStr) {
    return resolveChannel(channelStr);
  }

  // Auto-detect: verificar se esse identificador pertence a um contato nao-WhatsApp
  const nonWAContact = await prisma.contact.findFirst({
    where: {
      tenantId,
      externalId: phoneOrExternalId,
      channel: { in: ['MESSENGER', 'INSTAGRAM'] },
    },
    select: { channel: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (nonWAContact) {
    logger.info({
      tenantId,
      identifier: phoneOrExternalId,
      detectedChannel: nonWAContact.channel,
    }, '[N8N AUTO-DETECT] Canal detectado automaticamente (N8N nao enviou channel)');
    return nonWAContact.channel;
  }

  // Default: WhatsApp
  return 'WHATSAPP';
}

// Mapeamento de templates para seus textos (para exibição no painel)
const TEMPLATE_TEXTS: Record<string, string> = {
  'notificacao_atendente': '🚨 NOVO CHAMADO\n\n{{1}}\n\nChamado gerado via atendimento automatico.',
  // Adicione outros templates aqui conforme necessário
};

/**
 * Monta o conteúdo real do template substituindo os parâmetros
 * para exibição no painel como o destinatário vê
 */
function buildTemplateContent(templateName: string, params?: string[]): string {
  const templateText = TEMPLATE_TEXTS[templateName];

  if (!templateText) {
    // Se não temos o texto do template, retornar formato genérico com parâmetros
    if (params && params.length > 0) {
      return `[Template: ${templateName}]\n\n${params.join('\n')}`;
    }
    return `[Template: ${templateName}]`;
  }

  // Substituir {{1}}, {{2}}, etc. pelos parâmetros
  let content = templateText;
  if (params && params.length > 0) {
    params.forEach((param, index) => {
      content = content.replace(`{{${index + 1}}}`, param);
    });
  }

  return content;
}

// Todas as rotas usam autenticação por API Key
router.use(n8nAuthMiddleware);

/**
 * POST /api/n8n/send-text
 * Envia mensagem de texto simples
 *
 * Payload compatível com Z-API:
 * {
 *   "phone": "5511999999999",
 *   "message": "Texto da mensagem",
 *   "delayTyping": 1  // opcional, ignorado
 * }
 */
router.post('/send-text', validate(sendTextSchema), async (req: Request, res: Response) => {
  try {
    const { phone, message, channel: channelStr } = req.body;
    const normalizedId = phone?.replace(/\D/g, '') || '';
    const channel = await autoDetectChannel(req.tenantId!, normalizedId, channelStr);

    if (!phone || !message) {
      return res.status(400).json({
        error: 'Campos obrigatórios: phone, message',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    const result = await channelRouter.sendText(
      channel,
      req.tenantId!,
      normalizedPhone,
      message
    );

    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      externalMessageId: result.externalMessageId,
      type: 'TEXT',
      content: message,
      channel,
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      channel,
      messageId: result.externalMessageId,
    }, 'N8N: Text message sent and saved');

    return res.json({
      success: true,
      messageId: result.externalMessageId,
      botReservaResponse: {
        messageId: result.externalMessageId,
        id: result.externalMessageId,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to send text');
    return res.status(500).json({
      error: 'Falha ao enviar mensagem',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/send-buttons
 * Envia mensagem com botões interativos (máx 3)
 *
 * Payload compatível com Z-API:
 * {
 *   "phone": "5511999999999",
 *   "message": "Escolha uma opção:",
 *   "buttons": [
 *     { "id": "btn1", "label": "Opção 1" },
 *     { "id": "btn2", "label": "Opção 2" }
 *   ],
 *   "title": "Título opcional",
 *   "footer": "Rodapé opcional"
 * }
 */
router.post('/send-buttons', validate(sendButtonsSchema), async (req: Request, res: Response) => {
  try {
    const { phone, message, buttons, title, footer, channel: channelStr } = req.body;
    const normalizedId = phone?.replace(/\D/g, '') || '';
    const channel = await autoDetectChannel(req.tenantId!, normalizedId, channelStr);

    if (!phone || !message || !buttons || !Array.isArray(buttons)) {
      return res.status(400).json({
        error: 'Campos obrigatórios: phone, message, buttons (array)',
      });
    }

    if (buttons.length > 3) {
      return res.status(400).json({
        error: 'Máximo de 3 botões permitidos pela API do WhatsApp',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    const cloudApiButtons = buttons.map((btn: { id?: string; buttonId?: string; label?: string; title?: string; text?: string }) => ({
      id: btn.id || btn.buttonId || '',
      title: btn.label || btn.title || btn.text || '',
    }));

    const result = await channelRouter.sendButtons(
      channel,
      req.tenantId!,
      normalizedPhone,
      message,
      cloudApiButtons,
      title,
      footer
    );

    const buttonLabels = cloudApiButtons.map((btn) => btn.title).join(' | ');
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      externalMessageId: result.externalMessageId,
      type: 'INTERACTIVE',
      content: message,
      metadata: {
        interactiveType: 'buttons',
        title,
        footer,
        buttons: cloudApiButtons,
        buttonLabels,
      },
      channel,
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      channel,
      buttonsCount: buttons.length,
      messageId: result.externalMessageId,
    }, 'N8N: Buttons message sent and saved');

    return res.json({
      success: true,
      messageId: result.externalMessageId,
      botReservaResponse: {
        messageId: result.externalMessageId,
        id: result.externalMessageId,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to send buttons');
    return res.status(500).json({
      error: 'Falha ao enviar botões',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/send-list (send-option-list)
 * Envia mensagem com lista de opções (até 10 itens)
 *
 * Payload compatível com Z-API:
 * {
 *   "phone": "5511999999999",
 *   "message": "Escolha uma opção:",
 *   "optionList": {
 *     "title": "Menu Principal",
 *     "buttonLabel": "Ver opções",
 *     "options": [
 *       { "id": "opt1", "title": "Opção 1", "description": "Descrição" }
 *     ]
 *   }
 * }
 *
 * OU formato simplificado:
 * {
 *   "phone": "5511999999999",
 *   "message": "Escolha uma opção:",
 *   "buttonText": "Ver opções",
 *   "sections": [
 *     {
 *       "title": "Seção 1",
 *       "rows": [
 *         { "id": "opt1", "title": "Opção 1", "description": "Descrição" }
 *       ]
 *     }
 *   ]
 * }
 */
router.post('/send-list', validate(sendListSchema), async (req: Request, res: Response) => {
  try {
    const { phone, message, optionList, buttonText, sections, channel: channelStr } = req.body;
    const normalizedId = phone?.replace(/\D/g, '') || '';
    const channel = await autoDetectChannel(req.tenantId!, normalizedId, channelStr);

    if (!phone || !message) {
      return res.status(400).json({
        error: 'Campos obrigatórios: phone, message',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    let cloudApiSections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
    let buttonLabel: string;

    if (optionList) {
      buttonLabel = optionList.buttonLabel || 'Ver opções';
      cloudApiSections = [{
        title: optionList.title,
        rows: optionList.options.map((opt: { id?: string; rowId?: string; title: string; description?: string }) => ({
          id: opt.id || opt.rowId || '',
          title: opt.title,
          description: opt.description,
        })),
      }];
    } else if (sections) {
      buttonLabel = buttonText || 'Ver opções';
      cloudApiSections = sections;
    } else {
      return res.status(400).json({
        error: 'Forneça optionList (formato Z-API) ou sections (formato Cloud API)',
      });
    }

    const result = await channelRouter.sendList(
      channel,
      req.tenantId!,
      normalizedPhone,
      message,
      buttonLabel,
      cloudApiSections
    );

    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      externalMessageId: result.externalMessageId,
      type: 'INTERACTIVE',
      content: message,
      metadata: {
        interactiveType: 'list',
        buttonLabel,
        sections: cloudApiSections,
      },
      channel,
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      channel,
      messageId: result.externalMessageId,
    }, 'N8N: List message sent and saved');

    return res.json({
      success: true,
      messageId: result.externalMessageId,
      botReservaResponse: {
        messageId: result.externalMessageId,
        id: result.externalMessageId,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to send list');
    return res.status(500).json({
      error: 'Falha ao enviar lista',
      message: msg,
    });
  }
});

// Alias para compatibilidade Z-API (mesma logica de /send-list)

/**
 * POST /api/n8n/send-media
 * Envia mensagem com mídia (imagem, vídeo, áudio, documento)
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 *   "type": "image" | "video" | "audio" | "document",
 *   "url": "https://example.com/image.jpg",
 *   "caption": "Legenda opcional"
 * }
 */
router.post('/send-media', validate(sendMediaSchema), async (req: Request, res: Response) => {
  try {
    const { phone, type, url, caption, mediaUrl, image, video, audio, document, channel: channelStr } = req.body;
    const normalizedId = phone?.replace(/\D/g, '') || '';
    const channel = await autoDetectChannel(req.tenantId!, normalizedId, channelStr);

    if (!phone) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    let mediaType: 'image' | 'video' | 'audio' | 'document';
    let mediaLink: string;
    let mediaCaption: string | undefined;

    if (type && url) {
      mediaType = type;
      mediaLink = url;
      mediaCaption = caption;
    } else if (image) {
      mediaType = 'image';
      mediaLink = image.url || image;
      mediaCaption = image.caption || caption;
    } else if (video) {
      mediaType = 'video';
      mediaLink = video.url || video;
      mediaCaption = video.caption || caption;
    } else if (audio) {
      mediaType = 'audio';
      mediaLink = audio.url || audio;
    } else if (document) {
      mediaType = 'document';
      mediaLink = document.url || document;
      mediaCaption = document.caption || caption;
    } else if (mediaUrl) {
      const ext = mediaUrl.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
        mediaType = 'image';
      } else if (['mp4', 'avi', 'mov'].includes(ext || '')) {
        mediaType = 'video';
      } else if (['mp3', 'ogg', 'wav', 'opus'].includes(ext || '')) {
        mediaType = 'audio';
      } else {
        mediaType = 'document';
      }
      mediaLink = mediaUrl;
      mediaCaption = caption;
    } else {
      return res.status(400).json({
        error: 'Forneça type+url ou image/video/audio/document',
      });
    }

    const result = await channelRouter.sendMedia(
      channel,
      req.tenantId!,
      normalizedPhone,
      { type: mediaType, url: mediaLink, caption: mediaCaption }
    );

    const messageTypeMap: Record<string, 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'> = {
      image: 'IMAGE',
      video: 'VIDEO',
      audio: 'AUDIO',
      document: 'DOCUMENT',
    };

    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      externalMessageId: result.externalMessageId,
      type: messageTypeMap[mediaType] || 'IMAGE',
      content: mediaCaption || mediaLink,
      metadata: {
        mediaType,
        mediaUrl: mediaLink,
        caption: mediaCaption,
      },
      channel,
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      channel,
      mediaType,
      messageId: result.externalMessageId,
    }, 'N8N: Media message sent and saved');

    return res.json({
      success: true,
      messageId: result.externalMessageId,
      botReservaResponse: {
        messageId: result.externalMessageId,
        id: result.externalMessageId,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to send media');
    return res.status(500).json({
      error: 'Falha ao enviar mídia',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/send-template
 * Envia template pré-aprovado
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 *   "template": "nome_do_template",
 *   "language": "pt_BR",
 *   "parameters": ["param1", "param2"]
 * }
 */
router.post('/send-template', validate(sendTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { phone, template, templateName, language, languageCode, parameters, components, channel: channelStr } = req.body;
    const normalizedId = phone?.replace(/\D/g, '') || '';
    const channel = await autoDetectChannel(req.tenantId!, normalizedId, channelStr);

    if (!phone || (!template && !templateName)) {
      return res.status(400).json({
        error: 'Campos obrigatórios: phone, template',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    let templateParams: string[] | undefined = parameters;

    if (!templateParams && components && Array.isArray(components)) {
      const bodyComponent = components.find((c: { type: string; parameters?: Array<{ text?: string; value?: string }> }) => c.type === 'body');
      if (bodyComponent?.parameters && Array.isArray(bodyComponent.parameters)) {
        templateParams = bodyComponent.parameters.map((p: { text?: string; value?: string }) => p.text || p.value || '');
      }
    }

    const templateNameUsed = template || templateName;

    const result = await channelRouter.sendTemplate(
      channel,
      req.tenantId!,
      normalizedPhone,
      templateNameUsed,
      templateParams || [],
      languageCode || language || 'pt_BR'
    );

    const templateContent = buildTemplateContent(templateNameUsed, templateParams);

    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      externalMessageId: result.externalMessageId,
      type: 'TEMPLATE',
      content: templateContent,
      metadata: {
        templateName: templateNameUsed,
        language: languageCode || language || 'pt_BR',
        parameters: templateParams,
      },
      channel,
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      channel,
      template: templateNameUsed,
      messageId: result.externalMessageId,
    }, 'N8N: Template sent and saved');

    return res.json({
      success: true,
      messageId: result.externalMessageId,
      botReservaResponse: {
        messageId: result.externalMessageId,
        id: result.externalMessageId,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to send template');
    return res.status(500).json({
      error: 'Falha ao enviar template',
      message: msg,
    });
  }
});

/**
 * GET /api/n8n/check-ia-lock
 * Verifica se IA está travada para um telefone
 *
 * Query params:
 * - phone: número do telefone
 *
 * Response:
 * {
 *   "locked": true/false,
 *   "conversationId": "uuid" (se existir)
 * }
 */
router.get('/check-ia-lock', validate(checkIaLockSchema, 'query'), async (req: Request, res: Response) => {
  try {
    const { phone, phoneNumber } = req.query;
    const phoneToCheck = (phone || phoneNumber) as string;

    if (!phoneToCheck) {
      return res.status(400).json({
        error: 'Query param obrigatório: phone',
      });
    }

    const normalizedPhone = phoneToCheck.replace(/\D/g, '');

    // Auto-detectar canal para buscar contato correto
    const channel = await autoDetectChannel(req.tenantId!, normalizedPhone);

    const result = await escalationService.isIaLockedByPhone(
      req.tenantId!,
      normalizedPhone,
      channel
    );

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      channel,
      locked: result.locked,
    }, 'N8N: IA lock check');

    return res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to check IA lock');
    return res.status(500).json({
      error: 'Falha ao verificar lock',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/escalate
 * Criar escalação (transferir para humano)
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 *   "reason": "USER_REQUESTED",
 *   "reasonDetail": "Cliente pediu atendente",
 *   "hotelUnit": "Campos do Jordao",
 *   "messageHistory": [...],
 *   "priority": "HIGH"
 * }
 */
router.post('/escalate', validate(escalateSchema), async (req: Request, res: Response) => {
  try {
    const {
      phone,
      contactPhoneNumber,
      reason,
      reasonDetail,
      hotelUnit,
      messageHistory,
      aiContext,
      priority,
    } = req.body;

    const phoneToUse = phone || contactPhoneNumber;

    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phoneToUse.replace(/\D/g, '');

    const result = await escalationService.createEscalation({
      tenantId: req.tenantId!,
      contactPhoneNumber: normalizedPhone,
      reason: reason || 'OTHER',
      reasonDetail,
      hotelUnit,
      messageHistory,
      aiContext,
      priority: priority || 'HIGH',
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      escalationId: result.escalation.id,
      conversationId: result.conversation.id,
      reason,
    }, 'N8N: Escalation created');

    return res.status(201).json({
      success: true,
      escalation: result.escalation,
      conversation: result.conversation,
      contact: result.contact,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to create escalation');
    return res.status(500).json({
      error: 'Falha ao criar escalação',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/mark-read
 * Marcar mensagem como lida
 *
 * Payload:
 * {
 *   "messageId": "wamid.xxx"
 * }
 */
router.post('/mark-read', validate(markReadSchema), async (req: Request, res: Response) => {
  try {
    const { messageId, externalMessageId, channel: channelStr } = req.body;
    const channel = resolveChannel(channelStr); // mark-read nao precisa auto-detect (usa messageId)
    const msgId = messageId || externalMessageId;

    if (!msgId) {
      return res.status(400).json({
        error: 'Campo obrigatório: messageId',
      });
    }

    await channelRouter.markAsRead(channel, req.tenantId!, msgId);

    return res.json({
      success: true,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to mark as read');
    return res.status(500).json({
      error: 'Falha ao marcar como lido',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/send-carousel
 * Envia mensagem carousel (múltiplos cards com imagem e botões)
 *
 * MODO 1 - Template (carousel real):
 * Templates disponíveis:
 *   - carousel_quartos_geral: cards com 2 botões (Ver Detalhes, Voltar ao Menu)
 *   - carousel_quarto_fotos: cards com 2 botões (URL + Voltar ao Menu)
 *
 * Exemplo para carousel_quartos_geral:
 * {
 *   "phone": "5511999999999",
 *   "template": "carousel_quartos_geral",
 *   "cards": [
 *     {
 *       "imageUrl": "https://example.com/quarto-standard.jpg",
 *       "buttonPayloads": ["detalhes_standard", "menu"]
 *     },
 *     {
 *       "imageUrl": "https://example.com/suite-premium.jpg",
 *       "buttonPayloads": ["detalhes_premium", "menu"]
 *     }
 *   ]
 * }
 *
 * NOTA: imageUrl é OBRIGATÓRIO para cada card.
 * buttonPayloads é array com payload para cada botão quick_reply do template.
 *
 * MODO 2 - Mensagens interativas sequenciais (conteúdo dinâmico):
 * {
 *   "phone": "5511999999999",
 *   "message": "Confira nossas opções:",
 *   "carousel": [
 *     {
 *       "text": "Quarto Luxo - R$ 450/noite",
 *       "image": "https://example.com/quarto-luxo.jpg",
 *       "buttons": [
 *         { "id": "reservar_luxo", "label": "Reservar" }
 *       ]
 *     }
 *   ]
 * }
 *
 * Máximo 10 cards por carousel (template) ou 3 botões por card (interativo).
 */
router.post('/send-carousel', validate(sendCarouselSchema), async (req: Request, res: Response) => {
  try {
    const { phone, template, cards, message, carousel, channel: channelStr } = req.body;
    const normalizedId = phone?.replace(/\D/g, '') || '';
    const channel = await autoDetectChannel(req.tenantId!, normalizedId, channelStr);

    if (!phone) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    // Carousel template e feature exclusiva do WhatsApp
    if (channel !== 'WHATSAPP' && template) {
      return res.status(400).json({
        error: 'Carousel template só é suportado no WhatsApp',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    // MODO 1: Template carousel (WhatsApp only)
    if (template && cards) {
      if (!Array.isArray(cards) || cards.length === 0) {
        return res.status(400).json({
          error: 'Campo obrigatório: cards (array com pelo menos 1 item)',
        });
      }

      if (cards.length > 10) {
        return res.status(400).json({
          error: 'Máximo de 10 cards por carousel',
        });
      }

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card.imageUrl) {
          return res.status(400).json({
            error: `Card ${i + 1}: campo "imageUrl" é obrigatório`,
          });
        }
        if (!card.buttonPayloads || !Array.isArray(card.buttonPayloads) || card.buttonPayloads.length === 0) {
          return res.status(400).json({
            error: `Card ${i + 1}: campo "buttonPayloads" é obrigatório`,
          });
        }
      }

      interface CarouselCard { imageUrl: string; bodyParams?: string[]; buttonPayloads: string[] }

      const result = await whatsAppService.sendCarouselTemplate(
        req.tenantId!,
        normalizedPhone,
        template,
        cards.map((card: CarouselCard) => ({
          imageUrl: card.imageUrl,
          bodyParams: card.bodyParams,
          buttonPayloads: card.buttonPayloads,
        }))
      );

      await messageService.saveOutboundMessage({
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
        externalMessageId: result.externalMessageId,
        type: 'TEMPLATE',
        content: `[Carousel: ${template}] ${cards.length} cards`,
        metadata: {
          templateType: 'carousel',
          templateName: template,
          cardsCount: cards.length,
          cards: cards.map((card: CarouselCard) => ({
            imageUrl: card.imageUrl,
            bodyParams: card.bodyParams,
            buttonPayloads: card.buttonPayloads,
          })),
        },
      });

      logger.info({
        tenantId: req.tenantId,
        phone: normalizedPhone,
        template,
        cardsCount: cards.length,
        messageId: result.externalMessageId,
      }, 'N8N: Carousel template sent and saved');

      return res.json({
        success: true,
        messageId: result.externalMessageId,
        cardsCount: cards.length,
        mode: 'template',
        botReservaResponse: {
          messageId: result.externalMessageId,
          cardsCount: cards.length,
        },
      });
    }

    // MODO 2: Mensagens interativas sequenciais
    if (!carousel || !Array.isArray(carousel) || carousel.length === 0) {
      return res.status(400).json({
        error: 'Forneça "template" + "cards" (modo template) ou "carousel" (modo interativo)',
      });
    }

    for (let i = 0; i < carousel.length; i++) {
      const card = carousel[i];
      if (!card.text) {
        return res.status(400).json({ error: `Card ${i + 1}: campo "text" é obrigatório` });
      }
      if (!card.buttons || !Array.isArray(card.buttons) || card.buttons.length === 0) {
        return res.status(400).json({ error: `Card ${i + 1}: campo "buttons" é obrigatório` });
      }
      if (card.buttons.length > 3) {
        return res.status(400).json({ error: `Card ${i + 1}: máximo de 3 botões por card` });
      }
    }

    interface InteractiveBtn { id?: string; buttonId?: string; label?: string; title?: string; text?: string; type?: string; url?: string }
    interface InteractiveCard { text: string; image?: string; buttons: InteractiveBtn[] }

    // Para non-WhatsApp, enviar como sequencia de texto+botoes via channelRouter
    if (channel !== 'WHATSAPP') {
      const messageIds: string[] = [];

      if (message) {
        const introResult = await channelRouter.sendText(channel, req.tenantId!, normalizedPhone, message);
        messageIds.push(introResult.externalMessageId);
      }

      for (const card of carousel as InteractiveCard[]) {
        const cardText = card.image ? `${card.text}\n${card.image}` : card.text;
        const cardButtons = card.buttons.map((btn) => ({
          id: btn.id || btn.buttonId || '',
          title: btn.label || btn.title || btn.text || '',
        }));

        const cardResult = await channelRouter.sendButtons(
          channel, req.tenantId!, normalizedPhone, cardText, cardButtons
        );
        messageIds.push(cardResult.externalMessageId);
      }

      return res.json({
        success: true,
        messageId: messageIds[0],
        messageIds,
        cardsCount: carousel.length,
        mode: 'interactive-degraded',
      });
    }

    // WhatsApp: carousel interativo nativo
    const results = await whatsAppService.sendCarousel(
      req.tenantId!,
      normalizedPhone,
      message || '',
      (carousel as InteractiveCard[]).map((card) => ({
        text: card.text,
        image: card.image,
        buttons: card.buttons.map((btn) => ({
          id: btn.id || btn.buttonId || '',
          label: btn.label || btn.title || btn.text || '',
          type: (btn.type || 'reply') as 'reply' | 'url',
          url: btn.url,
        })),
      }))
    );

    const messageIds = results.map(r => r.externalMessageId);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const card = carousel[i];
      if (result && card) {
        await messageService.saveOutboundMessage({
          tenantId: req.tenantId!,
          phoneNumber: normalizedPhone,
          externalMessageId: result.externalMessageId,
          type: card.image ? 'IMAGE' : 'INTERACTIVE',
          content: card.text,
          metadata: {
            carouselIndex: i + 1,
            carouselTotal: carousel.length,
            imageUrl: card.image,
            buttons: card.buttons,
          },
        });
      }
    }

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      cardsCount: carousel.length,
      messagesSent: results.length,
    }, 'N8N: Carousel sent and saved');

    return res.json({
      success: true,
      messageId: messageIds[0],
      messageIds,
      cardsCount: carousel.length,
      mode: 'interactive',
      botReservaResponse: {
        messageIds,
        cardsCount: carousel.length,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to send carousel');
    return res.status(500).json({
      success: false,
      error: 'Falha ao enviar carousel',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/set-hotel-unit
 * Define a unidade hoteleira de uma conversa
 * Chamado quando o cliente seleciona a unidade na automação
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 *   "hotelUnit": "Ilhabela"
 * }
 *
 * Valores válidos para hotelUnit:
 * - "Ilhabela"
 * - "Campos do Jordão"
 * - "Camburi"
 * - "Santo Antônio do Pinhal"
 * - "Santa Smart Hotel"
 */
router.post('/set-hotel-unit', validate(setHotelUnitSchema), async (req: Request, res: Response) => {
  try {
    const { phone, phoneNumber, hotelUnit } = req.body;
    const phoneToUse = phone || phoneNumber;

    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    if (!hotelUnit) {
      return res.status(400).json({
        error: 'Campo obrigatório: hotelUnit',
      });
    }

    // Unidades hoteleiras válidas
    const VALID_HOTEL_UNITS = [
      'Ilhabela',
      'Campos do Jordão',
      'Camburi',
      'Santo Antônio do Pinhal',
      'Santa Smart Hotel',
    ];

    // Validar hotelUnit
    if (!VALID_HOTEL_UNITS.includes(hotelUnit)) {
      return res.status(400).json({
        error: `hotelUnit inválido. Valores válidos: ${VALID_HOTEL_UNITS.join(', ')}`,
      });
    }

    const normalizedPhone = phoneToUse.replace(/\D/g, '');

    // Buscar contato (por phoneNumber ou externalId para Messenger/Instagram)
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
      },
    });

    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: {
          tenantId: req.tenantId!,
          externalId: normalizedPhone,
          channel: { in: ['MESSENGER', 'INSTAGRAM'] },
        },
      });
    }

    if (!contact) {
      return res.status(404).json({
        error: 'Contato não encontrado',
      });
    }

    // Buscar conversa ativa do contato
    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: req.tenantId!,
        contactId: contact.id,
        status: {
          in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'],
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
            profilePictureUrl: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tags: true,
      },
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversa ativa não encontrada para este contato',
      });
    }

    // Atualizar apenas o hotelUnit da conversa (sem tags coloridas)
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        hotelUnit,
      },
      include: {
        contact: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
            profilePictureUrl: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Emitir evento Socket.io para notificar atendentes da unidade
    try {
      // Emitir conversation:updated para a unidade específica
      emitConversationUpdate(
        req.tenantId!,
        conversation.id,
        { hotelUnit },
        hotelUnit
      );

      // Emitir conversation:new para que apareça no kanban dos atendentes da unidade
      emitNewConversation(req.tenantId!, updatedConversation);

      logger.info({
        tenantId: req.tenantId,
        conversationId: conversation.id,
        hotelUnit,
        phone: normalizedPhone,
      }, 'N8N: Hotel unit set and Socket.io events emitted');
    } catch (error) {
      logger.warn({ error }, 'Failed to emit Socket.io events for hotel unit update');
    }

    return res.json({
      success: true,
      conversationId: conversation.id,
      hotelUnit,
      message: `Unidade hoteleira definida como: ${hotelUnit}`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to set hotel unit');
    return res.status(500).json({
      error: 'Falha ao definir unidade hoteleira',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/mark-followup-sent
 * Marca que o follow-up foi enviado para uma conversa
 * Chamado pelo N8N após enviar a mensagem de follow-up (5 min após término)
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 * }
 *
 * Ações:
 * - Marca metadata.followupSent = true na conversa
 * - Registra timestamp do envio
 * - Marca como oportunidade (isOpportunity = true) para time SALES
 * - Muda status para OPEN (aparecer no Kanban)
 * - Emite evento Socket.io para notificar time SALES
 */
router.post('/mark-followup-sent', validate(markFollowupSentSchema), async (req: Request, res: Response) => {
  try {
    const { phone, phoneNumber } = req.body;
    const phoneToUse = phone || phoneNumber;

    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phoneToUse.replace(/\D/g, '');

    // Buscar contato (por phoneNumber ou externalId para Messenger/Instagram)
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
      },
    });

    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: {
          tenantId: req.tenantId!,
          externalId: normalizedPhone,
          channel: { in: ['MESSENGER', 'INSTAGRAM'] },
        },
      });
    }

    if (!contact) {
      return res.status(404).json({
        error: 'Contato não encontrado',
      });
    }

    // Buscar conversa ativa do contato (inclui BOT_HANDLING)
    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: req.tenantId!,
        contactId: contact.id,
        status: {
          in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'],
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversa ativa não encontrada para este contato',
      });
    }

    // Atualizar conversa: marcar follow-up como enviado E como oportunidade para SALES
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        // Marcar como oportunidade para time SALES ver imediatamente
        isOpportunity: true,
        opportunityAt: new Date(),
        status: 'OPEN', // Muda para OPEN para aparecer no Kanban
        iaLocked: true, // Trava IA para atendimento humano
        iaLockedAt: new Date(),
        iaLockedBy: 'system:followup',
        metadata: {
          ...(conversation.metadata as object || {}),
          followupSent: true,
          followupSentAt: new Date().toISOString(),
          followupFlowType: 'default',
          opportunityReason: 'followup_sent',
          opportunityReasonDescription: 'Follow-up enviado - aguardando resposta do cliente',
          markedAsOpportunityAt: new Date().toISOString(),
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
            profilePictureUrl: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tags: true,
      },
    });

    // Agendar reativacao automatica da IA apos 1 hora
    try {
      await enqueueIaReactivation(conversation.id, req.tenantId!, 60 * 60 * 1000);
    } catch (scheduleError) {
      logger.warn({ error: scheduleError, conversationId: conversation.id }, 'Failed to schedule IA reactivation');
    }

    // Emitir evento Socket.io para notificar o time de vendas
    try {
      // Emitir conversation:new para aparecer no Kanban do SALES
      emitNewConversation(req.tenantId!, updatedConversation);

      // Emitir conversation:updated para atualizar em tempo real
      emitConversationUpdate(
        req.tenantId!,
        conversation.id,
        {
          isOpportunity: true,
          status: 'OPEN',
          followupSent: true,
        }
      );

      logger.info({
        tenantId: req.tenantId,
        conversationId: conversation.id,
        phone: normalizedPhone,
      }, 'N8N: Follow-up sent - conversation marked as opportunity for SALES');
    } catch (socketError) {
      logger.warn({ error: socketError }, 'Failed to emit Socket.io events for followup opportunity');
    }

    return res.json({
      success: true,
      conversationId: conversation.id,
      message: 'Follow-up marcado como enviado e oportunidade criada para time de vendas',
      followupSent: true,
      followupSentAt: new Date().toISOString(),
      isOpportunity: true,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to mark followup sent');
    return res.status(500).json({
      error: 'Falha ao marcar follow-up enviado',
      message: msg,
    });
  }
});

/**
 * POST /api/n8n/mark-opportunity
 * Atualiza motivo da oportunidade quando cliente responde ao follow-up
 *
 * NOTA: A oportunidade já é criada em /mark-followup-sent (quando follow-up é enviado).
 * Este endpoint atualiza o motivo específico quando cliente responde negativamente.
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 *   "reason": "not_completed" | "needs_help" | "wants_human" | "wants_reservation",
 *   "followupResponse": "2" | "3" | "4"
 * }
 *
 * Ações:
 * - Atualiza metadata com motivo específico da resposta do cliente
 * - Mantém isOpportunity = true (já definido em mark-followup-sent)
 * - Emite evento Socket.io para atualizar em tempo real
 */
router.post('/mark-opportunity', validate(markOpportunitySchema), async (req: Request, res: Response) => {
  try {
    const { phone, phoneNumber, reason, followupResponse } = req.body;
    const phoneToUse = phone || phoneNumber;

    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phoneToUse.replace(/\D/g, '');

    // Buscar contato (por phoneNumber ou externalId para Messenger/Instagram)
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
      },
    });

    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: {
          tenantId: req.tenantId!,
          externalId: normalizedPhone,
          channel: { in: ['MESSENGER', 'INSTAGRAM'] },
        },
      });
    }

    if (!contact) {
      return res.status(404).json({
        error: 'Contato não encontrado',
      });
    }

    // Buscar conversa ativa do contato (inclui BOT_HANDLING)
    const conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: req.tenantId!,
        contactId: contact.id,
        status: {
          in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'],
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversa ativa não encontrada para este contato',
      });
    }

    // Mapear reason para descrição legível
    const reasonDescriptions: Record<string, string> = {
      not_completed: 'Cliente não conseguiu completar a reserva',
      needs_help: 'Cliente ainda tem dúvidas',
      wants_human: 'Cliente quer falar com humano',
      wants_reservation: 'Cliente quer fazer reserva',
    };

    // Atualizar conversa: marcar como oportunidade e mudar status para OPEN
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        isOpportunity: true,
        opportunityAt: new Date(),
        status: 'OPEN', // Muda para OPEN para aparecer no Kanban
        iaLocked: true, // Trava IA para atendimento humano
        iaLockedAt: new Date(),
        iaLockedBy: 'system:followup',
        metadata: {
          ...(conversation.metadata as object || {}),
          opportunityReason: reason || 'followup_negative',
          opportunityReasonDescription: reasonDescriptions[reason] || 'Resposta negativa no follow-up',
          followupResponse: followupResponse || 'unknown',
          markedAsOpportunityAt: new Date().toISOString(),
        },
      },
      include: {
        contact: {
          select: {
            id: true,
            phoneNumber: true,
            name: true,
            profilePictureUrl: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tags: true,
      },
    });

    // Emitir evento Socket.io para notificar o time de vendas
    try {
      // Emitir conversation:new para aparecer no Kanban do SALES
      emitNewConversation(req.tenantId!, updatedConversation);

      // Emitir conversation:updated para atualizar em tempo real
      emitConversationUpdate(
        req.tenantId!,
        conversation.id,
        {
          isOpportunity: true,
          status: 'OPEN',
        }
      );

      logger.info({
        tenantId: req.tenantId,
        conversationId: conversation.id,
        phone: normalizedPhone,
        reason,
        followupResponse,
      }, 'N8N: Conversation marked as sales opportunity');
    } catch (socketError) {
      logger.warn({ error: socketError }, 'Failed to emit Socket.io events for opportunity');
    }

    return res.json({
      success: true,
      conversationId: conversation.id,
      isOpportunity: true,
      status: 'OPEN',
      message: 'Conversa marcada como oportunidade de venda',
      reason: reasonDescriptions[reason] || reason,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to mark opportunity');
    return res.status(500).json({
      error: 'Falha ao marcar oportunidade',
      message: msg,
    });
  }
});

/**
 * GET /api/n8n/check-availability
 * Verifica disponibilidade de quartos no HBook (motor de reservas)
 * Usa web scraping com Puppeteer para extrair dados em tempo real
 *
 * Query params:
 * - unidade: Nome da unidade (Ilhabela, Camburi, Campos, Santo Antonio, Santa)
 * - checkin: Data de check-in (DD/MM/YYYY)
 * - checkout: Data de check-out (DD/MM/YYYY)
 * - adults: Número de adultos
 * - children: (opcional) Número de crianças
 * - childrenAges: (opcional) Idades das crianças separadas por vírgula (ex: "5,8,12")
 *
 * Response:
 * {
 *   "success": true,
 *   "companyId": "5f15f591ab41d43ac0fed67e",
 *   "unidade": "Ilhabela",
 *   "checkin": "10/02/2026",
 *   "checkout": "15/02/2026",
 *   "adults": 2,
 *   "rooms": [
 *     {
 *       "id": "room-123",
 *       "name": "Suíte Master",
 *       "price": 450,
 *       "available": true,
 *       "imageUrl": "https://..."
 *     }
 *   ],
 *   "scrapedAt": "2026-02-04T12:00:00.000Z"
 * }
 */
router.get('/check-availability', validate(checkAvailabilitySchema, 'query'), async (req: Request, res: Response) => {
  try {
    const { unidade, checkin, checkout, adults, children, childrenAges } = req.query;

    // Se faltar parâmetros obrigatórios, retorna success: false em vez de erro
    // Isso permite que o fluxo N8N continue sem quebrar
    if (!unidade || !checkin || !checkout || !adults) {
      logger.info({
        tenantId: req.tenantId,
        unidade,
        checkin,
        checkout,
        adults,
      }, 'N8N: Check availability - missing parameters, returning empty');

      return res.json({
        success: false,
        companyId: '',
        unidade: unidade || '',
        checkin: checkin || '',
        checkout: checkout || '',
        adults: adults ? parseInt(adults as string, 10) : 0,
        rooms: [],
        scrapedAt: new Date().toISOString(),
        error: 'Parâmetros incompletos (datas não informadas)',
      });
    }

    // Parsear parâmetros
    const parsedAdults = parseInt(adults as string, 10);
    const parsedChildren = children ? parseInt(children as string, 10) : undefined;
    const parsedChildrenAges = childrenAges
      ? (childrenAges as string).split(',').map(age => parseInt(age.trim(), 10)).filter(age => !isNaN(age))
      : undefined;

    if (isNaN(parsedAdults) || parsedAdults < 1) {
      return res.status(400).json({
        error: 'Parâmetro "adults" deve ser um número maior que 0',
      });
    }

    logger.info({
      tenantId: req.tenantId,
      unidade,
      checkin,
      checkout,
      adults: parsedAdults,
      children: parsedChildren,
      childrenAges: parsedChildrenAges,
    }, 'N8N: Check availability request');

    // Executar scraping
    const result = await hbookScraperService.checkAvailability(
      unidade as string,
      checkin as string,
      checkout as string,
      parsedAdults,
      parsedChildren,
      parsedChildrenAges
    );

    if (!result.success) {
      logger.warn({
        tenantId: req.tenantId,
        unidade,
        error: result.error,
      }, 'N8N: Check availability failed');

      return res.status(result.error?.includes('não encontrada') ? 400 : 500).json(result);
    }

    logger.info({
      tenantId: req.tenantId,
      unidade,
      roomsFound: result.rooms.length,
    }, 'N8N: Check availability success');

    return res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to check availability');
    return res.status(500).json({
      success: false,
      error: 'Falha ao verificar disponibilidade',
      message: msg,
    });
  }
});

/**
 * GET /api/n8n/check-room-availability
 * Verifica se um quarto específico está disponível
 *
 * Query params:
 * - unidade: Nome da unidade
 * - roomName: Nome do quarto a verificar
 * - checkin: Data de check-in (DD/MM/YYYY)
 * - checkout: Data de check-out (DD/MM/YYYY)
 * - adults: Número de adultos
 * - children: (opcional) Número de crianças
 * - childrenAges: (opcional) Idades das crianças separadas por vírgula
 *
 * Response:
 * {
 *   "available": true,
 *   "room": { ... } // dados do quarto se disponível
 * }
 */
router.get('/check-room-availability', validate(checkRoomAvailabilitySchema, 'query'), async (req: Request, res: Response) => {
  try {
    const { unidade, roomName, checkin, checkout, adults, children, childrenAges } = req.query;

    // Validar parâmetros obrigatórios
    if (!unidade || !roomName || !checkin || !checkout || !adults) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios: unidade, roomName, checkin, checkout, adults',
        example: '/api/n8n/check-room-availability?unidade=Ilhabela&roomName=Suite Master&checkin=10/02/2026&checkout=15/02/2026&adults=2',
      });
    }

    const parsedAdults = parseInt(adults as string, 10);
    const parsedChildren = children ? parseInt(children as string, 10) : undefined;
    const parsedChildrenAges = childrenAges
      ? (childrenAges as string).split(',').map(age => parseInt(age.trim(), 10)).filter(age => !isNaN(age))
      : undefined;

    if (isNaN(parsedAdults) || parsedAdults < 1) {
      return res.status(400).json({
        error: 'Parâmetro "adults" deve ser um número maior que 0',
      });
    }

    logger.info({
      tenantId: req.tenantId,
      unidade,
      roomName,
      checkin,
      checkout,
      adults: parsedAdults,
    }, 'N8N: Check room availability request');

    // Verificar disponibilidade do quarto específico
    const result = await hbookScraperService.isRoomAvailable(
      unidade as string,
      roomName as string,
      checkin as string,
      checkout as string,
      parsedAdults,
      parsedChildren,
      parsedChildrenAges
    );

    logger.info({
      tenantId: req.tenantId,
      unidade,
      roomName,
      available: result.available,
    }, 'N8N: Check room availability result');

    return res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    logger.error({ error: msg, tenantId: req.tenantId }, 'N8N: Failed to check room availability');
    return res.status(500).json({
      available: false,
      error: 'Falha ao verificar disponibilidade do quarto',
      message: msg,
    });
  }
});

export default router;
