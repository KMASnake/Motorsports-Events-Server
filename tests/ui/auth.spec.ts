import { expect, test } from '@playwright/test';

test.describe('Authentification administration Lot 4.4', () => {
  test('protège la console, restaure la destination et révoque au logout', async ({ page }) => {
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'correct horse battery staple';
    await page.goto('/events?view=list');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.locator('.app-shell')).toHaveCount(0);

    await page.getByLabel('Identifiant').fill('admin');
    await page.getByLabel('Mot de passe').fill('wrong password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toContainText('Identifiant ou mot de passe incorrect');

    await page.getByLabel('Mot de passe').fill(adminPassword);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/events\?view=list$/);
    await expect(page.locator('.app-shell')).toBeVisible();
    await expect(page.getByText('admin', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => ({ local: localStorage.getItem('mse_admin_token'), session: sessionStorage.getItem('mse_admin_token') }))).toEqual({ local: null, session: null });

    await page.reload();
    await expect(page).toHaveURL(/\/events\?view=list$/);
    await expect(page.locator('.app-shell')).toBeVisible();

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/events');
    await expect(page).toHaveURL(/\/login$/);
  });
});
