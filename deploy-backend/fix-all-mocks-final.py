#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Substituir URLs de example.com por domínios permitidos
content = content.replace('https://example.com/image.jpg', 'https://scontent.whatsapp.net/v/test-image.jpg')
content = content.replace('https://example.com/video.mp4', 'https://scontent.whatsapp.net/v/test-video.mp4')
content = content.replace('https://example.com/audio.ogg', 'https://scontent.whatsapp.net/v/test-audio.ogg')
content = content.replace('https://example.com/file.pdf', 'https://scontent.whatsapp.net/v/test-file.pdf')
content = content.replace('https://example.com/img.jpg', 'https://scontent.whatsapp.net/v/test-img.jpg')

# 2. Adicionar import do prismaMock
content = content.replace(
    "import { describe, it, expect, jest, beforeEach } from '@jest/globals';\nimport { WhatsAppServiceV2 } from './whatsapp.service.v2';",
    "import { describe, it, expect, jest, beforeEach } from '@jest/globals';\nimport { WhatsAppServiceV2 } from './whatsapp.service.v2';\nimport { prismaMock } from '../test/helpers/prisma-mock';"
)

# 3. Remover jest.clearAllMocks() do beforeEach global
content = content.replace(
    '''  beforeEach(() => {
    service = new WhatsAppServiceV2();
    jest.clearAllMocks();
  });''',
    '''  beforeEach(() => {
    service = new WhatsAppServiceV2();
  });'''
)

# 4. Substituir todos os require do prismaMock por uso direto da variável importada
content = re.sub(
    r"const prismaMock = require\('\.\./test/helpers/prisma-mock'\)\.prismaMock;",
    "",
    content
)

# Remover linhas vazias duplicadas
content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

# 5. Adicionar 'as any' em todos os mockResolvedValue do tenant
# Encontrar padrões de tenant mock e adicionar as any
content = re.sub(
    r'(prismaMock\.tenant\.findUnique\.mockResolvedValue\(\{[^}]*(?:\n[^}]*)*?\}\));',
    r'\1 as any);',
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Corrigir duplicação de 'as any'
content = content.replace('} as any); as any);', '} as any);')

# 6. Corrigir teste do truncamento de botão
old_truncate_test = '''    it('deve truncar título do botão se exceder 20 caracteres', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.btn5' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      const axios = require('axios');
      axios.create = jest.fn().mockReturnValue(mockAxiosInstance) as any;

      await service.sendInteractiveButtons(
        mockTenantId,
        '5511999999999',
        'Choose:',
        [{ id: '1', title: 'Este título tem mais de 20 caracteres' }]
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: {
              buttons: [
                expect.objectContaining({
                  reply: {
                    id: '1',
                    title: 'Este título tem mais', // 20 chars
                  },
                }),
              ],
            },
          }),
        })
      );
    });'''

new_truncate_test = '''    it('deve lançar BadRequestError se título do botão exceder 20 caracteres', async () => {
      await expect(
        service.sendInteractiveButtons(
          mockTenantId,
          '5511999999999',
          'Choose:',
          [{ id: '1', title: 'Este título tem mais de 20 caracteres' }]
        )
      ).rejects.toThrow('Botão 1: título excede 20 caracteres');
    });'''

content = content.replace(old_truncate_test, new_truncate_test)

print("Todas as correções aplicadas!")

# Salvar
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
