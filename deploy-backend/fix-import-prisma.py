#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Adicionar import do prismaMock no topo (se ainda não tiver)
if 'import { resetPrismaMock, prismaMock }' not in content:
    content = content.replace(
        "import { resetPrismaMock } from '../test/helpers/prisma-mock';",
        "import { resetPrismaMock, prismaMock } from '../test/helpers/prisma-mock';"
    )

# Substituir todos os require('../test/helpers/prisma-mock').prismaMock
# por apenas prismaMock
content = re.sub(
    r"const prismaMock = require\('\.\./test/helpers/prisma-mock'\)\.prismaMock;",
    "",
    content
)

# Remover linhas vazias duplicadas
content = re.sub(r'\n\n\n+', '\n\n', content)

print("Import do prismaMock corrigido!")

# Salvar
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
