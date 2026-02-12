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
  isNfmReply,
  type WhatsAppMessage,
} from '@/validators/whatsapp-webhook.validator';
import { enqueueMediaDownload } from '../whatsapp-webhook.queue';
import { emitNewMessage, emitConversationUpdate, getSocketIO } from '@/config/socket';
import { whatsAppService } from '@/services/whatsapp.service';
import { n8nService } from '@/services/n8n.service';
import { ConversationStatus, MessageType, Prisma } from '@prisma/client';

// ============================================
// Type Definitions
// ============================================

/**
 * Context de mensagem WhatsApp (reply ou forward)
 */
interface MessageContext {
  from?: string;
  id?: string;
  forwarded?: boolean;
  frequently_forwarded?: boolean;
}

/**
 * Metadata de mensagem com propriedades conhecidas para mídia
 * Compatível com Prisma.InputJsonValue
 */
interface MediaMessageMetadata {
  mimeType?: string;
  caption?: string;
  sha256?: string;
  filename?: string;
  voice?: boolean;
  animated?: boolean;
  isSticker?: boolean;
  name?: string;
  address?: string;
  context?: MessageContext;
  interactiveType?: string;
  button?: { id: string; title: string };
  list?: { id: string; title: string; description?: string };
  nfmReply?: {
    flowName: string;
    flowToken?: string;
    responseData: Record<string, unknown>;
    conversationId?: string;
  };
  contacts?: Array<{ name?: string; phones?: string[]; emails?: string[] }>;
  rawMessage?: Prisma.InputJsonValue;
  mediaUrl?: string;
  fileSize?: number;
  downloadedAt?: string;
}

/**
 * Resultado da extração de dados da mensagem WhatsApp
 * Usado para criar mensagem no banco de dados
 */
interface ExtractedMessageData {
  type: MessageType;
  content: string;
  metadata: MediaMessageMetadata | null;
  shouldDownload: boolean;
  mediaId?: string;
}

/**
 * Tipos de mídia válidos para download (alinhado com DownloadMediaJobData)
 */
type MediaDownloadType = 'image' | 'video' | 'audio' | 'document';

/**
 * Helper para converter MessageType enum para MediaDownloadType
 */
function toMediaDownloadType(type: MessageType): MediaDownloadType {
  const typeMap: Record<string, MediaDownloadType> = {
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
  };
  return typeMap[type] || 'image';
}

/**
 * Converte metadata interno para formato Prisma JSON
 * Retorna undefined para null (Prisma trata como NULL no DB)
 */
function toJsonValue(metadata: MediaMessageMetadata | null): Prisma.InputJsonValue | undefined {
  if (metadata === null) {
    return undefined;
  }
  // Serializa e deserializa para garantir compatibilidade com InputJsonValue
  return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
}

// ============================================
// Configuration Constants
// ============================================

/**
 * Timeout para download síncrono de mídia (ms).
 * Usado para garantir que a URL da mídia esteja disponível no payload do N8N.
 * Se o download falhar ou exceder o timeout, a mídia é enfileirada para retry assíncrono.
 */
const MEDIA_DOWNLOAD_TIMEOUT_MS = 15000; // 15 segundos

/**
 * Tipos de mídia que requerem download antes de enviar para N8N.
 * O N8N precisa da URL da mídia para processamento por IA.
 */
// const MEDIA_TYPES_REQUIRING_DOWNLOAD = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] as const;

// Unidades hoteleiras válidas para detecção automática
const VALID_HOTEL_UNITS = [
  'Ilhabela',
  'Campos do Jordão',
  'Camburi',
  'Santo Antônio do Pinhal',
  'Santa Smart Hotel',
];

// Keywords que indicam que o cliente quer falar com um humano
// Quando detectadas, a conversa e marcada como oportunidade e escalada para o time de vendas
const HUMAN_REQUEST_KEYWORDS = [
  'humano',
  'atendente',
  'vendedor',
  'pessoa',
  'falar com alguem',
  'falar com alguém',
  'quero falar',
  'atendimento humano',
  'pessoa real',
  'falar com uma pessoa',
  'quero atendente',
  'me transfere',
  'transferir',
  'operador',
  'falar com gente',
];

// Mapeamento de IDs/aliases para nomes de unidades (caso o N8N use IDs diferentes)
const HOTEL_UNIT_ALIASES: Record<string, string> = {
  'ilha_bela': 'Ilhabela',
  'ilhabela': 'Ilhabela',
  'campos_jordao': 'Campos do Jordão',
  'camposdojordao': 'Campos do Jordão',
  'camburi': 'Camburi',
  'santo_antonio': 'Santo Antônio do Pinhal',
  'santoantonio': 'Santo Antônio do Pinhal',
  'santo_antonio_pinhal': 'Santo Antônio do Pinhal',
  'santa': 'Santa Smart Hotel',
  'santa_smart': 'Santa Smart Hotel',
  'santasmart': 'Santa Smart Hotel',
  'santa_smart_hotel': 'Santa Smart Hotel',
  'st': 'Santa Smart Hotel',
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
        type: messageData.type,
        content: messageData.content,
        metadata: toJsonValue(messageData.metadata),
        status: 'DELIVERED',
        timestamp: new Date(parseInt(message.timestamp) * 1000),
      },
    });

    // 5. ATUALIZAR lastMessageAt DA CONVERSA
    // Se a conversa estava CLOSED, reabre como OPEN; caso contrário, mantém status atual
    const newStatus: ConversationStatus = conversation.status === 'CLOSED'
      ? ConversationStatus.OPEN
      : (conversation.status as ConversationStatus);

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: savedMessage.timestamp,
        status: newStatus,
      },
    });

    // 5.1 DETECTAR SELEÇÃO DE UNIDADE HOTELEIRA (list_reply)
    const detectedHotelUnit = detectHotelUnitSelection(message);
    if (detectedHotelUnit) {
      await handleHotelUnitSelection(tenantId, conversation.id, detectedHotelUnit, contact);
    }

    // 5.2 DETECTAR PEDIDO DE ATENDENTE HUMANO (keywords: "humano", "atendente", etc.)
    // Marca como oportunidade para o time de vendas e trava a IA
    if (!conversation.iaLocked && detectHumanRequest(message)) {
      await handleHumanRequest(tenantId, conversation.id, messageData.content || '');
    }

    // 5.3 PROCESSAR RESPOSTA DE WHATSAPP FLOW (nfm_reply)
    if (messageData.metadata?.nfmReply) {
      await handleFlowResponse(
        tenantId,
        conversation.id,
        messageData.metadata.nfmReply,
        savedMessage.id
      );
    }

    // 6. SE FOR MÍDIA, BAIXAR SINCRONAMENTE PARA INCLUIR URL NO PAYLOAD DO N8N
    if (messageData.shouldDownload && messageData.mediaId) {
      const downloadStartTime = Date.now();
      const mimeType = messageData.metadata?.mimeType ?? 'application/octet-stream';

      try {
        // Baixa e salva em disco, retorna URL HTTP pública
        const mediaResult = await downloadMediaWithTimeout(
          tenantId,
          messageData.mediaId,
          mimeType,
          messageData.type // Passa o tipo de mídia (IMAGE, VIDEO, etc.)
        );

        if (mediaResult) {
          // Atualizar metadata com URL HTTP pública da mídia
          const updatedMetadata: MediaMessageMetadata = {
            ...(messageData.metadata ?? {}),
            mediaUrl: mediaResult.url,
            fileSize: mediaResult.fileSize,
            downloadedAt: new Date().toISOString(),
          };

          // Persistir no banco de dados
          await prisma.message.update({
            where: { id: savedMessage.id },
            data: { metadata: toJsonValue(updatedMetadata) },
          });

          // Atualizar referência local para uso no payload do N8N
          messageData.metadata = updatedMetadata;

          logger.info({
            tenantId,
            messageId: savedMessage.id,
            mediaId: messageData.mediaId,
            mediaType: messageData.type,
            mediaUrl: mediaResult.url,
            fileSize: mediaResult.fileSize,
            downloadDurationMs: Date.now() - downloadStartTime,
          }, 'Media downloaded and saved to disk for N8N payload');
        } else {
          // Download falhou ou timeout - enfileirar para retry assíncrono
          await enqueueMediaDownload({
            tenantId,
            messageId: savedMessage.id,
            mediaId: messageData.mediaId,
            mediaType: toMediaDownloadType(messageData.type),
            mimeType,
          });

          logger.warn({
            tenantId,
            messageId: savedMessage.id,
            mediaId: messageData.mediaId,
            downloadDurationMs: Date.now() - downloadStartTime,
          }, 'Media download failed or timed out, enqueued for async retry');
        }
      } catch (downloadError) {
        // Erro inesperado - enfileirar para retry assíncrono (não bloqueia processamento)
        await enqueueMediaDownload({
          tenantId,
          messageId: savedMessage.id,
          mediaId: messageData.mediaId,
          mediaType: toMediaDownloadType(messageData.type),
          mimeType,
        });

        logger.error({
          tenantId,
          messageId: savedMessage.id,
          mediaId: messageData.mediaId,
          error: downloadError instanceof Error ? downloadError.message : 'Unknown error',
          downloadDurationMs: Date.now() - downloadStartTime,
        }, 'Media download error, enqueued for async retry');
      }
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
        timestamp: savedMessage.timestamp instanceof Date ? savedMessage.timestamp.toISOString() : savedMessage.timestamp,
        createdAt: savedMessage.createdAt instanceof Date ? savedMessage.createdAt.toISOString() : savedMessage.createdAt,
        mediaUrl: (savedMessage.metadata as any)?.mediaUrl,
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

    // IMPORTANTE: Usar messageData.metadata que contém a mediaUrl atualizada (se disponível)
    // savedMessage.metadata é o valor original antes do download síncrono
    const n8nPayload = n8nService.buildPayload(
      contact.phoneNumber,
      {
        id: savedMessage.id,
        type: savedMessage.type,
        content: savedMessage.content || '',
        metadata: messageData.metadata, // Usar metadata atualizado com mediaUrl
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
): Promise<{ id: string; status: string; iaLocked: boolean }> {
  // Buscar conversa ativa (inclui BOT_HANDLING para consistencia com getOrCreateConversation)
  let conversation = await prisma.conversation.findFirst({
    where: {
      tenantId,
      contactId,
      status: {
        in: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'],
      },
    },
    select: {
      id: true,
      status: true,
      iaLocked: true,
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
        iaLocked: true,
      },
    });

    logger.info({ tenantId, conversationId: conversation.id, contactId }, 'New conversation created');
  }

  return conversation;
}

/**
 * Realiza download síncrono de mídia com timeout.
 * Salva em disco e retorna URL HTTP pública (não base64).
 *
 * IMPORTANTE: Esta função salva a mídia em disco e retorna uma URL HTTP
 * que pode ser usada por sistemas externos (N8N, IA, etc.) que precisam
 * de URLs HTTP válidas, não Data URLs (base64).
 *
 * @param tenantId - ID do tenant
 * @param mediaId - ID da mídia no WhatsApp
 * @param mimeType - Tipo MIME da mídia
 * @param messageType - Tipo de mensagem (IMAGE, VIDEO, AUDIO, DOCUMENT)
 * @returns Objeto com URL HTTP e tamanho do arquivo, ou null se falhar
 */
async function downloadMediaWithTimeout(
  tenantId: string,
  mediaId: string,
  mimeType: string,
  messageType: string = 'IMAGE'
): Promise<{ url: string; fileSize: number } | null> {
  // Garante que mimeType é string válida antes de processar
  const safeMimeType: string = mimeType ?? 'application/octet-stream';
  const cleanMimeType: string = safeMimeType.split(';')[0]?.trim() ?? 'application/octet-stream';

  const downloadPromise = whatsAppService.downloadMediaAndSave(
    tenantId,
    mediaId,
    cleanMimeType,
    messageType
  );

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), MEDIA_DOWNLOAD_TIMEOUT_MS);
  });

  return Promise.race([downloadPromise, timeoutPromise]);
}

/**
 * Extrai dados da mensagem baseado no tipo
 * Converte mensagem WhatsApp para formato do banco de dados
 *
 * @param message - Mensagem WhatsApp validada pelo Zod schema
 * @returns Dados extraídos com tipo MessageType do Prisma
 */
function extractMessageData(message: ProcessMessageJobData['message']): ExtractedMessageData {
  // TEXT
  if (isTextMessage(message)) {
    return {
      type: MessageType.TEXT,
      content: message.text.body,
      metadata: message.context ? { context: message.context } : null,
      shouldDownload: false,
    };
  }

  // IMAGE
  if (isImageMessage(message)) {
    return {
      type: MessageType.IMAGE,
      content: message.image.id,
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
      type: MessageType.VIDEO,
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
      type: MessageType.AUDIO,
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
      type: MessageType.DOCUMENT,
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
      type: MessageType.LOCATION,
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
      type: MessageType.TEXT,
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
    const buttonData = message.button as { button_reply: { id: string; title: string } };
    return {
      type: MessageType.TEXT,
      content: buttonData.button_reply.title,
      metadata: {
        button: {
          id: buttonData.button_reply.id,
          title: buttonData.button_reply.title,
        },
        context: message.context,
      },
      shouldDownload: false,
    };
  }

  // LIST REPLY
  if (isListReply(message) && message.interactive && 'list_reply' in message.interactive) {
    const listReply = message.interactive.list_reply;
    return {
      type: MessageType.TEXT,
      content: listReply.title,
      metadata: {
        list: {
          id: listReply.id,
          title: listReply.title,
          description: listReply.description,
        },
        context: message.context,
      },
      shouldDownload: false,
    };
  }

  // INTERACTIVE BUTTON REPLY (Quick Reply de carousel template)
  if (isInteractiveButtonReply(message) && message.interactive && 'button_reply' in message.interactive) {
    const buttonReply = message.interactive.button_reply;
    return {
      type: MessageType.TEXT,
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

  // NFM REPLY (WhatsApp Flow Response)
  if (isNfmReply(message) && message.interactive && 'nfm_reply' in message.interactive) {
    const nfmReply = message.interactive.nfm_reply;

    // Parse response_json (dados do formulário)
    let responseData: Record<string, unknown> = {};
    try {
      responseData = JSON.parse(nfmReply.response_json);
    } catch (parseError) {
      logger.warn({
        messageId: message.id,
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        rawJson: nfmReply.response_json,
      }, 'Failed to parse nfm_reply response_json');
    }

    // Extrair conversationId do flowToken se seguir padrão booking_{conversationId}_{timestamp}
    let conversationId: string | undefined;
    const flowTokenMatch = message.context?.id?.match(/^booking_([a-f0-9-]{36})_\d+$/);
    if (flowTokenMatch) {
      conversationId = flowTokenMatch[1];
    }

    // Formatar resposta do Flow em texto legível para o N8N
    const content = formatFlowResponseToText(responseData, nfmReply.name);

    return {
      type: MessageType.INTERACTIVE,
      content,
      metadata: {
        interactiveType: 'nfm_reply',
        nfmReply: {
          flowName: nfmReply.name,
          flowToken: message.context?.id,
          responseData,
          conversationId,
        },
        context: message.context,
      },
      shouldDownload: false,
    };
  }

  // CONTACTS
  if (message.type === 'contacts' && message.contacts) {
    const contactsData = message.contacts.contacts || [];
    interface ContactInfo {
      name: string | undefined;
      phones: string[] | undefined;
      emails: string[] | undefined;
    }
    const contactsList: ContactInfo[] = contactsData.map((c) => ({
      name: c.name?.formatted_name,
      phones: c.phones?.map((p) => p.phone),
      emails: c.emails?.map((e) => e.email),
    }));

    return {
      type: MessageType.TEXT,
      content: `[Contato compartilhado: ${contactsList.map((c) => c.name).join(', ')}]`,
      metadata: {
        contacts: contactsList,
      },
      shouldDownload: false,
    };
  }

  // STICKER
  if (message.type === 'sticker' && message.sticker) {
    return {
      type: MessageType.IMAGE,
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
    type: MessageType.TEXT,
    content: `[Tipo não suportado: ${message.type}]`,
    metadata: { rawMessage: message },
    shouldDownload: false,
  };
}

/**
 * Detecta se a mensagem é uma seleção de unidade hoteleira
 * Retorna o nome da unidade se detectada, null caso contrário
 *
 * @param message - Mensagem WhatsApp com possível list_reply
 * @returns Nome da unidade hoteleira se detectada, null caso contrário
 */
/**
 * Tenta fazer match de um ID e/ou titulo com unidades hoteleiras validas
 * Retorna o nome da unidade se encontrado, null caso contrario
 */
function matchHotelUnit(id?: string | null, title?: string | null, source?: string): string | null {
  // 1. Titulo exato
  if (title) {
    const exactMatch = VALID_HOTEL_UNITS.find(
      (unit) => unit.toLowerCase() === title.toLowerCase().trim()
    );
    if (exactMatch) {
      logger.info({ detectedUnit: exactMatch, source: `${source}_title_exact`, title }, 'Hotel unit detected');
      return exactMatch;
    }
  }

  // 2. ID alias
  const normalizedId = id?.toLowerCase()?.trim();
  if (normalizedId && HOTEL_UNIT_ALIASES[normalizedId]) {
    logger.info({ detectedUnit: HOTEL_UNIT_ALIASES[normalizedId], source: `${source}_id_alias`, id }, 'Hotel unit detected');
    return HOTEL_UNIT_ALIASES[normalizedId];
  }

  // 3. Titulo parcial
  if (title) {
    const partialMatch = VALID_HOTEL_UNITS.find(
      (unit) => title.toLowerCase().includes(unit.toLowerCase())
    );
    if (partialMatch) {
      logger.info({ detectedUnit: partialMatch, source: `${source}_title_partial`, title }, 'Hotel unit detected');
      return partialMatch;
    }
  }

  // 4. ID parcial (sem underscores/hifens)
  if (normalizedId) {
    const cleanId = normalizedId.replace(/[_-]/g, ' ');
    const idPartialMatch = VALID_HOTEL_UNITS.find(
      (unit) => cleanId.includes(unit.toLowerCase()) || unit.toLowerCase().replace(/ /g, '').includes(cleanId.replace(/ /g, ''))
    );
    if (idPartialMatch) {
      logger.info({ detectedUnit: idPartialMatch, source: `${source}_id_partial`, id }, 'Hotel unit detected');
      return idPartialMatch;
    }
  }

  return null;
}

function detectHotelUnitSelection(message: WhatsAppMessage): string | null {
  // 1. LIST REPLY (lista interativa)
  if (isListReply(message) && message.interactive && 'list_reply' in message.interactive) {
    const listReply = message.interactive.list_reply;
    const result = matchHotelUnit(listReply.id, listReply.title, 'list_reply');
    if (result) return result;
  }

  // 2. INTERACTIVE BUTTON REPLY (botoes interativos)
  if (isInteractiveButtonReply(message) && message.interactive && 'button_reply' in message.interactive) {
    const buttonReply = message.interactive.button_reply;
    const result = matchHotelUnit(buttonReply.id, buttonReply.title, 'interactive_button');
    if (result) return result;
  }

  // 3. BUTTON REPLY (formato antigo)
  if (isButtonReply(message) && message.button) {
    const button = message.button as { button_reply?: { id: string; title: string }; payload?: string; text?: string };
    if (button.button_reply) {
      const result = matchHotelUnit(button.button_reply.id, button.button_reply.title, 'button_reply');
      if (result) return result;
    }
    if (button.payload || button.text) {
      const result = matchHotelUnit(button.payload, button.text, 'template_button');
      if (result) return result;
    }
  }

  // 4. TEMPLATE BUTTON REPLY (Quick Reply de template/carousel)
  if (isTemplateButtonReply(message) && message.button) {
    const button = message.button as { payload: string; text: string };
    const result = matchHotelUnit(button.payload, button.text, 'template_quick_reply');
    if (result) return result;
  }

  // 5. TEXTO PURO (cliente digita o nome da unidade)
  if (isTextMessage(message) && message.text?.body) {
    const text = message.text.body.trim();
    // So detecta se o texto e curto (para nao pegar mensagens longas que mencionam uma unidade)
    if (text.length <= 40) {
      const result = matchHotelUnit(null, text, 'text_message');
      if (result) return result;
    }
  }

  return null;
}

/**
 * Processa a seleção de unidade hoteleira
 * Atualiza apenas o campo hotelUnit da conversa e emite eventos Socket.io
 */
async function handleHotelUnitSelection(
  tenantId: string,
  conversationId: string,
  hotelUnit: string,
  _contact: { id: string; phoneNumber: string; name: string | null; profilePictureUrl: string | null }
): Promise<void> {
  try {
    // 1. Atualizar conversa apenas com a unidade hoteleira (sem tags coloridas)
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
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

    logger.info({
      conversationId,
      hotelUnit,
      tenantId,
    }, 'Conversation updated with hotel unit from client selection');

    // 2. Emitir evento para room da unidade (atendentes vão ver a conversa aparecer)
    try {
      const io = getSocketIO();
      const unitRoom = `tenant:${tenantId}:unit:${hotelUnit}`;

      // Dados atualizados
      const updateData = {
        hotelUnit,
      };

      // Emitir conversation:new para a room da unidade
      io.to(unitRoom).emit('conversation:new', {
        ...updatedConversation,
        hotelUnit,
      });

      // Emitir conversation:update para garantir atualização
      io.to(unitRoom).emit('conversation:update', {
        conversationId,
        updates: updateData,
      });

      // Emitir para admins também (para atualizar hotelUnit no painel)
      io.to(`tenant:${tenantId}:admins`).emit('conversation:update', {
        conversationId,
        updates: updateData,
      });

      // Emitir para a room da conversa específica
      io.to(`conversation:${conversationId}`).emit('conversation:update', {
        conversationId,
        updates: updateData,
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

/**
 * Detecta se o cliente esta pedindo para falar com um humano
 * Verifica keywords no texto da mensagem (case-insensitive, sem acentos)
 */
function detectHumanRequest(message: WhatsAppMessage): boolean {
  if (!isTextMessage(message) || !message.text?.body) {
    return false;
  }

  const text = message.text.body
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

  // So detecta em mensagens curtas (evita falso positivo em textos longos)
  if (text.length > 80) return false;

  return HUMAN_REQUEST_KEYWORDS.some((keyword) => {
    const normalizedKeyword = keyword
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return text.includes(normalizedKeyword);
  });
}

/**
 * Escala a conversa para atendimento humano (time de vendas)
 * Marca como oportunidade, trava a IA e muda status para OPEN
 */
async function handleHumanRequest(
  tenantId: string,
  conversationId: string,
  messageContent: string
): Promise<void> {
  try {
    const now = new Date();

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isOpportunity: true,
        opportunityAt: now,
        iaLocked: true,
        iaLockedAt: now,
        iaLockedBy: 'system',
        status: 'OPEN',
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
      },
    });

    // Emitir atualizacao via Socket.io para o frontend
    try {
      emitConversationUpdate(tenantId, conversationId, {
        isOpportunity: true,
        iaLocked: true,
        iaLockedAt: now.toISOString(),
        iaLockedBy: 'system',
        status: 'OPEN',
      }, updatedConversation.hotelUnit ?? undefined);
    } catch (socketError) {
      logger.warn({ error: socketError }, 'Failed to emit human request escalation via Socket.io');
    }

    logger.info({
      tenantId,
      conversationId,
      trigger: messageContent,
    }, 'Conversation escalated to human - client requested attendant (isOpportunity=true, iaLocked=true)');
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
    }, 'Failed to handle human request escalation');
  }
}

/**
 * Processa resposta de WhatsApp Flow (nfm_reply)
 * Atualiza conversa e emite eventos Socket.io se houver conversationId no flowToken
 */
async function handleFlowResponse(
  tenantId: string,
  conversationId: string,
  nfmReply: NonNullable<MediaMessageMetadata['nfmReply']>,
  messageId: string
): Promise<void> {
  try {
    logger.info({
      tenantId,
      conversationId,
      flowName: nfmReply.flowName,
      flowToken: nfmReply.flowToken,
      extractedConversationId: nfmReply.conversationId,
      fieldsCount: Object.keys(nfmReply.responseData).length,
    }, 'Processing WhatsApp Flow response');

    // Se o flowToken contém conversationId, atualizar a conversa específica
    if (nfmReply.conversationId && nfmReply.conversationId !== conversationId) {
      logger.info({
        currentConversationId: conversationId,
        targetConversationId: nfmReply.conversationId,
      }, 'Flow response references different conversation, updating target conversation');

      // Atualizar conversa alvo com status e última mensagem
      await prisma.conversation.update({
        where: {
          id: nfmReply.conversationId,
          tenantId, // Validação de segurança
        },
        data: {
          lastMessageAt: new Date(),
          // Opcional: mudar status para IN_PROGRESS se estava WAITING
          status: 'IN_PROGRESS',
        },
      });

      // Emitir evento Socket.io para a conversa alvo
      try {
        const io = getSocketIO();
        io.to(`conversation:${nfmReply.conversationId}`).emit('conversation:update', {
          conversationId: nfmReply.conversationId,
          updates: {
            lastMessageAt: new Date(),
            status: 'IN_PROGRESS',
          },
        });

        io.to(`tenant:${tenantId}`).emit('conversation:update', {
          conversationId: nfmReply.conversationId,
          updates: {
            lastMessageAt: new Date(),
            status: 'IN_PROGRESS',
          },
        });

        logger.debug({
          conversationId: nfmReply.conversationId,
          tenantId,
        }, 'Flow response events emitted via Socket.io');
      } catch (socketError) {
        logger.warn({
          error: socketError,
          conversationId: nfmReply.conversationId,
        }, 'Failed to emit flow response events');
      }
    }

    // Log dos dados recebidos para auditoria/debug
    logger.info({
      tenantId,
      conversationId,
      messageId,
      flowName: nfmReply.flowName,
      responseData: nfmReply.responseData,
    }, 'WhatsApp Flow response processed successfully');
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      flowName: nfmReply.flowName,
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Failed to handle flow response');
  }
}

/**
 * Formata resposta de WhatsApp Flow em texto legível para o N8N
 *
 * Formato de saída: "de 10/02/2026 a 13/02/2026, 2 adultos e 1 criança de 4 anos"
 * Ou sem crianças: "de 10/02/2026 a 13/02/2026, 2 adultos, sem crianças"
 *
 * Regras:
 * - guests = total de hóspedes (adultos + crianças)
 * - adultos = guests - children_count
 * - children_age vem como faixa (ex: "3-5"), calcular média
 */
function formatFlowResponseToText(
  responseData: Record<string, unknown>,
  _flowName: string
): string {
  // Extrair valores do formulário
  const checkinRaw = responseData.checkin || responseData.check_in_date;
  const checkoutRaw = responseData.checkout || responseData.check_out_date;
  const guestsRaw = responseData.guests || responseData.adults;
  const hasChildren = responseData.has_children;
  const childrenCountRaw = responseData.children_count || responseData.children;
  const childrenAgeRaw = responseData.children_age;

  // Formatar datas
  const checkinDate = parseFlowDate(checkinRaw);
  const checkoutDate = parseFlowDate(checkoutRaw);

  if (!checkinDate || !checkoutDate) {
    // Fallback: retornar dados brutos se não conseguir parsear datas
    return `Orçamento recebido: ${JSON.stringify(responseData)}`;
  }

  // Calcular número de adultos e crianças
  const totalGuests = parseInt(String(guestsRaw), 10) || 0;
  const childrenCount = hasChildren === 'sim' ? (parseInt(String(childrenCountRaw), 10) || 0) : 0;
  const adultsCount = Math.max(totalGuests - childrenCount, 0);

  // Formatar texto de adultos
  const adultsText = adultsCount === 1 ? '1 adulto' : `${adultsCount} adultos`;

  // Formatar texto de crianças
  let childrenText: string;
  if (hasChildren !== 'sim' || childrenCount === 0) {
    childrenText = 'sem crianças';
  } else {
    // Calcular idade média da faixa etária
    const averageAge = calculateAverageAge(String(childrenAgeRaw || ''));
    const ageText = averageAge ? ` de ${averageAge} anos` : '';
    childrenText = childrenCount === 1
      ? `1 criança${ageText}`
      : `${childrenCount} crianças${ageText}`;
  }

  // Montar texto final
  return `de ${checkinDate} a ${checkoutDate}, ${adultsText} e ${childrenText}`;
}

/**
 * Parseia data do Flow (vem em milliseconds como string)
 * Retorna no formato dd/mm/yyyy
 */
function parseFlowDate(value: unknown): string | null {
  if (!value) return null;

  const str = String(value).trim();

  try {
    // Formato ISO yyyy-mm-dd (ex: 2026-02-14)
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    // Formato dd/mm/yyyy (ja formatado)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }

    // Epoch timestamp (ms ou segundos)
    let timestamp = parseInt(str, 10);
    if (isNaN(timestamp)) return null;

    // Se o timestamp for muito pequeno, pode estar em segundos
    if (timestamp < 1000000000000 && timestamp > 1000000000) {
      timestamp = timestamp * 1000;
    }

    const date = new Date(timestamp);

    const year = date.getFullYear();
    if (year < 2020 || year > 2035) {
      return null;
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/**
 * Calcula idade média de uma faixa etária
 * Ex: "3-5" -> "4.0", "0-2" -> "1.0", "6-12" -> "9.0"
 */
function calculateAverageAge(ageRange: string): string | null {
  if (!ageRange) return null;

  // Tentar extrair números da faixa (ex: "3-5", "3 a 5", "3 - 5")
  const match = ageRange.match(/(\d+)\s*[-a]\s*(\d+)/);
  if (match && match[1] && match[2]) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    const average = (min + max) / 2;
    return average.toFixed(1);
  }

  // Se for apenas um número, retornar ele
  const singleNumber = ageRange.match(/^(\d+)$/);
  if (singleNumber && singleNumber[1]) {
    return `${singleNumber[1]}.0`;
  }

  return null;
}
