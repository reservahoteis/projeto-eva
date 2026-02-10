'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/report.service';
import type { OutsideHoursConversation } from '@/services/report.service';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { UserRole } from '@/types';
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
  MoonStar,
  Phone,
  MapPin,
  User,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = '7d' | '30d' | '90d' | '1y';

function ReportsPageContent() {
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

  // Query para conversas fora do horario comercial
  const {
    data: outsideHoursData,
    isLoading: isLoadingOutsideHours,
  } = useQuery({
    queryKey: ['reports', 'outside-hours', period],
    queryFn: () => reportService.getOutsideBusinessHours({ period }),
  });

  const getPeriodLabel = (p: Period): string => {
    const labels: Record<Period, string> = {
      '7d': 'Ultimos 7 dias',
      '30d': 'Ultimos 30 dias',
      '90d': 'Ultimos 90 dias',
      '1y': 'Ultimo ano',
    };
    return labels[p];
  };

  const isLoading = isLoadingOverview || isLoadingAttendants || isLoadingHourly;

  // Pre-calcular max count para barras do grafico
  const maxHourlyCount = useMemo(() => {
    if (!hourlyData?.hourlyVolume) return 1;
    return Math.max(...hourlyData.hourlyVolume.map((h) => h.count), 1);
  }, [hourlyData]);

  const statsCards = [
    {
      title: `CONVERSAS (${getPeriodLabel(period).toUpperCase()})`,
      value: overviewData?.overview.totalConversations || 0,
      icon: MessageSquare,
      iconBoxClass: 'icon-box icon-box-blue',
      change: overviewData?.overview.conversationsChange,
    },
    {
      title: 'TEMPO MEDIO DE RESPOSTA',
      value: overviewData
        ? reportService.formatResponseTime(overviewData.overview.averageResponseTime)
        : '0min',
      icon: Clock,
      iconBoxClass: 'icon-box icon-box-orange',
      subtitle: 'Media do periodo',
    },
    {
      title: 'TAXA DE RESOLUCAO',
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
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Relatorios</h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">Analises e metricas do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-[140px] sm:w-[180px] glass-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-card border-[var(--glass-border)]">
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="90d">Ultimos 90 dias</SelectItem>
              <SelectItem value="1y">Ultimo ano</SelectItem>
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
                            {stat.change > 0 ? '+' : ''}{stat.change}% vs periodo anterior
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
              )) || <p className="text-sm text-[var(--text-muted)]">Nenhum dado disponivel</p>}
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
                      <p className="text-xs text-[var(--text-muted)]">resolucao</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Nenhum atendente com conversas no periodo</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Volume por Hora - Grafico de Barras */}
      <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.6s' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Volume por Hora (24h)</h2>
          {hourlyData?.businessHoursMetrics && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-blue-500 to-indigo-500" />
                <span className="text-xs text-[var(--text-muted)]">Comercial (8h-18h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-amber-500 to-orange-500" />
                <span className="text-xs text-[var(--text-muted)]">Fora do horario</span>
              </div>
            </div>
          )}
        </div>

        {isLoadingHourly ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <>
            {/* Banner metricas fora do horario */}
            {hourlyData?.businessHoursMetrics && hourlyData.businessHoursMetrics.outsideCount > 0 && (
              <div className="flex items-center gap-4 mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <MoonStar className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {hourlyData.businessHoursMetrics.outsidePercentage}% fora do horario comercial
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {hourlyData.businessHoursMetrics.outsideCount} de {hourlyData.businessHoursMetrics.insideCount + hourlyData.businessHoursMetrics.outsideCount} conversas
                  </p>
                </div>
              </div>
            )}

            {/* Grafico de barras verticais */}
            <div className="relative">
              {/* Linhas de referencia */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ bottom: '24px' }}>
                {[100, 75, 50, 25, 0].map((pct) => (
                  <div key={pct} className="flex items-center gap-2 w-full">
                    <span className="text-[9px] text-[var(--text-muted)] w-6 text-right shrink-0">
                      {Math.round((maxHourlyCount * pct) / 100)}
                    </span>
                    <div className="flex-1 border-t border-dashed border-[var(--glass-border)] opacity-40" />
                  </div>
                ))}
              </div>

              {/* Barras */}
              <div className="flex items-end gap-[3px] pl-8" style={{ height: '200px', paddingBottom: '24px' }}>
                {hourlyData?.hourlyVolume.map((item) => {
                  const heightPct = maxHourlyCount > 0 ? (item.count / maxHourlyCount) * 100 : 0;
                  const hasData = item.count > 0;
                  return (
                    <div
                      key={item.hour}
                      className="flex-1 flex flex-col items-center justify-end relative group"
                      style={{ height: '176px' }}
                    >
                      {/* Tooltip on hover */}
                      {hasData && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--glass-bg-strong)] text-[var(--text-primary)] text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap z-10 border border-[var(--glass-border)]">
                          {item.count}
                        </div>
                      )}

                      {/* Contagem acima da barra */}
                      {hasData && (
                        <span className="text-[9px] font-semibold text-[var(--text-muted)] mb-0.5">
                          {item.count}
                        </span>
                      )}

                      {/* Barra */}
                      <div
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          item.isBusinessHour
                            ? 'bg-gradient-to-t from-blue-600 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                            : 'bg-gradient-to-t from-amber-600 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                        } ${hasData ? 'group-hover:brightness-110' : ''}`}
                        style={{
                          height: hasData ? `${Math.max(heightPct, 3)}%` : '0',
                          minHeight: hasData ? '4px' : '0',
                        }}
                      />

                      {/* Label hora */}
                      <span
                        className={`text-[10px] mt-1 font-medium ${
                          item.isBusinessHour
                            ? 'text-[var(--text-muted)]'
                            : 'text-amber-500'
                        }`}
                      >
                        {item.hour}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Card: Conversas Fora do Horario Comercial */}
      <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.7s' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="icon-box icon-box-amber">
              <MoonStar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Fora do Horario Comercial
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Conversas iniciadas antes das 8h ou apos as 18h
              </p>
            </div>
          </div>
          {outsideHoursData && (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-amber-500">{outsideHoursData.total}</span>
              <span className="text-xs text-[var(--text-muted)]">conversas</span>
            </div>
          )}
        </div>

        {isLoadingOutsideHours ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-ios-xs" />
            ))}
          </div>
        ) : outsideHoursData && outsideHoursData.conversations.length > 0 ? (
          <div className="space-y-2.5">
            {outsideHoursData.conversations.map((conv: OutsideHoursConversation) => {
              const contactName = conv.contact.name || conv.contact.phoneNumber;
              const createdDate = new Date(conv.createdAt);
              const hour = createdDate.getHours();
              const isLateNight = hour >= 22 || hour < 6;

              return (
                <div
                  key={conv.id}
                  className={`flex items-center gap-4 p-3.5 rounded-ios-xs border transition-colors hover:bg-[var(--glass-bg-hover)] ${
                    isLateNight
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {conv.contact.profilePictureUrl ? (
                      <img
                        src={conv.contact.profilePictureUrl}
                        alt={contactName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-amber-500">
                          {contactName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Indicador de horario */}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      isLateNight
                        ? 'bg-amber-500 text-white'
                        : 'bg-[var(--glass-bg-strong)] text-[var(--text-muted)] border border-[var(--glass-border)]'
                    }`}>
                      {hour}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {contactName}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        isLateNight
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                      }`}>
                        {format(createdDate, 'HH:mm')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      {conv.contact.name && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <Phone className="h-3 w-3" />
                          {conv.contact.phoneNumber}
                        </span>
                      )}
                      {conv.hotelUnit && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <MapPin className="h-3 w-3" />
                          {conv.hotelUnit}
                        </span>
                      )}
                      {conv.assignedTo && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <User className="h-3 w-3" />
                          {conv.assignedTo.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tempo */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDistanceToNow(createdDate, {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {format(createdDate, 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center">
            <div className="icon-box icon-box-green mx-auto mb-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Nenhuma conversa fora do horario
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Todas as conversas no periodo foram dentro do horario comercial (8h-18h)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]}>
      <ReportsPageContent />
    </ProtectedRoute>
  );
}
