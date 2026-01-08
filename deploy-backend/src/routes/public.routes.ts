import { Router, Request, Response } from 'express';
import logger from '@/config/logger';

const router = Router();

/**
 * GET /api/n8n/track-click
 * Endpoint PÚBLICO (sem autenticação) para tracking de cliques nos botões do WhatsApp
 * Registra o clique e redireciona para a URL final
 *
 * Query params:
 * - redirect: URL final para redirecionar (URL encoded)
 * - phone, unidade, quarto: opcionais para logging
 */
router.get('/track-click', async (req: Request, res: Response) => {
  const { phone, unidade, quarto, redirect } = req.query;

  // Logar o clique
  logger.info({ phone, unidade, quarto, redirect }, 'Track click');

  // Redirecionar para URL final
  if (redirect && typeof redirect === 'string') {
    const redirectUrl = decodeURIComponent(redirect);
    return res.redirect(302, redirectUrl);
  }

  return res.status(400).json({ error: 'Parâmetro redirect não fornecido' });
});

export default router;
