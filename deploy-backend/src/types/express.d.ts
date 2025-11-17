import { Tenant, User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantId?: string;
      user?: User;
      rawBody?: string;
    }
  }
}

export {};
