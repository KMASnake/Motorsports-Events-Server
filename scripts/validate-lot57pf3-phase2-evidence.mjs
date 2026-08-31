import fs from 'node:fs';

const fail=message=>{throw new Error(`F3 Phase 2 evidence refused: ${message}`);};
if(process.argv.length!==4)fail('usage: validate-lot57pf3-phase2-evidence.mjs INPUT.json OUTPUT.json');
const exact=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object`);if(Object.keys(value).sort().join()!==[...keys].sort().join())fail(`${label} fields are not exact`);return value;};
let raw;try{raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{fail('input is invalid JSON');}
exact(raw,['schema','sequence','prospective_baseline','states','backup_restore','provider_calls','provider_credits','worker_started','cleanup_verified'],'root');
if(raw.schema!=='lot57pf3-phase2-raw-v1')fail('schema is invalid');
const sequence=['n-pre-migration','n-post-forward-migration','n-plus-one','rollback-n','final-n-plus-one'];
if(!Array.isArray(raw.sequence)||raw.sequence.join()!==sequence.join())fail('release sequence is incomplete or reordered');
const baseline=raw.prospective_baseline;
if(baseline?.schema!=='lot57pf3-prospective-baseline-v1'||baseline?.prospective_certification_baseline!==true||baseline?.classification!=='prospective-certification-baseline'||baseline?.historical_pre_existing_release!==false)fail('prospective baseline is invalid');
exact(raw.states,sequence,'states');
const expectedRuntime=['n','n','n_plus_1','n','n_plus_1'],states=sequence.map(name=>raw.states[name]);
const sha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const digest=value=>typeof value==='string'&&/^sha256:[0-9a-f]{64}$/.test(value);
const immutable=value=>typeof value==='string'&&/^.+@sha256:[0-9a-f]{64}$/.test(value);
const releaseIdentity=(release,label)=>{
  exact(release,['api','web'],label);
  for(const component of ['api','web']){
    const image=release[component];
    exact(image,['immutable_ref','version','git_sha','git_tree','build_time','image_id','image_digest'],`${label}.${component}`);
    if(!immutable(image.immutable_ref)||!image.version||image.version==='unknown'||!sha(image.git_sha)||!sha(image.git_tree)||!digest(image.image_id)||!digest(image.image_digest)||!Number.isFinite(Date.parse(image.build_time)))fail(`${label}.${component} identity is invalid`);
  }
  if(release.api.git_sha!==release.web.git_sha||release.api.git_tree!==release.web.git_tree||release.api.version!==release.web.version)fail(`${label} API/Web identity is incoherent`);
};
const identities=states[0].snapshot.releases;
releaseIdentity(identities.n,'release.n');releaseIdentity(identities.n_plus_1,'release.n_plus_1');
if(identities.n.api.git_tree===identities.n_plus_1.api.git_tree)fail('N+1 Git tree is not distinct from N');
for(const component of ['api','web'])if(identities.n[component].image_digest===identities.n_plus_1[component].image_digest)fail(`N+1 ${component} digest is not distinct from N`);
for(const [index,state] of states.entries()){
  const name=sequence[index];exact(state,['label','runtime_release','snapshot','database','checks','cursor_before_valid','cursor_after_valid'],`states.${name}`);
  if(state.label!==name||state.runtime_release!==expectedRuntime[index])fail(`${name} runtime release is invalid`);
  const snapshot=state.snapshot;
  if(snapshot.runtime_release!==expectedRuntime[index]||snapshot.worker_running!==false||snapshot.provider_execution_enabled!==false||snapshot.championship_execution_enabled!==false||snapshot.scheduler_enabled!==false||snapshot.discovery_enabled!==false||snapshot.provider_network_blocked!==true||snapshot.provider_network_block_mechanism!=='container-egress-deny'||snapshot.preview_production_enabled!==false||snapshot.production_target!==false)fail(`${name} runtime safety is invalid`);
  const selected=snapshot.releases?.[expectedRuntime[index]];
  if(!selected)fail(`${name} selected release identity is absent`);
  releaseIdentity(snapshot.releases.n,`${name}.release.n`);releaseIdentity(snapshot.releases.n_plus_1,`${name}.release.n_plus_1`);
  if(JSON.stringify(snapshot.releases)!==JSON.stringify(identities))fail(`${name} release identities changed during the sequence`);
  for(const component of ['api','web'])for(const field of ['immutable_ref','version','git_sha','git_tree','build_time','image_id','image_digest'])if(snapshot.releases?.n?.[component]?.[field]!==baseline.release?.[component]?.[field])fail(`${name} baseline N ${component}.${field} differs`);
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
