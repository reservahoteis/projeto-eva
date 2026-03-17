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
  TrendingUp,
  TrendingDown,
  Clock,
  MoonStar,
  Phone,
  MapPin,
  User,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Period = '7d' | '30d' | '90d' | '1y';

// ============================================
// HELPERS
// ============================================

function getPeriodLabel(p: Period): string {
  const labels: Record<Period, string> = {
    '7d': 'Ultimos 7 dias',
    '30d': 'Ultimos 30 dias',
    '90d': 'Ultimos 90 dias',
    '1y': 'Ultimo ano',
  };
  return labels[p];
}

// ============================================
// STAT CARD (compact Frappe style)
// ============================================

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  isLoading?: boolean;
}

function StatCard({ label, value, sub, isLoading }: StatCardProps) {
  return (
    <div className="px-4 py-3" style={{ backgroundColor: 'var(--surface-white)' }}>
      <p
        className="text-[11px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--ink-gray-5)' }}
      >
        {label}
      </p>
      {isLoading ? (
        <Skeleton className="h-6 w-20 mt-2" />
      ) : (
        <>
          <p className="text-lg font-semibold mt-1" style={{ color: 'var(--ink-gray-9)' }}>
            {value}
          </p>
          {sub && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-gray-5)' }}>
              {sub}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// SECTION HEADER (compact divider row)
// ============================================

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-5 py-2 border-b"
      style={{
        borderColor: 'var(--outline-gray-1)',
        backgroundColor: 'var(--surface-gray-1)',
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--ink-gray-5)' }}
      >
        {children}
      </p>
    </div>
  );
}

// ============================================
// MAIN CONTENT
// ============================================

function ReportsPageContent() {
  const [period, setPeriod] = useState<Period>('30d');

  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
    isFetching,
  } = useQuery({
    queryKey: ['reports', 'overview', period],
    queryFn: () => reportService.getOverview({ period }),
  });

  const { data: attendantsData, isLoading: isLoadingAttendants } = useQuery({
    queryKey: ['reports', 'attendants', period],
    queryFn: () => reportService.getAttendantsPerformance({ period }),
  });

  const { data: hourlyData, isLoading: isLoadingHourly } = useQuery({
    queryKey: ['reports', 'hourly', period],
    queryFn: () => reportService.getHourlyVolume({ period }),
  });

  const { data: outsideHoursData, isLoading: isLoadingOutsideHours } = useQuery({
    queryKey: ['reports', 'outside-hours', period],
    queryFn: () => reportService.getOutsideBusinessHours({ period }),
  });

  const maxHourlyCount = useMemo(() => {
    if (!hourlyData?.hourlyVolume) return 1;
    return Math.max(...hourlyData.hourlyVolume.map((h) => h.count), 1);
  }, [hourlyData]);

  const conversationsChange = overviewData?.overview.conversationsChange;

  return (
    <div className="flex flex-col h-full">
      {/* ---- Page Header ---- */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        <h1 className="text-base font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
          Relatorios
        </h1>

        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger
              className="h-7 text-xs rounded border px-2.5 w-[150px]"
              style={{
                borderColor: 'var(--outline-gray-2)',
                backgroundColor: 'var(--surface-white)',
                color: 'var(--ink-gray-8)',
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              className="rounded-lg border shadow-md"
              style={{
                backgroundColor: 'var(--surface-white)',
                borderColor: 'var(--outline-gray-2)',
              }}
            >
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="90d">Ultimos 90 dias</SelectItem>
              <SelectItem value="1y">Ultimo ano</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetchOverview()}
            disabled={isFetching}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
              style={{ color: 'var(--ink-gray-5)' }}
            />
          </Button>
        </div>
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-auto">

        {/* ---- Stats strip ---- */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px"
          style={{ backgroundColor: 'var(--outline-gray-1)' }}
        >
          {/* Conversas */}
          <StatCard
            label={`CONVERSAS — ${getPeriodLabel(period).toUpperCase()}`}
            isLoading={isLoadingOverview}
            value={overviewData?.overview.totalConversations ?? 0}
            sub={
              conversationsChange !== undefined && conversationsChange !== 0 ? (
                <span
                  className="inline-flex items-center gap-1"
                  style={{
                    color: conversationsChange > 0 ? 'var(--ink-green-3)' : 'var(--ink-red-3)',
                  }}
                >
                  {conversationsChange > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {conversationsChange > 0 ? '+' : ''}
                  {conversationsChange}% vs periodo anterior
                </span>
              ) : undefined
            }
          />

          {/* Tempo medio */}
          <StatCard
            label="TEMPO MEDIO DE RESPOSTA"
            isLoading={isLoadingOverview}
            value={
              overviewData
                ? reportService.formatResponseTime(overviewData.overview.averageResponseTime)
                : '—'
            }
            sub="Media do periodo"
          />

          {/* Taxa resolucao */}
          <StatCard
            label="TAXA DE RESOLUCAO"
            isLoading={isLoadingOverview}
            value={`${overviewData?.overview.resolutionRate ?? 0}%`}
            sub="Conversas fechadas"
          />

          {/* Atendentes */}
          <StatCard
            label="ATENDENTES ATIVOS"
            isLoading={isLoadingOverview}
            value={overviewData?.overview.activeAttendants ?? 0}
            sub={`De ${overviewData?.overview.totalAttendants ?? 0} total`}
          />
        </div>

        {/* ---- Status breakdown + Attendants side-by-side ---- */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-px border-t"
          style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--outline-gray-1)' }}
        >
          {/* Conversas por Status */}
          <div style={{ backgroundColor: 'var(--surface-white)' }}>
            <SectionTitle>Conversas por Status</SectionTitle>
            <div className="px-5 py-4">
              {isLoadingOverview ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              ) : overviewData?.statusBreakdown && overviewData.statusBreakdown.length > 0 ? (
                <div className="space-y-3">
                  {overviewData.statusBreakdown.map((item) => (
                    <div key={item.status} className="flex items-center justify-between gap-3">
                      <span
                        className="text-sm flex-shrink-0"
                        style={{ color: 'var(--ink-gray-7)' }}
                      >
                        {reportService.getStatusLabel(item.status)}
                      </span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div
                          className="w-28 h-1.5 rounded-full overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: 'var(--surface-gray-2)' }}
                        >
                          <div
                            className={reportService.getStatusColor(item.status)}
                            style={{ width: `${item.percentage}%`, height: '100%' }}
                          />
                        </div>
                        <span
                          className="text-xs font-medium tabular-nums w-9 text-right flex-shrink-0"
                          style={{ color: 'var(--ink-gray-6)' }}
                        >
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm py-4" style={{ color: 'var(--ink-gray-4)' }}>
                  Nenhum dado disponivel
                </p>
              )}
            </div>
          </div>

          {/* Performance por Atendente */}
          <div style={{ backgroundColor: 'var(--surface-white)' }}>
            <SectionTitle>Performance por Atendente</SectionTitle>
            <div className="px-5 py-4">
              {isLoadingAttendants ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : attendantsData && attendantsData.attendants.length > 0 ? (
                <div className="divide-y" style={{ borderColor: 'var(--outline-gray-1)' }}>
                  {attendantsData.attendants.slice(0, 5).map((attendant) => (
                    <div
                      key={attendant.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'var(--ink-gray-8)' }}
                        >
                          {attendant.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-gray-5)' }}>
                          {attendant.conversationsCount} conversas
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-sm font-semibold tabular-nums"
                          style={{
                            color:
                              attendant.satisfactionRate >= 80
                                ? 'var(--ink-green-3)'
                                : attendant.satisfactionRate >= 60
                                ? '#D97706'
                                : 'var(--ink-red-3)',
                          }}
                        >
                          {attendant.satisfactionRate}%
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-gray-4)' }}>
                          resolucao
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm py-4" style={{ color: 'var(--ink-gray-4)' }}>
                  Nenhum atendente com conversas no periodo
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---- Volume por Hora ---- */}
        <div
          className="border-t"
          style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-white)' }}
        >
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-2 border-b"
            style={{
              borderColor: 'var(--outline-gray-1)',
              backgroundColor: 'var(--surface-gray-1)',
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Volume por Hora (24h)
            </p>
            {hourlyData?.businessHoursMetrics && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: 'var(--ink-blue-3)' }}
                  />
                  <span className="text-[11px]" style={{ color: 'var(--ink-gray-5)' }}>
                    Comercial (8h–18h)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: 'var(--ink-gray-4)' }}
                  />
                  <span className="text-[11px]" style={{ color: 'var(--ink-gray-5)' }}>
                    Fora do horario
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4">
            {isLoadingHourly ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <>
                {/* Outside hours banner */}
                {hourlyData?.businessHoursMetrics &&
                  hourlyData.businessHoursMetrics.outsideCount > 0 && (
                    <div
                      className="flex items-center gap-3 mb-4 px-3 py-2 rounded border"
                      style={{
                        backgroundColor: '#FFFBEB',
                        borderColor: '#FDE68A',
                      }}
                    >
                      <MoonStar
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: '#D97706' }}
                      />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-8)' }}>
                          {hourlyData.businessHoursMetrics.outsidePercentage}% fora do horario
                          comercial
                        </p>
                        <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                          {hourlyData.businessHoursMetrics.outsideCount} de{' '}
                          {hourlyData.businessHoursMetrics.insideCount +
                            hourlyData.businessHoursMetrics.outsideCount}{' '}
                          conversas
                        </p>
                      </div>
                    </div>
                  )}

                {/* Bar chart */}
                <div className="relative">
                  {/* Grid lines */}
                  <div
                    className="absolute inset-0 flex flex-col justify-between pointer-events-none"
                    style={{ bottom: '24px' }}
                  >
                    {[100, 75, 50, 25, 0].map((pct) => (
                      <div key={pct} className="flex items-center gap-2 w-full">
                        <span
                          className="text-[9px] w-5 text-right shrink-0 tabular-nums"
                          style={{ color: 'var(--ink-gray-4)' }}
                        >
                          {Math.round((maxHourlyCount * pct) / 100)}
                        </span>
                        <div
                          className="flex-1 border-t border-dashed"
                          style={{ borderColor: 'var(--outline-gray-1)' }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Bars */}
                  <div
                    className="flex items-end gap-[3px] pl-7"
                    style={{ height: '200px', paddingBottom: '24px' }}
                  >
                    {hourlyData?.hourlyVolume.map((item) => {
                      const heightPct =
                        maxHourlyCount > 0 ? (item.count / maxHourlyCount) * 100 : 0;
                      const hasData = item.count > 0;
                      return (
                        <div
                          key={item.hour}
                          className="flex-1 flex flex-col items-center justify-end relative group"
                          style={{ height: '176px' }}
                        >
                          {/* Tooltip */}
                          {hasData && (
                            <div
                              className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap z-10"
                              style={{
                                backgroundColor: 'var(--surface-white)',
                                borderColor: 'var(--outline-gray-2)',
                                color: 'var(--ink-gray-8)',
                              }}
                            >
                              {item.count}
                            </div>
                          )}

                          {/* Count above bar */}
                          {hasData && (
                            <span
                              className="text-[9px] font-medium mb-0.5"
                              style={{ color: 'var(--ink-gray-5)' }}
                            >
                              {item.count}
                            </span>
                          )}

                          {/* Bar */}
                          <div
                            className="w-full rounded-t-sm transition-all duration-200"
                            style={{
                              height: hasData ? `${Math.max(heightPct, 3)}%` : '0',
                              minHeight: hasData ? '4px' : '0',
                              backgroundColor: item.isBusinessHour
                                ? 'var(--ink-blue-3)'
                                : 'var(--ink-gray-4)',
                              opacity: hasData ? 1 : 0,
                            }}
                          />

                          {/* Hour label */}
                          <span
                            className="text-[10px] mt-1 font-medium"
                            style={{
                              color: item.isBusinessHour
                                ? 'var(--ink-gray-5)'
                                : 'var(--ink-gray-7)',
                            }}
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
        </div>

        {/* ---- Fora do Horario Comercial ---- */}
        <div
          className="border-t"
          style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-white)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-2 border-b"
            style={{
              borderColor: 'var(--outline-gray-1)',
              backgroundColor: 'var(--surface-gray-1)',
            }}
          >
            <div className="flex items-center gap-2">
              <MoonStar className="w-3.5 h-3.5" style={{ color: 'var(--ink-gray-5)' }} />
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Fora do Horario Comercial
              </p>
              <span
                className="text-xs"
                style={{ color: 'var(--ink-gray-4)' }}
              >
                — antes das 8h ou apos as 18h
              </span>
            </div>

            {outsideHoursData && (
              <span
                className="text-xs px-1.5 py-0.5 rounded tabular-nums font-medium"
                style={{
                  backgroundColor: 'var(--surface-gray-2)',
                  color: 'var(--ink-gray-6)',
                }}
              >
                {outsideHoursData.total} conversas
              </span>
            )}
          </div>

          {isLoadingOutsideHours ? (
            <div className="divide-y" style={{ borderColor: 'var(--outline-gray-1)' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-5 py-3">
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : outsideHoursData && outsideHoursData.conversations.length > 0 ? (
            <div className="divide-y" style={{ borderColor: 'var(--outline-gray-1)' }}>
              {outsideHoursData.conversations.map((conv: OutsideHoursConversation) => {
                const contactName = conv.contact.name || conv.contact.phoneNumber;
                const createdDate = conv.createdAt ? new Date(conv.createdAt) : new Date();
                const hour = createdDate.getHours();
                const isLateNight = hour >= 22 || hour < 6;

                return (
                  <div
                    key={conv.id}
                    className="flex items-center gap-4 px-5 py-2.5 transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {conv.contact.profilePictureUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={conv.contact.profilePictureUrl}
                          alt={contactName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                          style={{
                            backgroundColor: isLateNight ? '#FEF3C7' : 'var(--surface-gray-2)',
                            color: isLateNight ? '#D97706' : 'var(--ink-gray-6)',
                          }}
                        >
                          {contactName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Hour badge */}
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border"
                        style={{
                          backgroundColor: isLateNight ? '#D97706' : 'var(--surface-gray-3)',
                          color: isLateNight ? '#fff' : 'var(--ink-gray-6)',
                          borderColor: 'var(--surface-white)',
                        }}
                      >
                        {hour}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: 'var(--ink-gray-8)' }}
                        >
                          {contactName}
                        </span>
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                          style={{
                            backgroundColor: isLateNight ? '#FEF3C7' : '#EFF6FF',
                            color: isLateNight ? '#D97706' : 'var(--ink-blue-3)',
                          }}
                        >
                          {format(createdDate, 'HH:mm')}
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-3 mt-0.5 flex-wrap"
                        style={{ color: 'var(--ink-gray-4)' }}
                      >
                        {conv.contact.name && (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Phone className="h-3 w-3" />
                            {conv.contact.phoneNumber}
                          </span>
                        )}
                        {conv.hotelUnit && (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <MapPin className="h-3 w-3" />
                            {conv.hotelUnit}
                          </span>
                        )}
                        {conv.assignedTo && (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <User className="h-3 w-3" />
                            {conv.assignedTo.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                        {formatDistanceToNow(createdDate, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-gray-4)' }}>
                        {format(createdDate, 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: 'var(--surface-gray-2)' }}
              >
                <Clock className="w-5 h-5" style={{ color: 'var(--ink-gray-4)' }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
                Nenhuma conversa fora do horario
              </p>
              <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                Todas as conversas no periodo foram dentro do horario comercial (8h–18h)
              </p>
            </div>
          )}
        </div>

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
