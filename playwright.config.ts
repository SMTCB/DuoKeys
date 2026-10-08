import { defineConfig } from '@playwright/test';

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  retries: 0,
  // The dev server compiles each route on first visit, which can take several
  // seconds per page while tests run in parallel; CI serves the production
  // build instead, so these ceilings mostly matter locally.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  webServer: {
    // CI has already run `pnpm run build` by the time e2e starts.
    command: isCi ? 'pnpm exec next start -p 3000' : 'pnpm run dev',
    port: 3000,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
