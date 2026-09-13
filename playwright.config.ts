import { defineConfig } from '@playwright/test';

// E2E specs register real users and place real orders — they must never run
// against the development database. NODE_ENV=test is set explicitly here
// (not left to the invoking shell) so the server always loads server/.env.test
// (audio_commerce_test) instead of server/.env, even if a developer's shell
// already has NODE_ENV or DATABASE_URL exported for something else. The
// server also independently refuses to boot under NODE_ENV=test if
// DATABASE_URL still resolves to the dev database — see
// server/src/config/dbSafety.ts.
const testEnv = { ...process.env, NODE_ENV: 'test' };

export default defineConfig({
  testDir: './e2e',
  // Every spec shares one real dev server and Postgres database, and auth
  // endpoints share one IP-keyed rate limiter — see vitest.config.ts's
  // fileParallelism note for the same reasoning applied to integration tests.
  workers: 1,
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    { command: 'npm run dev -w server', port: 4000, reuseExistingServer: true, env: testEnv },
    { command: 'npm run dev -w client', port: 5173, reuseExistingServer: true, env: testEnv },
  ],
});
