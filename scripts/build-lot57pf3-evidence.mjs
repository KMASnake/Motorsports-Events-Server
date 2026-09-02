import fs from 'node:fs';

const fail=message=>{throw new Error(`F3 evidence refused: ${message}`);};
if(process.argv.length!==4)fail('usage: build-lot57pf3-evidence.mjs INPUT.json OUTPUT.json');
const exact=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object`);const unexpected=Object.keys(value).filter(key=>!keys.includes(key));if(unexpected.length)fail(`${label} contains unexpected fields: ${unexpected.join(',')}`);for(const key of keys)if(!(key in value))fail(`${label}.${key} is absent`);return value;};
const string=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.toLowerCase()==='unknown')fail(`${label} is absent or unknown`);return value;};
const success=(value,label)=>{if(value!==true)fail(`${label} must be true`);return true;};
const integer=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)fail(`${label} must be a non-negative integer`);return value;};
let raw;
try{raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{fail('input is not valid JSON');}
exact(raw,['prospective_baseline','release','migration_heads','db_fingerprints','comparisons','incremental_change','checks','backup_restore','provider_calls','worker_state'],'root');
const baseline=exact(raw.prospective_baseline,['schema','prospective_certification_baseline','classification','historical_pre_existing_release','runtime_identity_complete','established_at','release','migration_head','database_integrity','continuity','runtime_safety','provenance'],'prospective_baseline');
if(baseline.schema!=='lot57pf3-prospective-baseline-v2'||baseline.prospective_certification_baseline!==true||baseline.classification!=='prospective-certification-baseline'||baseline.historical_pre_existing_release!==false||baseline.runtime_identity_complete!==true)fail('complete v2 prospective baseline is required; v1 is refused');
if(Number.isNaN(Date.parse(baseline.established_at))||baseline.provenance?.source!=='repository-runtime-inspection'||baseline.provenance?.git_tree_source!=='git-rev-parse-commit-tree'||baseline.provenance?.compose_project!=='mse-preprod'||baseline.provenance?.certification_container!=='mse-f3-certification-runner'||baseline.provenance?.certification_network!=='mse-f3-certification-internal'||baseline.provenance?.exclusive_network_attachment!==true)fail('prospective baseline provenance is invalid');
for(const component of ['api','web']){
  const provenance=baseline.release?.[component]?.oci_provenance,identity=baseline.release?.[component]?.executable_identity;
  if(!provenance||!identity||typeof provenance.historical_immutable_ref!=='string'||!/^sha256:[0-9a-f]{64}$/.test(provenance.historical_index_digest??'')||!provenance.historical_immutable_ref.endsWith(`@${provenance.historical_index_digest}`))fail(`prospective baseline ${component} provenance/runtime chain is invalid`);
  if(typeof identity.runtime_ref!=='string'||!/^.+@sha256:[0-9a-f]{64}$/.test(identity.runtime_ref)||!/^sha256:[0-9a-f]{64}$/.test(identity.runtime_manifest_digest??'')||!identity.runtime_ref.endsWith(`@${identity.runtime_manifest_digest}`)||!/^sha256:[0-9a-f]{64}$/.test(identity.config_digest??'')||!Array.isArray(identity.layer_digests)||identity.layer_digests.length===0||identity.layer_digests.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value))||!Array.isArray(identity.rootfs_diff_ids)||identity.rootfs_diff_ids.length===0||identity.rootfs_diff_ids.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value)))fail(`prospective baseline ${component} executable identity is invalid`);
}
if(!/^\d{4}_[a-z0-9][a-z0-9_]*$/.test(baseline.migration_head??''))fail('prospective baseline migration head is invalid');
if(baseline.database_integrity?.classification!=='aggregate-integrity-anchor'||baseline.database_integrity?.continuity_requires_independent_checks!==true||!/^[0-9a-f]{64}$/.test(baseline.database_integrity?.aggregate_anchor??''))fail('prospective baseline aggregate integrity anchor is invalid');
for(const field of ['change_sequence','event_revision','meeting_revision','normalization_checkpoint_count'])integer(baseline.continuity?.[field],`prospective_baseline.continuity.${field}`);
if(baseline.runtime_safety?.target!=='preproduction'||baseline.runtime_safety?.worker_state!=='stopped'||baseline.runtime_safety?.provider_execution_enabled!==false||baseline.runtime_safety?.championship_execution_enabled!==false||baseline.runtime_safety?.scheduler_enabled!==false||baseline.runtime_safety?.discovery_enabled!==false||baseline.runtime_safety?.preview_production_enabled!==false||baseline.runtime_safety?.provider_network_blocked!==true)fail('prospective baseline runtime safety is invalid');
const releases=exact(raw.release,['n','n_plus_1'],'release');
for(const name of ['n','n_plus_1']){
  exact(releases[name],['api','web'],`release.${name}`);
  for(const component of ['api','web'])exact(releases[name][component],['oci_locator','runtime_ref','runtime_manifest_digest','config_digest','layer_digests','rootfs_diff_ids','version','git_sha','git_tree','build_time'],`release.${name}.${component}`);
}
const heads=exact(raw.migration_heads,['before','n_plus_1','rollback_n','final_n_plus_1'],'migration_heads');
const fingerprints=exact(raw.db_fingerprints,['before','n_plus_1','rollback_n','final_n_plus_1','restored_disposable'],'db_fingerprints');
const comparisons=exact(raw.comparisons,['meeting_uuid_stable','event_uuid_stable','revision_monotone','sequence_monotone','cursor_before_valid_after_rollback','cursor_after_valid_after_rollback'],'comparisons');
const incremental=exact(raw.incremental_change,['count','operation','changed_fields','starts_at_source_b','name_override_preserved'],'incremental_change');
const checks=exact(raw.checks,['health','health_live','health_ready','cors_allowed_origin','cors_foreign_denied','tls','metrics'],'checks');
const backup=exact(raw.backup_restore,['backup_verified','disposable_restore_db','restore_integrity_match'],'backup_restore');
for(const [name,release] of Object.entries(releases)){
  for(const [component,image] of Object.entries(release)){
    if(!image.oci_locator||typeof image.oci_locator.locator_ref!=='string'||!/^sha256:[0-9a-f]{64}$/.test(image.oci_locator.locator_index_digest??'')||!image.oci_locator.locator_ref.endsWith(`@${image.oci_locator.locator_index_digest}`))fail(`release.${name}.${component}.oci_locator is invalid`);
    for(const key of ['runtime_ref','runtime_manifest_digest','config_digest','version','git_sha','git_tree','build_time'])string(image[key],`release.${name}.${component}.${key}`);
    if(!/^[0-9a-f]{40}$/.test(image.git_sha))fail(`release.${name}.${component}.git_sha must be 40 lowercase hex characters`);
    if(!/^[0-9a-f]{40}$/.test(image.git_tree))fail(`release.${name}.${component}.git_tree must be 40 lowercase hex characters`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.runtime_manifest_digest))fail(`release.${name}.${component}.runtime_manifest_digest must be sha256`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.config_digest))fail(`release.${name}.${component}.config_digest must be sha256`);
    if(!Array.isArray(image.rootfs_diff_ids)||image.rootfs_diff_ids.length===0||image.rootfs_diff_ids.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value)))fail(`release.${name}.${component}.rootfs_diff_ids must be immutable`);
    if(!Array.isArray(image.layer_digests)||image.layer_digests.length===0||image.layer_digests.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value)))fail(`release.${name}.${component}.layer_digests must be immutable`);
    if(!/@sha256:[0-9a-f]{64}$/.test(image.runtime_ref)||!image.runtime_ref.endsWith(`@${image.runtime_manifest_digest}`))fail(`release.${name}.${component}.runtime_ref must match its manifest`);
    if(Number.isNaN(Date.parse(image.build_time)))fail(`release.${name}.${component}.build_time is invalid`);
  }
  if(release.api.runtime_manifest_digest===release.web.runtime_manifest_digest)fail(`release.${name} API and Web runtime manifests must be distinct`);
  if(release.api.git_sha!==release.web.git_sha||release.api.version!==release.web.version||release.api.git_tree!==release.web.git_tree)fail(`release.${name} API/Web identity is incoherent`);
}
for(const component of ['api','web'])if(releases.n[component].runtime_manifest_digest===releases.n_plus_1[component].runtime_manifest_digest)fail(`N and N+1 ${component} runtime manifests must be distinct`);
if(releases.n.api.git_tree===releases.n_plus_1.api.git_tree)fail('N+1 must contain a distinct Git tree, not an empty commit or BUILD_TIME-only rebuild');
if(baseline.release?.git_sha!==releases.n.api.git_sha||baseline.release?.git_tree!==releases.n.api.git_tree||baseline.release?.version!==releases.n.api.version)fail('prospective baseline identity does not match N');
for(const component of ['api','web']){
  const expected=baseline.release?.[component]?.executable_identity,current=releases.n[component];
  for(const field of ['runtime_manifest_digest','config_digest','version','git_sha','git_tree','build_time'])if(expected?.[field]!==current[field])fail(`prospective baseline ${component}.${field} does not match N`);
  if(JSON.stringify(expected?.layer_digests)!==JSON.stringify(current.layer_digests))fail(`prospective baseline ${component}.layer_digests does not match N`);
  if(JSON.stringify(expected?.rootfs_diff_ids)!==JSON.stringify(current.rootfs_diff_ids))fail(`prospective baseline ${component}.rootfs_diff_ids does not match N`);
}
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
const evidence={schema:'lot57pf3-operational-closure-evidence-v1',sanitized:true,prospective_baseline:{schema:baseline.schema,classification:baseline.classification,established_at:baseline.established_at,migration_head:baseline.migration_head,database_integrity_classification:'aggregate-integrity-anchor',database_aggregate_anchor:baseline.database_integrity?.aggregate_anchor},release:releases,migration_heads:heads,db_fingerprints:fingerprints,comparisons,incremental_change:incremental,checks,backup_restore:backup,provider_calls:0,provider_credits:0,worker_state:'stopped'};
fs.writeFileSync(process.argv[3],`${JSON.stringify(evidence,null,2)}\n`,{encoding:'utf8',mode:0o600});
console.log('F3 sanitized evidence written.');
