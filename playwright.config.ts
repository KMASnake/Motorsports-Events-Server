import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  outputDir: './test-results/playwright',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
