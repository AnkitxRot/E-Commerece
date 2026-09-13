import { describe, expect, it } from 'vitest';
import { assertIsolatedTestDatabase } from '../src/config/dbSafety.js';

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
