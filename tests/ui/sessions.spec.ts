import { expect, test, type Page } from '@playwright/test';

const apiUrl=process.env.API_URL??'http://localhost:3001';
const adminToken=process.env.ADMIN_TOKEN;
const headers=()=>({authorization:`Bearer ${adminToken}`});

async function openFixture(page:Page){await page.goto('/events?event_id=evt-001');await expect(page.getByRole('heading',{name:'Grand Prix de France'})).toBeVisible();await expect(page.getByRole('region',{name:'Sessions de l’événement'})).toBeVisible()}

test.describe.serial('Lot 4.3 — Sessions dans la fiche Événement',()=>{
  test.use({extraHTTPHeaders:adminToken?headers():{}});
  test.beforeEach(async({page})=>{if(!adminToken)throw new Error('ADMIN_TOKEN est requis.');await page.addInitScript((token)=>sessionStorage.setItem('mse_admin_token',token),adminToken)});

  test('affiche les Sessions chronologiquement et un formulaire métier unique',async({page})=>{
    await openFixture(page);
    const rows=page.locator('.session-list article');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('Q1');
    await expect(rows.nth(1)).toContainText('FP1 locale');
    await expect(rows.nth(2)).toContainText('Warm-up fournisseur');
    await expect(rows.nth(3)).toContainText('Main Event');
    await expect(rows.nth(3)).toContainText('Non publiée');
    await expect(rows.nth(1)).toContainText('Correction');
    await page.getByRole('button',{name:'Ajouter',exact:false}).click();
    const dialog=page.getByRole('dialog',{name:'Nouvelle session'});
    await expect(dialog.getByLabel('Intitulé de session *')).toBeVisible();
    await expect(dialog.locator('datalist option[value="FP1 fournisseur"]')).toHaveCount(1);
    await expect(dialog.locator('datalist option[value="Main Event"]')).toHaveCount(1);
    await expect(dialog.getByLabel(/^name$|^type$|origine|provider_key|external_id|created_at|updated_at/i)).toHaveCount(0);
    await page.screenshot({path:'tests/ui/screenshots/sessions-event-panel-1440x900.png'});
    await dialog.getByRole('button',{name:'Fermer'}).click();
  });

  test('crée avec suggestion ou intitulé inédit, édite et supprime une Session manuelle',async({page})=>{
    await openFixture(page);
    await page.getByRole('button',{name:'Ajouter',exact:false}).click();
    let dialog=page.getByRole('dialog',{name:'Nouvelle session'});
    await dialog.getByLabel('Intitulé de session *').fill('Q1');
    await dialog.getByLabel('Début *').fill('2026-05-10T07:00');
    await dialog.getByLabel('Fin facultative').fill('');
    await dialog.getByLabel('Statut').selectOption('draft');
    await dialog.getByLabel('Publiée dans l’API clients').uncheck();
    await dialog.getByRole('button',{name:'Ajouter la session'}).click();
    await expect(page.getByRole('status')).toContainText('Session ajoutée');
    await page.getByRole('button',{name:'Ajouter',exact:false}).click();
    dialog=page.getByRole('dialog',{name:'Nouvelle session'});
    await dialog.getByLabel('Intitulé de session *').fill('Superpole inédit UI');
    await dialog.getByLabel('Début *').fill('2026-05-10T11:00');
    await dialog.getByRole('button',{name:'Ajouter la session'}).click();
    await expect(page.locator('.session-list article').filter({hasText:'Superpole inédit UI'})).toBeVisible();
    const novel=page.locator('.session-list article').filter({hasText:'Superpole inédit UI'});
    await novel.getByRole('button',{name:'Modifier'}).click();
    dialog=page.getByRole('dialog',{name:'Modifier la session'});
    await expect(dialog.locator('datalist option[value="Superpole inédit UI"]')).toHaveCount(1);
    await dialog.getByLabel('Intitulé de session *').fill('Superpole UI modifiée');
    await dialog.getByLabel('Publiée dans l’API clients').uncheck();
    await dialog.getByRole('button',{name:'Enregistrer la session'}).click();
    const modified=page.locator('.session-list article').filter({hasText:'Superpole UI modifiée'});
    await expect(modified).toContainText('Non publiée');
    page.on('dialog',(confirmation)=>confirmation.accept());
    await modified.getByRole('button',{name:'Supprimer'}).click();
    await expect(modified).toHaveCount(0);
  });

  test('protège le fournisseur et traite accepter, conserver et restaurer',async({page,request})=>{
    await openFixture(page);
    const provider=page.locator('.session-list article').filter({hasText:'FP1 locale'});
    await expect(provider.getByRole('button',{name:'Modifier'})).toHaveCount(0);
    await provider.getByRole('button',{name:'Traiter la correction'}).click();
    let dialog=page.getByRole('dialog',{name:/Corrections/});
    await expect(dialog.getByText('FP1 fournisseur')).toBeVisible();
    await expect(dialog.getByText('FP1 locale',{exact:true})).toBeVisible();
    await page.screenshot({path:'tests/ui/screenshots/sessions-corrections-1440x900.png'});
    await dialog.getByRole('button',{name:'Conserver override local'}).click();
    await expect(dialog.getByText('Correction locale')).toBeVisible();
    await dialog.getByRole('button',{name:'Accepter fournisseur'}).click();
    await expect(dialog.getByText('Aucune correction active')).toBeVisible();
    await dialog.getByRole('button',{name:'Fermer'}).click();
    const override=await request.patch(`${apiUrl}/api/v1/admin/sessions/lot43-ui-provider/override`,{headers:headers(),data:{field_name:'title',override_value:'Override restaurable'}});
    expect(override.ok()).toBeTruthy();
    await page.reload();
    const overridden=page.locator('.session-list article').filter({hasText:'Override restaurable'});
    await overridden.getByRole('button',{name:'Traiter la correction'}).click();
    dialog=page.getByRole('dialog',{name:/Corrections/});
    await dialog.getByRole('button',{name:'Restaurer fournisseur'}).click();
    await expect(dialog.getByText('Aucune correction active')).toBeVisible();
    await expect(page.getByLabel(/type technique|provider_key|external_id/i)).toHaveCount(0);
  });

  test('affiche DST/minuit, restaure visuellement une erreur et reste utilisable en mobile',async({page,request})=>{
    await openFixture(page);
    const dst=page.locator('.session-list article').filter({hasText:'Main Event'});
    await expect(dst).toContainText('25/10/2026');
    const created=await request.post(`${apiUrl}/api/v1/admin/events/evt-001/sessions`,{headers:headers(),data:{title:'Rollback UI',starts_at:'2026-05-10T12:00:00+02:00',ends_at:null,status:'scheduled',published:true,description:null}});
    expect(created.ok()).toBeTruthy(); const row=await created.json(); await page.reload();
    const rollback=page.locator('.session-list article').filter({hasText:'Rollback UI'});
    await page.route(`**/api/v1/admin/sessions/${row.id}`,route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Échec simulé'})}));
    page.on('dialog',(confirmation)=>confirmation.accept()); await rollback.getByRole('button',{name:'Supprimer'}).click();
    await expect(rollback).toBeVisible(); await expect(page.locator('.session-error')).toContainText('Suppression annulée');
    await page.unroute(`**/api/v1/admin/sessions/${row.id}`); await request.delete(`${apiUrl}/api/v1/admin/sessions/${row.id}`,{headers:headers()});
    await page.setViewportSize({width:390,height:844}); await page.reload();
    await expect(page.getByRole('region',{name:'Sessions de l’événement'})).toBeVisible();
    await page.screenshot({path:'tests/ui/screenshots/sessions-event-panel-mobile-390x844.png',fullPage:true});
  });
});
