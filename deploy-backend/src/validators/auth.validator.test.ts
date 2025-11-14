import { describe, it, expect } from '@jest/globals';
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  changePasswordSchema,
} from './auth.validator';

describe('Auth Validators', () => {
  describe('loginSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar email e senha válidos', () => {
        const input = {
          email: 'usuario@exemplo.com',
          password: '123456',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar senha com 6 caracteres (mínimo)', () => {
        const input = {
          email: 'admin@hotel.com',
          password: 'abc123',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar senha longa', () => {
        const input = {
          email: 'user@example.com',
          password: 'SuperSenhaSegura123!@#',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar diferentes formatos de email', () => {
        const validEmails = [
          'user@example.com',
          'admin+test@hotel.com.br',
          'john.doe@company.co.uk',
          'teste_123@dominio.io',
        ];

        validEmails.forEach((email) => {
          const result = loginSchema.safeParse({ email, password: '123456' });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar email inválido', () => {
        const input = {
          email: 'email-invalido',
          password: '123456',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Email inválido');
        }
      });

      it('deve rejeitar email vazio', () => {
        const input = {
          email: '',
          password: '123456',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar senha com menos de 6 caracteres', () => {
        const input = {
          email: 'user@example.com',
          password: '12345',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('pelo menos 6 caracteres');
        }
      });

      it('deve rejeitar senha vazia', () => {
        const input = {
          email: 'user@example.com',
          password: '',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem email', () => {
        const input = {
          password: '123456',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem password', () => {
        const input = {
          email: 'user@example.com',
        };

        const result = loginSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('refreshTokenSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar refresh token válido', () => {
        const input = {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
        };

        const result = refreshTokenSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar qualquer string não-vazia', () => {
        const validTokens = ['token123', 'abc', 'refresh-token-long-string'];

        validTokens.forEach((refreshToken) => {
          const result = refreshTokenSchema.safeParse({ refreshToken });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar refresh token vazio', () => {
        const input = {
          refreshToken: '',
        };

        const result = refreshTokenSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Refresh token é obrigatório');
        }
      });

      it('deve rejeitar objeto sem refreshToken', () => {
        const input = {};

        const result = refreshTokenSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('registerSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar registro completo válido', () => {
        const input = {
          email: 'novo@hotel.com',
          password: 'senha123',
          name: 'João Silva',
          role: 'ATTENDANT' as const,
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar registro sem role (opcional)', () => {
        const input = {
          email: 'admin@hotel.com',
          password: 'senhaSegura123',
          name: 'Admin Hotel',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar role TENANT_ADMIN', () => {
        const input = {
          email: 'admin@hotel.com',
          password: 'senha123',
          name: 'Admin',
          role: 'TENANT_ADMIN' as const,
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar role ATTENDANT', () => {
        const input = {
          email: 'atendente@hotel.com',
          password: 'senha123',
          name: 'Atendente',
          role: 'ATTENDANT' as const,
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar senha com 8 caracteres (mínimo)', () => {
        const input = {
          email: 'user@hotel.com',
          password: '12345678',
          name: 'Usuário',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar nome com 2 caracteres (mínimo)', () => {
        const input = {
          email: 'user@hotel.com',
          password: '12345678',
          name: 'AB',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar nomes longos e compostos', () => {
        const input = {
          email: 'user@hotel.com',
          password: '12345678',
          name: 'João Pedro da Silva Santos Júnior',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar email inválido', () => {
        const input = {
          email: 'email-sem-arroba',
          password: '12345678',
          name: 'João',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Email inválido');
        }
      });

      it('deve rejeitar senha com menos de 8 caracteres', () => {
        const input = {
          email: 'user@hotel.com',
          password: '1234567',
          name: 'João',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('pelo menos 8 caracteres');
        }
      });

      it('deve rejeitar senha vazia', () => {
        const input = {
          email: 'user@hotel.com',
          password: '',
          name: 'João',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar nome com menos de 2 caracteres', () => {
        const input = {
          email: 'user@hotel.com',
          password: '12345678',
          name: 'A',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('pelo menos 2 caracteres');
        }
      });

      it('deve rejeitar nome vazio', () => {
        const input = {
          email: 'user@hotel.com',
          password: '12345678',
          name: '',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar role inválido', () => {
        const input = {
          email: 'user@hotel.com',
          password: '12345678',
          name: 'João',
          role: 'INVALID_ROLE',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem email', () => {
        const input = {
          password: '12345678',
          name: 'João',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem password', () => {
        const input = {
          email: 'user@hotel.com',
          name: 'João',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem name', () => {
        const input = {
          email: 'user@hotel.com',
          password: '12345678',
        };

        const result = registerSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('changePasswordSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar senhas válidas', () => {
        const input = {
          oldPassword: 'senhaAntiga123',
          newPassword: 'senhaNova456',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar nova senha com 8 caracteres (mínimo)', () => {
        const input = {
          oldPassword: 'antiga',
          newPassword: '12345678',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar senhas longas', () => {
        const input = {
          oldPassword: 'senhaAntigaSuperSegura123!@#',
          newPassword: 'senhaNovaSuperSegura456!@#$',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar oldPassword de qualquer tamanho (já validada no login)', () => {
        const input = {
          oldPassword: '123', // Pode ser curta porque já foi validada no login
          newPassword: '12345678',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar oldPassword vazio', () => {
        const input = {
          oldPassword: '',
          newPassword: '12345678',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Senha atual é obrigatória');
        }
      });

      it('deve rejeitar newPassword com menos de 8 caracteres', () => {
        const input = {
          oldPassword: 'antiga',
          newPassword: '1234567',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('pelo menos 8 caracteres');
        }
      });

      it('deve rejeitar newPassword vazio', () => {
        const input = {
          oldPassword: 'antiga',
          newPassword: '',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem oldPassword', () => {
        const input = {
          newPassword: '12345678',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem newPassword', () => {
        const input = {
          oldPassword: 'antiga',
        };

        const result = changePasswordSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });
});
