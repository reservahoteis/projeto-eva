import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

/**
 * Tipo para resultado do groupBy de mensagens não lidas
 */
export interface UnreadCountResult {
  conversationId: string;
  _count: { id: number };
}

/**
 * Mock do Prisma Client para testes
 * Usa jest-mock-extended para criar mocks profundos
 */
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

/**
 * Helper para mockar groupBy de mensagens com tipagem correta
 */
export function mockMessageGroupBy(results: UnreadCountResult[]): void {
  prismaMock.message.groupBy.mockResolvedValue(results as never);
}

/**
 * Reseta todos os mocks do Prisma
 * Deve ser chamado em beforeEach
 */
export function resetPrismaMock() {
  mockReset(prismaMock);
}

/**
 * Mock do Prisma para ser usado nos testes
 */
jest.mock('@/config/database', () => ({
  prisma: prismaMock,
}));

export default prismaMock;
