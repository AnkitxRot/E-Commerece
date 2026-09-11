import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../src/auth/jwt.js';
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from '../src/auth/refreshToken.js';

describe('access token', () => {
  it('round-trips subject and role', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'ADMIN' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('ADMIN');
  });

  it('throws on a tampered token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CUSTOMER' });
    expect(() => verifyAccessToken(token + 'x')).toThrow();
  });

  it('sets a 15-minute expiry', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CUSTOMER' });
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });
});

describe('refresh token', () => {
  it('generates a unique raw token and a deterministic hash', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toEqual(b);
    expect(hashRefreshToken(a)).toEqual(hashRefreshToken(a));
    expect(hashRefreshToken(a)).not.toEqual(hashRefreshToken(b));
  });

  it('sets a 30-day TTL constant', () => {
    expect(REFRESH_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
