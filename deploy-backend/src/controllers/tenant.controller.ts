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

    res.status(201).json(result);
  }

  /**
   * GET /api/tenants (Super Admin)
   */
  async list(req: Request, res: Response) {
    const { status, search, page, limit } = req.query;

    const result = await tenantService.listTenants({
      status: status as 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(result);
  }

  /**
   * GET /api/tenants/:id (Super Admin)
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const tenant = await tenantService.getTenantById(id);

    res.json(tenant);
  }

  /**
   * PATCH /api/tenants/:id (Super Admin)
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body as UpdateTenantInput;

    const tenant = await tenantService.updateTenant(id, data);

    res.json(tenant);
  }

  /**
   * DELETE /api/tenants/:id (Super Admin)
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    await tenantService.deleteTenant(id);

    res.status(204).send();
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

    res.json(tenant);
  }

  /**
   * GET /api/tenant/whatsapp-config (Tenant Admin)
   */
  async getWhatsAppConfig(req: Request, res: Response) {
    if (!req.tenantId) {
      return res.status(400).json({ error: 'Tenant ID não encontrado' });
    }

    const config = await tenantService.getWhatsAppConfig(req.tenantId);

    res.json(config);
  }
}

export const tenantController = new TenantController();
