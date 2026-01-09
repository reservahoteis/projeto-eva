/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Padrão de arquivos de teste
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],

  // Ignorar arquivos
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.next/'
  ],

  // Path aliases (mesmo do tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/types/**',
    '!src/**/index.ts',
    '!src/server.ts', // Entry point não precisa coverage
  ],

  // Threshold de coverage (ajuste conforme o projeto amadurece)
  // Atual: ~35% lines/statements, ~27% branches, ~30% functions
  // Meta: aumentar gradualmente até 80%
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 28,
      lines: 34,
      statements: 34
    }
  },

  // Setup files (executam antes de cada teste)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Timeout (útil para testes de integração)
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Transformações
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        // Configurações específicas para testes
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },

  // Limpar mocks automaticamente entre testes
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
