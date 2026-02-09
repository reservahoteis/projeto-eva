import { prisma } from '@/config/database';
import logger from '@/config/logger';
import type { ListUsageTrackingQuery } from '@/validators/usage-tracking.validator';

export class UsageTrackingService {
  /**
   * Retorna o primeiro dia do mes atual (YYYY-MM-01)
   */
  private getCurrentPeriod(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  }

  /**
   * Listar uso do tenant com paginacao
   */
  async listUsage(tenantId: string, query: ListUsageTrackingQuery) {
    const { page, limit, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: {
      tenantId: string;
      period?: { gte?: Date; lte?: Date };
    } = { tenantId };

    if (startDate || endDate) {
      where.period = {};
      if (startDate) where.period.gte = new Date(startDate);
      if (endDate) where.period.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      prisma.usageTracking.findMany({
        where,
        orderBy: { period: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          period: true,
          messagesCount: true,
          conversationsCount: true,
          activeUsers: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.usageTracking.count({ where }),
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
   * Retorna metricas do mes atual
   */
  async getCurrentMonth(tenantId: string) {
    const period = this.getCurrentPeriod();

    const usage = await prisma.usageTracking.findUnique({
      where: {
        tenantId_period: { tenantId, period },
      },
      select: {
        id: true,
        period: true,
        messagesCount: true,
        conversationsCount: true,
        activeUsers: true,
        updatedAt: true,
      },
    });

    // Se nao existe registro para o mes atual, retorna zeros
    if (!usage) {
      return {
        id: null,
        period,
        messagesCount: 0,
        conversationsCount: 0,
        activeUsers: 0,
        updatedAt: null,
      };
    }

    return usage;
  }

  /**
   * Incrementar contador de mensagens (uso interno)
   */
  async incrementMessages(tenantId: string, count = 1) {
    const period = this.getCurrentPeriod();

    try {
      await prisma.usageTracking.upsert({
        where: {
          tenantId_period: { tenantId, period },
        },
        create: {
          tenantId,
          period,
          messagesCount: count,
        },
        update: {
          messagesCount: { increment: count },
        },
      });
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to increment messages count');
    }
  }

  /**
   * Incrementar contador de conversas (uso interno)
   */
  async incrementConversations(tenantId: string, count = 1) {
    const period = this.getCurrentPeriod();

    try {
      await prisma.usageTracking.upsert({
        where: {
          tenantId_period: { tenantId, period },
        },
        create: {
          tenantId,
          period,
          conversationsCount: count,
        },
        update: {
          conversationsCount: { increment: count },
        },
      });
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to increment conversations count');
    }
  }

  /**
   * Atualizar contagem de usuarios ativos no mes (uso interno)
   */
  async updateActiveUsers(tenantId: string) {
    const period = this.getCurrentPeriod();
    const startOfMonth = period;
    const endOfMonth = new Date(Date.UTC(period.getFullYear(), period.getMonth() + 1, 0, 23, 59, 59));

    try {
      const activeUsersCount = await prisma.user.count({
        where: {
          tenantId,
          lastLogin: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      await prisma.usageTracking.upsert({
        where: {
          tenantId_period: { tenantId, period },
        },
        create: {
          tenantId,
          period,
          activeUsers: activeUsersCount,
        },
        update: {
          activeUsers: activeUsersCount,
        },
      });

      logger.debug({ tenantId, activeUsersCount }, 'Active users updated');
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to update active users count');
    }
  }
}

export const usageTrackingService = new UsageTrackingService();
