import { expect, test } from '@playwright/test';

test('ACP remains functional under the production Nginx CSP', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location();
      browserErrors.push(`${message.text()}${location.url ? ` (${location.url}:${location.lineNumber ?? 0})` : ''}`);
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      browserErrors.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

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
    ['/synchronizations', 'SYNCHRONISATION FOURNISSEUR']
  ] as const) {
    await page.goto(path);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  const cspErrors = browserErrors.filter((message) => /content security policy|refused to/i.test(message));
  const otherBrowserErrors = browserErrors.filter((message) => !cspErrors.includes(message));
  expect(cspErrors, `Unexpected CSP browser errors:\n${cspErrors.join('\n') || '(none)'}`).toEqual([]);
  expect(otherBrowserErrors, `Unexpected non-CSP browser errors:\n${otherBrowserErrors.join('\n') || '(none)'}`).toEqual([]);
});
