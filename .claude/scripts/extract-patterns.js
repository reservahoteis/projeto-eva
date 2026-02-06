#!/usr/bin/env node
/**
 * Hook: Extrai padroes apos push bem-sucedido
 * Analisa commits e cria/atualiza instincts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const patternsDir = path.join(process.cwd(), '.claude/memory/patterns');
const instinctsDir = path.join(process.cwd(), '.claude/memory/instincts');

// Garante que diretorios existem
[patternsDir, instinctsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('[PATTERNS] Analisando commits recentes...');

try {
  // Pega diff do ultimo push
  const diff = execSync('git diff HEAD~3..HEAD --stat 2>/dev/null || echo ""', {
    encoding: 'utf-8',
    timeout: 10000
  });

  // Analisa arquivos modificados
  const files = diff.split('\n')
    .filter(line => line.includes('|'))
    .map(line => line.split('|')[0].trim());

  // Detecta padroes por tipo de arquivo
  const patterns = {
    controllers: files.filter(f => f.includes('controller')).length,
    services: files.filter(f => f.includes('service')).length,
    routes: files.filter(f => f.includes('route')).length,
    components: files.filter(f => f.includes('component')).length,
    tests: files.filter(f => f.includes('test') || f.includes('spec')).length,
  };

  // Se teve muitos arquivos de um tipo, registra
  Object.entries(patterns).forEach(([type, count]) => {
    if (count >= 2) {
      const patternFile = path.join(patternsDir, `${type}-activity.json`);
      let data = { count: 0, lastSeen: null, sessions: [] };

      if (fs.existsSync(patternFile)) {
        data = JSON.parse(fs.readFileSync(patternFile, 'utf-8'));
      }

      data.count += count;
      data.lastSeen = new Date().toISOString();
      data.sessions.push({
        date: new Date().toISOString(),
        files: count
      });

      // Mantem apenas ultimas 10 sessoes
      data.sessions = data.sessions.slice(-10);

      fs.writeFileSync(patternFile, JSON.stringify(data, null, 2));
      console.log(`[PATTERNS] ${type}: ${count} arquivos modificados (total: ${data.count})`);
    }
  });

  // Detecta se commits seguiram TDD (testes antes de implementacao)
  const commits = execSync('git log --oneline -5 2>/dev/null || echo ""', {
    encoding: 'utf-8'
  }).split('\n').filter(Boolean);

  const testCommits = commits.filter(c => c.toLowerCase().includes('test'));
  if (testCommits.length > 0) {
    console.log(`[PATTERNS] ✓ ${testCommits.length} commits relacionados a testes`);
  }

} catch (error) {
  console.log('[PATTERNS] Nao foi possivel extrair padroes');
}

process.exit(0);
