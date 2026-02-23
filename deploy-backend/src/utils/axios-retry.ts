import { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import logger from '@/config/logger';

interface RetryConfig {
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms (default: 1000) */
  baseDelay?: number;
  /** Max delay in ms (default: 15000) */
  maxDelay?: number;
  /** Log prefix for identifying the service */
  logPrefix?: string;
}

interface InternalRetryConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
  __maxRetries?: number;
  __baseDelay?: number;
  __maxDelay?: number;
  __logPrefix?: string;
}

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'EPIPE',
  'ERR_NETWORK',
]);

const RETRYABLE_HTTP_STATUSES = new Set([
  429, // Too Many Requests
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * Calcula delay com exponential backoff + jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = exponential * 0.2 * Math.random(); // 20% jitter
  return Math.min(exponential + jitter, maxDelay);
}

/**
 * Verifica se o erro e retryable
 */
function isRetryableError(error: AxiosError): boolean {
  // Network errors (sem response)
  if (!error.response) {
    const code = (error as any).code || error.message;
    return RETRYABLE_NETWORK_CODES.has(code);
  }

  // HTTP status retryable
  return RETRYABLE_HTTP_STATUSES.has(error.response.status);
}

/**
 * Extrai retry-after header (em ms) se presente
 */
function getRetryAfter(error: AxiosError): number | null {
  const header = error.response?.headers?.['retry-after'];
  if (!header) return null;

  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;

  const date = new Date(header).getTime();
  if (!isNaN(date)) return Math.max(0, date - Date.now());

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Adiciona retry com exponential backoff a uma instancia axios.
 * Retenta automaticamente em erros de rede (ECONNRESET, ECONNREFUSED, etc)
 * e HTTP 429/502/503/504.
 */
export function addRetryInterceptor(
  instance: AxiosInstance,
  config: RetryConfig = {}
): AxiosInstance {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 15000,
    logPrefix = 'GraphAPI',
  } = config;

  instance.interceptors.request.use((reqConfig: InternalRetryConfig) => {
    if (reqConfig.__retryCount === undefined) {
      reqConfig.__retryCount = 0;
      reqConfig.__maxRetries = maxRetries;
      reqConfig.__baseDelay = baseDelay;
      reqConfig.__maxDelay = maxDelay;
      reqConfig.__logPrefix = logPrefix;
    }
    return reqConfig;
  });

  instance.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as InternalRetryConfig | undefined;
    if (!config) return Promise.reject(error);

    const retryCount = config.__retryCount ?? 0;
    const max = config.__maxRetries ?? maxRetries;
    const base = config.__baseDelay ?? baseDelay;
    const cap = config.__maxDelay ?? maxDelay;
    const prefix = config.__logPrefix ?? logPrefix;

    if (retryCount >= max || !isRetryableError(error)) {
      return Promise.reject(error);
    }

    config.__retryCount = retryCount + 1;

    // Respeitar Retry-After header se presente
    const retryAfter = getRetryAfter(error);
    const delay = retryAfter ?? calculateDelay(retryCount, base, cap);

    const errorCode = (error as any).code || error.response?.status || 'unknown';
    logger.warn(
      {
        attempt: retryCount + 1,
        maxRetries: max,
        delay: Math.round(delay),
        errorCode,
        url: config.url,
        method: config.method,
      },
      `${prefix}: Retrying request after error`
    );

    await sleep(delay);

    return instance.request(config);
  });

  return instance;
}
