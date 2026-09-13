import { describe, expect, it } from 'vitest';
import { assertIsolatedTestDatabase, assertServerBootDatabaseIsolation } from '../src/config/dbSafety.js';

describe('assertIsolatedTestDatabase', () => {
  const devUrl = 'postgresql://postgres:postgres@localhost:5432/audio_commerce';
  const testUrl = 'postgresql://postgres:postgres@localhost:5432/audio_commerce_test';

  it('throws when the resolved URL is identical to the dev database URL', () => {
    expect(() => assertIsolatedTestDatabase(devUrl, devUrl)).toThrow(/development database/);
  });

  it('passes when the resolved URL differs from the dev database URL', () => {
    expect(() => assertIsolatedTestDatabase(testUrl, devUrl)).not.toThrow();
  });

  it('passes when no dev URL is available to compare against (e.g. CI)', () => {
    expect(() => assertIsolatedTestDatabase(testUrl, undefined)).not.toThrow();
  });
});

describe('assertServerBootDatabaseIsolation', () => {
  const devUrl = 'postgresql://postgres:postgres@localhost:5432/audio_commerce';
  const testUrl = 'postgresql://postgres:postgres@localhost:5432/audio_commerce_test';

  it('throws on boot under NODE_ENV=test when DATABASE_URL still resolved to the dev database', () => {
    // Covers a developer's shell already exporting DATABASE_URL for the dev
    // database (or a missing/misconfigured .env.test): NODE_ENV=test alone
    // is not enough to trust the resolved URL, so this must still throw.
    expect(() => assertServerBootDatabaseIsolation('test', devUrl, devUrl)).toThrow(/development database/);
  });

  it('does not throw on boot under NODE_ENV=test when DATABASE_URL correctly resolved to the test database', () => {
    expect(() => assertServerBootDatabaseIsolation('test', testUrl, devUrl)).not.toThrow();
  });

  it('does not run the check outside of NODE_ENV=test, e.g. a normal dev server boot against the dev database', () => {
    expect(() => assertServerBootDatabaseIsolation('development', devUrl, devUrl)).not.toThrow();
  });
});
