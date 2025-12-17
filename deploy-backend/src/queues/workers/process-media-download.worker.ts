import { Job } from 'bull';
import { prisma } from '@/config/database';
import { whatsAppService } from '@/services/whatsapp.service';
import logger from '@/config/logger';
import type { DownloadMediaJobData } from '../whatsapp-webhook.queue';

/**
 * Worker para baixar mídias do WhatsApp
 * Converte para base64 data URL para evitar problemas de filesystem no Docker
 */
export async function processMediaDownload(job: Job<DownloadMediaJobData>): Promise<{ size: number; mediaUrl: string }> {
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

    // Verificar se já foi baixada (verificar mediaUrl no metadata)
    if ((message.metadata as any)?.mediaUrl) {
      logger.info(
        {
          jobId: job.id,
          messageId,
        },
        'Media already downloaded, skipping'
      );
      return {
        size: (message.metadata as any).fileSize || 0,
        mediaUrl: (message.metadata as any).mediaUrl,
      };
    }

    // 2. BAIXAR MÍDIA DO WHATSAPP COMO DATA URL (base64)
    // Normalizar o mimeType removendo parâmetros extras (ex: "audio/ogg; codecs=opus" -> "audio/ogg")
    const splitResult = mimeType.split(';')[0];
    const cleanMimeType = splitResult?.trim() ?? 'application/octet-stream';

    const mediaUrl = await whatsAppService.downloadMediaAsDataUrl(tenantId, mediaId, cleanMimeType);

    if (!mediaUrl) {
      throw new Error(`Failed to download media ${mediaId}`);
    }

    // Calcular tamanho aproximado do arquivo (base64 é ~33% maior que o binário)
    const base64Data = mediaUrl.split(',')[1] || '';
    const fileSize = Math.round(base64Data.length * 0.75);

    logger.debug(
      {
        jobId: job.id,
        messageId,
        mediaId,
        fileSize,
      },
      'Media downloaded as data URL'
    );

    // 3. ATUALIZAR METADATA DA MENSAGEM COM O DATA URL
    const updatedMetadata = {
      ...(message.metadata as any),
      mediaUrl, // Data URL base64
      fileSize,
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
        fileSize,
      },
      'Media download completed successfully'
    );

    return {
      size: fileSize,
      mediaUrl,
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
