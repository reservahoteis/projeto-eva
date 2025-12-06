import { Job } from 'bull';
import { prisma } from '@/config/database';
import logger from '@/config/logger';
import type { ProcessMessageJobData } from '../whatsapp-webhook.queue';
import {
  isTextMessage,
  isImageMessage,
  isVideoMessage,
  isAudioMessage,
  isDocumentMessage,
  isLocationMessage,
  isButtonReply,
  isListReply,
  isInteractiveButtonReply,
  isTemplateButtonReply,
} from '@/validators/whatsapp-webhook.validator';
import { enqueueMediaDownload } from '../whatsapp-webhook.queue';
import { emitNewMessage, emitNewConversation, emitConversationUpdate, getSocketIO } from '@/config/socket';
import { whatsAppService } from '@/services/whatsapp.service';
import { n8nService } from '@/services/n8n.service';

// Unidades hoteleiras válidas para detecção automática
const VALID_HOTEL_UNITS = [
  'Ilha Bela',
  'Campos do Jordão',
  'Camburi',
  'Santo Antônio do Pinhal',
];

// Mapeamento de IDs/aliases para nomes de unidades (caso o N8N use IDs diferentes)
const HOTEL_UNIT_ALIASES: Record<string, string> = {
  'ilha_bela': 'Ilha Bela',
  'ilhabela': 'Ilha Bela',
  'campos_jordao': 'Campos do Jordão',
  'camposdojordao': 'Campos do Jordão',
  'camburi': 'Camburi',
  'santo_antonio': 'Santo Antônio do Pinhal',
  'santoantonio': 'Santo Antônio do Pinhal',
  'santo_antonio_pinhal': 'Santo Antônio do Pinhal',
};

/**
 * Worker para processar mensagens recebidas do WhatsApp
 */
export async function processIncomingMessage(job: Job<ProcessMessageJobData>): Promise<void> {
  const { tenantId, message, contactName } = job.data;

  logger.info(
    {
      jobId: job.id,
      tenantId,
      messageId: message.id,
      from: message.from,
      type: message.type,
    },
    'Processing incoming message'
  );

  try {
    // 1. ENCONTRAR OU CRIAR CONTATO
    const contact = await findOrCreateContact(tenantId, message.from, contactName);

    // 2. ENCONTRAR OU CRIAR CONVERSA
    const conversation = await findOrCreateConversation(tenantId, contact.id);

    // 3. EXTRAIR DADOS DA MENSAGEM BASEADO NO TIPO
    const messageData = extractMessageData(message);

    // 4. SALVAR MENSAGEM NO BANCO
    const savedMessage = await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        whatsappMessageId: message.id,
        direction: 'INBOUND',
        type: messageData.type as any, // Type validated by extractMessageData
        content: messageData.content,
        metadata: messageData.metadata,
        status: 'DELIVERED',
        timestamp: new Date(parseInt(message.timestamp) * 1000),
      },
    });

    // 5. ATUALIZAR lastMessageAt DA CONVERSA
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: savedMessage.timestamp,
        status: (conversation.status === 'CLOSED' ? 'OPEN' : conversation.status) as any,
      },
    });

    // 5.1 DETECTAR SELEÇÃO DE UNIDADE HOTELEIRA (list_reply)
    const detectedHotelUnit = detectHotelUnitSelection(message, messageData);
    if (detectedHotelUnit) {
      await handleHotelUnitSelection(tenantId, conversation.id, detectedHotelUnit, contact);
    }

    // 6. SE FOR MÍDIA, ENFILEIRAR DOWNLOAD
    if (messageData.shouldDownload && messageData.mediaId) {
      await enqueueMediaDownload({
        tenantId,
        messageId: savedMessage.id,
        mediaId: messageData.mediaId,
        mediaType: messageData.type as any,
        mimeType: messageData.metadata?.mimeType || 'application/octet-stream',
      });
    }

    // 7. EMITIR EVENTO WEBSOCKET (TEMPO REAL)
    // CORREÇÃO: Passar conversation completo como 4º parâmetro
    emitNewMessage(
      tenantId,
      conversation.id,
      {
        id: savedMessage.id,
        conversationId: conversation.id,
        whatsappMessageId: savedMessage.whatsappMessageId,
        direction: savedMessage.direction,
        type: savedMessage.type,
        content: savedMessage.content,
        metadata: savedMessage.metadata,
        status: savedMessage.status,
        timestamp: savedMessage.timestamp,
        contactId: contact.id,
      },
      {
        // Objeto conversation completo esperado pelo frontend
        id: conversation.id,
        status: conversation.status,
        contact: {
          id: contact.id,
          phoneNumber: contact.phoneNumber,
          name: contact.name,
          profilePictureUrl: contact.profilePictureUrl,
        },
      }
    );

    // 8. ENCAMINHAR PARA N8N (IA)
    // Verificar se conversa foi criada agora (para saber se é novo contato)
    const isNewConversation = conversation.status === 'OPEN';

    const n8nPayload = n8nService.buildPayload(
      contact.phoneNumber,
      {
        id: savedMessage.id,
        type: savedMessage.type,
        content: savedMessage.content || '',
        metadata: savedMessage.metadata,
        timestamp: savedMessage.timestamp,
      },
      conversation.id,
      contact.name,
      isNewConversation
    );

    // Chamar N8N de forma assíncrona (não bloqueia o processamento)
    n8nService.forwardToN8N(tenantId, n8nPayload).catch((err) => {
      logger.error({ tenantId, messageId: savedMessage.id, error: err.message }, 'Failed to forward to N8N');
    });

    logger.info(
      {
        jobId: job.id,
        tenantId,
        messageId: message.id,
        savedMessageId: savedMessage.id,
        conversationId: conversation.id,
        contactId: contact.id,
      },
      'Incoming message processed successfully'
    );
  } catch (error) {
    logger.error(
      {
        jobId: job.id,
        tenantId,
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Error processing incoming message'
    );

    throw error; // Re-throw para Bull tentar novamente
  }
}

/**
 * Encontra ou cria contato
 */
async function findOrCreateContact(
  tenantId: string,
  phoneNumber: string,
  name?: string
): Promise<{ id: string; phoneNumber: string; name: string | null; profilePictureUrl: string | null }> {
  // Buscar contato existente
  let contact = await prisma.contact.findUnique({
    where: {
      tenantId_phoneNumber: {
        tenantId,
        phoneNumber,
      },
    },
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      profilePictureUrl: true,
    },
  });

  // Se não existe, criar
  if (!contact) {
    // Buscar foto de perfil do WhatsApp (não bloqueia criação se falhar)
    let profilePictureUrl: string | null = null;
    try {
      profilePictureUrl = await whatsAppService.getProfilePicture(tenantId, phoneNumber);
    } catch (error) {
      logger.debug({ tenantId, phoneNumber, error }, 'Could not fetch profile picture for new contact');
    }

    contact = await prisma.contact.create({
      data: {
        tenantId,
        phoneNumber,
        name: name || null,
        profilePictureUrl,
      },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        profilePictureUrl: true,
      },
    });

    logger.info({ tenantId, contactId: contact.id, phoneNumber, hasProfilePicture: !!profilePictureUrl }, 'New contact created');
  }
  // Se existe mas nome mudou ou não tem foto, atualizar
  else {
    const needsUpdate = (name && name !== contact.name) || !contact.profilePictureUrl;

    if (needsUpdate) {
      // Buscar foto de perfil se não tem
      let profilePictureUrl = contact.profilePictureUrl;
      if (!profilePictureUrl) {
        try {
          profilePictureUrl = await whatsAppService.getProfilePicture(tenantId, phoneNumber);
        } catch (error) {
          logger.debug({ tenantId, phoneNumber, error }, 'Could not fetch profile picture for existing contact');
        }
      }

      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          ...(name && name !== contact.name && { name }),
          ...(profilePictureUrl && !contact.profilePictureUrl && { profilePictureUrl }),
        },
        select: {
          id: true,
          phoneNumber: true,
          name: true,
          profilePictureUrl: true,
        },
      });

      logger.debug({ tenantId, contactId: contact.id, hasProfilePicture: !!contact.profilePictureUrl }, 'Contact updated');
    }
  }

  return contact;
}

/**
 * Encontra conversa aberta ou cria nova
 */
async function findOrCreateConversation(
  tenantId: string,
  contactId: string
): Promise<{ id: string; status: string }> {
  // Buscar conversa aberta ou em progresso
  let conversation = await prisma.conversation.findFirst({
    where: {
      tenantId,
      contactId,
      status: {
        in: ['OPEN', 'IN_PROGRESS', 'WAITING'],
      },
    },
    select: {
      id: true,
      status: true,
    },
    orderBy: {
      lastMessageAt: 'desc',
    },
  });

  // Se não existe, criar
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        tenantId,
        contactId,
        status: 'OPEN',
        priority: 'MEDIUM',
        lastMessageAt: new Date(),
      },
      select: {
        id: true,
        status: true,
      },
    });

    logger.info({ tenantId, conversationId: conversation.id, contactId }, 'New conversation created');
  }

  return conversation;
}

/**
 * Extrai dados da mensagem baseado no tipo
 */
function extractMessageData(message: any): {
  type: string;
  content: string;
  metadata: any;
  shouldDownload: boolean;
  mediaId?: string;
} {
  // TEXT
  if (isTextMessage(message)) {
    return {
      type: 'TEXT',
      content: message.text.body,
      metadata: message.context ? { context: message.context } : null,
      shouldDownload: false,
    };
  }

  // IMAGE
  if (isImageMessage(message)) {
    return {
      type: 'IMAGE',
      content: message.image.id, // Media ID
      metadata: {
        caption: message.image.caption,
        mimeType: message.image.mime_type,
        sha256: message.image.sha256,
      },
      shouldDownload: true,
      mediaId: message.image.id,
    };
  }

  // VIDEO
  if (isVideoMessage(message)) {
    return {
      type: 'VIDEO',
      content: message.video.id,
      metadata: {
        caption: message.video.caption,
        mimeType: message.video.mime_type,
        sha256: message.video.sha256,
      },
      shouldDownload: true,
      mediaId: message.video.id,
    };
  }

  // AUDIO
  if (isAudioMessage(message)) {
    return {
      type: 'AUDIO',
      content: message.audio.id,
      metadata: {
        mimeType: message.audio.mime_type,
        voice: message.audio.voice || false,
      },
      shouldDownload: true,
      mediaId: message.audio.id,
    };
  }

  // DOCUMENT
  if (isDocumentMessage(message)) {
    return {
      type: 'DOCUMENT',
      content: message.document.id,
      metadata: {
        filename: message.document.filename,
        caption: message.document.caption,
        mimeType: message.document.mime_type,
      },
      shouldDownload: true,
      mediaId: message.document.id,
    };
  }

  // LOCATION
  if (isLocationMessage(message)) {
    return {
      type: 'LOCATION',
      content: JSON.stringify({
        latitude: message.location.latitude,
        longitude: message.location.longitude,
      }),
      metadata: {
        name: message.location.name,
        address: message.location.address,
      },
      shouldDownload: false,
    };
  }

  // TEMPLATE BUTTON REPLY (Quick Reply de carousel template)
  // Formato: type: 'button' com button.payload e button.text
  if (isTemplateButtonReply(message)) {
    const button = message.button as { payload: string; text: string };
    return {
      type: 'TEXT',
      content: button.text,
      metadata: {
        button: {
          id: button.payload,
          title: button.text,
        },
        context: message.context,
      },
      shouldDownload: false,
    };
  }

  // BUTTON REPLY (formato antigo com button_reply)
  if (isButtonReply(message)) {
    const buttonReply = (message.button as any).button_reply;
    return {
      type: 'TEXT',
      content: buttonReply.title,
      metadata: {
        button: {
          id: buttonReply.id,
          title: buttonReply.title,
        },
        context: message.context,
      },
      shouldDownload: false,
    };
  }

  // LIST REPLY
  if (isListReply(message) && message.interactive && 'list_reply' in message.interactive) {
    return {
      type: 'TEXT',
      content: message.interactive.list_reply.title,
      metadata: {
        list: {
          id: message.interactive.list_reply.id,
          title: message.interactive.list_reply.title,
          description: message.interactive.list_reply.description,
        },
        context: message.context,
      },
      shouldDownload: false,
    };
  }

  // INTERACTIVE BUTTON REPLY (Quick Reply de carousel template)
  if (isInteractiveButtonReply(message) && message.interactive && 'button_reply' in message.interactive) {
    const buttonReply = (message.interactive as any).button_reply;
    return {
      type: 'TEXT',
      content: buttonReply.title,
      metadata: {
        button: {
          id: buttonReply.id,
          title: buttonReply.title,
        },
        context: message.context,
      },
      shouldDownload: false,
    };
  }

  // CONTACTS
  if (message.type === 'contacts' && message.contacts) {
    const contacts = message.contacts.contacts || [];
    const contactsList = contacts.map((c: any) => ({
      name: c.name?.formatted_name,
      phones: c.phones?.map((p: any) => p.phone),
      emails: c.emails?.map((e: any) => e.email),
    }));

    return {
      type: 'TEXT',
      content: `[Contato compartilhado: ${contactsList.map((c: any) => c.name).join(', ')}]`,
      metadata: {
        contacts: contactsList,
      },
      shouldDownload: false,
    };
  }

  // STICKER
  if (message.type === 'sticker' && message.sticker) {
    return {
      type: 'IMAGE',
      content: message.sticker.id,
      metadata: {
        mimeType: message.sticker.mime_type,
        animated: message.sticker.animated || false,
        isSticker: true,
      },
      shouldDownload: true,
      mediaId: message.sticker.id,
    };
  }

  // FALLBACK
  logger.warn({ messageType: message.type, message }, 'Unsupported message type');

  return {
    type: 'TEXT',
    content: `[Tipo não suportado: ${message.type}]`,
    metadata: { rawMessage: message },
    shouldDownload: false,
  };
}

/**
 * Detecta se a mensagem é uma seleção de unidade hoteleira
 * Retorna o nome da unidade se detectada, null caso contrário
 */
function detectHotelUnitSelection(message: any, messageData: { metadata: any }): string | null {
  // Verificar se é um list_reply
  if (!isListReply(message) || !message.interactive || !('list_reply' in message.interactive)) {
    return null;
  }

  const listReply = message.interactive.list_reply;
  const id = listReply.id?.toLowerCase()?.trim();
  const title = listReply.title?.trim();

  logger.debug({ id, title }, 'Checking list_reply for hotel unit selection');

  // 1. Verificar se o título corresponde exatamente a uma unidade válida
  const exactMatch = VALID_HOTEL_UNITS.find(
    (unit) => unit.toLowerCase() === title?.toLowerCase()
  );
  if (exactMatch) {
    logger.info({ detectedUnit: exactMatch, source: 'title_exact' }, 'Hotel unit detected from list_reply title');
    return exactMatch;
  }

  // 2. Verificar se o ID corresponde a um alias
  if (id && HOTEL_UNIT_ALIASES[id]) {
    logger.info({ detectedUnit: HOTEL_UNIT_ALIASES[id], source: 'id_alias', id }, 'Hotel unit detected from list_reply id alias');
    return HOTEL_UNIT_ALIASES[id];
  }

  // 3. Verificar se o título contém o nome de uma unidade (match parcial)
  const partialMatch = VALID_HOTEL_UNITS.find(
    (unit) => title?.toLowerCase().includes(unit.toLowerCase())
  );
  if (partialMatch) {
    logger.info({ detectedUnit: partialMatch, source: 'title_partial', title }, 'Hotel unit detected from list_reply title (partial match)');
    return partialMatch;
  }

  // 4. Verificar se o ID contém o nome de uma unidade (sem underscores/hifens)
  if (id) {
    const normalizedId = id.replace(/[_-]/g, ' ');
    const idPartialMatch = VALID_HOTEL_UNITS.find(
      (unit) => normalizedId.includes(unit.toLowerCase()) || unit.toLowerCase().replace(/ /g, '').includes(normalizedId.replace(/ /g, ''))
    );
    if (idPartialMatch) {
      logger.info({ detectedUnit: idPartialMatch, source: 'id_partial', id }, 'Hotel unit detected from list_reply id (partial match)');
      return idPartialMatch;
    }
  }

  return null;
}

/**
 * Processa a seleção de unidade hoteleira
 * Atualiza a conversa e emite eventos Socket.io para atendentes da unidade
 */
async function handleHotelUnitSelection(
  tenantId: string,
  conversationId: string,
  hotelUnit: string,
  contact: { id: string; phoneNumber: string; name: string | null; profilePictureUrl: string | null }
): Promise<void> {
  try {
    // 1. Atualizar conversa com a unidade hoteleira
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        hotelUnit,
      } as any,
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
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    logger.info({
      conversationId,
      hotelUnit,
      tenantId,
    }, 'Conversation updated with hotel unit from client selection');

    // 2. Emitir evento para room da unidade (atendentes vão ver a conversa aparecer)
    try {
      const io = getSocketIO();
      const unitRoom = `tenant:${tenantId}:unit:${hotelUnit}`;

      // Emitir conversation:new para a room da unidade
      io.to(unitRoom).emit('conversation:new', {
        ...updatedConversation,
        hotelUnit,
      });

      // Emitir também conversation:update para garantir atualização
      io.to(unitRoom).emit('conversation:update', {
        conversationId,
        updates: { hotelUnit },
      });

      // Emitir para admins também (para atualizar o hotelUnit no painel deles)
      io.to(`tenant:${tenantId}:admins`).emit('conversation:update', {
        conversationId,
        updates: { hotelUnit },
      });

      logger.info({
        conversationId,
        hotelUnit,
        unitRoom,
        tenantId,
      }, 'Hotel unit selection events emitted via Socket.io');
    } catch (socketError) {
      logger.warn({ error: socketError, conversationId }, 'Failed to emit hotel unit selection events');
    }
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      hotelUnit,
    }, 'Failed to handle hotel unit selection');
  }
}
