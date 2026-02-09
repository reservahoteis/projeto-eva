import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import logger from '@/config/logger';
import type { ListWebhookEventsQuery } from '@/validators/webhook-event.validator';

interface CreateWebhookEventInput {
  tenantId?: string | null;
  source: string;
  event: string;
  payload: Prisma.InputJsonValue;
}

export class WebhookEventService {
  /**
   * Listar webhook events com filtros e paginacao
   */
  async list(tenantId: string | null, query: ListWebhookEventsQuery) {
    const { page, limit, source, event, processed, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // SUPER_ADMIN ve todos; ADMIN ve so do tenant
    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (source) where.source = source;
    if (event) where.event = event;
    if (processed !== undefined) where.processed = processed === 'true';

    if (startDate || endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          source: true,
          event: true,
          processed: true,
          processedAt: true,
          error: true,
          createdAt: true,
        },
      }),
      prisma.webhookEvent.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Buscar webhook event por ID com payload completo
   */
  async getById(id: string, tenantId: string | null) {
    const where: { id: string; tenantId?: string } = { id };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const webhookEvent = await prisma.webhookEvent.findFirst({
      where,
    });

    if (!webhookEvent) {
      throw new NotFoundError('Webhook event nao encontrado');
    }

    return webhookEvent;
  }

  /**
   * Replay (reprocessar) um webhook event marcando como nao processado
   */
  async replay(id: string, tenantId: string | null) {
    const where: { id: string; tenantId?: string } = { id };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const existing = await prisma.webhookEvent.findFirst({
      where,
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('Webhook event nao encontrado');
    }

    const updated = await prisma.webhookEvent.update({
      where: { id },
      data: {
        processed: false,
        processedAt: null,
        error: null,
      },
      select: {
        id: true,
        source: true,
        event: true,
        processed: true,
        createdAt: true,
      },
    });

    logger.info({ webhookEventId: id, tenantId }, 'Webhook event marked for replay');

    return updated;
  }

  /**
   * Deletar webhook event
   */
  async delete(id: string, tenantId: string | null) {
    const where: { id: string; tenantId?: string } = { id };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const existing = await prisma.webhookEvent.findFirst({
      where,
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('Webhook event nao encontrado');
    }

    await prisma.webhookEvent.delete({ where: { id } });

    logger.info({ webhookEventId: id, tenantId }, 'Webhook event deleted');
  }

  /**
   * Registrar webhook event (uso interno, fire-and-forget)
   */
  log(data: CreateWebhookEventInput): void {
    prisma.webhookEvent
      .create({
        data: {
          tenantId: data.tenantId ?? undefined,
          source: data.source,
          event: data.event,
          payload: data.payload,
        },
      })
      .catch((error) => {
        logger.error({ error, source: data.source, event: data.event }, 'Failed to log webhook event');
      });
  }

  /**
   * Marcar webhook como processado (uso interno)
   */
  async markProcessed(id: string, error?: string) {
    try {
      await prisma.webhookEvent.update({
        where: { id },
        data: {
          processed: true,
          processedAt: new Date(),
          ...(error && { error }),
        },
      });
    } catch (err) {
      logger.error({ err, webhookEventId: id }, 'Failed to mark webhook as processed');
    }
  }
}

export const webhookEventService = new WebhookEventService();
