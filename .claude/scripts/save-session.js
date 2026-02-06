#!/usr/bin/env node
/**
 * Hook: Salva resumo da sessao ao finalizar
 * Cria registro em .claude/memory/sessions/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sessionsDir = path.join(process.cwd(), '.claude/memory/sessions');

// Garante que o diretorio existe
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// Gera timestamp para o arquivo
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const sessionFile = path.join(sessionsDir, `session-${timestamp}.md`);

// Coleta informacoes da sessao
let sessionSummary = `# Sessao ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}

## Arquivos Modificados
`;

try {
  // Lista arquivos modificados (staged e unstaged)
  const modified = execSync('git diff --name-only HEAD~1 2>/dev/null || git diff --name-only', {
    encoding: 'utf-8',
    timeout: 5000
  }).trim();

  if (modified) {
    sessionSummary += modified.split('\n').map(f => `- ${f}`).join('\n');
  } else {
    sessionSummary += '- Nenhum arquivo modificado\n';
  }
} catch (e) {
  sessionSummary += '- Nao foi possivel listar arquivos modificados\n';
}

sessionSummary += '\n\n## Commits da Sessao\n';

try {
  // Lista commits do dia
  const today = now.toISOString().slice(0, 10);
  const commits = execSync(`git log --oneline --since="${today}" 2>/dev/null || echo "Nenhum commit"`, {
    encoding: 'utf-8',
    timeout: 5000
  }).trim();

  sessionSummary += commits.split('\n').map(c => `- ${c}`).join('\n');
} catch (e) {
  sessionSummary += '- Nao foi possivel listar commits\n';
}

sessionSummary += `

## Contexto
- **Projeto:** CRM Hoteis Reserva
- **Branch:** ${getBranch()}
- **Duracao:** Sessao finalizada

## Notas
[Adicione notas relevantes sobre esta sessao]

## Padroes Identificados
[Padroes que podem ser extraidos para instincts]

## Decisoes Tomadas
[Decisoes arquiteturais ou de implementacao]
`;

function getBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return 'desconhecida';
  }
}

// Salva o arquivo
fs.writeFileSync(sessionFile, sessionSummary);
console.log(`[SESSION] ✓ Resumo salvo em ${path.basename(sessionFile)}`);

// Limpa sessoes antigas (mantem ultimas 20)
try {
  const sessions = fs.readdirSync(sessionsDir)
    .filter(f => f.startsWith('session-'))
    .sort()
    .reverse();

  if (sessions.length > 20) {
    sessions.slice(20).forEach(f => {
      fs.unlinkSync(path.join(sessionsDir, f));
    });
    console.log(`[SESSION] Limpeza: removidas ${sessions.length - 20} sessoes antigas`);
  }
} catch (e) {
  // Ignora erros de limpeza
}

process.exit(0);
