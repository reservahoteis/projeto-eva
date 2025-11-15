#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Padrão 1: Mock básico (com id, whatsappPhoneNumberId, whatsappAccessToken) - adicionar campos faltantes
pattern1 = r'''      prismaMock\.tenant\.findUnique\.mockResolvedValue\(\{\n        name: 'Test Tenant',\n        slug: 'test-tenant',\n        id: mockTenantId,\n        whatsappPhoneNumberId: mockPhoneNumberId,\n        whatsappAccessToken: mockAccessToken,\n      \}\);'''

replacement1 = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
        whatsappBusinessAccountId: 'business-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });'''

content = re.sub(pattern1, replacement1, content)

# Padrão 2: Mock com campos null
pattern2 = r'''      prismaMock\.tenant\.findUnique\.mockResolvedValue\(\{\n        name: 'Test Tenant',\n        slug: 'test-tenant',\n        id: mockTenantId,\n        whatsappPhoneNumberId: null,\n        whatsappAccessToken: null,\n      \}\);'''

replacement2 = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        whatsappPhoneNumberId: null,
        whatsappAccessToken: null,
        whatsappBusinessAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });'''

content = re.sub(pattern2, replacement2, content)

# Padrão 3: Mock com só whatsappPhoneNumberId null
pattern3 = r'''      prismaMock\.tenant\.findUnique\.mockResolvedValue\(\{\n        name: 'Test Tenant',\n        slug: 'test-tenant',\n        id: mockTenantId,\n        whatsappPhoneNumberId: null,\n      \}\);'''

replacement3 = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        whatsappPhoneNumberId: null,
        whatsappAccessToken: null,
        whatsappBusinessAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });'''

content = re.sub(pattern3, replacement3, content)

# Salvar
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Mocks v2 corrigidos!')
