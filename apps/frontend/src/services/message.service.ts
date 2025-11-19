import api from '@/lib/axios';
import { Message, MessageType, PaginatedResponse } from '@/types';

interface ListMessagesParams {
  page?: number;
  limit?: number;
}

interface SendMessageRequest {
  conversationId: string;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
}

/**
 * Message service
 */
export const messageService = {
  /**
   * List messages for a conversation
   */
  async list(conversationId: string, params?: ListMessagesParams): Promise<PaginatedResponse<Message>> {
    const { data } = await api.get<PaginatedResponse<Message>>(
      `/api/conversations/${conversationId}/messages`,
      {
        params,
      }
    );
    return data;
  },

  /**
   * Send message
   */
  async send(payload: SendMessageRequest): Promise<Message> {
    const { conversationId, ...messageData } = payload;
    const { data } = await api.post<Message>(
      `/api/conversations/${conversationId}/messages`,
      messageData
    );
    return data;
  },

  /**
   * Mark message as read
   */
  async markAsRead(id: string): Promise<void> {
    await api.post(`/api/messages/${id}/read`);
  },

  /**
   * Upload media (for sending images/videos/documents)
   */
  async uploadMedia(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/api/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },
};
