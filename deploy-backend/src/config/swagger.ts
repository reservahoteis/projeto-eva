/**
 * OpenAPI/Swagger Configuration
 * Provides comprehensive API documentation following OpenAPI 3.0 specification
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CRM WhatsApp SaaS API',
      version: '1.0.0',
      description: `
        Multi-tenant WhatsApp CRM API for managing customer conversations.

        ## Features
        - Multi-tenant architecture
        - WhatsApp Business API integration
        - Real-time messaging via WebSocket
        - Queue-based message processing
        - JWT authentication
        - Rate limiting

        ## Authentication
        All endpoints (except auth and health) require JWT authentication.
        Include the token in the Authorization header: \`Bearer <token>\`

        ## Rate Limiting
        - General API: 60 requests/minute
        - Login: 5 attempts/15 minutes
        - Message sending: 50 messages/minute

        ## Webhooks
        Webhooks from WhatsApp are validated using HMAC-SHA256 signatures.
      `,
      contact: {
        name: 'API Support',
        email: 'api@seucrm.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://seucrm.com/license',
      },
    },
    servers: [
      {
        url: env.NODE_ENV === 'production'
          ? `https://${env.BASE_DOMAIN}/api/v1`
          : `http://localhost:${env.PORT}/api/v1`,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login',
        },
      },
      schemas: {
        // ============================================
        // Common Schemas
        // ============================================
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
          required: ['error'],
        },

        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            total: {
              type: 'integer',
            },
            totalPages: {
              type: 'integer',
            },
          },
        },

        // ============================================
        // Auth Schemas
        // ============================================
        LoginRequest: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
            },
          },
          required: ['email', 'password'],
        },

        LoginResponse: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User',
            },
            tokens: {
              type: 'object',
              properties: {
                accessToken: {
                  type: 'string',
                },
                refreshToken: {
                  type: 'string',
                },
              },
            },
          },
        },

        // ============================================
        // User Schemas
        // ============================================
        User: {
          type: 'object',
          properties: {
            id: {
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
              enum: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ATTENDANT'],
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE'],
            },
            tenantId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
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

        // ============================================
        // Tenant Schemas
        // ============================================
        Tenant: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            slug: {
              type: 'string',
              pattern: '^[a-z0-9-]+$',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            status: {
              type: 'string',
              enum: ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'],
            },
            plan: {
              type: 'string',
              enum: ['BASIC', 'PRO', 'ENTERPRISE'],
            },
            maxAttendants: {
              type: 'integer',
            },
            maxMessages: {
              type: 'integer',
            },
            whatsappConfigured: {
              type: 'boolean',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // ============================================
        // Conversation Schemas
        // ============================================
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
            contact: {
              $ref: '#/components/schemas/Contact',
            },
            assignedToId: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            assignedTo: {
              $ref: '#/components/schemas/User',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED'],
            },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            },
            lastMessageAt: {
              type: 'string',
              format: 'date-time',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            closedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            metadata: {
              type: 'object',
              nullable: true,
            },
          },
        },

        // ============================================
        // Contact Schemas
        // ============================================
        Contact: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            phoneNumber: {
              type: 'string',
              pattern: '^[0-9]+$',
              example: '5511999999999',
            },
            name: {
              type: 'string',
              nullable: true,
            },
            profilePictureUrl: {
              type: 'string',
              nullable: true,
            },
            email: {
              type: 'string',
              format: 'email',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // ============================================
        // Message Schemas
        // ============================================
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
            whatsappMessageId: {
              type: 'string',
              nullable: true,
            },
            direction: {
              type: 'string',
              enum: ['INBOUND', 'OUTBOUND'],
            },
            type: {
              type: 'string',
              enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOCATION', 'STICKER', 'TEMPLATE', 'INTERACTIVE'],
            },
            content: {
              type: 'string',
            },
            status: {
              type: 'string',
              enum: ['SENT', 'DELIVERED', 'READ', 'FAILED'],
            },
            metadata: {
              type: 'object',
              nullable: true,
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        SendMessageRequest: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              minLength: 1,
              maxLength: 4096,
            },
            type: {
              type: 'string',
              enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'],
              default: 'TEXT',
            },
            metadata: {
              type: 'object',
              properties: {
                mediaUrl: {
                  type: 'string',
                  format: 'uri',
                },
                caption: {
                  type: 'string',
                },
              },
            },
          },
          required: ['content'],
        },
      },
      parameters: {
        tenantId: {
          name: 'X-Tenant-Id',
          in: 'header',
          description: 'Tenant ID for multi-tenant isolation',
          required: false,
          schema: {
            type: 'string',
            format: 'uuid',
          },
        },
        conversationId: {
          name: 'conversationId',
          in: 'path',
          description: 'Conversation ID',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
        },
        messageId: {
          name: 'messageId',
          in: 'path',
          description: 'Message ID',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid',
          },
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
        },
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized - Invalid or missing authentication',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Unauthorized',
              },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden - Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'You do not have permission to access this resource',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Resource not found',
              },
            },
          },
        },
        BadRequest: {
          description: 'Bad request - Invalid parameters',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Validation error',
                details: [
                  {
                    path: 'email',
                    message: 'Invalid email format',
                  },
                ],
              },
            },
          },
        },
        RateLimitExceeded: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Too many requests',
                message: 'You have exceeded the rate limit. Please try again later.',
                retryAfter: 60,
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Internal server error',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication endpoints',
      },
      {
        name: 'Tenants',
        description: 'Tenant management endpoints',
      },
      {
        name: 'Conversations',
        description: 'Conversation management endpoints',
      },
      {
        name: 'Messages',
        description: 'Message management endpoints',
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints for WhatsApp integration',
      },
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints',
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const specs = swaggerJsdoc(options);

// Custom Swagger UI options
export const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    displayOperationId: false,
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin-bottom: 20px }
    .swagger-ui .scheme-container { margin-bottom: 20px }
  `,
  customSiteTitle: 'CRM WhatsApp API Documentation',
  customfavIcon: '/favicon.ico',
};