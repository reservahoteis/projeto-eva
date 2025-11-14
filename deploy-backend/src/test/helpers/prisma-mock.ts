import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

/**
 * Mock do Prisma Client para testes
 * Usa jest-mock-extended para criar mocks profundos
 */
export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

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
