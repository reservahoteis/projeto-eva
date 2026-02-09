import swaggerJsdoc from 'swagger-jsdoc';
import {
  authEndpoints,
  userEndpoints,
  conversationEndpoints,
  messageEndpoints,
  contactEndpoints,
  tagEndpoints,
  reportEndpoints,
  escalationEndpoints,
  n8nEndpoints,
  auditLogEndpoints,
  usageTrackingEndpoints,
  webhookEventEndpoints,
} from './swagger-endpoints';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CRM Hoteis Reserva API',
      version: '1.0.0',
      description: 'Multi-tenant CRM para hotéis com automação via WhatsApp, N8N e IA',
      contact: {
        name: 'Bot Reserva Team',
        email: 'api@botreserva.com.br',
        url: 'https://botreserva.com.br',
      },
    },
    servers: [
      {
        url: '/',
        description: 'API Server',
      },
      {
        url: 'https://api.botreserva.com.br',
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Token obtido em /auth/login ou /auth/register',
        },
        ApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key para integração N8N (formato: tenantSlug:whatsappPhoneNumberId)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro',
            },
            message: {
              type: 'string',
              description: 'Detalhes adicionais do erro',
            },
            statusCode: {
              type: 'number',
              description: 'Código HTTP do erro',
            },
          },
          required: ['error'],
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'ATTENDANT', 'SALES'],
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Contact: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
            },
            phoneNumber: {
              type: 'string',
              description: 'Número de telefone normalizado (ex: 5511999999999)',
            },
            name: {
              type: 'string',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            profilePictureUrl: {
              type: 'string',
              format: 'uri',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
            },
            contactId: {
              type: 'string',
              format: 'uuid',
            },
            status: {
              type: 'string',
              enum: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED', 'ARCHIVED'],
            },
            assignedToId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            hotelUnit: {
              type: 'string',
              nullable: true,
              enum: ['Ilhabela', 'Campos do Jordão', 'Camburi', 'Santo Antônio do Pinhal'],
            },
            isOpportunity: {
              type: 'boolean',
            },
            opportunityAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            iaLocked: {
              type: 'boolean',
            },
            iaLockedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            lastMessageAt: {
              type: 'string',
              format: 'date-time',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            conversationId: {
              type: 'string',
              format: 'uuid',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
            },
            type: {
              type: 'string',
              enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'TEMPLATE', 'INTERACTIVE', 'LOCATION'],
            },
            content: {
              type: 'string',
            },
            direction: {
              type: 'string',
              enum: ['INBOUND', 'OUTBOUND'],
            },
            whatsappMessageId: {
              type: 'string',
              nullable: true,
            },
            isRead: {
              type: 'boolean',
            },
            sentAt: {
              type: 'string',
              format: 'date-time',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Tag: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            color: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Escalation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
            },
            conversationId: {
              type: 'string',
              format: 'uuid',
            },
            contactPhoneNumber: {
              type: 'string',
            },
            reason: {
              type: 'string',
              enum: ['USER_REQUESTED', 'BOT_UNABLE', 'NEED_HUMAN', 'OTHER'],
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ASSIGNED', 'RESOLVED', 'CLOSED'],
            },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password', 'tenantSlug'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
            },
            password: {
              type: 'string',
              format: 'password',
            },
            tenantSlug: {
              type: 'string',
              description: 'Slug único do tenant (ex: hotel-ilhabela)',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
            },
            refreshToken: {
              type: 'string',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
            },
            pagination: {
              type: 'object',
              properties: {
                total: {
                  type: 'number',
                },
                count: {
                  type: 'number',
                },
                skip: {
                  type: 'number',
                },
                hasMore: {
                  type: 'boolean',
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    paths: {
      ...authEndpoints,
      ...userEndpoints,
      ...conversationEndpoints,
      ...messageEndpoints,
      ...contactEndpoints,
      ...tagEndpoints,
      ...reportEndpoints,
      ...escalationEndpoints,
      ...n8nEndpoints,
      ...auditLogEndpoints,
      ...usageTrackingEndpoints,
      ...webhookEventEndpoints,
    },
  },
  apis: [], // Paths documentadas no objeto definition acima
};

export const swaggerSpec = swaggerJsdoc(options);
