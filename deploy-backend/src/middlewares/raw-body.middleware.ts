import { Request, Response, NextFunction } from 'express';
import { json } from 'express';

/**
 * Middleware para preservar raw body (necessário para validação HMAC)
 * 
 * O Meta WhatsApp envia assinatura HMAC SHA256 do payload original.
 * Precisamos do raw body (antes do JSON.parse) para validar a assinatura.
 * 
 * Este middleware salva o raw body em req.rawBody antes do express.json() fazer o parse.
 */

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

/**
 * Raw body middleware - captura o body original como string
 */
export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction): void {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk.toString();
  });

  req.on('end', () => {
    req.rawBody = data;
    next();
  });
}

/**
 * Middleware combinado: captura raw body + faz parse JSON
 * Usa express.json() internamente após salvar o raw body
 */
export function rawBodySaver(options?: any) {
  const jsonParser = json(options);

  return (req: Request, res: Response, next: NextFunction) => {
    // Capturar raw body
    let rawBody = '';

    req.on('data', (chunk) => {
      rawBody += chunk.toString('utf-8');
    });

    req.on('end', () => {
      req.rawBody = rawBody;
    });

    // Fazer parse JSON normalmente
    jsonParser(req, res, next);
  };
}
