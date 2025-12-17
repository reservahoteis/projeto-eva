/**
 * Media Storage Service
 *
 * Serviço responsável por salvar e servir mídias recebidas do WhatsApp.
 * Em vez de usar Data URLs (base64), salvamos em disco e servimos via HTTP.
 *
 * Padrão FAANG:
 * - Arquivos organizados por tenant/data/tipo
 * - Nomes únicos com UUID para evitar colisões
 * - Limpeza automática de arquivos antigos
 * - URLs públicas com expiração configurável
 *
 * @author Bot Reserva Hotéis
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '@/config/env';
import logger from '@/config/logger';

// ============================================
// Configuration Constants
// ============================================

/**
 * Diretório base para armazenamento de mídias.
 * Em produção, considerar usar S3, GCS ou similar.
 */
const MEDIA_BASE_DIR = process.env.MEDIA_STORAGE_PATH || '/var/lib/whatsapp-crm/media';

/**
 * URL base para servir mídias.
 * Configurável via variável de ambiente.
 */
const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL || `https://${env.BASE_DOMAIN}/api/media`;

/**
 * Tempo de retenção de arquivos em dias.
 * Arquivos mais antigos serão removidos pela limpeza automática.
 */
const MEDIA_RETENTION_DAYS = parseInt(process.env.MEDIA_RETENTION_DAYS || '30', 10);

/**
 * Extensões de arquivo por tipo MIME.
 */
const MIME_TO_EXTENSION: Record<string, string> = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',

  // Videos
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'video/quicktime': '.mov',
  'video/webm': '.webm',

  // Audio
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/wav': '.wav',
  'audio/aac': '.aac',
  'audio/amr': '.amr',

  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',

  // Default
  'application/octet-stream': '.bin',
};

/**
 * Tipos de mídia suportados.
 */
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

/**
 * Interface para resultado de salvamento de mídia.
 */
export interface SaveMediaResult {
  /** ID único do arquivo */
  fileId: string;
  /** URL pública para acessar a mídia */
  publicUrl: string;
  /** Caminho local do arquivo */
  localPath: string;
  /** Tamanho do arquivo em bytes */
  fileSize: number;
  /** Tipo MIME do arquivo */
  mimeType: string;
  /** Timestamp de criação */
  createdAt: Date;
}

// ============================================
// Service Class
// ============================================

class MediaStorageService {
  private initialized = false;

  /**
   * Inicializa o serviço criando diretórios necessários.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Criar diretório base se não existir
      await fs.promises.mkdir(MEDIA_BASE_DIR, { recursive: true });

      logger.info({ mediaDir: MEDIA_BASE_DIR }, 'Media storage initialized');
      this.initialized = true;
    } catch (error) {
      logger.error({ error, mediaDir: MEDIA_BASE_DIR }, 'Failed to initialize media storage');
      throw error;
    }
  }

  /**
   * Gera um ID único para o arquivo.
   */
  private generateFileId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Obtém a extensão do arquivo baseado no tipo MIME.
   */
  private getExtension(mimeType: string): string {
    const splitResult = mimeType.split(';')[0];
    const cleanMime = (splitResult ?? 'application/octet-stream').trim().toLowerCase();
    return MIME_TO_EXTENSION[cleanMime] ?? '.bin';
  }

  /**
   * Gera o caminho do diretório para o arquivo.
   * Organizado por: tenant/ano/mes/dia/tipo
   */
  private getDirectoryPath(tenantId: string, mediaType: MediaType): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return path.join(MEDIA_BASE_DIR, tenantId, String(year), month, day, mediaType);
  }

  /**
   * Salva um buffer de mídia em disco e retorna a URL pública.
   *
   * @param tenantId - ID do tenant
   * @param buffer - Buffer com os dados da mídia
   * @param mimeType - Tipo MIME da mídia
   * @param mediaType - Tipo de mídia (image, video, etc.)
   * @returns Resultado com URL pública e metadados
   */
  async saveMedia(
    tenantId: string,
    buffer: Buffer,
    mimeType: string,
    mediaType: MediaType
  ): Promise<SaveMediaResult> {
    await this.initialize();

    const fileId = this.generateFileId();
    const extension = this.getExtension(mimeType);
    const fileName = `${fileId}${extension}`;
    const dirPath = this.getDirectoryPath(tenantId, mediaType);
    const filePath = path.join(dirPath, fileName);

    try {
      // Criar diretório se não existir
      await fs.promises.mkdir(dirPath, { recursive: true });

      // Salvar arquivo
      await fs.promises.writeFile(filePath, buffer);

      // Gerar URL pública
      const publicUrl = `${MEDIA_BASE_URL}/${tenantId}/${fileId}${extension}`;

      const result: SaveMediaResult = {
        fileId,
        publicUrl,
        localPath: filePath,
        fileSize: buffer.length,
        mimeType,
        createdAt: new Date(),
      };

      logger.info(
        {
          tenantId,
          fileId,
          mediaType,
          fileSize: buffer.length,
          mimeType,
        },
        'Media saved successfully'
      );

      return result;
    } catch (error) {
      logger.error(
        {
          error,
          tenantId,
          fileId,
          mediaType,
        },
        'Failed to save media'
      );
      throw error;
    }
  }

  /**
   * Salva mídia a partir de um Data URL (base64).
   *
   * @param tenantId - ID do tenant
   * @param dataUrl - Data URL no formato "data:mime;base64,..."
   * @param mediaType - Tipo de mídia
   * @returns Resultado com URL pública e metadados
   */
  async saveFromDataUrl(
    tenantId: string,
    dataUrl: string,
    mediaType: MediaType
  ): Promise<SaveMediaResult> {
    // Extrair tipo MIME e dados base64 do Data URL
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

    if (!matches) {
      throw new Error('Invalid data URL format');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    if (!mimeType || !base64Data) {
      throw new Error('Invalid data URL format: missing mimeType or data');
    }

    const buffer = Buffer.from(base64Data, 'base64');

    return this.saveMedia(tenantId, buffer, mimeType, mediaType);
  }

  /**
   * Busca um arquivo de mídia pelo ID.
   *
   * @param tenantId - ID do tenant
   * @param fileId - ID do arquivo (com ou sem extensão)
   * @returns Caminho do arquivo ou null se não encontrado
   */
  async findMedia(tenantId: string, fileId: string): Promise<string | null> {
    await this.initialize();

    // Extrair ID base e extensão
    const extMatch = fileId.match(/^(.+?)(\.[a-z0-9]+)?$/i);
    if (!extMatch) return null;

    const baseId = extMatch[1] ?? fileId;
    const extension = extMatch[2] ?? '';

    // Buscar em todos os diretórios do tenant
    const tenantDir = path.join(MEDIA_BASE_DIR, tenantId);

    try {
      const files = await this.findFilesRecursive(tenantDir, `${baseId}${extension || '.*'}`);
      return files.length > 0 ? (files[0] ?? null) : null;
    } catch (error) {
      logger.debug({ tenantId, fileId, error }, 'Media file not found');
      return null;
    }
  }

  /**
   * Busca arquivos recursivamente em um diretório.
   */
  private async findFilesRecursive(dir: string, pattern: string): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subResults = await this.findFilesRecursive(fullPath, pattern);
          results.push(...subResults);
        } else if (entry.isFile()) {
          // Verificar se o nome do arquivo corresponde ao padrão
          const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
          if (regex.test(entry.name)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Diretório não existe ou não tem permissão
    }

    return results;
  }

  /**
   * Obtém o caminho do diretório base de mídia.
   */
  getMediaBaseDir(): string {
    return MEDIA_BASE_DIR;
  }

  /**
   * Obtém a URL base para mídias.
   */
  getMediaBaseUrl(): string {
    return MEDIA_BASE_URL;
  }

  /**
   * Limpa arquivos de mídia mais antigos que o período de retenção.
   *
   * @returns Número de arquivos removidos
   */
  async cleanOldMedia(): Promise<number> {
    await this.initialize();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MEDIA_RETENTION_DAYS);

    let removedCount = 0;

    try {
      const tenants = await fs.promises.readdir(MEDIA_BASE_DIR, { withFileTypes: true });

      for (const tenant of tenants) {
        if (!tenant.isDirectory()) continue;

        const tenantPath = path.join(MEDIA_BASE_DIR, tenant.name);
        removedCount += await this.cleanOldFilesInDir(tenantPath, cutoffDate);
      }

      logger.info({ removedCount, cutoffDate, retentionDays: MEDIA_RETENTION_DAYS }, 'Media cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Failed to clean old media');
    }

    return removedCount;
  }

  /**
   * Remove arquivos antigos de um diretório recursivamente.
   */
  private async cleanOldFilesInDir(dir: string, cutoffDate: Date): Promise<number> {
    let removedCount = 0;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          removedCount += await this.cleanOldFilesInDir(fullPath, cutoffDate);

          // Remover diretório se estiver vazio
          try {
            await fs.promises.rmdir(fullPath);
          } catch {
            // Diretório não está vazio
          }
        } else if (entry.isFile()) {
          const stats = await fs.promises.stat(fullPath);

          if (stats.mtime < cutoffDate) {
            await fs.promises.unlink(fullPath);
            removedCount++;
          }
        }
      }
    } catch (error) {
      // Diretório não existe ou sem permissão
    }

    return removedCount;
  }
}

// ============================================
// Export Singleton
// ============================================

export const mediaStorageService = new MediaStorageService();

export default mediaStorageService;
