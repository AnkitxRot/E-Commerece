import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    { command: 'npm run dev -w server', port: 4000, reuseExistingServer: true },
    { command: 'npm run dev -w client', port: 5173, reuseExistingServer: true },
  ],
});
