import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '../test/helpers/prisma-mock';
import { WhatsAppService } from './whatsapp.service';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('@/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock env
jest.mock('@/config/env', () => ({
  env: {
    WHATSAPP_API_VERSION: 'v18.0',
  },
}));

describe('WhatsAppService', () => {
  let whatsappService: WhatsAppService;
  let mockAxiosInstance: any;

  const mockTenant = {
    id: 'tenant-123',
    whatsappPhoneNumberId: '123456789',
    whatsappAccessToken: 'test-token-abc123',
  };

  const mockWhatsAppResponse = {
    data: {
      messages: [{ id: 'wamid.HBgNNTUxMTk4MTIzNDU2NxUCABIYFjNBMDhDRjg2' }],
    },
  };

  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    whatsappService = new WhatsAppService();

    // Mock axios.create para retornar uma instância mockada
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };
    (mockedAxios.create as any) = jest.fn().mockReturnValue(mockAxiosInstance);
  });

  describe('sendTextMessage', () => {
    it('deve enviar mensagem de texto com sucesso', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      const result = await whatsappService.sendTextMessage(
        'tenant-123',
        '5511987654321',
        'Olá, teste!'
      );

      // Assert
      expect(result).toEqual({
        whatsappMessageId: 'wamid.HBgNNTUxMTk4MTIzNDU2NxUCABIYFjNBMDhDRjg2',
        success: true,
      });

      expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
        select: { whatsappPhoneNumberId: true },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5511987654321',
          type: 'text',
          text: {
            preview_url: false,
            body: 'Olá, teste!',
          },
        }
      );
    });

    it('deve lançar BadRequestError quando tenant não tem WhatsApp configurado', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        whatsappPhoneNumberId: null,
      } as any);

      // Act & Assert
      await expect(
        whatsappService.sendTextMessage('tenant-123', '5511987654321', 'Teste')
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lançar BadRequestError quando tenant não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        whatsappService.sendTextMessage('tenant-999', '5511987654321', 'Teste')
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lançar InternalServerError quando WhatsApp API retorna erro', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Invalid phone number',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      // Act & Assert
      await expect(
        whatsappService.sendTextMessage('tenant-123', 'invalid', 'Teste')
      ).rejects.toThrow(InternalServerError);
    });

    it('deve lançar InternalServerError com mensagem padrão quando erro da API não tem detalhes', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {},
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      // Act & Assert
      await expect(
        whatsappService.sendTextMessage('tenant-123', '5511987654321', 'Teste')
      ).rejects.toThrow('WhatsApp: WhatsApp API error');
    });

    it('deve relançar erro quando não é AxiosError', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const genericError = new Error('Generic error');
      mockAxiosInstance.post.mockRejectedValue(genericError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(false);

      // Act & Assert
      await expect(
        whatsappService.sendTextMessage('tenant-123', '5511987654321', 'Teste')
      ).rejects.toThrow('Generic error');
    });
  });

  describe('sendMediaMessage', () => {
    it('deve enviar mensagem com imagem com sucesso', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      const result = await whatsappService.sendMediaMessage(
        'tenant-123',
        '5511987654321',
        {
          type: 'image',
          url: 'https://example.com/image.jpg',
          caption: 'Foto de teste',
        }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.whatsappMessageId).toBeDefined();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          messaging_product: 'whatsapp',
          type: 'image',
          image: {
            link: 'https://example.com/image.jpg',
            caption: 'Foto de teste',
          },
        })
      );
    });

    it('deve enviar mensagem com vídeo sem caption', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      const result = await whatsappService.sendMediaMessage(
        'tenant-123',
        '5511987654321',
        {
          type: 'video',
          url: 'https://example.com/video.mp4',
        }
      );

      // Assert
      expect(result.success).toBe(true);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          type: 'video',
          video: {
            link: 'https://example.com/video.mp4',
          },
        })
      );
    });

    it('deve enviar mensagem com áudio', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      const result = await whatsappService.sendMediaMessage(
        'tenant-123',
        '5511987654321',
        {
          type: 'audio',
          url: 'https://example.com/audio.mp3',
        }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          type: 'audio',
          audio: {
            link: 'https://example.com/audio.mp3',
          },
        })
      );
    });

    it('deve enviar mensagem com documento', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      const result = await whatsappService.sendMediaMessage(
        'tenant-123',
        '5511987654321',
        {
          type: 'document',
          url: 'https://example.com/document.pdf',
          caption: 'Relatório PDF',
        }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          type: 'document',
          document: {
            link: 'https://example.com/document.pdf',
            caption: 'Relatório PDF',
          },
        })
      );
    });

    it('deve lançar BadRequestError quando tenant não tem WhatsApp configurado', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        whatsappPhoneNumberId: null,
      } as any);

      // Act & Assert
      await expect(
        whatsappService.sendMediaMessage('tenant-123', '5511987654321', {
          type: 'image',
          url: 'https://example.com/image.jpg',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lançar InternalServerError quando WhatsApp API retorna erro', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Media download failed',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      // Act & Assert
      await expect(
        whatsappService.sendMediaMessage('tenant-123', '5511987654321', {
          type: 'image',
          url: 'https://example.com/image.jpg',
        })
      ).rejects.toThrow('WhatsApp: Media download failed');
    });
  });

  describe('sendTemplate', () => {
    it('deve enviar template sem parâmetros', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      const result = await whatsappService.sendTemplate(
        'tenant-123',
        '5511987654321',
        'hello_world',
        'pt_BR'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        {
          messaging_product: 'whatsapp',
          to: '5511987654321',
          type: 'template',
          template: {
            name: 'hello_world',
            language: {
              code: 'pt_BR',
            },
          },
        }
      );
    });

    it('deve enviar template com parâmetros', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      const result = await whatsappService.sendTemplate(
        'tenant-123',
        '5511987654321',
        'appointment_reminder',
        'pt_BR',
        ['João Silva', '15/11/2025', '14:00']
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          template: {
            name: 'appointment_reminder',
            language: {
              code: 'pt_BR',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'João Silva' },
                  { type: 'text', text: '15/11/2025' },
                  { type: 'text', text: '14:00' },
                ],
              },
            ],
          },
        })
      );
    });

    it('deve usar idioma padrão pt_BR quando não especificado', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      await whatsappService.sendTemplate(
        'tenant-123',
        '5511987654321',
        'hello_world'
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          template: expect.objectContaining({
            language: {
              code: 'pt_BR',
            },
          }),
        })
      );
    });

    it('deve lançar BadRequestError quando tenant não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        whatsappService.sendTemplate('tenant-999', '5511987654321', 'hello_world')
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lançar InternalServerError quando template não existe na API', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Template not found',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      // Act & Assert
      await expect(
        whatsappService.sendTemplate('tenant-123', '5511987654321', 'invalid_template')
      ).rejects.toThrow('WhatsApp: Template not found');
    });
  });

  describe('markAsRead', () => {
    it('deve marcar mensagem como lida com sucesso', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      // Act
      await whatsappService.markAsRead('tenant-123', 'wamid.123456');

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: 'wamid.123456',
        }
      );
    });

    it('deve retornar silenciosamente quando tenant não tem WhatsApp configurado', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        whatsappPhoneNumberId: null,
      } as any);

      // Act & Assert
      await expect(
        whatsappService.markAsRead('tenant-123', 'wamid.123456')
      ).resolves.toBeUndefined();

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('deve retornar silenciosamente quando tenant não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        whatsappService.markAsRead('tenant-999', 'wamid.123456')
      ).resolves.toBeUndefined();

      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('não deve lançar erro quando API falha ao marcar como lida', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      // Act & Assert
      await expect(
        whatsappService.markAsRead('tenant-123', 'wamid.123456')
      ).resolves.toBeUndefined();
    });
  });

  describe('downloadMedia', () => {
    it('deve baixar mídia com sucesso', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { url: 'https://media.example.com/file.jpg' } })
        .mockResolvedValueOnce({ data: Buffer.from('image-data') });

      // Act
      const result = await whatsappService.downloadMedia('tenant-123', 'media-id-123');

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/media-id-123');
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
        2,
        'https://media.example.com/file.jpg',
        { responseType: 'arraybuffer' }
      );
    });

    it('deve lançar InternalServerError quando falha ao buscar URL da mídia', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.get.mockRejectedValue(new Error('Media not found'));

      // Act & Assert
      await expect(
        whatsappService.downloadMedia('tenant-123', 'invalid-media-id')
      ).rejects.toThrow('Failed to download media from WhatsApp');
    });

    it('deve lançar InternalServerError quando falha ao baixar arquivo', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { url: 'https://media.example.com/file.jpg' } })
        .mockRejectedValueOnce(new Error('Download failed'));

      // Act & Assert
      await expect(
        whatsappService.downloadMedia('tenant-123', 'media-id-123')
      ).rejects.toThrow('Failed to download media from WhatsApp');
    });

    it('deve lançar InternalServerError quando tenant não tem WhatsApp configurado', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        whatsappAccessToken: null,
      } as any);

      // Act & Assert
      await expect(
        whatsappService.downloadMedia('tenant-123', 'media-id-123')
      ).rejects.toThrow(InternalServerError);
    });
  });

  describe('validatePhoneNumber', () => {
    it('deve validar número brasileiro válido', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('5511987654321')).toBe(true);
    });

    it('deve validar número americano válido', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('12025551234')).toBe(true);
    });

    it('deve validar número com 11 dígitos', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('12345678901')).toBe(true);
    });

    it('deve validar número com 15 dígitos (máximo)', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('123456789012345')).toBe(true);
    });

    it('deve rejeitar número que começa com 0', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('05511987654321')).toBe(false);
    });

    it('deve rejeitar número muito curto', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('1234567890')).toBe(false);
    });

    it('deve rejeitar número muito longo', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('1234567890123456')).toBe(false);
    });

    it('deve rejeitar número com caracteres especiais', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('+5511987654321')).toBe(false);
    });

    it('deve rejeitar número com espaços', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('55 11 98765 4321')).toBe(false);
    });

    it('deve rejeitar string vazia', () => {
      // Act & Assert
      expect(whatsappService.validatePhoneNumber('')).toBe(false);
    });
  });

  describe('sendInteractiveButtons', () => {
    it('deve enviar mensagem com botões interativos', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const buttons = [
        { id: 'btn-1', title: 'Sim' },
        { id: 'btn-2', title: 'Não' },
      ];

      // Act
      const result = await whatsappService.sendInteractiveButtons(
        'tenant-123',
        '5511987654321',
        'Você confirma a reserva?',
        buttons
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          type: 'interactive',
          interactive: expect.objectContaining({
            type: 'button',
            body: {
              text: 'Você confirma a reserva?',
            },
            action: {
              buttons: [
                { type: 'reply', reply: { id: 'btn-1', title: 'Sim' } },
                { type: 'reply', reply: { id: 'btn-2', title: 'Não' } },
              ],
            },
          }),
        })
      );
    });

    it('deve enviar mensagem com header e footer', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const buttons = [{ id: 'btn-1', title: 'OK' }];

      // Act
      await whatsappService.sendInteractiveButtons(
        'tenant-123',
        '5511987654321',
        'Mensagem principal',
        buttons,
        'Cabeçalho',
        'Rodapé'
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          interactive: expect.objectContaining({
            header: {
              type: 'text',
              text: 'Cabeçalho',
            },
            footer: {
              text: 'Rodapé',
            },
          }),
        })
      );
    });

    it('deve truncar título do botão para 20 caracteres', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const buttons = [
        { id: 'btn-1', title: 'Este é um título muito longo que deve ser truncado' },
      ];

      // Act
      await whatsappService.sendInteractiveButtons(
        'tenant-123',
        '5511987654321',
        'Mensagem',
        buttons
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: 'btn-1',
                    title: 'Este é um título mui',
                  },
                },
              ],
            },
          }),
        })
      );
    });

    it('deve lançar BadRequestError quando mais de 3 botões', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const buttons = [
        { id: 'btn-1', title: 'Botão 1' },
        { id: 'btn-2', title: 'Botão 2' },
        { id: 'btn-3', title: 'Botão 3' },
        { id: 'btn-4', title: 'Botão 4' },
      ];

      // Act & Assert
      await expect(
        whatsappService.sendInteractiveButtons(
          'tenant-123',
          '5511987654321',
          'Escolha uma opção',
          buttons
        )
      ).rejects.toThrow('Máximo de 3 botões permitidos');
    });

    it('deve lançar BadRequestError quando tenant não configurado', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        whatsappService.sendInteractiveButtons(
          'tenant-999',
          '5511987654321',
          'Mensagem',
          [{ id: 'btn-1', title: 'OK' }]
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lançar InternalServerError quando API retorna erro', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Invalid button configuration',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      // Act & Assert
      await expect(
        whatsappService.sendInteractiveButtons(
          'tenant-123',
          '5511987654321',
          'Mensagem',
          [{ id: 'btn-1', title: 'OK' }]
        )
      ).rejects.toThrow('WhatsApp: Invalid button configuration');
    });
  });

  describe('sendInteractiveList', () => {
    it('deve enviar mensagem com lista interativa', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const sections = [
        {
          title: 'Opções',
          rows: [
            { id: 'opt-1', title: 'Opção 1', description: 'Descrição 1' },
            { id: 'opt-2', title: 'Opção 2', description: 'Descrição 2' },
          ],
        },
      ];

      // Act
      const result = await whatsappService.sendInteractiveList(
        'tenant-123',
        '5511987654321',
        'Escolha uma opção',
        'Ver opções',
        sections
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          type: 'interactive',
          interactive: expect.objectContaining({
            type: 'list',
            body: {
              text: 'Escolha uma opção',
            },
            action: expect.objectContaining({
              button: 'Ver opções',
              sections: [
                {
                  title: 'Opções',
                  rows: [
                    { id: 'opt-1', title: 'Opção 1', description: 'Descrição 1' },
                    { id: 'opt-2', title: 'Opção 2', description: 'Descrição 2' },
                  ],
                },
              ],
            }),
          }),
        })
      );
    });

    it('deve enviar lista sem título de seção', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const sections = [
        {
          rows: [
            { id: 'opt-1', title: 'Opção 1' },
            { id: 'opt-2', title: 'Opção 2' },
          ],
        },
      ];

      // Act
      await whatsappService.sendInteractiveList(
        'tenant-123',
        '5511987654321',
        'Escolha',
        'Ver',
        sections
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: expect.objectContaining({
              sections: [
                {
                  rows: expect.any(Array),
                },
              ],
            }),
          }),
        })
      );
    });

    it('deve truncar buttonText para 20 caracteres', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const sections = [
        {
          rows: [{ id: 'opt-1', title: 'Opção 1' }],
        },
      ];

      // Act
      await whatsappService.sendInteractiveList(
        'tenant-123',
        '5511987654321',
        'Escolha',
        'Este é um botão muito longo',
        sections
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: expect.objectContaining({
              button: 'Este é um botão muit',
            }),
          }),
        })
      );
    });

    it('deve truncar título da row para 24 caracteres', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const sections = [
        {
          rows: [
            {
              id: 'opt-1',
              title: 'Este é um título muito longo que deve ser truncado',
            },
          ],
        },
      ];

      // Act
      await whatsappService.sendInteractiveList(
        'tenant-123',
        '5511987654321',
        'Escolha',
        'Ver',
        sections
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: expect.objectContaining({
              sections: [
                {
                  rows: [
                    {
                      id: 'opt-1',
                      title: 'Este é um título muito l',
                    },
                  ],
                },
              ],
            }),
          }),
        })
      );
    });

    it('deve truncar descrição da row para 72 caracteres', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      const sections = [
        {
          rows: [
            {
              id: 'opt-1',
              title: 'Opção 1',
              description: 'Esta é uma descrição muito longa que deve ser truncada porque excede o limite de 72 caracteres permitidos pela API',
            },
          ],
        },
      ];

      // Act
      await whatsappService.sendInteractiveList(
        'tenant-123',
        '5511987654321',
        'Escolha',
        'Ver',
        sections
      );

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/123456789/messages',
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: expect.objectContaining({
              sections: [
                {
                  rows: [
                    {
                      id: 'opt-1',
                      title: 'Opção 1',
                      description: 'Esta é uma descrição muito longa que deve ser truncada porque excede o l',
                    },
                  ],
                },
              ],
            }),
          }),
        })
      );
    });

    it('deve lançar BadRequestError quando tenant não configurado', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        whatsappService.sendInteractiveList(
          'tenant-999',
          '5511987654321',
          'Escolha',
          'Ver',
          [{ rows: [{ id: 'opt-1', title: 'Opção 1' }] }]
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('deve lançar InternalServerError quando API retorna erro', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);

      const axiosError = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Invalid list configuration',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      // Act & Assert
      await expect(
        whatsappService.sendInteractiveList(
          'tenant-123',
          '5511987654321',
          'Escolha',
          'Ver',
          [{ rows: [{ id: 'opt-1', title: 'Opção 1' }] }]
        )
      ).rejects.toThrow('WhatsApp: Invalid list configuration');
    });
  });

  describe('getAxiosForTenant (indireto)', () => {
    it('deve criar axios instance com configuração correta', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue(mockTenant as any);
      mockAxiosInstance.post.mockResolvedValue(mockWhatsAppResponse);

      // Act
      await whatsappService.sendTextMessage('tenant-123', '5511987654321', 'Teste');

      // Assert
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://graph.facebook.com/v18.0',
        headers: {
          'Authorization': 'Bearer test-token-abc123',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    });

    it('deve lançar BadRequestError quando whatsappAccessToken não existe', async () => {
      // Arrange
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-123',
        whatsappPhoneNumberId: '123456789',
        whatsappAccessToken: null,
      } as any);

      // Act & Assert
      await expect(
        whatsappService.sendTextMessage('tenant-123', '5511987654321', 'Teste')
      ).rejects.toThrow('Tenant não tem WhatsApp configurado');
    });
  });
});
