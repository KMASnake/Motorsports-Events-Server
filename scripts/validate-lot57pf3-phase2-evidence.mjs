import fs from 'node:fs';

const fail=message=>{throw new Error(`F3 Phase 2 evidence refused: ${message}`);};
if(process.argv.length!==4)fail('usage: validate-lot57pf3-phase2-evidence.mjs INPUT.json OUTPUT.json');
const exact=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object`);if(Object.keys(value).sort().join()!==[...keys].sort().join())fail(`${label} fields are not exact`);return value;};
const supportedMediaType=value=>['application/vnd.oci.image.index.v1+json','application/vnd.docker.distribution.manifest.list.v2+json','application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json'].includes(value);
const validMaterialization=(locator,media,docker,config)=>{if(!locator||!docker||!supportedMediaType(media)||!/^sha256:[0-9a-f]{64}$/.test(docker.docker_image_id??''))return false;if(docker.descriptor_digest===null||docker.descriptor_media_type===null)return docker.descriptor_digest===null&&docker.descriptor_media_type===null&&docker.docker_image_id===config;return docker.descriptor_digest===locator.locator_index_digest&&docker.descriptor_media_type===media&&docker.docker_image_id===docker.descriptor_digest;};
let raw;try{raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{fail('input is invalid JSON');}
exact(raw,['schema','sequence','prospective_baseline','states','backup_restore','provider_calls','provider_credits','worker_started','cleanup_verified'],'root');
if(raw.schema!=='lot57pf3-phase2-raw-v1')fail('schema is invalid');
const sequence=['n-pre-migration','n-post-forward-migration','n-plus-one','rollback-n','final-n-plus-one'];
if(!Array.isArray(raw.sequence)||raw.sequence.join()!==sequence.join())fail('release sequence is incomplete or reordered');
const baseline=raw.prospective_baseline;
if(baseline?.schema!=='lot57pf3-prospective-baseline-v2'||baseline?.prospective_certification_baseline!==true||baseline?.classification!=='prospective-certification-baseline'||baseline?.historical_pre_existing_release!==false||baseline?.runtime_identity_complete!==true)fail('complete v2 prospective baseline is required; v1 is refused');
for(const component of ['api','web']){
  const provenance=baseline.release?.[component]?.oci_provenance,identity=baseline.release?.[component]?.executable_identity,materialization=baseline.release?.[component]?.establishment_materialization;
  if(!provenance||!identity||typeof provenance.historical_immutable_ref!=='string'||!/^sha256:[0-9a-f]{64}$/.test(provenance.historical_index_digest??'')||!provenance.historical_immutable_ref.endsWith(`@${provenance.historical_index_digest}`))fail(`baseline ${component} provenance/runtime chain is invalid`);
  if(typeof identity.runtime_ref!=='string'||!/^.+@sha256:[0-9a-f]{64}$/.test(identity.runtime_ref)||!/^sha256:[0-9a-f]{64}$/.test(identity.runtime_manifest_digest??'')||!identity.runtime_ref.endsWith(`@${identity.runtime_manifest_digest}`)||!/^sha256:[0-9a-f]{64}$/.test(identity.config_digest??'')||!Array.isArray(identity.layer_digests)||identity.layer_digests.length===0||identity.layer_digests.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value))||!Array.isArray(identity.rootfs_diff_ids)||identity.rootfs_diff_ids.length===0||identity.rootfs_diff_ids.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value)))fail(`baseline ${component} executable identity is invalid`);
  if(!materialization?.oci_locator||!/^sha256:[0-9a-f]{64}$/.test(materialization.oci_locator.locator_index_digest??'')||!materialization.oci_locator.locator_ref?.endsWith(`@${materialization.oci_locator.locator_index_digest}`)||!validMaterialization(materialization.oci_locator,materialization.locator_media_type,materialization.docker_materialization,identity.config_digest))fail(`baseline ${component} establishment materialization is invalid`);
}
exact(raw.states,sequence,'states');
const expectedRuntime=['n','n','n_plus_1','n','n_plus_1'],states=sequence.map(name=>raw.states[name]);
const sha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const digest=value=>typeof value==='string'&&/^sha256:[0-9a-f]{64}$/.test(value);
const immutable=value=>typeof value==='string'&&/^.+@sha256:[0-9a-f]{64}$/.test(value);
const releaseIdentity=(release,label)=>{
  exact(release,['api','web'],label);
  for(const component of ['api','web']){
    const image=release[component];
    exact(image,['oci_locator','locator_media_type','docker_materialization','runtime_ref','runtime_manifest_digest','config_digest','layer_digests','rootfs_diff_ids','version','git_sha','git_tree','build_time'],`${label}.${component}`);
    exact(image.docker_materialization,['docker_image_id','descriptor_digest','descriptor_media_type'],`${label}.${component}.docker_materialization`);
    if(!image.oci_locator||!immutable(image.oci_locator.locator_ref)||!digest(image.oci_locator.locator_index_digest)||!image.oci_locator.locator_ref.endsWith(`@${image.oci_locator.locator_index_digest}`)||!validMaterialization(image.oci_locator,image.locator_media_type,image.docker_materialization,image.config_digest)||!immutable(image.runtime_ref)||!image.runtime_ref.endsWith(`@${image.runtime_manifest_digest}`)||!image.version||image.version==='unknown'||!sha(image.git_sha)||!sha(image.git_tree)||!digest(image.runtime_manifest_digest)||!digest(image.config_digest)||!Array.isArray(image.layer_digests)||image.layer_digests.length===0||image.layer_digests.some(value=>!digest(value))||!Array.isArray(image.rootfs_diff_ids)||image.rootfs_diff_ids.length===0||image.rootfs_diff_ids.some(value=>!digest(value))||!Number.isFinite(Date.parse(image.build_time)))fail(`${label}.${component} identity is invalid`);
  }
  if(release.api.git_sha!==release.web.git_sha||release.api.git_tree!==release.web.git_tree||release.api.version!==release.web.version)fail(`${label} API/Web identity is incoherent`);
};
const identities=states[0].snapshot.releases;
releaseIdentity(identities.n,'release.n');releaseIdentity(identities.n_plus_1,'release.n_plus_1');
if(identities.n.api.git_tree===identities.n_plus_1.api.git_tree)fail('N+1 Git tree is not distinct from N');
for(const component of ['api','web'])if(identities.n[component].runtime_manifest_digest===identities.n_plus_1[component].runtime_manifest_digest)fail(`N+1 ${component} runtime manifest is not distinct from N`);
for(const [index,state] of states.entries()){
  const name=sequence[index];exact(state,['label','runtime_release','snapshot','database','checks','cursor_before_valid','cursor_after_valid'],`states.${name}`);
  if(state.label!==name||state.runtime_release!==expectedRuntime[index])fail(`${name} runtime release is invalid`);
  const snapshot=state.snapshot;
  if(snapshot.runtime_release!==expectedRuntime[index]||snapshot.worker_running!==false||snapshot.provider_execution_enabled!==false||snapshot.championship_execution_enabled!==false||snapshot.scheduler_enabled!==false||snapshot.discovery_enabled!==false||snapshot.provider_network_blocked!==true||snapshot.provider_network_block_mechanism!=='container-egress-deny'||snapshot.preview_production_enabled!==false||snapshot.production_target!==false)fail(`${name} runtime safety is invalid`);
  const selected=snapshot.releases?.[expectedRuntime[index]];
  if(!selected)fail(`${name} selected release identity is absent`);
  releaseIdentity(snapshot.releases.n,`${name}.release.n`);releaseIdentity(snapshot.releases.n_plus_1,`${name}.release.n_plus_1`);
  if(JSON.stringify(snapshot.releases)!==JSON.stringify(identities))fail(`${name} release identities changed during the sequence`);
  for(const component of ['api','web']){
    const expected=baseline.release?.[component]?.executable_identity,current=snapshot.releases?.n?.[component];
    for(const field of ['runtime_manifest_digest','config_digest','version','git_sha','git_tree','build_time'])if(current?.[field]!==expected?.[field])fail(`${name} baseline N ${component}.${field} differs`);
    if(JSON.stringify(current?.layer_digests)!==JSON.stringify(expected?.layer_digests))fail(`${name} baseline N ${component}.layer_digests differs`);
    if(JSON.stringify(current?.rootfs_diff_ids)!==JSON.stringify(expected?.rootfs_diff_ids))fail(`${name} baseline N ${component}.rootfs_diff_ids differs`);
  }
  const db=state.database;exact(db,['migration_head','change_sequence','event_revision','meeting_revision','normalization_checkpoint_count','uuid_anchor','relationship_anchor','orphan_relationships'],`states.${name}.database`);
  if(!/^\d{4}_[a-z0-9][a-z0-9_]*$/.test(db.migration_head)||!(/^[0-9a-f]{32}$/.test(db.uuid_anchor))||!(/^[0-9a-f]{32}$/.test(db.relationship_anchor)))fail(`${name} database anchors are invalid`);
  for(const field of ['change_sequence','event_revision','meeting_revision','normalization_checkpoint_count','orphan_relationships'])if(!Number.isSafeInteger(Number(db[field]))||Number(db[field])<0)fail(`${name}.${field} is invalid`);
  if(Number(db.orphan_relationships)!==0)fail(`${name} has orphan relationships`);
  exact(state.checks,['health','health_live','health_ready','tls','cors_allowed_origin','cors_foreign_denied','metrics'],`states.${name}.checks`);
  for(const [key,value] of Object.entries(state.checks))if(value!==true)fail(`${name}.${key} did not pass`);
  if(state.cursor_before_valid!==true)fail(`${name} does not accept cursor_before`);
  if(index>=2&&state.cursor_after_valid!==true)fail(`${name} does not accept cursor_after`);
  if(index<2&&state.cursor_after_valid!==false)fail(`${name} cursor_after must not be fabricated before N+1`);
}
for(let index=1;index<states.length;index++){
  const previous=states[index-1].database,current=states[index].database;
  if(previous.uuid_anchor!==current.uuid_anchor||previous.relationship_anchor!==current.relationship_anchor)fail(`${sequence[index]} identity continuity failed`);
  for(const field of ['change_sequence','event_revision','meeting_revision'])if(Number(current[field])<Number(previous[field]))fail(`${sequence[index]} ${field} regressed`);
}
const forwardHead=states[1].database.migration_head;
for(const index of [2,3,4])if(states[index].database.migration_head!==forwardHead)fail(`${sequence[index]} migration head differs from post-forward schema`);
exact(raw.backup_restore,['backup_verified','disposable_restore_db','restore_integrity_match'],'backup_restore');
for(const value of Object.values(raw.backup_restore))if(value!==true)fail('backup/restore verification failed');
if(raw.provider_calls!==0||raw.provider_credits!==0||raw.worker_started!==false||raw.cleanup_verified!==true)fail('final safety or cleanup invariant failed');
const evidence={schema:'lot57pf3-phase2-evidence-v1',status:'eligible-for-maintainer-validation',pp178_automatically_claimed_pass:false,sequence:raw.sequence,prospective_baseline:{classification:baseline.classification,git_sha:baseline.release.git_sha,git_tree:baseline.release.git_tree,version:baseline.release.version},states:raw.states,backup_restore:raw.backup_restore,provider_calls:0,provider_credits:0,worker_started:false,cleanup_verified:true};
fs.writeFileSync(process.argv[3],`${JSON.stringify(evidence,null,2)}\n`,{mode:0o600});
console.log('F3 Phase 2 evidence validated; PP-178 still requires maintainer validation.');
