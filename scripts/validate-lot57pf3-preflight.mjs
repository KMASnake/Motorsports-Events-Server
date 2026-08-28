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
if(!['n','n_plus_1'].includes(input.runtime_release))fail('runtime release identity is absent');
for(const release of ['n','n_plus_1']){
  const value=input.releases?.[release];
  if(!value||typeof value!=='object')fail(`immutable release ${release} is absent`);
  for(const component of ['api','web']){
    const image=value[component];
    if(!image||typeof image!=='object')fail(`${release}.${component} identity is absent`);
    for(const field of ['version','git_sha','build_time','image_id','image_digest']){
      if(typeof image[field]!=='string'||image[field].trim()===''||image[field].toLowerCase()==='unknown')fail(`${release}.${component}.${field} is absent or unknown`);
    }
    if(!/^[0-9a-f]{40}$/.test(image.git_sha))fail(`${release}.${component}.git_sha is not an exact SHA`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.image_id))fail(`${release}.${component}.image_id is not immutable`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.image_digest))fail(`${release}.${component}.image_digest is not immutable`);
    if(Number.isNaN(Date.parse(image.build_time)))fail(`${release}.${component}.build_time is invalid`);
  }
  if(value.api.image_digest===value.web.image_digest)fail(`${release} API and Web image identities are identical`);
}
for(const component of ['api','web'])if(input.releases.n[component].image_digest===input.releases.n_plus_1[component].image_digest)fail(`N and N+1 ${component} image identities are identical`);
console.log(JSON.stringify({status:'preflight_ok',sanitized:true,provider_calls:0,worker_running:false,production_target:false}));
