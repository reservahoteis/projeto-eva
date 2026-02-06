import axios, { AxiosInstance } from 'axios';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { BadRequestError, InternalServerError } from '@/utils/errors';
import logger from '@/config/logger';
import { decrypt } from '@/utils/encryption';

interface CreateFlowResult {
  flowId: string;
  success: boolean;
}

interface FlowAsset {
  name: string;
  type: 'MEDIA' | 'FLOW_JSON';
  url?: string;
}

interface PublishFlowResult {
  success: boolean;
  validationErrors?: any[];
}

interface SendFlowResult {
  whatsappMessageId: string;
  success: boolean;
}

interface FlowDetails {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  categories: string[];
  validation_errors?: any[];
  json_version?: string;
  data_api_version?: string;
  endpoint_uri?: string;
  preview?: {
    preview_url: string;
    expires_at: string;
  };
}

/**
 * Service para gerenciar WhatsApp Flows API
 *
 * WhatsApp Flows permite criar formulários nativos no WhatsApp
 * com validação, campos customizados e navegação entre telas.
 *
 * Documentação: https://developers.facebook.com/docs/whatsapp/flows
 */
export class WhatsAppFlowsService {
  private baseUrl = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;

  /**
   * Get Axios instance configurado para um tenant específico
   */
  private async getAxiosForTenant(tenantId: string): Promise<AxiosInstance> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        whatsappBusinessAccountId: true,
      },
    });

    if (!tenant?.whatsappAccessToken) {
      throw new BadRequestError('Tenant não tem WhatsApp configurado');
    }

    // Descriptografar access token
    let accessToken: string;
    try {
      accessToken = decrypt(tenant.whatsappAccessToken);
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to decrypt WhatsApp access token');
      throw new BadRequestError('Configuração WhatsApp inválida');
    }

    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Obter WhatsApp Business Account ID do tenant
   */
  private async getWABAId(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsappBusinessAccountId: true },
    });

    if (!tenant?.whatsappBusinessAccountId) {
      throw new BadRequestError('Tenant não tem WABA ID configurado');
    }

    return tenant.whatsappBusinessAccountId;
  }

  /**
   * Criar um novo flow
   *
   * @param tenantId - ID do tenant
   * @param flowJson - JSON Schema do flow (conforme doc da Meta)
   * @param name - Nome do flow
   * @param categories - Categorias do flow (ex: ['LEAD_GENERATION'])
   * @returns Flow ID criado
   */
  async createFlow(
    tenantId: string,
    flowJson: object,
    name: string,
    categories: string[] = ['OTHER']
  ): Promise<CreateFlowResult> {
    try {
      const wabaId = await this.getWABAId(tenantId);
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const response = await axiosInstance.post(`/${wabaId}/flows`, {
        name,
        categories,
      });

      const flowId = response.data.id;

      logger.info({ tenantId, flowId, name }, 'Flow created successfully');

      // Após criar, atualizar com o JSON do flow
      await axiosInstance.post(`/${flowId}`, {
        flow_json: JSON.stringify(flowJson),
      });

      logger.info({ tenantId, flowId }, 'Flow JSON updated');

      return {
        flowId,
        success: true,
      };
    } catch (error: any) {
      logger.error({ error, tenantId, name }, 'Failed to create flow');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Upload de assets para o flow (imagens, ícones, etc)
   *
   * @param tenantId - ID do tenant
   * @param flowId - ID do flow
   * @param assets - Array de assets para upload
   * @returns Resultado do upload
   */
  async uploadFlowAssets(
    tenantId: string,
    flowId: string,
    assets: FlowAsset[]
  ): Promise<{ success: boolean }> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      // Upload de cada asset
      for (const asset of assets) {
        const payload: any = {
          name: asset.name,
          type: asset.type,
        };

        if (asset.url) {
          payload.url = asset.url;
        }

        await axiosInstance.post(`/${flowId}/assets`, payload);

        logger.info({ tenantId, flowId, assetName: asset.name }, 'Asset uploaded');
      }

      logger.info({ tenantId, flowId, assetsCount: assets.length }, 'All assets uploaded');

      return { success: true };
    } catch (error: any) {
      logger.error({ error, tenantId, flowId }, 'Failed to upload assets');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Publicar um flow (move de DRAFT para PUBLISHED)
   *
   * IMPORTANTE: Só flows publicados podem ser enviados aos usuários
   *
   * @param tenantId - ID do tenant
   * @param flowId - ID do flow
   * @returns Resultado da publicação com possíveis erros de validação
   */
  async publishFlow(
    tenantId: string,
    flowId: string
  ): Promise<PublishFlowResult> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const response = await axiosInstance.post(`/${flowId}/publish`);

      const validationErrors = response.data?.validation_errors || [];

      if (validationErrors.length > 0) {
        logger.warn(
          { tenantId, flowId, validationErrors },
          'Flow published with validation warnings'
        );

        return {
          success: true,
          validationErrors,
        };
      }

      logger.info({ tenantId, flowId }, 'Flow published successfully');

      return { success: true };
    } catch (error: any) {
      logger.error({ error, tenantId, flowId }, 'Failed to publish flow');

      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        const errorMessage = errorData?.error?.message || 'WhatsApp API error';

        // Se houver erros de validação, retornar junto
        if (errorData?.error?.error_data?.details) {
          throw new BadRequestError(
            `Validação falhou: ${JSON.stringify(errorData.error.error_data.details)}`
          );
        }

        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Enviar flow como mensagem interativa
   *
   * @param tenantId - ID do tenant
   * @param phoneNumber - Número do destinatário
   * @param flowId - ID do flow publicado
   * @param flowToken - Token único para identificar a sessão do flow
   * @param ctaText - Texto do botão CTA (ex: "Preencher Formulário")
   * @param headerText - Texto do header (opcional)
   * @param bodyText - Texto do body (opcional)
   * @param footerText - Texto do footer (opcional)
   * @param flowCta - Tipo de CTA (navigate ou data_exchange)
   * @param flowAction - Screen inicial do flow
   * @param flowActionPayload - Payload inicial para o flow
   * @returns Resultado do envio
   */
  async sendFlow(
    tenantId: string,
    phoneNumber: string,
    flowId: string,
    flowToken: string,
    ctaText: string,
    options?: {
      headerText?: string;
      bodyText?: string;
      footerText?: string;
      flowCta?: 'navigate' | 'data_exchange';
      flowAction?: string;
      flowActionPayload?: object;
    }
  ): Promise<SendFlowResult> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { whatsappPhoneNumberId: true },
      });

      if (!tenant?.whatsappPhoneNumberId) {
        throw new BadRequestError('WhatsApp não configurado');
      }

      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
          type: 'flow',
          body: {
            text: options?.bodyText || 'Toque no botão abaixo para começar',
          },
          action: {
            name: 'flow',
            parameters: {
              flow_message_version: '3',
              flow_token: flowToken,
              flow_id: flowId,
              flow_cta: options?.flowCta || 'navigate',
              flow_action: options?.flowAction || 'navigate',
              ...(options?.flowActionPayload && {
                flow_action_payload: options.flowActionPayload,
              }),
            },
          },
        },
      };

      // Adicionar header se fornecido
      if (options?.headerText) {
        payload.interactive.header = {
          type: 'text',
          text: options.headerText,
        };
      }

      // Adicionar footer se fornecido
      if (options?.footerText) {
        payload.interactive.footer = {
          text: options.footerText,
        };
      }

      // Adicionar CTA button text
      if (ctaText) {
        payload.interactive.action.parameters.flow_cta_text = ctaText;
      }

      const response = await axiosInstance.post(
        `/${tenant.whatsappPhoneNumberId}/messages`,
        payload
      );

      const whatsappMessageId = response.data.messages[0]?.id;

      logger.info(
        { tenantId, phoneNumber, flowId, flowToken, whatsappMessageId },
        'Flow message sent'
      );

      return {
        whatsappMessageId,
        success: true,
      };
    } catch (error: any) {
      logger.error(
        { error, tenantId, phoneNumber, flowId },
        'Failed to send flow message'
      );

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Obter detalhes de um flow
   *
   * @param tenantId - ID do tenant
   * @param flowId - ID do flow
   * @returns Detalhes do flow
   */
  async getFlowDetails(tenantId: string, flowId: string): Promise<FlowDetails> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const response = await axiosInstance.get(`/${flowId}`, {
        params: {
          fields: 'id,name,status,categories,validation_errors,json_version,data_api_version,endpoint_uri,preview',
        },
      });

      logger.info({ tenantId, flowId }, 'Flow details retrieved');

      return response.data;
    } catch (error: any) {
      logger.error({ error, tenantId, flowId }, 'Failed to get flow details');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Atualizar JSON de um flow existente
   *
   * @param tenantId - ID do tenant
   * @param flowId - ID do flow
   * @param flowJson - Novo JSON do flow
   * @returns Resultado da atualização
   */
  async updateFlowJson(
    tenantId: string,
    flowId: string,
    flowJson: object
  ): Promise<{ success: boolean }> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      await axiosInstance.post(`/${flowId}`, {
        flow_json: JSON.stringify(flowJson),
      });

      logger.info({ tenantId, flowId }, 'Flow JSON updated');

      return { success: true };
    } catch (error: any) {
      logger.error({ error, tenantId, flowId }, 'Failed to update flow JSON');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Depreciar um flow (soft delete)
   *
   * @param tenantId - ID do tenant
   * @param flowId - ID do flow
   * @returns Resultado
   */
  async deprecateFlow(
    tenantId: string,
    flowId: string
  ): Promise<{ success: boolean }> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      await axiosInstance.delete(`/${flowId}`);

      logger.info({ tenantId, flowId }, 'Flow deprecated');

      return { success: true };
    } catch (error: any) {
      logger.error({ error, tenantId, flowId }, 'Failed to deprecate flow');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Listar todos os flows do tenant
   *
   * @param tenantId - ID do tenant
   * @returns Lista de flows
   */
  async listFlows(tenantId: string): Promise<FlowDetails[]> {
    try {
      const wabaId = await this.getWABAId(tenantId);
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const response = await axiosInstance.get(`/${wabaId}/flows`, {
        params: {
          fields: 'id,name,status,categories',
        },
      });

      logger.info({ tenantId, count: response.data.data?.length || 0 }, 'Flows listed');

      return response.data.data || [];
    } catch (error: any) {
      logger.error({ error, tenantId }, 'Failed to list flows');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }

  /**
   * Obter métricas de um flow
   *
   * @param tenantId - ID do tenant
   * @param flowId - ID do flow
   * @returns Métricas do flow
   */
  async getFlowMetrics(
    tenantId: string,
    flowId: string
  ): Promise<any> {
    try {
      const axiosInstance = await this.getAxiosForTenant(tenantId);

      const response = await axiosInstance.get(`/${flowId}/insights`);

      logger.info({ tenantId, flowId }, 'Flow metrics retrieved');

      return response.data;
    } catch (error: any) {
      logger.error({ error, tenantId, flowId }, 'Failed to get flow metrics');

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'WhatsApp API error';
        throw new InternalServerError(`WhatsApp Flows: ${errorMessage}`);
      }

      throw error;
    }
  }
}

export const whatsAppFlowsService = new WhatsAppFlowsService();
