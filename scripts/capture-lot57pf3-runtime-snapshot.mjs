import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolveOciRuntimeIdentity} from './lib/lot57pf3-oci-identity.mjs';

const fail=message=>{throw new Error(`F3 runtime probe refused: ${message}`);};
const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);return index<0?null:args[index+1]??null;};
if(args.length!==12)fail('usage: capture-lot57pf3-runtime-snapshot.mjs --n-api-image REF@sha256:DIGEST --n-web-image REF@sha256:DIGEST --n-plus-one-api-image REF@sha256:DIGEST --n-plus-one-web-image REF@sha256:DIGEST --runtime-release n|n-plus-one --output FILE');
const refs={n:{api:value('--n-api-image'),web:value('--n-web-image')},n_plus_1:{api:value('--n-plus-one-api-image'),web:value('--n-plus-one-web-image')}};
const runtimeReleaseInput=value('--runtime-release'),runtimeRelease=runtimeReleaseInput==='n'?'n':runtimeReleaseInput==='n-plus-one'?'n_plus_1':null,output=value('--output');
if(!runtimeRelease||!output||Object.values(refs).some(release=>Object.values(release).some(ref=>!ref)))fail('all arguments are mandatory');
const immutable=/@sha256:([0-9a-f]{64})$/;
for(const [release,components] of Object.entries(refs))for(const [component,ref] of Object.entries(components))if(!immutable.test(ref))fail(`${release}.${component} must be an immutable digest reference`);
const envFile=process.env.F3_PREPROD_ENV_FILE??'.env.preprod';
if(!fs.existsSync(envFile))fail('preproduction env file is absent');
const compose=['compose','--env-file',envFile,'-p','mse-preprod','-f','docker-compose.yml','-f','docker-compose.preprod.yml'];
const run=(commandArgs,label)=>{const result=spawnSync('docker',commandArgs,{encoding:'utf8'});if(result.status!==0)fail(`${label} is unknown`);return result.stdout.trim();};
const rawOci=ref=>run(['buildx','imagetools','inspect','--raw',ref],`OCI identity ${ref}`);
const json=(commandArgs,label)=>{try{return JSON.parse(run(commandArgs,label));}catch{fail(`${label} is not inspectable JSON`);}};
const containerId=service=>{const id=run([...compose,'ps','-aq',service],`${service} container`);if(!id)fail(`${service} container is absent`);return id;};
const inspectContainer=service=>{const inspected=json(['inspect',containerId(service)],`${service} runtime`);if(!Array.isArray(inspected)||inspected.length!==1)fail(`${service} runtime is ambiguous`);return inspected[0];};
const inspectNamedContainer=(name,label)=>{const inspected=json(['inspect',name],label);if(!Array.isArray(inspected)||inspected.length!==1)fail(`${label} is ambiguous`);return inspected[0];};
const envMap=inspected=>Object.fromEntries((inspected.Config?.Env??[]).map(entry=>{const index=entry.indexOf('=');return index<0?[entry,'']:[entry.slice(0,index),entry.slice(index+1)];}));
const gitTree=sha=>{const result=spawnSync('git',['rev-parse',`${sha}^{tree}`],{encoding:'utf8'}),tree=result.stdout.trim();if(result.status!==0||!/^[0-9a-f]{40}$/.test(tree))fail(`Git tree provenance for ${sha} is unavailable`);return tree;};
const projectOf=inspected=>inspected.Config?.Labels?.['com.docker.compose.project'];

const postgres=inspectContainer('postgres'),api=inspectContainer('api'),web=inspectContainer('web'),worker=inspectContainer('worker');
for(const [name,container] of [['postgres',postgres],['api',api],['web',web],['worker',worker]])if(projectOf(container)!=='mse-preprod')fail(`${name} does not belong to the explicit preproduction project`);
if(postgres.State?.Running!==true||api.State?.Running!==true||web.State?.Running!==true)fail('preproduction API/Web/PostgreSQL runtime is not running');
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
const inspectImage=(ref,platform)=>{const chain=resolveOciRuntimeIdentity({ref,platform,readRaw:rawOci,fail});const rows=json(['image','inspect',chain.runtime_ref],`image ${chain.runtime_ref}`);if(!Array.isArray(rows)||rows.length!==1)fail(`image ${chain.runtime_ref} is ambiguous`);const row=rows[0];if(row.Os!==platform.split('/')[0]||row.Architecture!==platform.split('/')[1])fail(`image ${chain.runtime_ref} platform differs from ${platform}`);if(!Array.isArray(row.RepoDigests)||!row.RepoDigests.includes(chain.runtime_ref))fail(`runtime manifest ${chain.runtime_ref} is not locally verified`);if(row.Id!==chain.config_digest)fail(`image ${chain.runtime_ref} config digest differs from its OCI manifest`);if(row.RootFS?.Type!=='layers'||!Array.isArray(row.RootFS.Layers)||row.RootFS.Layers.length===0||row.RootFS.Layers.some(layer=>!/^sha256:[0-9a-f]{64}$/.test(layer)))fail(`image ${chain.runtime_ref} rootfs identity is unknown`);const metadata=envMap(row);for(const key of ['APP_VERSION','GIT_SHA','BUILD_TIME'])if(!metadata[key]||metadata[key].toLowerCase()==='unknown')fail(`image ${chain.runtime_ref} ${key} is unknown`);if(!/^[0-9a-f]{40}$/.test(metadata.GIT_SHA)||Number.isNaN(Date.parse(metadata.BUILD_TIME)))fail(`image ${chain.runtime_ref} metadata is invalid`);return {...chain,rootfs_diff_ids:row.RootFS.Layers,version:metadata.APP_VERSION,git_sha:metadata.GIT_SHA,git_tree:gitTree(metadata.GIT_SHA),build_time:metadata.BUILD_TIME};};
const platformOf=(container,label)=>{if(typeof container.Platform!=='string')fail(`${label} runtime platform is unknown`);return container.Platform;};
const releases={n:{api:inspectImage(refs.n.api,platformOf(api,'API')),web:inspectImage(refs.n.web,platformOf(web,'Web'))},n_plus_1:{api:inspectImage(refs.n_plus_1.api,platformOf(api,'API')),web:inspectImage(refs.n_plus_1.web,platformOf(web,'Web'))}};
for(const component of ['api','web'])if(releases.n[component].runtime_manifest_digest===releases.n_plus_1[component].runtime_manifest_digest)fail(`N and N+1 ${component} runtime manifests are identical`);
for(const release of ['n','n_plus_1'])if(releases[release].api.git_sha!==releases[release].web.git_sha||releases[release].api.version!==releases[release].web.version||releases[release].api.git_tree!==releases[release].web.git_tree)fail(`${release} API/Web release identity is incoherent`);
if(releases.n.api.git_tree===releases.n_plus_1.api.git_tree)fail('N+1 has the same Git tree as N; empty commits and BUILD_TIME-only rebuilds are forbidden');
for(const release of ['n','n_plus_1'])if(releases[release].api.runtime_manifest_digest===releases[release].web.runtime_manifest_digest)fail(`${release} API and Web runtime manifests are not distinct`);
const expectedRuntime=releases[runtimeRelease];
if(certification.Image!==expectedRuntime.api.config_digest)fail(`certification runner does not use the inspected ${runtimeRelease} API config`);
if(api.Image!==expectedRuntime.api.config_digest)fail(`runtime API does not use the inspected ${runtimeRelease} API config`);
if(web.Image!==expectedRuntime.web.config_digest)fail(`runtime Web does not use the inspected ${runtimeRelease} Web config`);
if(worker.Image!==expectedRuntime.api.config_digest)fail(`stopped worker does not identify the inspected ${runtimeRelease} API config`);
const snapshot={worker_running:false,provider_execution_enabled:false,championship_execution_enabled:false,scheduler_enabled:false,discovery_enabled:false,provider_network_blocked:true,provider_network_block_mechanism:'container-egress-deny',preview_production_enabled:false,production_target:false,runtime_release:runtimeRelease,releases,probe:{source:'repository-runtime-inspection',git_tree_source:'git-rev-parse-commit-tree',compose_project:'mse-preprod',certification_container:certificationContainerName,certification_image_id:certification.Image,certification_network:networkName,network_internal:true,exclusive_network_attachment:true}};
fs.writeFileSync(output,`${JSON.stringify(snapshot,null,2)}\n`,{encoding:'utf8',mode:0o600});
console.log('F3 runtime safety snapshot captured from inspected state.');
