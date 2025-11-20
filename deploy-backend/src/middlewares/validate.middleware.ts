import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Middleware genérico de validação com Zod
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // Substituir dados originais pelos validados
      req[source] = validated;

      next();
    } catch (error: any) {
      // ZodError será capturado pelo error handler global
      next(error);
    }
  };
}
