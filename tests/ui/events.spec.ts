import { expect, test } from '@playwright/test';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

test.describe('Événements lot 4 rev.1', () => {
  test('affiche le calendrier par défaut et conserve la liste secondaire', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-01T10:00:00+02:00'));
    await page.goto('/events');
    const calendarTab = page.getByRole('tab', { name: 'Mois' });
    const listTab = page.getByRole('tab', { name: 'Liste' });

    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Calendrier mensuel des événements')).toBeVisible();
    await expect(page.getByLabel('Légende des couleurs du calendrier')).toBeVisible();
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

  test('expose les vues interactives et les captures du lot 4.2', async ({ page, request }) => {
    const eventsResponse = await request.get(`${apiUrl}/api/v1/admin/events`);
    const events = await eventsResponse.json();
    const source = events.find((event: { circuit_id?: string | null; ends_at?: string | null; published: boolean }) => event.circuit_id && event.ends_at && event.published);
    expect(source).toBeTruthy();
    const conflictSlug = `lot-42-overlap-${source.id}`;
    const existingConflict = events.some((event: { slug: string }) => event.slug === conflictSlug);
    if (!existingConflict) {
      const created = await request.post(`${apiUrl}/api/v1/admin/events`, { data: {
        championship_id: source.championship_id,
        circuit_id: source.circuit_id,
        name: 'Conflit visuel Lot 4.2',
        slug: conflictSlug,
        category: source.category,
        starts_at: source.starts_at,
        ends_at: source.ends_at,
        timezone: source.timezone,
        status: 'scheduled',
        published: true,
        origin: 'manual',
        description: 'Fixture isolée du test Chromium.'
      }});
      expect(created.ok()).toBeTruthy();
    }
    await page.clock.setFixedTime(new Date('2026-07-01T10:00:00+02:00'));
    await page.goto('/events');
    await page.getByRole('tab',{name:'Mois'}).click();
    await page.screenshot({path:'tests/ui/screenshots/events-month-1440x900.png'});
    await expect(page.getByRole('alert')).toContainText('se chevauchent');
    await page.screenshot({path:'tests/ui/screenshots/events-conflict-warning-1440x900.png'});
    for (const [tab,file] of [['Semaine','events-week-1440x900.png'],['Jour','events-day-1440x900.png'],['Agenda','events-agenda-1440x900.png']] as const) {
      await page.getByRole('tab',{name:tab}).click();
      await expect(page.getByRole('tab',{name:tab})).toHaveAttribute('aria-selected','true');
      await page.screenshot({path:`tests/ui/screenshots/${file}`});
    }
    await page.getByRole('tab',{name:'Mois'}).click();
    await page.locator('.events-calendar-chip').first().hover();
    await page.screenshot({path:'tests/ui/screenshots/events-drag-preview-1440x900.png'});
  });

  test('affiche les corrections champ par champ et le branding', async ({ page }) => {
    const marker = `correction-ui-${Date.now()}`;
    const workspace = await page.request.get(`${apiUrl}/api/v1/admin/events`);
    const events = await workspace.json();
    const source = events.find((event: { championship_id?: string; circuit_id?: string | null }) => event.championship_id && event.circuit_id);
    const created = await page.request.post(`${apiUrl}/api/v1/admin/events`, { data: {
      championship_id: source.championship_id, circuit_id: source.circuit_id,
      name: 'Événement fournisseur test', slug: marker, category: null,
      starts_at: '2026-12-22T10:00:00.000Z', ends_at: '2026-12-22T12:00:00.000Z',
      timezone: 'Europe/Paris', status: 'scheduled', published: true,
      origin: 'provider', provider_key: 'playwright-fixture', external_id: marker,
      description: 'Valeur fournisseur.'
    }});
    expect(created.ok()).toBeTruthy();
    const providerEvent = await created.json();
    const patched = await page.request.patch(`${apiUrl}/api/v1/admin/events/${providerEvent.id}`, { data: { name: 'Événement fournisseur corrigé' }});
    expect(patched.ok()).toBeTruthy();
    await page.goto('/corrections');
    await expect(page.getByRole('heading',{name:'CORRECTIONS'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Événement fournisseur corrigé'})).toBeVisible();
    await expect(page.getByText('Valeur locale effective').first()).toBeVisible();
    await page.screenshot({path:'tests/ui/screenshots/corrections-list-1440x900.png'});
    await page.screenshot({path:'tests/ui/screenshots/corrections-conflict-1440x900.png'});
    await expect(page.getByAltText('Motorsports Events Server')).toBeVisible();
    await page.screenshot({path:'tests/ui/screenshots/branding-header-1440x900.png'});
    const deleted = await page.request.delete(`${apiUrl}/api/v1/admin/events/${providerEvent.id}`);
    expect(deleted.ok()).toBeTruthy();
  });

  test('reste exploitable en 1280 × 720', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/events');
    await expect(page.getByRole('heading', { name: 'ÉVÉNEMENTS', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Mois' })).toBeVisible();
    await expect(page.getByLabel('Calendrier mensuel des événements')).toBeVisible();
  });

  test('adapte la navigation à la vue semaine et jour', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-01T10:00:00+02:00'));
    await page.goto('/events');
    const period = page.locator('.events-month-nav h2');
    await page.getByRole('tab', { name: 'Semaine' }).click();
    const week = await period.textContent();
    await page.getByRole('button', { name: 'Période suivante' }).click();
    expect(await period.textContent()).not.toBe(week);
    await page.getByRole('tab', { name: 'Jour' }).click();
    const day = await period.textContent();
    await page.getByRole('button', { name: 'Période précédente' }).click();
    expect(await period.textContent()).not.toBe(day);
  });

});
