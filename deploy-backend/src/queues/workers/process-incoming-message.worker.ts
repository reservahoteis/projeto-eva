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
} from '@/validators/whatsapp-webhook.validator';
import { enqueueMediaDownload } from '../whatsapp-webhook.queue';
import { emitNewMessage } from '@/config/socket';
import { whatsAppService } from '@/services/whatsapp.service';

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

  // BUTTON REPLY
  if (isButtonReply(message)) {
    return {
      type: 'TEXT',
      content: message.button!.button_reply.title,
      metadata: {
        button: {
          id: message.button!.button_reply.id,
          title: message.button!.button_reply.title,
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
