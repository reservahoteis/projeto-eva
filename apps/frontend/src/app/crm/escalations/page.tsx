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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Phone, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Escalation } from '@/types';

// ============================================
// HELPERS
// ============================================

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#FFF7D3', text: '#DB7706', label: 'Pendente' },
  IN_PROGRESS: { bg: '#E6F4FF', text: '#007BE0', label: 'Em Andamento' },
  RESOLVED: { bg: '#E4FAEB', text: '#278F5E', label: 'Resolvida' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['PENDING']!;
  if (!config) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
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
  return labels[reason] ?? reason;
}

// ============================================
// SKELETON
// ============================================

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="border-b" style={{ borderColor: 'var(--outline-gray-1)' }}>
          <TableCell className="py-2.5 pl-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-36" />
            </div>
          </TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-5 w-20 rounded" /></TableCell>
          <TableCell className="py-2.5 hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="py-2.5 pr-4"><Skeleton className="h-7 w-32 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
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
    isFetching,
    isError,
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

  const escalations = escalationsData?.data ?? [];
  const pagination = escalationsData?.pagination;

  const PAGE_SIZE = 20;

  return (
    <div className="flex flex-col h-full">
      {/* ---- Page Header ---- */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Escalacoes
          </h1>
          {!isLoadingList && pagination && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {pagination.total}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={isFetching}
          aria-label="Atualizar"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
            style={{ color: 'var(--ink-gray-5)' }}
          />
        </Button>
      </div>

      {/* ---- Stats Row ---- */}
      <div
        className="grid grid-cols-4 gap-px border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--outline-gray-1)', borderColor: 'var(--outline-gray-1)' }}
      >
        {[
          { label: 'TOTAL', value: stats?.total },
          { label: 'PENDENTES', value: stats?.pending },
          { label: 'EM ANDAMENTO', value: stats?.inProgress },
          { label: 'RESOLVIDAS', value: stats?.resolved },
        ].map((stat) => (
          <div
            key={stat.label}
            className="px-4 py-3"
            style={{ backgroundColor: 'var(--surface-white)' }}
          >
            <p
              className="text-[11px] uppercase tracking-wider font-medium"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              {stat.label}
            </p>
            {isLoadingStats ? (
              <Skeleton className="h-6 w-10 mt-1" />
            ) : (
              <p className="text-lg font-semibold mt-1" style={{ color: 'var(--ink-gray-9)' }}>
                {stat.value ?? 0}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ---- View Controls Bar ---- */}
      <div
        className="flex items-center gap-3 px-5 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--ink-gray-6)' }}>
          Status:
        </span>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as EscalationStatus | 'ALL');
            setCurrentPage(1);
          }}
        >
          <SelectTrigger
            className="h-7 text-xs border rounded w-40"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
            <SelectItem value="RESOLVED">Resolvida</SelectItem>
          </SelectContent>
        </Select>

        {pagination && (
          <span className="ml-auto text-xs" style={{ color: 'var(--ink-gray-5)' }}>
            {escalations.length} de {pagination.total} escalacoes
          </span>
        )}
      </div>

      {/* ---- Table ---- */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow
              className="border-b"
              style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
            >
              <TableHead
                className="py-2 pl-4 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Contato
              </TableHead>

              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Motivo
              </TableHead>

              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Status
              </TableHead>

              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden md:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Atribuido
              </TableHead>

              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Horario
              </TableHead>

              <TableHead
                className="py-2 pr-4 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Acao
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoadingList ? (
              <TableSkeleton />
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-20 text-center">
                  <AlertTriangle
                    className="mx-auto h-8 w-8 mb-3"
                    style={{ color: 'var(--ink-gray-4)' }}
                  />
                  <p className="text-sm mb-2" style={{ color: 'var(--ink-gray-5)' }}>
                    {(error as any)?.response?.data?.message || 'Erro ao carregar escalacoes.'}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleRefresh}
                    style={{ color: 'var(--ink-blue-3)' }}
                  >
                    Tentar novamente
                  </Button>
                </TableCell>
              </TableRow>
            ) : escalations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-20 text-center">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
                    style={{ backgroundColor: 'var(--surface-gray-2)' }}
                  >
                    <AlertTriangle className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
                    Nenhuma escalacao encontrada
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                    Ajuste os filtros ou aguarde novas escalacoes
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              escalations.map((escalation: Escalation) => {
                const contact = escalation.conversation?.contact;
                const contactName = contact?.name || contact?.phoneNumber || 'Contato desconhecido';
                const assignedTo = escalation.conversation?.assignedTo;

                return (
                  <TableRow
                    key={escalation.id}
                    className="border-b transition-colors"
                    style={{ borderColor: 'var(--outline-gray-1)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                    }}
                  >
                    {/* Contato */}
                    <TableCell className="py-2.5 pl-4">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="text-sm font-medium truncate max-w-[180px]"
                          style={{ color: 'var(--ink-gray-8)' }}
                        >
                          {contactName}
                        </span>
                        {contact?.phoneNumber && contact?.name && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px]"
                            style={{ color: 'var(--ink-gray-5)' }}
                          >
                            <Phone className="h-3 w-3" />
                            {contact.phoneNumber}
                          </span>
                        )}
                        {escalation.hotelUnit && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px]"
                            style={{ color: 'var(--ink-gray-5)' }}
                          >
                            <MapPin className="h-3 w-3" />
                            {escalation.hotelUnit}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Motivo */}
                    <TableCell className="py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm" style={{ color: 'var(--ink-gray-7)' }}>
                          {getReasonLabel(escalation.reason)}
                        </span>
                        {escalation.reasonDetail && (
                          <span
                            className="text-[11px] italic line-clamp-1 max-w-[200px]"
                            style={{ color: 'var(--ink-gray-5)' }}
                          >
                            {escalation.reasonDetail}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5">
                      <StatusBadge status={escalation.status} />
                    </TableCell>

                    {/* Atribuido */}
                    <TableCell className="py-2.5 hidden md:table-cell">
                      {assignedTo ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-sm"
                          style={{ color: 'var(--ink-gray-6)' }}
                        >
                          <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ink-gray-4)' }} />
                          {assignedTo.name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-gray-4)' }}>—</span>
                      )}
                    </TableCell>

                    {/* Horario */}
                    <TableCell className="py-2.5 hidden lg:table-cell">
                      <span
                        className="text-sm"
                        style={{ color: 'var(--ink-gray-5)' }}
                        title={escalation.createdAt ? new Date(escalation.createdAt).toLocaleString('pt-BR') : ''}
                      >
                        {escalation.createdAt
                          ? formatDistanceToNow(new Date(escalation.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })
                          : '—'}
                      </span>
                    </TableCell>

                    {/* Acao */}
                    <TableCell className="py-2.5 pr-4">
                      <Select
                        value={escalation.status}
                        onValueChange={(value) =>
                          handleStatusChange(escalation.id, value as EscalationStatus)
                        }
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger
                          className="h-7 text-xs border rounded w-36"
                          style={{
                            borderColor: 'var(--outline-gray-2)',
                            backgroundColor: 'var(--surface-white)',
                            color: 'var(--ink-gray-8)',
                          }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pendente</SelectItem>
                          <SelectItem value="IN_PROGRESS">Em Andamento</SelectItem>
                          <SelectItem value="RESOLVED">Resolvida</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---- Pagination ---- */}
      {pagination && pagination.pages > 1 && (
        <div
          className="flex items-center justify-between px-5 py-2.5 border-t flex-shrink-0"
          style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
        >
          <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, pagination.total)} de {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoadingList}
              aria-label="Pagina anterior"
            >
              <ChevronLeft className="h-4 w-4" style={{ color: 'var(--ink-gray-6)' }} />
            </Button>
            <span className="text-xs px-2" style={{ color: 'var(--ink-gray-6)' }}>
              {pagination.page} / {pagination.pages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded"
              onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={currentPage >= pagination.pages || isLoadingList}
              aria-label="Proxima pagina"
            >
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--ink-gray-6)' }} />
            </Button>
          </div>
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
