#!/usr/bin/env node
/**
 * Hook: TDD Enforcement Rigoroso
 *
 * Baseado no padrao superpowers - verifica se existe teste ANTES
 * de permitir criacao/edicao de codigo de implementacao.
 *
 * Regras:
 * - services/*.ts -> DEVE existir __tests__/services/*.test.ts
 * - controllers/*.ts -> DEVE existir __tests__/controllers/*.test.ts
 * - hooks/*.ts -> DEVE existir __tests__/hooks/*.test.ts
 *
 * IMPORTANTE: Este hook NAO deleta codigo (diferente do superpowers original)
 * Apenas ALERTA fortemente e retorna exit code 1 para bloquear.
 */

const path = require('path');
const fs = require('fs');

const filePath = process.argv[2];
const action = process.argv[3] || 'edit'; // 'edit' ou 'write'

if (!filePath) {
  process.exit(0);
}

// Patterns que REQUEREM teste
const TDD_REQUIRED_PATTERNS = [
  { pattern: /services\/(?!.*\.test\.ts).*\.ts$/, testDir: '__tests__/services' },
  { pattern: /controllers\/(?!.*\.test\.ts).*\.ts$/, testDir: '__tests__/controllers' },
  { pattern: /hooks\/(?!.*\.test\.ts).*\.ts$/, testDir: '__tests__/hooks' },
  { pattern: /validators\/(?!.*\.test\.ts).*\.ts$/, testDir: '__tests__/validators' },
  { pattern: /utils\/(?!.*\.test\.ts).*\.ts$/, testDir: '__tests__/utils' },
];

// Patterns ISENTOS de TDD (config, types, etc)
const TDD_EXEMPT_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /types\.ts$/,
  /\.d\.ts$/,
  /config\//,
  /migrations\//,
  /index\.ts$/,
  /__tests__\//,
];

// Verifica se arquivo esta isento
function isExempt(filePath) {
  return TDD_EXEMPT_PATTERNS.some(pattern => pattern.test(filePath));
}

// Encontra o diretorio do projeto
function findProjectRoot(filePath) {
  if (filePath.includes('deploy-backend')) {
    return filePath.split('deploy-backend')[0] + 'deploy-backend';
  }
  if (filePath.includes('apps/frontend')) {
    return filePath.split('apps/frontend')[0] + 'apps/frontend';
  }
  return process.cwd();
}

// Gera o caminho esperado do teste
function getExpectedTestPath(filePath, testDir) {
  const projectRoot = findProjectRoot(filePath);
  const fileName = path.basename(filePath, '.ts');
  const testFileName = `${fileName}.test.ts`;
  return path.join(projectRoot, 'src', testDir, testFileName);
}

// Verifica se teste existe
function testExists(filePath, testDir) {
  const testPath = getExpectedTestPath(filePath, testDir);

  // Tenta algumas variacoes
  const variations = [
    testPath,
    testPath.replace('.test.ts', '.spec.ts'),
    // Tenta no mesmo nivel
    filePath.replace('.ts', '.test.ts'),
    filePath.replace('.ts', '.spec.ts'),
  ];

  return variations.some(p => fs.existsSync(p));
}

// Main
function main() {
  // Se arquivo isento, permite
  if (isExempt(filePath)) {
    process.exit(0);
  }

  // Verifica cada pattern
  for (const { pattern, testDir } of TDD_REQUIRED_PATTERNS) {
    if (pattern.test(filePath)) {
      if (!testExists(filePath, testDir)) {
        const expectedPath = getExpectedTestPath(filePath, testDir);

        console.error('');
        console.error('╔═══════════════════════════════════════════════════════════════╗');
        console.error('║  🔴 TDD ENFORCEMENT: TESTE NAO ENCONTRADO                     ║');
        console.error('╠═══════════════════════════════════════════════════════════════╣');
        console.error('║                                                               ║');
        console.error(`║  Arquivo: ${path.basename(filePath).padEnd(50)}║`);
        console.error('║                                                               ║');
        console.error('║  ACAO REQUERIDA:                                              ║');
        console.error('║  1. Primeiro, crie o arquivo de teste                         ║');
        console.error('║  2. Escreva os testes (RED)                                   ║');
        console.error('║  3. Depois implemente o codigo (GREEN)                        ║');
        console.error('║  4. Refatore se necessario (REFACTOR)                         ║');
        console.error('║                                                               ║');
        console.error('║  Teste esperado em:                                           ║');
        console.error(`║  ${testDir}/${path.basename(filePath, '.ts')}.test.ts`.padEnd(64) + '║');
        console.error('║                                                               ║');
        console.error('╚═══════════════════════════════════════════════════════════════╝');
        console.error('');

        // Exit code 1 para bloquear (se hook configurado com on_failure: "block")
        // Por padrao usamos "warn" para nao quebrar fluxo existente
        process.exit(1);
      }
    }
  }

  // Se chegou aqui, teste existe ou arquivo nao requer TDD
  console.log(`[TDD] ✓ ${path.basename(filePath)} - OK`);
  process.exit(0);
}

main();
