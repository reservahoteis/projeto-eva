#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Percorrer as linhas e adicionar 'as any' logo após mockResolvedValue(...})
result = []
i = 0
while i < len(lines):
    line = lines[i]
    result.append(line)

    # Se a linha contém prismaMock.tenant.findUnique.mockResolvedValue({
    if 'prismaMock.tenant.findUnique.mockResolvedValue({' in line:
        # Encontrar o fechamento correspondente
        depth = 1
        j = i + 1
        while j < len(lines) and depth > 0:
            if '{' in lines[j]:
                depth += lines[j].count('{')
            if '}' in lines[j]:
                depth -= lines[j].count('}')

            # Se é a linha de fechamento final
            if depth == 0 and '});' in lines[j]:
                # Substituir }); por } as any);
                lines[j] = lines[j].replace('});', '} as any);')
                break
            j += 1

    i += 1

# Salvar
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Type errors corrigidos v2!")
