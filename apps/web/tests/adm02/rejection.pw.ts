import {test,expect,type Page} from '@playwright/test';
import {candidateId,fixtureDetail} from '../../src/features/meeting-event-candidates/candidates.fixtures';
const root='/api/v1/admin/meeting-event-resolution-candidates',id=candidateId(1);
type Payload={action:string;expected_revision:number;idempotency_key:string;reason:string};
async function scenario(page:Page,options:{state?:string;scope?:boolean;revision?:number|string;plan?:number[];gate?:Promise<void>;committedError?:boolean;malformed?:boolean}={}){
 const detail=fixtureDetail(1,'meeting');detail.candidate.resolution_state=options.state??'REVIEW_REQUIRED';detail.candidate.revision=options.revision??'1';
 if(options.scope===false)(detail.candidate.candidate_data as {normalized:Record<string,unknown>}).normalized.championshipSeasonId=null;
 const posts:Payload[]=[],gets:string[]=[];let readStatus=200;
 await page.context().addCookies([{name:'mse_admin_csrf',value:'synthetic-csrf',url:'http://127.0.0.1:3417'}]);
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());expect(url.origin).toBe('http://127.0.0.1:3417');
  if(url.pathname==='/health')return route.fulfill({json:{status:'ok'}});
  if(!url.pathname.startsWith('/api/'))return route.continue();
  if(url.pathname==='/api/v1/auth/session')return route.fulfill({json:{authenticated:true,administrator:{username:'synthetic-admin'}}});
  if(url.pathname==='/api/v1/admin/corrections')return route.fulfill({json:[]});
  expect(req.headers()['x-csrf-token']).toBe('synthetic-csrf');
  if(req.method()==='POST'){
   expect(url.pathname).toBe(`${root}/${id}/decisions`);const payload=req.postDataJSON() as Payload;
   expect(Object.keys(payload).sort()).toEqual(['action','expected_revision','idempotency_key','reason']);expect(payload.action).toBe('reject');posts.push(payload);
   const status=options.plan?.[posts.length-1]??200;
   if(status===409)detail.candidate.revision='2';
   const replayed=detail.decisions.some(decision=>decision.idempotency_key===payload.idempotency_key);
   if((status===200||options.committedError)&&!replayed){detail.candidate.resolution_state='REJECTED';detail.decisions.push({id:'synthetic-rejection',candidate_id:id,candidate_revision:String(payload.expected_revision),decision:'rejected',reason:payload.reason,idempotency_key:payload.idempotency_key,actor_id:'synthetic-admin',decided_at:'2026-10-17T16:00:00Z'});}
   await options.gate;
   return route.fulfill(status===200?{json:options.malformed?{replayed:false}:{decision:detail.decisions.find(decision=>decision.idempotency_key===payload.idempotency_key),publication:null,replayed}}:{status,json:{message:'synthetic rejection failure'}});
  }
  expect(req.method()).toBe('GET');expect([root,`${root}/${id}`,`${root}/${candidateId(2)}`]).toContain(url.pathname);gets.push(url.pathname);
  if(readStatus!==200)return route.fulfill({status:readStatus,json:{}});
  if(url.pathname===root)return route.fulfill({json:detail.candidate.resolution_state==='REJECTED'?[]:[detail.candidate]});
  return route.fulfill({json:url.pathname.endsWith(candidateId(2))?fixtureDetail(2):detail});
 });
 await page.goto(`/duplicates/${id}?state=REVIEW_REQUIRED&offset=0`);await expect(page.getByRole('heading',{name:'Meeting — Meeting synthétique'})).toBeVisible();
 return {posts,gets,setReadStatus:(status:number)=>{readStatus=status;}};
}
async function open(page:Page,reason='Motif synthétique'){
 await page.getByRole('button',{name:'Rejeter',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await page.getByLabel('Motif obligatoire',{exact:true}).fill(reason);return dialog;
}
async function confirm(page:Page){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirmer le rejet',exact:true}).click();}
for(const state of ['REJECTED','RESOLVED_LINKED','RESOLVED_CREATED'])test(`no action for terminal ${state}`,async({page})=>{const s=await scenario(page,{state});await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toHaveCount(0);expect(s.posts).toHaveLength(0);});
test('scope/revision preconditions do not hide the read-only detail',async({page})=>{await scenario(page,{scope:false});await expect(page.getByText('Rejet indisponible : championnat et saison canoniques requis par le backend.')).toBeVisible();await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'DÉCISIONS HISTORIQUES'})).toBeVisible();});
test('confirmation, normalized reason boundaries, cancel and focus restoration',async({page})=>{
 const s=await scenario(page);const dialog=await open(page,'  \n ');await expect(page.getByRole('button',{name:'Confirmer le rejet'})).toBeDisabled();
 await expect(dialog).toContainText('candidat entier');await expect(dialog).toContainText('irréversible via l’API actuelle');
 await page.getByLabel('Motif obligatoire',{exact:true}).fill('x'.repeat(2001));await page.getByRole('checkbox').check();await expect(page.getByRole('button',{name:'Confirmer le rejet'})).toBeDisabled();
 await page.getByLabel('Motif obligatoire',{exact:true}).fill(' '+'x'.repeat(2000)+' ');await expect(page.getByRole('checkbox')).not.toBeChecked();await page.getByRole('checkbox').check();await expect(page.getByRole('button',{name:'Confirmer le rejet'})).toBeEnabled();
 await page.getByRole('button',{name:'Annuler',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toBeFocused();expect(s.posts).toHaveLength(0);
});
test('confirmed success updates detail/history/list, no premature success or duplicate POST',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const s=await scenario(page,{gate});await open(page,'  Motif accepté  ');await page.getByRole('checkbox').check();const button=page.getByRole('button',{name:'Confirmer le rejet'});await button.click();await expect(button).toBeDisabled();await expect(page.getByText('Rejet confirmé par le serveur.',{exact:true})).toHaveCount(0);expect(s.posts).toHaveLength(1);expect(s.posts[0]).toMatchObject({reason:'Motif accepté',expected_revision:1,action:'reject'});release();
 await expect(page.getByText('Rejet confirmé par le serveur.',{exact:true})).toBeVisible();await expect(page.getByText('Motif accepté',{exact:true})).toBeVisible();await expect(page.getByText('REJECTED',{exact:true})).toBeVisible();expect(s.gets.filter(path=>path===root).length).toBeGreaterThan(0);await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toHaveCount(0);
 await page.screenshot({path:'/tmp/adm02-implementation/rejected-desktop.png',fullPage:true});
});
for(const status of [400,403,404,500])test(`HTTP ${status} never announces success`,async({page})=>{const s=await scenario(page,{plan:[status]});await open(page);await confirm(page);await expect(page.getByText('Rejet confirmé par le serveur.',{exact:true})).toHaveCount(0);if(status===400||status===500)await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();else await expect(page.getByText(/Accès refusé pour le rejet|Ce candidat n’est plus disponible/)).toBeVisible();expect(s.posts).toHaveLength(1);});
test('HTTP 401 follows existing authentication guard',async({page})=>{await scenario(page,{plan:[401]});await open(page);await confirm(page);await expect(page).toHaveURL(/\/login$/);});
test('409 reloads revision and requires new explicit confirmation',async({page})=>{
 const s=await scenario(page,{plan:[409,200]});await open(page,'Motif conservé');await confirm(page);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText(/Conflit : les données/)).toBeVisible();await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toBeVisible();expect(s.posts).toHaveLength(1);
 await open(page,'Motif conservé');await expect(page.getByText('Révision examinée : 2')).toBeVisible();await expect(page.getByRole('button',{name:'Confirmer le rejet'})).toBeDisabled();await confirm(page);await expect(page.getByText('Rejet confirmé par le serveur.',{exact:true})).toBeVisible();expect(s.posts[1].expected_revision).toBe(2);expect(s.posts[1].idempotency_key).not.toBe(s.posts[0].idempotency_key);
});
test('uncertain failure retries same intention/key and accepts an idempotent replay',async({page})=>{
 const s=await scenario(page,{plan:[500,200],committedError:true});await open(page);await confirm(page);await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();await page.getByRole('button',{name:'Confirmer le rejet'}).click();await expect(page.getByText('Rejet confirmé par le serveur (rejeu idempotent).',{exact:true})).toBeVisible();expect(s.posts).toHaveLength(2);expect(s.posts[1]).toEqual(s.posts[0]);await expect(page.getByText('Motif synthétique',{exact:true})).toHaveCount(1);
});
test('changing reason after an error creates a distinct confirmed intention',async({page})=>{const s=await scenario(page,{plan:[500,200]});await open(page,'Premier motif');await confirm(page);await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();await page.getByLabel('Motif obligatoire',{exact:true}).fill('Second motif');await expect(page.getByRole('checkbox')).not.toBeChecked();await confirm(page);await expect(page.getByText('Rejet confirmé par le serveur.',{exact:true})).toBeVisible();expect(s.posts[0].idempotency_key).not.toBe(s.posts[1].idempotency_key);});
test('retained detail after failed GET cannot expose rejection',async({page})=>{const s=await scenario(page);s.setReadStatus(403);await page.getByRole('button',{name:'Actualiser le détail'}).click();await expect(page.getByRole('alert')).toHaveText('Accès refusé.');await expect(page.getByRole('heading',{name:'Meeting — Meeting synthétique'})).toBeVisible();await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toHaveCount(0);expect(s.posts).toHaveLength(0);});
test('malformed success receipt remains uncertain without a success message',async({page})=>{await scenario(page,{malformed:true});await open(page);await confirm(page);await expect(page.getByRole('dialog').getByRole('alert')).toContainText('inexploitable');await expect(page.getByText('Rejet confirmé par le serveur.',{exact:true})).toHaveCount(0);});
test('late POST response cannot replace another selected candidate',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const s=await scenario(page,{gate});await open(page);await confirm(page);expect(s.posts).toHaveLength(1);
 // Same-document navigation reproduces router unmount while the POST is in flight.
 await page.evaluate(next=>{history.pushState({},'',next);window.dispatchEvent(new PopStateEvent('popstate'));},`/duplicates/${candidateId(2)}`);
 await expect(page.getByRole('heading',{name:'Event — Course synthétique'})).toBeVisible();release();await expect(page.getByRole('heading',{name:'Event — Course synthétique'})).toBeVisible();await expect(page.getByText('Rejet confirmé par le serveur.',{exact:true})).toHaveCount(0);
});
test('failed conflict reload leaves stale data readable but no rejection action',async({page})=>{const s=await scenario(page,{plan:[409]});await open(page);s.setReadStatus(500);await confirm(page);await expect(page.getByRole('alert').filter({hasText:'Impossible de consulter'})).toBeVisible();await expect(page.getByRole('button',{name:'Rejeter',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Meeting — Meeting synthétique'})).toBeVisible();expect(s.posts).toHaveLength(1);});
test('confirmation can be inspected on a narrow screen',async({page})=>{await page.setViewportSize({width:390,height:844});const s=await scenario(page);await open(page);await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:'/tmp/adm02-implementation/rejection-mobile.png',fullPage:true});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(s.posts).toHaveLength(0);});
