import fs from 'node:fs';

const fail=message=>{throw new Error(`F3 evidence refused: ${message}`);};
if(process.argv.length!==4)fail('usage: build-lot57pf3-evidence.mjs INPUT.json OUTPUT.json');
const exact=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object`);const unexpected=Object.keys(value).filter(key=>!keys.includes(key));if(unexpected.length)fail(`${label} contains unexpected fields: ${unexpected.join(',')}`);for(const key of keys)if(!(key in value))fail(`${label}.${key} is absent`);return value;};
const string=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.toLowerCase()==='unknown')fail(`${label} is absent or unknown`);return value;};
const success=(value,label)=>{if(value!==true)fail(`${label} must be true`);return true;};
const integer=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)fail(`${label} must be a non-negative integer`);return value;};
let raw;
try{raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{fail('input is not valid JSON');}
exact(raw,['release','migration_heads','db_fingerprints','comparisons','incremental_change','checks','backup_restore','provider_calls','worker_state'],'root');
const releases=exact(raw.release,['n','n_plus_1'],'release');
for(const name of ['n','n_plus_1'])exact(releases[name],['version','git_sha','build_time','image_id','image_digest'],`release.${name}`);
const heads=exact(raw.migration_heads,['before','n_plus_1','rollback_n','final_n_plus_1'],'migration_heads');
const fingerprints=exact(raw.db_fingerprints,['before','n_plus_1','rollback_n','final_n_plus_1','restored_disposable'],'db_fingerprints');
const comparisons=exact(raw.comparisons,['meeting_uuid_stable','event_uuid_stable','revision_monotone','sequence_monotone','cursor_before_valid_after_rollback','cursor_after_valid_after_rollback'],'comparisons');
const incremental=exact(raw.incremental_change,['count','operation','changed_fields','starts_at_source_b','name_override_preserved'],'incremental_change');
const checks=exact(raw.checks,['health','health_live','health_ready','cors_allowed_origin','cors_foreign_denied','tls','metrics'],'checks');
const backup=exact(raw.backup_restore,['backup_verified','disposable_restore_db','restore_integrity_match'],'backup_restore');
for(const [name,release] of Object.entries(releases)){
  for(const [key,value] of Object.entries(release))string(value,`release.${name}.${key}`);
  if(!/^[0-9a-f]{40}$/.test(release.git_sha))fail(`release.${name}.git_sha must be 40 lowercase hex characters`);
  if(!/^sha256:[0-9a-f]{64}$/.test(release.image_id))fail(`release.${name}.image_id must be sha256`);
  if(!/^sha256:[0-9a-f]{64}$/.test(release.image_digest))fail(`release.${name}.image_digest must be sha256`);
  if(Number.isNaN(Date.parse(release.build_time)))fail(`release.${name}.build_time is invalid`);
}
if(releases.n.image_digest===releases.n_plus_1.image_digest)fail('N and N+1 image digests must be distinct');
for(const [key,value] of Object.entries(heads)){const head=string(value,`migration_heads.${key}`);if(!/^[0-9]{4}_[a-z0-9][a-z0-9_]*$/.test(head))fail(`migration_heads.${key} is not canonical`);}
for(const [key,value] of Object.entries(fingerprints)){const digest=string(value,`db_fingerprints.${key}`);if(!/^[0-9a-f]{64}$/.test(digest))fail(`db_fingerprints.${key} must be sha256`);}
for(const [key,value] of Object.entries(comparisons))success(value,`comparisons.${key}`);
if(incremental.count!==1||incremental.operation!=='updated'||!Array.isArray(incremental.changed_fields)||incremental.changed_fields.length!==2||incremental.changed_fields[0]!=='name'||incremental.changed_fields[1]!=='startsAt')fail('incremental_change does not match the normative F3 scenario');
success(incremental.starts_at_source_b,'incremental_change.starts_at_source_b');
success(incremental.name_override_preserved,'incremental_change.name_override_preserved');
for(const [key,value] of Object.entries(checks))success(value,`checks.${key}`);
for(const [key,value] of Object.entries(backup))success(value,`backup_restore.${key}`);
if(integer(raw.provider_calls,'provider_calls')!==0)fail('provider_calls must equal zero');
if(raw.worker_state!=='stopped')fail('worker_state must equal stopped');
const evidence={schema:'lot57pf3-operational-closure-evidence-v1',sanitized:true,release:releases,migration_heads:heads,db_fingerprints:fingerprints,comparisons,incremental_change:incremental,checks,backup_restore:backup,provider_calls:0,provider_credits:0,worker_state:'stopped'};
fs.writeFileSync(process.argv[3],`${JSON.stringify(evidence,null,2)}\n`,{encoding:'utf8',mode:0o600});
console.log('F3 sanitized evidence written.');
