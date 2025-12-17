import { Router, Request, Response } from 'express';
import { n8nAuthMiddleware } from '@/middlewares/n8n-auth.middleware';
import { whatsAppService } from '@/services/whatsapp.service';
import { escalationService } from '@/services/escalation.service';
import { messageService } from '@/services/message.service';
import { prisma } from '@/config/database';
import { emitNewConversation, emitConversationUpdate } from '@/config/socket';
import logger from '@/config/logger';

const router = Router();

/**
 * Configuração do número da central de vendas para notificações
 */
const SALES_CENTER_PHONE = '5511973178256';

/**
 * Mapeamento de unidades para nomes formatados
 */
const UNIT_DISPLAY_NAMES: Record<string, string> = {
  'ILHABELA': 'Ilha Bela',
  'CAMBURI': 'Camburi',
  'CAMPOS': 'Campos do Jordão',
  'PINHAL': 'Santo Antônio do Pinhal',
};

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

// ============================================
// ROTAS PÚBLICAS (sem autenticação)
// ============================================

/**
 * GET /api/n8n/track-click
 * Rastreia cliques em botões do WhatsApp e notifica a central de vendas
 *
 * Este endpoint é público pois é acessado diretamente via link no WhatsApp.
 * Não requer autenticação por API Key.
 *
 * Query Parameters:
 * @param {string} phone - Telefone do cliente (obrigatório)
 * @param {string} unidade - Nome da unidade: ILHABELA, CAMBURI, CAMPOS, PINHAL (obrigatório)
 * @param {string} quarto - Nome do quarto selecionado (obrigatório)
 * @param {string} redirect - URL de destino (URL encoded) (obrigatório)
 * @param {string} tenant - Slug do tenant (opcional, default: hoteis-reserva)
 *
 * @example
 * GET /api/n8n/track-click?phone=5512988367859&unidade=ILHABELA&quarto=Varanda%20Gourmet&redirect=https%3A%2F%2Fhbook.hsystem.com.br%2FBooking
 *
 * @returns 302 Redirect para a URL especificada
 */
router.get('/track-click', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const { phone, unidade, quarto, redirect, tenant: tenantSlug = 'hoteis-reserva' } = req.query;

    // Validação de parâmetros obrigatórios
    const missingParams: string[] = [];
    if (!phone) missingParams.push('phone');
    if (!unidade) missingParams.push('unidade');
    if (!quarto) missingParams.push('quarto');
    if (!redirect) missingParams.push('redirect');

    if (missingParams.length > 0) {
      logger.warn({
        missingParams,
        query: req.query
      }, 'Track-click: Missing required parameters');

      return res.status(400).json({
        error: 'Parâmetros obrigatórios ausentes',
        missing: missingParams,
        usage: '/api/n8n/track-click?phone=TELEFONE&unidade=UNIDADE&quarto=QUARTO&redirect=URL',
      });
    }

    // Decodificar e validar URL de redirect
    let redirectUrl: string;
    try {
      redirectUrl = decodeURIComponent(redirect as string);
      new URL(redirectUrl); // Valida se é uma URL válida
    } catch {
      logger.warn({ redirect }, 'Track-click: Invalid redirect URL');
      return res.status(400).json({
        error: 'URL de redirect inválida',
        provided: redirect,
      });
    }

    // Buscar tenant
    const tenantData = await prisma.tenant.findUnique({
      where: { slug: tenantSlug as string },
      select: {
        id: true,
        slug: true,
        name: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
      },
    });

    if (!tenantData) {
      logger.error({ tenantSlug }, 'Track-click: Tenant not found');
      // Mesmo com erro, redireciona para não prejudicar a experiência do cliente
      return res.redirect(302, redirectUrl);
    }

    // Formatar dados para a notificação
    const phoneFormatted = (phone as string).replace(/\D/g, '');
    const unidadeFormatted = UNIT_DISPLAY_NAMES[(unidade as string).toUpperCase()] || unidade;
    const quartoFormatted = decodeURIComponent(quarto as string);

    // Montar mensagem de notificação
    const notificationMessage = `Cliente ${phoneFormatted} da unidade ${unidadeFormatted} clicou para ver valores do quarto ${quartoFormatted}`;

    // Log do clique para analytics
    logger.info({
      event: 'click_track',
      phone: phoneFormatted,
      unidade: unidadeFormatted,
      quarto: quartoFormatted,
      tenantId: tenantData.id,
      tenantSlug: tenantData.slug,
      redirectUrl,
    }, 'Track-click: Click registered');

    // Enviar notificação para a central de vendas (fire-and-forget)
    // Não bloqueamos o redirect esperando a resposta
    whatsAppService.sendTemplate(
      tenantData.id,
      SALES_CENTER_PHONE,
      'notificacao_atendente',
      'pt_BR',
      [notificationMessage]
    ).then((result) => {
      logger.info({
        messageId: result.whatsappMessageId,
        phone: phoneFormatted,
        unidade: unidadeFormatted,
        quarto: quartoFormatted,
        duration: Date.now() - startTime,
      }, 'Track-click: Notification sent to sales center');
    }).catch((error) => {
      logger.error({
        error: error.message,
        phone: phoneFormatted,
        unidade: unidadeFormatted,
        salesPhone: SALES_CENTER_PHONE,
      }, 'Track-click: Failed to send notification');
    });

    // Redirect imediato para não atrasar a experiência do cliente
    return res.redirect(302, redirectUrl);

  } catch (error: any) {
    logger.error({
      error: error.message,
      query: req.query,
      duration: Date.now() - startTime,
    }, 'Track-click: Unexpected error');

    // Em caso de erro, tenta redirecionar se tiver URL válida
    const { redirect } = req.query;
    if (redirect) {
      try {
        const redirectUrl = decodeURIComponent(redirect as string);
        return res.redirect(302, redirectUrl);
      } catch {
        // URL inválida, retorna erro
      }
    }

    return res.status(500).json({
      error: 'Erro interno ao processar rastreamento',
      message: error.message,
    });
  }
});

// ============================================
// ROTAS AUTENTICADAS (requerem API Key)
// ============================================

// Todas as rotas abaixo usam autenticação por API Key
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

/**
 * POST /api/n8n/set-hotel-unit
 * Define a unidade hoteleira de uma conversa
 * Chamado quando o cliente seleciona a unidade na automação
 *
 * Payload:
 * {
 *   "phone": "5511999999999",
 *   "hotelUnit": "Ilha Bela"
 * }
 *
 * Valores válidos para hotelUnit:
 * - "Ilha Bela"
 * - "Campos do Jordão"
 * - "Camburi"
 * - "Santo Antônio do Pinhal"
 */
router.post('/set-hotel-unit', async (req: Request, res: Response) => {
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

    // Mapeamento de unidades para cores das tags
    const HOTEL_UNIT_COLORS: Record<string, string> = {
      'Ilha Bela': '#3B82F6',           // Azul
      'Campos do Jordão': '#10B981',    // Verde
      'Camburi': '#F59E0B',             // Amarelo/Laranja
      'Santo Antônio do Pinhal': '#8B5CF6', // Roxo
    };

    // Validar hotelUnit
    const validUnits = Object.keys(HOTEL_UNIT_COLORS);
    if (!validUnits.includes(hotelUnit)) {
      return res.status(400).json({
        error: `hotelUnit inválido. Valores válidos: ${validUnits.join(', ')}`,
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

    // Buscar ou criar a tag para a unidade hoteleira
    let tag = await prisma.tag.findUnique({
      where: {
        tenantId_name: {
          tenantId: req.tenantId!,
          name: hotelUnit,
        },
      },
    });

    if (!tag) {
      tag = await prisma.tag.create({
        data: {
          tenantId: req.tenantId!,
          name: hotelUnit,
          color: HOTEL_UNIT_COLORS[hotelUnit] ?? '#6B7280', // Fallback para cinza
        },
      });
      logger.info({
        tenantId: req.tenantId,
        tagId: tag.id,
        tagName: tag.name,
      }, 'N8N: Created new tag for hotel unit');
    }

    // Atualizar hotelUnit da conversa e vincular a tag
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        hotelUnit,
        tags: {
          // Desconectar tags de outras unidades e conectar a tag atual
          set: [{ id: tag.id }],
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
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
      },
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

export default router;
