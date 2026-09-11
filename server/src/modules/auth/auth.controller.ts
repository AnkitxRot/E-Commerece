import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import { UnauthorizedError } from '../../errors/AppError.js';

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

export async function registerHandler(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(201).json({ user, accessToken });
}

export async function loginHandler(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ user, accessToken });
}

export async function refreshHandler(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw new UnauthorizedError('No refresh token provided');
  try {
    const { accessToken, refreshToken } = await authService.refresh(raw);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.status(200).json({ accessToken });
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    throw err;
  }
}

export async function logoutHandler(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await authService.logout(raw);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).send();
}

export async function meHandler(req: Request, res: Response) {
  const user = await authService.getUserById(req.user!.id);
  res.status(200).json({ user });
}
