/// <reference types="node" />
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
// Import prisma mock FIRST to ensure jest.mock is hoisted before service import
import { prismaMock, resetPrismaMock } from '../test/helpers/prisma-mock';
import { WhatsAppServiceV2 } from './whatsapp.service.v2';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock encryption - retorna o próprio valor para testes
jest.mock('@/utils/encryption', () => ({
  decrypt: (text: string) => text,
  encrypt: (text: string) => `encrypted:${text}`,
}));

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

// Mock URL validator
jest.mock('@/utils/url-validator', () => ({
  validateMediaUrl: jest.fn(),
}));

describe('WhatsAppServiceV2', () => {
  let service: WhatsAppServiceV2;
  let mockAxiosInstance: {
    post: jest.Mock;
    get: jest.Mock;
    interceptors: { response: { use: jest.Mock } };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetPrismaMock();

    // Mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

    service = new WhatsAppServiceV2();
  });

  describe('validatePhoneNumber', () => {
    describe('✅ Números válidos - Brasil', () => {
      it('deve aceitar número brasileiro com 9 dígitos (5511999999999)', () => {
        expect(service.validatePhoneNumber('5511999999999')).toBe(true);
      });

      it('deve aceitar número brasileiro com 8 dígitos (5511988889999)', () => {
        expect(service.validatePhoneNumber('5511988889999')).toBe(true);
      });

      it('deve aceitar número brasileiro com formatação', () => {
        expect(service.validatePhoneNumber('+55 (11) 99999-9999')).toBe(true);
      });

      it('deve aceitar número brasileiro de outro estado', () => {
        expect(service.validatePhoneNumber('5521987654321')).toBe(true); // Rio de Janeiro
        expect(service.validatePhoneNumber('5585988776655')).toBe(true); // Fortaleza
      });
    });

    describe('✅ Números válidos - América do Norte', () => {
      it('deve aceitar número dos EUA (11 dígitos)', () => {
        expect(service.validatePhoneNumber('12025551234')).toBe(true);
      });

      it('deve aceitar número do Canadá (11 dígitos)', () => {
        expect(service.validatePhoneNumber('14165551234')).toBe(true); // Toronto
      });

      it('deve aceitar número do México (12 dígitos)', () => {
        expect(service.validatePhoneNumber('521234567890')).toBe(true);
      });

      it('deve aceitar número com formatação americana', () => {
        expect(service.validatePhoneNumber('+1 (202) 555-1234')).toBe(true);
      });
    });

    describe('✅ Números válidos - Europa', () => {
      it('deve aceitar número da Alemanha (13 dígitos)', () => {
        expect(service.validatePhoneNumber('4915123456789')).toBe(true);
      });

      it('deve aceitar número do Reino Unido (12 dígitos)', () => {
        expect(service.validatePhoneNumber('442071234567')).toBe(true);
      });

      it('deve aceitar número da França (11 dígitos)', () => {
        expect(service.validatePhoneNumber('33612345678')).toBe(true);
      });

      it('deve aceitar número da Espanha (11 dígitos)', () => {
        expect(service.validatePhoneNumber('34612345678')).toBe(true);
      });

      it('deve aceitar número da Itália (11-13 dígitos)', () => {
        expect(service.validatePhoneNumber('393123456789')).toBe(true);
      });

      it('deve aceitar número de Portugal (12 dígitos)', () => {
        expect(service.validatePhoneNumber('351912345678')).toBe(true);
      });
    });

    describe('✅ Números válidos - Ásia', () => {
      it('deve aceitar número da Índia (12 dígitos)', () => {
        expect(service.validatePhoneNumber('919876543210')).toBe(true);
      });

      it('deve aceitar número da China (13 dígitos)', () => {
        expect(service.validatePhoneNumber('8613812345678')).toBe(true);
      });

      it('deve aceitar número do Japão (12 dígitos)', () => {
        expect(service.validatePhoneNumber('819012345678')).toBe(true);
      });

      it('deve aceitar número de Cingapura (10 dígitos)', () => {
        expect(service.validatePhoneNumber('6591234567')).toBe(true);
      });

      it('deve aceitar número da Coreia do Sul (12 dígitos)', () => {
        expect(service.validatePhoneNumber('821012345678')).toBe(true);
      });
    });

    describe('✅ Números válidos - América Latina', () => {
      it('deve aceitar número da Argentina (12 dígitos)', () => {
        expect(service.validatePhoneNumber('5491123456789')).toBe(true);
      });

      it('deve aceitar número do Chile (11 dígitos)', () => {
        expect(service.validatePhoneNumber('56912345678')).toBe(true);
      });

      it('deve aceitar número da Colômbia (12 dígitos)', () => {
        expect(service.validatePhoneNumber('573123456789')).toBe(true);
      });
    });

    describe('✅ Números válidos - Outros', () => {
      it('deve aceitar número da Austrália (11 dígitos)', () => {
        expect(service.validatePhoneNumber('61412345678')).toBe(true);
      });

      it('deve aceitar número da África do Sul (11 dígitos)', () => {
        expect(service.validatePhoneNumber('27821234567')).toBe(true);
      });

      it('deve aceitar número com máximo de 15 dígitos (E.164)', () => {
        expect(service.validatePhoneNumber('123456789012345')).toBe(true);
      });

      it('deve aceitar número com 8 dígitos (mínimo razoável)', () => {
        expect(service.validatePhoneNumber('12345678')).toBe(true);
      });
    });

    describe('❌ Números inválidos', () => {
      it('deve rejeitar número muito curto (menos de 8 dígitos)', () => {
        expect(service.validatePhoneNumber('1234567')).toBe(false); // 7 dígitos
        expect(service.validatePhoneNumber('123456')).toBe(false);  // 6 dígitos
      });

      it('deve rejeitar número muito longo (mais de 15 dígitos)', () => {
        expect(service.validatePhoneNumber('12345678901234567')).toBe(false); // 17 dígitos
        expect(service.validatePhoneNumber('1234567890123456')).toBe(false);  // 16 dígitos
      });

      it('deve rejeitar número começando com 0', () => {
        expect(service.validatePhoneNumber('05511999999999')).toBe(false);
        expect(service.validatePhoneNumber('0123456789')).toBe(false);
      });

      it('deve rejeitar string vazia', () => {
        expect(service.validatePhoneNumber('')).toBe(false);
      });

      it('deve rejeitar null/undefined', () => {
        expect(service.validatePhoneNumber(null as any)).toBe(false);
        expect(service.validatePhoneNumber(undefined as any)).toBe(false);
      });

      it('deve rejeitar número com letras', () => {
        expect(service.validatePhoneNumber('5511abc999999')).toBe(false);
        expect(service.validatePhoneNumber('abc1234567890')).toBe(false);
      });

      it('deve rejeitar apenas caracteres especiais', () => {
        expect(service.validatePhoneNumber('+++++++++')).toBe(false);
        expect(service.validatePhoneNumber('--------')).toBe(false);
      });

      it('deve rejeitar espaços em branco', () => {
        expect(service.validatePhoneNumber('   ')).toBe(false);
      });
    });
  });

  describe('formatPhoneNumber', () => {
    it('deve remover espaços', () => {
      const input = '55 11 99999 9999';
      const expected = '5511999999999';
      expect(service.formatPhoneNumber(input)).toBe(expected);
    });

    it('deve remover hífens', () => {
      const input = '55-11-99999-9999';
      const expected = '5511999999999';
      expect(service.formatPhoneNumber(input)).toBe(expected);
    });

    it('deve remover parênteses', () => {
      const input = '55 (11) 99999-9999';
      const expected = '5511999999999';
      expect(service.formatPhoneNumber(input)).toBe(expected);
    });

    it('deve remover o símbolo +', () => {
      const input = '+5511999999999';
      const expected = '5511999999999';
      expect(service.formatPhoneNumber(input)).toBe(expected);
    });

    it('deve manter número já formatado (apenas dígitos)', () => {
      const input = '5511999999999';
      expect(service.formatPhoneNumber(input)).toBe(input);
    });

    it('deve remover múltiplos tipos de formatação', () => {
      const input = '+55 (11) 9999-9999';
      const expected = '551199999999';
      expect(service.formatPhoneNumber(input)).toBe(expected);
    });

    it('deve formatar números internacionais corretamente', () => {
      expect(service.formatPhoneNumber('+1 (202) 555-1234')).toBe('12025551234');
      expect(service.formatPhoneNumber('+44 20 7123 4567')).toBe('442071234567');
      expect(service.formatPhoneNumber('+49 151 2345 6789')).toBe('4915123456789');
    });
  });

  describe('clearCache', () => {
    it('deve limpar cache de Axios instances', () => {
      // Chama método que usa cache internamente
      service.clearCache();

      // Verifica que não lança erro
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  // ============================================
  // NOVOS TESTES PARA ATINGIR 85%+ COVERAGE
  // ============================================

  describe('sendTextMessage', () => {
    const mockTenantId = 'tenant-123';
    const mockPhoneNumberId = 'phone-id-123';
    const mockAccessToken = 'token-123';

    beforeEach(() => {
      // Mock Prisma para retornar tenant válido
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);
    });

    it('deve enviar mensagem de texto simples com sucesso', async () => {
      // @ts-ignore
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          messages: [{ id: 'wamid.123' }],
        },
      });

      const mockAxiosInstance = {
        post: mockPost,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      const result = await service.sendTextMessage(
        mockTenantId,
        '5511999999999',
        'Olá, tudo bem?'
      );

      expect(result).toEqual({
        whatsappMessageId: 'wamid.123',
        success: true,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/${mockPhoneNumberId}/messages`,
        expect.objectContaining({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: '5511999999999',
          type: 'text',
          text: {
            preview_url: false,
            body: 'Olá, tudo bem?',
          },
        })
      );
    });

    it('deve enviar mensagem com preview_url habilitado', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.456' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendTextMessage(
        mockTenantId,
        '5511999999999',
        'Confira: https://example.com',
        { previewUrl: true }
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          text: {
            preview_url: true,
            body: 'Confira: https://example.com',
          },
        })
      );
    });

    it('deve formatar número de telefone antes de enviar', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.789' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendTextMessage(
        mockTenantId,
        '+55 (11) 99999-9999',
        'Teste'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          to: '5511999999999', // Formatado
        })
      );
    });

    it('deve lançar BadRequestError se número for inválido', async () => {
      await expect(
        service.sendTextMessage(mockTenantId, '123', 'Teste')
      ).rejects.toThrow('Número inválido: 123');
    });

    it('deve lançar BadRequestError se texto for vazio', async () => {
      await expect(
        service.sendTextMessage(mockTenantId, '5511999999999', '')
      ).rejects.toThrow('Texto da mensagem não pode ser vazio');
    });

    it('deve lançar BadRequestError se texto for apenas espaços', async () => {
      await expect(
        service.sendTextMessage(mockTenantId, '5511999999999', '   ')
      ).rejects.toThrow('Texto da mensagem não pode ser vazio');
    });

    it('deve lançar BadRequestError se texto exceder 4096 caracteres', async () => {
      const longText = 'a'.repeat(4097);

      await expect(
        service.sendTextMessage(mockTenantId, '5511999999999', longText)
      ).rejects.toThrow('Texto excede limite de 4096 caracteres');
    });

    it('deve lançar BadRequestError se tenant não tem WhatsApp configurado', async () => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: null,
        whatsappAccessToken: null,
      } as never);

      await expect(
        service.sendTextMessage(mockTenantId, '5511999999999', 'Teste')
      ).rejects.toThrow('WhatsApp não configurado');
    });

    it('deve lançar InternalServerError se WhatsApp não retornar message ID', async () => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);

      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [], // Sem ID
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await expect(
        service.sendTextMessage(mockTenantId, '5511999999999', 'Teste')
      ).rejects.toThrow('Falha ao enviar mensagem de texto');
    });

    it('deve cachear instância do axios para o mesmo tenant', async () => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);

      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.cache' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      // Primeira chamada
      await service.sendTextMessage(mockTenantId, '5511999999999', 'Msg 1');
      expect(axios.create).toHaveBeenCalledTimes(1);

      // Segunda chamada (deve usar cache)
      await service.sendTextMessage(mockTenantId, '5511999999999', 'Msg 2');
      expect(axios.create).toHaveBeenCalledTimes(1); // Não cria nova instância
    });
  });

  describe('sendMediaMessage', () => {
    const mockTenantId = 'tenant-123';
    const mockPhoneNumberId = 'phone-id-123';
    const mockAccessToken = 'token-123';

    beforeEach(() => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);
    });

    it('deve enviar imagem sem caption', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.img1' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      const result = await service.sendMediaMessage(mockTenantId, '5511999999999', {
        type: 'image',
        url: 'https://example.com/image.jpg',
      });

      expect(result).toEqual({
        whatsappMessageId: 'wamid.img1',
        success: true,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/${mockPhoneNumberId}/messages`,
        expect.objectContaining({
          type: 'image',
          image: {
            link: 'https://example.com/image.jpg',
          },
        })
      );
    });

    it('deve enviar imagem com caption', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.img2' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendMediaMessage(mockTenantId, '5511999999999', {
        type: 'image',
        url: 'https://example.com/image.jpg',
        caption: 'Veja esta foto!',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          image: {
            link: 'https://example.com/image.jpg',
            caption: 'Veja esta foto!',
          },
        })
      );
    });

    it('deve enviar vídeo', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.vid1' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendMediaMessage(mockTenantId, '5511999999999', {
        type: 'video',
        url: 'https://example.com/video.mp4',
        caption: 'Assista!',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'video',
          video: {
            link: 'https://example.com/video.mp4',
            caption: 'Assista!',
          },
        })
      );
    });

    it('deve enviar áudio (PTT)', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.aud1' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendMediaMessage(mockTenantId, '5511999999999', {
        type: 'audio',
        url: 'https://example.com/audio.ogg',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'audio',
          audio: {
            link: 'https://example.com/audio.ogg',
          },
        })
      );
    });

    it('deve enviar documento com filename', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.doc1' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendMediaMessage(mockTenantId, '5511999999999', {
        type: 'document',
        url: 'https://example.com/file.pdf',
        filename: 'contrato.pdf',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'document',
          document: {
            link: 'https://example.com/file.pdf',
            filename: 'contrato.pdf',
          },
        })
      );
    });

    it('deve lançar BadRequestError se número for inválido', async () => {
      await expect(
        service.sendMediaMessage(mockTenantId, '123', {
          type: 'image',
          url: 'https://example.com/img.jpg',
        })
      ).rejects.toThrow('Número inválido: 123');
    });

    it('deve lançar BadRequestError se caption exceder 1024 caracteres', async () => {
      const longCaption = 'a'.repeat(1025);

      await expect(
        service.sendMediaMessage(mockTenantId, '5511999999999', {
          type: 'image',
          url: 'https://example.com/img.jpg',
          caption: longCaption,
        })
      ).rejects.toThrow('Caption excede limite de 1024 caracteres');
    });

    it('deve lançar BadRequestError se tenant não configurado', async () => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: null,
      } as never);

      await expect(
        service.sendMediaMessage(mockTenantId, '5511999999999', {
          type: 'image',
          url: 'https://example.com/img.jpg',
        })
      ).rejects.toThrow('WhatsApp não configurado');
    });
  });

  describe('sendTemplate', () => {
    const mockTenantId = 'tenant-123';
    const mockPhoneNumberId = 'phone-id-123';
    const mockAccessToken = 'token-123';

    beforeEach(() => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);
    });

    it('deve enviar template simples sem parâmetros', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.tpl1' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      const result = await service.sendTemplate(
        mockTenantId,
        '5511999999999',
        'hello_world',
        'pt_BR'
      );

      expect(result).toEqual({
        whatsappMessageId: 'wamid.tpl1',
        success: true,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/${mockPhoneNumberId}/messages`,
        expect.objectContaining({
          type: 'template',
          template: {
            name: 'hello_world',
            language: {
              code: 'pt_BR',
            },
          },
        })
      );
    });

    it('deve enviar template com parâmetros', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.tpl2' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendTemplate(
        mockTenantId,
        '5511999999999',
        'welcome_user',
        'pt_BR',
        ['João', 'Hotel XYZ']
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          template: {
            name: 'welcome_user',
            language: {
              code: 'pt_BR',
            },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'João' },
                  { type: 'text', text: 'Hotel XYZ' },
                ],
              },
            ],
          },
        })
      );
    });

    it('deve usar linguageCode padrão pt_BR se não especificado', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.tpl3' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendTemplate(mockTenantId, '5511999999999', 'test_template');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          template: expect.objectContaining({
            language: {
              code: 'pt_BR',
            },
          }),
        })
      );
    });

    it('deve lançar BadRequestError se número inválido', async () => {
      await expect(
        service.sendTemplate(mockTenantId, '123', 'template_name')
      ).rejects.toThrow('Número inválido: 123');
    });

    it('deve lançar BadRequestError se tenant não configurado', async () => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: null,
      } as never);

      await expect(
        service.sendTemplate(mockTenantId, '5511999999999', 'template')
      ).rejects.toThrow('WhatsApp não configurado');
    });
  });

  describe('sendInteractiveButtons', () => {
    const mockTenantId = 'tenant-123';
    const mockPhoneNumberId = 'phone-id-123';
    const mockAccessToken = 'token-123';

    beforeEach(() => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);
    });

    it('deve enviar botões (1 botão)', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.btn1' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      const result = await service.sendInteractiveButtons(
        mockTenantId,
        '5511999999999',
        'Escolha uma opção:',
        [{ id: '1', title: 'Sim' }]
      );

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: 'Escolha uma opção:',
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: '1',
                    title: 'Sim',
                  },
                },
              ],
            },
          },
        })
      );
    });

    it('deve enviar botões (3 botões - máximo)', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.btn3' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendInteractiveButtons(
        mockTenantId,
        '5511999999999',
        'Escolha:',
        [
          { id: '1', title: 'Opção 1' },
          { id: '2', title: 'Opção 2' },
          { id: '3', title: 'Opção 3' },
        ]
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: {
              buttons: expect.arrayContaining([
                expect.objectContaining({ reply: { id: '1', title: 'Opção 1' } }),
                expect.objectContaining({ reply: { id: '2', title: 'Opção 2' } }),
                expect.objectContaining({ reply: { id: '3', title: 'Opção 3' } }),
              ]),
            },
          }),
        })
      );
    });

    it('deve incluir header e footer se fornecidos', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.btn4' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendInteractiveButtons(
        mockTenantId,
        '5511999999999',
        'Body text',
        [{ id: '1', title: 'OK' }],
        'Header Text',
        'Footer Text'
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          interactive: expect.objectContaining({
            header: {
              type: 'text',
              text: 'Header Text',
            },
            footer: {
              text: 'Footer Text',
            },
          }),
        })
      );
    });

    it('deve lançar BadRequestError se título do botão exceder 20 caracteres', async () => {
      await expect(
        service.sendInteractiveButtons(
          mockTenantId,
          '5511999999999',
          'Choose:',
          [{ id: '1', title: 'Este título tem mais de 20 caracteres' }]
        )
      ).rejects.toThrow('Botão 1: título excede 20 caracteres');
    });

    it('deve lançar BadRequestError se não houver botões', async () => {
      await expect(
        service.sendInteractiveButtons(mockTenantId, '5511999999999', 'Text', [])
      ).rejects.toThrow('Número de botões deve ser entre 1 e 3');
    });

    it('deve lançar BadRequestError se houver mais de 3 botões', async () => {
      await expect(
        service.sendInteractiveButtons(mockTenantId, '5511999999999', 'Text', [
          { id: '1', title: 'A' },
          { id: '2', title: 'B' },
          { id: '3', title: 'C' },
          { id: '4', title: 'D' },
        ])
      ).rejects.toThrow('Número de botões deve ser entre 1 e 3');
    });

    it('deve lançar BadRequestError se body text exceder 1024 caracteres', async () => {
      const longText = 'a'.repeat(1025);

      await expect(
        service.sendInteractiveButtons(mockTenantId, '5511999999999', longText, [
          { id: '1', title: 'OK' },
        ])
      ).rejects.toThrow('Body text excede 1024 caracteres');
    });
  });

  describe('sendInteractiveList', () => {
    const mockTenantId = 'tenant-123';
    const mockPhoneNumberId = 'phone-id-123';
    const mockAccessToken = 'token-123';

    beforeEach(() => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);
    });

    it('deve enviar lista com uma seção', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.list1' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      const result = await service.sendInteractiveList(
        mockTenantId,
        '5511999999999',
        'Escolha um item:',
        'Ver opções',
        [
          {
            title: 'Opções',
            rows: [
              { id: '1', title: 'Item 1', description: 'Descrição 1' },
              { id: '2', title: 'Item 2', description: 'Descrição 2' },
            ],
          },
        ]
      );

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'interactive',
          interactive: {
            type: 'list',
            body: {
              text: 'Escolha um item:',
            },
            action: {
              button: 'Ver opções',
              sections: [
                {
                  title: 'Opções',
                  rows: [
                    { id: '1', title: 'Item 1', description: 'Descrição 1' },
                    { id: '2', title: 'Item 2', description: 'Descrição 2' },
                  ],
                },
              ],
            },
          },
        })
      );
    });

    it('deve enviar lista com múltiplas seções', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.list2' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendInteractiveList(
        mockTenantId,
        '5511999999999',
        'Escolha:',
        'Menu',
        [
          {
            title: 'Seção 1',
            rows: [{ id: '1', title: 'Item 1' }],
          },
          {
            title: 'Seção 2',
            rows: [{ id: '2', title: 'Item 2' }],
          },
        ]
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: expect.objectContaining({
              sections: expect.arrayContaining([
                expect.objectContaining({ title: 'Seção 1' }),
                expect.objectContaining({ title: 'Seção 2' }),
              ]),
            }),
          }),
        })
      );
    });

    it('deve truncar textos longos (title 24 chars, description 72 chars)', async () => {
      const mockAxiosInstance = {
        // @ts-ignore
        post: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: 'wamid.list3' }],
          },
        }) as any,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.sendInteractiveList(
        mockTenantId,
        '5511999999999',
        'Body',
        'Button',
        [
          {
            title: 'Este título de seção tem mais de 24 caracteres',
            rows: [
              {
                id: '1',
                title: 'Este título de row tem mais de 24 caracteres também',
                description: 'Esta descrição tem mais de 72 caracteres e precisa ser truncada para caber no limite do WhatsApp',
              },
            ],
          },
        ]
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          interactive: expect.objectContaining({
            action: expect.objectContaining({
              sections: [
                {
                  title: 'Este título de seção tem', // 24 chars
                  rows: [
                    {
                      id: '1',
                      title: 'Este título de row tem m', // 24 chars
                      description: 'Esta descrição tem mais de 72 caracteres e precisa ser truncada para cab', // 72 chars
                    },
                  ],
                },
              ],
            }),
          }),
        })
      );
    });

    it('deve lançar BadRequestError se não houver seções', async () => {
      await expect(
        service.sendInteractiveList(mockTenantId, '5511999999999', 'Text', 'Button', [])
      ).rejects.toThrow('Número de seções deve ser entre 1 e 10');
    });

    it('deve lançar BadRequestError se houver mais de 10 seções', async () => {
      const sections = Array.from({ length: 11 }, (_, i) => ({
        rows: [{ id: String(i), title: `Item ${i}` }],
      }));

      await expect(
        service.sendInteractiveList(mockTenantId, '5511999999999', 'Text', 'Button', sections)
      ).rejects.toThrow('Número de seções deve ser entre 1 e 10');
    });

    it('deve lançar BadRequestError se total de rows exceder 10', async () => {
      await expect(
        service.sendInteractiveList(mockTenantId, '5511999999999', 'Text', 'Button', [
          {
            rows: Array.from({ length: 11 }, (_, i) => ({
              id: String(i),
              title: `Item ${i}`,
            })),
          },
        ])
      ).rejects.toThrow('Total de opções não pode exceder 10');
    });

    it('deve lançar BadRequestError se body text exceder 1024 caracteres', async () => {
      const longText = 'a'.repeat(1025);

      await expect(
        service.sendInteractiveList(mockTenantId, '5511999999999', longText, 'Button', [
          { rows: [{ id: '1', title: 'Item' }] },
        ])
      ).rejects.toThrow('Body text excede 1024 caracteres');
    });

    it('deve lançar BadRequestError se button text exceder 20 caracteres', async () => {
      await expect(
        service.sendInteractiveList(
          mockTenantId,
          '5511999999999',
          'Body',
          'Este botão tem mais de 20 caracteres',
          [{ rows: [{ id: '1', title: 'Item' }] }]
        )
      ).rejects.toThrow('Button text excede 20 caracteres');
    });
  });

  describe('markAsRead', () => {
    const mockTenantId = 'tenant-123';
    const mockPhoneNumberId = 'phone-id-123';
    const mockAccessToken = 'token-123';

    beforeEach(() => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);
    });

    it('deve marcar mensagem como lida', async () => {
      // @ts-ignore
      const mockPost = (jest.fn() as jest.Mock).mockResolvedValue({ data: { success: true } });

      const mockAxiosInstance = {
        post: mockPost,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await service.markAsRead(mockTenantId, 'wamid.123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/${mockPhoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: 'wamid.123',
        }
      );
    });

    it('deve retornar silenciosamente se tenant não configurado', async () => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: null,
      } as never);

      // Não deve lançar erro
      await expect(service.markAsRead(mockTenantId, 'wamid.123')).resolves.toBeUndefined();
    });

    it('não deve falhar se API retornar erro (não crítico)', async () => {
      // @ts-ignore
      const mockPost = (jest.fn() as jest.Mock).mockRejectedValue(new Error('API Error'));

      const mockAxiosInstance = {
        post: mockPost,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      // Não deve lançar erro
      await expect(service.markAsRead(mockTenantId, 'wamid.123')).resolves.toBeUndefined();
    });
  });

  describe('downloadMedia', () => {
    const mockTenantId = 'tenant-123';
    const mockPhoneNumberId = 'phone-id-123';
    const mockAccessToken = 'token-123';

    beforeEach(() => {
      resetPrismaMock();
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: mockTenantId,
        whatsappPhoneNumberId: mockPhoneNumberId,
        whatsappAccessToken: mockAccessToken,
      } as never);
    });

    it('deve baixar mídia com sucesso', async () => {
      const mockBuffer = Buffer.from('fake-image-data');

      // @ts-ignore
      const mockGet = (jest
        .fn() as jest.Mock)
        // @ts-ignore
        .mockResolvedValueOnce({
          data: {
            url: 'https://cdn.whatsapp.com/media/12345',
          },
        })
        // @ts-ignore
        .mockResolvedValueOnce({
          data: mockBuffer,
        });

      const mockAxiosInstance = {
        get: mockGet,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      const result = await service.downloadMedia(mockTenantId, 'media-id-123');

      expect(result).toBeInstanceOf(Buffer);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/media-id-123');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://cdn.whatsapp.com/media/12345',
        { responseType: 'arraybuffer' }
      );
    });

    it('deve lançar InternalServerError se WhatsApp não retornar URL', async () => {
      // @ts-ignore
      const mockGet = (jest.fn() as jest.Mock).mockResolvedValue({
        data: {
          url: null, // Sem URL
        },
      });

      const mockAxiosInstance = {
        get: mockGet,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await expect(service.downloadMedia(mockTenantId, 'media-id-123')).rejects.toThrow(
        'Falha ao baixar mídia do WhatsApp'
      );
    });

    it('deve lançar InternalServerError se download falhar', async () => {
      // @ts-ignore
      const mockGet = (jest
        .fn() as jest.Mock)
        // @ts-ignore
        .mockResolvedValueOnce({
          data: {
            url: 'https://cdn.whatsapp.com/media/12345',
          },
        })
        // @ts-ignore
        .mockRejectedValueOnce(new Error('Download failed'));

      const mockAxiosInstance = {
        get: mockGet,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any;

      mockedAxios.create.mockReturnValue(mockAxiosInstance as never);

      await expect(service.downloadMedia(mockTenantId, 'media-id-123')).rejects.toThrow(
        'Falha ao baixar mídia do WhatsApp'
      );
    });
  });
});
