import { describe, it, expect } from '@jest/globals';
import {
  WhatsAppWebhookSchema,
  WhatsAppMessageSchema,
  WhatsAppStatusSchema,
  WhatsAppVerificationSchema,
  isTextMessage,
  isImageMessage,
  isVideoMessage,
  isAudioMessage,
  isDocumentMessage,
  isLocationMessage,
  isInteractiveMessage,
  isButtonReply,
  isListReply,
  validateWhatsAppWebhook,
  validateWhatsAppWebhookSafe,
  validateWhatsAppVerification,
  validateWhatsAppVerificationSafe,
} from './whatsapp-webhook.validator';

describe('WhatsApp Webhook Validators', () => {
  describe('WhatsAppMessageSchema', () => {
    describe('✅ Valid inputs - Text Messages', () => {
      it('deve aceitar mensagem de texto simples', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'text',
          text: {
            body: 'Olá, como vai?',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de texto com contexto (reply)', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'text',
          text: {
            body: 'Resposta',
          },
          context: {
            from: '5511888888888',
            id: 'wamid.456',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Image Messages', () => {
      it('deve aceitar mensagem de imagem sem legenda', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'image',
          image: {
            id: 'media-id-123',
            mime_type: 'image/jpeg',
            sha256: 'abc123hash',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de imagem com caption', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'image',
          image: {
            id: 'media-id-123',
            mime_type: 'image/jpeg',
            sha256: 'abc123hash',
            caption: 'Foto da reserva',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Video Messages', () => {
      it('deve aceitar mensagem de vídeo', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'video',
          video: {
            id: 'video-id-123',
            mime_type: 'video/mp4',
            sha256: 'def456hash',
            caption: 'Tour do hotel',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Audio Messages', () => {
      it('deve aceitar mensagem de áudio normal', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'audio',
          audio: {
            id: 'audio-id-123',
            mime_type: 'audio/ogg',
            sha256: 'ghi789hash',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de voz (PTT)', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'audio',
          audio: {
            id: 'audio-id-123',
            mime_type: 'audio/ogg',
            sha256: 'ghi789hash',
            voice: true,
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Document Messages', () => {
      it('deve aceitar mensagem de documento', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'document',
          document: {
            id: 'doc-id-123',
            filename: 'contrato.pdf',
            mime_type: 'application/pdf',
            sha256: 'jkl012hash',
            caption: 'Contrato de reserva',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Location Messages', () => {
      it('deve aceitar mensagem de localização simples', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'location',
          location: {
            latitude: -23.550520,
            longitude: -46.633308,
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem de localização com nome e endereço', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'location',
          location: {
            latitude: -23.550520,
            longitude: -46.633308,
            name: 'Hotel Paradise',
            address: 'Av. Paulista, 1000 - São Paulo',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Contact Messages', () => {
      it('deve aceitar mensagem de contato', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'contacts',
          contacts: {
            contacts: [
              {
                name: {
                  formatted_name: 'João Silva',
                  first_name: 'João',
                  last_name: 'Silva',
                },
                phones: [
                  {
                    phone: '5511888888888',
                    type: 'CELL',
                  },
                ],
                emails: [
                  {
                    email: 'joao@email.com',
                    type: 'WORK',
                  },
                ],
              },
            ],
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Interactive Messages', () => {
      it('deve aceitar button reply', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'button',
          button: {
            button_reply: {
              id: 'btn-1',
              title: 'Sim',
            },
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar list reply', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'interactive',
          interactive: {
            list_reply: {
              id: 'list-item-1',
              title: 'Quarto Standard',
              description: 'Quarto para 2 pessoas',
            },
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Sticker Messages', () => {
      it('deve aceitar mensagem de sticker', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'sticker',
          sticker: {
            id: 'sticker-id-123',
            mime_type: 'image/webp',
            sha256: 'mno345hash',
            animated: false,
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('✅ Valid inputs - Special Message Types', () => {
      it('deve aceitar mensagem com referral (de anúncio)', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'text',
          text: {
            body: 'Olá',
          },
          referral: {
            source_url: 'https://ad-link.com',
            source_type: 'ad',
            source_id: 'ad-123',
            headline: 'Promoção Hotel',
            body: 'Reserve agora',
          },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar mensagem com erro', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'unknown',
          errors: [
            {
              code: 131051,
              title: 'Message type not supported',
              message: 'This type is not supported',
              error_data: {
                details: 'Cannot process this message type',
              },
            },
          ],
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar mensagem sem from', () => {
        const input = {
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'text',
          text: { body: 'Teste' },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar mensagem sem id', () => {
        const input = {
          from: '5511999999999',
          timestamp: '1234567890',
          type: 'text',
          text: { body: 'Teste' },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar mensagem sem timestamp', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          type: 'text',
          text: { body: 'Teste' },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar mensagem com type inválido', () => {
        const input = {
          from: '5511999999999',
          id: 'wamid.123',
          timestamp: '1234567890',
          type: 'invalid_type',
          text: { body: 'Teste' },
        };

        const result = WhatsAppMessageSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('WhatsAppStatusSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar status "sent"', () => {
        const input = {
          id: 'wamid.123',
          status: 'sent',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar status "delivered"', () => {
        const input = {
          id: 'wamid.123',
          status: 'delivered',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar status "read"', () => {
        const input = {
          id: 'wamid.123',
          status: 'read',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar status "failed" com errors', () => {
        const input = {
          id: 'wamid.123',
          status: 'failed',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
          errors: [
            {
              code: 131047,
              title: 'Re-engagement message',
              message: 'Cannot send message',
              error_data: {
                details: 'Outside 24h window',
              },
            },
          ],
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar status com conversation info', () => {
        const input = {
          id: 'wamid.123',
          status: 'delivered',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
          conversation: {
            id: 'conv-123',
            origin: {
              type: 'user_initiated',
            },
            expiration_timestamp: '1234567890',
          },
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar status com pricing info', () => {
        const input = {
          id: 'wamid.123',
          status: 'delivered',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
          pricing: {
            billable: true,
            pricing_model: 'CBP',
            category: 'service',
          },
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar status inválido', () => {
        const input = {
          id: 'wamid.123',
          status: 'pending',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar sem id', () => {
        const input = {
          status: 'sent',
          timestamp: '1234567890',
          recipient_id: '5511999999999',
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar sem recipient_id', () => {
        const input = {
          id: 'wamid.123',
          status: 'sent',
          timestamp: '1234567890',
        };

        const result = WhatsAppStatusSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('WhatsAppWebhookSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar webhook completo com mensagem', () => {
        const input = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '5511999999999',
                      phone_number_id: 'PHONE_NUMBER_ID',
                    },
                    contacts: [
                      {
                        profile: {
                          name: 'João',
                        },
                        wa_id: '5511888888888',
                      },
                    ],
                    messages: [
                      {
                        from: '5511888888888',
                        id: 'wamid.123',
                        timestamp: '1234567890',
                        type: 'text',
                        text: {
                          body: 'Olá',
                        },
                      },
                    ],
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        };

        const result = WhatsAppWebhookSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar webhook com status update', () => {
        const input = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '5511999999999',
                      phone_number_id: 'PHONE_NUMBER_ID',
                    },
                    statuses: [
                      {
                        id: 'wamid.123',
                        status: 'delivered',
                        timestamp: '1234567890',
                        recipient_id: '5511888888888',
                      },
                    ],
                  },
                  field: 'message_status',
                },
              ],
            },
          ],
        };

        const result = WhatsAppWebhookSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('deve aceitar webhook com múltiplos entries', () => {
        const input = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'ACCOUNT_1',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '5511999999999',
                      phone_number_id: 'PHONE_1',
                    },
                  },
                  field: 'messages',
                },
              ],
            },
            {
              id: 'ACCOUNT_2',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '5511888888888',
                      phone_number_id: 'PHONE_2',
                    },
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        };

        const result = WhatsAppWebhookSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar object incorreto', () => {
        const input = {
          object: 'invalid',
          entry: [],
        };

        const result = WhatsAppWebhookSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar sem entry', () => {
        const input = {
          object: 'whatsapp_business_account',
        };

        const result = WhatsAppWebhookSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar messaging_product incorreto', () => {
        const input = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'ACCOUNT_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'telegram',
                    metadata: {
                      display_phone_number: '5511999999999',
                      phone_number_id: 'PHONE_ID',
                    },
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        };

        const result = WhatsAppWebhookSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('WhatsAppVerificationSchema', () => {
    describe('✅ Valid inputs', () => {
      it('deve aceitar parâmetros de verificação válidos', () => {
        const input = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'my-secret-token',
          'hub.challenge': 'challenge-string-12345',
        };

        const result = WhatsAppVerificationSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('❌ Invalid inputs', () => {
      it('deve rejeitar hub.mode incorreto', () => {
        const input = {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'token',
          'hub.challenge': 'challenge',
        };

        const result = WhatsAppVerificationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar sem hub.verify_token', () => {
        const input = {
          'hub.mode': 'subscribe',
          'hub.challenge': 'challenge',
        };

        const result = WhatsAppVerificationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('deve rejeitar sem hub.challenge', () => {
        const input = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token',
        };

        const result = WhatsAppVerificationSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Type Guard Functions', () => {
    const createMessage = (type: string, data: any) => ({
      from: '5511999999999',
      id: 'wamid.123',
      timestamp: '1234567890',
      type,
      ...data,
    });

    describe('isTextMessage', () => {
      it('deve retornar true para mensagem de texto', () => {
        const message: any = createMessage('text', {
          text: { body: 'Olá' },
        });

        expect(isTextMessage(message)).toBe(true);
      });

      it('deve retornar false para mensagem de imagem', () => {
        const message: any = createMessage('image', {
          image: { id: '123', mime_type: 'image/jpeg', sha256: 'hash' },
        });

        expect(isTextMessage(message)).toBe(false);
      });
    });

    describe('isImageMessage', () => {
      it('deve retornar true para mensagem de imagem', () => {
        const message: any = createMessage('image', {
          image: { id: '123', mime_type: 'image/jpeg', sha256: 'hash' },
        });

        expect(isImageMessage(message)).toBe(true);
      });

      it('deve retornar false para mensagem de texto', () => {
        const message: any = createMessage('text', {
          text: { body: 'Olá' },
        });

        expect(isImageMessage(message)).toBe(false);
      });
    });

    describe('isVideoMessage', () => {
      it('deve retornar true para mensagem de vídeo', () => {
        const message: any = createMessage('video', {
          video: { id: '123', mime_type: 'video/mp4', sha256: 'hash' },
        });

        expect(isVideoMessage(message)).toBe(true);
      });
    });

    describe('isAudioMessage', () => {
      it('deve retornar true para mensagem de áudio', () => {
        const message: any = createMessage('audio', {
          audio: { id: '123', mime_type: 'audio/ogg', sha256: 'hash' },
        });

        expect(isAudioMessage(message)).toBe(true);
      });
    });

    describe('isDocumentMessage', () => {
      it('deve retornar true para mensagem de documento', () => {
        const message: any = createMessage('document', {
          document: { id: '123', filename: 'doc.pdf', mime_type: 'application/pdf', sha256: 'hash' },
        });

        expect(isDocumentMessage(message)).toBe(true);
      });
    });

    describe('isLocationMessage', () => {
      it('deve retornar true para mensagem de localização', () => {
        const message: any = createMessage('location', {
          location: { latitude: -23.5505, longitude: -46.6333 },
        });

        expect(isLocationMessage(message)).toBe(true);
      });
    });

    describe('isInteractiveMessage', () => {
      it('deve retornar true para mensagem interativa', () => {
        const message: any = createMessage('interactive', {
          interactive: { list_reply: { id: '1', title: 'Opção 1' } },
        });

        expect(isInteractiveMessage(message)).toBe(true);
      });
    });

    describe('isButtonReply', () => {
      it('deve retornar true para button reply', () => {
        const message: any = createMessage('button', {
          button: { button_reply: { id: 'btn-1', title: 'Sim' } },
        });

        expect(isButtonReply(message)).toBe(true);
      });

      it('deve retornar false para mensagem de texto', () => {
        const message: any = createMessage('text', {
          text: { body: 'Olá' },
        });

        expect(isButtonReply(message)).toBe(false);
      });
    });

    describe('isListReply', () => {
      it('deve retornar true para list reply', () => {
        const message: any = createMessage('interactive', {
          interactive: { list_reply: { id: '1', title: 'Opção 1' } },
        });

        expect(isListReply(message)).toBe(true);
      });

      it('deve retornar false para button reply', () => {
        const message: any = createMessage('button', {
          button: { button_reply: { id: 'btn-1', title: 'Sim' } },
        });

        expect(isListReply(message)).toBe(false);
      });
    });
  });

  describe('Validation Helper Functions', () => {
    describe('validateWhatsAppWebhook', () => {
      it('deve validar e retornar webhook válido', () => {
        const input = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'ACCOUNT_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '5511999999999',
                      phone_number_id: 'PHONE_ID',
                    },
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        };

        expect(() => validateWhatsAppWebhook(input)).not.toThrow();
      });

      it('deve lançar erro para webhook inválido', () => {
        const input = {
          object: 'invalid',
          entry: [],
        };

        expect(() => validateWhatsAppWebhook(input)).toThrow();
      });
    });

    describe('validateWhatsAppWebhookSafe', () => {
      it('deve retornar success true para webhook válido', () => {
        const input = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'ACCOUNT_ID',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '5511999999999',
                      phone_number_id: 'PHONE_ID',
                    },
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        };

        const result = validateWhatsAppWebhookSafe(input);
        expect(result.success).toBe(true);
      });

      it('deve retornar success false para webhook inválido', () => {
        const input = {
          object: 'invalid',
        };

        const result = validateWhatsAppWebhookSafe(input);
        expect(result.success).toBe(false);
      });
    });

    describe('validateWhatsAppVerification', () => {
      it('deve validar e retornar verification válido', () => {
        const input = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token',
          'hub.challenge': 'challenge',
        };

        expect(() => validateWhatsAppVerification(input)).not.toThrow();
      });

      it('deve lançar erro para verification inválido', () => {
        const input = {
          'hub.mode': 'invalid',
        };

        expect(() => validateWhatsAppVerification(input)).toThrow();
      });
    });

    describe('validateWhatsAppVerificationSafe', () => {
      it('deve retornar success true para verification válido', () => {
        const input = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token',
          'hub.challenge': 'challenge',
        };

        const result = validateWhatsAppVerificationSafe(input);
        expect(result.success).toBe(true);
      });

      it('deve retornar success false para verification inválido', () => {
        const input = {
          'hub.mode': 'invalid',
        };

        const result = validateWhatsAppVerificationSafe(input);
        expect(result.success).toBe(false);
      });
    });
  });
});
