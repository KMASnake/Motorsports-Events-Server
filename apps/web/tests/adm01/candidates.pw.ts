import {test,expect,type Page} from '@playwright/test';
import {candidateId,fixtureDetail,fixtureRows,incompleteDetail} from '../../src/features/meeting-event-candidates/candidates.fixtures';
const root='/api/v1/admin/meeting-event-resolution-candidates';
type Mode='normal'|'empty'|'error'|'forbidden'|'unauthorized'|'missing'|'slow';
async function mockApi(page:Page,mode:Mode='normal',readGate:Promise<void>=Promise.resolve()){
 await page.context().addCookies([{name:'mse_admin_csrf',value:'synthetic-csrf',url:'http://127.0.0.1:3417'}]);
 const requests:string[]=[];
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/health'){expect(req.method()).toBe('GET');return route.fulfill({json:{status:'ok',version:'synthetic'}});}
  if(url.pathname.startsWith('/api/')){
   requests.push(`${req.method()} ${url.pathname}${url.search}`);
   expect(req.method()).toBe('GET');
   if(url.pathname==='/api/v1/auth/session')return route.fulfill({json:{authenticated:true,administrator:{username:'synthetic-admin'},idle_expires_at:'2099-01-01T00:00:00Z',absolute_expires_at:'2099-01-01T00:00:00Z'}});
   // Existing shared Sidebar read; not an enrichment performed by ADM-01.
   if(url.pathname==='/api/v1/admin/corrections')return route.fulfill({json:[]});
   expect(url.pathname===root||url.pathname.startsWith(root+'/'),url.pathname).toBeTruthy();
   expect(req.headers()['x-csrf-token']).toBe('synthetic-csrf');
   if(mode==='error')return route.fulfill({status:500,json:{message:'fixture failure'}});
   if(mode==='forbidden')return route.fulfill({status:403,json:{}});
   if(mode==='unauthorized')return route.fulfill({status:401,json:{}});
   if(url.pathname!==root){if(mode==='missing')return route.fulfill({status:404,json:{}});const id=url.pathname.split('/').at(-1)!;const n=Number(id.slice(-12));return route.fulfill({json:n===3?incompleteDetail:fixtureDetail(n,n===1?'meeting':'event')});}
   if(mode==='slow')await readGate;
   return route.fulfill({json:mode==='empty'||url.searchParams.get('offset')==='25'||url.searchParams.get('state')==='REJECTED'?[]:fixtureRows});
  }
  // The whole scenario is local and synthetic; any external request is rejected.
  expect(url.origin).toBe('http://127.0.0.1:3417');return route.continue();
 });
 return requests;
}
test('list/detail/back, real filters and offset pagination remain GET-only',async({page})=>{
 const requests=await mockApi(page);await page.goto('/duplicates');
 await expect(page.getByRole('row')).toHaveCount(26);await expect(page.getByRole('cell',{name:'Meeting',exact:true})).toHaveCount(1);await expect(page.getByRole('cell',{name:'Event',exact:true})).toHaveCount(24);
 await page.screenshot({path:'/tmp/adm01/list-desktop.png',fullPage:true});
 await page.getByRole('link',{name:`Consulter Meeting ${candidateId(1)}`,exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Meeting — Meeting synthétique'})).toBeVisible();await expect(page.getByRole('heading',{name:'Détail du candidat'})).toBeFocused();
 await expect(page.getByText('synthetic-hash-1',{exact:true})).toBeVisible();await expect(page.getByText('2026-10-25T02:30:00',{exact:true})).toBeVisible();
 await page.screenshot({path:'/tmp/adm01/list-detail-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'Retour aux candidats'}).click();await page.getByRole('button',{name:'Suivant',exact:true}).click();await expect(page.getByText('Aucun candidat pour cet état et ce décalage.')).toBeVisible();await expect(page).toHaveURL(/offset=25/);
 await page.getByRole('button',{name:'Précédent',exact:true}).click();await expect(page.getByRole('row')).toHaveCount(26);
 await page.getByLabel('État backend',{exact:true}).selectOption('REJECTED');await expect(page).toHaveURL(/state=REJECTED&offset=0/);await expect(page.getByText('Aucun candidat pour cet état et ce décalage.')).toBeVisible();
 expect(requests.some(value=>value.includes('state=REJECTED&limit=25&offset=0'))).toBeTruthy();expect(requests.every(value=>value.startsWith('GET '))).toBeTruthy();
});
test('partial candidate, event distinction and mobile presentation',async({page})=>{
 await mockApi(page);await page.setViewportSize({width:390,height:844});await page.goto(`/duplicates/${candidateId(3)}?state=PENDING&offset=25`);await expect(page.getByText('Données normalisées partielles ou absentes.')).toBeVisible();await expect(page.getByRole('heading',{name:'Event — Non renseigné'})).toBeVisible();await expect(page.getByText('Aucune décision enregistrée.')).toBeVisible();
 await page.screenshot({path:'/tmp/adm01/partial-mobile.png',fullPage:true});await page.getByRole('link',{name:'Retour aux candidats'}).click();await expect(page).toHaveURL(/state=PENDING&offset=25/);
});
for(const[mode,text]of [['empty','Aucun candidat pour cet état et ce décalage.'],['error','Impossible de consulter les candidats.'],['forbidden','Accès refusé.']] as const){test(`list ${mode}`,async({page})=>{await mockApi(page,mode);await page.goto('/duplicates');await expect(page.getByText(text,{exact:true})).toBeVisible();});}
test('expired session goes through the existing login guard',async({page})=>{await mockApi(page,'unauthorized');await page.goto('/duplicates');await expect(page).toHaveURL(/\/login$/);});
test('missing detail has a recoverable return link',async({page})=>{await mockApi(page,'missing');await page.goto(`/duplicates/${candidateId(1)}`);await expect(page.getByRole('alert')).toHaveText('Ce candidat n’est plus disponible.');await expect(page.getByRole('link',{name:'Retour aux candidats'})).toBeVisible();});
test('loading state is announced',async({page})=>{let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});await mockApi(page,'slow',gate);await page.goto('/duplicates');await expect(page.getByRole('status')).toHaveText('Chargement des candidats…');release();await expect(page.getByRole('row')).toHaveCount(26);});
