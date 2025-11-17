const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'message.service.v2.ts');

// Ler o arquivo
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Analisando arquivo...');
console.log('Total de linhas:', lines.length);

// Procurar pela linha problemática (linha 151 tem "};")
let problemLine = -1;
for (let i = 140; i < 160 && i < lines.length; i++) {
  if (lines[i].trim() === '};') {
    problemLine = i;
    console.log(`Encontrado "};" na linha ${i + 1}`);
    break;
  }
}

if (problemLine === -1) {
  console.log('Arquivo já está correto ou padrão não encontrado');
  process.exit(0);
}

// Corrigir removendo o ponto e vírgula
lines[problemLine] = '  }';
console.log(`Corrigido "};" para "}" na linha ${problemLine + 1}`);

// Encontrar e remover código duplicado
// O código duplicado começa após a linha problemática
let duplicateStart = problemLine + 2; // Pular linha vazia
let duplicateEnd = -1;

// Procurar pelo fim do código duplicado (onde termina a função duplicada)
for (let i = duplicateStart; i < lines.length; i++) {
  if (lines[i].trim() === '}' && i > duplicateStart + 20) {
    // Verificar se é o fim da função duplicada
    if (lines[i-1].includes('nextCursor') || lines[i-2].includes('nextCursor')) {
      duplicateEnd = i;
      console.log(`Encontrado fim do código duplicado na linha ${i + 1}`);
      break;
    }
  }
}

if (duplicateEnd > duplicateStart) {
  const removedLines = duplicateEnd - duplicateStart + 1;
  console.log(`Removendo ${removedLines} linhas de código duplicado (linhas ${duplicateStart + 1} a ${duplicateEnd + 1})`);

  // Remover as linhas duplicadas
  lines.splice(duplicateStart, removedLines);

  // Salvar o arquivo corrigido
  const fixedContent = lines.join('\n');
  fs.writeFileSync(filePath, fixedContent);

  console.log('Arquivo corrigido com sucesso!');
  console.log('Novo total de linhas:', lines.length);
} else {
  // Apenas corrigir o ponto e vírgula
  const fixedContent = lines.join('\n');
  fs.writeFileSync(filePath, fixedContent);
  console.log('Apenas o ponto e vírgula foi corrigido');
}