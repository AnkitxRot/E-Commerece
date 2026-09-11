import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../src/middleware/validate.js';
import { ValidationError } from '../src/errors/AppError.js';

const schema = z.object({ email: z.string().email() });

describe('validate', () => {
  it('calls next with ValidationError and does not replace req.body on invalid input', () => {
    const next = vi.fn();
    const req = { body: { email: 'not-an-email' } } as Request;
    validate(schema)(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(req.body).toEqual({ email: 'not-an-email' });
  });

  it('replaces req.body with parsed data and calls next with no error on valid input', () => {
    const next = vi.fn();
    const req = { body: { email: 'a@b.com' } } as Request;
    validate(schema)(req, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: 'a@b.com' });
  });
});
