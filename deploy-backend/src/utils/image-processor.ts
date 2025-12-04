import axios from 'axios';
import sharp from 'sharp';
import logger from '@/config/logger';

// Limite do WhatsApp: 5MB (5242880 bytes)
// Usamos 4.5MB para ter margem de segurança
const MAX_IMAGE_SIZE = 4.5 * 1024 * 1024;
const MAX_DIMENSION = 1600; // Dimensão máxima recomendada

// Formatos HEIC/HEIF que precisam de conversão especial
const HEIC_EXTENSIONS = ['.heic', '.heif'];

interface ProcessedImage {
  buffer: Buffer;
  base64: string;
  mimeType: string;
  size: number;
}

/**
 * Verifica se a URL é de um arquivo HEIC/HEIF
 */
function isHeicFile(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return HEIC_EXTENSIONS.some(ext => lowerUrl.endsWith(ext));
}

/**
 * Converte HEIC para JPEG usando heic-convert
 */
async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    // Importar heic-convert dinamicamente
    const heicConvert = (await import('heic-convert')).default;

    const jpegBuffer = await heicConvert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.9,
    });

    // heic-convert retorna Uint8Array, converter para Buffer
    return Buffer.from(jpegBuffer);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to convert HEIC with heic-convert');
    throw new Error(`HEIC conversion failed: ${error.message}`);
  }
}

/**
 * Baixa e processa uma imagem para ficar dentro dos limites do WhatsApp
 * @param imageUrl URL da imagem
 * @returns Buffer da imagem processada ou null se falhar
 */
export async function processImageForWhatsApp(imageUrl: string): Promise<ProcessedImage | null> {
  try {
    logger.debug({ imageUrl }, 'Downloading image for processing');

    // Baixar a imagem
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024, // Aceitar até 20MB para download
    });

    let originalBuffer = Buffer.from(response.data);
    const originalSize = originalBuffer.length;

    logger.debug({ imageUrl, originalSize }, 'Image downloaded');

    // Verificar se é HEIC e converter primeiro
    if (isHeicFile(imageUrl)) {
      logger.info({ imageUrl }, 'Converting HEIC to JPEG...');
      originalBuffer = await convertHeicToJpeg(originalBuffer);
      logger.info({ imageUrl, convertedSize: originalBuffer.length }, 'HEIC converted to JPEG');
    }

    // Se já está dentro do limite, retornar como está
    if (originalBuffer.length <= MAX_IMAGE_SIZE) {
      // Detectar tipo e converter para JPEG se necessário para melhor compressão
      const metadata = await sharp(originalBuffer).metadata();

      if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
        logger.debug({ imageUrl, size: originalBuffer.length }, 'Image already within limits');
        return {
          buffer: originalBuffer,
          base64: originalBuffer.toString('base64'),
          mimeType: 'image/jpeg',
          size: originalBuffer.length,
        };
      }
    }

    // Processar a imagem com sharp
    let processedBuffer = await sharp(originalBuffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        mozjpeg: true,
      })
      .toBuffer();

    // Se ainda está muito grande, reduzir qualidade progressivamente
    let quality = 80;
    while (processedBuffer.length > MAX_IMAGE_SIZE && quality >= 40) {
      logger.debug({
        imageUrl,
        currentSize: processedBuffer.length,
        quality
      }, 'Image still too large, reducing quality');

      processedBuffer = await sharp(originalBuffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality,
          mozjpeg: true,
        })
        .toBuffer();

      quality -= 10;
    }

    // Se ainda está muito grande, reduzir dimensões
    if (processedBuffer.length > MAX_IMAGE_SIZE) {
      let dimension = 1200;
      while (processedBuffer.length > MAX_IMAGE_SIZE && dimension >= 600) {
        logger.debug({
          imageUrl,
          currentSize: processedBuffer.length,
          dimension
        }, 'Reducing dimensions');

        processedBuffer = await sharp(originalBuffer)
          .resize(dimension, dimension, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 70,
            mozjpeg: true,
          })
          .toBuffer();

        dimension -= 200;
      }
    }

    logger.info({
      imageUrl,
      originalSize,
      processedSize: processedBuffer.length,
      reduction: `${((1 - processedBuffer.length / originalSize) * 100).toFixed(1)}%`,
    }, 'Image processed successfully');

    return {
      buffer: processedBuffer,
      base64: processedBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      size: processedBuffer.length,
    };
  } catch (error: any) {
    logger.error({ imageUrl, error: error.message }, 'Failed to process image');
    return null;
  }
}

/**
 * Verifica se uma URL de imagem precisa ser processada (se está acima do limite)
 * @param imageUrl URL da imagem
 * @returns true se precisa processar, false se está OK
 */
export async function imageNeedsProcessing(imageUrl: string): Promise<boolean> {
  try {
    // Fazer HEAD request para verificar tamanho
    const response = await axios.head(imageUrl, { timeout: 10000 });
    const contentLength = parseInt(response.headers['content-length'] || '0', 10);

    return contentLength > MAX_IMAGE_SIZE || contentLength === 0;
  } catch {
    // Se não conseguir verificar, assume que precisa processar
    return true;
  }
}

/**
 * Converte buffer de imagem para data URL
 */
export function bufferToDataUrl(buffer: Buffer, mimeType: string = 'image/jpeg'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Faz upload de imagem processada para WhatsApp Media API
 * @returns Media ID que pode ser usado no lugar da URL
 */
export async function uploadImageToWhatsApp(
  buffer: Buffer,
  accessToken: string,
  phoneNumberId: string
): Promise<string | null> {
  try {
    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    formData.append('file', buffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg',
    });
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', 'image/jpeg');

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 60000,
      }
    );

    const mediaId = response.data?.id;
    logger.info({ mediaId, size: buffer.length }, 'Image uploaded to WhatsApp Media API');

    return mediaId;
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message }, 'Failed to upload image to WhatsApp');
    return null;
  }
}
