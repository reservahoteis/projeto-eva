// ============================================
// EVA Constants
// Extracted from N8N workflows
// ============================================

/** Mapeamento de selectedRowId -> nome da unidade */
export const UNIDADES_MAP: Record<string, string> = {
  info_ilhabela: 'ILHABELA',
  info_campos: 'CAMPOS',
  info_camburi: 'CAMBURI',
  info_santo_antonio: 'SANTO ANTONIO',
  info_santa: 'SANTA',
};

/** HBook companyId por unidade (para links de reserva) */
export const HBOOK_COMPANY_IDS: Record<string, string> = {
  CAMPOS: '67bcbe2ca5788fa175aa8b38',
  ILHABELA: '5f15f591ab41d43ac0fed67e',
  CAMBURI: '6750b19f496b9fcb0e105ccb',
  'SANTO ANTONIO': '662ff573ca37a716229fe257',
  SANTA: '59f07097c19a3b1a60c6d113',
};

/** Telefone de atendimento por unidade */
export const TELEFONES_UNIDADES: Record<string, string> = {
  CAMPOS: '5511915525443',
  ILHABELA: '5511910086172',
  CAMBURI: '5512991842900',
  'SANTO ANTONIO': '5511934156466',
  SANTA: '5512997593803',
};

/** Aliases de unidades para deteccao */
export const HOTEL_UNIT_ALIASES: Record<string, string> = {
  ilha_bela: 'Ilhabela',
  ilhabela: 'Ilhabela',
  campos_jordao: 'Campos do Jordao',
  camposdojordao: 'Campos do Jordao',
  'campos do jordao': 'Campos do Jordao',
  camburi: 'Camburi',
  santo_antonio: 'Santo Antonio do Pinhal',
  santoantonio: 'Santo Antonio do Pinhal',
  'santo antonio': 'Santo Antonio do Pinhal',
  santo_antonio_pinhal: 'Santo Antonio do Pinhal',
  santa_smart: 'Santa Smart Hotel',
  santasmart: 'Santa Smart Hotel',
  santa_smart_hotel: 'Santa Smart Hotel',
  // NOTE: "st" and "santa" removed — too many false positives
  // ("estacionamento", "restaurante", "santa catarina", etc.)
};

/** Mapeamento canonico: DB key → nome de exibicao (single source of truth) */
export const UNIT_DISPLAY_NAMES: Record<string, string> = {
  ILHABELA: 'Ilhabela',
  CAMPOS: 'Campos do Jordao',
  CAMBURI: 'Camburi',
  'SANTO ANTONIO': 'Santo Antonio do Pinhal',
  SANTA: 'Santa Smart Hotel',
};

/** Unidades validas (nomes de exibicao) — derivado de UNIT_DISPLAY_NAMES */
export const VALID_HOTEL_UNITS = Object.values(UNIT_DISPLAY_NAMES);

/** Keywords que indicam pedido de atendente humano */
export const HUMAN_REQUEST_KEYWORDS = [
  'humano',
  'atendente',
  'vendedor',
  'pessoa',
  'falar com alguem',
  'falar com alguém',
  'quero falar',
  'atendimento humano',
  'pessoa real',
  'falar com uma pessoa',
  'quero atendente',
  'me transfere',
  'transferir',
  'operador',
  'falar com gente',
];

/** Horario de atendimento humano (BRT) */
export const BUSINESS_HOURS = { start: 10, end: 18 };

/** Prefixos validos de FAQ por unidade */
export const FAQ_VALID_PREFIXES = ['IL', 'CJ', 'CB', 'SA', 'ST'];

/** Categorias do menu FAQ */
export const FAQ_CATEGORIES = [
  { id: 'cat_checkin', title: 'Check-in e Check-out' },
  { id: 'cat_acesso', title: 'Acesso e Estrutura' },
  { id: 'cat_suite', title: 'Suite e Comodidades' },
  { id: 'cat_alimentacao', title: 'Alimentacao' },
  { id: 'cat_lazer', title: 'Lazer e Bem-estar' },
  { id: 'cat_localizacao', title: 'Localizacao' },
  { id: 'cat_reservas', title: 'Reservas e Outros' },
];

/** Prefixos Redis de sessao */
export const REDIS_PREFIX = {
  EVA_MEMORY: 'eva:memory:', // eva:memory:{conversationId}
  EVA_UNIT: 'eva:unit:',     // eva:unit:{conversationId}
};

/** Configuracoes da IA */
export const EVA_CONFIG = {
  /** Modelo para agente comercial */
  COMMERCIAL_MODEL: 'gpt-4.1-mini' as const,
  /** Modelo para agente hospede e fallbacks */
  GUEST_MODEL: 'gpt-4o' as const,
  /** Max mensagens na sliding window */
  MEMORY_MAX_MESSAGES: 15,
  /** TTL da memoria em Redis (24h) */
  MEMORY_TTL_SECONDS: 86_400,
  /** Max iteracoes de tool calling */
  MAX_TOOL_ITERATIONS: 3,
  /** Timeout geral do processamento EVA (ms) — 25s para 3 iteracoes de tool calling */
  PROCESSING_TIMEOUT_MS: 25_000,
  /** Temperature padrao */
  TEMPERATURE: 0.7,
};

/** Cupon e links */
export const CUPON_DESCONTO = 'BOT005';
export const SITE_EMPRESA = 'https://hoteisreserva.com.br/';

// ============================================
// Interactive Menu Constants
// Replicate N8N interactive elements
// ============================================

import type { ListSection, QuickReplyPayload } from '@/services/channels/channel-send.interface';

/** Secoes da lista de selecao de unidades (replicando N8N) */
export const UNIT_SELECTION_SECTIONS: ListSection[] = [
  {
    title: 'Unidades',
    rows: [
      { id: 'info_ilhabela', title: 'Ilhabela' },
      { id: 'info_campos', title: 'Campos do Jordao' },
      { id: 'info_camburi', title: 'Camburi' },
      { id: 'info_santo_antonio', title: 'Santo Antonio' },
      { id: 'info_santa', title: 'Santa Smart Hotel' },
    ],
  },
];

/** Menu principal apos selecao de unidade (lista interativa — replica N8N) */
export const MAIN_MENU_SECTIONS: ListSection[] = [
  {
    title: 'Menu Principal',
    rows: [
      { id: 'duvidas_frequentes', title: 'Duvidas Frequentes' },
      { id: 'hospedado_ajuda', title: 'Ja Estou Hospedado' },
      { id: 'orcar_reserva', title: 'Quero Orcar' },
      { id: 'tenho_reserva', title: 'Ja Tenho Reserva' },
      { id: 'alterar_unidade', title: 'Alterar Unidade' },
    ],
  },
];
export const MAIN_MENU_BODY_TEXT = 'Selecione uma opcao:';
export const MAIN_MENU_BUTTON_TEXT = 'Ver opcoes';

/** Quick Replies contextuais (apos resposta da IA) */
export const CONTEXTUAL_QUICK_REPLIES: QuickReplyPayload[] = [
  { title: 'Menu principal', payload: 'menu_principal' },
  { title: 'Falar c/ atendente', payload: 'falar_humano' },
];

/** Quick Replies de categorias FAQ */
export const FAQ_CATEGORY_QUICK_REPLIES: QuickReplyPayload[] = FAQ_CATEGORIES.map((cat) => ({
  title: cat.title.substring(0, 20),
  payload: cat.id,
}));

/** Texto de boas-vindas (primeira mensagem sem unidade) */
export const WELCOME_TEXT =
  'Ola! Eu sou a Eva, assistente virtual da Smart Hoteis Reserva. ' +
  'Estou aqui para ajudar voce a encontrar a hospedagem perfeita!';

/** Texto do botao da lista de unidades */
export const UNIT_LIST_BODY_TEXT = 'Qual unidade voce gostaria de conhecer?';
export const UNIT_LIST_BUTTON_TEXT = 'Ver unidades';
