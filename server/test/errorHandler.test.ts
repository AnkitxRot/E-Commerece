import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../src/errors/AppError.js';

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('maps a known AppError to its status and code', () => {
    const res = mockRes();
    errorHandler(new NotFoundError('missing'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'missing' } });
  });

  it('maps ValidationError to 400', () => {
    const res = mockRes();
    errorHandler(new ValidationError('bad body'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'VALIDATION_ERROR', message: 'bad body' } });
  });

  it('maps an unknown error to a generic 500 with no stack leakage', () => {
    const res = mockRes();
    errorHandler(new Error('db exploded'), {} as Request, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });
});
