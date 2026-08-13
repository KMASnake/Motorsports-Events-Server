import { expect, test } from '@playwright/test';

test('ACP remains functional under the production Nginx CSP', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await page.getByLabel('Identifiant').fill('admin');
  await page.getByLabel('Mot de passe').fill(process.env.ADMIN_PASSWORD ?? 'correct horse battery staple');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/$/);
  // The initial anonymous session probe intentionally receives 401 before login.
  browserErrors.length = 0;

  for (const [path, heading] of [
    ['/', 'TABLEAU DE BORD'],
    ['/championships', 'CHAMPIONNATS'],
    ['/synchronizations', 'SYNCHRONISATIONS']
  ] as const) {
    await page.goto(path);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  expect(browserErrors.filter((message) => /content security policy|refused to/i.test(message))).toEqual([]);
  expect(browserErrors).toEqual([]);
});
