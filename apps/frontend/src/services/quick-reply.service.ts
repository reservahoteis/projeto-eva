import api from '@/lib/axios';
import type { QuickReply } from '@/types';

interface ListQuickRepliesParams {
  search?: string;
  category?: string;
  isActive?: boolean;
}

/** Resposta do GET /api/quick-replies - backend retorna array simples sem paginacao */
export interface QuickReplyListResponse {
  data: QuickReply[];
}

interface CreateQuickReplyData {
  title: string;
  shortcut: string;
  content: string;
  category?: string;
  order?: number;
}

interface UpdateQuickReplyData {
  title?: string;
  shortcut?: string;
  content?: string;
  category?: string;
  order?: number;
  isActive?: boolean;
}

const BASE_URL = '/api/quick-replies' as const;

class QuickReplyService {
  async list(params?: ListQuickRepliesParams): Promise<QuickReplyListResponse> {
    const { data } = await api.get<QuickReplyListResponse>(BASE_URL, { params });
    return data;
  }

  async getById(id: string): Promise<QuickReply> {
    const { data } = await api.get<QuickReply>(`${BASE_URL}/${id}`);
    return data;
  }

  async create(quickReplyData: CreateQuickReplyData): Promise<QuickReply> {
    const { data } = await api.post<QuickReply>(BASE_URL, quickReplyData);
    return data;
  }

  async update(id: string, quickReplyData: UpdateQuickReplyData): Promise<QuickReply> {
    const { data } = await api.patch<QuickReply>(`${BASE_URL}/${id}`, quickReplyData);
    return data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${BASE_URL}/${id}`);
  }
}

export const quickReplyService = new QuickReplyService();
