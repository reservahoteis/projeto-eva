import { Router, Request, Response } from 'express';
import { n8nAuthMiddleware } from '@/middlewares/n8n-auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { whatsAppService } from '@/services/whatsapp.service';
import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';
import { escalationService } from '@/services/escalation.service';
import { messageService } from '@/services/message.service';
import { hbookScraperService } from '@/services/hbook-scraper.service';
import { sendFlowSchema as sendFlowFullSchema } from '@/validators/whatsapp-flows.validator';
const sendFlowBodySchema = sendFlowFullSchema.shape.body;
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
  sendBookingFlowSchema,
  checkAvailabilitySchema,
  checkRoomAvailabilitySchema,
} from '@/validators/n8n.validator';
import { prisma } from '@/config/database';
import { emitNewConversation, emitConversationUpdate } from '@/config/socket';
import logger from '@/config/logger';

const router = Router();

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
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        error: 'Campos obrigatórios: phone, message',
      });
    }

    // Normalizar telefone (remover caracteres especiais)
    const normalizedPhone = phone.replace(/\D/g, '');

    const result = await whatsAppService.sendTextMessage(
      req.tenantId!,
      normalizedPhone,
      message
    );

    // Salvar mensagem no banco para aparecer no painel
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: 'TEXT',
      content: message,
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      messageId: result.whatsappMessageId,
    }, 'N8N: Text message sent and saved');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      botReservaResponse: {
        messageId: result.whatsappMessageId,
        id: result.whatsappMessageId,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send text');
    return res.status(500).json({
      error: 'Falha ao enviar mensagem',
      message: error.message,
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
    const { phone, message, buttons, title, footer } = req.body;

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

    // Converter formato Z-API para Cloud API
    // Z-API: { id, label }
    // Cloud API: { id, title }
    const cloudApiButtons = buttons.map((btn: any) => ({
      id: btn.id || btn.buttonId,
      title: btn.label || btn.title || btn.text,
    }));

    const result = await whatsAppService.sendInteractiveButtons(
      req.tenantId!,
      normalizedPhone,
      message,
      cloudApiButtons,
      title,
      footer
    );

    // Salvar mensagem no banco para aparecer no painel
    // Para botões, salvamos o texto principal + info dos botões no metadata
    const buttonLabels = cloudApiButtons.map((btn: any) => btn.title).join(' | ');
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: 'INTERACTIVE',
      content: message,
      metadata: {
        interactiveType: 'buttons',
        title,
        footer,
        buttons: cloudApiButtons,
        buttonLabels,
      },
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      buttonsCount: buttons.length,
      messageId: result.whatsappMessageId,
    }, 'N8N: Buttons message sent and saved');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      botReservaResponse: {
        messageId: result.whatsappMessageId,
        id: result.whatsappMessageId,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send buttons');
    return res.status(500).json({
      error: 'Falha ao enviar botões',
      message: error.message,
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
    const { phone, message, optionList, buttonText, sections } = req.body;

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

    // Converter formato Z-API para Cloud API
    if (optionList) {
      // Formato Z-API
      buttonLabel = optionList.buttonLabel || 'Ver opções';
      cloudApiSections = [{
        title: optionList.title,
        rows: optionList.options.map((opt: any) => ({
          id: opt.id || opt.rowId,
          title: opt.title,
          description: opt.description,
        })),
      }];
    } else if (sections) {
      // Formato já compatível Cloud API
      buttonLabel = buttonText || 'Ver opções';
      cloudApiSections = sections;
    } else {
      return res.status(400).json({
        error: 'Forneça optionList (formato Z-API) ou sections (formato Cloud API)',
      });
    }

    const result = await whatsAppService.sendInteractiveList(
      req.tenantId!,
      normalizedPhone,
      message,
      buttonLabel,
      cloudApiSections
    );

    // Salvar mensagem no banco para aparecer no painel
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: 'INTERACTIVE',
      content: message,
      metadata: {
        interactiveType: 'list',
        buttonLabel,
        sections: cloudApiSections,
      },
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      messageId: result.whatsappMessageId,
    }, 'N8N: List message sent and saved');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      botReservaResponse: {
        messageId: result.whatsappMessageId,
        id: result.whatsappMessageId,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send list');
    return res.status(500).json({
      error: 'Falha ao enviar lista',
      message: error.message,
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
    const { phone, type, url, caption, mediaUrl, image, video, audio, document } = req.body;

    if (!phone) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    // Suportar múltiplos formatos de payload
    let mediaType: 'image' | 'video' | 'audio' | 'document';
    let mediaLink: string;
    let mediaCaption: string | undefined;

    if (type && url) {
      // Formato padrão
      mediaType = type;
      mediaLink = url;
      mediaCaption = caption;
    } else if (image) {
      // Formato Z-API alternativo
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
      // Detectar tipo pela extensão
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

    const result = await whatsAppService.sendMediaMessage(
      req.tenantId!,
      normalizedPhone,
      {
        type: mediaType,
        url: mediaLink,
        caption: mediaCaption,
      }
    );

    // Mapear tipo de mídia para MessageType
    const messageTypeMap: Record<string, 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'> = {
      image: 'IMAGE',
      video: 'VIDEO',
      audio: 'AUDIO',
      document: 'DOCUMENT',
    };

    // Salvar mensagem no banco para aparecer no painel
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: messageTypeMap[mediaType] || 'IMAGE',
      content: mediaCaption || mediaLink,
      metadata: {
        mediaType,
        mediaUrl: mediaLink,
        caption: mediaCaption,
      },
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      mediaType,
      messageId: result.whatsappMessageId,
    }, 'N8N: Media message sent and saved');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      botReservaResponse: {
        messageId: result.whatsappMessageId,
        id: result.whatsappMessageId,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send media');
    return res.status(500).json({
      error: 'Falha ao enviar mídia',
      message: error.message,
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
    const { phone, template, templateName, language, languageCode, parameters, components } = req.body;

    if (!phone || (!template && !templateName)) {
      return res.status(400).json({
        error: 'Campos obrigatórios: phone, template',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    // Extrair parâmetros - suporta tanto 'parameters' quanto 'components'
    let templateParams: string[] | undefined = parameters;

    // Se components foi enviado (formato N8N), extrair os parâmetros
    if (!templateParams && components && Array.isArray(components)) {
      const bodyComponent = components.find((c: any) => c.type === 'body');
      if (bodyComponent?.parameters && Array.isArray(bodyComponent.parameters)) {
        templateParams = bodyComponent.parameters.map((p: any) => p.text || p.value || '');
      }
    }

    const result = await whatsAppService.sendTemplate(
      req.tenantId!,
      normalizedPhone,
      template || templateName,
      languageCode || language || 'pt_BR',
      templateParams
    );

    // Salvar mensagem no banco para aparecer no painel
    const templateNameUsed = template || templateName;

    // Montar conteúdo real do template para exibição no painel
    const templateContent = buildTemplateContent(templateNameUsed, templateParams);

    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: 'TEMPLATE',
      content: templateContent,
      metadata: {
        templateName: templateNameUsed,
        language: languageCode || language || 'pt_BR',
        parameters: templateParams,
      },
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      template: templateNameUsed,
      messageId: result.whatsappMessageId,
    }, 'N8N: Template sent and saved');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      botReservaResponse: {
        messageId: result.whatsappMessageId,
        id: result.whatsappMessageId,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send template');
    return res.status(500).json({
      error: 'Falha ao enviar template',
      message: error.message,
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

    const result = await escalationService.isIaLockedByPhone(
      req.tenantId!,
      normalizedPhone
    );

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      locked: result.locked,
    }, 'N8N: IA lock check');

    return res.json(result);
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to check IA lock');
    return res.status(500).json({
      error: 'Falha ao verificar lock',
      message: error.message,
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
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to create escalation');
    return res.status(500).json({
      error: 'Falha ao criar escalação',
      message: error.message,
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
    const { messageId, whatsappMessageId } = req.body;
    const msgId = messageId || whatsappMessageId;

    if (!msgId) {
      return res.status(400).json({
        error: 'Campo obrigatório: messageId',
      });
    }

    await whatsAppService.markAsRead(req.tenantId!, msgId);

    return res.json({
      success: true,
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to mark as read');
    return res.status(500).json({
      error: 'Falha ao marcar como lido',
      message: error.message,
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
    const { phone, template, cards, message, carousel } = req.body;

    if (!phone) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    // MODO 1: Usar template aprovado da Meta (carousel real)
    // O template tem conteúdo fixo (texto e imagens) - só os payloads dos botões são dinâmicos
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

      // Validar estrutura dos cards
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        // imageUrl é obrigatório para templates de carousel
        if (!card.imageUrl) {
          return res.status(400).json({
            error: `Card ${i + 1}: campo "imageUrl" é obrigatório (URL da imagem do card)`,
          });
        }
        // buttonPayloads é obrigatório - array com payload para cada botão
        if (!card.buttonPayloads || !Array.isArray(card.buttonPayloads) || card.buttonPayloads.length === 0) {
          return res.status(400).json({
            error: `Card ${i + 1}: campo "buttonPayloads" é obrigatório (array de payloads para cada botão)`,
          });
        }
      }

      const result = await whatsAppService.sendCarouselTemplate(
        req.tenantId!,
        normalizedPhone,
        template,
        cards.map((card: any) => ({
          imageUrl: card.imageUrl, // Opcional - só se template aceita imagem dinâmica
          bodyParams: card.bodyParams, // Opcional - só se template tem variáveis {{1}}
          buttonPayloads: card.buttonPayloads, // Obrigatório - payload para cada botão
        }))
      );

      // Salvar mensagem no banco para aparecer no painel
      await messageService.saveOutboundMessage({
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
        whatsappMessageId: result.whatsappMessageId,
        type: 'TEMPLATE',
        content: `[Carousel: ${template}] ${cards.length} cards`,
        metadata: {
          templateType: 'carousel',
          templateName: template,
          cardsCount: cards.length,
          cards: cards.map((card: any) => ({
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
        messageId: result.whatsappMessageId,
      }, 'N8N: Carousel template sent and saved');

      return res.json({
        success: true,
        messageId: result.whatsappMessageId,
        cardsCount: cards.length,
        mode: 'template',
        botReservaResponse: {
          messageId: result.whatsappMessageId,
          cardsCount: cards.length,
        },
      });
    }

    // MODO 2: Mensagens interativas sequenciais (fallback)
    if (!carousel || !Array.isArray(carousel) || carousel.length === 0) {
      return res.status(400).json({
        error: 'Forneça "template" + "cards" (modo template) ou "carousel" (modo interativo)',
      });
    }

    // Validar estrutura dos cards
    for (let i = 0; i < carousel.length; i++) {
      const card = carousel[i];
      if (!card.text) {
        return res.status(400).json({
          error: `Card ${i + 1}: campo "text" é obrigatório`,
        });
      }
      if (!card.buttons || !Array.isArray(card.buttons) || card.buttons.length === 0) {
        return res.status(400).json({
          error: `Card ${i + 1}: campo "buttons" é obrigatório (array com pelo menos 1 botão)`,
        });
      }
      if (card.buttons.length > 3) {
        return res.status(400).json({
          error: `Card ${i + 1}: máximo de 3 botões por card`,
        });
      }
    }

    const results = await whatsAppService.sendCarousel(
      req.tenantId!,
      normalizedPhone,
      message || '',
      carousel.map((card: any) => ({
        text: card.text,
        image: card.image,
        buttons: card.buttons.map((btn: any) => ({
          id: btn.id || btn.buttonId,
          label: btn.label || btn.title || btn.text,
          type: btn.type || 'reply',
          url: btn.url,
        })),
      }))
    );

    // Retornar array de IDs das mensagens enviadas
    const messageIds = results.map(r => r.whatsappMessageId);

    // Salvar cada mensagem no banco para aparecer no painel
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const card = carousel[i];
      if (result && card) {
        await messageService.saveOutboundMessage({
          tenantId: req.tenantId!,
          phoneNumber: normalizedPhone,
          whatsappMessageId: result.whatsappMessageId,
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
      messageId: messageIds[0], // Primeiro ID para compatibilidade
      messageIds: messageIds, // Todos os IDs
      cardsCount: carousel.length,
      mode: 'interactive',
      botReservaResponse: {
        messageIds: messageIds,
        cardsCount: carousel.length,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send carousel');
    return res.status(500).json({
      success: false,
      error: 'Falha ao enviar carousel',
      message: error.message,
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

    // Buscar contato
    const contact = await prisma.contact.findFirst({
      where: {
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
      },
    });

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
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to set hotel unit');
    return res.status(500).json({
      error: 'Falha ao definir unidade hoteleira',
      message: error.message,
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
 *   "flowType": "comercial" | "duvidas"
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
    const { phone, phoneNumber, flowType } = req.body;
    const phoneToUse = phone || phoneNumber;

    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phoneToUse.replace(/\D/g, '');

    // Buscar contato
    const contact = await prisma.contact.findFirst({
      where: {
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
      },
    });

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
          followupFlowType: flowType || 'unknown',
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
        flowType,
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
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to mark followup sent');
    return res.status(500).json({
      error: 'Falha ao marcar follow-up enviado',
      message: error.message,
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
 *   "flowType": "comercial" | "duvidas",
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
    const { phone, phoneNumber, reason, flowType, followupResponse } = req.body;
    const phoneToUse = phone || phoneNumber;

    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone',
      });
    }

    const normalizedPhone = phoneToUse.replace(/\D/g, '');

    // Buscar contato
    const contact = await prisma.contact.findFirst({
      where: {
        tenantId: req.tenantId!,
        phoneNumber: normalizedPhone,
      },
    });

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
          flowType: flowType || 'unknown',
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
        flowType,
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
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to mark opportunity');
    return res.status(500).json({
      error: 'Falha ao marcar oportunidade',
      message: error.message,
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
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to check availability');
    return res.status(500).json({
      success: false,
      error: 'Falha ao verificar disponibilidade',
      message: error.message,
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
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to check room availability');
    return res.status(500).json({
      available: false,
      error: 'Falha ao verificar disponibilidade do quarto',
      message: error.message,
    });
  }
});

/**
 * POST /api/n8n/send-flow
 * Envia WhatsApp Flow (formulário interativo nativo)
 *
 * WhatsApp Flows permite criar formulários nativos no WhatsApp com:
 * - Validação de campos
 * - Navegação entre telas
 * - Campos customizados (texto, número, dropdown, etc)
 *
 * Payload:
 * {
 *   "phoneNumber": "5511999999999",
 *   "flowId": "uuid-do-flow",
 *   "flowToken": "token-unico-para-tracking",
 *   "ctaText": "Fazer Orçamento",
 *   "headerText": "Orçamento Rápido",
 *   "bodyText": "Preencha o formulário para receber seu orçamento",
 *   "conversationId": "uuid-opcional"
 * }
 *
 * Validação:
 * - phoneNumber: formato brasileiro 5511999999999 (55 + DDD + 9 dígitos)
 * - flowId: UUID do flow publicado no WhatsApp Business Manager
 * - flowToken: token único para identificar a sessão (usado para rastrear respostas)
 * - ctaText: texto do botão (máx 20 caracteres)
 * - headerText: opcional, texto do cabeçalho (máx 60 caracteres)
 * - bodyText: opcional, texto do corpo (máx 1024 caracteres)
 * - conversationId: opcional, ID da conversa para vincular ao histórico
 *
 * Response:
 * {
 *   "success": true,
 *   "messageId": "wamid.xxx",
 *   "flowToken": "token-unico",
 *   "botReservaResponse": {
 *     "messageId": "wamid.xxx",
 *     "id": "wamid.xxx"
 *   }
 * }
 */
router.post('/send-flow', validate(sendFlowBodySchema), async (req: Request, res: Response) => {
  try {
    const {
      phoneNumber,
      flowId,
      flowToken,
      ctaText,
      headerText,
      bodyText,
      conversationId,
    } = req.body;

    // Normalizar telefone (remover caracteres especiais se houver)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      flowId,
      flowToken,
      conversationId,
    }, 'N8N: Send flow request');

    // Enviar flow via WhatsApp Flows API
    const result = await whatsAppFlowsService.sendFlow(
      req.tenantId!,
      normalizedPhone,
      flowId,
      flowToken,
      ctaText,
      {
        headerText,
        bodyText,
        flowCta: 'navigate', // Tipo de CTA (navigate ou data_exchange)
        flowAction: 'navigate', // Ação inicial do flow
      }
    );

    // Salvar mensagem no banco para aparecer no painel
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: 'INTERACTIVE',
      content: bodyText || 'Toque no botão abaixo para começar',
      metadata: {
        interactiveType: 'flow',
        flowId,
        flowToken,
        ctaText,
        headerText,
        bodyText,
        conversationId,
      },
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      flowId,
      flowToken,
      messageId: result.whatsappMessageId,
    }, 'N8N: Flow sent and saved');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      flowToken,
      botReservaResponse: {
        messageId: result.whatsappMessageId,
        id: result.whatsappMessageId,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send flow');
    return res.status(500).json({
      error: 'Falha ao enviar flow',
      message: error.message,
    });
  }
});

/**
 * POST /api/n8n/send-booking-flow
 * Envia WhatsApp Flow de Orçamento de Hospedagem (simplificado)
 *
 * Busca automaticamente o bookingFlowId do tenant - não precisa enviar flowId
 * O Flow já deve estar publicado na Meta (ID: 3052481088276895)
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 *   "conversationId": "uuid-opcional" // Para rastrear resposta na conversa
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "messageId": "wamid.xxx",
 *   "flowToken": "booking_{conversationId}_{timestamp}"
 * }
 */
router.post('/send-booking-flow', validate(sendBookingFlowSchema), async (req: Request, res: Response) => {
  try {
    const { phone, phoneNumber, conversationId, bodyText } = req.body;
    const phoneToUse = phoneNumber || phone;

    if (!phoneToUse) {
      return res.status(400).json({
        error: 'Campo obrigatório: phone ou phoneNumber',
      });
    }

    // Normalizar telefone (remover caracteres especiais)
    const normalizedPhone = phoneToUse.replace(/\D/g, '');

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      conversationId,
    }, 'N8N: Send booking flow request');

    // Enviar flow de orçamento usando bookingFlowId do tenant
    const result = await whatsAppFlowsService.sendBookingFlow(
      req.tenantId!,
      normalizedPhone,
      {
        conversationId,
        bodyText,
      }
    );

    // Salvar mensagem no banco para aparecer no painel
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: 'INTERACTIVE',
      content: bodyText || 'Para solicitar seu orçamento de hospedagem, clique no botão abaixo e preencha o formulário! 🏨',
      metadata: {
        interactiveType: 'booking_flow',
        flowToken: result.flowToken,
        conversationId,
      },
    });

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      flowToken: result.flowToken,
      messageId: result.whatsappMessageId,
    }, 'N8N: Booking flow sent and saved');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      flowToken: result.flowToken,
      botReservaResponse: {
        messageId: result.whatsappMessageId,
        id: result.whatsappMessageId,
        flowToken: result.flowToken,
      },
    });
  } catch (error: any) {
    logger.error({ error, tenantId: req.tenantId }, 'N8N: Failed to send booking flow');
    return res.status(500).json({
      error: 'Falha ao enviar flow de orçamento',
      message: error.message,
    });
  }
});

export default router;
