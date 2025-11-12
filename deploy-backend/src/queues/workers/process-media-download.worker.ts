import { Job } from 'bull';
import { prisma } from '@/config/database';
import { whatsAppService } from '@/services/whatsapp.service';
import logger from '@/config/logger';
import type { DownloadMediaJobData } from '../whatsapp-webhook.queue';
import * as fs from 'fs/promises';
import * as path from 'path';
import { env } from '@/config/env';

/**
 * Worker para baixar mídias do WhatsApp
 * Baixa e armazena localmente (ou pode integrar com S3/Cloudinary)
 */
export async function processMediaDownload(job: Job<DownloadMediaJobData>): Promise<{ size: number; path: string }> {
  const { tenantId, messageId, mediaId, mediaType, mimeType } = job.data;

  logger.info(
    {
      jobId: job.id,
      tenantId,
      messageId,
      mediaId,
      mediaType,
      mimeType,
    },
    'Processing media download'
  );

  try {
    // 1. VALIDAR QUE MENSAGEM AINDA EXISTE
    const message = await prisma.message.findUnique({
      where: {
        id: messageId,
      },
      select: {
        id: true,
        tenantId: true,
        content: true,
        metadata: true,
      },
    });

    if (!message) {
      throw new Error(`Message ${messageId} not found`);
    }

    // Validar tenant (segurança)
    if (message.tenantId !== tenantId) {
      throw new Error(`Tenant mismatch: expected ${tenantId}, got ${message.tenantId}`);
    }

    // Verificar se já foi baixada
    if ((message.metadata as any)?.localPath) {
      logger.info(
        {
          jobId: job.id,
          messageId,
          localPath: (message.metadata as any).localPath,
        },
        'Media already downloaded, skipping'
      );
      return {
        size: (message.metadata as any).fileSize || 0,
        path: (message.metadata as any).localPath,
      };
    }

    // 2. BAIXAR MÍDIA DO WHATSAPP
    const buffer = await whatsAppService.downloadMedia(tenantId, mediaId);

    logger.debug(
      {
        jobId: job.id,
        messageId,
        mediaId,
        bufferSize: buffer.length,
      },
      'Media downloaded from WhatsApp'
    );

    // 3. SALVAR NO SISTEMA DE ARQUIVOS
    // IMPORTANTE: Em produção, considere usar S3, Cloudinary, ou similar
    const uploadDir = path.join(process.cwd(), 'uploads', 'media', tenantId);
    await fs.mkdir(uploadDir, { recursive: true });

    // Gerar nome de arquivo único
    const extension = getFileExtension(mimeType);
    const fileName = `${mediaId}_${Date.now()}${extension}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);

    logger.info(
      {
        jobId: job.id,
        messageId,
        mediaId,
        filePath,
        fileSize: buffer.length,
      },
      'Media saved to disk'
    );

    // 4. ATUALIZAR METADATA DA MENSAGEM COM O PATH LOCAL
    const updatedMetadata = {
      ...(message.metadata as any),
      localPath: filePath,
      fileSize: buffer.length,
      downloadedAt: new Date().toISOString(),
    };

    await prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        metadata: updatedMetadata,
      },
    });

    logger.info(
      {
        jobId: job.id,
        tenantId,
        messageId,
        mediaId,
        filePath,
        fileSize: buffer.length,
      },
      'Media download completed successfully'
    );

    return {
      size: buffer.length,
      path: filePath,
    };
  } catch (error) {
    logger.error(
      {
        jobId: job.id,
        tenantId,
        messageId,
        mediaId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        attemptsMade: job.attemptsMade,
      },
      'Error downloading media'
    );

    throw error; // Re-throw para Bull tentar novamente
  }
}

/**
 * Obtém extensão de arquivo baseado no MIME type
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    // Images
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',

    // Videos
    'video/mp4': '.mp4',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
    'video/x-ms-wmv': '.wmv',
    'video/3gpp': '.3gp',
    'video/webm': '.webm',

    // Audio
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/webm': '.webm',
    'audio/aac': '.aac',
    'audio/x-m4a': '.m4a',
    'audio/amr': '.amr',

    // Documents
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/json': '.json',
    'application/xml': '.xml',
  };

  return mimeToExt[mimeType] || '.bin';
}

/**
 * OPCIONAL: Upload para S3/Cloudinary
 * Descomente e configure se quiser usar cloud storage
 */
/*
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  const s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ACL: 'public-read', // ou 'private'
  });

  await s3Client.send(command);

  const url = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  return url;
}
*/
