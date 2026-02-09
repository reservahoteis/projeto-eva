import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { NotFoundError } from '@/utils/errors';
import logger from '@/config/logger';
import type { ListAuditLogsQuery } from '@/validators/audit-log.validator';

interface AuditLogInput {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldData?: Prisma.InputJsonValue | null;
  newData?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}

export class AuditLogService {
  /**
   * Listar audit logs com filtros e paginacao
   */
  async list(tenantId: string | null, query: ListAuditLogsQuery) {
    const { page, limit, action, entity, userId, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // SUPER_ADMIN ve todos; ADMIN ve so do tenant
    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          userId: true,
          action: true,
          entity: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
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
   * Buscar audit log por ID com dados completos
   */
  async getById(id: string, tenantId: string | null) {
    const where: { id: string; tenantId?: string } = { id };

    // SUPER_ADMIN ve todos; ADMIN ve so do tenant
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const log = await prisma.auditLog.findFirst({
      where,
      select: {
        id: true,
        tenantId: true,
        userId: true,
        action: true,
        entity: true,
        entityId: true,
        oldData: true,
        newData: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!log) {
      throw new NotFoundError('Audit log nao encontrado');
    }

    return log;
  }

  /**
   * Criar audit log (fire-and-forget, nao bloqueia o caller)
   */
  log(data: AuditLogInput): void {
    prisma.auditLog
      .create({
        data: {
          tenantId: data.tenantId ?? undefined,
          userId: data.userId ?? undefined,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId ?? undefined,
          oldData: data.oldData ?? undefined,
          newData: data.newData ?? undefined,
          metadata: data.metadata ?? undefined,
        },
      })
      .catch((error) => {
        logger.error({ error, data }, 'Failed to create audit log');
      });
  }
}

export const auditLogService = new AuditLogService();
