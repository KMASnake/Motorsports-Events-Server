import crypto from 'node:crypto';

const digest=/^sha256:[0-9a-f]{64}$/;
const indexTypes=new Set(['application/vnd.oci.image.index.v1+json','application/vnd.docker.distribution.manifest.list.v2+json']);
const manifestTypes=new Set(['application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json']);

export function resolveOciRuntimeIdentity({ref,platform,readRaw,fail}){
  const match=/^(.+)@(sha256:[0-9a-f]{64})$/.exec(ref);
  if(!match)fail(`OCI locator ${ref} is not immutable`);
  if(!/^linux\/[a-z0-9_]+(?:\/[a-z0-9_.-]+)?$/.test(platform))fail(`runtime platform ${platform} is invalid`);
  const [os,architecture,variant]=platform.split('/'),repository=match[1],indexDigest=match[2];
  const parse=(value,expectedDigest,label)=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(value);const actual=`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;if(actual!==expectedDigest)fail(`${label} bytes do not match ${expectedDigest}`);try{return JSON.parse(bytes.toString('utf8'));}catch{fail(`${label} is not valid OCI JSON`);}};
  const exported=parse(readRaw(ref),indexDigest,`OCI export ${ref}`);
  if(exported.schemaVersion!==2)fail(`OCI export ${ref} schemaVersion is unsupported`);
  let runtimeManifestDigest;
  let manifest;
  if(indexTypes.has(exported.mediaType)){
    if(!Array.isArray(exported.manifests))fail(`OCI export ${ref} index descriptors are absent`);
    const candidates=exported.manifests.filter(item=>item?.platform?.os===os&&item?.platform?.architecture===architecture&&(variant?item?.platform?.variant===variant:!item?.platform?.variant));
    if(candidates.length!==1||!digest.test(candidates[0]?.digest??''))fail(`OCI export ${ref} does not identify exactly one ${platform} runtime manifest`);
    runtimeManifestDigest=candidates[0].digest;
    const runtimeRef=`${repository}@${runtimeManifestDigest}`;
    manifest=parse(readRaw(runtimeRef),runtimeManifestDigest,`runtime manifest ${runtimeRef}`);
  }else if(manifestTypes.has(exported.mediaType)){
    runtimeManifestDigest=indexDigest;
    manifest=exported;
  }else fail(`OCI export ${ref} mediaType is unsupported`);
  const runtimeRef=`${repository}@${runtimeManifestDigest}`;
  if(manifest.schemaVersion!==2||!manifestTypes.has(manifest.mediaType))fail(`runtime manifest ${runtimeRef} mediaType/schema is unsupported`);
  if(!digest.test(manifest?.config?.digest??'')||!Array.isArray(manifest?.layers)||manifest.layers.length===0||manifest.layers.some(layer=>!digest.test(layer?.digest??'')))fail(`runtime manifest ${runtimeRef} has an invalid executable chain`);
  return {
    oci_provenance:{historical_immutable_ref:ref,historical_index_digest:indexDigest},
    runtime_ref:runtimeRef,
    runtime_manifest_digest:runtimeManifestDigest,
    config_digest:manifest.config.digest,
    layer_digests:manifest.layers.map(layer=>layer.digest)
  };
}
