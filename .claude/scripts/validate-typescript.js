#!/usr/bin/env node
/**
 * Hook: Valida TypeScript apos edicao
 * Executa tsc --noEmit no arquivo editado
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const filePath = process.argv[2];

if (!filePath) {
  console.log('[TS] Nenhum arquivo especificado');
  process.exit(0);
}

// Determina o diretorio do projeto baseado no arquivo
let projectRoot = process.cwd();

// Se o arquivo esta em deploy-backend, usa esse como root
if (filePath.includes('deploy-backend')) {
  projectRoot = path.join(process.cwd(), 'deploy-backend');
} else if (filePath.includes('apps/frontend')) {
  projectRoot = path.join(process.cwd(), 'apps/frontend');
}

// Verifica se existe tsconfig.json
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
if (!fs.existsSync(tsconfigPath)) {
  console.log(`[TS] tsconfig.json nao encontrado em ${projectRoot}`);
  process.exit(0);
}

try {
  // Executa validacao TypeScript
  execSync(`npx tsc --noEmit --pretty`, {
    cwd: projectRoot,
    stdio: 'pipe',
    timeout: 30000
  });

  console.log(`[TS] ✓ ${path.basename(filePath)} - Sem erros de tipo`);
  process.exit(0);
} catch (error) {
  // Extrai apenas erros do arquivo editado para nao poluir output
  const output = error.stdout?.toString() || error.stderr?.toString() || '';
  const relevantErrors = output
    .split('\n')
    .filter(line => line.includes(path.basename(filePath)))
    .slice(0, 5)
    .join('\n');

  if (relevantErrors) {
    console.error(`[TS] ✗ Erros em ${path.basename(filePath)}:`);
    console.error(relevantErrors);
  } else {
    console.log(`[TS] ⚠ Erros de tipo detectados (verifique com tsc --noEmit)`);
  }

  // Retorna 0 para nao bloquear o fluxo (on_failure: warn)
  process.exit(0);
}
