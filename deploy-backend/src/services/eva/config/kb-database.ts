// ============================================
// Knowledge Base Database Client
// Connects to the N8N PostgreSQL (separate VPS)
// ============================================

import { PrismaClient } from '@prisma/client';
import { prisma as mainPrisma } from '@/config/database';
import logger from '@/config/logger';

let kbClient: PrismaClient | null = null;
let isExternalClient = false;

/**
 * Returns a PrismaClient connected to the Knowledge Base database.
 * This is separate from the main backend database.
 *
 * KB tables: infos_quartos, infos_faq, infos_faq_hospede,
 *            infos_servicos, infos_concierge, infos_carrossel_individual
 *
 * If KB_DATABASE_URL is not set, falls back to the main database.
 */
export function getKBClient(): PrismaClient {
  if (kbClient) return kbClient;

  const kbUrl = process.env.KB_DATABASE_URL?.trim() || undefined;

  if (kbUrl) {
    // Limit connection pool for read-only KB queries
    const separator = kbUrl.includes('?') ? '&' : '?';
    const urlWithPool = `${kbUrl}${separator}connection_limit=3`;

    kbClient = new PrismaClient({
      datasources: { db: { url: urlWithPool } },
      log: [], // Quiet — KB queries are high-frequency
    });
    isExternalClient = true;
    logger.info('[EVA KB] Connected to external Knowledge Base database');
  } else {
    // Fallback: use main database
    kbClient = mainPrisma;
    isExternalClient = false;
    logger.warn('[EVA KB] KB_DATABASE_URL not set — using main database (KB tables may not exist)');
  }

  return kbClient;
}

/**
 * Disconnect KB client on shutdown.
 * Only disconnects if using an external client (not the main prisma singleton).
 */
export async function disconnectKB(): Promise<void> {
  if (kbClient && isExternalClient) {
    await kbClient.$disconnect();
    kbClient = null;
    isExternalClient = false;
  }
}
