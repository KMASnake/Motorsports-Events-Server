const digest=/^sha256:[0-9a-f]{64}$/;

export function resolveOciRuntimeIdentity({ref,platform,readRaw,fail}){
  const match=/^(.+)@(sha256:[0-9a-f]{64})$/.exec(ref);
  if(!match)fail(`OCI locator ${ref} is not immutable`);
  if(!/^linux\/[a-z0-9_]+(?:\/[a-z0-9_.-]+)?$/.test(platform))fail(`runtime platform ${platform} is invalid`);
  const [os,architecture,variant]=platform.split('/'),repository=match[1],indexDigest=match[2];
  const parse=(value,label)=>{try{return JSON.parse(value);}catch{fail(`${label} is not valid OCI JSON`);}};
  const exported=parse(readRaw(ref),`OCI export ${ref}`);
  let runtimeManifestDigest;
  if(Array.isArray(exported.manifests)){
    const candidates=exported.manifests.filter(item=>item?.platform?.os===os&&item?.platform?.architecture===architecture&&(variant?item?.platform?.variant===variant:!item?.platform?.variant));
    if(candidates.length!==1||!digest.test(candidates[0]?.digest??''))fail(`OCI export ${ref} does not identify exactly one ${platform} runtime manifest`);
    runtimeManifestDigest=candidates[0].digest;
  }else{
    runtimeManifestDigest=indexDigest;
  }
  const runtimeRef=`${repository}@${runtimeManifestDigest}`;
  const manifest=runtimeManifestDigest===indexDigest&&!Array.isArray(exported.manifests)?exported:parse(readRaw(runtimeRef),`runtime manifest ${runtimeRef}`);
  if(!digest.test(manifest?.config?.digest??'')||!Array.isArray(manifest?.layers)||manifest.layers.length===0||manifest.layers.some(layer=>!digest.test(layer?.digest??'')))fail(`runtime manifest ${runtimeRef} has an invalid executable chain`);
  return {
    oci_provenance:{historical_immutable_ref:ref,historical_index_digest:indexDigest},
    runtime_ref:runtimeRef,
    runtime_manifest_digest:runtimeManifestDigest,
    config_digest:manifest.config.digest,
    layer_digests:manifest.layers.map(layer=>layer.digest)
  };
}
