#!/usr/bin/env node
/**
 * Hook: Carrega contexto ao iniciar sessao
 * Injeta informacoes relevantes das ultimas sessoes
 */

const fs = require('fs');
const path = require('path');

const memoryDir = path.join(process.cwd(), '.claude/memory');
const sessionsDir = path.join(memoryDir, 'sessions');
const instinctsDir = path.join(memoryDir, 'instincts');
const decisionsDir = path.join(memoryDir, 'decisions');

console.log('═'.repeat(60));
console.log('  CRM HOTEIS RESERVA - CONTEXTO DA SESSAO');
console.log('═'.repeat(60));

// Carrega ultima sessao
if (fs.existsSync(sessionsDir)) {
  const sessions = fs.readdirSync(sessionsDir)
    .filter(f => f.startsWith('session-'))
    .sort()
    .reverse();

  if (sessions.length > 0) {
    console.log('\n📅 ULTIMA SESSAO:');
    const lastSession = fs.readFileSync(path.join(sessionsDir, sessions[0]), 'utf-8');
    // Extrai apenas os commits e arquivos modificados
    const lines = lastSession.split('\n');
    let inSection = false;
    let sectionCount = 0;

    lines.forEach(line => {
      if (line.startsWith('## Arquivos Modificados') || line.startsWith('## Commits')) {
        inSection = true;
        sectionCount = 0;
        console.log(line);
      } else if (line.startsWith('## ')) {
        inSection = false;
      } else if (inSection && line.trim() && sectionCount < 5) {
        console.log(line);
        sectionCount++;
      }
    });
  }
}

// Carrega instincts de alta confianca
if (fs.existsSync(instinctsDir)) {
  const instincts = fs.readdirSync(instinctsDir)
    .filter(f => f.endsWith('.md'));

  if (instincts.length > 0) {
    console.log('\n🧠 INSTINCTS ATIVOS:');
    instincts.forEach(file => {
      const content = fs.readFileSync(path.join(instinctsDir, file), 'utf-8');
      // Extrai primeira linha (titulo)
      const title = content.split('\n')[0].replace('#', '').trim();
      // Extrai confianca
      const confMatch = content.match(/Confidence:\s*(\d+)%/);
      const confidence = confMatch ? confMatch[1] : '?';
      console.log(`  - ${title} (${confidence}% confianca)`);
    });
  }
}

// Carrega decisoes recentes
if (fs.existsSync(decisionsDir)) {
  const decisions = fs.readdirSync(decisionsDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, 3);

  if (decisions.length > 0) {
    console.log('\n📋 DECISOES RECENTES:');
    decisions.forEach(file => {
      const content = fs.readFileSync(path.join(decisionsDir, file), 'utf-8');
      const title = content.split('\n')[0].replace('#', '').trim();
      console.log(`  - ${title}`);
    });
  }
}

// Lembra das regras criticas
console.log('\n⚠️  REGRAS CRITICAS:');
console.log('  - TODA query Prisma DEVE ter tenantId');
console.log('  - NUNCA usar @ts-ignore ou any');
console.log('  - Commits em portugues, sem Co-Authored-By');
console.log('  - TDD: Escreva teste ANTES do codigo');

console.log('\n' + '═'.repeat(60));
console.log('  Sessao iniciada. Boa codificacao!');
console.log('═'.repeat(60) + '\n');

process.exit(0);
