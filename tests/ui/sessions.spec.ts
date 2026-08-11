import { expect, test, type Page } from '@playwright/test';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
const adminToken = process.env.ADMIN_TOKEN;
const headers = () => ({ authorization: `Bearer ${adminToken}` });

async function openEventEditor(page: Page) {
  await page.goto('/events?event_id=evt-001');
  await expect(page.getByRole('heading', { name: 'Grand Prix de France' })).toBeVisible();
  await page.locator('.event-details').getByRole('button', { name: 'Modifier' }).click();
  return page.getByRole('dialog', { name: 'Modifier l’événement' });
}

test.describe.serial('Lot 4.3 — un Événement représente une Session', () => {
  test.use({ extraHTTPHeaders: adminToken ? headers() : {} });
  test.beforeEach(async ({ page }) => {
    if (!adminToken) throw new Error('ADMIN_TOKEN est requis.');
    await page.addInitScript((token) => sessionStorage.setItem('mse_admin_token', token), adminToken);
  });

  test('intègre une unique combobox créable au formulaire Événement', async ({ page }) => {
    await page.goto('/events?event_id=evt-001');
    await expect(page.locator('.event-details')).toContainText('Qualifications');
    const dialog = await openEventEditor(page);
    const title = dialog.getByLabel('Intitulé de session');
    await expect(title).toHaveValue('Qualifications');
    await dialog.getByRole('button', { name: 'Afficher les intitulés de session' }).click();
    await expect(dialog.getByRole('option', { name: 'FP1 fournisseur' })).toBeVisible();
    await expect(dialog.getByRole('option', { name: 'Warm-up' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sessions de l’événement' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ajouter.*Session/i })).toHaveCount(0);
    await expect(dialog.getByText(/^(fournisseur|local)$/i)).toHaveCount(0);
    await page.screenshot({ path: 'tests/ui/screenshots/event-session-title-1440x900.png' });
  });

  test('enregistre un intitulé inédit puis le repropose', async ({ page, request }) => {
    let dialog = await openEventEditor(page);
    await dialog.getByLabel('Intitulé de session').fill('Superpole inédit UI');
    await dialog.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.getByRole('status')).toContainText('Événement mis à jour');

    const response = await request.get(`${apiUrl}/api/v1/admin/events/evt-001`, { headers: headers() });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).session_title).toBe('Superpole inédit UI');

    dialog = await openEventEditor(page);
    await expect(dialog.getByLabel('Intitulé de session')).toHaveValue('Superpole inédit UI');
    await dialog.getByRole('button', { name: 'Afficher les intitulés de session' }).click();
    await expect(dialog.getByRole('option', { name: 'Superpole inédit UI' })).toBeVisible();
  });

  test('reste utilisable sur mobile sans interface multi-sessions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openEventEditor(page);
    await expect(dialog.getByLabel('Intitulé de session')).toBeVisible();
    await expect(page.locator('.event-sessions')).toHaveCount(0);
    await page.screenshot({ path: 'tests/ui/screenshots/event-session-title-mobile-390x844.png', fullPage: true });
  });
});
