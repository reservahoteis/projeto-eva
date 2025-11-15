#!/usr/bin/env python3
import re

# Ler o arquivo
with open('src/services/whatsapp.service.v2.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Padrão 1: Substituir mocks incompletos do tenant
old_mock = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      });'''

new_mock = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
        whatsappBusinessAccountId: 'business-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      });'''

content = content.replace(old_mock, new_mock)

# Padrão 2: Substituir mocks que só têm whatsappPhoneNumberId null
old_mock_null = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: null,
        whatsappAccessToken: null,
      });'''

new_mock_null = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        whatsappPhoneNumberId: null,
        whatsappAccessToken: null,
        whatsappBusinessAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });'''

content = content.replace(old_mock_null, new_mock_null)

# Padrão 3: Substituir mocks que só têm id e whatsappPhoneNumberId null (sem accessToken)
old_mock_null2 = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: null,
      });'''

new_mock_null2 = '''      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        whatsappPhoneNumberId: null,
        whatsappAccessToken: null,
        whatsappBusinessAccountId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });'''

content = content.replace(old_mock_null2, new_mock_null2)

# Substituir URLs de example.com por URLs permitidas (usando scontent.whatsapp.net)
content = content.replace('https://example.com/image.jpg', 'https://scontent.whatsapp.net/v/test-image.jpg')
content = content.replace('https://example.com/video.mp4', 'https://scontent.whatsapp.net/v/test-video.mp4')
content = content.replace('https://example.com/audio.ogg', 'https://scontent.whatsapp.net/v/test-audio.ogg')
content = content.replace('https://example.com/file.pdf', 'https://scontent.whatsapp.net/v/test-file.pdf')
content = content.replace('https://example.com/img.jpg', 'https://scontent.whatsapp.net/v/test-img.jpg')

# Salvar o arquivo modificado
with open('src/services/whatsapp.service.v2.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Mocks corrigidos com sucesso!')
