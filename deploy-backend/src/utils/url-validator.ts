import { BadRequestError } from './errors';
import logger from '@/config/logger';

/**
 * Configuração de domínios permitidos para URLs de mídia
 * Ajuste conforme necessário para seu ambiente
 */
const ALLOWED_MEDIA_HOSTS = [
  // WhatsApp CDN
  'scontent.whatsapp.net',
  'mmg.whatsapp.net',

  // Facebook Graph API
  'graph.facebook.com',
  'scontent.xx.fbcdn.net',
  'lookaside.fbsbx.com',

  // CDN próprio (descomente e configure se tiver)
  // 'cdn.seudominio.com',
  // 'media.seudominio.com',

  // S3 / Object Storage (se usar)
  // 's3.amazonaws.com',
  // 'storage.googleapis.com',
];

/**
 * Protocolos permitidos para URLs de mídia
 */
const ALLOWED_PROTOCOLS = ['https:'];

/**
 * IPs privados/localhost que devem ser bloqueados (SSRF protection)
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./,           // 127.0.0.0/8 (localhost)
  /^10\./,            // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12 (private)
  /^192\.168\./,      // 192.168.0.0/16 (private)
  /^169\.254\./,      // 169.254.0.0/16 (link-local)
  /^::1$/,            // ::1 (IPv6 localhost)
  /^fe80:/,           // fe80::/10 (IPv6 link-local)
  /^fc00:/,           // fc00::/7 (IPv6 private)
];

export interface UrlValidationOptions {
  /**
   * Permitir URLs de qualquer domínio (use com cautela!)
   * Ainda bloqueia IPs privados e protocolos perigosos
   */
  allowAnyHost?: boolean;

  /**
   * Hosts adicionais permitidos além da whitelist padrão
   */
  additionalAllowedHosts?: string[];

  /**
   * Tamanho máximo da URL em caracteres
   */
  maxLength?: number;
}

/**
 * Valida se uma URL é segura para ser usada
 * Protege contra SSRF, file:// injection, etc
 *
 * @throws BadRequestError se URL for inválida ou insegura
 */
export function validateMediaUrl(
  url: string,
  options: UrlValidationOptions = {}
): void {
  const {
    allowAnyHost = false,
    additionalAllowedHosts = [],
    maxLength = 2048,
  } = options;

  // 1. Verificar se URL não está vazia
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new BadRequestError('URL de mídia não pode ser vazia');
  }

  // 2. Verificar tamanho máximo
  if (url.length > maxLength) {
    throw new BadRequestError(`URL excede tamanho máximo de ${maxLength} caracteres`);
  }

  // 3. Parsear URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    logger.warn({ url, error: error instanceof Error ? error.message : 'Unknown' }, 'Invalid URL format');
    throw new BadRequestError('Formato de URL inválido');
  }

  // 4. Verificar protocolo (apenas HTTPS)
  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
    logger.warn({ url, protocol: parsedUrl.protocol }, 'Blocked protocol in URL');
    throw new BadRequestError(`Protocolo não permitido. Use apenas: ${ALLOWED_PROTOCOLS.join(', ')}`);
  }

  // 5. Verificar se não é IP privado (proteção SSRF)
  const hostname = parsedUrl.hostname;

  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      logger.warn({ url, hostname }, 'SSRF attempt detected - private IP blocked');
      throw new BadRequestError('Endereço IP privado não é permitido');
    }
  }

  // 6. Bloquear localhost explicitamente
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    logger.warn({ url, hostname }, 'SSRF attempt detected - localhost blocked');
    throw new BadRequestError('localhost não é permitido');
  }

  // 7. Verificar whitelist de hosts (se não for allowAnyHost)
  if (!allowAnyHost) {
    const allowedHosts = [...ALLOWED_MEDIA_HOSTS, ...additionalAllowedHosts];

    const isAllowed = allowedHosts.some((allowedHost) => {
      // Suportar wildcard: *.exemplo.com
      if (allowedHost.startsWith('*.')) {
        const domain = allowedHost.substring(2);
        return hostname === domain || hostname.endsWith(`.${domain}`);
      }
      return hostname === allowedHost;
    });

    if (!isAllowed) {
      logger.warn(
        {
          url,
          hostname,
          allowedHosts: allowedHosts.slice(0, 5), // Log primeiros 5 para não poluir
        },
        'URL hostname not in whitelist'
      );
      throw new BadRequestError(
        'Domínio não permitido. Apenas URLs de CDNs autorizados são aceitas.'
      );
    }
  }

  // 8. Verificar extensão do arquivo (opcional, mas recomendado)
  const pathname = parsedUrl.pathname.toLowerCase();
  const suspiciousExtensions = ['.exe', '.bat', '.sh', '.dll', '.so', '.dylib'];

  for (const ext of suspiciousExtensions) {
    if (pathname.endsWith(ext)) {
      logger.warn({ url, pathname }, 'Suspicious file extension detected');
      throw new BadRequestError('Tipo de arquivo não permitido');
    }
  }

  // URL válida!
  logger.debug({ url, hostname }, 'URL validation passed');
}

/**
 * Valida URL e retorna true/false (não lança exceção)
 */
export function isValidMediaUrl(
  url: string,
  options?: UrlValidationOptions
): boolean {
  try {
    validateMediaUrl(url, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitiza URL removendo parâmetros sensíveis para logging
 */
export function sanitizeUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url);

    // Remover parâmetros sensíveis comuns
    const sensitiveParams = ['token', 'apikey', 'api_key', 'password', 'secret', 'auth'];
    sensitiveParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '***REDACTED***');
      }
    });

    return parsed.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

/**
 * Adiciona hosts permitidos em runtime (útil para testes ou config dinâmica)
 */
export function addAllowedMediaHost(host: string): void {
  if (!ALLOWED_MEDIA_HOSTS.includes(host)) {
    ALLOWED_MEDIA_HOSTS.push(host);
    logger.info({ host }, 'Added new allowed media host');
  }
}

/**
 * Retorna lista de hosts permitidos (para debug/admin)
 */
export function getAllowedMediaHosts(): string[] {
  return [...ALLOWED_MEDIA_HOSTS];
}
