const fs = require('fs');
const path = require('path');

// Caminho do arquivo
const filePath = path.join(__dirname, 'src', 'services', 'message.service.v2.ts');

// Ler o arquivo
let content = fs.readFileSync(filePath, 'utf8');

// Encontrar e remover código duplicado
// O padrão é: há um "}" seguido de ";" na linha 151, depois código duplicado até linha 185
const lines = content.split('\n');

// Encontrar a posição do erro (linha 151 tem um "};")
let startDuplicate = -1;
let endDuplicate = -1;

for (let i = 0; i < lines.length; i++) {
  // Procurar pela linha com "};" que não deveria estar ali
  if (lines[i].trim() === '};' && i > 140 && i < 160) {
    startDuplicate = i;
    break;
  }
}

if (startDuplicate > -1) {
  // Encontrar o fim do código duplicado (próximo "}")
  for (let i = startDuplicate + 1; i < lines.length; i++) {
    if (lines[i].trim() === '}' && lines[i-1].includes('nextCursor')) {
      endDuplicate = i;
      break;
    }
  }
}

if (startDuplicate > -1 && endDuplicate > -1) {
  console.log(`Removendo código duplicado das linhas ${startDuplicate + 1} a ${endDuplicate + 1}`);

  // Corrigir: mudar "};" para apenas "}"
  lines[startDuplicate] = '  }';

  // Remover linhas duplicadas
  lines.splice(startDuplicate + 1, endDuplicate - startDuplicate);

  // Reescrever o arquivo
  const fixedContent = lines.join('\n');
  fs.writeFileSync(filePath, fixedContent);

  console.log('Arquivo corrigido com sucesso!');
} else {
  console.log('Não foi encontrado código duplicado ou o arquivo já está correto.');
}