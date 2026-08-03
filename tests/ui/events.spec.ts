import { expect, test } from '@playwright/test';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

test.describe('Événements lot 4 rev.1', () => {
  test('affiche le calendrier par défaut et conserve la liste secondaire', async ({ page, request }) => {
    await page.clock.setFixedTime(new Date('2026-07-01T10:00:00+02:00'));
    await page.goto('/events');
    const calendarTab = page.getByRole('tab', { name: 'Mois' });
    const listTab = page.getByRole('tab', { name: 'Liste' });

    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Calendrier mensuel des événements')).toBeVisible();
    await expect(page.getByLabel('Légende des couleurs du calendrier')).toBeVisible();
    await expect(page.getByLabel('Fournisseur')).toContainText('Tous les fournisseurs');
    await expect(page.getByLabel('Fournisseur')).toContainText('OC BlackTop');
    await expect(page.getByLabel('Fournisseur')).toContainText('TheSportsDB');
    await expect(page.getByLabel('Fournisseur')).toContainText('Motorsports Events');
    await page.screenshot({ path: 'tests/ui/screenshots/events-calendar-1440x900.png' });

    await listTab.click();
    await expect(listTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('DATE ET HEURE')).toBeVisible();
    const rows = await (await request.get(`${apiUrl}/api/v1/admin/events`)).json();
    const reference = new Date('2026-07-01T08:00:00.000Z').getTime();
    const nearest = [...rows].sort((left, right) => Math.abs(new Date(left.starts_at).getTime() - reference) - Math.abs(new Date(right.starts_at).getTime() - reference))[0];
    await expect(page.locator('.events-list article')).toHaveCount(Math.min(25, rows.length));
    await expect(page.locator('.events-list article').first()).toContainText(nearest.name);
    await expect(page.getByRole('navigation', { name: 'Pagination des événements' })).toContainText('Page 1');
    const chronological = [...rows].sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());
    await page.getByRole('button', { name: 'Trier par DATE ET HEURE' }).click();
    await expect(page.locator('.events-list article').first()).toContainText(chronological[0].name);
    await page.getByRole('button', { name: 'Trier par DATE ET HEURE' }).click();
    await expect(page.locator('.events-list article').first()).toContainText(chronological.at(-1).name);
    const alphabetical = [...rows].sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }));
    await page.getByRole('button', { name: 'Trier par ÉVÉNEMENT' }).click();
    await expect(page.locator('.events-list article').first()).toContainText(alphabetical[0].name);
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
    await expect(page.getByLabel(/Slug technique/i)).toHaveCount(0);
    await expect(page.getByLabel(/Fuseau horaire/i)).toHaveCount(0);
    await expect(page.getByLabel(/Mode de gestion/i)).toHaveCount(0);
  });

  test('expose les vues interactives et les captures du lot 4.2', async ({ page, request }) => {
    const eventsResponse = await request.get(`${apiUrl}/api/v1/admin/events`);
    const events = await eventsResponse.json();
    const source = events.find((event: { circuit_id?: string | null; ends_at?: string | null; published: boolean }) => event.circuit_id && event.ends_at && event.published);
    expect(source).toBeTruthy();
    const existingConflict = events.some((event: { name: string }) => event.name === 'Conflit visuel Lot 4.2');
    if (!existingConflict) {
      const created = await request.post(`${apiUrl}/api/v1/admin/events`, { data: {
        championship_id: source.championship_id,
        circuit_id: source.circuit_id,
        name: 'Conflit visuel Lot 4.2',
        category: source.category,
        starts_at: source.starts_at,
        ends_at: source.ends_at,
        status: 'scheduled',
        published: true,
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
    const circuitsResponse = await page.request.get(`${apiUrl}/api/v1/circuits`);
    const circuits = await circuitsResponse.json();
    const source = events.find((event: { championship_id?: string; circuit_id?: string | null }) => event.championship_id && event.circuit_id);
    const targetCircuit = circuits.find((circuit: { id:string }) => circuit.id !== source.circuit_id);
    const created = await page.request.post(`${apiUrl}/api/v1/admin/provider-events`, { data: {
      championship_id: source.championship_id, circuit_id: source.circuit_id,
      name: 'Événement fournisseur test', category: null,
      starts_at: '2026-12-22T10:00:00.000Z', ends_at: '2026-12-22T12:00:00.000Z',
      status: 'scheduled', published: true,
      provider_key: 'playwright-fixture', external_id: marker,
      description: 'Valeur fournisseur.'
    }});
    expect(created.ok()).toBeTruthy();
    const providerEvent = await created.json();
    const patched = await page.request.patch(`${apiUrl}/api/v1/admin/events/${providerEvent.id}`, { data: { name: 'Événement fournisseur corrigé', circuit_id: targetCircuit.id, starts_at: '2026-12-22T11:30:00.000Z' }});
    expect(patched.ok()).toBeTruthy();
    await page.goto('/corrections');
    await expect(page.getByRole('heading',{name:'CORRECTIONS'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Événement fournisseur corrigé'})).toBeVisible();
    await expect(page.getByLabel('Fournisseur')).toContainText('Playwright Fixture');
    await page.getByLabel('Fournisseur').selectOption('provider:playwright-fixture');
    await expect(page.getByRole('heading',{name:'Événement fournisseur corrigé'})).toBeVisible();
    await expect(page.getByLabel('Fournisseur')).toHaveValue('provider:playwright-fixture');
    await expect(page.getByLabel('Championnat')).toBeVisible();
    await expect(page.getByLabel('Champ corrigé')).toContainText('Nom');
    await expect(page.getByLabel('Statut de correction')).toBeVisible();
    await expect(page.getByLabel('Présence d’un conflit')).toBeVisible();
    await expect(page.getByLabel('Auteur')).toContainText('administrator');
    await expect(page.getByLabel('Nombre de champs')).toBeVisible();
    await page.getByLabel('Champ corrigé').selectOption('name');
    await expect(page.locator('.correction-field')).toHaveCount(1);
    await expect(page.getByText('Valeur locale effective').first()).toBeVisible();
    const nameCorrection=page.locator('.correction-field').filter({hasText:'Nom'});
    await nameCorrection.getByRole('button',{name:'Modifier local'}).click();
    await nameCorrection.getByLabel('Nouvelle valeur Nom').fill('Événement fournisseur ajusté');
    await nameCorrection.getByRole('button',{name:'Enregistrer'}).click();
    await expect(page.getByRole('heading',{name:'Événement fournisseur ajusté'})).toBeVisible();
    await page.getByRole('button',{name:'Réinitialiser'}).click();
    await expect(page.getByText(source.circuit_name,{exact:true})).toBeVisible();
    await expect(page.getByText(targetCircuit.name,{exact:true})).toBeVisible();
    await expect(page.getByText(source.circuit_id,{exact:true})).toHaveCount(0);
    await expect(page.getByText(targetCircuit.id,{exact:true})).toHaveCount(0);
    const circuitCorrection=page.locator('.correction-field').filter({hasText:'Circuit'});
    await circuitCorrection.getByRole('button',{name:'Modifier local'}).click();
    await expect(circuitCorrection.getByLabel('Nouvelle valeur Circuit')).toHaveValue(targetCircuit.id);
    await expect(circuitCorrection.getByLabel('Nouvelle valeur Circuit')).toContainText(targetCircuit.name);
    await circuitCorrection.getByRole('button',{name:'Annuler'}).click();
    const dateCorrection=page.locator('.correction-field').filter({hasText:'Début'});
    await dateCorrection.getByRole('button',{name:'Modifier local'}).click();
    await expect(dateCorrection.getByLabel('Nouvelle valeur Début')).toHaveAttribute('type','datetime-local');
    await expect(dateCorrection.getByLabel('Nouvelle valeur Début')).toHaveValue('2026-12-22T11:30');
    await dateCorrection.getByRole('button',{name:'Annuler'}).click();
    await page.screenshot({path:'tests/ui/screenshots/corrections-list-1440x900.png'});
    await page.screenshot({path:'tests/ui/screenshots/corrections-conflict-1440x900.png'});
    await expect(page.getByAltText('Motorsports Events Server')).toBeVisible();
    await page.screenshot({path:'tests/ui/screenshots/branding-header-1440x900.png'});
    await page.getByRole('button',{name:'Ouvrir l’événement'}).click();
    await expect(page).toHaveURL(new RegExp(`/events\\?event_id=${providerEvent.id}`));
    await expect(page.getByRole('heading',{name:'Événement fournisseur ajusté'})).toBeVisible();
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

  test('affiche les identités visuelles dans la page championnats', async ({ page }) => {
    await page.goto('/championships');
    const logos = page.locator('.lot3-identity img.lot3-logo');
    await expect(logos.first()).toBeVisible();
    expect(await logos.count()).toBeGreaterThan(0);
    expect(await logos.first().evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({path:'tests/ui/screenshots/championships-logos-1440x900.png'});
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
