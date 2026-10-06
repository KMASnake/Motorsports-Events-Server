import {describe,expect,it,vi} from 'vitest';
import {ProviderAcquisitionError,type ProviderRequestGate} from '../src/providers/contracts.js';
import {classifyAcquisitionFailure,failureClassification,normalizeRetryAfter,ProviderConfigurationError} from '../src/providers/providerFailure.js';
import {fetchProviderJson,ProviderHttpError,type ProviderFetch} from '../src/providers/providerHttp.js';
import {StrictProviderRequestBudget} from '../src/providers/providerOneShotRunner.js';
import {OcBlackTopAdapter} from '../src/providers/realAdapters.js';

const now=()=>new Date('2026-01-01T00:00:00Z');
const options={url:new URL('https://provider.fixture.test/data'),allowedHosts:['provider.fixture.test'],now};
const gate=():ProviderRequestGate=>({beforeRequest:vi.fn(async()=>({allowed:true,chargeId:'charge-1'})),afterResponse:vi.fn(async()=>undefined),afterError:vi.fn(async()=>undefined)});
async function failure(fetchImpl:ProviderFetch,extra:Partial<Parameters<typeof fetchProviderJson>[0]>={}){
  try{await fetchProviderJson({...options,fetchImpl,...extra});}catch(error){expect(error).toBeInstanceOf(ProviderHttpError);return error as ProviderHttpError;}
  throw new Error('Expected failure');
}

describe('R1-A2.1 HTTP status precedes body parsing',()=>{
  it.each([[400,'HTTP_CLIENT_PERMANENT'],[401,'HTTP_AUTHENTICATION'],[403,'HTTP_AUTHORIZATION'],[404,'HTTP_CLIENT_PERMANENT'],[408,'HTTP_TRANSIENT'],[409,'HTTP_OTHER'],[425,'HTTP_TRANSIENT'],[429,'HTTP_RATE_LIMIT'],[500,'HTTP_TRANSIENT'],[502,'HTTP_TRANSIENT'],[503,'HTTP_TRANSIENT'],[504,'HTTP_TRANSIENT'],[302,'HTTP_OTHER']])('preserves non-JSON HTTP %s as %s',async(status,category)=>{
    const accounting=gate(),fetchImpl=vi.fn(async()=>new Response('<html>error</html>',{status:status as number,headers:{'content-type':'text/html','retry-after':'60'}}));
    const error=await failure(fetchImpl,{gate:accounting});
    expect(error).toMatchObject({code:`http_${status}`,statusCode:status,classification:{category,httpStatus:status,providerResponseReceived:true,headers:{'content-type':'text/html','retry-after':'60'},retryAfterAt:'2026-01-01T00:01:00.000Z'}});
    expect(accounting.afterResponse).toHaveBeenCalledOnce();expect(accounting.afterError).not.toHaveBeenCalled();expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('does not read a failed response body, even if cancellation fails',async()=>{
    const read=vi.fn(()=>{throw new Error('must not read');}),cancel=vi.fn(async()=>{throw new Error('cancel failed');});
    const error=await failure(vi.fn(async()=>({status:503,ok:false,headers:new Headers({'content-type':'text/html','content-length':'9999999'}),body:{getReader:read,cancel}}) as unknown as Response));
    expect(error.classification.category).toBe('HTTP_TRANSIENT');expect(read).not.toHaveBeenCalled();expect(cancel).toHaveBeenCalledOnce();
  });
  it('preserves 429 JSON without requiring its shape',async()=>expect((await failure(vi.fn(async()=>Response.json({error:true},{status:429})))).classification.category).toBe('HTTP_RATE_LIMIT'));
  it('returns successful JSON without an error classification',async()=>expect(await fetchProviderJson({...options,fetchImpl:vi.fn(async()=>Response.json({ok:true}))})).toEqual({ok:true}));
  it.each([['bad','application/json','INVALID_JSON'],['{}','text/plain','INVALID_CONTENT_TYPE']])('classifies successful HTTP with invalid data %s',async(body,type,category)=>{
    const accounting=gate(),error=await failure(vi.fn(async()=>new Response(body,{headers:{'content-type':type}})),{gate:accounting});
    expect(error.classification).toMatchObject({category,httpStatus:200,providerResponseReceived:true});expect(accounting.afterResponse).not.toHaveBeenCalled();expect(accounting.afterError).toHaveBeenCalledOnce();
  });
  it('retains response context on bounded-body rejection',async()=>{
    const error=await failure(vi.fn(async()=>Response.json({large:true})),{maxBytes:2});expect(error.classification).toMatchObject({category:'PAYLOAD_OR_SCHEMA_ERROR',httpStatus:200,providerResponseReceived:true});
  });
  it('exposes only bounded relevant response headers',async()=>{
    const error=await failure(vi.fn(async()=>new Response('error',{status:429,headers:{'retry-after':'60','x-ratelimit-remaining':'0','set-cookie':'secret','authorization':'secret','x-debug':'secret','ratelimit-limit':'x'.repeat(513)}})));
    expect(error.classification.headers).toEqual({'content-type':'text/plain;charset=UTF-8','retry-after':'60','x-ratelimit-remaining':'0'});expect(JSON.stringify(error.classification)).not.toContain('secret');
  });
});

describe('R1-A2.1 Retry-After normalization only',()=>{
  it.each([429,503])('normalizes both seconds and HTTP-date on %s',async status=>{
    for(const value of ['60','Thu, 01 Jan 2026 00:01:00 GMT']){
      const error=await failure(vi.fn(async()=>new Response('upstream error',{status,headers:{'retry-after':value}})));
      expect(error.classification).toMatchObject({retryAfterAt:'2026-01-01T00:01:00.000Z',retryAfterDelayMs:60000,retryAfterState:'valid'});
    }
  });
  it.each(['bad','-1','1.5','99999999999999999999','2026-01-01','Fri, 01 Jan 2026 00:01:00 GMT'])('rejects invalid Retry-After %s',value=>expect(normalizeRetryAfter(value,now())).toEqual({retryAfterAt:null,retryAfterDelayMs:null,retryAfterState:'invalid'}));
  it.each(['0','Wed, 31 Dec 2025 23:59:59 GMT','Thu, 01 Jan 2026 00:00:00 GMT'])('ignores past deadline %s',value=>expect(normalizeRetryAfter(value,now()).retryAfterState).toBe('past'));
  it('handles missing metadata and invalid reference clocks deterministically',()=>{expect(normalizeRetryAfter(undefined,now()).retryAfterState).toBe('missing');expect(normalizeRetryAfter('60',new Date(NaN)).retryAfterState).toBe('invalid');});
  it.each(['bad','Wed, 31 Dec 2025 23:59:59 GMT'])('preserves invalid/past 429 metadata without scheduling %s',async value=>{
    const error=await failure(vi.fn(async()=>new Response('limited',{status:429,headers:{'retry-after':value}})));
    expect(error.classification.retryAfterAt).toBeNull();expect(error.classification.headers['retry-after']).toBe(value);expect(error.classification.retryAfterState).toBe(value==='bad'?'invalid':'past');
  });
});

describe('R1-A2.1 transport evidence',()=>{
  it.each(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','UND_ERR_SOCKET'])('retains Node transport code %s',async code=>{
    const error=await failure(vi.fn(async()=>{throw new TypeError('secret URL',{cause:{code}});}));expect(error.code).toBe('network_error');expect(error.classification).toMatchObject({category:'NETWORK_TRANSIENT',transportCode:code,providerResponseReceived:false,httpStatus:null});expect(error.message).not.toContain('secret');
  });
  it.each(['ETIMEDOUT','ESOCKETTIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'])('classifies runtime timeout %s',async code=>expect((await failure(vi.fn(async()=>{throw Object.assign(new Error('runtime'),{code});}))).classification.category).toBe('TIMEOUT'));
  it.each(['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','ERR_SSL_WRONG_VERSION_NUMBER'])('uses explicit TLS evidence %s',async code=>expect(await failure(vi.fn(async()=>{throw new TypeError('runtime',{cause:{code}});}))).toMatchObject({code:'network_error',classification:{category:'TLS_OR_SECURITY_FAILURE'}}));
  it('does not infer TLS from an arbitrary message',async()=>{const error=await failure(vi.fn(async()=>{throw new Error('certificate error');}));expect(error.classification).toMatchObject({category:'NETWORK_TRANSIENT',retryHint:'unknown',transportCode:null});});
  it('classifies its timeout abort separately from caller cancellation',async()=>{
    const transport:ProviderFetch=vi.fn(async(_url,init)=>new Promise<Response>((_resolve,reject)=>{const abort=()=>reject(new DOMException('aborted','AbortError'));if(init?.signal?.aborted)abort();else init?.signal?.addEventListener('abort',abort,{once:true});}));
    expect((await failure(transport,{timeoutMs:1})).classification.category).toBe('TIMEOUT');
    const caller=new AbortController(),pending=failure(transport,{signal:caller.signal});caller.abort();expect((await pending).classification.category).toBe('CALLER_ABORTED');
  });
  it.each([['ECONNRESET','NETWORK_TRANSIENT'],['Z_DATA_ERROR','PAYLOAD_OR_SCHEMA_ERROR']])('keeps HTTP context for body read/decompression %s',async(code,category)=>{
    const body=new ReadableStream<Uint8Array>({start(controller){controller.error(Object.assign(new Error('read failed'),{code}));}});
    const error=await failure(vi.fn(async()=>new Response(body,{headers:{'content-type':'application/json'}})));expect(error.code).toBe('network_error');expect(error.classification).toMatchObject({category,httpStatus:200,providerResponseReceived:true,transportCode:code});
  });
  it('rejects malformed UTF-8 without disguising it as a network failure',async()=>{const error=await failure(vi.fn(async()=>new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json'}})));expect(error.classification.category).toBe('PAYLOAD_OR_SCHEMA_ERROR');});
});

describe('R1-A2.1 internal callback failures never become network failures',()=>{
  it.each(['callback','accounting'] as const)('retains successful response context after %s failure',async failureDomain=>{
    const delegate=gate();Object.assign(delegate,{failureDomain});delegate.afterResponse=vi.fn(async()=>{throw new Error('sensitive bookkeeping');});
    const budget=new StrictProviderRequestBudget(1,delegate),error=await failure(vi.fn(async()=>Response.json({ok:true})),{gate:budget});
    expect(error.classification).toMatchObject({category:failureDomain==='accounting'?'INTERNAL_ACCOUNTING_ERROR':'INTERNAL_CALLBACK_ERROR',providerResponseReceived:true,httpStatus:200,callbackStage:'afterResponse'});
    expect(delegate.afterResponse).toHaveBeenCalledOnce();expect(delegate.afterError).not.toHaveBeenCalled();expect(budget.emitted).toBe(1);expect(error.message).not.toContain('sensitive');
  });
  it('does not account a failed HTTP response twice',async()=>{
    const delegate=gate();delegate.afterResponse=vi.fn(async()=>{throw new Error('callback');});const error=await failure(vi.fn(async()=>new Response('limited',{status:429,headers:{'retry-after':'60'}})),{gate:delegate});
    expect(error.classification).toMatchObject({category:'INTERNAL_CALLBACK_ERROR',httpStatus:429,retryAfterDelayMs:60000});expect(delegate.afterError).not.toHaveBeenCalled();
  });
  it('isolates afterError failures and does not reenter charge accounting',async()=>{
    const delegate=gate();delegate.afterError=vi.fn(async()=>{throw new Error('callback');});const error=await failure(vi.fn(async()=>{throw Object.assign(new Error('DNS'),{code:'ENOTFOUND'});}),{gate:delegate});
    expect(error.classification).toMatchObject({category:'INTERNAL_CALLBACK_ERROR',callbackStage:'afterError',providerResponseReceived:false});expect(delegate.afterError).toHaveBeenCalledOnce();expect(delegate.afterResponse).not.toHaveBeenCalled();
  });
  it('classifies authorization accounting failures without emitting',async()=>{
    const delegate=gate(),transport=vi.fn();Object.assign(delegate,{failureDomain:'accounting' as const});delegate.beforeRequest=vi.fn(async()=>{throw new Error('db');});
    expect((await failure(transport,{gate:delegate})).classification).toMatchObject({category:'INTERNAL_ACCOUNTING_ERROR',providerResponseReceived:false,callbackStage:'beforeRequest'});expect(transport).not.toHaveBeenCalled();
  });
});

describe('R1-A2.1 adapter classification propagation',()=>{
  const input={providerInstanceId:'fixture',providerChampionshipId:'fixture-link',championshipId:'fixture-canonical',providerConfig:{base_url:'https://api.ocblacktop.com/v1'},credentials:{api_key:'synthetic-only'},sourceConfig:{strategy:'series-events-v1',external_id:'formula1',endpoint_template:'/{series}/events'},phase:'current' as const,season:2026,cursor:{page:1,visited:[]},signal:new AbortController().signal};
  it('retains authoritative HTTP semantics through the adapter',async()=>{
    const adapter=new OcBlackTopAdapter(vi.fn(async()=>new Response('upstream',{status:503,headers:{'retry-after':'60'}})));
    await expect(adapter.fetchWorkUnit(input)).rejects.toMatchObject({classification:{category:'HTTP_TRANSIENT',httpStatus:503,retryAfterDelayMs:60000}});
  });
  it('types missing credentials and invalid source configuration before fetch',async()=>{
    const transport=vi.fn(),adapter=new OcBlackTopAdapter(transport);
    await expect(adapter.fetchWorkUnit({...input,credentials:{}})).rejects.toMatchObject({classification:{category:'CONFIGURATION_ERROR'}});
    await expect(adapter.fetchWorkUnit({...input,sourceConfig:{...input.sourceConfig,strategy:'unknown'}})).rejects.toMatchObject({classification:{category:'CONFIGURATION_ERROR'}});expect(transport).not.toHaveBeenCalled();
  });
  it('keeps payload, configuration and unknown internal errors distinct',()=>{
    expect(classifyAcquisitionFailure(new ProviderAcquisitionError('invalid_payload','Invalid payload')).category).toBe('PAYLOAD_OR_SCHEMA_ERROR');
    expect(classifyAcquisitionFailure(new ProviderConfigurationError('config','Invalid configuration')).category).toBe('CONFIGURATION_ERROR');
    expect(classifyAcquisitionFailure(new Error('internal')).category).toBe('INTERNAL_ERROR');
    expect(failureClassification('http_409',{httpStatus:409}).retryHint).toBe('unknown');
  });
});
