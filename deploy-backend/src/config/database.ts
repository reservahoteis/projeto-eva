import { PrismaClient } from '@prisma/client';
import { env } from './env';
import logger from './logger';

// Criar instância global do Prisma Client
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Helper para testar conexão
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    logger.info('Database connected');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database connection failed');
    return false;
  }
}
