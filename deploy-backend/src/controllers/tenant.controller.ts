import { Request, Response } from 'express';
import { tenantService } from '@/services/tenant.service';
import type { CreateTenantInput, UpdateTenantInput, ConfigureWhatsAppInput } from '@/validators/tenant.validator';

export class TenantController {
  /**
   * POST /api/tenants (Super Admin)
   */
  async create(req: Request, res: Response) {
    const data = req.body as CreateTenantInput;

    // ✅ TYPE-SAFE: Data já validado por Zod, tipo correto
    const result = await tenantService.createTenant(data);

    return res.status(201).json(result);
  }

  /**
   * GET /api/tenants (Super Admin)
   */
  async list(req: Request, res: Response) {
    const { status, search, page, limit } = req.query;

    const result = await tenantService.listTenants({
      status: status as 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return res.json(result);
  }

  /**
   * GET /api/tenants/:id (Super Admin)
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID é obrigatório' });
    }

    const tenant = await tenantService.getTenantById(id);

    return res.json(tenant);
  }

  /**
   * PATCH /api/tenants/:id (Super Admin)
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body as UpdateTenantInput;

    if (!id) {
      return res.status(400).json({ error: 'ID é obrigatório' });
    }

    const tenant = await tenantService.updateTenant(id, data);

    return res.json(tenant);
  }

  /**
   * DELETE /api/tenants/:id (Super Admin)
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID é obrigatório' });
    }

    await tenantService.deleteTenant(id);

    return res.status(204).send();
  }

  /**
   * POST /api/tenant/whatsapp-config (Tenant Admin)
   */
  async configureWhatsApp(req: Request, res: Response) {
    const data = req.body as ConfigureWhatsAppInput;

    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    // ✅ TYPE-SAFE: Data já validado por Zod, tipo correto
    const tenant = await tenantService.configureWhatsApp(req.tenantId, data);

    return res.json(tenant);
  }

  /**
   * GET /api/tenant/whatsapp-config (Tenant Admin)
   */
  async getWhatsAppConfig(req: Request, res: Response) {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    const config = await tenantService.getWhatsAppConfig(req.tenantId);

    return res.json(config);
  }
}

export const tenantController = new TenantController();
