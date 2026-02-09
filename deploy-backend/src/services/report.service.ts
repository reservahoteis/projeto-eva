import { prisma } from '@/config/database';
import { ConversationStatus } from '@prisma/client';
import logger from '@/config/logger';

interface OverviewResult {
  period: string;
  overview: {
    totalConversations: number;
    conversationsChange: number;
    averageResponseTime: number;
    resolutionRate: number;
    activeAttendants: number;
    totalAttendants: number;
  };
  statusBreakdown: Array<{
    status: ConversationStatus;
    count: number;
    percentage: number;
  }>;
}

interface AttendantPerformance {
  id: string;
  name: string;
  email: string;
  conversationsCount: number;
  satisfactionRate: number;
}

interface AttendantsPerformanceResult {
  period: string;
  attendants: AttendantPerformance[];
}

interface HourlyVolumeResult {
  period: string;
  hourlyVolume: Array<{
    hour: number;
    count: number;
  }>;
}

export class ReportService {
  /**
   * Calcula data inicial baseado no periodo
   * @param period - '7d' | '30d' | '90d' | '1y'
   */
  private getStartDate(period: string): Date {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    return startDate;
  }

  /**
   * Retorna overview com metricas gerais
   * MULTI-TENANT: Todas as queries incluem tenantId
   */
  async getOverview(tenantId: string, period: string = '30d'): Promise<OverviewResult> {
    const now = new Date();
    const startDate = this.getStartDate(period);

    logger.debug({ tenantId, period, startDate }, 'Fetching overview report');

    // Total de conversas no periodo
    const totalConversations = await prisma.conversation.count({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
    });

    // Total de conversas no periodo anterior (para comparacao)
    const periodDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);

    const previousConversations = await prisma.conversation.count({
      where: {
        tenantId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
    });

    // Calcular variacao percentual
    const conversationsChange =
      previousConversations > 0
        ? ((totalConversations - previousConversations) / previousConversations) * 100
        : 0;

    // Conversas por status
    const conversationsByStatus = await prisma.conversation.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const statusBreakdown = conversationsByStatus.map((item) => ({
      status: item.status,
      count: item._count,
      percentage:
        totalConversations > 0 ? Math.round((item._count / totalConversations) * 100) : 0,
    }));

    // Atendentes ativos (que tem conversas no periodo)
    const activeAttendants = await prisma.user.count({
      where: {
        tenantId,
        conversations: {
          some: {
            createdAt: { gte: startDate },
          },
        },
      },
    });

    // Total de atendentes
    const totalAttendants = await prisma.user.count({
      where: { tenantId },
    });

    // Tempo medio de resposta (simplificado - baseado em closedAt - createdAt)
    const conversationsWithTimes = await prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
        status: ConversationStatus.CLOSED,
        closedAt: { not: null },
      },
      select: {
        createdAt: true,
        closedAt: true,
      },
    });

    let averageResponseTime = 0;
    if (conversationsWithTimes.length > 0) {
      const totalMinutes = conversationsWithTimes.reduce((sum, conv) => {
        if (conv.closedAt) {
          const diff = conv.closedAt.getTime() - conv.createdAt.getTime();
          return sum + diff / 1000 / 60; // converter para minutos
        }
        return sum;
      }, 0);
      averageResponseTime = Math.round(totalMinutes / conversationsWithTimes.length);
    }

    // Taxa de resolucao
    const resolvedCount =
      conversationsByStatus.find((item) => item.status === ConversationStatus.CLOSED)?._count || 0;
    const resolutionRate =
      totalConversations > 0 ? Math.round((resolvedCount / totalConversations) * 100) : 0;

    logger.info(
      { tenantId, period, totalConversations, resolutionRate },
      'Overview report generated'
    );

    return {
      period,
      overview: {
        totalConversations,
        conversationsChange: Math.round(conversationsChange),
        averageResponseTime,
        resolutionRate,
        activeAttendants,
        totalAttendants,
      },
      statusBreakdown,
    };
  }

  /**
   * Retorna performance por atendente
   * MULTI-TENANT: Todas as queries incluem tenantId
   */
  async getAttendantsPerformance(
    tenantId: string,
    period: string = '30d'
  ): Promise<AttendantsPerformanceResult> {
    const startDate = this.getStartDate(period);

    logger.debug({ tenantId, period, startDate }, 'Fetching attendants performance report');

    // Buscar atendentes com suas conversas
    const attendants = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            conversations: {
              where: {
                createdAt: { gte: startDate },
              },
            },
          },
        },
      },
      orderBy: {
        conversations: {
          _count: 'desc',
        },
      },
    });

    // Para cada atendente, calcular taxa de resolucao
    const attendantsWithStats = await Promise.all(
      attendants.map(async (attendant) => {
        const totalConversations = attendant._count.conversations;

        const resolvedConversations = await prisma.conversation.count({
          where: {
            tenantId,
            assignedToId: attendant.id,
            status: ConversationStatus.CLOSED,
            createdAt: { gte: startDate },
          },
        });

        const satisfactionRate =
          totalConversations > 0
            ? Math.round((resolvedConversations / totalConversations) * 100)
            : 0;

        return {
          id: attendant.id,
          name: attendant.name,
          email: attendant.email,
          conversationsCount: totalConversations,
          satisfactionRate,
        };
      })
    );

    const activeAttendants = attendantsWithStats.filter((a) => a.conversationsCount > 0);

    logger.info(
      { tenantId, period, activeAttendantsCount: activeAttendants.length },
      'Attendants performance report generated'
    );

    return {
      period,
      attendants: activeAttendants,
    };
  }

  /**
   * Retorna volume de mensagens por hora
   * MULTI-TENANT: Todas as queries incluem tenantId
   */
  async getHourlyVolume(tenantId: string, period: string = '30d'): Promise<HourlyVolumeResult> {
    const startDate = this.getStartDate(period);

    logger.debug({ tenantId, period, startDate }, 'Fetching hourly volume report');

    // Buscar todas as conversas no periodo
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
      },
    });

    // Agrupar por hora (0-23)
    const hourlyData: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = 0;
    }

    conversations.forEach((conv) => {
      if (conv && conv.createdAt) {
        const hour = conv.createdAt.getHours();
        if (hourlyData[hour] !== undefined) {
          hourlyData[hour]++;
        }
      }
    });

    const hourlyVolume = Object.entries(hourlyData).map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
    }));

    logger.info(
      { tenantId, period, totalConversations: conversations.length },
      'Hourly volume report generated'
    );

    return {
      period,
      hourlyVolume,
    };
  }
}

export const reportService = new ReportService();
