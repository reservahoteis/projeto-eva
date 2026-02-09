import api from '@/lib/axios';
import type { Tag } from '@/types';

interface ListTagsParams {
  search?: string;
}

/** Resposta do GET /api/tags - backend retorna array simples sem paginacao */
export interface TagListResponse {
  data: Tag[];
}

interface CreateTagData {
  name: string;
  color?: string;
  description?: string;
}

interface UpdateTagData {
  name?: string;
  color?: string;
  description?: string;
}

// Constante fora da classe para evitar minificação
const TAG_API_BASE_URL = '/api/tags' as const;

class TagService {
  /**
   * Listar tags com busca (backend retorna array completo, sem paginacao)
   */
  async list(params?: ListTagsParams): Promise<TagListResponse> {
    try {
      const { data } = await api.get<TagListResponse>(
        TAG_API_BASE_URL,
        { params }
      );
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Buscar tag por ID
   */
  async getById(id: string): Promise<Tag> {
    try {
      const { data } = await api.get<Tag>(`${TAG_API_BASE_URL}/${id}`);
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Criar nova tag
   */
  async create(tagData: CreateTagData): Promise<Tag> {
    try {
      // Validação local antes de enviar
      if (!tagData.name || tagData.name.trim().length === 0) {
        throw new Error('Nome da tag é obrigatório');
      }

      if (tagData.name.length > 50) {
        throw new Error('Nome da tag deve ter no máximo 50 caracteres');
      }

      const { data } = await api.post<Tag>(TAG_API_BASE_URL, tagData);
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Atualizar tag existente
   */
  async update(id: string, tagData: UpdateTagData): Promise<Tag> {
    try {
      // Filtrar campos undefined
      const cleanData = Object.entries(tagData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key as keyof UpdateTagData] = value;
        }
        return acc;
      }, {} as UpdateTagData);

      if (Object.keys(cleanData).length === 0) {
        throw new Error('Nenhum dado para atualizar');
      }

      const { data } = await api.patch<Tag>(
        `${TAG_API_BASE_URL}/${id}`,
        cleanData
      );

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deletar tag
   */
  async delete(id: string): Promise<void> {
    try {
      await api.delete(`${TAG_API_BASE_URL}/${id}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validar cor hexadecimal
   */
  isValidHexColor(color: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  }

  /**
   * Obter iniciais do nome da tag para badge
   */
  getInitials(name: string): string {
    if (!name) return '?';

    const parts = name.trim().split(/\s+/);
    const firstPart = parts[0];
    const secondPart = parts[1];

    if (!firstPart) return '?';

    if (parts.length === 1) {
      return firstPart.substring(0, 2).toUpperCase();
    }

    const firstChar = firstPart[0] ?? '';
    const secondChar = secondPart?.[0] ?? '';
    return (firstChar + secondChar).toUpperCase();
  }

  /**
   * Calcular contraste para cor de texto (branco ou preto)
   */
  getContrastColor(hexColor: string): string {
    // Remove # se existir
    const hex = hexColor.replace('#', '');

    // Converte para RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calcula luminosidade
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Retorna branco para cores escuras, preto para cores claras
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }
}

export const tagService = new TagService();
