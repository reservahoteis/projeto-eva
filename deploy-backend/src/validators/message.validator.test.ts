import { describe, it, expect } from '@jest/globals';
import { sendMessageSchema, listMessagesSchema } from './message.validator';

describe('Message Validators', () => {
  describe('sendMessageSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar mensagem de texto válida', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'Olá, como posso ajudar?',
          type: 'TEXT' as const,
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem sem type (opcional)', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'Mensagem sem tipo',
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de imagem', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'https://example.com/image.jpg',
          type: 'IMAGE' as const,
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de vídeo', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'https://example.com/video.mp4',
          type: 'VIDEO' as const,
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de áudio', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'https://example.com/audio.mp3',
          type: 'AUDIO' as const,
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de documento', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'https://example.com/doc.pdf',
          type: 'DOCUMENT' as const,
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem com metadata', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'Mensagem com metadata',
          metadata: {
            source: 'web',
            priority: 'high',
          },
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar conteúdo longo (até 4096 caracteres)', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'a'.repeat(4096),
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar conversationId inválido (não UUID)', () => {
        const input = {
          conversationId: 'invalid-uuid',
          content: 'Teste',
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.path).toContain('conversationId');
        }
      });

      it('deve rejeitar content vazio', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: '',
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Conteúdo é obrigatório');
        }
      });

      it('deve rejeitar content muito longo (>4096 caracteres)', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'a'.repeat(4097),
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Conteúdo muito longo');
        }
      });

      it('deve rejeitar type inválido', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
          content: 'Teste',
          type: 'INVALID_TYPE',
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve aceitar objeto sem conversationId (opcional - pode vir do route param)', () => {
        const input = {
          content: 'Teste',
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve rejeitar objeto sem content', () => {
        const input = {
          conversationId: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = sendMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('listMessagesSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar query vazio (sem filtros)', () => {
        const input = {};

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar limit válido (1-100) como string', () => {
        const input = { limit: '50' };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar limit mínimo (1) como string', () => {
        const input = { limit: '1' };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar limit máximo (100) como string', () => {
        const input = { limit: '100' };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar before (UUID válido)', () => {
        const input = {
          before: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar after (UUID válido)', () => {
        const input = {
          after: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar limit + before', () => {
        const input = {
          limit: '20',
          before: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar limit + after', () => {
        const input = {
          limit: '20',
          after: '123e4567-e89b-12d3-a456-426614174000',
        };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar limit < 1', () => {
        const input = { limit: '0' };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar limit > 100', () => {
        const input = { limit: '101' };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar limit negativo', () => {
        const input = { limit: '-10' };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar limit não numérico', () => {
        const input = { limit: 'abc' };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar before inválido (não UUID)', () => {
        const input = {
          before: 'invalid-uuid',
        };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar after inválido (não UUID)', () => {
        const input = {
          after: 'invalid-uuid',
        };

        const result = listMessagesSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });
});
