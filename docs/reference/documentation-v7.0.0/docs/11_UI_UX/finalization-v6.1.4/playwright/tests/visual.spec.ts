import { test, expect } from '@playwright/test';

const routes = [
  '/admin',
  '/admin/events',
  '/admin/championships',
  '/admin/circuits',
  '/admin/providers',
  '/admin/synchronizations',
  '/admin/corrections',
  '/admin/api',
  '/admin/observability',
  '/admin/logs',
  '/admin/backups',
  '/admin/users',
  '/admin/settings',
  '/admin/maintenance'
];

for (const route of routes) {
  test(`visual ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(route.replaceAll('/', '_') + '.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.01
    });
  });
}
