'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/report.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análises e métricas do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total de Conversas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversas ({getPeriodLabel(period)})
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overviewData?.overview.totalConversations || 0}
                </div>
                {overviewData && overviewData.overview.conversationsChange !== 0 && (
                  <p
                    className={`text-xs flex items-center gap-1 ${
                      overviewData.overview.conversationsChange > 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {overviewData.overview.conversationsChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {overviewData.overview.conversationsChange > 0 ? '+' : ''}
                    {overviewData.overview.conversationsChange}% vs período anterior
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Tempo Médio de Resposta */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overviewData
                    ? reportService.formatResponseTime(overviewData.overview.averageResponseTime)
                    : '0min'}
                </div>
                <p className="text-xs text-muted-foreground">Média do período</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Taxa de Resolução */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resolução</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overviewData?.overview.resolutionRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Conversas fechadas</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Atendentes Ativos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendentes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingOverview ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {overviewData?.overview.activeAttendants || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  De {overviewData?.overview.totalAttendants || 0} total
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Conversas por Status */}
        <Card>
          <CardHeader>
            <CardTitle>Conversas por Status</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <span className="text-sm">{reportService.getStatusLabel(item.status)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${reportService.getStatusColor(item.status)}`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                )) || <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance por Atendente */}
        <Card>
          <CardHeader>
            <CardTitle>Performance por Atendente</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <div key={attendant.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{attendant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attendant.conversationsCount} conversas
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            attendant.satisfactionRate >= 80
                              ? 'text-green-600'
                              : attendant.satisfactionRate >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {attendant.satisfactionRate}%
                        </p>
                        <p className="text-xs text-muted-foreground">resolução</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum atendente com conversas no período</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Horários de Pico */}
      <Card>
        <CardHeader>
          <CardTitle>Horários de Pico</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingHourly ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">Volume de conversas por hora</p>
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
                          className="w-full bg-primary rounded-t"
                          style={{ height: `${height}%` }}
                          title={`${item.count} conversas às ${item.hour}h`}
                        />
                        <span className="text-xs text-muted-foreground">{item.hour}h</span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
