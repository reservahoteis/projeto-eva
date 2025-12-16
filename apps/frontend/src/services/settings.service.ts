import api from '@/lib/axios';

const SETTINGS_API_BASE_URL = '/api/tenants' as const;

export interface WhatsAppConfig {
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  phoneNumber?: string;
  isConnected: boolean;
}

export interface UpdateWhatsAppConfig {
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappBusinessAccountId: string;
  whatsappWebhookVerifyToken?: string;
  whatsappAppSecret?: string;
}

export interface AutoMessages {
  welcomeMessage?: string;
  awayMessage?: string;
}

class SettingsService {
  async getWhatsAppConfig(): Promise<WhatsAppConfig> {
    const { data } = await api.get<WhatsAppConfig>(
      `${SETTINGS_API_BASE_URL}/whatsapp-config`
    );
    return data;
  }

  async updateWhatsAppConfig(config: UpdateWhatsAppConfig): Promise<WhatsAppConfig> {
    const { data } = await api.post<WhatsAppConfig>(
      `${SETTINGS_API_BASE_URL}/whatsapp-config`,
      config
    );
    return data;
  }

  // Métodos helper
  formatPhoneNumber(phoneNumberId?: string): string {
    if (!phoneNumberId) return 'Não configurado';
    // Implementar formatação se necessário
    return phoneNumberId;
  }

  maskToken(token?: string): string {
    if (!token) return '';
    if (token.length <= 8) return '********';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }
}

export const settingsService = new SettingsService();
