import { Router, Request, Response } from 'express';
import { n8nAuthMiddleware } from '@/middlewares/n8n-auth.middleware';
import { whatsAppService } from '@/services/whatsapp.service';
import { escalationService } from '@/services/escalation.service';
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
    const { phone, message, delayTyping } = req.body;

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

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      messageId: result.whatsappMessageId,
    }, 'N8N: Text message sent');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      zapiResponse: { // Formato compatível Z-API
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

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      buttonsCount: buttons.length,
      messageId: result.whatsappMessageId,
    }, 'N8N: Buttons message sent');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      zapiResponse: {
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

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      messageId: result.whatsappMessageId,
    }, 'N8N: List message sent');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      zapiResponse: {
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

// Alias para compatibilidade Z-API
router.post('/send-option-list', async (req: Request, res: Response) => {
  // Redirecionar para /send-list
  req.url = '/send-list';
  return router.handle(req, res, () => {});
});

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

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      mediaType,
      messageId: result.whatsappMessageId,
    }, 'N8N: Media message sent');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      zapiResponse: {
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

    logger.info({
      tenantId: req.tenantId,
      phone: normalizedPhone,
      template: template || templateName,
      messageId: result.whatsappMessageId,
    }, 'N8N: Template sent');

    return res.json({
      success: true,
      messageId: result.whatsappMessageId,
      zapiResponse: {
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

export default router;
