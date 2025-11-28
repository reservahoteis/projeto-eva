'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/report.service';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  Users,
  RefreshCw,
} from 'lucide-react';

type Period = '7d' | '30d' | '90d' | '1y';

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('30d');

  // Query para overview
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['reports', 'overview', period],
    queryFn: () => reportService.getOverview({ period }),
  });

  // Query para performance de atendentes
  const {
    data: attendantsData,
    isLoading: isLoadingAttendants,
  } = useQuery({
    queryKey: ['reports', 'attendants', period],
    queryFn: () => reportService.getAttendantsPerformance({ period }),
  });

  // Query para volume por hora
  const {
    data: hourlyData,
    isLoading: isLoadingHourly,
  } = useQuery({
    queryKey: ['reports', 'hourly', period],
    queryFn: () => reportService.getHourlyVolume({ period }),
  });

  const getPeriodLabel = (p: Period): string => {
    const labels: Record<Period, string> = {
      '7d': 'Últimos 7 dias',
      '30d': 'Últimos 30 dias',
      '90d': 'Últimos 90 dias',
      '1y': 'Último ano',
    };
    return labels[p];
  };

  const isLoading = isLoadingOverview || isLoadingAttendants || isLoadingHourly;

  const statsCards = [
    {
      title: `CONVERSAS (${getPeriodLabel(period).toUpperCase()})`,
      value: overviewData?.overview.totalConversations || 0,
      icon: MessageSquare,
      iconBoxClass: 'icon-box icon-box-blue',
      change: overviewData?.overview.conversationsChange,
    },
    {
      title: 'TEMPO MÉDIO DE RESPOSTA',
      value: overviewData
        ? reportService.formatResponseTime(overviewData.overview.averageResponseTime)
        : '0min',
      icon: Clock,
      iconBoxClass: 'icon-box icon-box-orange',
      subtitle: 'Média do período',
    },
    {
      title: 'TAXA DE RESOLUÇÃO',
      value: `${overviewData?.overview.resolutionRate || 0}%`,
      icon: BarChart3,
      iconBoxClass: 'icon-box icon-box-green',
      subtitle: 'Conversas fechadas',
    },
    {
      title: 'ATENDENTES ATIVOS',
      value: overviewData?.overview.activeAttendants || 0,
      icon: Users,
      iconBoxClass: 'icon-box icon-box-purple',
      subtitle: `De ${overviewData?.overview.totalAttendants || 0} total`,
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Relatórios</h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">Análises e métricas do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-[140px] sm:w-[180px] glass-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-card border-[var(--glass-border)]">
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="1y">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchOverview()}
            disabled={isLoading}
            className="glass-btn"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="glass-card glass-kpi p-6 animate-slideUp"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-2">
                    {stat.title}
                  </p>
                  {isLoadingOverview ? (
                    <Skeleton className="h-10 w-20" />
                  ) : (
                    <>
                      <p className="text-3xl font-bold text-[var(--text-primary)]">
                        {stat.value}
                      </p>
                      {stat.change !== undefined && stat.change !== 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {stat.change > 0 ? (
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-500" />
                          )}
                          <span className={`text-xs font-medium ${stat.change > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {stat.change > 0 ? '+' : ''}{stat.change}% vs período anterior
                          </span>
                        </div>
                      )}
                      {stat.subtitle && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">{stat.subtitle}</p>
                      )}
                    </>
                  )}
                </div>
                <div className={stat.iconBoxClass}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Reports */}
      <div className="grid gap-3 md:gap-5 md:grid-cols-2">
        {/* Conversas por Status */}
        <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Conversas por Status</h2>
          {isLoadingOverview ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {overviewData?.statusBreakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{reportService.getStatusLabel(item.status)}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-[var(--glass-bg-strong)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${reportService.getStatusColor(item.status)}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right text-[var(--text-primary)]">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              )) || <p className="text-sm text-[var(--text-muted)]">Nenhum dado disponível</p>}
            </div>
          )}
        </div>

        {/* Performance por Atendente */}
        <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Performance por Atendente</h2>
          {isLoadingAttendants ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {attendantsData && attendantsData.attendants.length > 0 ? (
                attendantsData.attendants.slice(0, 5).map((attendant) => (
                  <div key={attendant.id} className="flex items-center justify-between p-3 rounded-ios-xs bg-[var(--glass-bg-hover)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{attendant.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {attendant.conversationsCount} conversas
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          attendant.satisfactionRate >= 80
                            ? 'text-emerald-500'
                            : attendant.satisfactionRate >= 60
                            ? 'text-amber-500'
                            : 'text-red-500'
                        }`}
                      >
                        {attendant.satisfactionRate}%
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">resolução</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Nenhum atendente com conversas no período</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Horários de Pico */}
      <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.6s' }}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Horários de Pico</h2>
        {isLoadingHourly ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <p className="text-sm text-[var(--text-muted)] mb-4">Volume de conversas por hora</p>
            <div className="flex items-end justify-between gap-2 h-40">
              {hourlyData?.hourlyVolume
                .filter((item) => item.hour >= 8 && item.hour <= 19)
                .map((item) => {
                  const maxCount = Math.max(
                    ...hourlyData.hourlyVolume.map((h) => h.count),
                    1
                  );
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={item.hour} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t-lg shadow-lg"
                        style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                        title={`${item.count} conversas às ${item.hour}h`}
                      />
                      <span className="text-xs text-[var(--text-muted)]">{item.hour}h</span>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
