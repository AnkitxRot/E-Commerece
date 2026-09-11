import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function extractRefreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie']?.[0] as string;
  return raw.split(';')[0];
}

describe('auth flows', () => {
  it('registers a user and returns an access token plus a refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'password123', name: 'New User' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects duplicate registration email with 409', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123', name: 'A' });
    const res = await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123', name: 'B' });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong password with 401', async () => {
    await request(app).post('/api/auth/register').send({ email: 'login@example.com', password: 'password123', name: 'L' });
    const ok = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('refreshes an access token and rotates the refresh cookie', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'rot@example.com', password: 'password123', name: 'R' });
    const cookie = extractRefreshCookie(registerRes);

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTypeOf('string');
    const newCookie = extractRefreshCookie(refreshRes);
    expect(newCookie).not.toEqual(cookie);
  });

  it('detects replay of an already-rotated refresh token and revokes the family', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'replay@example.com', password: 'password123', name: 'P' });
    const originalCookie = extractRefreshCookie(registerRes);

    const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(firstRefresh.status).toBe(200);
    const rotatedCookie = extractRefreshCookie(firstRefresh);

    // Replay the original (now-revoked) token.
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
    expect(replay.status).toBe(401);

    // The legitimately-rotated token must now also be dead — whole family revoked.
    const secondUse = await request(app).post('/api/auth/refresh').set('Cookie', rotatedCookie);
    expect(secondUse.status).toBe(401);
  });

  it('rejects refresh with no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('returns the current user from /me when authenticated', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'me@example.com', password: 'password123', name: 'M' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${registerRes.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  it('rejects /me with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
