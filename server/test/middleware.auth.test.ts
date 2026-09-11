import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../src/errors/AppError.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as Request;
}

describe('requireAuth', () => {
  it('calls next with UnauthorizedError when there is no Authorization header', () => {
    const next = vi.fn();
    requireAuth(mockReq(), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next with UnauthorizedError for a non-Bearer scheme', () => {
    const next = vi.fn();
    requireAuth(mockReq({ headers: { authorization: 'Basic abc123' } }), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next with UnauthorizedError for an invalid/tampered token', () => {
    const next = vi.fn();
    const token = signAccessToken({ sub: 'user-1', role: 'CUSTOMER' as any });
    requireAuth(mockReq({ headers: { authorization: `Bearer ${token}x` } }), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('attaches req.user and calls next with no error for a valid token', () => {
    const next = vi.fn();
    const token = signAccessToken({ sub: 'user-1', role: 'ADMIN' as any });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    requireAuth(req, {} as Response, next as NextFunction);
    expect(req.user).toEqual({ id: 'user-1', role: 'ADMIN' });
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireRole', () => {
  it('calls next with UnauthorizedError when req.user is missing', () => {
    const next = vi.fn();
    requireRole('ADMIN' as any)(mockReq(), {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next with ForbiddenError when the role does not match', () => {
    const next = vi.fn();
    const req = mockReq({ user: { id: 'user-1', role: 'CUSTOMER' as any } });
    requireRole('ADMIN' as any)(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next with no error when the role matches', () => {
    const next = vi.fn();
    const req = mockReq({ user: { id: 'user-1', role: 'ADMIN' as any } });
    requireRole('ADMIN' as any)(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });
});
