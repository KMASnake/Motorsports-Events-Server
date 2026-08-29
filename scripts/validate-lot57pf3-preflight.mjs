import fs from 'node:fs';

const fail=message=>{console.error(`F3 preflight refused: ${message}`);process.exit(1);};
if(process.argv.length!==4)fail('usage: validate-lot57pf3-preflight.mjs SAFETY-SNAPSHOT.json PROSPECTIVE-BASELINE-N.json');
let input,baseline;
try{input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{fail('invalid safety snapshot');}
try{baseline=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));}catch{fail('invalid prospective baseline');}
if(baseline.schema!=='lot57pf3-prospective-baseline-v1'||baseline.prospective_certification_baseline!==true||baseline.classification!=='prospective-certification-baseline'||baseline.historical_pre_existing_release!==false)fail('prospective baseline marker or classification is invalid');
if(baseline.provenance?.source!=='repository-runtime-inspection'||baseline.provenance?.git_tree_source!=='git-rev-parse-commit-tree'||baseline.provenance?.compose_project!=='mse-preprod'||baseline.provenance?.certification_container!=='mse-f3-certification-runner'||baseline.provenance?.certification_network!=='mse-f3-certification-internal'||baseline.provenance?.exclusive_network_attachment!==true)fail('prospective baseline provenance is malformed');
if(Number.isNaN(Date.parse(baseline.established_at)))fail('prospective baseline establishment time is invalid');
const exactKeys=['worker_running','provider_execution_enabled','championship_execution_enabled','scheduler_enabled','discovery_enabled','provider_network_blocked','preview_production_enabled','production_target'];
for(const key of exactKeys)if(typeof input[key]!=='boolean')fail(`${key} must be an explicit boolean`);
if(input.worker_running)fail('worker is running');
if(input.provider_execution_enabled)fail('provider execution is enabled');
if(input.championship_execution_enabled)fail('championship execution is enabled');
if(input.scheduler_enabled)fail('scheduler is enabled');
if(input.discovery_enabled)fail('discovery is enabled');
if(!input.provider_network_blocked)fail('external provider network is not blocked');
if(input.preview_production_enabled)fail('Production Preview is enabled');
if(input.production_target)fail('Production target is forbidden');
if(!['firewall-deny-egress','container-egress-deny','injected-blocking-transport'].includes(input.provider_network_block_mechanism))fail('network block mechanism is absent or non-verifiable');
if(!['n','n_plus_1'].includes(input.runtime_release))fail('runtime release identity is absent');
for(const release of ['n','n_plus_1']){
  const value=input.releases?.[release];
  if(!value||typeof value!=='object')fail(`immutable release ${release} is absent`);
  for(const component of ['api','web']){
    const image=value[component];
    if(!image||typeof image!=='object')fail(`${release}.${component} identity is absent`);
    for(const field of ['immutable_ref','version','git_sha','git_tree','build_time','image_id','image_digest']){
      if(typeof image[field]!=='string'||image[field].trim()===''||image[field].toLowerCase()==='unknown')fail(`${release}.${component}.${field} is absent or unknown`);
    }
    if(!/^[0-9a-f]{40}$/.test(image.git_sha))fail(`${release}.${component}.git_sha is not an exact SHA`);
    if(!/^[0-9a-f]{40}$/.test(image.git_tree))fail(`${release}.${component}.git_tree is not an exact tree identity`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.image_id))fail(`${release}.${component}.image_id is not immutable`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.image_digest))fail(`${release}.${component}.image_digest is not immutable`);
    if(!/@sha256:[0-9a-f]{64}$/.test(image.immutable_ref)||!image.immutable_ref.endsWith(`@${image.image_digest}`))fail(`${release}.${component}.immutable_ref is not exact`);
    if(Number.isNaN(Date.parse(image.build_time)))fail(`${release}.${component}.build_time is invalid`);
  }
  if(value.api.image_digest===value.web.image_digest)fail(`${release} API and Web image identities are identical`);
  if(value.api.git_sha!==value.web.git_sha||value.api.version!==value.web.version||value.api.git_tree!==value.web.git_tree)fail(`${release} API/Web release identity is incoherent`);
}
for(const component of ['api','web'])if(input.releases.n[component].image_digest===input.releases.n_plus_1[component].image_digest)fail(`N and N+1 ${component} image identities are identical`);
if(input.releases.n.api.git_tree===input.releases.n_plus_1.api.git_tree)fail('N+1 has the same Git tree as N');
if(baseline.release?.git_sha!==input.releases.n.api.git_sha||baseline.release?.git_tree!==input.releases.n.api.git_tree||baseline.release?.version!==input.releases.n.api.version)fail('baseline release identity does not match N');
for(const component of ['api','web'])for(const field of ['immutable_ref','version','git_sha','git_tree','build_time','image_id','image_digest'])if(baseline.release?.[component]?.[field]!==input.releases.n[component][field])fail(`baseline ${component}.${field} does not match N`);
if(baseline.runtime_safety?.championship_execution_enabled!==false)fail('baseline championship execution safety is invalid');
console.log(JSON.stringify({status:'preflight_ok',sanitized:true,provider_calls:0,worker_running:false,production_target:false}));
