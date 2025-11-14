import { describe, it, expect } from '@jest/globals';
import {
  listConversationsSchema,
  updateConversationSchema,
  assignConversationSchema,
} from './conversation.validator';

describe('Conversation Validators', () => {
  describe('listConversationsSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar query vazio (todos os parâmetros opcionais)', () => {
        const input = {};

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar filtro por status OPEN', () => {
        const input = {
          status: 'OPEN' as const,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar filtro por status IN_PROGRESS', () => {
        const input = {
          status: 'IN_PROGRESS' as const,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar filtro por status WAITING', () => {
        const input = {
          status: 'WAITING' as const,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar filtro por status CLOSED', () => {
        const input = {
          status: 'CLOSED' as const,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar todos os valores de priority', () => {
        const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

        priorities.forEach((priority) => {
          const result = listConversationsSchema.safeParse({ priority });
          expect(result.success).toBe(true);
        });
      });

      it('deve aceitar assignedToId UUID válido', () => {
        const input = {
          assignedToId: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar search string', () => {
        const input = {
          search: 'cliente urgente',
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar search vazio', () => {
        const input = {
          search: '',
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar page 1 (mínimo)', () => {
        const input = {
          page: 1,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar page alto', () => {
        const input = {
          page: 9999,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar limit 1 (mínimo)', () => {
        const input = {
          limit: 1,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar limit 100 (máximo)', () => {
        const input = {
          limit: 100,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar combinação completa de filtros', () => {
        const input = {
          status: 'IN_PROGRESS' as const,
          priority: 'HIGH' as const,
          assignedToId: '123e4567-e89b-12d3-a456-426614174000',
          search: 'urgente',
          page: 2,
          limit: 50,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar status inválido', () => {
        const input = {
          status: 'INVALID_STATUS',
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar priority inválida', () => {
        const input = {
          priority: 'SUPER_HIGH',
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar assignedToId não UUID', () => {
        const input = {
          assignedToId: 'not-a-uuid',
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar page < 1', () => {
        const input = {
          page: 0,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar page negativo', () => {
        const input = {
          page: -5,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar page decimal', () => {
        const input = {
          page: 1.5,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar limit < 1', () => {
        const input = {
          limit: 0,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar limit > 100', () => {
        const input = {
          limit: 101,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar limit decimal', () => {
        const input = {
          limit: 50.5,
        };

        const result = listConversationsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('updateConversationSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar objeto vazio (todos opcionais)', () => {
        const input = {};

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar apenas status', () => {
        const input = {
          status: 'IN_PROGRESS' as const,
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar todos os status válidos', () => {
        const statuses = ['OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED'] as const;

        statuses.forEach((status) => {
          const result = updateConversationSchema.safeParse({ status });
          expect(result.success).toBe(true);
        });
      });

      it('deve aceitar apenas priority', () => {
        const input = {
          priority: 'URGENT' as const,
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar todas as priorities válidas', () => {
        const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

        priorities.forEach((priority) => {
          const result = updateConversationSchema.safeParse({ priority });
          expect(result.success).toBe(true);
        });
      });

      it('deve aceitar apenas assignedToId', () => {
        const input = {
          assignedToId: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar apenas tagIds vazio', () => {
        const input = {
          tagIds: [],
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar tagIds com um UUID', () => {
        const input = {
          tagIds: ['123e4567-e89b-12d3-a456-426614174000'],
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar tagIds com múltiplos UUIDs', () => {
        const input = {
          tagIds: [
            '123e4567-e89b-12d3-a456-426614174000',
            '987e6543-e21b-12d3-a456-426614174999',
            '456e7890-e12c-34d5-a678-123456789abc',
          ],
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar combinação de todos os campos', () => {
        const input = {
          status: 'WAITING' as const,
          priority: 'HIGH' as const,
          assignedToId: '123e4567-e89b-12d3-a456-426614174000',
          tagIds: ['987e6543-e21b-12d3-a456-426614174999'],
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar status inválido', () => {
        const input = {
          status: 'INVALID',
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar priority inválida', () => {
        const input = {
          priority: 'CRITICAL',
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar assignedToId não UUID', () => {
        const input = {
          assignedToId: 'invalid-id',
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar tagIds com UUID inválido', () => {
        const input = {
          tagIds: ['not-a-uuid'],
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar tagIds com mix de UUIDs válidos e inválidos', () => {
        const input = {
          tagIds: [
            '123e4567-e89b-12d3-a456-426614174000',
            'invalid-uuid',
          ],
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar tagIds não-array', () => {
        const input = {
          tagIds: 'not-an-array',
        };

        const result = updateConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('assignConversationSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar userId UUID válido', () => {
        const input = {
          userId: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = assignConversationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar diferentes formatos de UUID', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          '00000000-0000-0000-0000-000000000000',
          'ffffffff-ffff-ffff-ffff-ffffffffffff',
        ];

        validUUIDs.forEach((userId) => {
          const result = assignConversationSchema.safeParse({ userId });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar userId não UUID', () => {
        const input = {
          userId: 'not-a-uuid',
        };

        const result = assignConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar userId vazio', () => {
        const input = {
          userId: '',
        };

        const result = assignConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar userId com formato quase UUID', () => {
        const input = {
          userId: '123e4567-e89b-12d3-a456-42661417400', // Falta 1 dígito
        };

        const result = assignConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar objeto sem userId', () => {
        const input = {};

        const result = assignConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar userId null', () => {
        const input = {
          userId: null,
        };

        const result = assignConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar userId undefined', () => {
        const input = {
          userId: undefined,
        };

        const result = assignConversationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });
});
