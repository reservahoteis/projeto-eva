import dotenv from 'dotenv';
import { z } from 'zod';

// Carregar variáveis de ambiente
dotenv.config();

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  FRONTEND_URL: z.string(), // Aceita múltiplas URLs separadas por vírgula
  BASE_DOMAIN: z.string().default('localhost:3000'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  // WhatsApp (Opcional - configurado por tenant)
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string(),

  // Messenger
  MESSENGER_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  MESSENGER_PAGE_ACCESS_TOKEN: z.string().optional(),
  MESSENGER_PAGE_ID: z.string().optional(),

  // N8N
  N8N_API_KEY: z.string(),

  // Super Admin
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@seucrm.com'),
  SUPER_ADMIN_PASSWORD: z.string().default('change_me_in_production'),

  // Billing (Opcional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Monitoring (Opcional)
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// Parse e validar
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Logger ainda nao disponivel (depende de env), usar stderr direto
  process.stderr.write(`Erro nas variaveis de ambiente:\n${JSON.stringify(parsed.error.format(), null, 2)}\n`);
  process.exit(1);
}

export const env = parsed.data;

// Helper para verificar se está em produção
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
