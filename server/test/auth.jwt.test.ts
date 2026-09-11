import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../src/auth/jwt.js';
import { generateRefreshToken, hashRefreshToken } from '../src/auth/refreshToken.js';

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
});

describe('refresh token', () => {
  it('generates a unique raw token and a deterministic hash', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toEqual(b);
    expect(hashRefreshToken(a)).toEqual(hashRefreshToken(a));
    expect(hashRefreshToken(a)).not.toEqual(hashRefreshToken(b));
  });
});
