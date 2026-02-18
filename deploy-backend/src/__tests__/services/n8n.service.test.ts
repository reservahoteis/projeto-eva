/**
 * Testes para N8NService
 *
 * TDD: RED → GREEN → REFACTOR
 *
 * N8N Service e responsavel por:
 * 1. Encaminhar mensagens recebidas para webhook do N8N
 * 2. Converter formato interno para formato esperado pelo N8N
 * 3. Validar configuracao do tenant (webhook URL)
 * 4. Garantir timeout adequado (10s)
 *
 * Multi-Tenant: Cada tenant tem seu proprio webhook N8N
 */

import { n8nService } from '@/services/n8n.service';
import type { N8NWebhookPayload } from '@/services/n8n.service';
import { prisma } from '@/config/database';
import axios from 'axios';
import logger from '@/config/logger';

// Mock prisma
jest.mock('@/config/database', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock axios
jest.mock('axios');

// Mock logger
jest.mock('@/config/logger', () => ({
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

// Factory para criar mock de Tenant (apenas campos necessarios para select)
function createMockTenant(overrides: Partial<{
  id: string;
  slug: string;
  n8nWebhookUrl: string | null;
  n8nWebhookUrlMessenger: string | null;
  n8nWebhookUrlInstagram: string | null;
}> = {}) {
  return {
    id: 'tenant-1-uuid',
    slug: 'hotel-test',
    n8nWebhookUrl: 'https://n8n.example.com/webhook/test',
    n8nWebhookUrlMessenger: null,
    n8nWebhookUrlInstagram: null,
    ...overrides,
  } as any; // Cast para any pois e mock
}

describe('N8NService', () => {
  const mockPrismaTenant = prisma.tenant as jest.Mocked<typeof prisma.tenant>;
  const mockAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('forwardToN8N', () => {
    const tenantId = 'tenant-1-uuid';
    const mockPayload: N8NWebhookPayload = {
      phone: '5511999999999',
      type: 'text',
      text: { message: 'Hello from test' },
      messageId: 'msg-1-uuid',
      timestamp: 1704067200,
      contactName: 'Test User',
      conversationId: 'conv-1-uuid',
      isNewConversation: false,
    };

    it('deve encaminhar mensagem para webhook do N8N com sucesso', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          id: tenantId,
          slug: 'hotel-test',
          n8nWebhookUrl: 'https://n8n.example.com/webhook/test',
        })
      );

      mockAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      // Act
      const result = await n8nService.forwardToN8N(tenantId, mockPayload);

      // Assert
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verificar query do tenant
      expect(mockPrismaTenant.findUnique).toHaveBeenCalledWith({
        where: { id: tenantId },
        select: {
          id: true,
          slug: true,
          n8nWebhookUrl: true,
          n8nWebhookUrlMessenger: true,
          n8nWebhookUrlInstagram: true,
        },
      });

      // Verificar chamada axios
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/test',
        { body: mockPayload },
        {
          timeout: 10000, // 10 segundos
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Verificar log de sucesso
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          tenantSlug: 'hotel-test',
          phone: '5511999999999',
          messageId: 'msg-1-uuid',
          n8nStatus: 200,
        }),
        'N8N: Message forwarded successfully'
      );
    });

    it('deve retornar success:false se tenant nao encontrado', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(null);

      // Act
      const result = await n8nService.forwardToN8N(tenantId, mockPayload);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant not found');

      // Nao deve chamar axios
      expect(mockAxios.post).not.toHaveBeenCalled();

      // Verificar log de warning
      expect(logger.warn).toHaveBeenCalledWith(
        { tenantId },
        'N8N: Tenant not found'
      );
    });

    it('deve retornar success:false se webhook URL nao configurado', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          id: tenantId,
          slug: 'hotel-test',
          n8nWebhookUrl: null, // Webhook nao configurado
        })
      );

      // Act
      const result = await n8nService.forwardToN8N(tenantId, mockPayload);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No webhook URL configured');

      // Nao deve chamar axios
      expect(mockAxios.post).not.toHaveBeenCalled();

      // Verificar log de debug
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          tenantSlug: 'hotel-test',
        }),
        'N8N: No webhook URL configured'
      );
    });

    it('deve retornar success:false em caso de erro do axios', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          id: tenantId,
          slug: 'hotel-test',
          n8nWebhookUrl: 'https://n8n.example.com/webhook/test',
        })
      );

      const axiosError = new Error('Network timeout');
      (axiosError as any).response = {
        data: { error: 'Webhook endpoint not responding' },
      };
      mockAxios.post.mockRejectedValue(axiosError);

      // Act
      const result = await n8nService.forwardToN8N(tenantId, mockPayload);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');

      // Verificar log de erro
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          phone: '5511999999999',
          messageId: 'msg-1-uuid',
          error: 'Network timeout',
          response: { error: 'Webhook endpoint not responding' },
        }),
        'N8N: Failed to forward message'
      );
    });

    it('deve usar timeout de 10 segundos', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          id: tenantId,
          slug: 'hotel-test',
          n8nWebhookUrl: 'https://n8n.example.com/webhook/test',
        })
      );

      mockAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      // Act
      await n8nService.forwardToN8N(tenantId, mockPayload);

      // Assert - Verificar timeout
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });

    it('deve incluir tenantId na busca do webhook URL', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          id: tenantId,
          slug: 'hotel-test',
          n8nWebhookUrl: 'https://n8n.example.com/webhook/test',
        })
      );

      mockAxios.post.mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      // Act
      await n8nService.forwardToN8N(tenantId, mockPayload);

      // Assert - Query DEVE incluir tenantId no where
      expect(mockPrismaTenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tenantId },
          select: expect.objectContaining({
            n8nWebhookUrl: true,
            n8nWebhookUrlMessenger: true,
            n8nWebhookUrlInstagram: true,
          }),
        })
      );
    });

    // === Roteamento por Canal ===

    it('deve rotear para n8nWebhookUrlMessenger quando channel=messenger e URL configurada', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          n8nWebhookUrl: 'https://n8n.example.com/webhook/whatsapp',
          n8nWebhookUrlMessenger: 'https://n8n.example.com/webhook/messenger',
        })
      );
      mockAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const messengerPayload: N8NWebhookPayload = {
        ...mockPayload,
        channel: 'messenger',
      };

      // Act
      const result = await n8nService.forwardToN8N(tenantId, messengerPayload);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/messenger',
        { body: messengerPayload },
        expect.any(Object)
      );
    });

    it('deve rotear para n8nWebhookUrlInstagram quando channel=instagram e URL configurada', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          n8nWebhookUrl: 'https://n8n.example.com/webhook/whatsapp',
          n8nWebhookUrlInstagram: 'https://n8n.example.com/webhook/instagram',
        })
      );
      mockAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const instagramPayload: N8NWebhookPayload = {
        ...mockPayload,
        channel: 'instagram',
      };

      // Act
      const result = await n8nService.forwardToN8N(tenantId, instagramPayload);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/instagram',
        { body: instagramPayload },
        expect.any(Object)
      );
    });

    it('deve fazer fallback para n8nWebhookUrl quando channel=messenger mas URL messenger nao configurada', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          n8nWebhookUrl: 'https://n8n.example.com/webhook/default',
          n8nWebhookUrlMessenger: null,
        })
      );
      mockAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const messengerPayload: N8NWebhookPayload = {
        ...mockPayload,
        channel: 'messenger',
      };

      // Act
      const result = await n8nService.forwardToN8N(tenantId, messengerPayload);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/default',
        { body: messengerPayload },
        expect.any(Object)
      );
    });

    it('deve fazer fallback para n8nWebhookUrl quando channel=instagram mas URL instagram nao configurada', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          n8nWebhookUrl: 'https://n8n.example.com/webhook/default',
          n8nWebhookUrlInstagram: null,
        })
      );
      mockAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const instagramPayload: N8NWebhookPayload = {
        ...mockPayload,
        channel: 'instagram',
      };

      // Act
      const result = await n8nService.forwardToN8N(tenantId, instagramPayload);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/default',
        { body: instagramPayload },
        expect.any(Object)
      );
    });

    it('deve usar n8nWebhookUrl para channel=whatsapp (comportamento padrao)', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          n8nWebhookUrl: 'https://n8n.example.com/webhook/whatsapp',
          n8nWebhookUrlMessenger: 'https://n8n.example.com/webhook/messenger',
          n8nWebhookUrlInstagram: 'https://n8n.example.com/webhook/instagram',
        })
      );
      mockAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const whatsappPayload: N8NWebhookPayload = {
        ...mockPayload,
        channel: 'whatsapp',
      };

      // Act
      const result = await n8nService.forwardToN8N(tenantId, whatsappPayload);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/whatsapp',
        { body: whatsappPayload },
        expect.any(Object)
      );
    });

    it('deve usar n8nWebhookUrl quando channel nao informado (undefined)', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          n8nWebhookUrl: 'https://n8n.example.com/webhook/default',
        })
      );
      mockAxios.post.mockResolvedValue({ status: 200, data: { success: true } });

      const noChannelPayload: N8NWebhookPayload = {
        ...mockPayload,
        channel: undefined,
      };

      // Act
      const result = await n8nService.forwardToN8N(tenantId, noChannelPayload);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/default',
        { body: noChannelPayload },
        expect.any(Object)
      );
    });

    it('deve retornar error quando nenhuma URL esta configurada para nenhum canal', async () => {
      // Arrange
      mockPrismaTenant.findUnique.mockResolvedValue(
        createMockTenant({
          n8nWebhookUrl: null,
          n8nWebhookUrlMessenger: null,
          n8nWebhookUrlInstagram: null,
        })
      );

      const messengerPayload: N8NWebhookPayload = {
        ...mockPayload,
        channel: 'messenger',
      };

      // Act
      const result = await n8nService.forwardToN8N(tenantId, messengerPayload);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No webhook URL configured');
      expect(mockAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('buildPayload', () => {
    const phoneNumber = '5511999999999';
    const conversationId = 'conv-1-uuid';
    const contactName = 'Test User';
    const isNewConversation = false;

    it('deve construir payload TEXT corretamente', () => {
      // Arrange
      const message = {
        id: 'msg-1-uuid',
        type: 'TEXT',
        content: 'Hello World',
        metadata: {},
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload).toEqual({
        phone: phoneNumber,
        type: 'text',
        text: { message: 'Hello World' },
        messageId: 'msg-1-uuid',
        timestamp: 1704110400, // Unix timestamp
        contactName: 'Test User',
        conversationId,
        isNewConversation: false,
        channel: 'whatsapp',
      });
    });

    it('deve construir payload IMAGE com metadata', () => {
      // Arrange
      const message = {
        id: 'msg-2-uuid',
        type: 'IMAGE',
        content: '',
        metadata: {
          mediaUrl: 'https://example.com/image.jpg',
          caption: 'Beautiful view',
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('image');
      expect(payload.image).toEqual({
        url: 'https://example.com/image.jpg',
        caption: 'Beautiful view',
      });
    });

    it('deve construir payload VIDEO', () => {
      // Arrange
      const message = {
        id: 'msg-3-uuid',
        type: 'VIDEO',
        content: '',
        metadata: {
          mediaUrl: 'https://example.com/video.mp4',
          caption: 'Check this out',
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('video');
      expect(payload.video).toEqual({
        url: 'https://example.com/video.mp4',
        caption: 'Check this out',
      });
    });

    it('deve construir payload AUDIO', () => {
      // Arrange
      const message = {
        id: 'msg-4-uuid',
        type: 'AUDIO',
        content: '',
        metadata: {
          mediaUrl: 'https://example.com/audio.ogg',
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('audio');
      expect(payload.audio).toEqual({
        url: 'https://example.com/audio.ogg',
      });
    });

    it('deve construir payload DOCUMENT com filename', () => {
      // Arrange
      const message = {
        id: 'msg-5-uuid',
        type: 'DOCUMENT',
        content: '',
        metadata: {
          mediaUrl: 'https://example.com/document.pdf',
          filename: 'invoice.pdf',
          caption: 'Your invoice',
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('document');
      expect(payload.document).toEqual({
        url: 'https://example.com/document.pdf',
        filename: 'invoice.pdf',
        caption: 'Your invoice',
      });
    });

    it('deve construir payload LOCATION com coordenadas', () => {
      // Arrange
      const message = {
        id: 'msg-6-uuid',
        type: 'LOCATION',
        content: JSON.stringify({
          latitude: -23.5505,
          longitude: -46.6333,
        }),
        metadata: {
          name: 'Avenida Paulista',
          address: 'Sao Paulo, SP',
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('location');
      expect(payload.location).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        name: 'Avenida Paulista',
        address: 'Sao Paulo, SP',
      });
    });

    it('deve construir payload button_reply para carousel quick reply', () => {
      // Arrange
      const message = {
        id: 'msg-7-uuid',
        type: 'TEXT',
        content: 'Option 1',
        metadata: {
          button: {
            id: 'btn-1',
            title: 'Option 1',
          },
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('button_reply');
      expect(payload.buttonReply).toEqual({
        id: 'btn-1',
        title: 'Option 1',
      });
      // Manter compatibilidade com formato antigo
      expect(payload.buttonResponseMessage).toEqual({
        selectedButtonId: 'btn-1',
        selectedButtonText: 'Option 1',
      });
    });

    it('deve construir payload list response', () => {
      // Arrange
      const message = {
        id: 'msg-8-uuid',
        type: 'TEXT',
        content: 'Standard Room',
        metadata: {
          list: {
            id: 'list-1',
            title: 'Standard Room',
            description: 'Double bed, 20m2',
          },
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('list');
      expect(payload.listResponseMessage).toEqual({
        selectedRowId: 'list-1',
        title: 'Standard Room',
        description: 'Double bed, 20m2',
      });
    });

    it('deve tratar sticker (isSticker metadata)', () => {
      // Arrange
      const message = {
        id: 'msg-9-uuid',
        type: 'IMAGE',
        content: '',
        metadata: {
          isSticker: true,
          mediaUrl: 'https://example.com/sticker.webp',
        },
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('sticker');
      expect(payload.image).toEqual({
        url: 'https://example.com/sticker.webp',
        caption: undefined,
      });
    });

    it('deve fazer fallback para text em caso de tipo desconhecido', () => {
      // Arrange
      const message = {
        id: 'msg-10-uuid',
        type: 'UNKNOWN_TYPE',
        content: 'Fallback content',
        metadata: {},
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('text');
      expect(payload.text).toEqual({
        message: 'Fallback content',
      });
    });

    it('deve fazer fallback para text se JSON de location for invalido', () => {
      // Arrange
      const message = {
        id: 'msg-11-uuid',
        type: 'LOCATION',
        content: 'invalid-json-{', // JSON invalido
        metadata: {},
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.type).toBe('text');
      expect(payload.text).toEqual({
        message: 'invalid-json-{',
      });
    });

    it('deve incluir contactName e conversationId sempre', () => {
      // Arrange
      const message = {
        id: 'msg-12-uuid',
        type: 'TEXT',
        content: 'Test message',
        metadata: {},
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.contactName).toBe('Test User');
      expect(payload.conversationId).toBe(conversationId);
      expect(payload.isNewConversation).toBe(false);
    });

    it('deve omitir contactName se for null', () => {
      // Arrange
      const message = {
        id: 'msg-13-uuid',
        type: 'TEXT',
        content: 'Test message',
        metadata: {},
        timestamp: new Date('2024-01-01T12:00:00Z'),
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        null, // contactName null
        isNewConversation
      );

      // Assert
      expect(payload.contactName).toBeUndefined();
    });

    it('deve converter timestamp para Unix timestamp (segundos)', () => {
      // Arrange
      const message = {
        id: 'msg-14-uuid',
        type: 'TEXT',
        content: 'Test message',
        metadata: {},
        timestamp: new Date('2024-01-01T12:00:00Z'), // 1704110400000 ms
      };

      // Act
      const payload = n8nService.buildPayload(
        phoneNumber,
        message,
        conversationId,
        contactName,
        isNewConversation
      );

      // Assert
      expect(payload.timestamp).toBe(1704110400); // Segundos, nao milisegundos
    });
  });
});
