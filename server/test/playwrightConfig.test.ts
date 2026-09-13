import { describe, expect, it } from 'vitest';
import config from '../../playwright.config.js';

/**
 * Regression guard for the root cause of the E2E dev-database bug: Playwright's
 * webServer must always force NODE_ENV=test so the spawned dev server loads
 * server/.env.test instead of server/.env, regardless of the invoking shell's
 * state. This asserts the config itself, independent of the runtime
 * assertServerBootDatabaseIsolation() guard in dbSafety.ts, so a future edit
 * that silently drops this fails a test instead of only being caught (or not)
 * at server boot.
 */
describe('playwright webServer environment', () => {
  const webServers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];

  it('forces NODE_ENV=test for every webServer entry', () => {
    expect(webServers.length).toBeGreaterThan(0);
    for (const server of webServers) {
      expect(server?.env?.NODE_ENV).toBe('test');
    }
  });

  it('never reuses an existing server, so a plain `npm run dev` cannot be mistaken for the E2E server', () => {
    // reuseExistingServer:true previously let Playwright silently attach to
    // an already-running dev-mode server on these ports, bypassing the
    // NODE_ENV override and the boot guard entirely — neither runs against
    // a server this config didn't spawn itself.
    for (const server of webServers) {
      expect(server?.reuseExistingServer).toBe(false);
    }
  });
});
