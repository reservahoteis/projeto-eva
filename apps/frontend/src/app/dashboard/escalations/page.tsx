'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { UserRole } from '@/types';
import {
  escalationService,
  EscalationStatus,
  type UpdateEscalationPayload,
} from '@/services/escalation.service';
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
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Phone,
  User,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Escalation } from '@/types';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusBadge(status: string) {
  const fallback = { className: 'bg-amber-500/15 text-amber-600 border-amber-500/20', label: 'Pendente' };
  const variants: Record<string, { className: string; label: string }> = {
    PENDING: fallback,
    IN_PROGRESS: {
      className: 'bg-blue-500/15 text-blue-600 border-blue-500/20',
      label: 'Em Andamento',
    },
    RESOLVED: {
      className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
      label: 'Resolvida',
    },
  };

  const config = variants[status] || fallback;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.className}`}>
      {config.label}
    </span>
  );
}

function getReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    USER_REQUESTED: 'Solicitado pelo cliente',
    AI_UNABLE: 'IA nao conseguiu resolver',
    COMPLEX_QUERY: 'Consulta complexa',
    COMPLAINT: 'Reclamacao',
    SALES_OPPORTUNITY: 'Oportunidade de venda',
    URGENCY: 'Urgencia',
    OTHER: 'Outro motivo',
  };
  return labels[reason] || reason;
}

// ============================================
// MAIN COMPONENT
// ============================================

function EscalationsPageContent() {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | 'ALL'>('ALL');

  // Query: Estatisticas
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['escalations-stats'],
    queryFn: () => escalationService.getStats(),
    refetchInterval: 30000,
  });

  // Query: Lista
  const {
    data: escalationsData,
    isLoading: isLoadingList,
    error,
  } = useQuery({
    queryKey: ['escalations', currentPage, statusFilter],
    queryFn: () =>
      escalationService.list({
        page: currentPage,
        limit: 20,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      }),
    placeholderData: keepPreviousData,
  });

  // Mutation: Atualizar
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEscalationPayload }) =>
      escalationService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalations-stats'] });
      toast.success('Escalacao atualizada');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erro ao atualizar escalacao');
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['escalations'] });
    queryClient.invalidateQueries({ queryKey: ['escalations-stats'] });
  };

  const handleStatusChange = (escalationId: string, newStatus: EscalationStatus) => {
    updateMutation.mutate({ id: escalationId, payload: { status: newStatus } });
  };

  // Error state
  if (error) {
    return (
      <div className="p-4 md:p-6 lg:p-8 liquid-bg min-h-screen flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Erro ao carregar</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {(error as any)?.response?.data?.message || 'Tente novamente mais tarde'}
          </p>
          <Button onClick={handleRefresh} className="mt-4 glass-btn" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  const escalations = escalationsData?.data || [];
  const pagination = escalationsData?.pagination;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            Escalacoes
          </h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">
            Conversas transferidas da IA para atendimento humano
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isLoadingList}
          className="glass-btn"
        >
          <RefreshCw className={`h-4 w-4 ${isLoadingList ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
        {[
          {
            title: 'TOTAL',
            value: stats?.total || 0,
            icon: AlertTriangle,
            iconBox: 'icon-box icon-box-purple',
          },
          {
            title: 'PENDENTES',
            value: stats?.pending || 0,
            icon: Clock,
            iconBox: 'icon-box icon-box-amber',
          },
          {
            title: 'EM ANDAMENTO',
            value: stats?.inProgress || 0,
            icon: RefreshCw,
            iconBox: 'icon-box icon-box-blue',
          },
          {
            title: 'RESOLVIDAS',
            value: stats?.resolved || 0,
            icon: CheckCircle,
            iconBox: 'icon-box icon-box-green',
          },
        ].map((stat, index) => {
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
                  {isLoadingStats ? (
                    <Skeleton className="h-9 w-12" />
                  ) : (
                    <p className="text-3xl font-bold text-[var(--text-primary)]">
                      {stat.value}
                    </p>
                  )}
                </div>
                <div className={stat.iconBox}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtro + Info */}
      <div
        className="glass-card p-6 animate-slideUp"
        style={{ animationDelay: '0.4s' }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Filtrar:</span>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as EscalationStatus | 'ALL');
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-44 h-9 glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                <SelectItem value="RESOLVED">Resolvida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {pagination && (
            <p className="text-xs text-[var(--text-muted)]">
              {escalations.length} de {pagination.total} escalacoes
            </p>
          )}
        </div>
      </div>

      {/* Lista */}
      <div
        className="glass-card p-0 animate-slideUp overflow-hidden"
        style={{ animationDelay: '0.5s' }}
      >
        {isLoadingList ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-11 w-11 rounded-ios-xs flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
        ) : escalations.length === 0 ? (
          <div className="py-16 text-center">
            <div className="icon-box icon-box-amber mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Nenhuma escalacao encontrada
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Ajuste os filtros ou aguarde novas escalacoes
            </p>
          </div>
        ) : (
          <div>
            {escalations.map((escalation: Escalation, index: number) => {
              const contact = escalation.conversation?.contact;
              const contactName = contact?.name || contact?.phoneNumber || 'Contato desconhecido';

              return (
                <div
                  key={escalation.id}
                  className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-5 transition-colors hover:bg-[var(--glass-bg-hover)] ${
                    index > 0 ? 'border-t border-[var(--glass-border)]' : ''
                  }`}
                >
                  {/* Avatar / Icon */}
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-ios-xs bg-amber-500/10">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    {/* Linha 1: Nome + Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
                        {contactName}
                      </span>
                      {getStatusBadge(escalation.status)}
                    </div>

                    {/* Linha 2: Motivo */}
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                      {getReasonLabel(escalation.reason)}
                    </p>

                    {/* Linha 3: Detalhe (se existir) */}
                    {escalation.reasonDetail && (
                      <p className="text-xs text-[var(--text-muted)] italic mt-0.5 line-clamp-1">
                        {escalation.reasonDetail}
                      </p>
                    )}

                    {/* Linha 4: Metadados */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(escalation.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>

                      {contact?.phoneNumber && contact?.name && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <Phone className="h-3 w-3" />
                          {contact.phoneNumber}
                        </span>
                      )}

                      {escalation.hotelUnit && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <MapPin className="h-3 w-3" />
                          {escalation.hotelUnit}
                        </span>
                      )}

                      {escalation.conversation?.assignedTo && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <User className="h-3 w-3" />
                          {escalation.conversation.assignedTo.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acao: Alterar status */}
                  <div className="flex-shrink-0">
                    <Select
                      value={escalation.status}
                      onValueChange={(value) =>
                        handleStatusChange(escalation.id, value as EscalationStatus)
                      }
                      disabled={updateMutation.isPending}
                    >
                      <SelectTrigger className="w-40 h-9 text-xs glass-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">Pendente</SelectItem>
                        <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                        <SelectItem value="RESOLVED">Resolvida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginacao */}
      {pagination && pagination.pages > 1 && (
        <div
          className="flex items-center justify-between animate-slideUp"
          style={{ animationDelay: '0.6s' }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={currentPage === 1 || isLoadingList}
            className="glass-btn"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>

          <span className="text-xs text-[var(--text-muted)]">
            Pagina {pagination.page} de {pagination.pages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage >= pagination.pages || isLoadingList}
            className="glass-btn"
          >
            Proxima
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORTED PAGE WITH PROTECTION
// ============================================

export default function EscalationsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HEAD]}>
      <EscalationsPageContent />
    </ProtectedRoute>
  );
}
