/**
 * Escalation Service
 *
 * Frontend service para gerenciar escalacoes do CRM
 * Comunicacao com endpoints /api/escalations
 *
 * @usage
 * import { escalationService } from '@/services/escalation.service';
 * const stats = await escalationService.getStats();
 * const escalations = await escalationService.list({ page: 1, limit: 20 });
 */

import api from '@/lib/axios';
import type { Escalation } from '@/types';

// ============================================
// TYPES
// ============================================

export enum EscalationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum EscalationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export interface EscalationListParams {
  page?: number;
  limit?: number;
  status?: EscalationStatus;
  priority?: EscalationPriority;
}

export interface EscalationListResponse {
  data: Escalation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface EscalationStats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  avgResolutionTime?: number; // em minutos
}

export interface UpdateEscalationPayload {
  status?: EscalationStatus;
  assignedToId?: string;
  notes?: string;
}

// ============================================
// SERVICE
// ============================================

class EscalationService {
  private readonly baseUrl = '/api/escalations';

  /**
   * Lista escalacoes com filtros e paginacao
   * GET /api/escalations
   */
  async list(params?: EscalationListParams): Promise<EscalationListResponse> {
    const { data } = await api.get<EscalationListResponse>(this.baseUrl, { params });
    return data;
  }

  /**
   * Obtem estatisticas de escalacoes
   * GET /api/escalations/stats
   */
  async getStats(): Promise<EscalationStats> {
    const { data } = await api.get<EscalationStats>(`${this.baseUrl}/stats`);
    return data;
  }

  /**
   * Obtem detalhes de uma escalacao
   * GET /api/escalations/:id
   */
  async getById(id: string): Promise<Escalation> {
    const { data } = await api.get<Escalation>(`${this.baseUrl}/${id}`);
    return data;
  }

  /**
   * Atualiza uma escalacao (status, assignedTo, notes)
   * PATCH /api/escalations/:id
   */
  async update(id: string, payload: UpdateEscalationPayload): Promise<Escalation> {
    const { data } = await api.patch<Escalation>(`${this.baseUrl}/${id}`, payload);
    return data;
  }
}

export const escalationService = new EscalationService();
