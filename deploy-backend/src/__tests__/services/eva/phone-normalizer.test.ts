/**
 * Testes para EVA Phone Normalizer
 *
 * TDD: RED -> GREEN -> REFACTOR
 *
 * Normaliza telefones para formato padrao:
 * - Brasil: 55 + DDD (2 dig) + 9 + numero (8 dig) = 13 digitos
 * - EUA/Canada: 1 + area (3 dig) + numero (7 dig) = 11 digitos
 */

import { normalizePhone } from '@/services/eva/utils/phone-normalizer';

describe('EVA Phone Normalizer', () => {
  describe('Brazil numbers', () => {
    it('should keep 13-digit Brazilian number unchanged', () => {
      expect(normalizePhone('5511999887766')).toBe('5511999887766');
    });

    it('should add missing 9 to 12-digit Brazilian number', () => {
      // 55 + 11 + 99887766 (falta o 9)
      expect(normalizePhone('551199887766')).toBe('5511999887766');
    });

    it('should add 55 prefix to 11-digit number starting with valid DDD', () => {
      // DDD 21 + 9 + 99887766 = 21999887766 (11 digits, DDD 21)
      expect(normalizePhone('21999887766')).toBe('5521999887766');
    });

    it('should treat 11-digit number starting with 1 as US (ambiguous)', () => {
      // 11999887766 starts with '1' and has 11 digits → treated as US
      // This is the N8N behavior (US check runs before BR)
      expect(normalizePhone('11999887766')).toBe('11999887766');
    });

    it('should handle formatted numbers', () => {
      expect(normalizePhone('+55 (11) 99988-7766')).toBe('5511999887766');
      expect(normalizePhone('55-11-999887766')).toBe('5511999887766');
    });

    it('should handle 10-digit BR number (DDD + 8 digits, no 9)', () => {
      // DDD 11 + 99887766 → add 55 prefix + insert 9
      expect(normalizePhone('1199887766')).toBe('5511999887766');
    });
  });

  describe('USA/Canada numbers', () => {
    it('should keep 11-digit US number unchanged', () => {
      expect(normalizePhone('12125551234')).toBe('12125551234');
    });

    it('should add 1 prefix to 10-digit US number with non-BR DDD', () => {
      // DDD 01 is not valid Brazilian (< 11)
      expect(normalizePhone('0112345678')).toBe('10112345678');
    });
  });

  describe('Edge cases', () => {
    it('should return original if only non-digits', () => {
      expect(normalizePhone('abc')).toBe('abc');
    });

    it('should handle empty string', () => {
      expect(normalizePhone('')).toBe('');
    });

    it('should strip all non-digit chars', () => {
      expect(normalizePhone('+55 (11) 99988-7766')).toBe('5511999887766');
    });
  });
});
