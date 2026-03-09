'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { conversationService } from '@/services/conversation.service';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { UserRole, ConversationStatus } from '@/types';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Target,
  Search,
  RefreshCw,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';

// ============================================
// META 24H WINDOW HELPERS
// ============================================

const META_WINDOW_HOURS = 24;
const WINDOW_GREEN_THRESHOLD = 12; // > 12h restantes = verde
const WINDOW_YELLOW_THRESHOLD = 4; // 4-12h restantes = amarelo
// < 4h = vermelho

type WindowStatus = 'green' | 'yellow' | 'red' | 'expired' | 'responded';

function getMetaWindowStatus(opp: Conversation): WindowStatus {
  // Se a ultima mensagem e OUTBOUND E foi enviada por humano (userId presente),
  // a conversa esta sendo atendida. Mensagens do sistema (follow-up N8N) nao contam.
  if (opp.lastMessage?.direction === 'OUTBOUND' && opp.lastMessage?.userId) {
    return 'responded';
  }

  // Calcular janela baseado no lastInboundAt
  const lastInbound = opp.lastInboundAt ? new Date(opp.lastInboundAt) : null;
  if (!lastInbound) return 'responded';

  const now = new Date();
  const hoursElapsed = differenceInHours(now, lastInbound);
  const hoursRemaining = META_WINDOW_HOURS - hoursElapsed;

  if (hoursRemaining <= 0) return 'expired';
  if (hoursRemaining <= WINDOW_YELLOW_THRESHOLD) return 'red';
  if (hoursRemaining <= WINDOW_GREEN_THRESHOLD) return 'yellow';
  return 'green';
}

function getWindowTimeRemaining(opp: Conversation): string {
  const lastInbound = opp.lastInboundAt ? new Date(opp.lastInboundAt) : null;
  if (!lastInbound) return '';

  const now = new Date();
  const totalMinutes = META_WINDOW_HOURS * 60 - differenceInMinutes(now, lastInbound);

  if (totalMinutes <= 0) return 'Expirada';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function getWindowBorderStyle(status: WindowStatus): React.CSSProperties {
  switch (status) {
    case 'green':    return { borderLeft: '3px solid #278F5E' };
    case 'yellow':   return { borderLeft: '3px solid #DB7706' };
    case 'red':      return { borderLeft: '3px solid #E03636' };
    case 'expired':  return { borderLeft: '3px solid var(--ink-gray-4)', opacity: 0.6 };
    case 'responded': return { borderLeft: '3px solid #007BE0' };
  }
}

function WindowBadge({ status, timeRemaining }: { status: WindowStatus; timeRemaining: string }) {
  switch (status) {
    case 'green':
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: '#E4FAEB', color: '#278F5E' }}
        >
          {timeRemaining}
        </span>
      );
    case 'yellow':
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: '#FFF7D3', color: '#DB7706' }}
        >
          {timeRemaining}
        </span>
      );
    case 'red':
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: '#FFE7E7', color: '#E03636' }}
        >
          {timeRemaining}
        </span>
      );
    case 'expired':
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
        >
          Expirada
        </span>
      );
    case 'responded':
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: '#E6F4FF', color: '#007BE0' }}
        >
          Respondida
        </span>
      );
  }
}

// ============================================
// STATUS BADGE
// ============================================

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  OPEN:        { label: 'Nova',           bg: '#F3F0FF', text: '#6846E3' },
  IN_PROGRESS: { label: 'Em Atendimento', bg: '#E6F4FF', text: '#007BE0' },
  WAITING:     { label: 'Aguardando',     bg: '#FFF7D3', text: '#DB7706' },
  CLOSED:      { label: 'Convertida',     bg: '#E4FAEB', text: '#278F5E' },
  BOT_HANDLING:{ label: 'Bot',            bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-6)' },
  ARCHIVED:    { label: 'Arquivada',      bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-5)' },
};

function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-6)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

// ============================================
// AVATAR HELPERS
// ============================================

const AVATAR_PALETTE = [
  { bg: '#E6F4FF', text: '#007BE0' },
  { bg: '#E4FAEB', text: '#278F5E' },
  { bg: '#FFF7D3', text: '#DB7706' },
  { bg: '#FFE7E7', text: '#E03636' },
  { bg: '#F3F0FF', text: '#6846E3' },
] as const;

function getAvatarPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0];
}

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').substring(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

// ============================================
// SKELETON
// ============================================

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="border-b" style={{ borderColor: 'var(--outline-gray-1)' }}>
          <TableCell className="py-2.5 w-1 p-0"><div className="w-0.5 h-10" /></TableCell>
          <TableCell className="py-2.5 pl-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-5 w-20 rounded" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-5 w-16 rounded" /></TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="py-2.5 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="py-2.5"><Skeleton className="h-4 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ============================================
// VIEW TYPE
// ============================================

type ViewTab = 'all' | 'closing';

const STATUS_FILTERS: { value: ConversationStatus | 'all'; label: string }[] = [
  { value: 'all',                          label: 'Todos' },
  { value: ConversationStatus.OPEN,        label: 'Novas' },
  { value: ConversationStatus.IN_PROGRESS, label: 'Atendendo' },
  { value: ConversationStatus.WAITING,     label: 'Aguardando' },
  { value: ConversationStatus.CLOSED,      label: 'Convertidas' },
];

// ============================================
// PAGE COMPONENT
// ============================================

function OpportunitiesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const isSales = user?.role === UserRole.SALES;

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<ConversationStatus | 'all'>('all');
  const [viewTab, setViewTab] = useState<ViewTab>('all');

  const debouncedSearch = useDebounce(searchTerm, 500);

  // Query para listar oportunidades
  const { data: opportunitiesData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['opportunities', currentPage, debouncedSearch, selectedStatus],
    queryFn: () =>
      conversationService.list({
        page: currentPage,
        limit: 50,
        search: debouncedSearch || undefined,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        ...(isSales ? {} : { isOpportunity: true }),
      }),
    refetchInterval: 30000,
  });

  // Query para stats
  const { data: stats } = useQuery({
    queryKey: ['conversation-stats'],
    queryFn: () => conversationService.getStats(),
    refetchInterval: 60000,
  });

  // Filtrar e enriquecer conversas com info de janela Meta
  const opportunities = useMemo(() => {
    if (!opportunitiesData?.data) return [];

    const enriched = opportunitiesData.data.map((opp: Conversation) => ({
      ...opp,
      _windowStatus: getMetaWindowStatus(opp),
      _windowTimeRemaining: getWindowTimeRemaining(opp),
    }));

    if (viewTab === 'closing') {
      return enriched
        .filter((opp) => opp._windowStatus === 'red' || opp._windowStatus === 'yellow' || opp._windowStatus === 'green')
        .sort((a, b) => {
          const order = { red: 0, yellow: 1, green: 2, expired: 3, responded: 4 };
          return order[a._windowStatus] - order[b._windowStatus];
        });
    }

    return enriched;
  }, [opportunitiesData, viewTab]);

  // Contar janelas fechando para badge
  const closingCount = useMemo(() => {
    if (!opportunitiesData?.data) return 0;
    return opportunitiesData.data.filter((opp: Conversation) => {
      const status = getMetaWindowStatus(opp);
      return status === 'red' || status === 'yellow';
    }).length;
  }, [opportunitiesData]);

  const totalCount = opportunitiesData?.pagination?.total ?? 0;
  const totalPages = opportunitiesData?.pagination?.totalPages ?? 0;

  const handleOpenConversation = (id: string) => {
    router.push(`/crm/conversations/${id}`);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full">

      {/* ---- Page Header ---- */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Oportunidades
          </h1>
          {!isLoading && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-gray-2)', color: 'var(--ink-gray-5)' }}
            >
              {totalCount}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => refetch()}
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
        style={{ backgroundColor: 'var(--outline-gray-1)' }}
      >
        {[
          { label: 'OPORTUNIDADES', value: stats?.open ?? 0       },
          { label: 'EM ATENDIMENTO', value: stats?.inProgress ?? 0 },
          { label: 'CONVERTIDAS',   value: stats?.closed ?? 0     },
          { label: 'AGUARDANDO',    value: stats?.pending ?? 0    },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3" style={{ backgroundColor: 'var(--surface-white)' }}>
            <p
              className="text-[11px] uppercase tracking-wider font-medium"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              {label}
            </p>
            <p className="text-lg font-semibold mt-1" style={{ color: 'var(--ink-gray-9)' }}>
              {isLoading ? (
                <Skeleton className="h-6 w-10 mt-1" />
              ) : (
                value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* ---- Controls Bar ---- */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
      >
        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--ink-gray-4)' }}
          />
          <Input
            type="search"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8 h-7 text-xs border rounded"
            style={{
              borderColor: 'var(--outline-gray-2)',
              backgroundColor: 'var(--surface-white)',
              color: 'var(--ink-gray-8)',
            }}
          />
        </div>

        {/* View tabs: Todas / Janela Fechando */}
        <div className="flex items-center gap-1 rounded" style={{ backgroundColor: 'var(--surface-gray-2)' }}>
          {([
            { value: 'all' as ViewTab, label: 'Todas' },
            { value: 'closing' as ViewTab, label: 'Janela Fechando' },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setViewTab(tab.value)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors"
              style={
                viewTab === tab.value
                  ? { backgroundColor: 'var(--surface-gray-7)', color: '#fff' }
                  : { color: 'var(--ink-gray-5)', backgroundColor: 'transparent' }
              }
            >
              {tab.label}
              {tab.value === 'closing' && closingCount > 0 && (
                <span
                  className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full"
                  style={{ backgroundColor: '#E03636', color: '#fff' }}
                >
                  {closingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 rounded" style={{ backgroundColor: 'var(--surface-gray-2)' }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setSelectedStatus(f.value); setCurrentPage(1); }}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={
                selectedStatus === f.value
                  ? { backgroundColor: 'var(--surface-gray-7)', color: '#fff' }
                  : { color: 'var(--ink-gray-5)', backgroundColor: 'transparent' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Window legend */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-[11px] font-medium" style={{ color: 'var(--ink-gray-5)' }}>
            Janela Meta 24h:
          </span>
          {[
            { color: '#278F5E', label: '>12h' },
            { color: '#DB7706', label: '4-12h' },
            { color: '#E03636', label: '<4h' },
            { color: '#007BE0', label: 'Respondida' },
            { color: 'var(--ink-gray-4)', label: 'Expirada' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px]" style={{ color: 'var(--ink-gray-5)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow
              className="border-b"
              style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
            >
              {/* Window indicator column — no label */}
              <TableHead className="w-0.5 p-0" />
              <TableHead
                className="py-2 pl-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Contato
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Unidade
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Status
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Janela Meta
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Atribuido
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap hidden lg:table-cell"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Ultima Msg
              </TableHead>
              <TableHead
                className="py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                Msgs
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : opportunities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-20 text-center">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
                    style={{ backgroundColor: 'var(--surface-gray-2)' }}
                  >
                    <Target className="w-6 h-6" style={{ color: 'var(--ink-gray-4)' }} />
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-gray-8)' }}>
                    {viewTab === 'closing'
                      ? 'Nenhuma janela fechando'
                      : debouncedSearch
                      ? `Nenhum resultado para "${debouncedSearch}"`
                      : 'Nenhuma oportunidade no momento'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                    {viewTab === 'closing'
                      ? 'Todas as conversas estao com janela ok ou ja foram respondidas'
                      : 'Oportunidades aparecem apos o follow-up disparado pelo N8N'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              opportunities.map((opp) => {
                const palette = getAvatarPalette(opp.contactId);
                const contactName = opp.contact?.name || opp.contact?.phoneNumber || 'Sem nome';

                return (
                  <TableRow
                    key={opp.id}
                    className="border-b cursor-pointer group"
                    style={{ borderColor: 'var(--outline-gray-1)' }}
                    onClick={() => handleOpenConversation(opp.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                    }}
                  >
                    {/* Window indicator bar */}
                    <TableCell className="p-0 w-0.5">
                      <div
                        className="min-h-[44px] w-0.5"
                        style={getWindowBorderStyle(opp._windowStatus)}
                        title={
                          opp._windowStatus === 'responded'
                            ? 'Conversa respondida'
                            : opp._windowStatus === 'expired'
                            ? 'Janela expirada — apenas templates'
                            : `Janela Meta: ${opp._windowTimeRemaining} restantes`
                        }
                      />
                    </TableCell>

                    {/* Contato */}
                    <TableCell className="py-2.5 pl-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                          style={{ backgroundColor: palette.bg, color: palette.text }}
                        >
                          {getInitials(contactName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--ink-gray-8)' }}>
                            {contactName}
                          </p>
                          {opp.contact?.phoneNumber && (
                            <p className="text-xs font-mono" style={{ color: 'var(--ink-gray-5)' }}>
                              {opp.contact.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Unidade */}
                    <TableCell className="py-2.5">
                      {opp.hotelUnit ? (
                        <span className="text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                          {opp.hotelUnit}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-gray-4)' }}>—</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5">
                      <StatusBadge status={opp.status} />
                    </TableCell>

                    {/* Janela Meta */}
                    <TableCell className="py-2.5">
                      <WindowBadge status={opp._windowStatus} timeRemaining={opp._windowTimeRemaining} />
                    </TableCell>

                    {/* Atribuido */}
                    <TableCell className="py-2.5 hidden lg:table-cell">
                      {opp.assignedTo ? (
                        <span className="text-sm" style={{ color: 'var(--ink-gray-6)' }}>
                          {opp.assignedTo.name}
                        </span>
                      ) : (
                        <span className="text-sm" style={{ color: '#DB7706' }}>
                          Nao atribuida
                        </span>
                      )}
                    </TableCell>

                    {/* Ultima Msg */}
                    <TableCell className="py-2.5 hidden lg:table-cell">
                      <span className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
                        {opp.lastMessageAt
                          ? formatDistanceToNow(new Date(opp.lastMessageAt), { addSuffix: true, locale: ptBR })
                          : '—'}
                      </span>
                    </TableCell>

                    {/* Msgs */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--ink-gray-4)' }} />
                        {opp.unreadCount > 0 ? (
                          <span
                            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-semibold"
                            style={{ backgroundColor: '#FFE7E7', color: '#E03636' }}
                          >
                            {opp.unreadCount}
                          </span>
                        ) : (
                          <span className="text-sm tabular-nums" style={{ color: 'var(--ink-gray-5)' }}>
                            0
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---- Pagination ---- */}
      {totalPages > 1 && viewTab === 'all' && (
        <div
          className="flex items-center justify-between px-5 py-2.5 border-t flex-shrink-0"
          style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-gray-1)' }}
        >
          <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
            {opportunities.length} de {totalCount} oportunidades
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Pagina anterior"
            >
              <ChevronLeft className="h-4 w-4" style={{ color: 'var(--ink-gray-6)' }} />
            </Button>
            <span className="text-xs px-2" style={{ color: 'var(--ink-gray-6)' }}>
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
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

// HEAD e SALES podem acessar, alem de admins
export default function OpportunitiesPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HEAD, UserRole.SALES]}>
      <OpportunitiesPageContent />
    </ProtectedRoute>
  );
}
