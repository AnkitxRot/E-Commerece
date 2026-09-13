import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Every spec shares one real dev server and Postgres database, and auth
  // endpoints share one IP-keyed rate limiter — see vitest.config.ts's
  // fileParallelism note for the same reasoning applied to integration tests.
  workers: 1,
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    { command: 'npm run dev -w server', port: 4000, reuseExistingServer: true },
    { command: 'npm run dev -w client', port: 5173, reuseExistingServer: true },
  ],
});
