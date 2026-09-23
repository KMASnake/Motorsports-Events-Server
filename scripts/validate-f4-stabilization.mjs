#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const EXPECTED_BASELINE_HEAD='8553fb9c1b69790169f46a6e96ba4f02d8cf6601';
const EXPECTED_BASELINE_TREE='dc0a25485a2ef056617ec4421cd84c5bbc28d0f1';
const LEGACY_CLOSURE_HEAD='5e047a23375fee4f6dddadf551f6d9e22253b66e';
const EXPECTED_F4_5_HEAD='a455e720fe49061a818881a9385942ad6d613261';
const EXPECTED_F4_5_TREE='f81d71f15368e08e5427f9ecb23815c3a06d4432';
const EXPECTED_F4_6_HEAD='5776aca7d3bab642f7655a8df6975d243a5b8796';
const EXPECTED_F4_6_TREE='16b20c5208faa6187b9402d29ed873f7fe08b69e';
const EXPECTED_F4_FINAL_HEAD='76e7540bf4589e1c1dda4b461a4667150537a65b';
const EXPECTED_F4_FINAL_TREE='6867c3bd602168d117d7de42121823336edd6a68';
const EXPECTED_F5_1_HEAD='3e80099d56ff85df6eebe6b84d615a89180e12e9';
const EXPECTED_F5_1_TREE='34c8a030e3a5d8af2bda71421eba31cf4f7d1114';
const EXPECTED_MIGRATION_HEAD='0031_real_circuit_reference_data';
const F4_COMMITS=[
  '523a2cecedd38e9a9ec463fae66221069b8c53cc',
  'ee882417fb90b4cea374ec294e960191cb7e9a69',
  '6633e3d5c857f8c57d83e82245ca3f713e7381fe',
  'cb76aedf53ff073f987e8e7ccf3028edc2e6c32c',
  'b405f86cba811556dd2ee50f7b5d53df34e67008',
  '3c254b42055897875b61046f5130488c589c68fc',
  '324e35e49fee838e538c25d14ac08cb94f14b7f4',
  '4dbbaaf3cc56effd387071e38100a10cd27439a1',
  EXPECTED_BASELINE_HEAD,
];
const F3_BASELINE_SHA256='75dd9583fa3dc83b7c902028e7ad2b0f7abf17f1ce023ea8c151a93ebd3cfbd9';
const ALLOWED_CLOSURE_CHANGES=new Map([
  ['docs/handoff/LOT-5.7-P-F4-EMPTY-EVENT-BASELINE.md','M'],
  ['docs/handoff/LOT-5.7-P-F4-STABILIZATION-CERTIFICATION.md','A'],
  ['docs/handoff/PROGRESS.json','M'],
  ['docs/handoff/VPS-PREPRODUCTION-READINESS.md','M'],
  ['docs/handoff/evidence/lot57pf4-empty-event-runtime.json','A'],
  ['scripts/validate-f4-stabilization.mjs','A'],
  ['tests/test_f4_stabilization.py','A'],
]);

const options={root:process.cwd()};
for(let index=2;index<process.argv.length;index+=2){
  const key=process.argv[index],value=process.argv[index+1];
  if(!key?.startsWith('--')||value===undefined)throw new Error(`Option invalide: ${key??''}`);
  options[key.slice(2).replaceAll('-','_')]=value;
}
const root=resolve(options.root);
const path=(name,fallback)=>resolve(root,options[name]??fallback);
const files={
  evidence:path('evidence','docs/handoff/evidence/lot57pf4-empty-event-runtime.json'),
  f3Baseline:path('f3_baseline','docs/handoff/evidence/lot57pf3-prospective-baseline-N.json'),
  progress:path('progress','docs/handoff/PROGRESS.json'),
  certification:path('certification','docs/handoff/LOT-5.7-P-F4-STABILIZATION-CERTIFICATION.md'),
  emptyDoc:path('empty_doc','docs/handoff/LOT-5.7-P-F4-EMPTY-EVENT-BASELINE.md'),
  readiness:path('readiness','docs/handoff/VPS-PREPRODUCTION-READINESS.md'),
  f5Doc:path('f5_doc','docs/handoff/LOT-5.7-P-F5-1-CANONICAL-TAXONOMY.md'),
  taxonomyAdr:path('taxonomy_adr','docs/handbook/architecture/ADR-0023-CANONICAL-TAXONOMY.md'),
  archiver:path('archiver','scripts/build-release-archive.py'),
  releaseTests:path('release_tests','tests/test_release_workflow.py'),
  operations:path('operations','scripts/lib.sh'),
  update:path('update','scripts/update.sh'),
  schema:path('schema','apps/api/src/lib/schemaCompatibility.ts'),
  database:path('database','apps/api/src/lib/db.ts'),
  health:path('health','apps/api/src/routes/health.ts'),
  emptyHarness:path('empty_harness','scripts/test-f4-empty-event-database.sh'),
  workflow:path('workflow','.github/workflows/validate.yml'),
};
const read=file=>readFileSync(file,'utf8');
const json=file=>JSON.parse(read(file));
const exactKeys=(value,keys,label)=>assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),`${label}: champs inattendus ou absents`);
const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
const ancestor=(older,newer)=>execFileSync('git',['-C',root,'merge-base','--is-ancestor',older,newer],{stdio:'ignore'});
const evidenceMarker=(text,label)=>{
  const match=text.match(/<!-- F4-STABILIZATION-EVIDENCE\n([\s\S]*?)\nF4-STABILIZATION-EVIDENCE -->/);
  assert.ok(match,`${label}: marqueur de preuve absent`);
  return JSON.parse(match[1]);
};

const evidence=json(files.evidence);
exactKeys(evidence,['schema','status','evidence_classification','baseline_git_head','baseline_git_tree','runtime_mode','migration_head','calendar_empty','harness_rc','cleanup','provider_calls','worker_started','preprod_mutated','production_mutated','ci'],'preuve F4-4');
assert.equal(evidence.schema,'lot57pf4-empty-event-runtime-v1');
assert.equal(evidence.status,'pass');
assert.equal(evidence.evidence_classification,'maintainer-supplied-runtime-certification');
assert.equal(evidence.baseline_git_head,EXPECTED_BASELINE_HEAD);
assert.equal(evidence.baseline_git_tree,EXPECTED_BASELINE_TREE);
assert.equal(evidence.runtime_mode,'docker');
assert.equal(evidence.migration_head,EXPECTED_MIGRATION_HEAD);
assert.equal(evidence.calendar_empty,true);
assert.equal(evidence.harness_rc,0);
exactKeys(evidence.cleanup,['containers','networks','temp_dirs'],'cleanup F4-4');
assert.deepEqual(evidence.cleanup,{containers:0,networks:0,temp_dirs:0});
assert.equal(evidence.provider_calls,0);
assert.equal(evidence.worker_started,false);
assert.equal(evidence.preprod_mutated,false);
assert.equal(evidence.production_mutated,false);
exactKeys(evidence.ci,['legacy','node'],'CI F4-4');
for(const [name,workflow,run] of [['legacy','Validate legacy Python server',261],['node','CI — Node target',530]]){
  exactKeys(evidence.ci[name],['workflow','run_number','conclusion'],`CI ${name}`);
  assert.equal(evidence.ci[name].workflow,workflow);
  assert.equal(evidence.ci[name].run_number,run);
  assert.equal(evidence.ci[name].conclusion,'SUCCESS');
}

const evidenceFacts={
  baseline_git_head:evidence.baseline_git_head,
  baseline_git_tree:evidence.baseline_git_tree,
  runtime_mode:evidence.runtime_mode,
  migration_head:evidence.migration_head,
  calendar_empty:evidence.calendar_empty,
  harness_rc:evidence.harness_rc,
  cleanup:evidence.cleanup,
  provider_calls:evidence.provider_calls,
  worker_started:evidence.worker_started,
  preprod_mutated:evidence.preprod_mutated,
  production_mutated:evidence.production_mutated,
  ci:evidence.ci,
};

assert.equal(git('rev-parse',`${EXPECTED_BASELINE_HEAD}^{tree}`),EXPECTED_BASELINE_TREE,'tree F4-4');
assert.equal(git('rev-parse',`${EXPECTED_F4_5_HEAD}^{tree}`),EXPECTED_F4_5_TREE,'tree F4-5');
assert.equal(git('rev-parse',`${EXPECTED_F4_6_HEAD}^{tree}`),EXPECTED_F4_6_TREE,'tree F4-6');
assert.equal(git('rev-parse',`${EXPECTED_F4_FINAL_HEAD}^{tree}`),EXPECTED_F4_FINAL_TREE,'tree final F4');
const currentHead=git('rev-parse','HEAD');
ancestor(EXPECTED_BASELINE_HEAD,currentHead);
ancestor(EXPECTED_F4_5_HEAD,currentHead);
ancestor(EXPECTED_F4_6_HEAD,currentHead);
ancestor(EXPECTED_F4_FINAL_HEAD,currentHead);
for(let index=1;index<F4_COMMITS.length;index++)ancestor(F4_COMMITS[index-1],F4_COMMITS[index]);
// L'allowlist décrit exclusivement le snapshot historique de clôture F4.
// Un descendant F5 est autorisé, mais ses changements ne peuvent ni élargir
// cette allowlist ni servir de preuve rétroactive pour F4.
const rawChanges=execFileSync('git',['-C',root,'diff','--name-status','-z','--find-renames','--find-copies','--find-copies-harder',`${EXPECTED_BASELINE_HEAD}..${EXPECTED_F4_FINAL_HEAD}`]);
const changeParts=rawChanges.toString('utf8').split('\0');
if(changeParts.at(-1)==='')changeParts.pop();
const actualChanges=new Map();
for(let index=0;index<changeParts.length;){
  const status=changeParts[index++];
  assert.match(status,/^(?:[AMD]|[RC][0-9]+)$/,`statut Git non supporté: ${status}`);
  if(status.startsWith('R')||status.startsWith('C')){
    const source=changeParts[index++],destination=changeParts[index++];
    assert.fail(`rename/copy interdit dans F4-5: ${source} -> ${destination}`);
  }
  const changedPath=changeParts[index++];
  assert.ok(changedPath,`chemin Git absent pour ${status}`);
  assert.ok(!actualChanges.has(changedPath),`chemin Git dupliqué: ${changedPath}`);
  actualChanges.set(changedPath,status);
}
const expectedClosureChanges=new Map(ALLOWED_CLOSURE_CHANGES);
if(EXPECTED_F4_FINAL_HEAD!==LEGACY_CLOSURE_HEAD)expectedClosureChanges.set('.github/workflows/validate.yml','M');
assert.deepEqual([...actualChanges.entries()].sort(),[...expectedClosureChanges.entries()].sort(),'diff baseline -> clôture hors allowlist ou incomplet');

const workflow=read(files.workflow);
const validateJob=workflow.split('\n  validate:\n',2)[1]?.split('\n  postgres-integration:\n',1)[0];
assert.ok(validateJob,'job validate absent du workflow legacy');
assert.match(validateJob,/- uses: actions\/checkout@v4\n\s+with:\n\s+fetch-depth: 0(?:\n|$)/,'checkout complet absent du job validate');

const migrationsDir=resolve(root,'infra/postgres/migrations');
const migrationFiles=readdirSync(migrationsDir).filter(name=>/^\d{4}_.+\.up\.sql$/.test(name)).sort();
const migrations=migrationFiles.map(name=>name.slice(0,-7));
assert.equal(migrations[30],EXPECTED_MIGRATION_HEAD,'la chaîne historique F4 doit conserver 0031 à sa position certifiée');
assert.deepEqual(migrations.map(value=>Number(value.slice(0,4))),Array.from({length:migrations.length},(_,i)=>i+1));
const schema=read(files.schema);
const declared=schema.split('APPLICATION_SCHEMA_MIGRATIONS = [',2)[1]?.split('] as const',1)[0]?.match(/'([0-9]{4}_[a-z0-9_]+)'/g)?.map(value=>value.slice(1,-1));
assert.deepEqual(declared,migrations,'APPLICATION_SCHEMA_MIGRATIONS doit suivre exactement les migrations');
assert.match(schema,/APPLICATION_SCHEMA_HEAD\s*=\s*APPLICATION_SCHEMA_MIGRATIONS\.at\(-1\)/);

const archiver=read(files.archiver),releaseTests=read(files.releaseTests);
for(const token of ['"ls-tree"','"cat-file"','Fichier d\'environnement sensible suivi par Git','partial.replace(output)'])assert.ok(archiver.includes(token),`invariant packaging absent: ${token}`);
for(const token of ['uncommitted content','\.env.preprod','test_release_archive_refuses_paths_outside_its_prefix','test_release_archive_keeps_final_output_atomic_on_mid_build_failure'])assert.ok(releaseTests.includes(token),`test packaging absent: ${token}`);

const operations=read(files.operations),update=read(files.update);
for(const token of ['--env-file "${PREPROD_ENV_FILE}"','-f "${COMPOSE_FILE}"','-f "${PREPROD_COMPOSE_FILE}"','require_preprod_context'])assert.ok(operations.includes(token),`protection préprod absente: ${token}`);
assert.ok(operations.split('-p mse-preprod').length-1>=2,'projet mse-preprod absent d’un contexte Compose canonique');
for(const forbidden of ['up -d --wait worker','start worker','restart worker'])assert.ok(!update.includes(forbidden),`worker inclus dans update: ${forbidden}`);
assert.ok(update.includes('preprod_compose up -d --wait api web prometheus'),'services préprod explicites absents');

const database=read(files.database),health=read(files.health);
assert.ok(database.includes('select version from schema_migrations order by version'),'schema guard DB absent');
assert.ok(!schema.toLowerCase().includes('insert into schema_migrations'),'schema guard ne doit pas migrer');
assert.ok(health.includes("'/health/live'")&&health.includes("'/health/ready'"),'live/ready distincts absents');
assert.ok(health.includes('const readiness = await databaseReadiness();'),'readiness ne vérifie pas la compatibilité');

const emptyHarness=read(files.emptyHarness);
for(const token of ['0031_real_circuit_reference_data','PREVIEW_API_ENABLED=false','API_HOST=127.0.0.1','docker port "${DOCKER_CONTAINER}" 5432/tcp','v.length!==0','created-by-f4-empty-event-db'])assert.ok(emptyHarness.includes(token),`invariant F4-4 absent: ${token}`);
assert.ok(!emptyHarness.toLowerCase().includes('docker compose'),'F4-4 ne doit pas utiliser Compose');

const f3Bytes=readFileSync(files.f3Baseline);
assert.equal(createHash('sha256').update(f3Bytes).digest('hex'),F3_BASELINE_SHA256,'checksum baseline F3');

const progress=json(files.progress);
const gateF=progress.current?.sub_lot_5_7_p?.technical_gates?.['5.7-P-F'];
const f4=gateF?.preproduction_stabilization_f4;
assert.ok(f4,'état canonique F4 absent');
assert.equal(progress.current?.status,'lot-5.7-p-f3-proven-f4-complete-f5-1-maintainer-validated-gate-f-incomplete');
assert.equal(gateF?.status,'f3-proven-f4-complete-gate-f-incomplete');
for(const stage of ['F4-0','F4-1','F4-2','F4-3','F4-4','F4-5','F4-6'])assert.equal(f4.subphases?.[stage]?.status,'maintainer-validated',`${stage} non validé`);
assert.equal(f4.subphases?.['F4-5']?.implementation_complete,true);
assert.equal(f4.subphases?.['F4-5']?.maintainer_validated,true);
assert.equal(f4.subphases?.['F4-5']?.git_head,EXPECTED_F4_5_HEAD);
assert.equal(f4.subphases?.['F4-5']?.git_tree,EXPECTED_F4_5_TREE);
assert.equal(f4.subphases?.['F4-6']?.implementation_complete,true);
assert.equal(f4.subphases?.['F4-6']?.maintainer_validated,true);
assert.equal(f4.subphases?.['F4-6']?.git_head,EXPECTED_F4_6_HEAD);
assert.equal(f4.subphases?.['F4-6']?.git_tree,EXPECTED_F4_6_TREE);
assert.equal(f4.status,'complete');
assert.equal(f4.implementation_complete,true);
assert.equal(f4.maintainer_validated,true);
assert.equal(f4.authorized_subphase,null);
assert.deepEqual(f4.runtime_certification,evidenceFacts,'PROGRESS contredit la preuve runtime F4-4');
const closure=f4.f4_5_closure;
assert.ok(closure,'clôture F4-5 absente');
exactKeys(closure,['status','git_head','git_tree','ci'],'clôture F4-5');
assert.equal(closure.status,'maintainer-validated');
assert.equal(closure.git_head,EXPECTED_F4_5_HEAD);
assert.equal(closure.git_tree,EXPECTED_F4_5_TREE);
for(const [name,workflow,run] of [['legacy','Validate legacy Python server',263],['node','CI — Node target',532]]){
  exactKeys(closure.ci[name],['workflow','run_number','conclusion'],`CI clôture ${name}`);
  assert.equal(closure.ci[name].workflow,workflow);
  assert.equal(closure.ci[name].run_number,run);
  assert.equal(closure.ci[name].conclusion,'SUCCESS');
}
const finalClosure=f4.f4_6_closure;
assert.ok(finalClosure,'clôture F4-6 absente');
exactKeys(finalClosure,['status','git_head','git_tree','ci'],'clôture F4-6');
assert.equal(finalClosure.status,'maintainer-validated');
assert.equal(finalClosure.git_head,EXPECTED_F4_6_HEAD);
assert.equal(finalClosure.git_tree,EXPECTED_F4_6_TREE);
for(const [name,workflow,run] of [['legacy','Validate legacy Python server',264],['node','CI — Node target',533]]){
  exactKeys(finalClosure.ci[name],['workflow','run_number','conclusion'],`CI clôture finale ${name}`);
  assert.equal(finalClosure.ci[name].workflow,workflow);
  assert.equal(finalClosure.ci[name].run_number,run);
  assert.equal(finalClosure.ci[name].conclusion,'SUCCESS');
}
assert.equal(progress.current?.sub_lot_5_7_p?.authorized_technical_sub_lot,null);
assert.equal(gateF.authorized_subphase,null);
const f5=gateF.provider_first_f5;
assert.ok(f5,'état F5 absent');
if(f5.status==='not-started'){
  assert.equal(f5.implementation_started,false);
  assert.equal(f5.authorized,false);
}else{
  assert.equal(f5.status,'in-progress');
  assert.equal(f5.implementation_started,true);
  assert.equal(f5.authorized,true);
  assert.equal(f5.authorized_subphase,'F5-2');
  const f51=f5.subphases?.['F5-1'];
  assert.ok(f51,'état F5-1 absent');
  exactKeys(f51,['status','authorized','implementation_complete','maintainer_audit','maintainer_validated','git_head','git_tree','migration_head','ci','blockers'],'F5-1');
  assert.equal(f51.status,'maintainer-validated');
  assert.equal(f51.authorized,true);
  assert.equal(f51.implementation_complete,true);
  assert.equal(f51.maintainer_audit,'pass');
  assert.equal(f51.maintainer_validated,true);
  assert.equal(f51.git_head,EXPECTED_F5_1_HEAD);
  assert.equal(f51.git_tree,EXPECTED_F5_1_TREE);
  assert.equal(f51.migration_head,'0032_f5_canonical_taxonomy');
  assert.equal(f51.blockers,'NONE');
  for(const [name,workflow,run] of [['legacy','Validate legacy Python server',266],['node','CI — Node target',535]]){
    exactKeys(f51.ci[name],['workflow','run_number','conclusion'],`CI F5-1 ${name}`);
    assert.equal(f51.ci[name].workflow,workflow);
    assert.equal(f51.ci[name].run_number,run);
    assert.equal(f51.ci[name].conclusion,'SUCCESS');
  }
  const f52=f5.subphases?.['F5-2'];
  exactKeys(f52,['status','authorized','implementation_complete','maintainer_validated','migration_head'],'F5-2');
  assert.equal(f52.status,'in-progress-pending-maintainer-validation');
  assert.equal(f52.authorized,true);
  assert.equal(f52.implementation_complete,true);
  assert.equal(f52.maintainer_validated,false);
  assert.equal(f52.migration_head,'0033_f5_championship_seasons');
  for(const stage of ['F5-3','F5-4','F5-5','F5-6','F5-7']){
    assert.equal(f5.subphases?.[stage]?.status,'not-started',`${stage} démarré sans autorisation`);
    assert.equal(f5.subphases?.[stage]?.authorized,false,`${stage} autorisé prématurément`);
  }
}
assert.equal(gateF.production_preview_activation_authorized,false);
assert.equal(gateF.production_authorized,false);
assert.equal(progress.current?.sub_lot_5_7_p?.full_lot_5_7_authorized,false);
assert.equal(progress.current?.merge_authorized,false);

const f5Doc=read(files.f5Doc),taxonomyAdr=read(files.taxonomyAdr);
for(const token of ['Statut : `MAINTAINER_VALIDATED`',EXPECTED_F5_1_HEAD,EXPECTED_F5_1_TREE,'`0032_f5_canonical_taxonomy`','Python server #266 : `SUCCESS`','Node target #535 : `SUCCESS`','F5 reste `IN_PROGRESS`','F5-2 a depuis','F5-3 à F5-7 restent'])assert.ok(f5Doc.includes(token),`preuve documentaire F5-1 absente: ${token}`);
assert.ok(taxonomyAdr.includes('Statut : validé par le mainteneur dans F5-1'),'ADR-0023 encore candidat ou incohérent');

const certification=read(files.certification),emptyDoc=read(files.emptyDoc),readiness=read(files.readiness);
for(const stage of ['F4-0','F4-1','F4-2','F4-3','F4-4','F4-5','F4-6'])assert.ok(certification.includes(`${stage}: **VALIDATED**`),`certification ${stage} absente`);
for(const token of ['Statut de cette sous-phase : **MAINTAINER VALIDATED**','F4 global: **COMPLETE**','F5: **NOT STARTED / NOT AUTHORIZED**','Production: **NOT AUTHORIZED**',EXPECTED_F4_5_HEAD,EXPECTED_F4_5_TREE,EXPECTED_F4_6_HEAD,EXPECTED_F4_6_TREE,'#263 : **SUCCESS**','#532 : **SUCCESS**','#264 : **SUCCESS**','#533 : **SUCCESS**'])assert.ok(certification.includes(token),`borne documentaire absente: ${token}`);
for(const forbidden of ['F4-6: **IN PROGRESS**','PENDING MAINTAINER VALIDATION','F4 global: **NOT YET MAINTAINER-VALIDATED**','F5: **STARTED','F5: **AUTHORIZED','Production: **AUTHORIZED'])assert.ok(!certification.includes(forbidden),`déclaration contradictoire interdite: ${forbidden}`);
assert.ok(emptyDoc.includes('Validation runtime mainteneur : **PASS**'),'preuve F4-4 encore stale');
assert.ok(readiness.includes('F4-0 à F4-6 : **VALIDATED**'),'runbook F4 encore stale');
assert.ok(readiness.includes('F4 est **COMPLETE**'),'runbook F4 final absent');
for(const token of [EXPECTED_F4_5_HEAD,EXPECTED_F4_5_TREE,EXPECTED_F4_6_HEAD,EXPECTED_F4_6_TREE,'CI legacy #263','Node\n#532 en succès','CI legacy #264','Node\n#533 en succès','F5 provider-first reste non commencé et\nnon autorisé','Production reste interdite'])assert.ok(readiness.includes(token),`runbook contradictoire ou incomplet: ${token}`);
assert.deepEqual(evidenceMarker(certification,'certification F4-5'),evidenceFacts,'certification F4-5 contredit la preuve runtime');
assert.deepEqual(evidenceMarker(emptyDoc,'documentation F4-4'),evidenceFacts,'documentation F4-4 contredit la preuve runtime');

console.log(JSON.stringify({status:'pass',baseline_git_head:evidence.baseline_git_head,baseline_git_tree:evidence.baseline_git_tree,f4_5_git_head:closure.git_head,f4_5_git_tree:closure.git_tree,f4_6_git_head:finalClosure.git_head,f4_6_git_tree:finalClosure.git_tree,current_head:currentHead,migration_head:migrations.at(-1),f4_5:'maintainer-validated',f4_6:'maintainer-validated',f4:'complete'}));
