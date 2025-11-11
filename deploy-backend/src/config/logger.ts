import pino from 'pino';
import { env, isDev } from './env';

// Configuração do logger
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

// Helper para criar child logger com contexto
export function createLogger(context: string) {
  return logger.child({ context });
}

// Export logger padrão
export default logger;
