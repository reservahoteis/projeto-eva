import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WhatsAppServiceV2 } from './whatsapp.service.v2';

// Mock do Prisma já está no jest.setup.ts

describe('WhatsAppServiceV2', () => {
  let service: WhatsAppServiceV2;

  beforeEach(() => {
    service = new WhatsAppServiceV2();
    jest.clearAllMocks();
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
});

describe('WhatsAppServiceV2 - Integração', () => {
  // Estes testes precisam de mock do Prisma e Axios
  // Mover para testes de integração quando houver banco de teste

  describe.skip('sendTextMessage', () => {
    it('deve enviar mensagem de texto com sucesso', async () => {
      // TODO: Implementar com mock do axios e prisma
    });

    it('deve lançar erro se tenant não tem WhatsApp configurado', async () => {
      // TODO: Implementar
    });

    it('deve lançar erro se número for inválido', async () => {
      // TODO: Implementar
    });
  });

  describe.skip('sendMediaMessage', () => {
    it('deve enviar imagem com sucesso', async () => {
      // TODO: Implementar
    });

    it('deve validar URL de mídia', async () => {
      // TODO: Implementar
    });
  });
});
