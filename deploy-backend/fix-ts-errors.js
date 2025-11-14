/**
 * Script para corrigir erros TypeScript TS7030 nos controllers
 * Adiciona 'return' antes de todos os res.json() que estão sem return
 */

const fs = require('fs');
const path = require('path');

const controllers = [
  'src/controllers/message.controller.ts',
  'src/controllers/webhook.controller.ts',
  'src/controllers/conversation.controller.ts'
];

controllers.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Arquivo não encontrado: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix 1: Adicionar return antes de res.json() que não tem return
  // Match: newline + spaces + res.json (sem return antes)
  const regex1 = /(\n\s+)(res\.(json|status\(\d+\)\.json|send|status\(\d+\)\.send))/g;
  const lines = content.split('\n');
  const fixedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';

    // Se a linha tem res.json/send e a linha anterior não é return, if, ou {
    if (line.match(/^\s+res\.(json|status|send)/) &&
        !prevLine.match(/return|if|else|{|\?/) &&
        !line.match(/^\s+return/)) {

      const indent = line.match(/^(\s+)/)?.[1] || '';
      fixedLines.push(indent + 'return ' + line.trim());
      changed = true;
    } else {
      fixedLines.push(line);
    }
  }

  if (changed) {
    content = fixedLines.join('\n');

    // Fix 2: Corrigir tipos undefined em argumentos
    // conversationId, id, etc que podem ser string | undefined
    content = content.replace(
      /const (\w+) = req\.params\.(\w+);/g,
      'const $1 = req.params.$2 as string;'
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file} corrigido`);
  } else {
    console.log(`ℹ️  ${file} - nenhuma mudança necessária`);
  }
});

console.log('\n🎉 Correção concluída!');
