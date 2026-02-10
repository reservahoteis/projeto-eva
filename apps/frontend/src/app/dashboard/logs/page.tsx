'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogService, type AuditLogDetail } from '@/services/audit-log.service';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ScrollText,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Shield,
  Activity,
  Eye,
  AlertOctagon,
  FileText,
  Terminal,
} from 'lucide-react';

type TabView = 'events' | 'errors';

function LogsPageContent() {
  const [tab, setTab] = useState<TabView>('events');
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const limit = 20;

  // Query para eventos (todos os logs)
  const {
    data: logsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['audit-logs', tab, page, actionFilter, entityFilter],
    queryFn: () => {
      if (tab === 'errors') {
        // Na aba de erros, buscar apenas logs de erro
        return auditLogService.list({
          page,
          limit,
          entity: entityFilter !== 'all' ? entityFilter : undefined,
        });
      }
      return auditLogService.list({
        page,
        limit,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entity: entityFilter !== 'all' ? entityFilter : undefined,
      });
    },
  });

  const handleViewDetail = async (id: string) => {
    try {
      const detail = await auditLogService.getById(id);
      setSelectedLog(detail);
      setIsDetailOpen(true);
    } catch {
      // silently fail
    }
  };

  const handleTabChange = (newTab: TabView) => {
    setTab(newTab);
    setPage(1);
    setActionFilter('all');
    setEntityFilter('all');
  };

  const allLogs = logsData?.data || [];
  // Na aba de erros, filtrar client-side para mostrar apenas erros
  const logs =
    tab === 'errors'
      ? allLogs.filter(
          (l) =>
            l.action.includes('ERROR') ||
            l.action.includes('FAILED') ||
            l.action === 'ESCALATION' ||
            l.action === 'CLIENT_ERROR'
        )
      : allLogs;
  const totalPages = logsData?.pages || 1;
  const total = logsData?.total || 0;

  const firstLog = logs.length > 0 ? logs[0] : undefined;

  // Contadores rapidos
  const errorCount = allLogs.filter(
    (l) => l.action.includes('ERROR') || l.action.includes('FAILED')
  ).length;
  const authCount = allLogs.filter(
    (l) => l.action === 'LOGIN' || l.action === 'LOGOUT' || l.action === 'LOGIN_FAILED'
  ).length;

  const statsCards = [
    {
      title: 'TOTAL DE LOGS',
      value: total,
      icon: ScrollText,
      iconBoxClass: 'icon-box icon-box-blue',
      subtitle: 'Registros no sistema',
    },
    {
      title: 'ERROS DETECTADOS',
      value: errorCount,
      icon: AlertTriangle,
      iconBoxClass: 'icon-box icon-box-rose',
      subtitle: `Nesta pagina`,
    },
    {
      title: 'EVENTOS AUTH',
      value: authCount,
      icon: Shield,
      iconBoxClass: 'icon-box icon-box-amber',
      subtitle: 'Login/Logout',
    },
    {
      title: 'ATIVIDADE',
      value: firstLog ? auditLogService.formatRelativeTime(firstLog.createdAt) : '-',
      icon: Activity,
      iconBoxClass: 'icon-box icon-box-green',
      subtitle: 'Ultimo registro',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
            Logs do Sistema
          </h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">
            Auditoria, eventos e erros do sistema
          </p>
        </div>
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

      {/* Stats */}
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
                    {isLoading ? <Skeleton className="h-10 w-16" /> : stat.value}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{stat.subtitle}</p>
                </div>
                <div className={stat.iconBoxClass}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs + Filters */}
      <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.4s' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          {/* Tab buttons */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--glass-bg-strong)]">
            <button
              onClick={() => handleTabChange('events')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'events'
                  ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FileText className="w-4 h-4" />
              Eventos
            </button>
            <button
              onClick={() => handleTabChange('errors')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'errors'
                  ? 'bg-red-500/20 text-red-400 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              Erros do Sistema
              {errorCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {errorCount}
                </span>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={entityFilter}
              onValueChange={(v) => {
                setEntityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px] glass-input">
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent className="glass-card border-[var(--glass-border)]">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="User">Usuarios</SelectItem>
                <SelectItem value="Conversation">Conversas</SelectItem>
                <SelectItem value="Contact">Contatos</SelectItem>
                <SelectItem value="Message">Mensagens</SelectItem>
                <SelectItem value="Tag">Tags</SelectItem>
                <SelectItem value="Auth">Auth</SelectItem>
                <SelectItem value="Webhook">Webhook</SelectItem>
                <SelectItem value="N8N">N8N</SelectItem>
                <SelectItem value="Frontend">Frontend</SelectItem>
              </SelectContent>
            </Select>
            {tab === 'events' && (
              <Select
                value={actionFilter}
                onValueChange={(v) => {
                  setActionFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[130px] glass-input">
                  <SelectValue placeholder="Acao" />
                </SelectTrigger>
                <SelectContent className="glass-card border-[var(--glass-border)]">
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                  <SelectItem value="LOGIN_FAILED">Login falhou</SelectItem>
                  <SelectItem value="CREATE_USER">Criar usuario</SelectItem>
                  <SelectItem value="UPDATE_USER">Atualizar usuario</SelectItem>
                  <SelectItem value="DELETE_USER">Remover usuario</SelectItem>
                  <SelectItem value="CLOSE_CONVERSATION">Fechar conversa</SelectItem>
                  <SelectItem value="ASSIGN_CONVERSATION">Atribuir conversa</SelectItem>
                  <SelectItem value="WEBHOOK_ERROR">Erro webhook</SelectItem>
                  <SelectItem value="MESSAGE_SEND_FAILED">Falha envio</SelectItem>
                  <SelectItem value="N8N_ERROR">Erro N8N</SelectItem>
                  <SelectItem value="ESCALATION">Escalacao</SelectItem>
                  <SelectItem value="CLIENT_ERROR">Erro Frontend</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {tab === 'events' ? 'Registros de Auditoria' : 'Erros e Falhas do Sistema'}
          </h2>
          {logsData && (
            <span className="text-xs text-[var(--text-muted)]">
              {tab === 'errors' ? `${logs.length} erros` : `${total} registros`} | Pagina{' '}
              {page} de {totalPages}
            </span>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            {tab === 'errors' ? (
              <>
                <AlertOctagon className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-primary)] font-medium">
                  Nenhum erro detectado
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  O sistema esta funcionando normalmente
                </p>
              </>
            ) : (
              <>
                <ScrollText className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-muted)]">Nenhum log encontrado</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Ajuste os filtros ou aguarde novas atividades
                </p>
              </>
            )}
          </div>
        ) : tab === 'errors' ? (
          /* ===== ERROS DO SISTEMA - Vista detalhada inline ===== */
          <div className="space-y-3">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className="rounded-ios-xs border border-red-500/20 bg-red-500/5 overflow-hidden animate-slideUp"
                style={{ animationDelay: `${0.4 + index * 0.03}s` }}
              >
                {/* Error header */}
                <div className="flex items-center gap-3 p-3 bg-red-500/10">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-medium px-2 py-0.5 ${auditLogService.getActionColor(log.action)}`}
                  >
                    {auditLogService.getActionLabel(log.action)}
                  </Badge>
                  <span className="text-xs text-[var(--text-muted)]">
                    {auditLogService.getEntityLabel(log.entity)}
                  </span>
                  {log.entityId && (
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      {log.entityId.substring(0, 8)}...
                    </span>
                  )}
                  <span className="ml-auto text-xs text-[var(--text-muted)]">
                    {auditLogService.formatDate(log.createdAt)}
                  </span>
                  <button
                    onClick={() => handleViewDetail(log.id)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>
                {/* Error details - raw log inline */}
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="p-3 border-t border-red-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="w-3 h-3 text-red-400" />
                      <span className="text-[10px] font-semibold text-red-400 tracking-wider">
                        LOG REAL
                      </span>
                    </div>
                    <pre className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--glass-bg-strong)] p-3 rounded-lg overflow-x-auto max-h-32 scrollbar-thin">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ===== EVENTOS - Vista formatada explicativa ===== */
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-3 rounded-ios-xs bg-[var(--glass-bg-hover)] hover:bg-[var(--glass-bg-strong)] transition-colors cursor-pointer animate-slideUp"
                style={{ animationDelay: `${0.4 + index * 0.02}s` }}
                onClick={() => handleViewDetail(log.id)}
              >
                {/* Action badge */}
                <div className="flex-shrink-0">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-medium px-2 py-0.5 ${auditLogService.getActionColor(log.action)}`}
                  >
                    {auditLogService.getActionLabel(log.action)}
                  </Badge>
                </div>

                {/* Entity */}
                <div className="flex-shrink-0">
                  <span className="text-xs text-[var(--text-muted)]">
                    {auditLogService.getEntityLabel(log.entity)}
                  </span>
                </div>

                {/* Entity ID (truncated) */}
                <div className="flex-1 min-w-0">
                  {log.entityId && (
                    <span className="text-xs text-[var(--text-muted)] font-mono truncate block">
                      {log.entityId.substring(0, 8)}...
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-[var(--text-muted)]">
                    {auditLogService.formatRelativeTime(log.createdAt)}
                  </p>
                </div>

                {/* View detail button */}
                <div className="flex-shrink-0">
                  <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="glass-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-[var(--text-muted)] px-3">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="glass-btn"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl glass-card max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              Detalhe do Log
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                    ACAO
                  </p>
                  <Badge
                    variant="secondary"
                    className={`${auditLogService.getActionColor(selectedLog.action)}`}
                  >
                    {auditLogService.getActionLabel(selectedLog.action)}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                    ENTIDADE
                  </p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {auditLogService.getEntityLabel(selectedLog.entity)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                    DATA/HORA
                  </p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {auditLogService.formatDate(selectedLog.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                    ID DA ENTIDADE
                  </p>
                  <p className="text-sm text-[var(--text-primary)] font-mono">
                    {selectedLog.entityId || '-'}
                  </p>
                </div>
                {selectedLog.userId && (
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                      USUARIO
                    </p>
                    <p className="text-sm text-[var(--text-primary)] font-mono">
                      {selectedLog.userId.substring(0, 8)}...
                    </p>
                  </div>
                )}
                {selectedLog.tenantId && (
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-1">
                      TENANT
                    </p>
                    <p className="text-sm text-[var(--text-primary)] font-mono">
                      {selectedLog.tenantId.substring(0, 8)}...
                    </p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-3 h-3 text-[var(--text-muted)]" />
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider">
                      LOG REAL / METADATA
                    </p>
                  </div>
                  <pre className="text-xs text-[var(--text-secondary)] bg-[var(--glass-bg-strong)] p-3 rounded-lg overflow-x-auto max-h-48 scrollbar-thin">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Old Data */}
              {selectedLog.oldData && Object.keys(selectedLog.oldData).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-red-400 tracking-wider mb-2">
                    DADOS ANTERIORES
                  </p>
                  <pre className="text-xs text-[var(--text-secondary)] bg-red-500/5 border border-red-500/10 p-3 rounded-lg overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.oldData, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Data */}
              {selectedLog.newData && Object.keys(selectedLog.newData).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-emerald-400 tracking-wider mb-2">
                    DADOS NOVOS
                  </p>
                  <pre className="text-xs text-[var(--text-secondary)] bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.newData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LogsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]}>
      <LogsPageContent />
    </ProtectedRoute>
  );
}
