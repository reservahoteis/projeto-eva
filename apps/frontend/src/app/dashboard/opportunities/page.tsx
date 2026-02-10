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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Target,
  Search,
  RefreshCw,
  Clock,
  DollarSign,
  UserCheck,
  MessageSquare,
  ArrowRight,
  AlertTriangle,
  Timer,
} from 'lucide-react';
import { formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

function getWindowBorderClass(status: WindowStatus): string {
  switch (status) {
    case 'green': return 'border-l-4 border-l-emerald-500';
    case 'yellow': return 'border-l-4 border-l-amber-500';
    case 'red': return 'border-l-4 border-l-red-500 animate-pulse';
    case 'expired': return 'border-l-4 border-l-slate-600 opacity-60';
    case 'responded': return 'border-l-4 border-l-blue-500';
  }
}

function getWindowRowClass(status: WindowStatus): string {
  switch (status) {
    case 'red': return 'bg-red-500/5';
    case 'expired': return 'opacity-60';
    default: return '';
  }
}

function getWindowBadge(status: WindowStatus, timeRemaining: string) {
  switch (status) {
    case 'green':
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
          <Timer className="h-3 w-3" />
          {timeRemaining}
        </Badge>
      );
    case 'yellow':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" />
          {timeRemaining}
        </Badge>
      );
    case 'red':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px] gap-1 animate-pulse">
          <AlertTriangle className="h-3 w-3" />
          {timeRemaining}
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/30 text-[10px]">
          Expirada
        </Badge>
      );
    case 'responded':
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
          Respondida
        </Badge>
      );
  }
}

// ============================================
// PAGE COMPONENT
// ============================================

type ViewTab = 'all' | 'closing';

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
  const { data: opportunitiesData, isLoading, refetch } = useQuery({
    queryKey: ['opportunities', currentPage, debouncedSearch, selectedStatus],
    queryFn: () =>
      conversationService.list({
        page: currentPage,
        limit: 50, // Carregar mais para filtrar janela no frontend
        search: debouncedSearch || undefined,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        ...(isSales ? {} : { isOpportunity: true }),
      }),
    refetchInterval: 30000, // Refresh a cada 30s para atualizar timers
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
      // Mostrar apenas conversas com janela fechando (yellow, red) ou sem resposta (green)
      // Excluir respondidas e expiradas
      return enriched
        .filter((opp) => opp._windowStatus === 'red' || opp._windowStatus === 'yellow' || opp._windowStatus === 'green')
        .sort((a, b) => {
          // Ordenar por urgencia: red primeiro, depois yellow, depois green
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

  const handleOpenConversation = (id: string) => {
    router.push(`/dashboard/conversations/${id}`);
  };

  const getStatusBadge = (status: ConversationStatus) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      OPEN: { label: 'Nova', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      IN_PROGRESS: { label: 'Em Atendimento', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      WAITING: { label: 'Aguardando', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      CLOSED: { label: 'Convertida', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      BOT_HANDLING: { label: 'Bot', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
      ARCHIVED: { label: 'Arquivada', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    };
    const config = statusConfig[status] ?? { label: status, className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (id: string) => {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const statsCards = [
    {
      title: 'OPORTUNIDADES',
      value: stats?.open || 0,
      icon: Target,
      iconBoxClass: 'icon-box icon-box-purple',
    },
    {
      title: 'EM ATENDIMENTO',
      value: stats?.inProgress || 0,
      icon: Clock,
      iconBoxClass: 'icon-box icon-box-blue',
    },
    {
      title: 'CONVERTIDAS',
      value: stats?.closed || 0,
      icon: DollarSign,
      iconBoxClass: 'icon-box icon-box-green',
    },
    {
      title: 'AGUARDANDO',
      value: stats?.pending || 0,
      icon: UserCheck,
      iconBoxClass: 'icon-box icon-box-amber',
    },
  ];

  const OpportunitiesSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Oportunidades</h1>
            <p className="text-sm md:text-base text-[var(--text-muted)]">
              Clientes que precisam de atendimento humano para fechar reserva
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              className="glass-btn"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
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
                    <p className="text-3xl font-bold text-[var(--text-primary)]">
                      {stat.value}
                    </p>
                  </div>
                  <div className={stat.iconBoxClass}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Window Legend */}
        <div className="glass-card p-4 animate-slideUp flex flex-wrap items-center gap-4 text-xs" style={{ animationDelay: '0.35s' }}>
          <span className="text-[var(--text-muted)] font-medium">Janela Meta 24h:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-[var(--text-secondary)]">&gt;12h restantes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-[var(--text-secondary)]">4-12h restantes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[var(--text-secondary)]">&lt;4h restantes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-[var(--text-secondary)]">Respondida</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-600" />
            <span className="text-[var(--text-secondary)]">Expirada</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.4s' }}>
          {/* View Tabs + Filters */}
          <div className="flex flex-col gap-4 mb-6">
            {/* View Tabs: Todas vs Janela Fechando */}
            <div className="flex items-center gap-3">
              <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as ViewTab)}>
                <TabsList className="bg-[var(--glass-bg-hover)] p-1 h-auto rounded-lg">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">
                    Todas
                  </TabsTrigger>
                  <TabsTrigger value="closing" className="text-xs sm:text-sm relative">
                    Janela Fechando
                    {closingCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                        {closingCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Search + Status Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] h-4 w-4" />
                <Input
                  type="search"
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="glass-input pl-12 h-12"
                />
              </div>
              <Tabs value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v as ConversationStatus | 'all'); setCurrentPage(1); }}>
                <TabsList className="bg-[var(--glass-bg-hover)] p-1 h-auto rounded-lg">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">Todas</TabsTrigger>
                  <TabsTrigger value={ConversationStatus.OPEN} className="text-xs sm:text-sm">Novas</TabsTrigger>
                  <TabsTrigger value={ConversationStatus.IN_PROGRESS} className="text-xs sm:text-sm">Atendendo</TabsTrigger>
                  <TabsTrigger value={ConversationStatus.WAITING} className="text-xs sm:text-sm hidden sm:inline-flex">Aguardando</TabsTrigger>
                  <TabsTrigger value={ConversationStatus.CLOSED} className="text-xs sm:text-sm">Convertidas</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <OpportunitiesSkeleton />
          ) : !opportunities.length ? (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
              {viewTab === 'closing' ? (
                <>
                  <p className="text-lg font-medium mb-1">Nenhuma janela fechando</p>
                  <p className="text-sm">Todas as conversas estao com janela ok ou ja foram respondidas</p>
                </>
              ) : debouncedSearch ? (
                <p>Nenhuma oportunidade encontrada para &quot;{debouncedSearch}&quot;</p>
              ) : (
                <>
                  <p className="text-lg font-medium mb-1">Nenhuma oportunidade no momento</p>
                  <p className="text-sm">Oportunidades aparecem apos o follow-up disparado pelo N8N</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Mobile View - Cards */}
              <div className="md:hidden space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    onClick={() => handleOpenConversation(opp.id)}
                    className={`p-4 rounded-ios-xs border border-[var(--glass-border)] bg-[var(--glass-bg-hover)] cursor-pointer hover:bg-[var(--glass-bg-strong)] transition-all ${getWindowBorderClass(opp._windowStatus)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarFallback style={{ backgroundColor: getAvatarColor(opp.contactId) }}>
                            {getInitials(opp.contact?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">
                            {opp.contact?.name || opp.contact?.phoneNumber || 'Sem nome'}
                          </p>
                          {opp.hotelUnit && (
                            <p className="text-xs text-[var(--text-muted)]">{opp.hotelUnit}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(opp.status)}
                        {getWindowBadge(opp._windowStatus, opp._windowTimeRemaining)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--glass-border)]">
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDistanceToNow(new Date(opp.lastMessageAt), { addSuffix: true, locale: ptBR })}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        {opp.unreadCount > 0 && (
                          <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0">
                            {opp.unreadCount}
                          </Badge>
                        )}
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden md:block rounded-ios-xs overflow-hidden border border-[var(--glass-border)]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[var(--glass-bg-hover)]">
                      <TableHead className="text-[var(--text-secondary)] w-4"></TableHead>
                      <TableHead className="text-[var(--text-secondary)]">Contato</TableHead>
                      <TableHead className="text-[var(--text-secondary)]">Unidade</TableHead>
                      <TableHead className="text-[var(--text-secondary)]">Status</TableHead>
                      <TableHead className="text-[var(--text-secondary)]">Janela Meta</TableHead>
                      <TableHead className="text-[var(--text-secondary)]">Atribuido</TableHead>
                      <TableHead className="text-[var(--text-secondary)] hidden lg:table-cell">Ultima Msg</TableHead>
                      <TableHead className="text-[var(--text-secondary)]">Msgs</TableHead>
                      <TableHead className="text-right text-[var(--text-secondary)]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opportunities.map((opp) => (
                      <TableRow
                        key={opp.id}
                        onClick={() => handleOpenConversation(opp.id)}
                        className={`hover:bg-[var(--glass-bg-hover)] transition-colors cursor-pointer ${getWindowRowClass(opp._windowStatus)}`}
                      >
                        {/* Window indicator bar */}
                        <TableCell className="p-0 w-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`w-1 h-full min-h-[56px] ${
                                opp._windowStatus === 'green' ? 'bg-emerald-500' :
                                opp._windowStatus === 'yellow' ? 'bg-amber-500' :
                                opp._windowStatus === 'red' ? 'bg-red-500 animate-pulse' :
                                opp._windowStatus === 'expired' ? 'bg-slate-600' :
                                'bg-blue-500'
                              }`} />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                              <p>
                                {opp._windowStatus === 'responded' ? 'Conversa respondida' :
                                 opp._windowStatus === 'expired' ? 'Janela expirada - apenas templates' :
                                 `Janela Meta: ${opp._windowTimeRemaining} restantes`}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback style={{ backgroundColor: getAvatarColor(opp.contactId) }}>
                                {getInitials(opp.contact?.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">
                                {opp.contact?.name || 'Sem nome'}
                              </p>
                              <p className="text-sm text-[var(--text-muted)] font-mono">
                                {opp.contact?.phoneNumber}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {opp.hotelUnit ? (
                            <span className="text-sm text-[var(--text-secondary)]">{opp.hotelUnit}</span>
                          ) : (
                            <span className="text-[var(--text-muted)]">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(opp.status)}
                        </TableCell>
                        <TableCell>
                          {getWindowBadge(opp._windowStatus, opp._windowTimeRemaining)}
                        </TableCell>
                        <TableCell>
                          {opp.assignedTo ? (
                            <span className="text-sm text-[var(--text-secondary)]">{opp.assignedTo.name}</span>
                          ) : (
                            <span className="text-amber-400 text-sm">Nao atribuida</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-[var(--text-muted)]">
                            {formatDistanceToNow(new Date(opp.lastMessageAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-[var(--text-muted)]" />
                            {opp.unreadCount > 0 ? (
                              <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0">
                                {opp.unreadCount}
                              </Badge>
                            ) : (
                              <span className="text-sm text-[var(--text-muted)]">0</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
                            <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination */}
          {opportunitiesData && opportunitiesData.pagination.totalPages > 1 && viewTab === 'all' && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-[var(--text-muted)]">
                Mostrando {opportunities.length} de {opportunitiesData.pagination.total} oportunidades
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="glass-btn"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === opportunitiesData.pagination.totalPages}
                  className="glass-btn"
                >
                  Proximo
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
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
