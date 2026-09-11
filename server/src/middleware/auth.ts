import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../auth/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';
import type { Role } from '@audio-commerce/shared';

declare global {
  // Express request augmentation requires a namespace merge.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError());
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError());
  }
};

/**
 * Trusts the `role` claim baked into the access JWT at sign time — it does
 * NOT re-query the database per request. `auth.service.ts#refresh` re-derives
 * the claim from the live `User.role` on every rotation, so a role change
 * (e.g. an admin demoted) takes effect within one access-token lifetime — at
 * most 15 minutes, immediately on next login. This is a deliberate, accepted
 * Phase 1 tradeoff for a two-role model, not an oversight: revisit only if a
 * more sensitive permission model is introduced later.
 */
export function requireRole(role: Role): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.role !== role) return next(new ForbiddenError());
    next();
  };
}
