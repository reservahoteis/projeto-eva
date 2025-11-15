#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Adicionar import do resetPrismaMock no topo
if 'resetPrismaMock' not in content:
    content = content.replace(
        "import { WhatsAppServiceV2 } from './whatsapp.service.v2';",
        "import { WhatsAppServiceV2 } from './whatsapp.service.v2';\nimport { resetPrismaMock } from '../test/helpers/prisma-mock';"
    )

# Adicionar resetPrismaMock() no beforeEach global
content = content.replace(
    '''  beforeEach(() => {
    service = new WhatsAppServiceV2();
  });''',
    '''  beforeEach(() => {
    resetPrismaMock();
    service = new WhatsAppServiceV2();
  });'''
)

print("Prisma reset adicionado!")

# Salvar
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
