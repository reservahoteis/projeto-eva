#!/usr/bin/env node
/**
 * Hook: Verifica isolamento multi-tenant
 * Detecta queries Prisma sem tenantId
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

const content = fs.readFileSync(filePath, 'utf-8');

// Padroes que indicam query Prisma
const prismaPatterns = [
  /prisma\.\w+\.findMany\s*\(/g,
  /prisma\.\w+\.findFirst\s*\(/g,
  /prisma\.\w+\.findUnique\s*\(/g,
  /prisma\.\w+\.update\s*\(/g,
  /prisma\.\w+\.delete\s*\(/g,
  /prisma\.\w+\.count\s*\(/g,
];

// Entidades que DEVEM ter tenantId
const tenantEntities = [
  'conversation',
  'contact',
  'message',
  'user',
  'tag',
  'escalation',
  'quickReply',
  'template',
  'attachment',
  'channel',
];

let warnings = [];

// Verifica cada padrao
prismaPatterns.forEach(pattern => {
  const matches = content.match(pattern);
  if (matches) {
    matches.forEach(match => {
      // Extrai nome da entidade
      const entityMatch = match.match(/prisma\.(\w+)\./);
      if (entityMatch) {
        const entity = entityMatch[1].toLowerCase();

        // Se e uma entidade que precisa de tenantId
        if (tenantEntities.some(e => entity.includes(e))) {
          // Busca o bloco where proximo
          const matchIndex = content.indexOf(match);
          const blockAfter = content.substring(matchIndex, matchIndex + 500);

          // Verifica se tem tenantId no where
          if (!blockAfter.includes('tenantId')) {
            // Pode ser falso positivo, mas alerta
            warnings.push(`${match} - Verificar se tem tenantId no where`);
          }
        }
      }
    });
  }
});

if (warnings.length > 0) {
  console.log(`[MULTI-TENANT] ⚠ Verificar queries em ${path.basename(filePath)}:`);
  warnings.slice(0, 3).forEach(w => console.log(`  - ${w}`));
  console.log('[MULTI-TENANT] Lembre-se: TODA query DEVE filtrar por tenantId!');
}

process.exit(0);
