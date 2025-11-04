import { AsyncLocalStorage } from 'async_hooks';

// Contexto de execução assíncrono para armazenar tenantId globalmente
interface AppContext {
  tenantId?: string | null;
  userId?: string;
}

export const asyncStorage = new AsyncLocalStorage<AppContext>();

/**
 * Get tenant ID from async context
 */
export function getTenantIdFromContext(): string | null | undefined {
  const store = asyncStorage.getStore();
  return store?.tenantId;
}

/**
 * Get user ID from async context
 */
export function getUserIdFromContext(): string | undefined {
  const store = asyncStorage.getStore();
  return store?.userId;
}

/**
 * Set context for current execution
 */
export function setContext(context: AppContext) {
  return asyncStorage.run(context, () => {
    // Context is now set for all async operations
  });
}
