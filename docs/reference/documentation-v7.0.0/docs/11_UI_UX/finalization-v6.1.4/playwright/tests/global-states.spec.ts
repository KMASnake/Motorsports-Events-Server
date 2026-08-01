import { test, expect } from '@playwright/test';

test('session expired dialog traps focus', async ({ page }) => {
  await page.goto('/admin?state=session-expired');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: /se reconnecter/i })).toBeFocused();
});

test('network error exposes retry', async ({ page }) => {
  await page.goto('/admin?state=network-error');
  await expect(page.getByRole('button', { name: /réessayer/i })).toBeVisible();
});
