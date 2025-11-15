#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Adicionar 'as any' em todos os mockResolvedValue do Prisma
content = re.sub(
    r'prismaMock\.tenant\.findUnique\.mockResolvedValue\(',
    'prismaMock.tenant.findUnique.mockResolvedValue(',
    content
)

# Agora adicionar as any depois de cada fechamento de chaves do tenant mock
# Padrão: }); que vem depois de um tenant mock
content = re.sub(
    r'(prismaMock\.tenant\.findUnique\.mockResolvedValue\(\{[^}]+\n[^}]+\n[^}]+\n[^}]+\n[^}]+\n[^}]+\n[^}]+\n[^}]+\n\s+\}\));',
    r'\1 as any);',
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Solução mais simples: substituir diretamente os padrões conhecidos
content = content.replace(
    '      });',
    '      } as any);'
)

# Voltar alguns que não são mocks do Prisma
content = content.replace('      } as any as any);', '      } as any);')

print("Type errors corrigidos!")

# Salvar
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
