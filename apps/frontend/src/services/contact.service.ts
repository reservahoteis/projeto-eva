import { apiClient } from '@/lib/api-client';
import type { Contact, PaginatedResponse } from '@/types';

interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'phoneNumber';
  sortOrder?: 'asc' | 'desc';
}

interface CreateContactData {
  phoneNumber: string;
  name?: string;
  email?: string;
  profilePictureUrl?: string;
  metadata?: Record<string, any>;
}

interface UpdateContactData {
  name?: string;
  email?: string;
  profilePictureUrl?: string | null;
  metadata?: Record<string, any> | null;
}

interface ContactStats {
  total: number;
  withConversations: number;
  withoutConversations: number;
  recentContacts: Contact[];
  lastUpdated: string;
}

class ContactService {
  private get baseUrl(): string {
    return '/api/contacts';
  }

  /**
   * Listar contatos com paginação e busca
   */
  async list(params?: ListContactsParams): Promise<PaginatedResponse<Contact>> {
    try {
      const { data } = await apiClient.get<PaginatedResponse<Contact>>(
        this.baseUrl,
        { params }
      );
      return data;
    } catch (error) {
      console.error('Erro ao listar contatos:', error);
      throw error;
    }
  }

  /**
   * Buscar contato por ID
   */
  async getById(id: string): Promise<Contact> {
    try {
      const { data } = await apiClient.get<Contact>(`${this.baseUrl}/${id}`);
      return data;
    } catch (error) {
      console.error('Erro ao buscar contato:', error);
      throw error;
    }
  }

  /**
   * Buscar contato por número de telefone
   */
  async getByPhone(phoneNumber: string): Promise<Contact> {
    try {
      const { data } = await apiClient.get<Contact>(
        `${this.baseUrl}/phone/${phoneNumber}`
      );
      return data;
    } catch (error) {
      console.error('Erro ao buscar contato por telefone:', error);
      throw error;
    }
  }

  /**
   * Criar novo contato
   */
  async create(contactData: CreateContactData): Promise<Contact> {
    try {
      // DEBUG: Diagnosticar problema de URL
      console.log('=== CREATE CONTACT DEBUG ===');
      console.log('this.baseUrl:', this.baseUrl);
      console.log('typeof this.baseUrl:', typeof this.baseUrl);
      console.log('apiClient.defaults.baseURL:', apiClient.defaults.baseURL);
      console.log('URL final será:', `${apiClient.defaults.baseURL}${this.baseUrl}`);

      // Validação local antes de enviar
      if (!contactData.phoneNumber) {
        throw new Error('Número de telefone é obrigatório');
      }

      // Limpar número (remover caracteres não numéricos)
      const cleanPhone = contactData.phoneNumber.replace(/\D/g, '');

      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        throw new Error('Número de telefone deve ter entre 10 e 15 dígitos');
      }

      const { data } = await apiClient.post<Contact>(this.baseUrl, {
        ...contactData,
        phoneNumber: cleanPhone,
      });

      return data;
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      throw error;
    }
  }

  /**
   * Atualizar contato existente
   */
  async update(id: string, contactData: UpdateContactData): Promise<Contact> {
    try {
      // Filtrar campos undefined
      const cleanData = Object.entries(contactData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key as keyof UpdateContactData] = value;
        }
        return acc;
      }, {} as UpdateContactData);

      if (Object.keys(cleanData).length === 0) {
        throw new Error('Nenhum dado para atualizar');
      }

      const { data } = await apiClient.patch<Contact>(
        `${this.baseUrl}/${id}`,
        cleanData
      );

      return data;
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      throw error;
    }
  }

  /**
   * Deletar contato
   */
  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`);
    } catch (error) {
      console.error('Erro ao deletar contato:', error);
      throw error;
    }
  }

  /**
   * Buscar estatísticas dos contatos
   */
  async getStats(): Promise<ContactStats> {
    try {
      const { data } = await apiClient.get<ContactStats>(`${this.baseUrl}/stats`);
      return data;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Buscar contatos com query de pesquisa
   */
  async search(query: string, limit: number = 10): Promise<Contact[]> {
    try {
      const { data } = await apiClient.get<PaginatedResponse<Contact>>(
        this.baseUrl,
        {
          params: {
            search: query,
            limit,
            page: 1,
          },
        }
      );
      return data.data;
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      throw error;
    }
  }

  /**
   * Verificar se contato existe por número
   */
  async checkExists(phoneNumber: string): Promise<boolean> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      await this.getByPhone(cleanPhone);
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Formatar número de telefone para exibição
   */
  formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Formato brasileiro
    if (cleaned.startsWith('55')) {
      const withoutCountry = cleaned.substring(2);
      if (withoutCountry.length === 11) {
        // Celular: (11) 99999-9999
        return `+55 (${withoutCountry.substring(0, 2)}) ${withoutCountry.substring(2, 7)}-${withoutCountry.substring(7)}`;
      } else if (withoutCountry.length === 10) {
        // Fixo: (11) 9999-9999
        return `+55 (${withoutCountry.substring(0, 2)}) ${withoutCountry.substring(2, 6)}-${withoutCountry.substring(6)}`;
      }
    }

    // Formato internacional genérico
    if (cleaned.length > 10) {
      return `+${cleaned}`;
    }

    return phoneNumber;
  }

  /**
   * Obter iniciais do nome para avatar
   */
  getInitials(name?: string | null): string {
    if (!name) return '?';

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Gerar cor baseada no ID do contato
   */
  getAvatarColor(id: string): string {
    const colors = [
      '#3B82F6', // blue-500
      '#10B981', // emerald-500
      '#8B5CF6', // violet-500
      '#F59E0B', // amber-500
      '#EF4444', // red-500
      '#EC4899', // pink-500
      '#06B6D4', // cyan-500
      '#6366F1', // indigo-500
    ];

    // Usar hash do ID para escolher cor consistente
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }
}

export const contactService = new ContactService();