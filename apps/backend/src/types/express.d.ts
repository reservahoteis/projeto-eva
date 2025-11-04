// Extend Express Request type para incluir custom properties

import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      // Tenant ID extraído do subdomínio
      tenantId?: string | null;

      // User autenticado (via JWT)
      user?: {
        userId: string;
        role: Role;
        tenantId?: string | null;
      };

      // Tenant completo (se necessário)
      tenant?: {
        id: string;
        slug: string;
        name: string;
        status: string;
      };
    }
  }
}

export {};
