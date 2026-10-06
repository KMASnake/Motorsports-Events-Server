// Classification only. Durable retry decisions belong to the separately governed A2.2.
export type ProviderFailureCategory='HTTP_RATE_LIMIT'|'HTTP_TRANSIENT'|'HTTP_AUTHENTICATION'|'HTTP_AUTHORIZATION'|'HTTP_CLIENT_PERMANENT'|'HTTP_OTHER'|'NETWORK_TRANSIENT'|'TIMEOUT'|'CALLER_ABORTED'|'TLS_OR_SECURITY_FAILURE'|'INVALID_CONTENT_TYPE'|'INVALID_JSON'|'PAYLOAD_OR_SCHEMA_ERROR'|'CONFIGURATION_ERROR'|'INTERNAL_ACCOUNTING_ERROR'|'INTERNAL_CALLBACK_ERROR'|'INTERNAL_ERROR';
export type ProviderRetryHint='transient'|'operator'|'none'|'unknown';
export type RetryAfterState='missing'|'invalid'|'past'|'valid';
export type ProviderFailureClassification={
  code:string;category:ProviderFailureCategory;retryHint:ProviderRetryHint;
  httpStatus:number|null;headers:Readonly<Record<string,string>>;providerResponseReceived:boolean;
  retryAfterAt:string|null;retryAfterDelayMs:number|null;retryAfterState:RetryAfterState;
  transportCode:string|null;callbackStage:string|null;
};

export function normalizeRetryAfter(value:string|undefined,now:Date){
  const empty={retryAfterAt:null,retryAfterDelayMs:null};
  if(value===undefined)return {...empty,retryAfterState:'missing' as const};
  const text=value.trim(),reference=now.getTime();let deadline:number;
  if(/^\d+$/.test(text)){
    const seconds=Number(text);deadline=reference+seconds*1000;
    if(!Number.isSafeInteger(seconds)||!Number.isSafeInteger(deadline))return {...empty,retryAfterState:'invalid' as const};
  }else{
    // IMF-fixdate, without permissive Date.parse coercion of integers or local dates.
    if(!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text))return {...empty,retryAfterState:'invalid' as const};
    deadline=Date.parse(text);
    if(!Number.isFinite(deadline)||new Date(deadline).toUTCString()!==text)return {...empty,retryAfterState:'invalid' as const};
  }
  if(!Number.isFinite(reference)||!Number.isFinite(new Date(deadline).getTime()))return {...empty,retryAfterState:'invalid' as const};
  if(deadline<=reference)return {...empty,retryAfterState:'past' as const};
  return {retryAfterAt:new Date(deadline).toISOString(),retryAfterDelayMs:deadline-reference,retryAfterState:'valid' as const};
}

export function relevantProviderHeaders(headers:Headers):Readonly<Record<string,string>>{
  const selected:Record<string,string>={};
  for(const key of ['retry-after','content-type','content-length','date','ratelimit-limit','ratelimit-remaining','ratelimit-reset','x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','x-rate-limit-limit','x-rate-limit-remaining','x-rate-limit-reset']){
    const value=headers.get(key);if(value!==null&&value.length<=512&&!Array.from(value).some(character => character.charCodeAt(0) < 32))selected[key]=value;
  }
  return selected;
}

export function httpFailureCategory(status:number):ProviderFailureCategory{
  if(status===429)return 'HTTP_RATE_LIMIT';
  if(status===401)return 'HTTP_AUTHENTICATION';
  if(status===403)return 'HTTP_AUTHORIZATION';
  if(status===408||status===425||(status>=500&&status<=599))return 'HTTP_TRANSIENT';
  if(status===409)return 'HTTP_OTHER';
  if(status>=400&&status<500)return 'HTTP_CLIENT_PERMANENT';
  return 'HTTP_OTHER';
}

export function failureClassification(code:string,context:Partial<ProviderFailureClassification>={}):ProviderFailureClassification{
  const categories:Record<string,ProviderFailureCategory>={timeout:'TIMEOUT',aborted:'CALLER_ABORTED',network_error:'NETWORK_TRANSIENT',tls_error:'TLS_OR_SECURITY_FAILURE',unsafe_endpoint:'TLS_OR_SECURITY_FAILURE',invalid_content_type:'INVALID_CONTENT_TYPE',invalid_json:'INVALID_JSON',response_too_large:'PAYLOAD_OR_SCHEMA_ERROR',invalid_content_encoding:'PAYLOAD_OR_SCHEMA_ERROR',internal_accounting_error:'INTERNAL_ACCOUNTING_ERROR',internal_callback_error:'INTERNAL_CALLBACK_ERROR',internal_error:'INTERNAL_ERROR',invalid_source_configuration:'CONFIGURATION_ERROR',provider_credentials_missing:'CONFIGURATION_ERROR'};
  const category=context.category??(context.httpStatus&&/^http_\d+$/.test(code)?httpFailureCategory(context.httpStatus):categories[code]??'INTERNAL_ERROR');
  const retryHint:ProviderRetryHint=['HTTP_RATE_LIMIT','HTTP_TRANSIENT','TIMEOUT'].includes(category)?'transient':category==='CALLER_ABORTED'?'none':['NETWORK_TRANSIENT','HTTP_OTHER'].includes(category)?'unknown':'operator';
  return {code,category,retryHint,httpStatus:null,headers:{},providerResponseReceived:false,retryAfterAt:null,retryAfterDelayMs:null,retryAfterState:'missing',transportCode:null,callbackStage:null,...context};
}

export class ProviderConfigurationError extends Error{
  readonly classification:ProviderFailureClassification;
  constructor(readonly code:string,message:string){super(message);this.classification=failureClassification(code,{category:'CONFIGURATION_ERROR'});}
}

export function classifyAcquisitionFailure(error:unknown):ProviderFailureClassification{
  const structured=error as {classification?:ProviderFailureClassification;anomaly?:{code:string};code?:string};
  if(structured?.classification)return structured.classification;
  if(structured?.anomaly?.code)return failureClassification(structured.anomaly.code,{category:'PAYLOAD_OR_SCHEMA_ERROR'});
  return failureClassification('internal_error');
}

export function transportFailure(error:unknown,callerAborted:boolean,timedOut:boolean,bodyRead=false){
  const value=error as {name?:string;code?:string;cause?:{code?:string}};
  const runtimeCode=typeof value?.cause?.code==='string'?value.cause.code:typeof value?.code==='string'?value.code:null;
  const tls=new Set(['CERT_HAS_EXPIRED','CERT_NOT_YET_VALID','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID','ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED','ERR_SSL_WRONG_VERSION_NUMBER']);
  const timeouts=new Set(['ETIMEDOUT','ESOCKETTIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT']);
  const code=callerAborted?'aborted':timedOut||value?.name==='AbortError'||timeouts.has(runtimeCode??'')?'timeout':'network_error';
  // Keep legacy transport codes consumed by quota accounting; category supplies the finer evidence.
  const category:ProviderFailureCategory=code==='aborted'?'CALLER_ABORTED':code==='timeout'?'TIMEOUT':tls.has(runtimeCode??'')?'TLS_OR_SECURITY_FAILURE':bodyRead&&runtimeCode==='Z_DATA_ERROR'?'PAYLOAD_OR_SCHEMA_ERROR':'NETWORK_TRANSIENT';
  // Do not retain arbitrary runtime messages, URLs, credentials or error causes.
  return {code,category,transportCode:runtimeCode&&/^[A-Z0-9_]{1,80}$/.test(runtimeCode)?runtimeCode:null};
}
