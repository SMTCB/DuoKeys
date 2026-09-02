import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  retries: 0,
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env['CI'],
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
