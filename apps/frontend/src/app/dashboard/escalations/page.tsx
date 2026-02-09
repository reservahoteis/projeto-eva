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
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Escalation } from '@/types';

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusBadge(status: string) {
  const variants = {
    PENDING: { variant: 'warning' as const, label: 'Pendente' },
    IN_PROGRESS: { variant: 'info' as const, label: 'Em Andamento' },
    RESOLVED: { variant: 'success' as const, label: 'Resolvida' },
  };

  const config = variants[status as keyof typeof variants] || variants.PENDING;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ============================================
// MAIN COMPONENT
// ============================================

function EscalationsPageContent() {
  const queryClient = useQueryClient();

  // Estados locais
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | 'ALL'>('ALL');

  // Query: Estatisticas
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['escalations-stats'],
    queryFn: () => escalationService.getStats(),
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  // Query: Lista de escalacoes
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

  // Mutation: Atualizar escalacao
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEscalationPayload }) =>
      escalationService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalations'] });
      queryClient.invalidateQueries({ queryKey: ['escalations-stats'] });
      toast.success('Escalação atualizada com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar escalação');
    },
  });

  // Handlers
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['escalations'] });
    queryClient.invalidateQueries({ queryKey: ['escalations-stats'] });
    toast.success('Dados atualizados');
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleStatusChange = (escalationId: string, newStatus: EscalationStatus) => {
    updateMutation.mutate({
      id: escalationId,
      payload: { status: newStatus },
    });
  };

  // Loading states
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-4 text-lg font-semibold">Erro ao carregar escalações</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as any)?.response?.data?.message || 'Tente novamente mais tarde'}
          </p>
          <Button onClick={handleRefresh} className="mt-4" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Escalações</h1>
          <p className="text-muted-foreground">
            Gerencie escalações de conversas para atendimento humano
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total */}
        <div className="glass-kpi animate-slideUp">
          <div className="icon-box icon-box-purple">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total de Escalações</p>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <h3 className="text-2xl font-bold">{stats?.total || 0}</h3>
            )}
          </div>
        </div>

        {/* Pendentes */}
        <div className="glass-kpi animate-slideUp" style={{ animationDelay: '100ms' }}>
          <div className="icon-box icon-box-yellow">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <h3 className="text-2xl font-bold">{stats?.pending || 0}</h3>
            )}
          </div>
        </div>

        {/* Em Andamento */}
        <div className="glass-kpi animate-slideUp" style={{ animationDelay: '200ms' }}>
          <div className="icon-box icon-box-blue">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Em Andamento</p>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <h3 className="text-2xl font-bold">{stats?.inProgress || 0}</h3>
            )}
          </div>
        </div>

        {/* Resolvidas */}
        <div className="glass-kpi animate-slideUp" style={{ animationDelay: '300ms' }}>
          <div className="icon-box icon-box-green">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Resolvidas</p>
            {isLoadingStats ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <h3 className="text-2xl font-bold">{stats?.resolved || 0}</h3>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card animate-slideUp" style={{ animationDelay: '400ms' }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Filtro Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as EscalationStatus | 'ALL');
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                  <SelectItem value="RESOLVED">Resolvida</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Info de resultados */}
          <div className="text-sm text-muted-foreground">
            {escalationsData && (
              <span>
                Mostrando {escalationsData.data.length} de {escalationsData.total} escalações
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Escalacoes */}
      <div className="glass-card animate-slideUp" style={{ animationDelay: '500ms' }}>
        {isLoadingList ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : escalationsData && escalationsData.data.length === 0 ? (
          <div className="py-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma escalação encontrada</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou aguarde novas escalações
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {escalationsData?.data.map((escalation: Escalation) => (
              <div key={escalation.id} className="flex items-center gap-4 p-4 hover:bg-accent/5">
                {/* Icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>

                {/* Informacoes */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{escalation.reason}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Criada{' '}
                    {formatDistanceToNow(new Date(escalation.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                  {escalation.reasonDetail && (
                    <p className="mt-1 text-sm text-muted-foreground italic">{escalation.reasonDetail}</p>
                  )}
                </div>

                {/* Status e Ações */}
                <div className="flex items-center gap-3">
                  {getStatusBadge(escalation.status)}
                  <Select
                    value={escalation.status}
                    onValueChange={(value) =>
                      handleStatusChange(escalation.id, value as EscalationStatus)
                    }
                    disabled={updateMutation.isPending}
                  >
                    <SelectTrigger className="w-40">
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
            ))}
          </div>
        )}
      </div>

      {/* Paginacao */}
      {escalationsData && escalationsData.pages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoadingList}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            Página {escalationsData.page} de {escalationsData.pages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= escalationsData.pages || isLoadingList}
          >
            Próxima
            <ChevronRight className="ml-2 h-4 w-4" />
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
