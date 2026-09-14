import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { registerCustomer, resetDb } from './setup.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function addressPayload(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Home',
    line1: '221B Baker Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
    phone: '9876543210',
    ...overrides,
  };
}

describe('customer addresses', () => {
  it('requires authentication for every operation', async () => {
    expect((await request(app).get('/api/addresses')).status).toBe(401);
    expect((await request(app).post('/api/addresses').send(addressPayload())).status).toBe(401);
    expect((await request(app).patch('/api/addresses/00000000-0000-0000-0000-000000000000').send({})).status).toBe(401);
    expect((await request(app).delete('/api/addresses/00000000-0000-0000-0000-000000000000')).status).toBe(401);
    expect((await request(app).post('/api/addresses/00000000-0000-0000-0000-000000000000/default')).status).toBe(401);
  });

  it('creates, lists, updates, and deletes an address', async () => {
    const token = await registerCustomer('addr1@example.com');

    const createRes = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload());
    expect(createRes.status).toBe(201);
    expect(createRes.body.address).toMatchObject({ label: 'Home', isDefault: false });
    const id = createRes.body.address.id;

    const listRes = await request(app).get('/api/addresses').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.addresses.map((a: { id: string }) => a.id)).toContain(id);

    const updateRes = await request(app)
      .patch(`/api/addresses/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Work', line2: 'Suite 4' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.address.label).toBe('Work');
    expect(updateRes.body.address.line2).toBe('Suite 4');

    const deleteRes = await request(app).delete(`/api/addresses/${id}`).set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
    expect(await prisma.address.findUnique({ where: { id } })).toBeNull();
  });

  it('rejects invalid input', async () => {
    const token = await registerCustomer('addr2@example.com');
    const missingFields = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Home' });
    expect(missingFields.status).toBe(400);

    const tooLong = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ line1: 'x'.repeat(500) }));
    expect(tooLong.status).toBe(400);

    const unexpectedField = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ notAField: 'nope' }));
    expect(unexpectedField.status).toBe(400);
  });

  it('never exposes, modifies, or deletes another customer\'s address (IDOR)', async () => {
    const tokenA = await registerCustomer('addr3a@example.com');
    const tokenB = await registerCustomer('addr3b@example.com');

    const created = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(addressPayload());
    const addressId = created.body.address.id;

    const listB = await request(app).get('/api/addresses').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.body.addresses).toHaveLength(0);

    const updateB = await request(app)
      .patch(`/api/addresses/${addressId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ label: 'Hijacked' });
    expect(updateB.status).toBe(404);

    const deleteB = await request(app).delete(`/api/addresses/${addressId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(deleteB.status).toBe(404);

    const defaultB = await request(app)
      .post(`/api/addresses/${addressId}/default`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(defaultB.status).toBe(404);

    // Confirm none of B's attempts actually changed anything.
    const stillA = await prisma.address.findUnique({ where: { id: addressId } });
    expect(stillA?.label).toBe('Home');
    expect(stillA?.isDefault).toBe(false);
  });

  it('returns 404 for a nonexistent address id', async () => {
    const token = await registerCustomer('addr4@example.com');
    const res = await request(app)
      .patch('/api/addresses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'X' });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed address id', async () => {
    const token = await registerCustomer('addr5@example.com');
    const res = await request(app).delete('/api/addresses/not-a-uuid').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('default address', () => {
  it('creates the first default via isDefault:true at create time', async () => {
    const token = await registerCustomer('def1@example.com');
    const res = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ isDefault: true }));
    expect(res.body.address.isDefault).toBe(true);
  });

  it('creating a second address as default unsets the first', async () => {
    const token = await registerCustomer('def2@example.com');
    const first = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ isDefault: true }));
    const second = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ label: 'Work', isDefault: true }));

    expect(second.body.address.isDefault).toBe(true);
    const list = await request(app).get('/api/addresses').set('Authorization', `Bearer ${token}`);
    const defaults = list.body.addresses.filter((a: { isDefault: boolean }) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.body.address.id);
    void first;
  });

  it('explicitly switches the default via POST /:id/default', async () => {
    const token = await registerCustomer('def3@example.com');
    const a = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ isDefault: true }));
    const b = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ label: 'Work' }));

    const switchRes = await request(app)
      .post(`/api/addresses/${b.body.address.id}/default`)
      .set('Authorization', `Bearer ${token}`);
    expect(switchRes.status).toBe(200);
    expect(switchRes.body.address.isDefault).toBe(true);

    const list = await request(app).get('/api/addresses').set('Authorization', `Bearer ${token}`);
    const defaults = list.body.addresses.filter((addr: { isDefault: boolean }) => addr.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(b.body.address.id);
    void a;
  });

  it('deleting the default address leaves zero defaults, never auto-promoting another', async () => {
    const token = await registerCustomer('def4@example.com');
    const defaultAddr = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ isDefault: true }));
    await request(app).post('/api/addresses').set('Authorization', `Bearer ${token}`).send(addressPayload({ label: 'Work' }));

    await request(app).delete(`/api/addresses/${defaultAddr.body.address.id}`).set('Authorization', `Bearer ${token}`);

    const list = await request(app).get('/api/addresses').set('Authorization', `Bearer ${token}`);
    expect(list.body.addresses).toHaveLength(1);
    expect(list.body.addresses[0].isDefault).toBe(false);
  });

  it('never leaves two addresses marked default under concurrent set-default calls', async () => {
    const token = await registerCustomer('def5@example.com');
    const a = await request(app).post('/api/addresses').set('Authorization', `Bearer ${token}`).send(addressPayload());
    const b = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ label: 'Work' }));
    const c = await request(app)
      .post('/api/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(addressPayload({ label: 'Other' }));

    const results = await Promise.all([
      request(app).post(`/api/addresses/${a.body.address.id}/default`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/addresses/${b.body.address.id}/default`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/addresses/${c.body.address.id}/default`).set('Authorization', `Bearer ${token}`),
    ]);

    // Every concurrent request must resolve cleanly — a race lost against
    // the DB's partial unique index must be retried transparently, never
    // surfaced to the client as a raw 500.
    for (const res of results) expect(res.status).toBe(200);

    const defaults = await prisma.address.findMany({ where: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: 'def5@example.com' } })).id, isDefault: true } });
    expect(defaults).toHaveLength(1);
  });

  it('never leaves two addresses marked default when multiple are concurrently created as default', async () => {
    const token = await registerCustomer('def6@example.com');

    const results = await Promise.all([
      request(app).post('/api/addresses').set('Authorization', `Bearer ${token}`).send(addressPayload({ isDefault: true })),
      request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(addressPayload({ label: 'Work', isDefault: true })),
      request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(addressPayload({ label: 'Other', isDefault: true })),
    ]);

    for (const res of results) expect(res.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'def6@example.com' } });
    const defaults = await prisma.address.findMany({ where: { userId: user.id, isDefault: true } });
    expect(defaults).toHaveLength(1);
    const all = await prisma.address.findMany({ where: { userId: user.id } });
    expect(all).toHaveLength(3); // all three were still created, just not all default
  });
});
