import { Tenant, User, TenantStatus } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: string;
        slug: string;
        name: string;
        status: TenantStatus;
      };
      tenantId?: string | null;
      user?: User;
      rawBody?: string;
    }
  }
}

export {};
