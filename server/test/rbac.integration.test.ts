import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('admin route RBAC', () => {
  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('rejects an authenticated CUSTOMER with 403', async () => {
    const registerRes = await request(app).post('/api/auth/register').send({ email: 'cust@example.com', password: 'password123', name: 'C' });
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${registerRes.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('allows an ADMIN through', async () => {
    await request(app).post('/api/auth/register').send({ email: 'admin2@example.com', password: 'password123', name: 'A' });
    await prisma.user.update({ where: { email: 'admin2@example.com' }, data: { role: 'ADMIN' } });
    // The token minted at register time still carries the CUSTOMER role claim,
    // so re-authenticate to get a token that reflects the updated role.
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin2@example.com', password: 'password123' });
    const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('productCount');
  });

  it('rejects a malformed bearer token with 401', async () => {
    const res = await request(app).get('/api/admin/overview').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
