// ============================================
// EVA Tool Handlers
// Execute functions called by OpenAI
// ============================================

import { prisma } from '@/config/database';
import { hbookScraperService } from '@/services/hbook-scraper.service';
import logger from '@/config/logger';
import { FAQ_CATEGORIES } from '../config/eva.constants';
import type { EvaToolName } from './tool-definitions';

/** Categorias permitidas para FAQ (previne SQL abuse via LIKE) */
const FAQ_ALLOWED_CATEGORIES = FAQ_CATEGORIES.map((c) => c.id.replace('cat_', ''));

/** Formato de data DD/MM/YYYY */
const DATE_FORMAT_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

// ============================================
// KB Database Connection
// ============================================

/**
 * Executa query no banco de dados do Knowledge Base.
 * Se KB_DATABASE_URL estiver definida, chama via HTTP interno.
 * Senao, usa Prisma raw query no mesmo banco.
 */
async function queryKB(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  // Usa Prisma raw query (as tabelas de KB devem existir no mesmo banco)
  return prisma.$queryRawUnsafe(sql, ...params) as Promise<Record<string, unknown>[]>;
}

// ============================================
// Tool Handler Registry
// ============================================

interface ToolContext {
  tenantId: string;
  conversationId: string;
  contactId: string;
  senderId: string;
  channel: string;
}

type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;

const handlers: Record<EvaToolName, ToolHandler> = {
  buscar_quartos: handleBuscarQuartos,
  buscar_faq: handleBuscarFaq,
  buscar_servicos: handleBuscarServicos,
  buscar_concierge: handleBuscarConcierge,
  check_availability: handleCheckAvailability,
  notificar_atendente: handleNotificarAtendente,
};

/**
 * Executa um tool handler pelo nome.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const handler = handlers[toolName as EvaToolName];
  if (!handler) {
    logger.warn({ toolName }, '[EVA TOOLS] Unknown tool called');
    return JSON.stringify({ error: `Tool desconhecida: ${toolName}` });
  }

  const start = Date.now();
  try {
    const result = await handler(args, ctx);
    logger.info(
      { toolName, durationMs: Date.now() - start, argsPreview: JSON.stringify(args).substring(0, 100) },
      '[EVA TOOLS] Tool executed'
    );
    return result;
  } catch (err) {
    logger.error(
      { toolName, err: err instanceof Error ? err.message : 'Unknown', durationMs: Date.now() - start },
      '[EVA TOOLS] Tool execution failed'
    );
    return JSON.stringify({ error: 'Nao foi possivel buscar as informacoes no momento.' });
  }
}

// ============================================
// Individual Handlers
// ============================================

async function handleBuscarQuartos(args: Record<string, unknown>): Promise<string> {
  const unidade = String(args.unidade || '').toUpperCase();
  if (!unidade) return JSON.stringify({ error: 'Unidade nao informada' });

  const rows = await queryKB(
    `SELECT "Tipo", "Categoria", "Capacidade", "Descricao", "linkImage"
     FROM infos_quartos
     WHERE UPPER("Unidade") = $1
     ORDER BY "Categoria"`,
    [unidade]
  );

  if (rows.length === 0) {
    return JSON.stringify({ message: `Nenhum quarto encontrado para a unidade ${unidade}` });
  }

  return JSON.stringify({
    unidade,
    quartos: rows.map((r) => ({
      tipo: r.Tipo,
      categoria: r.Categoria,
      capacidade: r.Capacidade,
      descricao: r.Descricao,
      imagem: r.linkImage,
    })),
  });
}

async function handleBuscarFaq(args: Record<string, unknown>): Promise<string> {
  const unidade = String(args.unidade || '').toUpperCase();
  if (!unidade) return JSON.stringify({ error: 'Unidade nao informada' });

  // Validar categoria contra allowlist (previne SQL abuse via LIKE)
  const categoriaRaw = args.categoria ? String(args.categoria).toLowerCase().trim() : null;
  const categoria = categoriaRaw && FAQ_ALLOWED_CATEGORIES.includes(categoriaRaw)
    ? categoriaRaw
    : null;

  // Buscar FAQ comercial + FAQ hospede em paralelo
  let sql = `SELECT "Pergunta", "Resposta", "Categoria"
     FROM infos_faq
     WHERE UPPER("Unidade") = $1`;
  const params: unknown[] = [unidade];

  if (categoria) {
    sql += ` AND LOWER("Categoria") LIKE $2`;
    params.push(`%${categoria}%`);
  }

  sql += ' LIMIT 20';

  const [comercial, hospede] = await Promise.all([
    queryKB(sql, params),
    queryKB(
      `SELECT "Pergunta", "Resposta", "Categoria"
       FROM infos_faq_hospede
       WHERE UPPER("Unidade") = $1
       LIMIT 20`,
      [unidade]
    ),
  ]);

  const allFaqs = [
    ...comercial.map((r) => ({ tipo: 'comercial', pergunta: r.Pergunta, resposta: r.Resposta, categoria: r.Categoria })),
    ...hospede.map((r) => ({ tipo: 'hospede', pergunta: r.Pergunta, resposta: r.Resposta, categoria: r.Categoria })),
  ];

  if (allFaqs.length === 0) {
    return JSON.stringify({ message: `Nenhuma FAQ encontrada para ${unidade}` });
  }

  return JSON.stringify({ unidade, faqs: allFaqs });
}

async function handleBuscarServicos(args: Record<string, unknown>): Promise<string> {
  const unidade = String(args.unidade || '').toUpperCase();
  if (!unidade) return JSON.stringify({ error: 'Unidade nao informada' });

  const rows = await queryKB(
    `SELECT "Nome", "Descricao", "Horario", "Preco"
     FROM infos_servicos
     WHERE UPPER("Unidade") = $1
     ORDER BY "Nome"`,
    [unidade]
  );

  if (rows.length === 0) {
    return JSON.stringify({ message: `Nenhum servico encontrado para ${unidade}` });
  }

  return JSON.stringify({
    unidade,
    servicos: rows.map((r) => ({
      nome: r.Nome,
      descricao: r.Descricao,
      horario: r.Horario,
      preco: r.Preco,
    })),
  });
}

async function handleBuscarConcierge(args: Record<string, unknown>): Promise<string> {
  const unidade = String(args.unidade || '').toUpperCase();
  if (!unidade) return JSON.stringify({ error: 'Unidade nao informada' });

  const rows = await queryKB(
    `SELECT "Nome", "Tipo", "Descricao", "Endereco", "Telefone"
     FROM infos_concierge
     WHERE UPPER("Unidade") = $1
     ORDER BY "Tipo", "Nome"`,
    [unidade]
  );

  if (rows.length === 0) {
    return JSON.stringify({ message: `Nenhuma indicacao encontrada para ${unidade}` });
  }

  return JSON.stringify({
    unidade,
    indicacoes: rows.map((r) => ({
      nome: r.Nome,
      tipo: r.Tipo,
      descricao: r.Descricao,
      endereco: r.Endereco,
      telefone: r.Telefone,
    })),
  });
}

async function handleCheckAvailability(args: Record<string, unknown>): Promise<string> {
  const unidade = String(args.unidade || '');
  const checkin = String(args.checkin || '');
  const checkout = String(args.checkout || '');
  const adults = Number(args.adults) || 2;
  const children = args.children ? Number(args.children) : undefined;
  const childrenAges = args.childrenAges
    ? String(args.childrenAges).split(',').map((a) => parseInt(a.trim(), 10)).filter((a) => !isNaN(a))
    : undefined;

  if (!unidade || !checkin || !checkout) {
    return JSON.stringify({ error: 'Informe unidade, checkin e checkout' });
  }

  // Validar formato de data DD/MM/YYYY
  if (!DATE_FORMAT_REGEX.test(checkin) || !DATE_FORMAT_REGEX.test(checkout)) {
    return JSON.stringify({ error: 'Datas devem estar no formato DD/MM/YYYY' });
  }

  const result = await hbookScraperService.checkAvailability(
    unidade,
    checkin,
    checkout,
    adults,
    children,
    childrenAges
  );

  if (!result.success) {
    return JSON.stringify({
      disponivel: false,
      message: result.error || 'Nao foi possivel verificar disponibilidade',
    });
  }

  const disponiveis = result.rooms.filter((r) => r.available && (r.price ?? 0) > 0);

  if (disponiveis.length === 0) {
    return JSON.stringify({
      disponivel: false,
      message: 'Infelizmente nao ha quartos disponiveis para as datas selecionadas.',
    });
  }

  return JSON.stringify({
    disponivel: true,
    unidade: result.unidade,
    checkin: result.checkin,
    checkout: result.checkout,
    quartos: disponiveis.map((r) => ({
      nome: r.name,
      preco: r.price,
      precoOriginal: r.originalPrice,
    })),
  });
}

async function handleNotificarAtendente(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const motivo = String(args.motivo || 'Solicitado pelo cliente');

  // Marcar iaLocked e criar escalacao
  await prisma.conversation.update({
    where: { id: ctx.conversationId, tenantId: ctx.tenantId },
    data: { iaLocked: true },
  });

  // Criar registro de escalacao
  await prisma.escalation.create({
    data: {
      tenantId: ctx.tenantId,
      conversationId: ctx.conversationId,
      reason: 'USER_REQUESTED',
      reasonDetail: motivo,
      status: 'PENDING',
    },
  });

  logger.info(
    { tenantId: ctx.tenantId, conversationId: ctx.conversationId, motivo },
    '[EVA TOOLS] Escalacao criada, iaLocked=true'
  );

  return JSON.stringify({
    success: true,
    message: 'Atendente notificado. A IA foi pausada para esta conversa.',
  });
}
