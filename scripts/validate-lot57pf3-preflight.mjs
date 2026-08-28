import fs from 'node:fs';

const fail=message=>{console.error(`F3 preflight refused: ${message}`);process.exit(1);};
if(process.argv.length!==3)fail('usage: validate-lot57pf3-preflight.mjs SAFETY-SNAPSHOT.json');
let input;
try{input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{fail('invalid safety snapshot');}
const exactKeys=['worker_running','provider_execution_enabled','scheduler_enabled','discovery_enabled','provider_network_blocked','preview_production_enabled','production_target'];
for(const key of exactKeys)if(typeof input[key]!=='boolean')fail(`${key} must be an explicit boolean`);
if(input.worker_running)fail('worker is running');
if(input.provider_execution_enabled)fail('provider execution is enabled');
if(input.scheduler_enabled)fail('scheduler is enabled');
if(input.discovery_enabled)fail('discovery is enabled');
if(!input.provider_network_blocked)fail('external provider network is not blocked');
if(input.preview_production_enabled)fail('Production Preview is enabled');
if(input.production_target)fail('Production target is forbidden');
if(!['firewall-deny-egress','container-egress-deny','injected-blocking-transport'].includes(input.provider_network_block_mechanism))fail('network block mechanism is absent or non-verifiable');
for(const release of ['n','n_plus_1']){
  const value=input.releases?.[release];
  if(!value||typeof value!=='object')fail(`immutable release ${release} is absent`);
  for(const field of ['version','git_sha','build_time','image_id','image_digest']){
    if(typeof value[field]!=='string'||value[field].trim()===''||value[field].toLowerCase()==='unknown')fail(`${release}.${field} is absent or unknown`);
  }
  if(!/^[0-9a-f]{40}$/.test(value.git_sha))fail(`${release}.git_sha is not an exact SHA`);
  if(!/^sha256:[0-9a-f]{64}$/.test(value.image_digest))fail(`${release}.image_digest is not immutable`);
  if(Number.isNaN(Date.parse(value.build_time)))fail(`${release}.build_time is invalid`);
}
if(input.releases.n.image_digest===input.releases.n_plus_1.image_digest)fail('N and N+1 image identities are identical');
console.log(JSON.stringify({status:'preflight_ok',sanitized:true,provider_calls:0,worker_running:false,production_target:false}));
