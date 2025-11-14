import { describe, it, expect } from '@jest/globals';
import {
  createTenantSchema,
  updateTenantSchema,
  configureWhatsAppSchema,
} from './tenant.validator';

describe('Tenant Validators', () => {
  describe('createTenantSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar tenant válido completo', () => {
        const input = {
          name: 'Hotel Paradise',
          slug: 'hotel-paradise',
          email: 'admin@hotelparadise.com',
          plan: 'PRO' as const,
          maxAttendants: 10,
          maxMessages: 1000,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar tenant sem campos opcionais', () => {
        const input = {
          name: 'Hotel ABC',
          slug: 'hotel-abc',
          email: 'admin@hotelabc.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar nome com 2 caracteres (mínimo)', () => {
        const input = {
          name: 'AB',
          slug: 'ab-hotel',
          email: 'admin@ab.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar slug com 3 caracteres (mínimo)', () => {
        const input = {
          name: 'Hotel',
          slug: 'abc',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar slug com letras, números e hífens', () => {
        const validSlugs = [
          'hotel-123',
          'abc-def-ghi',
          '123-hotel',
          'hotel-paradise-2024',
          'h-o-t-e-l',
        ];

        validSlugs.forEach((slug) => {
          const result = createTenantSchema.safeParse({
            name: 'Hotel',
            slug,
            email: 'admin@hotel.com',
          });
          expect(result.success).toBe(true);
        });
      });

      it('deve aceitar todos os planos válidos', () => {
        const plans = ['BASIC', 'PRO', 'ENTERPRISE'] as const;

        plans.forEach((plan) => {
          const result = createTenantSchema.safeParse({
            name: 'Hotel',
            slug: 'hotel',
            email: 'admin@hotel.com',
            plan,
          });
          expect(result.success).toBe(true);
        });
      });

      it('deve aceitar maxAttendants = 1', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxAttendants: 1,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar maxAttendants alto', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxAttendants: 999999,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar maxMessages = 1', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxMessages: 1,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar maxMessages alto', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxMessages: 10000000,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar nome com menos de 2 caracteres', () => {
        const input = {
          name: 'A',
          slug: 'hotel',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('pelo menos 2 caracteres');
        }
      });

      it('deve rejeitar nome vazio', () => {
        const input = {
          name: '',
          slug: 'hotel',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar slug com menos de 3 caracteres', () => {
        const input = {
          name: 'Hotel',
          slug: 'ab',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('pelo menos 3 caracteres');
        }
      });

      it('deve rejeitar slug vazio', () => {
        const input = {
          name: 'Hotel',
          slug: '',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar slug com letras maiúsculas', () => {
        const input = {
          name: 'Hotel',
          slug: 'Hotel-ABC',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('letras minúsculas');
        }
      });

      it('deve rejeitar slug com espaços', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel abc',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar slug com underscores', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel_abc',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar slug com caracteres especiais', () => {
        const invalidSlugs = ['hotel@abc', 'hotel.abc', 'hotel!abc', 'hotel#abc'];

        invalidSlugs.forEach((slug) => {
          const result = createTenantSchema.safeParse({
            name: 'Hotel',
            slug,
            email: 'admin@hotel.com',
          });
          expect(result.success).toBe(false);
        });
      });

      it('deve rejeitar email inválido', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'email-invalido',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Email inválido');
        }
      });

      it('deve rejeitar email vazio', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: '',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar plan inválido', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          plan: 'PREMIUM',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxAttendants zero', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxAttendants: 0,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxAttendants negativo', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxAttendants: -5,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxAttendants decimal', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxAttendants: 10.5,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxMessages zero', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxMessages: 0,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxMessages negativo', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxMessages: -100,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxMessages decimal', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
          email: 'admin@hotel.com',
          maxMessages: 1000.99,
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem name', () => {
        const input = {
          slug: 'hotel',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem slug', () => {
        const input = {
          name: 'Hotel',
          email: 'admin@hotel.com',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem email', () => {
        const input = {
          name: 'Hotel',
          slug: 'hotel',
        };

        const result = createTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('updateTenantSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar objeto vazio (todos opcionais)', () => {
        const input = {};

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar apenas name', () => {
        const input = {
          name: 'Novo Nome',
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar apenas email', () => {
        const input = {
          email: 'novoemail@hotel.com',
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar todos os status válidos', () => {
        const statuses = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'] as const;

        statuses.forEach((status) => {
          const result = updateTenantSchema.safeParse({ status });
          expect(result.success).toBe(true);
        });
      });

      it('deve aceitar todos os planos válidos', () => {
        const plans = ['BASIC', 'PRO', 'ENTERPRISE'] as const;

        plans.forEach((plan) => {
          const result = updateTenantSchema.safeParse({ plan });
          expect(result.success).toBe(true);
        });
      });

      it('deve aceitar maxAttendants válido', () => {
        const input = {
          maxAttendants: 20,
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar maxMessages válido', () => {
        const input = {
          maxMessages: 5000,
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar combinação de campos', () => {
        const input = {
          name: 'Hotel Updated',
          email: 'updated@hotel.com',
          status: 'ACTIVE' as const,
          plan: 'ENTERPRISE' as const,
          maxAttendants: 50,
          maxMessages: 10000,
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar name com menos de 2 caracteres', () => {
        const input = {
          name: 'A',
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar name vazio', () => {
        const input = {
          name: '',
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar email inválido', () => {
        const input = {
          email: 'email-sem-arroba',
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar status inválido', () => {
        const input = {
          status: 'PENDING',
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar plan inválido', () => {
        const input = {
          plan: 'PREMIUM',
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxAttendants zero', () => {
        const input = {
          maxAttendants: 0,
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxAttendants negativo', () => {
        const input = {
          maxAttendants: -10,
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxMessages zero', () => {
        const input = {
          maxMessages: 0,
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar maxMessages negativo', () => {
        const input = {
          maxMessages: -500,
        };

        const result = updateTenantSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('configureWhatsAppSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar configuração completa válida', () => {
        const input = {
          whatsappPhoneNumberId: '123456789012345',
          whatsappAccessToken: 'EAAG...long-token...xyz',
          whatsappBusinessAccountId: '987654321098765',
          whatsappAppSecret: 'abc123def456ghi789',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar tokens longos', () => {
        const input = {
          whatsappPhoneNumberId: '1',
          whatsappAccessToken: 'a'.repeat(500),
          whatsappBusinessAccountId: '2',
          whatsappAppSecret: 'b'.repeat(100),
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar IDs mínimos (1 caractere)', () => {
        const input = {
          whatsappPhoneNumberId: '1',
          whatsappAccessToken: 'a',
          whatsappBusinessAccountId: '2',
          whatsappAppSecret: 'b',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar whatsappPhoneNumberId vazio', () => {
        const input = {
          whatsappPhoneNumberId: '',
          whatsappAccessToken: 'token',
          whatsappBusinessAccountId: 'account',
          whatsappAppSecret: 'secret',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar whatsappAccessToken vazio', () => {
        const input = {
          whatsappPhoneNumberId: 'phone',
          whatsappAccessToken: '',
          whatsappBusinessAccountId: 'account',
          whatsappAppSecret: 'secret',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar whatsappBusinessAccountId vazio', () => {
        const input = {
          whatsappPhoneNumberId: 'phone',
          whatsappAccessToken: 'token',
          whatsappBusinessAccountId: '',
          whatsappAppSecret: 'secret',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar whatsappAppSecret vazio', () => {
        const input = {
          whatsappPhoneNumberId: 'phone',
          whatsappAccessToken: 'token',
          whatsappBusinessAccountId: 'account',
          whatsappAppSecret: '',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem whatsappPhoneNumberId', () => {
        const input = {
          whatsappAccessToken: 'token',
          whatsappBusinessAccountId: 'account',
          whatsappAppSecret: 'secret',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem whatsappAccessToken', () => {
        const input = {
          whatsappPhoneNumberId: 'phone',
          whatsappBusinessAccountId: 'account',
          whatsappAppSecret: 'secret',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem whatsappBusinessAccountId', () => {
        const input = {
          whatsappPhoneNumberId: 'phone',
          whatsappAccessToken: 'token',
          whatsappAppSecret: 'secret',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem whatsappAppSecret', () => {
        const input = {
          whatsappPhoneNumberId: 'phone',
          whatsappAccessToken: 'token',
          whatsappBusinessAccountId: 'account',
        };

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto vazio', () => {
        const input = {};

        const result = configureWhatsAppSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });
});
