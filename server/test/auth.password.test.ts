import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toEqual('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });

  it('uses bcrypt cost factor 12', async () => {
    const hash = await hashPassword('anything');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });
});
