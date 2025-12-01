import { Router, Request, Response } from 'express';
import { n8nAuthMiddleware } from '@/middlewares/n8n-auth.middleware';
import { whatsAppService } from '@/services/whatsapp.service';
import { escalationService } from '@/services/escalation.service';
import { messageService } from '@/services/message.service';
import logger from '@/config/logger';

const router = Router();

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
router.post('/send-text', async (req: Request, res: Response) => {
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
router.post('/send-buttons', async (req: Request, res: Response) => {
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
router.post('/send-list', async (req: Request, res: Response) => {
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
router.post('/send-media', async (req: Request, res: Response) => {
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
router.post('/send-template', async (req: Request, res: Response) => {
  try {
    const { phone, template, templateName, language, parameters } = req.body;

    if (!phone || (!template && !templateName)) {
      return res.status(400).json({
        error: 'Campos obrigatórios: phone, template',
      });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    const result = await whatsAppService.sendTemplate(
      req.tenantId!,
      normalizedPhone,
      template || templateName,
      language || 'pt_BR',
      parameters
    );

    // Salvar mensagem no banco para aparecer no painel
    const templateNameUsed = template || templateName;
    await messageService.saveOutboundMessage({
      tenantId: req.tenantId!,
      phoneNumber: normalizedPhone,
      whatsappMessageId: result.whatsappMessageId,
      type: 'TEMPLATE',
      content: `[Template: ${templateNameUsed}]`,
      metadata: {
        templateName: templateNameUsed,
        language: language || 'pt_BR',
        parameters,
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
router.get('/check-ia-lock', async (req: Request, res: Response) => {
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
router.post('/escalate', async (req: Request, res: Response) => {
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
router.post('/mark-read', async (req: Request, res: Response) => {
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
router.post('/send-carousel', async (req: Request, res: Response) => {
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

export default router;
