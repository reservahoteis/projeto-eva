/**
 * OpenAPI 3.0 Endpoint Specifications
 * Este arquivo documenta todos os endpoints da API em formato OpenAPI
 */

export const authEndpoints = {
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login de usuário',
      description: 'Autentica um usuário e retorna access token + refresh token',
      operationId: 'loginUser',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/LoginRequest',
            },
            examples: {
              success: {
                value: {
                  email: 'admin@hotel.com',
                  password: 'senha123',
                  tenantSlug: 'hotel-ilhabela',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login realizado com sucesso',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginResponse',
              },
            },
          },
        },
        '400': {
          description: 'Credenciais inválidas ou dados incompletos',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        '429': {
          description: 'Muitas tentativas de login. Aguarde 15 minutos.',
        },
      },
    },
  },
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Registrar novo usuário',
      description: 'Cria um novo usuário no tenant (apenas admin pode fazer isso)',
      operationId: 'registerUser',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password', 'name', 'role'],
              properties: {
                email: {
                  type: 'string',
                  format: 'email',
                },
                password: {
                  type: 'string',
                  format: 'password',
                  minLength: 8,
                },
                name: {
                  type: 'string',
                  minLength: 2,
                },
                role: {
                  type: 'string',
                  enum: ['TENANT_ADMIN', 'MANAGER', 'ATTENDANT', 'SALES'],
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Usuário criado com sucesso',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/User',
              },
            },
          },
        },
        '400': {
          description: 'Email já existe ou dados inválidos',
        },
        '401': {
          description: 'Não autenticado',
        },
        '403': {
          description: 'Sem permissão (apenas admin)',
        },
      },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Renovar access token',
      description: 'Usa o refresh token para obter um novo access token',
      operationId: 'refreshToken',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/RefreshTokenRequest',
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Token renovado com sucesso',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        '401': {
          description: 'Refresh token inválido ou expirado',
        },
      },
    },
  },
  '/auth/change-password': {
    post: {
      tags: ['Auth'],
      summary: 'Alterar senha',
      description: 'Muda a senha do usuário autenticado',
      operationId: 'changePassword',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currentPassword', 'newPassword'],
              properties: {
                currentPassword: {
                  type: 'string',
                  format: 'password',
                },
                newPassword: {
                  type: 'string',
                  format: 'password',
                  minLength: 8,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Senha alterada com sucesso',
        },
        '400': {
          description: 'Senha atual incorreta',
        },
        '401': {
          description: 'Não autenticado',
        },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Fazer logout',
      description: 'Invalida o token JWT atual (adiciona à blacklist)',
      operationId: 'logoutUser',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Logout realizado com sucesso',
        },
        '401': {
          description: 'Não autenticado',
        },
      },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Obter dados do usuário autenticado',
      description: 'Retorna informações do usuário autenticado',
      operationId: 'getCurrentUser',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Dados do usuário',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                  tenant: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      slug: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '401': {
          description: 'Não autenticado',
        },
      },
    },
  },
};

export const userEndpoints = {
  '/api/users': {
    get: {
      tags: ['Users'],
      summary: 'Listar usuários do tenant',
      description: 'Lista todos os usuários com paginação (apenas admin)',
      operationId: 'listUsers',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'skip',
          in: 'query',
          schema: { type: 'integer', default: 0 },
          description: 'Número de registros para pular',
        },
        {
          name: 'take',
          in: 'query',
          schema: { type: 'integer', default: 10 },
          description: 'Número de registros para retornar',
        },
        {
          name: 'search',
          in: 'query',
          schema: { type: 'string' },
          description: 'Buscar por nome ou email',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'] },
        },
      ],
      responses: {
        '200': {
          description: 'Lista de usuários',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PaginatedResponse',
              },
            },
          },
        },
        '401': { description: 'Não autenticado' },
        '403': { description: 'Sem permissão' },
      },
    },
    post: {
      tags: ['Users'],
      summary: 'Criar novo usuário',
      description: 'Cria um novo usuário no tenant (apenas admin)',
      operationId: 'createUser',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password', 'name', 'role'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password', minLength: 8 },
                name: { type: 'string', minLength: 2 },
                role: {
                  type: 'string',
                  enum: ['TENANT_ADMIN', 'MANAGER', 'ATTENDANT', 'SALES'],
                },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Usuário criado' },
        '400': { description: 'Dados inválidos' },
        '401': { description: 'Não autenticado' },
        '403': { description: 'Sem permissão' },
      },
    },
  },
  '/api/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Obter usuário por ID',
      operationId: 'getUserById',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Dados do usuário',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/User' },
            },
          },
        },
        '404': { description: 'Usuário não encontrado' },
      },
    },
    patch: {
      tags: ['Users'],
      summary: 'Atualizar usuário',
      operationId: 'updateUser',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string', minLength: 2 },
                email: { type: 'string', format: 'email' },
                role: {
                  type: 'string',
                  enum: ['TENANT_ADMIN', 'MANAGER', 'ATTENDANT', 'SALES'],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Usuário atualizado' },
        '400': { description: 'Dados inválidos' },
        '404': { description: 'Usuário não encontrado' },
      },
    },
    delete: {
      tags: ['Users'],
      summary: 'Deletar usuário',
      operationId: 'deleteUser',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': { description: 'Usuário deletado' },
        '404': { description: 'Usuário não encontrado' },
      },
    },
  },
  '/api/users/{id}/status': {
    patch: {
      tags: ['Users'],
      summary: 'Alterar status do usuário',
      description: 'Ativa, suspende ou desativa um usuário',
      operationId: 'updateUserStatus',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Status atualizado' },
        '400': { description: 'Status inválido' },
        '404': { description: 'Usuário não encontrado' },
      },
    },
  },
};

export const conversationEndpoints = {
  '/api/conversations': {
    get: {
      tags: ['Conversations'],
      summary: 'Listar conversas',
      description: 'Lista todas as conversas do tenant com filtros e paginação',
      operationId: 'listConversations',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 10 } },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING', 'CLOSED', 'ARCHIVED'] },
        },
        {
          name: 'hotelUnit',
          in: 'query',
          schema: { type: 'string', enum: ['Ilhabela', 'Campos do Jordão', 'Camburi', 'Santo Antônio do Pinhal', 'Santa Smart Hotel'] },
        },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Lista de conversas',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Conversations'],
      summary: 'Criar nova conversa',
      description: 'Cria uma nova conversa (normalmente via N8N)',
      operationId: 'createConversation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['contactPhoneNumber'],
              properties: {
                contactPhoneNumber: { type: 'string' },
                hotelUnit: { type: 'string' },
                status: { type: 'string', enum: ['BOT_HANDLING', 'OPEN', 'IN_PROGRESS', 'WAITING'] },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Conversa criada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Conversation' },
            },
          },
        },
      },
    },
  },
  '/api/conversations/{id}': {
    get: {
      tags: ['Conversations'],
      summary: 'Obter conversa por ID',
      operationId: 'getConversationById',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Dados da conversa',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Conversation' },
            },
          },
        },
        '404': { description: 'Conversa não encontrada' },
      },
    },
    patch: {
      tags: ['Conversations'],
      summary: 'Atualizar conversa',
      operationId: 'updateConversation',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                hotelUnit: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Conversa atualizada' },
        '404': { description: 'Conversa não encontrada' },
      },
    },
    delete: {
      tags: ['Conversations'],
      summary: 'Deletar conversa',
      operationId: 'deleteConversation',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Conversa deletada' },
        '404': { description: 'Conversa não encontrada' },
      },
    },
  },
  '/api/conversations/stats': {
    get: {
      tags: ['Conversations'],
      summary: 'Obter estatísticas de conversas',
      description: 'Retorna métricas: total, aberta, fechada, arquivada, etc',
      operationId: 'getConversationStats',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Estatísticas',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  open: { type: 'integer' },
                  botHandling: { type: 'integer' },
                  closed: { type: 'integer' },
                  archived: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/conversations/{id}/assign': {
    post: {
      tags: ['Conversations'],
      summary: 'Atribuir conversa a um atendente',
      operationId: 'assignConversation',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['assignedToId'],
              properties: {
                assignedToId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Conversa atribuída' },
        '404': { description: 'Conversa ou atendente não encontrado' },
      },
    },
  },
  '/api/conversations/{id}/unassign': {
    post: {
      tags: ['Conversations'],
      summary: 'Remover atribuição de conversa',
      operationId: 'unassignConversation',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Atribuição removida' },
        '404': { description: 'Conversa não encontrada' },
      },
    },
  },
  '/api/conversations/{id}/close': {
    post: {
      tags: ['Conversations'],
      summary: 'Fechar conversa',
      operationId: 'closeConversation',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Conversa fechada' },
        '404': { description: 'Conversa não encontrada' },
      },
    },
  },
  '/api/conversations/{id}/archive': {
    post: {
      tags: ['Conversations'],
      summary: 'Arquivar conversa',
      operationId: 'archiveConversation',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Conversa arquivada' },
        '404': { description: 'Conversa não encontrada' },
      },
    },
  },
  '/api/conversations/{id}/ia-lock': {
    patch: {
      tags: ['Conversations'],
      summary: 'Travar/destravar IA',
      description: 'Bloqueia ou desbloqueia respostas automáticas da IA para uma conversa',
      operationId: 'toggleIaLock',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['locked'],
              properties: {
                locked: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'IA lock atualizado' },
        '404': { description: 'Conversa não encontrada' },
      },
    },
  },
};

export const messageEndpoints = {
  '/api/conversations/{conversationId}/messages': {
    get: {
      tags: ['Messages'],
      summary: 'Listar mensagens de uma conversa',
      operationId: 'listMessages',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'conversationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 50 } },
      ],
      responses: {
        '200': {
          description: 'Lista de mensagens',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Messages'],
      summary: 'Enviar mensagem',
      description: 'Envia uma mensagem de texto ou mídia para uma conversa',
      operationId: 'sendMessage',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'conversationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['content'],
              properties: {
                content: { type: 'string' },
                type: { type: 'string', enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'] },
                mediaUrl: { type: 'string', format: 'uri' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Mensagem enviada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Message' },
            },
          },
        },
      },
    },
  },
  '/api/conversations/{conversationId}/messages/stats': {
    get: {
      tags: ['Messages'],
      summary: 'Estatísticas de mensagens',
      operationId: 'getMessageStats',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'conversationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Estatísticas',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  inbound: { type: 'integer' },
                  outbound: { type: 'integer' },
                  unread: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/messages/search': {
    get: {
      tags: ['Messages'],
      summary: 'Buscar mensagens globalmente',
      description: 'Busca mensagens em todas as conversas do tenant',
      operationId: 'searchMessages',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: {
        '200': {
          description: 'Resultados da busca',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
  },
};

export const contactEndpoints = {
  '/api/contacts': {
    get: {
      tags: ['Contacts'],
      summary: 'Listar contatos',
      operationId: 'listContacts',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Lista de contatos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Contacts'],
      summary: 'Criar contato',
      operationId: 'createContact',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phoneNumber', 'name'],
              properties: {
                phoneNumber: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Contato criado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Contact' },
            },
          },
        },
      },
    },
  },
  '/api/contacts/{id}': {
    get: {
      tags: ['Contacts'],
      summary: 'Obter contato por ID',
      operationId: 'getContactById',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Dados do contato',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Contact' },
            },
          },
        },
        '404': { description: 'Contato não encontrado' },
      },
    },
    patch: {
      tags: ['Contacts'],
      summary: 'Atualizar contato',
      operationId: 'updateContact',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Contato atualizado' },
        '404': { description: 'Contato não encontrado' },
      },
    },
    delete: {
      tags: ['Contacts'],
      summary: 'Deletar contato',
      operationId: 'deleteContact',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Contato deletado' },
        '404': { description: 'Contato não encontrado' },
      },
    },
  },
  '/api/contacts/phone/{phoneNumber}': {
    get: {
      tags: ['Contacts'],
      summary: 'Buscar contato por telefone',
      operationId: 'getContactByPhone',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'phoneNumber', in: 'path', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Dados do contato',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Contact' },
            },
          },
        },
        '404': { description: 'Contato não encontrado' },
      },
    },
  },
  '/api/contacts/stats': {
    get: {
      tags: ['Contacts'],
      summary: 'Estatísticas de contatos',
      operationId: 'getContactStats',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Estatísticas',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  active: { type: 'integer' },
                  inactive: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const tagEndpoints = {
  '/api/tags': {
    get: {
      tags: ['Tags'],
      summary: 'Listar tags',
      operationId: 'listTags',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'search', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Lista de tags',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Tags'],
      summary: 'Criar tag',
      operationId: 'createTag',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'color'],
              properties: {
                name: { type: 'string' },
                color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Tag criada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Tag' },
            },
          },
        },
      },
    },
  },
  '/api/tags/{id}': {
    get: {
      tags: ['Tags'],
      summary: 'Obter tag por ID',
      operationId: 'getTagById',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Dados da tag',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Tag' },
            },
          },
        },
        '404': { description: 'Tag não encontrada' },
      },
    },
    patch: {
      tags: ['Tags'],
      summary: 'Atualizar tag',
      operationId: 'updateTag',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Tag atualizada' },
        '404': { description: 'Tag não encontrada' },
      },
    },
    delete: {
      tags: ['Tags'],
      summary: 'Deletar tag',
      operationId: 'deleteTag',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Tag deletada' },
        '404': { description: 'Tag não encontrada' },
      },
    },
  },
  '/api/tags/conversation': {
    post: {
      tags: ['Tags'],
      summary: 'Adicionar tag a conversa',
      operationId: 'addTagToConversation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['tagId', 'conversationId'],
              properties: {
                tagId: { type: 'string', format: 'uuid' },
                conversationId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Tag adicionada à conversa' },
        '404': { description: 'Tag ou conversa não encontrada' },
      },
    },
    delete: {
      tags: ['Tags'],
      summary: 'Remover tag de conversa',
      operationId: 'removeTagFromConversation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['tagId', 'conversationId'],
              properties: {
                tagId: { type: 'string', format: 'uuid' },
                conversationId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Tag removida da conversa' },
        '404': { description: 'Tag ou conversa não encontrada' },
      },
    },
  },
};

export const reportEndpoints = {
  '/api/reports/overview': {
    get: {
      tags: ['Reports'],
      summary: 'Relatório geral',
      description: 'Métricas gerais: conversas, mensagens, satisfação, etc',
      operationId: 'getReportOverview',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: {
        '200': {
          description: 'Overview do período',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  totalConversations: { type: 'integer' },
                  totalMessages: { type: 'integer' },
                  averageResponseTime: { type: 'number' },
                  satisfactionScore: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/reports/attendants': {
    get: {
      tags: ['Reports'],
      summary: 'Performance por atendente',
      description: 'Métricas de cada atendente: conversas, mensagens, tempo médio, etc',
      operationId: 'getAttendantsPerformance',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: {
        '200': {
          description: 'Performance de atendentes',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
  },
  '/api/reports/hourly': {
    get: {
      tags: ['Reports'],
      summary: 'Volume por hora',
      description: 'Quantidade de mensagens agrupadas por hora do dia',
      operationId: 'getHourlyVolume',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: {
        '200': {
          description: 'Volume por hora',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    hour: { type: 'integer' },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const escalationEndpoints = {
  '/api/escalations': {
    get: {
      tags: ['Escalations'],
      summary: 'Listar escalações',
      operationId: 'listEscalations',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'ASSIGNED', 'RESOLVED', 'CLOSED'] } },
      ],
      responses: {
        '200': {
          description: 'Lista de escalações',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
    post: {
      tags: ['Escalations'],
      summary: 'Criar escalação',
      operationId: 'createEscalation',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['contactPhoneNumber', 'reason'],
              properties: {
                contactPhoneNumber: { type: 'string' },
                reason: { type: 'string', enum: ['USER_REQUESTED', 'BOT_UNABLE', 'NEED_HUMAN', 'OTHER'] },
                reasonDetail: { type: 'string' },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'Escalação criada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Escalation' },
            },
          },
        },
      },
    },
  },
  '/api/escalations/{id}': {
    get: {
      tags: ['Escalations'],
      summary: 'Obter escalação por ID',
      operationId: 'getEscalationById',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Dados da escalação',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Escalation' },
            },
          },
        },
        '404': { description: 'Escalação não encontrada' },
      },
    },
    patch: {
      tags: ['Escalations'],
      summary: 'Atualizar escalação',
      operationId: 'updateEscalation',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['PENDING', 'ASSIGNED', 'RESOLVED', 'CLOSED'] },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Escalação atualizada' },
        '404': { description: 'Escalação não encontrada' },
      },
    },
  },
  '/api/escalations/stats': {
    get: {
      tags: ['Escalations'],
      summary: 'Estatísticas de escalações',
      operationId: 'getEscalationStats',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Estatísticas',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  pending: { type: 'integer' },
                  assigned: { type: 'integer' },
                  resolved: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/escalations/check-ia-lock': {
    get: {
      tags: ['Escalations'],
      summary: 'Verificar se IA está travada',
      operationId: 'checkIaLock',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'phone', in: 'query', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Status do IA lock',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  locked: { type: 'boolean' },
                  conversationId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const n8nEndpoints = {
  '/api/n8n/send-text': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar mensagem de texto',
      description: 'Envia mensagem de texto simples via WhatsApp (compatível com Z-API)',
      operationId: 'sendText',
      security: [{ ApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone', 'message'],
              properties: {
                phone: {
                  type: 'string',
                  description: 'Número do telefone (5511999999999)',
                },
                message: {
                  type: 'string',
                  description: 'Conteúdo da mensagem',
                },
                delayTyping: {
                  type: 'number',
                  description: 'Tempo de digitação (ignorado)',
                },
              },
            },
            examples: {
              success: {
                value: {
                  phone: '5511987654321',
                  message: 'Olá! Como posso ajudar?',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Mensagem enviada com sucesso',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  messageId: { type: 'string' },
                  botReservaResponse: {
                    type: 'object',
                    properties: {
                      messageId: { type: 'string' },
                      id: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        '400': { description: 'Dados inválidos' },
        '500': { description: 'Erro ao enviar mensagem' },
      },
    },
  },
  '/api/n8n/send-buttons': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar mensagem com botões',
      description: 'Envia mensagem com até 3 botões interativos',
      operationId: 'sendButtons',
      security: [{ ApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone', 'message', 'buttons'],
              properties: {
                phone: { type: 'string' },
                message: { type: 'string' },
                buttons: {
                  type: 'array',
                  maxItems: 3,
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                    },
                  },
                },
                title: { type: 'string' },
                footer: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Botões enviados' },
        '400': { description: 'Dados inválidos ou mais de 3 botões' },
      },
    },
  },
  '/api/n8n/send-list': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar lista de opções',
      description: 'Envia menu com lista de até 10 opções',
      operationId: 'sendList',
      security: [{ ApiKey: [] }],
      responses: {
        '200': { description: 'Lista enviada' },
        '400': { description: 'Dados inválidos' },
      },
    },
  },
  '/api/n8n/send-media': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar mídia',
      description: 'Envia imagem, vídeo, áudio ou documento',
      operationId: 'sendMedia',
      security: [{ ApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone'],
              properties: {
                phone: { type: 'string' },
                type: { type: 'string', enum: ['image', 'video', 'audio', 'document'] },
                url: { type: 'string', format: 'uri' },
                caption: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Mídia enviada' },
        '400': { description: 'Dados inválidos' },
      },
    },
  },
  '/api/n8n/send-template': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar template aprovado',
      description: 'Envia template pré-aprovado pela Meta',
      operationId: 'sendTemplate',
      security: [{ ApiKey: [] }],
      responses: {
        '200': { description: 'Template enviado' },
        '400': { description: 'Template não encontrado' },
      },
    },
  },
  '/api/n8n/send-carousel': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar carousel',
      description: 'Envia carousel com até 10 cards (modo template) ou interativo',
      operationId: 'sendCarousel',
      security: [{ ApiKey: [] }],
      responses: {
        '200': { description: 'Carousel enviado' },
        '400': { description: 'Dados inválidos' },
      },
    },
  },
  '/api/n8n/send-flow': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar WhatsApp Flow',
      description: 'Envia formulário interativo nativo do WhatsApp',
      operationId: 'sendFlow',
      security: [{ ApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phoneNumber', 'flowId', 'flowToken', 'ctaText'],
              properties: {
                phoneNumber: { type: 'string' },
                flowId: { type: 'string', format: 'uuid' },
                flowToken: { type: 'string' },
                ctaText: { type: 'string', maxLength: 20 },
                headerText: { type: 'string', maxLength: 60 },
                bodyText: { type: 'string', maxLength: 1024 },
                conversationId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Flow enviado' },
        '400': { description: 'Dados inválidos' },
      },
    },
  },
  '/api/n8n/send-booking-flow': {
    post: {
      tags: ['N8N'],
      summary: 'Enviar Flow de Orçamento',
      description: 'Envia formulário de orçamento de hospedagem',
      operationId: 'sendBookingFlow',
      security: [{ ApiKey: [] }],
      responses: {
        '200': { description: 'Flow de orçamento enviado' },
        '400': { description: 'Dados inválidos' },
      },
    },
  },
  '/api/n8n/check-availability': {
    get: {
      tags: ['N8N'],
      summary: 'Verificar disponibilidade de quartos',
      description: 'Consulta HBook para verificar quartos disponíveis',
      operationId: 'checkAvailability',
      security: [{ ApiKey: [] }],
      parameters: [
        { name: 'unidade', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'checkin', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'checkout', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'adults', in: 'query', required: true, schema: { type: 'integer' } },
        { name: 'children', in: 'query', schema: { type: 'integer' } },
      ],
      responses: {
        '200': {
          description: 'Disponibilidade obtida',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  unidade: { type: 'string' },
                  checkin: { type: 'string' },
                  checkout: { type: 'string' },
                  rooms: { type: 'array' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/n8n/check-room-availability': {
    get: {
      tags: ['N8N'],
      summary: 'Verificar quarto específico',
      description: 'Verifica se um quarto está disponível',
      operationId: 'checkRoomAvailability',
      security: [{ ApiKey: [] }],
      parameters: [
        { name: 'unidade', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'roomName', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'checkin', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'checkout', in: 'query', required: true, schema: { type: 'string' } },
        { name: 'adults', in: 'query', required: true, schema: { type: 'integer' } },
      ],
      responses: {
        '200': {
          description: 'Disponibilidade do quarto',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  available: { type: 'boolean' },
                  room: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/n8n/check-ia-lock': {
    get: {
      tags: ['N8N'],
      summary: 'Verificar IA lock',
      description: 'Verifica se IA está travada para um telefone',
      operationId: 'checkIaLockN8N',
      security: [{ ApiKey: [] }],
      parameters: [
        { name: 'phone', in: 'query', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '200': {
          description: 'Status do IA lock',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  locked: { type: 'boolean' },
                  conversationId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/n8n/escalate': {
    post: {
      tags: ['N8N'],
      summary: 'Criar escalação',
      description: 'Transfere conversa para humano',
      operationId: 'escalateN8N',
      security: [{ ApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone', 'reason'],
              properties: {
                phone: { type: 'string' },
                reason: { type: 'string', enum: ['USER_REQUESTED', 'BOT_UNABLE', 'NEED_HUMAN', 'OTHER'] },
                reasonDetail: { type: 'string' },
                priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Escalação criada' },
        '400': { description: 'Dados inválidos' },
      },
    },
  },
  '/api/n8n/mark-read': {
    post: {
      tags: ['N8N'],
      summary: 'Marcar mensagem como lida',
      operationId: 'markRead',
      security: [{ ApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['messageId'],
              properties: {
                messageId: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Marcado como lido' },
      },
    },
  },
  '/api/n8n/set-hotel-unit': {
    post: {
      tags: ['N8N'],
      summary: 'Definir unidade hoteleira',
      description: 'Define a unidade hoteleira de uma conversa',
      operationId: 'setHotelUnit',
      security: [{ ApiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['phone', 'hotelUnit'],
              properties: {
                phone: { type: 'string' },
                hotelUnit: {
                  type: 'string',
                  enum: ['Ilhabela', 'Campos do Jordão', 'Camburi', 'Santo Antônio do Pinhal', 'Santa Smart Hotel'],
                },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Unidade hoteleira definida' },
      },
    },
  },
  '/api/n8n/mark-followup-sent': {
    post: {
      tags: ['N8N'],
      summary: 'Marcar follow-up como enviado',
      description: 'Marca conversa como oportunidade para o time de vendas',
      operationId: 'markFollowupSent',
      security: [{ ApiKey: [] }],
      responses: {
        '200': { description: 'Follow-up marcado como enviado' },
      },
    },
  },
  '/api/n8n/mark-opportunity': {
    post: {
      tags: ['N8N'],
      summary: 'Marcar como oportunidade',
      description: 'Atualiza motivo da oportunidade de venda',
      operationId: 'markOpportunity',
      security: [{ ApiKey: [] }],
      responses: {
        '200': { description: 'Oportunidade marcada' },
      },
    },
  },
};

export const auditLogEndpoints = {
  '/api/audit-logs': {
    get: {
      tags: ['AuditLogs'],
      summary: 'Listar audit logs',
      operationId: 'listAuditLogs',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'action', in: 'query', schema: { type: 'string' } },
        { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': {
          description: 'Lista de audit logs',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
  },
  '/api/audit-logs/{id}': {
    get: {
      tags: ['AuditLogs'],
      summary: 'Obter audit log por ID',
      operationId: 'getAuditLogById',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Dados do audit log' },
        '404': { description: 'Audit log não encontrado' },
      },
    },
  },
};

export const usageTrackingEndpoints = {
  '/api/usage-tracking': {
    get: {
      tags: ['UsageTracking'],
      summary: 'Listar uso de recursos',
      operationId: 'listUsageTracking',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
        { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
      ],
      responses: {
        '200': {
          description: 'Métricas de uso',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
  },
  '/api/usage-tracking/current': {
    get: {
      tags: ['UsageTracking'],
      summary: 'Uso do mês atual',
      operationId: 'getCurrentUsage',
      security: [{ BearerAuth: [] }],
      responses: {
        '200': {
          description: 'Uso do mês atual',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  messagesCount: { type: 'integer' },
                  conversationsCount: { type: 'integer' },
                  apiCallsCount: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const webhookEventEndpoints = {
  '/api/webhook-events': {
    get: {
      tags: ['WebhookEvents'],
      summary: 'Listar webhook events',
      operationId: 'listWebhookEvents',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        { name: 'take', in: 'query', schema: { type: 'integer', default: 10 } },
        { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED'] } },
      ],
      responses: {
        '200': {
          description: 'Lista de webhook events',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PaginatedResponse' },
            },
          },
        },
      },
    },
  },
  '/api/webhook-events/{id}': {
    get: {
      tags: ['WebhookEvents'],
      summary: 'Obter webhook event por ID',
      operationId: 'getWebhookEventById',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Dados do webhook event' },
        '404': { description: 'Webhook event não encontrado' },
      },
    },
    delete: {
      tags: ['WebhookEvents'],
      summary: 'Deletar webhook event',
      operationId: 'deleteWebhookEvent',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Webhook event deletado' },
        '404': { description: 'Webhook event não encontrado' },
      },
    },
  },
  '/api/webhook-events/{id}/replay': {
    post: {
      tags: ['WebhookEvents'],
      summary: 'Reprocessar webhook event',
      operationId: 'replayWebhookEvent',
      security: [{ BearerAuth: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        '200': { description: 'Webhook event reprocessado' },
        '404': { description: 'Webhook event não encontrado' },
      },
    },
  },
};
