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

/** Unidades validas (nomes de exibicao) */
export const VALID_HOTEL_UNITS = [
  'Ilhabela',
  'Campos do Jordao',
  'Camburi',
  'Santo Antonio do Pinhal',
  'Santa Smart Hotel',
];

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
  /** Timeout geral do processamento EVA (ms) */
  PROCESSING_TIMEOUT_MS: 10_000,
  /** Temperature padrao */
  TEMPERATURE: 0.7,
};

/** Cupon e links */
export const CUPON_DESCONTO = 'BOT005';
export const SITE_EMPRESA = 'https://hoteisreserva.com.br/';

/** Mapeamento de templates de carousel por quantidade de cards */
export const CAROUSEL_TEMPLATE_MAP: Record<number, string> = {
  1: 'carousel_acomodacoes_1card',
  2: 'carousel_acomodacoes_2cards',
  3: 'carousel_acomodacoes_3cards',
  4: 'carousel_acomodacoes_4cards',
  5: 'carousel_acomodacoes_5cards',
  6: 'carousel_acomodacoes_6cards',
  7: 'carousel_fotos_acomodacoes_7cards',
  8: 'carousel_fotos_acomodacoes_8cards',
  9: 'carousel_fotos_acomodacoes_9cards',
  10: 'carousel_acomodacoes_10cards',
};
