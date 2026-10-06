import {randomUUID} from 'node:crypto';
import {afterAll,describe,expect,it,vi} from 'vitest';
import {pool} from '../src/lib/db.js';
import type {ProviderRequestGate} from '../src/providers/contracts.js';
import {fetchProviderJson,type ProviderFetch} from '../src/providers/providerHttp.js';
import {QuotaCadenceService} from '../src/providers/quotaCadenceService.js';
import {BoundedProviderOneShotRunner} from '../src/providers/providerOneShotRunner.js';
import type {ProviderConfigurationService} from '../src/providers/providerService.js';

async function withStreamFixture(run:(fixture:{id:string;stream:string;now:Date;quota:QuotaCadenceService;gate:ProviderRequestGate})=>Promise<void>){
  const id=randomUUID(),championship=randomUUID(),link=randomUUID(),stream=randomUUID(),now=new Date('2026-01-01T00:00:00Z'),quota=new QuotaCadenceService({now:()=>now},()=>0);
  await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config) values($1,'fixture','A2.1 cancellation regression',true,'active','{}')",[id]);
  try{
    await pool.query("insert into provider_quota_policies(provider_instance_id,minute_limit,minimum_interval_seconds,current_reserve_mode,current_reserve_value,provider_timezone,limits_source) values($1,10,0,'absolute',0,'UTC','configured')",[id]);
    await pool.query("insert into championships(id,slug,name,season,active,sync_enabled) values($1,$2,'Synthetic cancellation regression',2026,true,false)",[championship,`a21-${championship}`]);
    await pool.query("insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary) values($1,$2,$3,'synthetic','manual','active',true)",[link,id,championship]);
    await pool.query("insert into sync_streams(id,provider_championship_id,phase,state,cursor_version) values($1,$2,'current','ready',1)",[stream,link]);
    const runner=new BoundedProviderOneShotRunner({} as ProviderConfigurationService,undefined,undefined,undefined,undefined,quota);
    // Exercise the actual one-shot quota bridge without running acquisition or reading credentials.
    const gate=(runner as unknown as {quotaGate(id:string,stream:string,adapter:object):ProviderRequestGate}).quotaGate(id,stream,{});
    await run({id,stream,now,quota,gate});
  }finally{await pool.query('delete from provider_instances where id=$1',[id]);await pool.query('delete from championships where id=$1',[championship]);}
}

async function health(id:string,stream:string){
  const provider=(await pool.query('select provider_failure_count,provider_backoff_until from provider_quota_runtime where provider_instance_id=$1',[id])).rows[0];
  const source=(await pool.query('select stream_failure_count,stream_backoff_until,last_error_code from sync_streams where id=$1',[stream])).rows[0];
  const state=(await pool.query('select state from provider_instances where id=$1',[id])).rows[0].state;
  return {...provider,...source,state};
}

const enabled=process.env.RUN_R1_A2_1_ACCOUNTING_POSTGRES==='1';
describe.skipIf(!enabled)('R1-A2.1 charge-id accounting on disposable PostgreSQL',()=>{
  afterAll(async()=>{await pool.end();});
  it.each(['body_200','before_response','body_200_existing_health'])('keeps caller cancellation neutral with truthful charge accounting: %s',async scenario=>withStreamFixture(async({id,stream,now,quota,gate})=>{
    await pool.query('insert into provider_quota_runtime(provider_instance_id) values($1)',[id]);
    if(scenario==='body_200_existing_health'){
      const previous=new Date(now.getTime()-1000);
      await pool.query('update provider_quota_runtime set provider_failure_count=7,provider_backoff_until=$2 where provider_instance_id=$1',[id,previous]);
      await pool.query("update sync_streams set stream_failure_count=3,stream_backoff_until=$2,last_error_code='previous_failure' where id=$1",[stream,previous]);
    }
    const before=await health(id,stream),caller=new AbortController();
    let bodyReadStarted=false;
    const fetchImpl:ProviderFetch=vi.fn(async(_url,init)=>{
      if(scenario==='before_response'){caller.abort();throw new DOMException('synthetic cancellation','AbortError');}
      const body:ReadableStream<Uint8Array>=new ReadableStream<Uint8Array>({
        start(controller){init?.signal?.addEventListener('abort',()=>controller.error(new DOMException('synthetic cancellation','AbortError')),{once:true});},
        pull(controller){if(body.locked){bodyReadStarted=true;controller.enqueue(new TextEncoder().encode('{'));caller.abort();}}
      });
      return new Response(body,{status:200,headers:{'content-type':'application/json'}});
    });
    const afterError=vi.spyOn(gate,'afterError'),afterResponse=vi.spyOn(gate,'afterResponse');
    await expect(fetchProviderJson({url:new URL('https://provider.fixture.test/cancel'),allowedHosts:['provider.fixture.test'],fetchImpl,gate,signal:caller.signal,now:()=>now})).rejects.toMatchObject({code:'aborted',classification:{category:'CALLER_ABORTED',retryHint:'none',httpStatus:scenario==='before_response'?null:200,providerResponseReceived:scenario!=='before_response'}});
    expect(bodyReadStarted).toBe(scenario!=='before_response');expect(fetchImpl).toHaveBeenCalledOnce();expect(afterError).toHaveBeenCalledOnce();expect(afterResponse).not.toHaveBeenCalled();
    expect(await health(id,stream)).toEqual(before);
    const charges=(await pool.query('select id,emitted,outcome from provider_request_charges where provider_instance_id=$1',[id])).rows;
    expect(charges).toHaveLength(1);expect(charges[0]).toMatchObject({emitted:true,outcome:'aborted'});
    const windows=(await pool.query('select consumed from provider_quota_windows where provider_instance_id=$1',[id])).rows;
    expect(windows).toHaveLength(4);expect(windows.every(row=>Number(row.consumed)===1)).toBe(true);
    // Neither compensating an emitted charge nor replaying its outcome changes accounting/health.
    await quota.markNotEmitted(charges[0].id);await quota.recordOutcome(charges[0].id,{errorCode:'aborted',metadata:{status:200,headers:{}},streamId:stream});
    expect(await health(id,stream)).toEqual(before);
    expect((await pool.query('select emitted,outcome from provider_request_charges where id=$1',[charges[0].id])).rows[0]).toEqual({emitted:true,outcome:'aborted'});
    expect((await pool.query('select consumed from provider_quota_windows where provider_instance_id=$1',[id])).rows.every(row=>Number(row.consumed)===1)).toBe(true);
  }));
  it('keeps body timeout distinct from caller cancellation and penalizes transport failure',async()=>withStreamFixture(async({id,stream,now,gate})=>{
    const fetchImpl:ProviderFetch=vi.fn(async(_url,init)=>new Response(new ReadableStream({start(controller){init?.signal?.addEventListener('abort',()=>controller.error(new DOMException('synthetic timeout','AbortError')),{once:true});}}),{status:200,headers:{'content-type':'application/json'}}));
    await expect(fetchProviderJson({url:new URL('https://provider.fixture.test/timeout'),allowedHosts:['provider.fixture.test'],fetchImpl,gate,timeoutMs:5,now:()=>now})).rejects.toMatchObject({code:'timeout',classification:{category:'TIMEOUT',httpStatus:200,providerResponseReceived:true}});
    expect(await health(id,stream)).toMatchObject({provider_failure_count:1,provider_backoff_until:new Date(now.getTime()+30000),stream_failure_count:0,stream_backoff_until:null,state:'active'});
    expect((await pool.query('select emitted,outcome from provider_request_charges where provider_instance_id=$1',[id])).rows[0]).toEqual({emitted:true,outcome:'timeout'});
  }));
  it.each([429,503])('keeps HTTP %s failure accounting and Retry-After unchanged',async status=>withStreamFixture(async({id,stream,now,gate})=>{
    const fetchImpl:ProviderFetch=vi.fn(async()=>new Response('not JSON',{status,headers:{'content-type':status===503?'text/html':'text/plain','retry-after':'120'}}));
    await expect(fetchProviderJson({url:new URL('https://provider.fixture.test/failure'),allowedHosts:['provider.fixture.test'],fetchImpl,gate,now:()=>now})).rejects.toMatchObject({code:`http_${status}`,classification:{category:status===429?'HTTP_RATE_LIMIT':'HTTP_TRANSIENT',httpStatus:status,retryAfterAt:new Date(now.getTime()+120000).toISOString(),retryAfterDelayMs:120000}});
    expect(await health(id,stream)).toMatchObject({provider_failure_count:1,provider_backoff_until:new Date(now.getTime()+(status===429?120000:30000)),stream_failure_count:0,stream_backoff_until:null});
    expect((await pool.query('select emitted,outcome from provider_request_charges where provider_instance_id=$1',[id])).rows[0]).toEqual({emitted:true,outcome:String(status)});
  }));
  it.each([['bad','application/json','invalid_json'],['{}','text/plain','invalid_content_type']])('keeps successful-response data failure accounting for %s',async(body,type,code)=>withStreamFixture(async({id,stream,now,gate})=>{
    await expect(fetchProviderJson({url:new URL('https://provider.fixture.test/data'),allowedHosts:['provider.fixture.test'],fetchImpl:vi.fn(async()=>new Response(body,{status:200,headers:{'content-type':type}})),gate,now:()=>now})).rejects.toMatchObject({code,classification:{httpStatus:200,providerResponseReceived:true}});
    expect(await health(id,stream)).toMatchObject({provider_failure_count:0,provider_backoff_until:null,stream_failure_count:1,stream_backoff_until:new Date(now.getTime()+300000),last_error_code:code});
  }));
  it('keeps network failure accounting active',async()=>withStreamFixture(async({id,stream,now,gate})=>{
    await expect(fetchProviderJson({url:new URL('https://provider.fixture.test/network'),allowedHosts:['provider.fixture.test'],fetchImpl:vi.fn(async()=>{throw new TypeError('synthetic DNS',{cause:{code:'ENOTFOUND'}});}),gate,now:()=>now})).rejects.toMatchObject({code:'network_error',classification:{category:'NETWORK_TRANSIENT'}});
    expect(await health(id,stream)).toMatchObject({provider_failure_count:1,provider_backoff_until:new Date(now.getTime()+30000),stream_failure_count:0,stream_backoff_until:null});
  }));
  it.each([200,429])('does not double-account HTTP %s when the committed callback subsequently fails',async status=>{
    const id=randomUUID(),now=new Date('2026-01-01T00:00:00Z'),quota=new QuotaCadenceService({now:()=>now},()=>0);
    await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config) values($1,'fixture','A2.1 synthetic accounting',true,'active','{}')",[id]);
    try{
      await pool.query("insert into provider_quota_policies(provider_instance_id,minute_limit,minimum_interval_seconds,current_reserve_mode,current_reserve_value,provider_timezone,limits_source) values($1,10,0,'absolute',0,'UTC','configured')",[id]);
      let chargeId:string|undefined;
      const afterError=vi.fn(async(charge:string,error:{code:string})=>quota.recordOutcome(charge,{errorCode:error.code}));
      const gate:ProviderRequestGate={failureDomain:'accounting',beforeRequest:async()=>{const decision=await quota.authorize(id,'current');chargeId=decision.chargeId;return decision;},afterResponse:async(charge,metadata)=>{await quota.recordOutcome(charge,{metadata});throw new Error('synthetic failure after commit');},afterError};
      const fetchImpl=vi.fn(async()=>Response.json({ok:status===200},{status,headers:{'retry-after':'60'}}));
      await expect(fetchProviderJson({url:new URL('https://provider.fixture.test/data'),allowedHosts:['provider.fixture.test'],fetchImpl,gate,now:()=>now})).rejects.toMatchObject({classification:{category:'INTERNAL_ACCOUNTING_ERROR',httpStatus:status,providerResponseReceived:true}});
      expect(afterError).not.toHaveBeenCalled();expect(fetchImpl).toHaveBeenCalledOnce();expect(chargeId).toBeDefined();
      // Replayed/concurrent late outcomes for the same charge must remain no-ops.
      await Promise.all([quota.recordOutcome(chargeId!,{errorCode:'network_error'}),quota.recordOutcome(chargeId!,{metadata:{status:429,headers:{}}})]);
      const charge=(await pool.query('select emitted,outcome from provider_request_charges where id=$1',[chargeId])).rows[0];
      const runtime=(await pool.query('select provider_failure_count from provider_quota_runtime where provider_instance_id=$1',[id])).rows[0];
      const windows=(await pool.query('select consumed from provider_quota_windows where provider_instance_id=$1',[id])).rows;
      expect(charge).toEqual({emitted:true,outcome:String(status)});expect(Number(runtime.provider_failure_count)).toBe(status===429?1:0);
      expect(windows).toHaveLength(4);expect(windows.every(row=>Number(row.consumed)===1)).toBe(true);
    }finally{await pool.query('delete from provider_instances where id=$1',[id]);}
  });
});
