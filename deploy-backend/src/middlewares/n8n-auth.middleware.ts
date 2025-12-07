import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/config/database';
import logger from '@/config/logger';

/**
 * Middleware de autenticação para rotas N8N
 * Usa X-API-Key header ou query param apiKey
 *
 * A API Key é o whatsappAccessToken do tenant (criptografado)
 * Ou pode ser uma chave dedicada configurada no tenant
 */
export async function n8nAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Buscar API Key do header ou query
    const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API Key não fornecida',
        message: 'Inclua X-API-Key no header ou apiKey na query string',
      });
    }

    // Buscar tenant pela API Key
    // A API Key pode ser:
    // 1. O campo n8nApiKey do tenant (dedicado para N8N)
    // 2. Ou buscamos pelo slug + validamos a key

    // Formato esperado: {tenantSlug}:{secretKey}
    // Exemplo: hoteis-reserva:abc123xyz
    const [tenantSlug, secretKey] = apiKey.split(':');

    if (!tenantSlug || !secretKey) {
      return res.status(401).json({
        error: 'Formato de API Key inválido',
        message: 'Use o formato: {tenant-slug}:{secret-key}',
      });
    }

    // Buscar tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
      },
    });

    if (!tenant) {
      return res.status(401).json({
        error: 'Tenant não encontrado',
        message: `Tenant com slug "${tenantSlug}" não existe`,
      });
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Tenant inativo',
        message: 'Este tenant não está ativo',
      });
    }

    // Validar secret key
    // Aceita whatsappPhoneNumberId como chave de API
    const validKey = tenant.whatsappPhoneNumberId;

    if (secretKey !== validKey) {
      logger.warn({ tenantSlug, providedKey: secretKey.substring(0, 8) + '...' }, 'Invalid N8N API key attempt');
      return res.status(401).json({
        error: 'API Key inválida',
        message: 'A chave secreta não corresponde',
      });
    }

    // Verificar se WhatsApp está configurado
    if (!tenant.whatsappPhoneNumberId || !tenant.whatsappAccessToken) {
      return res.status(400).json({
        error: 'WhatsApp não configurado',
        message: 'Este tenant não tem WhatsApp configurado',
      });
    }

    // Adicionar tenant ao request
    req.tenantId = tenant.id;
    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    } as any;

    logger.info({ tenantId: tenant.id, tenantSlug: tenant.slug }, 'N8N request authenticated');

    next();
  } catch (error) {
    logger.error({ error }, 'N8N auth middleware error');
    return res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao autenticar requisição',
    });
  }
}
