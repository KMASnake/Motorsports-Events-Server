import { expect, test } from '@playwright/test';

test.describe('Événements lot 4 rev.1', () => {
  test('affiche le calendrier par défaut et conserve la liste secondaire', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-01T10:00:00+02:00'));
    await page.goto('/events');
    const calendarTab = page.getByRole('tab', { name: 'Mois' });
    const listTab = page.getByRole('tab', { name: 'Liste' });

    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Calendrier mensuel des événements')).toBeVisible();
    await page.screenshot({ path: 'tests/ui/screenshots/events-calendar-1440x900.png' });

    await listTab.click();
    await expect(listTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('DATE ET HEURE')).toBeVisible();
    await page.screenshot({ path: 'tests/ui/screenshots/events-list-1440x900.png' });

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Liste' })).toHaveAttribute('aria-selected', 'true');
  });

  test('partage la sélection et ouvre la création depuis un jour', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-01T10:00:00+02:00'));
    await page.goto('/events');
    await expect(page.getByText('DÉTAIL DE L’ÉVÉNEMENT')).toBeVisible();
    await page.getByLabel(/Créer un événement le/).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Début *')).not.toHaveValue('');
  });
});
