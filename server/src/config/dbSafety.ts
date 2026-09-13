import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Refuses to proceed if the database a test run resolved to is the same
 * database development uses. Pure comparison of two strings (no fs/env
 * access) so it's directly unit-testable — see server/test/dbSafety.test.ts.
 */
export function assertIsolatedTestDatabase(
  resolvedTestUrl: string,
  devDatabaseUrl: string | undefined,
): void {
  if (devDatabaseUrl && resolvedTestUrl === devDatabaseUrl) {
    throw new Error(
      `Refusing to reset the database: DATABASE_URL (${resolvedTestUrl}) is identical to the ` +
        "development database's URL. This usually means DATABASE_URL is exported in your shell " +
        "and is shadowing server/.env.test. Run `unset DATABASE_URL` and try again.",
    );
  }
}

/**
 * Best-effort: reads the dev DATABASE_URL directly from server/.env, bypassing
 * whatever value process.env.DATABASE_URL currently holds. Returns undefined
 * if the file doesn't exist (e.g. in CI, where there is no dev database).
 */
export function readDevDatabaseUrl(): string | undefined {
  try {
    return parse(readFileSync(path.join(serverDir, '.env'), 'utf-8')).DATABASE_URL;
  } catch {
    return undefined;
  }
}

/**
 * Called once at server startup. Runs the same check as resetDb(), but here
 * because E2E specs never call resetDb() — they hit the running server
 * directly and never wipe data — so this is the only backstop that stands
 * between an E2E run and the development database. Fires whenever the
 * process boots with NODE_ENV=test, regardless of *how* DATABASE_URL ended
 * up resolving to the dev URL (missing .env.test, ambient shell state, a
 * misconfigured test env file, ...).
 */
export function assertServerBootDatabaseIsolation(
  nodeEnv: string,
  resolvedDatabaseUrl: string,
  devDatabaseUrl: string | undefined,
): void {
  if (nodeEnv === 'test') {
    assertIsolatedTestDatabase(resolvedDatabaseUrl, devDatabaseUrl);
  }
}
