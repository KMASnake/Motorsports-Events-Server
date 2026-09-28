import { expect, test } from '@playwright/test';

const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
const adminToken = process.env.ADMIN_TOKEN;
const adminPassword = process.env.ADMIN_PASSWORD;

test.describe('Événements lot 4 rev.1', () => {
  test.use({ extraHTTPHeaders: adminToken ? { authorization: `Bearer ${adminToken}` } : {} });
  test.beforeEach(async ({ page }) => {
    if (!adminToken || !adminPassword) throw new Error('ADMIN_TOKEN et ADMIN_PASSWORD sont requis pour la recette UI administrative.');
    await page.goto('/events');
    await page.getByLabel('Identifiant').fill('admin');
    await page.getByLabel('Mot de passe').fill(adminPassword);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/events/);
  });
  test('affiche le calendrier par défaut et conserve la liste secondaire', async ({ page, request }) => {
    await page.clock.setFixedTime(new Date('2026-07-01T10:00:00+02:00'));
    await page.goto('/events');
    const calendarTab = page.getByRole('tab', { name: 'Mois' });
    const listTab = page.getByRole('tab', { name: 'Liste' });

    await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Calendrier mensuel des événements')).toBeVisible();
    await expect(page.getByLabel('Légende des couleurs du calendrier')).toBeVisible();
    await expect(page.getByLabel('Fournisseur')).toContainText('Tous les fournisseurs');
    const loadedEvents = await (await request.get(`${apiUrl}/api/v1/admin/events`)).json();
    const actualSources = new Set(loadedEvents.map((event: { origin: string; provider_key?: string | null }) =>
      event.origin === 'manual' ? 'motorsports-events' : event.provider_key === 'ocblacktop' || event.provider_key === 'thesportsdb' ? event.provider_key : event.provider_key ? `provider:${event.provider_key.toLowerCase()}` : 'provider-identity-missing'
    ));
    await expect(page.getByLabel('Fournisseur').locator('option')).toHaveCount(actualSources.size + 1);
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

  test('un double-clic sur un Event existant ouvre son édition préremplie, jamais une création',async({page,request})=>{
    const rows=await (await request.get(`${apiUrl}/api/v1/admin/events`)).json();
    const source=rows.find((event:{name:string;meeting_id:string|null;circuit_id:string|null;ends_at:string|null})=>event.name==='Événement test 2'&&!event.meeting_id&&event.circuit_id&&event.ends_at);
    expect(source).toBeTruthy();
    await page.clock.setFixedTime(new Date(source.starts_at));
    await page.goto('/events');
    const chip=page.locator('.events-calendar-chip').filter({has:page.getByText(source.name,{exact:true})});
    await expect(chip).toHaveCount(1);
    await expect(chip).toBeVisible();await chip.dblclick();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('heading',{name:'Modifier l’événement'})).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Enregistrer les modifications'})).toBeVisible();
    await expect(dialog.getByLabel('Nom public *')).toHaveValue(source.name);
    await expect(dialog.getByLabel('Circuit')).toHaveValue(source.circuit_id);
    await expect(dialog.getByLabel('Fin', { exact: true })).not.toHaveValue('');
    await expect(dialog.getByRole('heading',{name:'Nouvel événement'})).toHaveCount(0);
    await dialog.getByRole('button',{name:'Annuler'}).click();
    await page.getByLabel(/Créer un événement le/).first().click();
    await expect(page.getByRole('heading',{name:'Nouvel événement'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Créer l’événement'})).toBeVisible();
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
    const workspace = await page.request.get(`${apiUrl}/api/v1/admin/events`);
    const events = await workspace.json();
    const providerEvent = events.find((event: { name?:string; origin?:string; normalized_uuid?:string|null; correction_count?:number; starts_at?:string; ends_at?:string|null }) => event.name==='Événement test 10'&&event.origin==='provider'&&event.normalized_uuid&&event.correction_count===0&&event.starts_at&&event.ends_at);
    expect(providerEvent).toBeTruthy();
    const providersResponse=await page.request.get(`${apiUrl}/api/v1/admin/providers`);
    expect(providersResponse.ok()).toBeTruthy();
    const providers=await providersResponse.json() as Array<{adapter_key:string;name:string}>;
    const providerMetadata=providers.find(provider=>provider.adapter_key===providerEvent.provider_key);
    expect(providerMetadata).toBeTruthy();
    const intervalStart=new Date(providerEvent.starts_at).getTime();
    const intervalEnd=new Date(providerEvent.ends_at).getTime();
    expect(intervalEnd).toBeGreaterThan(intervalStart);
    const correctedStart=new Date(intervalStart+Math.floor((intervalEnd-intervalStart)/2)).toISOString();
    const expectedLocalStart=await page.evaluate((iso)=>{const date=new Date(iso);return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,16)},correctedStart);
    const patched = await page.request.patch(`${apiUrl}/api/v1/admin/events/${providerEvent.id}`, { data: { name: 'Événement fournisseur corrigé', starts_at: correctedStart, status: 'postponed', session_title:'Session locale' }});
    expect(patched.ok()).toBeTruthy();
    await page.goto('/corrections');
    await expect(page.getByRole('heading',{name:'CORRECTIONS'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Événement fournisseur corrigé'})).toBeVisible();
    await expect(page.getByLabel('Fournisseur')).toContainText(providerMetadata!.name);
    await page.getByLabel('Fournisseur').selectOption(`provider:${providerEvent.provider_key}`);
    await expect(page.getByRole('heading',{name:'Événement fournisseur corrigé'})).toBeVisible();
    await expect(page.getByLabel('Fournisseur')).toHaveValue(`provider:${providerEvent.provider_key}`);
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
    await expect(page.locator('.correction-field')).toHaveCount(9);
    await expect(page.getByRole('button',{name:'Restaurer fournisseur'}).first()).toBeVisible();
    await expect(page.getByRole('button',{name:'Supprimer correction'})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Conserver local'})).toHaveCount(0);
    await expect(page.getByText('Reporté',{exact:true}).first()).toBeVisible();
    const providerArticle=page.locator('.corrections-list article').filter({has:page.getByRole('heading',{name:'Événement fournisseur ajusté'})});
    const dateCorrection=providerArticle.locator('.correction-field').filter({hasText:'Début'});
    await dateCorrection.getByRole('button',{name:'Modifier local'}).click();
    await expect(dateCorrection.getByLabel('Nouvelle valeur Début')).toHaveAttribute('type','datetime-local');
    await expect(dateCorrection.getByLabel('Nouvelle valeur Début')).toHaveValue(expectedLocalStart);
    await dateCorrection.getByRole('button',{name:'Annuler'}).click();
    await page.screenshot({path:'tests/ui/screenshots/corrections-list-1440x900.png'});
    await page.screenshot({path:'tests/ui/screenshots/corrections-conflict-1440x900.png'});
    await expect(page.getByAltText('Motorsports Events Server')).toBeVisible();
    await page.screenshot({path:'tests/ui/screenshots/branding-header-1440x900.png'});
    await providerArticle.getByRole('button',{name:'Ouvrir l’événement'}).click();
    await expect(page).toHaveURL(new RegExp(`/events\\?event_id=${providerEvent.id}`));
    await expect(page.getByRole('heading',{name:'Événement fournisseur ajusté'})).toBeVisible();
    const cleanup = await page.request.get(`${apiUrl}/api/v1/admin/corrections?event_id=${providerEvent.id}`);
    for (const correction of await cleanup.json()) {
      const restored=await page.request.post(`${apiUrl}/api/v1/admin/corrections/${correction.id}/accept-provider`);
      expect(restored.ok()).toBeTruthy();
    }
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

  test('affiche les identités visuelles sur le tableau de bord', async ({ page }) => {
    const response = await page.request.get(`${apiUrl}/api/v1/admin/events`);
    expect(response.ok()).toBeTruthy();
    const events = await response.json() as Array<{id:string;name:string;championship_name:string;starts_at:string}>;
    const exploitable = events
      .filter(event => event.id && event.name && event.championship_name && Number.isFinite(new Date(event.starts_at).getTime()))
      .sort((left,right) => new Date(left.starts_at).getTime()-new Date(right.starts_at).getTime() || left.id.localeCompare(right.id));
    expect(exploitable.length).toBeGreaterThan(0);
    const now = new Date(new Date(exploitable[0].starts_at).getTime()-60*60*1000).getTime();
    const limit = now+48*60*60*1000;
    const expected = events.filter(event => {
      const start = new Date(event.starts_at).getTime();
      return start>=now&&start<=limit;
    }).sort((left,right) => new Date(left.starts_at).getTime()-new Date(right.starts_at).getTime());
    expect(expected.length).toBeGreaterThan(0);
    await page.clock.setFixedTime(new Date(now));
    await page.goto('/');
    await expect(page.locator('.timeline-row')).toHaveCount(expected.length);
    for (const event of expected) {
      const row = page.locator(`.timeline-row[data-event-id="${event.id}"]`);
      await expect(row).toBeVisible();
      await expect(row).toContainText(event.name);
      await expect(row).toContainText(event.championship_name);
      const logo = row.locator('.timeline-championship img');
      await expect(logo).toHaveCount(1);
      await expect(logo).toBeVisible();
      expect(await logo.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
    }
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
