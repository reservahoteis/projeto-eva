/**
 * Media Routes
 *
 * Rotas para servir mídias armazenadas (imagens, vídeos, áudios, documentos).
 * Estas rotas são públicas (não requerem autenticação) mas têm proteções:
 * - IDs únicos e não sequenciais (UUID-like)
 * - Rate limiting para evitar abuse
 * - Validação de tenant
 *
 * @author Bot Reserva Hotéis
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import logger from '@/config/logger';
import { mediaStorageService } from '@/services/media-storage.service';

const router = Router();

// ============================================
// Configuration
// ============================================

/**
 * Tipos MIME suportados e seus Content-Types
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',

  // Videos
  '.mp4': 'video/mp4',
  '.3gp': 'video/3gpp',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',

  // Audio
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.amr': 'audio/amr',

  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',

  // Default
  '.bin': 'application/octet-stream',
};

/**
 * Cache headers por tipo de mídia (em segundos)
 */
const CACHE_DURATION: Record<string, number> = {
  image: 86400 * 7,  // 7 dias para imagens
  video: 86400 * 7,  // 7 dias para vídeos
  audio: 86400 * 7,  // 7 dias para áudio
  document: 86400,   // 1 dia para documentos
  default: 3600,     // 1 hora para outros
};

// ============================================
// Routes
// ============================================

/**
 * GET /api/media/:tenantId/:fileId
 *
 * Serve uma mídia pelo seu ID.
 * O ID inclui a extensão do arquivo (ex: abc123.jpg)
 *
 * @param tenantId - ID do tenant
 * @param fileId - ID do arquivo com extensão
 */
router.get('/:tenantId/:fileId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { tenantId, fileId } = req.params;

  try {
    // Validar parâmetros
    if (!tenantId || !fileId) {
      res.status(400).json({ error: 'Missing tenantId or fileId' });
      return;
    }

    // Sanitizar fileId para prevenir path traversal
    const sanitizedFileId = path.basename(fileId);
    if (sanitizedFileId !== fileId || fileId.includes('..')) {
      logger.warn({ tenantId, fileId }, 'Potential path traversal attempt');
      res.status(400).json({ error: 'Invalid fileId' });
      return;
    }

    // Buscar arquivo
    const filePath = await mediaStorageService.findMedia(tenantId, sanitizedFileId);

    if (!filePath) {
      logger.debug({ tenantId, fileId: sanitizedFileId }, 'Media file not found');
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    // Verificar se arquivo existe e é acessível
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      logger.warn({ tenantId, fileId: sanitizedFileId, filePath }, 'Media file not accessible');
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    // Obter estatísticas do arquivo
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = EXTENSION_TO_MIME[ext] || 'application/octet-stream';

    // Determinar tipo de mídia para cache
    let mediaType = 'default';
    if (mimeType.startsWith('image/')) mediaType = 'image';
    else if (mimeType.startsWith('video/')) mediaType = 'video';
    else if (mimeType.startsWith('audio/')) mediaType = 'audio';
    else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('sheet')) mediaType = 'document';

    // Headers de resposta
    res.set({
      'Content-Type': mimeType,
      'Content-Length': stats.size,
      'Cache-Control': `public, max-age=${CACHE_DURATION[mediaType]}`,
      'ETag': `"${stats.mtime.getTime().toString(16)}-${stats.size.toString(16)}"`,
      'Last-Modified': stats.mtime.toUTCString(),
      'Accept-Ranges': 'bytes',
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    });

    // Suporte a Range requests (para streaming de vídeo/áudio)
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const startStr = parts[0] ?? '0';
      const start = parseInt(startStr, 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Content-Length': chunkSize,
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);

      logger.debug({ tenantId, fileId: sanitizedFileId, range, start, end }, 'Serving media with range');
    } else {
      // Enviar arquivo completo via stream
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);

      logger.debug({ tenantId, fileId: sanitizedFileId, mimeType, size: stats.size }, 'Serving media');
    }
  } catch (error) {
    logger.error({ error, tenantId, fileId }, 'Error serving media');
    next(error);
  }
});

/**
 * HEAD /api/media/:tenantId/:fileId
 *
 * Retorna apenas os headers (útil para verificar existência/tamanho)
 */
router.head('/:tenantId/:fileId', async (req: Request, res: Response): Promise<void> => {
  const { tenantId, fileId } = req.params;

  // Validar parâmetros
  if (!tenantId || !fileId) {
    res.status(400).end();
    return;
  }

  try {
    const sanitizedFileId = path.basename(fileId);
    if (sanitizedFileId !== fileId || fileId.includes('..')) {
      res.status(400).end();
      return;
    }

    const filePath = await mediaStorageService.findMedia(tenantId, sanitizedFileId);

    if (!filePath) {
      res.status(404).end();
      return;
    }

    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = EXTENSION_TO_MIME[ext] || 'application/octet-stream';

    res.set({
      'Content-Type': mimeType,
      'Content-Length': stats.size,
      'Accept-Ranges': 'bytes',
    });

    res.status(200).end();
  } catch (error) {
    logger.error({ error, tenantId, fileId }, 'Error getting media info');
    res.status(500).end();
  }
});

export default router;
