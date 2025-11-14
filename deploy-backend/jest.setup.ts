/**
 * Setup global para todos os testes
 * Este arquivo é executado uma vez antes de todos os testes
 */

// Mock de variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-min-32-characters';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.WHATSAPP_API_VERSION = 'v21.0';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-webhook-verify-token';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.N8N_API_KEY = 'test-n8n-api-key';

// Aumentar timeout para testes de integração
jest.setTimeout(10000);

// Console mocks (reduz ruído nos testes)
global.console = {
  ...console,
  // Desabilitar logs durante testes (descomente se quiser ver logs)
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // error: jest.fn(), // Manter erros visíveis
};

// Mock do Prisma Client para testes unitários
// Para testes de integração, usar banco de teste real
jest.mock('@/config/database', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
    // Adicionar mocks de modelos conforme necessário
    tenant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contact: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock do logger para não poluir output dos testes
const mockLogger: any = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  child: jest.fn(function() { return mockLogger; }), // Para child loggers
};

jest.mock('@/config/logger', () => ({
  default: mockLogger,
  __esModule: true,
}));

// Cleanup após todos os testes
afterAll(async () => {
  // Fechar conexões, limpar recursos, etc
  jest.clearAllMocks();
});
