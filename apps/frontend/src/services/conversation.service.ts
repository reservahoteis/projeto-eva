import api from '@/lib/axios';
import { Conversation, ConversationStatus, PaginatedResponse } from '@/types';

interface ListConversationsParams {
  page?: number;
  limit?: number;
  status?: ConversationStatus;
  assignedToId?: string;
  isOpportunity?: boolean;
  search?: string;
}

interface UpdateConversationRequest {
  status?: ConversationStatus;
  assignedToId?: string;
}

/**
 * Conversation service (Tenant users)
 */
export const conversationService = {
  /**
   * List conversations
   */
  async list(params?: ListConversationsParams): Promise<PaginatedResponse<Conversation>> {
    const { data } = await api.get<PaginatedResponse<Conversation>>('/api/v1/conversations', {
      params,
    });
    return data;
  },

  /**
   * Get conversation by ID (with messages)
   */
  async getById(id: string): Promise<Conversation> {
    const { data } = await api.get<Conversation>(`/api/v1/conversations/${id}`);
    return data;
  },

  /**
   * Update conversation
   */
  async update(id: string, payload: UpdateConversationRequest): Promise<Conversation> {
    const { data } = await api.patch<Conversation>(`/api/v1/conversations/${id}`, payload);
    return data;
  },

  /**
   * Assign conversation to user
   */
  async assign(id: string, userId: string): Promise<Conversation> {
    const { data } = await api.post<Conversation>(`/api/v1/conversations/${id}/assign`, {
      userId,
    });
    return data;
  },

  /**
   * Unassign conversation (remove assignee)
   */
  async unassign(id: string): Promise<Conversation> {
    const { data } = await api.post<Conversation>(`/api/v1/conversations/${id}/unassign`);
    return data;
  },

  /**
   * Close conversation
   */
  async close(id: string): Promise<Conversation> {
    const { data } = await api.post<Conversation>(`/api/v1/conversations/${id}/close`);
    return data;
  },

  /**
   * Get conversation statistics
   */
  async getStats(): Promise<{
    total: number;
    open: number;
    pending: number;
    inProgress: number;
    resolved: number;
    closed: number;
  }> {
    const { data } = await api.get('/api/v1/conversations/stats');
    return data;
  },

  /**
   * Toggle IA lock on conversation
   * When locked, the AI will not respond to this conversation
   */
  async toggleIaLock(id: string, locked: boolean): Promise<Conversation> {
    const { data } = await api.patch<Conversation>(`/api/v1/conversations/${id}/ia-lock`, {
      locked,
    });
    return data;
  },

  /**
   * Mark all messages in conversation as read
   * Resets unread count to 0
   */
  async markAsRead(id: string): Promise<void> {
    await api.post(`/api/v1/conversations/${id}/read`);
  },

  /**
   * Archive conversation
   * Moves conversation to ARCHIVED status
   */
  async archive(id: string): Promise<Conversation> {
    const { data } = await api.post<Conversation>(`/api/v1/conversations/${id}/archive`);
    return data;
  },

  /**
   * Delete conversation permanently
   * This action cannot be undone
   */
  async delete(id: string): Promise<{ success: boolean; id: string }> {
    const { data } = await api.delete<{ success: boolean; id: string }>(`/api/v1/conversations/${id}`);
    return data;
  },
};
