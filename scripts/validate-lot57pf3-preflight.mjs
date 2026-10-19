import fs from 'node:fs';

const fail=message=>{console.error(`F3 preflight refused: ${message}`);process.exit(1);};
const supportedMediaType=value=>['application/vnd.oci.image.index.v1+json','application/vnd.docker.distribution.manifest.list.v2+json','application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json'].includes(value);
const validMaterialization=(locator,media,docker,config)=>{if(!locator||!docker||!supportedMediaType(media)||!/^sha256:[0-9a-f]{64}$/.test(docker.docker_image_id??''))return false;if(docker.descriptor_digest===null||docker.descriptor_media_type===null)return docker.descriptor_digest===null&&docker.descriptor_media_type===null&&docker.docker_image_id===config;return docker.descriptor_digest===locator.locator_index_digest&&docker.descriptor_media_type===media&&docker.docker_image_id===docker.descriptor_digest;};
if(process.argv.length!==4)fail('usage: validate-lot57pf3-preflight.mjs SAFETY-SNAPSHOT.json PROSPECTIVE-BASELINE-N.json');
let input,baseline;
try{input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{fail('invalid safety snapshot');}
try{baseline=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));}catch{fail('invalid prospective baseline');}
if(baseline.schema!=='lot57pf3-prospective-baseline-v2'||baseline.prospective_certification_baseline!==true||baseline.classification!=='prospective-certification-baseline'||baseline.historical_pre_existing_release!==false||baseline.runtime_identity_complete!==true)fail('complete v2 prospective baseline is required; v1 is refused');
if(baseline.provenance?.source!=='repository-runtime-inspection'||baseline.provenance?.git_tree_source!=='git-rev-parse-commit-tree'||baseline.provenance?.compose_project!=='mse-preprod'||baseline.provenance?.certification_container!=='mse-f3-certification-runner'||baseline.provenance?.certification_network!=='mse-f3-certification-internal'||baseline.provenance?.exclusive_network_attachment!==true)fail('prospective baseline provenance is malformed');
if(Number.isNaN(Date.parse(baseline.established_at)))fail('prospective baseline establishment time is invalid');
for(const component of ['api','web']){
  const provenance=baseline.release?.[component]?.oci_provenance,identity=baseline.release?.[component]?.executable_identity,materialization=baseline.release?.[component]?.establishment_materialization;
  if(!provenance||!identity)fail(`baseline ${component} provenance/runtime chain is absent`);
  if(typeof provenance.historical_immutable_ref!=='string'||!/^sha256:[0-9a-f]{64}$/.test(provenance.historical_index_digest??'')||!provenance.historical_immutable_ref.endsWith(`@${provenance.historical_index_digest}`))fail(`baseline ${component} historical OCI provenance is invalid`);
  if(provenance.attestation_digest!==null&&!/^sha256:[0-9a-f]{64}$/.test(provenance.attestation_digest))fail(`baseline ${component} attestation provenance is invalid`);
  if(typeof identity.runtime_ref!=='string'||!/^.+@sha256:[0-9a-f]{64}$/.test(identity.runtime_ref)||!/^sha256:[0-9a-f]{64}$/.test(identity.runtime_manifest_digest??'')||!identity.runtime_ref.endsWith(`@${identity.runtime_manifest_digest}`)||!/^sha256:[0-9a-f]{64}$/.test(identity.config_digest??'')||!Array.isArray(identity.layer_digests)||identity.layer_digests.length===0||identity.layer_digests.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value))||!Array.isArray(identity.rootfs_diff_ids)||identity.rootfs_diff_ids.length===0||identity.rootfs_diff_ids.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value))||!identity.version||!/^[0-9a-f]{40}$/.test(identity.git_sha??'')||!/^[0-9a-f]{40}$/.test(identity.git_tree??'')||Number.isNaN(Date.parse(identity.build_time)))fail(`baseline ${component} executable identity is invalid`);
  if(!materialization?.oci_locator||!/^sha256:[0-9a-f]{64}$/.test(materialization.oci_locator.locator_index_digest??'')||!materialization.oci_locator.locator_ref?.endsWith(`@${materialization.oci_locator.locator_index_digest}`)||!validMaterialization(materialization.oci_locator,materialization.locator_media_type,materialization.docker_materialization,identity.config_digest))fail(`baseline ${component} establishment materialization is invalid`);
}
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
    if(!image.oci_locator||typeof image.oci_locator.locator_ref!=='string'||!/^sha256:[0-9a-f]{64}$/.test(image.oci_locator.locator_index_digest??'')||!image.oci_locator.locator_ref.endsWith(`@${image.oci_locator.locator_index_digest}`))fail(`${release}.${component} local OCI locator is invalid`);
    if(!validMaterialization(image.oci_locator,image.locator_media_type,image.docker_materialization,image.config_digest))fail(`${release}.${component} Docker materialization is invalid`);
    for(const field of ['runtime_ref','runtime_manifest_digest','config_digest','version','git_sha','git_tree','build_time']){
      if(typeof image[field]!=='string'||image[field].trim()===''||image[field].toLowerCase()==='unknown')fail(`${release}.${component}.${field} is absent or unknown`);
    }
    if(!/^[0-9a-f]{40}$/.test(image.git_sha))fail(`${release}.${component}.git_sha is not an exact SHA`);
    if(!/^[0-9a-f]{40}$/.test(image.git_tree))fail(`${release}.${component}.git_tree is not an exact tree identity`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.runtime_manifest_digest))fail(`${release}.${component}.runtime_manifest_digest is not immutable`);
    if(!/^sha256:[0-9a-f]{64}$/.test(image.config_digest))fail(`${release}.${component}.config_digest is not immutable`);
    if(!/@sha256:[0-9a-f]{64}$/.test(image.runtime_ref)||!image.runtime_ref.endsWith(`@${image.runtime_manifest_digest}`))fail(`${release}.${component}.runtime_ref is not exact`);
    if(!Array.isArray(image.layer_digests)||image.layer_digests.length===0||image.layer_digests.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value)))fail(`${release}.${component}.layer_digests is invalid`);
    if(!Array.isArray(image.rootfs_diff_ids)||image.rootfs_diff_ids.length===0||image.rootfs_diff_ids.some(value=>!/^sha256:[0-9a-f]{64}$/.test(value)))fail(`${release}.${component}.rootfs_diff_ids is invalid`);
    if(Number.isNaN(Date.parse(image.build_time)))fail(`${release}.${component}.build_time is invalid`);
  }
  if(value.api.runtime_manifest_digest===value.web.runtime_manifest_digest)fail(`${release} API and Web runtime identities are identical`);
  if(value.api.git_sha!==value.web.git_sha||value.api.version!==value.web.version||value.api.git_tree!==value.web.git_tree)fail(`${release} API/Web release identity is incoherent`);
}
for(const component of ['api','web'])if(input.releases.n[component].runtime_manifest_digest===input.releases.n_plus_1[component].runtime_manifest_digest)fail(`N and N+1 ${component} runtime identities are identical`);
if(input.releases.n.api.git_tree===input.releases.n_plus_1.api.git_tree)fail('N+1 has the same Git tree as N');
if(baseline.release?.git_sha!==input.releases.n.api.git_sha||baseline.release?.git_tree!==input.releases.n.api.git_tree||baseline.release?.version!==input.releases.n.api.version)fail('baseline release identity does not match N');
for(const component of ['api','web']){
  const expected=baseline.release?.[component]?.executable_identity,current=input.releases.n[component];
  for(const field of ['runtime_manifest_digest','config_digest','version','git_sha','git_tree','build_time'])if(expected?.[field]!==current[field])fail(`baseline ${component}.${field} does not match N`);
  if(JSON.stringify(expected?.layer_digests)!==JSON.stringify(current.layer_digests))fail(`baseline ${component}.layer_digests does not match N`);
  if(JSON.stringify(expected?.rootfs_diff_ids)!==JSON.stringify(current.rootfs_diff_ids))fail(`baseline ${component}.rootfs_diff_ids does not match N`);
}
if(baseline.runtime_safety?.championship_execution_enabled!==false)fail('baseline championship execution safety is invalid');
console.log(JSON.stringify({status:'preflight_ok',sanitized:true,provider_calls:0,worker_running:false,production_target:false}));
