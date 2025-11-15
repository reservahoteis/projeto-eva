#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover jest.clearAllMocks() do beforeEach global
# Isso está limpando os mocks configurados nos beforeEach internos
content = content.replace('''  beforeEach(() => {
    service = new WhatsAppServiceV2();
    jest.clearAllMocks();
  });''', '''  beforeEach(() => {
    service = new WhatsAppServiceV2();
  });''')

print("Mock order corrigido!")

# Salvar
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
