import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const args=new Map();
for(let index=2;index<process.argv.length;index+=2){const key=process.argv[index],value=process.argv[index+1];if(!key?.startsWith('--')||!value)throw new Error('Arguments attendus par paires --clé valeur.');args.set(key.slice(2),value);}
const action=args.get('action')??'audit';
const file=args.get('file')??'infra/postgres/reference-data/ocblacktop-f1-v2.json';
const versionLabel=args.get('version-label')??'ocblacktop-f1-v2';
const rulesVersion=args.get('rules-version')??'v2';
const owner=args.get('provider-championship-id');
const actor=args.get('actor');
const mappingId=args.get('mapping-id');
if(!['audit','create','activate'].includes(action))throw new Error('--action doit être audit, create ou activate.');
const document=JSON.parse(await readFile(file,'utf8'));
const sections=['championshipIds','circuitIds','sessionTypes','statuses'];
if(JSON.stringify(Object.keys(document).sort())!==JSON.stringify(sections.sort())||sections.some(section=>!document[section]||Array.isArray(document[section])||typeof document[section]!=='object'))throw new Error('Document de mapping invalide.');
const sepang='e1f7b92f-1920-4561-9a62-870cf7c5f8fe';
if(Object.hasOwn(document.circuitIds,sepang))throw new Error('Le circuit Sepang incohérent doit rester non mappé.');

if(action==='audit'){
  console.log(JSON.stringify({action:'AUDIT_ONLY',file,version_label:versionLabel,rules_version:rulesVersion,entries:Object.fromEntries(sections.map(section=>[section,Object.keys(document[section]).length])),sepang:'UNMAPPED',database_mutated:false},null,2));
  process.exit(0);
}
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL requis pour une mutation explicite.');
if(!owner||!actor)throw new Error('--provider-championship-id et --actor sont requis.');
if(action==='activate'&&!mappingId)throw new Error('--mapping-id est requis pour activate.');

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try{
  await client.query('begin');
  const ownership=(await client.query('select external_championship_id,championship_id from provider_championships where id=$1 for update',[owner])).rows[0];
  if(!ownership)throw new Error('Association provider/championnat introuvable.');
  if(document.championshipIds[ownership.external_championship_id]!==ownership.championship_id)throw new Error('Le mapping championnat ne correspond pas à son propriétaire.');
  if(action==='create'){
    const id=randomUUID();
    await client.query(`insert into normalization_mapping_versions(id,provider_championship_id,version_label,rules_version,mapping_document,created_by) values($1,$2,$3,$4,$5::jsonb,$6)`,[id,owner,versionLabel,rulesVersion,JSON.stringify(document),actor]);
    await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value) values($1,'provider.normalization_mapping_created','provider_championship',$2,$3,null,$4::jsonb)`,[actor,owner,randomUUID(),JSON.stringify({id,versionLabel,rulesVersion,active:false})]);
    await client.query('commit');console.log(JSON.stringify({action:'CREATED_NOT_ACTIVATED',mapping_id:id,provider_championship_id:owner}));
  }else{
    const version=(await client.query('select id,provider_championship_id,version_label,rules_version,mapping_document from normalization_mapping_versions where id=$1',[mappingId])).rows[0];
    if(!version||String(version.provider_championship_id)!==owner)throw new Error('Version absente ou propriétaire incompatible.');
    const storedDocument=version.mapping_document;
    if(!storedDocument||Array.isArray(storedDocument)||typeof storedDocument!=='object')throw new Error('Document de mapping stocké invalide.');
    if(JSON.stringify(Object.keys(storedDocument).sort())!==JSON.stringify(sections.sort())||sections.some(section=>!storedDocument[section]||Array.isArray(storedDocument[section])||typeof storedDocument[section]!=='object'))throw new Error('Document de mapping stocké invalide.');
    if(Object.hasOwn(storedDocument.circuitIds,sepang))throw new Error('Le mapping stocké contient le circuit Sepang incohérent.');
    if(storedDocument.championshipIds[ownership.external_championship_id]!==ownership.championship_id)throw new Error('Le mapping stocké ne correspond pas à son propriétaire.');
    const canonicalJson=value=>{
      if(Array.isArray(value))return value.map(canonicalJson);
      if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalJson(value[key])]));
      return value;
    };
    if(JSON.stringify(canonicalJson(storedDocument))!==JSON.stringify(canonicalJson(document)))throw new Error('Le document stocké ne correspond pas au fichier de mapping fourni.');
    const before=(await client.query('select mapping_version_id from provider_championship_active_normalization_mappings where provider_championship_id=$1',[owner])).rows[0]??null;
    await client.query(`insert into provider_championship_active_normalization_mappings(provider_championship_id,mapping_version_id,activated_at,activated_by) values($1,$2,now(),$3) on conflict(provider_championship_id) do update set mapping_version_id=excluded.mapping_version_id,activated_at=excluded.activated_at,activated_by=excluded.activated_by`,[owner,mappingId,actor]);
    await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value) values($1,'provider.normalization_mapping_activated','provider_championship',$2,$3,$4::jsonb,$5::jsonb)`,[actor,owner,randomUUID(),JSON.stringify(before),JSON.stringify({mapping_version_id:mappingId,version_label:version.version_label,rules_version:version.rules_version})]);
    await client.query('commit');console.log(JSON.stringify({action:'ACTIVATED',mapping_id:mappingId,provider_championship_id:owner}));
  }
}catch(error){await client.query('rollback');throw error;}finally{client.release();await pool.end();}
