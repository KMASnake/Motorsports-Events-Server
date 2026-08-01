const api=process.env.API_URL??'http://localhost:3001';const marker=`lot4-test-${Date.now()}`;
async function call(path,options={}){const headers={...(options.headers??{})};if(options.body!==undefined&&options.body!==null)headers['content-type']??='application/json';else delete headers['content-type'];const r=await fetch(api+path,{...options,headers});const body=r.status===204?null:await r.json().catch(()=>null);if(!r.ok)throw new Error(`${options.method??'GET'} ${path} -> ${r.status}: ${JSON.stringify(body)}`);return body}
console.log('=== API health ===');console.log(await call('/health'));
console.log('\n=== CRUD événements ===');
const championships=await call('/api/v1/championships');const circuits=await call('/api/v1/circuits');if(!championships.length)throw new Error('Aucun championnat disponible.');
const created=await call('/api/v1/admin/events',{method:'POST',body:JSON.stringify({championship_id:championships[0].id,circuit_id:circuits[0]?.id??null,name:'Événement de validation Lot 4',slug:marker,category:null,starts_at:'2026-12-20T10:00:00.000Z',ends_at:'2026-12-20T12:00:00.000Z',timezone:'Europe/Paris',status:'scheduled',published:true,origin:'manual',description:'Événement de validation public.'})});console.log('Création OK :',created.id);
let publicRows=await call('/api/v1/events');if(!publicRows.some(r=>r.id===created.id))throw new Error('Événement publié absent de l’API publique.');const publicRow=publicRows.find(r=>r.id===created.id);if('origin' in publicRow||'provider_key' in publicRow||'external_id' in publicRow)throw new Error('Métadonnée interne exposée dans l’API publique.');console.log('Exposition publique OK');
await call(`/api/v1/admin/events/${created.id}`,{method:'PATCH',body:JSON.stringify({published:false,status:'draft'})});publicRows=await call('/api/v1/events');if(publicRows.some(r=>r.id===created.id))throw new Error('Brouillon encore visible publiquement.');console.log('Dépublication OK');
await call(`/api/v1/admin/events/${created.id}`,{method:'DELETE'});console.log('Suppression OK');
const adminRows=await call('/api/v1/admin/events');if(adminRows.some(r=>r.id===created.id))throw new Error('Événement de test encore présent.');console.log('Liste finale OK');
console.log('\n=== Corrections fournisseur ===');
const providerEvent=await call('/api/v1/admin/events',{method:'POST',body:JSON.stringify({championship_id:championships[0].id,circuit_id:circuits[0]?.id??null,name:'Événement fournisseur Lot 4.2',slug:`${marker}-provider`,category:null,starts_at:'2026-12-21T10:00:00.000Z',ends_at:'2026-12-21T12:00:00.000Z',timezone:'Europe/Paris',status:'scheduled',published:true,origin:'provider',provider_key:'validation-fixture',external_id:marker,description:'Valeur fournisseur.'})});
await call(`/api/v1/admin/events/${providerEvent.id}`,{method:'PATCH',body:JSON.stringify({name:'Événement fournisseur corrigé'})});
const correctionRows=await call(`/api/v1/admin/corrections?event_id=${providerEvent.id}`);
if(!correctionRows.some(row=>row.field_name==='name'&&row.override_value==='Événement fournisseur corrigé'))throw new Error('La modification fournisseur est absente de la page Corrections.');
console.log('Création et lecture de la correction OK');
await call(`/api/v1/admin/events/${providerEvent.id}`,{method:'DELETE'});console.log('Nettoyage correction OK');
console.log('\nLot 4 techniquement accessible. Vérifier visuellement la liste, les filtres, le formulaire et la publication API.');
