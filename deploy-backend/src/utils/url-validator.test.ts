import { describe, it, expect } from '@jest/globals';
import { validateMediaUrl, isValidMediaUrl, sanitizeUrlForLogging } from './url-validator';
import { BadRequestError } from './errors';

describe('URL Validator', () => {
  describe('validateMediaUrl', () => {
    describe('✅ URLs válidas', () => {
      it('deve aceitar URL do WhatsApp CDN', () => {
        const url = 'https://scontent.whatsapp.net/v/image.jpg';
        expect(() => validateMediaUrl(url)).not.toThrow();
      });

      it('deve aceitar URL do Facebook Graph API', () => {
        const url = 'https://graph.facebook.com/v21.0/media/123';
        expect(() => validateMediaUrl(url)).not.toThrow();
      });

      it('deve aceitar URL com query parameters', () => {
        const url = 'https://scontent.whatsapp.net/image.jpg?token=abc123';
        expect(() => validateMediaUrl(url)).not.toThrow();
      });
    });

    describe('❌ URLs inválidas - Protocolo', () => {
      it('deve rejeitar URL com protocolo http', () => {
        const url = 'http://scontent.whatsapp.net/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/Protocolo não permitido/);
      });

      it('deve rejeitar URL com protocolo file', () => {
        const url = 'file:///etc/passwd';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/Protocolo não permitido/);
      });

      it('deve rejeitar URL com protocolo javascript', () => {
        const url = 'javascript:alert(1)';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
      });
    });

    describe('❌ URLs inválidas - SSRF Protection', () => {
      it('deve rejeitar localhost', () => {
        const url = 'https://localhost/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/localhost não é permitido/);
      });

      it('deve rejeitar 127.0.0.1', () => {
        const url = 'https://127.0.0.1/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/IP privado não é permitido/);
      });

      it('deve rejeitar IP privado 10.x.x.x', () => {
        const url = 'https://10.0.0.1/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/IP privado não é permitido/);
      });

      it('deve rejeitar IP privado 192.168.x.x', () => {
        const url = 'https://192.168.1.1/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/IP privado não é permitido/);
      });

      it('deve rejeitar IP privado 172.16-31.x.x', () => {
        const url = 'https://172.16.0.1/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
      });

      it('deve rejeitar IP link-local 169.254.x.x', () => {
        const url = 'https://169.254.169.254/meta-data'; // AWS metadata endpoint
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
      });
    });

    describe('❌ URLs inválidas - Whitelist', () => {
      it('deve rejeitar domínio não autorizado', () => {
        const url = 'https://malicious-site.com/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/Domínio não permitido/);
      });

      it('deve rejeitar subdomínio malicioso', () => {
        const url = 'https://whatsapp.net.evil.com/image.jpg';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
      });
    });

    describe('❌ URLs inválidas - Formato', () => {
      it('deve rejeitar string vazia', () => {
        expect(() => validateMediaUrl('')).toThrow(BadRequestError);
        expect(() => validateMediaUrl('')).toThrow(/não pode ser vazia/);
      });

      it('deve rejeitar URL mal formatada', () => {
        expect(() => validateMediaUrl('not a url')).toThrow(BadRequestError);
        expect(() => validateMediaUrl('not a url')).toThrow(/Formato de URL inválido/);
      });

      it('deve rejeitar URL muito longa', () => {
        const longUrl = 'https://scontent.whatsapp.net/' + 'a'.repeat(3000);
        expect(() => validateMediaUrl(longUrl)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(longUrl)).toThrow(/excede tamanho máximo/);
      });
    });

    describe('❌ URLs inválidas - Extensões suspeitas', () => {
      it('deve rejeitar arquivo .exe', () => {
        const url = 'https://scontent.whatsapp.net/malware.exe';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
        expect(() => validateMediaUrl(url)).toThrow(/Tipo de arquivo não permitido/);
      });

      it('deve rejeitar arquivo .sh', () => {
        const url = 'https://scontent.whatsapp.net/script.sh';
        expect(() => validateMediaUrl(url)).toThrow(BadRequestError);
      });
    });

    describe('⚙️ Opções', () => {
      it('deve aceitar qualquer host com allowAnyHost=true', () => {
        const url = 'https://random-site.com/image.jpg';
        expect(() => validateMediaUrl(url, { allowAnyHost: true })).not.toThrow();
      });

      it('deve respeitar hosts adicionais', () => {
        const url = 'https://my-cdn.com/image.jpg';
        expect(() =>
          validateMediaUrl(url, {
            additionalAllowedHosts: ['my-cdn.com'],
          })
        ).not.toThrow();
      });

      it('deve respeitar maxLength customizado', () => {
        const url = 'https://scontent.whatsapp.net/very-long-path';
        expect(() =>
          validateMediaUrl(url, { maxLength: 10 })
        ).toThrow(/excede tamanho máximo/);
      });
    });
  });

  describe('isValidMediaUrl', () => {
    it('deve retornar true para URL válida', () => {
      const url = 'https://scontent.whatsapp.net/image.jpg';
      expect(isValidMediaUrl(url)).toBe(true);
    });

    it('deve retornar false para URL inválida', () => {
      const url = 'https://malicious-site.com/image.jpg';
      expect(isValidMediaUrl(url)).toBe(false);
    });

    it('deve retornar false para string vazia', () => {
      expect(isValidMediaUrl('')).toBe(false);
    });
  });

  describe('sanitizeUrlForLogging', () => {
    it('deve redact parâmetros sensíveis', () => {
      const url = 'https://example.com/image.jpg?token=secret123&id=public';
      const sanitized = sanitizeUrlForLogging(url);

      expect(sanitized).toContain('***REDACTED***');
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('id=public'); // Parâmetro não sensível mantido
    });

    it('deve redact múltiplos parâmetros sensíveis', () => {
      const url = 'https://example.com/api?apikey=key123&password=pass456';
      const sanitized = sanitizeUrlForLogging(url);

      expect(sanitized).not.toContain('key123');
      expect(sanitized).not.toContain('pass456');
      expect((sanitized.match(/REDACTED/g) || []).length).toBe(2);
    });

    it('deve retornar [INVALID_URL] para string inválida', () => {
      const invalid = 'not a url';
      expect(sanitizeUrlForLogging(invalid)).toBe('[INVALID_URL]');
    });
  });
});
