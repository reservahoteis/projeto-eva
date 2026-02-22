// ============================================
// EVA Tool Definitions
// OpenAI Function Calling schemas
// ============================================

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Tool definitions para o OpenAI Function Calling.
 * Cada tool tem: name, description, parameters (JSON Schema).
 */
export const EVA_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_quartos',
      description:
        'Busca informacoes sobre tipos de quartos disponiveis em uma unidade hoteleira. ' +
        'Retorna nome, categoria, descricao, capacidade e imagens dos quartos.',
      parameters: {
        type: 'object',
        properties: {
          unidade: {
            type: 'string',
            description: 'Nome da unidade (ex: ILHABELA, CAMPOS, CAMBURI, SANTO ANTONIO, SANTA)',
          },
        },
        required: ['unidade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_faq',
      description:
        'Busca respostas em perguntas frequentes (FAQ) sobre uma unidade hoteleira. ' +
        'Inclui informacoes sobre check-in, estrutura, suites, alimentacao, lazer e reservas.',
      parameters: {
        type: 'object',
        properties: {
          unidade: {
            type: 'string',
            description: 'Nome da unidade',
          },
          categoria: {
            type: 'string',
            description: 'Categoria do FAQ (opcional): checkin, acesso, suite, alimentacao, lazer, localizacao, reservas',
          },
        },
        required: ['unidade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_servicos',
      description:
        'Busca servicos disponiveis em uma unidade (spa, yoga, massagem, restaurante, etc).',
      parameters: {
        type: 'object',
        properties: {
          unidade: {
            type: 'string',
            description: 'Nome da unidade',
          },
        },
        required: ['unidade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_concierge',
      description:
        'Busca indicacoes de restaurantes, passeios e pontos turisticos proximos da unidade.',
      parameters: {
        type: 'object',
        properties: {
          unidade: {
            type: 'string',
            description: 'Nome da unidade',
          },
        },
        required: ['unidade'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description:
        'Verifica a disponibilidade de quartos em uma unidade para datas especificas. ' +
        'Retorna quartos disponiveis com precos.',
      parameters: {
        type: 'object',
        properties: {
          unidade: {
            type: 'string',
            description: 'Nome da unidade',
          },
          checkin: {
            type: 'string',
            description: 'Data de check-in no formato DD/MM/YYYY',
          },
          checkout: {
            type: 'string',
            description: 'Data de check-out no formato DD/MM/YYYY',
          },
          adults: {
            type: 'number',
            description: 'Numero de adultos',
          },
          children: {
            type: 'number',
            description: 'Numero de criancas (opcional)',
          },
          childrenAges: {
            type: 'string',
            description: 'Idades das criancas separadas por virgula (ex: "5,8")',
          },
        },
        required: ['unidade', 'checkin', 'checkout', 'adults'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'notificar_atendente',
      description:
        'Notifica um atendente humano para assumir a conversa. ' +
        'Use quando o cliente pede explicitamente para falar com humano ou quando voce nao consegue resolver.',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            description: 'Motivo da escalacao (ex: "cliente solicitou atendente humano", "duvida complexa")',
          },
        },
        required: ['motivo'],
      },
    },
  },
];

/** Nomes das tools para lookup rapido */
export type EvaToolName =
  | 'buscar_quartos'
  | 'buscar_faq'
  | 'buscar_servicos'
  | 'buscar_concierge'
  | 'check_availability'
  | 'notificar_atendente';
