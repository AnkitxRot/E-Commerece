import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../errors/AppError.js';

export function validate(schema: ZodSchema, location: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[location]);
    if (!result.success) {
      return next(new ValidationError(result.error.issues.map((i) => i.message).join(', ')));
    }
    req[location] = result.data;
    next();
  };
}
