import { prisma } from '@/config/database';
import { BadRequestError, NotFoundError } from '@/utils/errors';
import { TenantStatus, Plan } from '@prisma/client';
import { authService } from './auth.service';
import { generateToken } from '@/utils/crypto';
import { encrypt } from '@/utils/encryption';
import logger from '@/config/logger';

interface CreateTenantData {
  name: string;
  slug: string;
  email: string;
  plan?: Plan;
  maxAttendants?: number;
  maxMessages?: number;
}

interface UpdateTenantData {
  name?: string;
  email?: string;
  status?: TenantStatus;
  plan?: Plan;
  maxAttendants?: number;
  maxMessages?: number;
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappBusinessAccountId?: string;
  whatsappWebhookVerifyToken?: string;
  whatsappAppSecret?: string;
}

export class TenantService {
  /**
   * Criar novo tenant (Super Admin)
   */
  async createTenant(data: CreateTenantData) {
    // Validar slug (lowercase, sem espaços, apenas letras e números)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(data.slug)) {
      throw new BadRequestError(
        'Slug deve conter apenas letras minúsculas, números e hífens'
      );
    }

    // Verificar se slug já existe
    const existingSlug = await prisma.tenant.findUnique({
      where: { slug: data.slug },
    });

    if (existingSlug) {
      throw new BadRequestError('Slug já está em uso');
    }

    // Verificar se email já existe
    const existingEmail = await prisma.tenant.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new BadRequestError('Email já cadastrado');
    }

    // Criar tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        email: data.email,
        status: 'TRIAL',
        plan: data.plan || 'BASIC',
        maxAttendants: data.maxAttendants || 10,
        maxMessages: data.maxMessages || 10000,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
        whatsappWebhookVerifyToken: generateToken(32), // Gerar token único
      },
    });

    // Criar usuário admin do tenant
    const temporaryPassword = generateToken(16);

    const adminUser = await authService.register({
      email: data.email,
      password: temporaryPassword,
      name: `Admin ${data.name}`,
      role: 'TENANT_ADMIN',
      tenantId: tenant.id,
    });

    logger.info({ tenantId: tenant.id, slug: tenant.slug }, 'Tenant created');

    // TODO: Enviar email com credenciais

    return {
      tenant,
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        temporaryPassword, // Retornar apenas uma vez!
      },
      loginUrl: `https://${tenant.slug}.${process.env.BASE_DOMAIN}`,
    };
  }

  /**
   * Listar todos os tenants (Super Admin)
   */
  async listTenants(params?: {
    status?: TenantStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { slug: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          status: true,
          plan: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              conversations: true,
            },
          },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar tenant por ID
   */
  async getTenantById(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            conversations: true,
            messages: true,
            contacts: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    return tenant;
  }

  /**
   * Atualizar tenant
   */
  async updateTenant(id: string, data: UpdateTenantData) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    // Se mudando email, verificar se não está em uso
    if (data.email && data.email !== tenant.email) {
      const existingEmail = await prisma.tenant.findUnique({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new BadRequestError('Email já em uso');
      }
    }

    // Atualizar
    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    logger.info({ tenantId: id }, 'Tenant updated');

    return updated;
  }

  /**
   * Deletar tenant (CUIDADO!)
   */
  async deleteTenant(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    // Deletar tenant (cascade vai deletar tudo)
    await prisma.tenant.delete({
      where: { id },
    });

    logger.warn({ tenantId: id, slug: tenant.slug }, 'Tenant deleted');
  }

  /**
   * Suspender tenant (por falta de pagamento)
   */
  async suspendTenant(id: string) {
    return this.updateTenant(id, { status: 'SUSPENDED' });
  }

  /**
   * Ativar tenant
   */
  async activateTenant(id: string) {
    return this.updateTenant(id, { status: 'ACTIVE' });
  }

  /**
   * Configurar credenciais WhatsApp (Tenant Admin)
   */
  async configureWhatsApp(
    tenantId: string,
    config: {
      whatsappPhoneNumberId: string;
      whatsappAccessToken: string;
      whatsappBusinessAccountId: string;
      whatsappAppSecret: string;
    }
  ) {
    // TODO: Validar credenciais fazendo request test pra Meta API

    // Criptografar tokens sensíveis antes de salvar no banco
    const encryptedAccessToken = encrypt(config.whatsappAccessToken);
    const encryptedAppSecret = encrypt(config.whatsappAppSecret);

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsappPhoneNumberId: config.whatsappPhoneNumberId,
        whatsappAccessToken: encryptedAccessToken,
        whatsappBusinessAccountId: config.whatsappBusinessAccountId,
        whatsappAppSecret: encryptedAppSecret,
      },
    });

    logger.info({ tenantId }, 'WhatsApp configured');

    return updated;
  }

  /**
   * Buscar configuração WhatsApp do tenant
   */
  async getWhatsAppConfig(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappBusinessAccountId: true,
        whatsappWebhookVerifyToken: true,
        // Não retornar tokens sensíveis!
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    return tenant;
  }
}

export const tenantService = new TenantService();
