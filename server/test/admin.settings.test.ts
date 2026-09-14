import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerAdmin, registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function upsertSettings() {
  await prisma.storeSettings.upsert({
    where: { id: 'singleton' },
    update: { storeName: 'Aurelia Audio', contactEmail: 'hello@aureliaaudio.demo' },
    create: { id: 'singleton', storeName: 'Aurelia Audio', contactEmail: 'hello@aureliaaudio.demo' },
  });
}

describe('admin store settings', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    await upsertSettings();
    const res401 = await request(app).get('/api/admin/settings');
    expect(res401.status).toBe(401);

    const customerToken = await registerCustomer('settings-customer@example.com');
    const res403 = await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${customerToken}`);
    expect(res403.status).toBe(403);
  });

  it('reads and updates store settings, and records an audit entry', async () => {
    await upsertSettings();
    const token = await registerAdmin('settings-admin1@example.com');

    const getRes = await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.settings.storeName).toBe('Aurelia Audio');

    const updateRes = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        storeName: 'Everyday Audio',
        contactPhone: '9876543210',
        socialLinks: { instagram: 'https://instagram.com/everyday' },
        heroContent: { title: 'Welcome' },
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.settings.storeName).toBe('Everyday Audio');
    expect(updateRes.body.settings.contactPhone).toBe('9876543210');
    expect(updateRes.body.settings.socialLinks).toEqual({ instagram: 'https://instagram.com/everyday' });
    expect(updateRes.body.settings.heroContent).toEqual({ title: 'Welcome' });

    const auditRows = await prisma.auditLog.findMany({ where: { action: 'settings.update' } });
    expect(auditRows).toHaveLength(1);
  });

  it('rejects invalid input: bad email, non-https logo, empty body', async () => {
    await upsertSettings();
    const token = await registerAdmin('settings-admin2@example.com');

    const badEmail = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ contactEmail: 'not-an-email' });
    expect(badEmail.status).toBe(400);

    const badLogo = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ logoUrl: 'http://example.com/logo.png' });
    expect(badLogo.status).toBe(400);

    const empty = await request(app).patch('/api/admin/settings').set('Authorization', `Bearer ${token}`).send({});
    expect(empty.status).toBe(400);

    const unknownField = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ notAField: 'x' });
    expect(unknownField.status).toBe(400);
  });
});
