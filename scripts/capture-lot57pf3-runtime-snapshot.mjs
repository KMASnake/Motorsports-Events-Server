import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const fail=message=>{throw new Error(`F3 runtime probe refused: ${message}`);};
const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);return index<0?null:args[index+1]??null;};
if(args.length!==6)fail('usage: capture-lot57pf3-runtime-snapshot.mjs --n-image REF@sha256:DIGEST --n-plus-one-image REF@sha256:DIGEST --output FILE');
const nRef=value('--n-image'),n1Ref=value('--n-plus-one-image'),output=value('--output');
if(!nRef||!n1Ref||!output)fail('all arguments are mandatory');
const immutable=/@sha256:([0-9a-f]{64})$/;
if(!immutable.test(nRef)||!immutable.test(n1Ref))fail('N and N+1 must be immutable digest references');
const envFile=process.env.F3_PREPROD_ENV_FILE??'.env.preprod';
if(!fs.existsSync(envFile))fail('preproduction env file is absent');
const compose=['compose','--env-file',envFile,'-p','mse-preprod','-f','docker-compose.yml','-f','docker-compose.preprod.yml'];
const run=(commandArgs,label)=>{const result=spawnSync('docker',commandArgs,{encoding:'utf8'});if(result.status!==0)fail(`${label} is unknown`);return result.stdout.trim();};
const json=(commandArgs,label)=>{try{return JSON.parse(run(commandArgs,label));}catch{fail(`${label} is not inspectable JSON`);}};
const containerId=service=>{const id=run([...compose,'ps','-aq',service],`${service} container`);if(!id)fail(`${service} container is absent`);return id;};
const inspectContainer=service=>{const inspected=json(['inspect',containerId(service)],`${service} runtime`);if(!Array.isArray(inspected)||inspected.length!==1)fail(`${service} runtime is ambiguous`);return inspected[0];};
const inspectNamedContainer=(name,label)=>{const inspected=json(['inspect',name],label);if(!Array.isArray(inspected)||inspected.length!==1)fail(`${label} is ambiguous`);return inspected[0];};
const envMap=inspected=>Object.fromEntries((inspected.Config?.Env??[]).map(entry=>{const index=entry.indexOf('=');return index<0?[entry,'']:[entry.slice(0,index),entry.slice(index+1)];}));
const projectOf=inspected=>inspected.Config?.Labels?.['com.docker.compose.project'];

const postgres=inspectContainer('postgres'),api=inspectContainer('api'),worker=inspectContainer('worker');
for(const [name,container] of [['postgres',postgres],['api',api],['worker',worker]])if(projectOf(container)!=='mse-preprod')fail(`${name} does not belong to the explicit preproduction project`);
if(postgres.State?.Running!==true||api.State?.Running!==true)fail('preproduction API/PostgreSQL runtime is not running');
if(typeof worker.State?.Running!=='boolean')fail('worker runtime state is unknown');
if(worker.State.Running)fail('worker is running');
const apiEnv=envMap(api),postgresEnv=envMap(postgres);
if(apiEnv.NODE_ENV!=='production')fail('API is not the preproduction runtime');
if(apiEnv.PREVIEW_API_ENABLED!=='false')fail('Production Preview is enabled or unknown');
const postgresUser=postgresEnv.POSTGRES_USER,postgresDb=postgresEnv.POSTGRES_DB;
if(!postgresUser||!postgresDb)fail('PostgreSQL runtime identity is unknown');
const safetySql=`select json_build_object(
  'provider_execution_enabled',exists(select 1 from provider_instances where enabled or state='active'),
  'championship_execution_enabled',exists(select 1 from provider_championships where sync_state='active'),
  'scheduler_execution_active',exists(select 1 from sync_streams where state='running' or lease_owner is not null),
  'discovery_enabled',exists(select 1 from provider_instances where discovery_enabled or discovery_lease_owner is not null)
)::text`;
const dbSafety=json([...compose,'exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U',postgresUser,'-d',postgresDb,'-Atc',safetySql],'database safety state');
for(const key of ['provider_execution_enabled','championship_execution_enabled','scheduler_execution_active','discovery_enabled'])if(typeof dbSafety[key]!=='boolean')fail(`${key} is unknown`);
if(dbSafety.provider_execution_enabled||dbSafety.championship_execution_enabled)fail('provider execution is enabled');
if(dbSafety.scheduler_execution_active)fail('scheduler execution is active');
if(dbSafety.discovery_enabled)fail('discovery execution is enabled');

const networkName='mse-f3-certification-internal';
const networks=json(['network','inspect',networkName],'certification network');
if(!Array.isArray(networks)||networks.length!==1||networks[0].Name!==networkName||networks[0].Internal!==true)fail('external provider egress isolation is not provable');
for(const [name,container] of [['postgres',postgres],['api',api]])if(!container.NetworkSettings?.Networks?.[networkName])fail(`${name} is not attached to the internal certification network`);
const certificationContainerName='mse-f3-certification-runner';
const certification=inspectNamedContainer(certificationContainerName,'certification runner');
if(certification.State?.Running!==true)fail('certification runner is absent or not running');
if(certification.Config?.Labels?.['com.mse.certification']!=='lot57pf3'||certification.Config?.Labels?.['com.mse.certification.target']!=='preproduction')fail('certification runner context is not controlled');
const certificationNetworks=certification.NetworkSettings?.Networks;
if(!certificationNetworks||typeof certificationNetworks!=='object'||Array.isArray(certificationNetworks))fail('certification runner network state is unknown');
const attachedNetworks=Object.keys(certificationNetworks);
if(attachedNetworks.length!==1||attachedNetworks[0]!==networkName)fail('certification runner has an externally routed or unknown network attached');
const inspectImage=ref=>{const rows=json(['image','inspect',ref],`image ${ref}`);if(!Array.isArray(rows)||rows.length!==1)fail(`image ${ref} is ambiguous`);const row=rows[0],digest=ref.slice(ref.indexOf('@')+1);if(!Array.isArray(row.RepoDigests)||!row.RepoDigests.includes(ref))fail(`image ${ref} digest is not locally verified`);if(typeof row.Id!=='string'||!/^sha256:[0-9a-f]{64}$/.test(row.Id))fail(`image ${ref} ID is unknown`);const metadata=envMap(row);for(const key of ['APP_VERSION','GIT_SHA','BUILD_TIME'])if(!metadata[key]||metadata[key].toLowerCase()==='unknown')fail(`image ${ref} ${key} is unknown`);if(!/^[0-9a-f]{40}$/.test(metadata.GIT_SHA)||Number.isNaN(Date.parse(metadata.BUILD_TIME)))fail(`image ${ref} metadata is invalid`);return {version:metadata.APP_VERSION,git_sha:metadata.GIT_SHA,build_time:metadata.BUILD_TIME,image_id:row.Id,image_digest:digest};};
const releases={n:inspectImage(nRef),n_plus_1:inspectImage(n1Ref)};
if(releases.n.image_digest===releases.n_plus_1.image_digest)fail('N and N+1 images are identical');
if(certification.Image!==releases.n_plus_1.image_id)fail('certification runner does not use the inspected N+1 image');
const snapshot={worker_running:false,provider_execution_enabled:false,scheduler_enabled:false,discovery_enabled:false,provider_network_blocked:true,provider_network_block_mechanism:'container-egress-deny',preview_production_enabled:false,production_target:false,releases,probe:{source:'repository-runtime-inspection',compose_project:'mse-preprod',certification_container:certificationContainerName,certification_image_id:certification.Image,certification_network:networkName,network_internal:true,exclusive_network_attachment:true}};
fs.writeFileSync(output,`${JSON.stringify(snapshot,null,2)}\n`,{encoding:'utf8',mode:0o600});
console.log('F3 runtime safety snapshot captured from inspected state.');
