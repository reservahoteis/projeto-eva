import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import type { ReportQuery } from '../validators/report.validator';
import { ConversationStatus } from '@prisma/client';

/**
 * GET /api/reports/overview
 * Retorna overview com métricas gerais
 */
export async function getOverview(
  req: Request<{}, {}, {}, ReportQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { period = '30d' } = req.query;

    // Calcular data de início baseado no período
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
    }

    // Total de conversas no período
    const totalConversations = await prisma.conversation.count({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
    });

    // Total de conversas no período anterior (para comparação)
    const periodDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);

    const previousConversations = await prisma.conversation.count({
      where: {
        tenantId,
        createdAt: { gte: previousStartDate, lt: startDate },
      },
    });

    // Calcular variação percentual
    const conversationsChange = previousConversations > 0
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
      percentage: totalConversations > 0
        ? Math.round((item._count / totalConversations) * 100)
        : 0,
    }));

    // Atendentes ativos (que têm conversas no período)
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

    // Tempo médio de resposta (simplificado - baseado em closedAt - createdAt)
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
          return sum + (diff / 1000 / 60); // converter para minutos
        }
        return sum;
      }, 0);
      averageResponseTime = Math.round(totalMinutes / conversationsWithTimes.length);
    }

    // Taxa de resolução
    const resolvedCount = conversationsByStatus.find(
      (item) => item.status === ConversationStatus.CLOSED
    )?._count || 0;
    const resolutionRate = totalConversations > 0
      ? Math.round((resolvedCount / totalConversations) * 100)
      : 0;

    res.json({
      period,
      overview: {
        totalConversations,
        conversationsChange: Math.round(conversationsChange),
        averageResponseTime, // em minutos
        resolutionRate,
        activeAttendants,
        totalAttendants,
      },
      statusBreakdown,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/attendants
 * Retorna performance por atendente
 */
export async function getAttendantsPerformance(
  req: Request<{}, {}, {}, ReportQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { period = '30d' } = req.query;

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
    }

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

    // Para cada atendente, calcular taxa de resolução
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

        const satisfactionRate = totalConversations > 0
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

    res.json({
      period,
      attendants: attendantsWithStats.filter((a) => a.conversationsCount > 0),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/hourly
 * Retorna volume de mensagens por hora
 */
export async function getHourlyVolume(
  req: Request<{}, {}, {}, ReportQuery>,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId!;
    const { period = '30d' } = req.query;

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
    }

    // Buscar todas as conversas no período
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

    res.json({
      period,
      hourlyVolume,
    });
  } catch (error) {
    next(error);
  }
}
