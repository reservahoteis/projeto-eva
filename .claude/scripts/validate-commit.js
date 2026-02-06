#!/usr/bin/env node
/**
 * Hook: Valida formato de commit
 * Verifica se segue o padrao do projeto
 */

const { execSync } = require('child_process');

try {
  // Pega a ultima mensagem de commit
  const lastCommit = execSync('git log -1 --pretty=%B', { encoding: 'utf-8' }).trim();

  // Padrao esperado: tipo(escopo): descricao
  const commitPattern = /^(feat|fix|refactor|docs|style|test|chore|perf)\([a-z-]+\):\s.+/;

  if (!commitPattern.test(lastCommit)) {
    console.log('[COMMIT] ⚠ Formato de commit nao segue o padrao:');
    console.log('  Esperado: tipo(escopo): descricao');
    console.log('  Tipos: feat, fix, refactor, docs, style, test, chore, perf');
    console.log(`  Recebido: "${lastCommit.split('\n')[0]}"`);
  } else {
    console.log('[COMMIT] ✓ Formato de commit OK');
  }

  // Verifica se tem Co-Authored-By (proibido no projeto)
  if (lastCommit.includes('Co-Authored-By')) {
    console.log('[COMMIT] ⚠ Commit contem Co-Authored-By (nao usar neste projeto)');
  }

} catch (error) {
  // Ignora erros (pode nao ter commits)
}

process.exit(0);
