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
