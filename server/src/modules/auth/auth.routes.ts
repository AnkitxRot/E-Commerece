import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { registerSchema, loginSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './auth.controller.js';

const asyncHandler =
  (fn: (req: any, res: any) => Promise<void>) => (req: any, res: any, next: any) =>
    fn(req, res).catch(next);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(controller.registerHandler));
authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(controller.loginHandler));
authRouter.post('/refresh', authLimiter, asyncHandler(controller.refreshHandler));
authRouter.post('/logout', asyncHandler(controller.logoutHandler));
authRouter.get('/me', requireAuth, asyncHandler(controller.meHandler));
