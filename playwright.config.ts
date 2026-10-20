import { defineConfig, devices } from '@playwright/test';

// Phone smoke test against the real Firebase project (writes to the "dev" event).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ...devices['Pixel 7'],
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:3000/e/dev', reuseExistingServer: true, timeout: 120_000 },
});
