import api from '@/lib/axios';

const AUDIT_LOG_API_BASE_URL = '/api/audit-logs' as const;

export interface AuditLogSummary {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogDetail extends AuditLogSummary {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

export interface AuditLogListResponse {
  data: AuditLogSummary[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuditLogListParams {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

class AuditLogService {
  async list(params?: AuditLogListParams): Promise<AuditLogListResponse> {
    const { data } = await api.get<AuditLogListResponse>(
      AUDIT_LOG_API_BASE_URL,
      { params }
    );
    return data;
  }

  async getById(id: string): Promise<AuditLogDetail> {
    const { data } = await api.get<AuditLogDetail>(
      `${AUDIT_LOG_API_BASE_URL}/${id}`
    );
    return data;
  }

  /**
   * Reportar erro client-side para o backend (fire-and-forget)
   */
  async reportClientError(error: {
    message: string;
    stack?: string;
    componentStack?: string;
    url?: string;
  }): Promise<void> {
    try {
      await api.post(`${AUDIT_LOG_API_BASE_URL}/client-error`, {
        message: error.message,
        stack: error.stack?.substring(0, 5000),
        componentStack: error.componentStack?.substring(0, 5000),
        url: error.url || (typeof window !== 'undefined' ? window.location.href : undefined),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
    } catch {
      // Fire-and-forget - nao bloqueia o usuario
    }
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      CREATE_USER: 'Usuário criado',
      UPDATE_USER: 'Usuário atualizado',
      DELETE_USER: 'Usuário removido',
      CREATE_CONVERSATION: 'Conversa criada',
      UPDATE_CONVERSATION: 'Conversa atualizada',
      CLOSE_CONVERSATION: 'Conversa fechada',
      ASSIGN_CONVERSATION: 'Conversa atribuída',
      UNASSIGN_CONVERSATION: 'Conversa desatribuída',
      CREATE_CONTACT: 'Contato criado',
      UPDATE_CONTACT: 'Contato atualizado',
      DELETE_CONTACT: 'Contato removido',
      CREATE_TAG: 'Tag criada',
      UPDATE_TAG: 'Tag atualizada',
      DELETE_TAG: 'Tag removida',
      LOGIN: 'Login',
      LOGOUT: 'Logout',
      LOGIN_FAILED: 'Login falhou',
      WEBHOOK_ERROR: 'Erro no webhook',
      MESSAGE_SEND_FAILED: 'Falha ao enviar mensagem',
      N8N_ERROR: 'Erro N8N',
      ESCALATION: 'Escalação',
      IA_LOCK: 'IA bloqueada',
      IA_UNLOCK: 'IA desbloqueada',
      CLIENT_ERROR: 'Erro no Frontend',
    };
    return labels[action] || action;
  }

  getActionColor(action: string): string {
    if (action.includes('DELETE') || action.includes('FAILED') || action.includes('ERROR')) {
      return 'text-red-500 bg-red-500/10';
    }
    if (action.includes('CREATE') || action === 'LOGIN') {
      return 'text-emerald-500 bg-emerald-500/10';
    }
    if (action.includes('UPDATE') || action.includes('ASSIGN')) {
      return 'text-blue-500 bg-blue-500/10';
    }
    if (action.includes('CLOSE') || action === 'LOGOUT') {
      return 'text-amber-500 bg-amber-500/10';
    }
    if (action.includes('ESCALATION') || action.includes('LOCK')) {
      return 'text-purple-500 bg-purple-500/10';
    }
    return 'text-slate-500 bg-slate-500/10';
  }

  getEntityLabel(entity: string): string {
    const labels: Record<string, string> = {
      User: 'Usuário',
      Conversation: 'Conversa',
      Contact: 'Contato',
      Message: 'Mensagem',
      Tag: 'Tag',
      Tenant: 'Tenant',
      Auth: 'Autenticação',
      Webhook: 'Webhook',
      N8N: 'N8N',
      Frontend: 'Frontend',
    };
    return labels[entity] || entity;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHour < 24) return `${diffHour}h atrás`;
    if (diffDay < 7) return `${diffDay}d atrás`;
    return date.toLocaleDateString('pt-BR');
  }
}

export const auditLogService = new AuditLogService();
