import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('dashboard has no critical accessibility violations', async ({ page }) => {
  await page.goto('/admin');
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''));
  expect(critical).toEqual([]);
});
