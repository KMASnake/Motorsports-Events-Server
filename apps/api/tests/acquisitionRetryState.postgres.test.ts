import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {afterAll,describe,expect,it,vi} from 'vitest';
import {pool} from '../src/lib/db.js';
import {AcquisitionRetryService,retryDisposition} from '../src/providers/acquisitionRetryService.js';
import {QuotaCadenceService} from '../src/providers/quotaCadenceService.js';
import {failureClassification} from '../src/providers/providerFailure.js';
import {fetchProviderJson} from '../src/providers/providerHttp.js';
import {BoundedProviderOneShotRunner,StrictProviderRequestBudget} from '../src/providers/providerOneShotRunner.js';
import type {ProviderConfigurationService} from '../src/providers/providerService.js';
import type {ProviderRequestGate} from '../src/providers/contracts.js';
import {AcquisitionTransactionService} from '../src/providers/acquisitionTransactionService.js';
import {PersistentSchedulerService} from '../src/providers/schedulerService.js';

type Fixture={provider:string;stream:string;link:string;unit:string;traversal:string;retry:AcquisitionRetryService;quota:QuotaCadenceService;now:Date;gate:ProviderRequestGate};
async function fixture(run:(f:Fixture)=>Promise<void>){
 const provider=randomUUID(),champ=randomUUID(),link=randomUUID(),stream=randomUUID(),traversal=randomUUID(),now=new Date('2026-01-01T00:00:00Z');
 const retry=new AcquisitionRetryService({now:()=>now},()=>0),quota=new QuotaCadenceService({now:()=>now},()=>0);
 await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config) values($1,'fixture','Synthetic retry',true,'active','{}')",[provider]);
 try{
 await pool.query("insert into championships(id,slug,name,season,active,sync_enabled) values($1,$2,'Synthetic retry',2026,true,false)",[champ,`retry-${champ}`]);
 await pool.query("insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary) values($1,$2,$3,'synthetic','manual','active',true)",[link,provider,champ]);
 await pool.query("insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,historical_state) values($1,$2,'current','ready',1,'{\"unrelated\":true}')",[stream,link]);
 await pool.query("insert into provider_quota_policies(provider_instance_id,minute_limit,minimum_interval_seconds,current_reserve_mode,current_reserve_value,provider_timezone,limits_source) values($1,100,0,'absolute',0,'UTC','configured')",[provider]);
 await pool.query("insert into provider_acquisition_traversals(id,stream_id,lease_generation,work_class,season,safe_unit_key) values($1,$2,1,'current_global',2026,'synthetic')",[traversal,stream]);
 const client=await pool.connect();let unit:string;try{await client.query('begin');unit=await retry.ensure(client,{providerId:provider,streamId:stream,traversalId:traversal,cursor:{page:1},workClass:'current_global',season:2026,safeUnitKey:'synthetic'});await client.query('commit');}finally{client.release();}
 const runner=new BoundedProviderOneShotRunner({} as ProviderConfigurationService,undefined,undefined,undefined,undefined,quota);
 const gate=(runner as unknown as {quotaGate(p:string,s:string,a:object):ProviderRequestGate}).quotaGate(provider,stream,{});gate.bindAcquisitionRetryUnit!(unit);
 await run({provider,stream,link,unit,traversal,retry,quota,now,gate});
 }finally{await pool.query('delete from provider_instances where id=$1',[provider]);await pool.query('delete from championships where id=$1',[champ]);}
}
const authorize=async(f:Fixture)=>{const d=await f.quota.authorize(f.provider,'current',f.stream,f.unit);expect(d.allowed).toBe(true);return d.chargeId!;};
const failure=async(f:Fixture,charge:string,code='network_error',status?:number,headers:Record<string,string>={})=>f.quota.recordOutcome(charge,{errorCode:code,streamId:f.stream,metadata:status?{status,headers}:undefined});
const advance=(f:Fixture)=>f.now.setTime(f.now.getTime()+7200000);
async function processReload(id:string){const result=await promisify(execFile)('node',['-e',"const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('select emitted_attempt_count,state,next_retry_at from provider_acquisition_retry_units where id=$1',[process.argv[1]]).then(r=>{console.log(JSON.stringify(r.rows[0]));return p.end();}).catch(e=>{console.error(e.code);process.exit(1);});",id]);return JSON.parse(result.stdout);}
const enabled=process.env.RUN_R1_A2_2_RETRY_POSTGRES==='1';
describe.skipIf(!enabled)('A2.2 durable retry on disposable PostgreSQL',()=>{
 afterAll(async()=>{await pool.end();});
 it('counts distinct emitted failures once, survives reload, and preserves the exponential deadline',async()=>fixture(async f=>{
 const first=await authorize(f);await failure(f,first);const state=await f.retry.load(f.unit);expect(state).toMatchObject({emitted_attempt_count:1,state:'retry_wait',next_retry_at:new Date(f.now.getTime()+30000),failure_category:'NETWORK_TRANSIENT',last_charge_id:first});
 await Promise.all([failure(f,first),failure(f,first)]);expect(await f.retry.load(f.unit)).toEqual(state);
 const reload=new AcquisitionRetryService();expect(await reload.load(f.unit)).toEqual(state);expect(await processReload(f.unit)).toEqual({emitted_attempt_count:1,state:'retry_wait',next_retry_at:state.next_retry_at.toISOString()});
 advance(f);const second=await authorize(f);await failure(f,second);expect(await reload.load(f.unit)).toMatchObject({emitted_attempt_count:2,next_retry_at:new Date(f.now.getTime()+60000)});
 }));
 it('persists quota refusal without consuming an emitted attempt',async()=>fixture(async f=>{
 await pool.query('update provider_quota_policies set minute_limit=1,safety_margin_percent=0 where provider_instance_id=$1',[f.provider]);const first=await authorize(f);
 const refusal=await f.quota.authorize(f.provider,'current',f.stream,f.unit);expect(refusal.allowed).toBe(false);expect(await f.retry.load(f.unit)).toMatchObject({emitted_attempt_count:0,state:'quota_wait',next_retry_at:new Date(f.now.getTime()+60000)});await f.quota.markNotEmitted(first);
 }));
 it.each(['already_aborted','aborted_after_authorization'])('does not emit or count pre-emission cancellation: %s',async mode=>fixture(async f=>{
 const signal=new AbortController(),fetchImpl=vi.fn(async()=>Response.json({}));if(mode==='already_aborted')signal.abort();
 if(mode==='aborted_after_authorization'){const original=f.gate.beforeRequest;f.gate.beforeRequest=async()=>{const d=await original();signal.abort();return d;};}
 const budget=new StrictProviderRequestBudget(5,f.gate);await expect(fetchProviderJson({url:new URL('https://fixture.test/'),allowedHosts:['fixture.test'],gate:budget,signal:signal.signal,fetchImpl})).rejects.toMatchObject({code:'aborted'});expect(fetchImpl).not.toHaveBeenCalled();expect(budget.emitted).toBe(0);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 const charges=(await pool.query('select emitted from provider_request_charges where provider_instance_id=$1',[f.provider])).rows;expect(charges.every(c=>c.emitted===false)).toBe(true);
 }));
 it('counts emitted caller abort while preserving prior provider and stream health',async()=>fixture(async f=>{
 await pool.query('insert into provider_quota_runtime(provider_instance_id,provider_failure_count) values($1,7)',[f.provider]);await pool.query("update sync_streams set stream_failure_count=3,last_error_code='prior' where id=$1",[f.stream]);
 const charge=await authorize(f);await failure(f,charge,'aborted',200);expect(await f.retry.load(f.unit)).toMatchObject({emitted_attempt_count:1,state:'paused',next_retry_at:null,failure_category:'CALLER_ABORTED',http_status:200});
 expect((await pool.query('select provider_failure_count from provider_quota_runtime where provider_instance_id=$1',[f.provider])).rows[0].provider_failure_count).toBe(7);expect((await pool.query('select stream_failure_count,last_error_code from sync_streams where id=$1',[f.stream])).rows[0]).toEqual({stream_failure_count:3,last_error_code:'prior'});
 }));
 it.each([[429,'1',60000],[429,'120',120000],[503,'1',30000],[503,'120',120000]])('HTTP %s Retry-After %s respects max constraints',async(status,seconds,delay)=>fixture(async f=>{
 const charge=await authorize(f);await f.quota.recordOutcome(charge,{metadata:{status,headers:{'retry-after':String(seconds)}},streamId:f.stream});expect(await f.retry.load(f.unit)).toMatchObject({state:'retry_wait',http_status:status,next_retry_at:new Date(f.now.getTime()+Number(delay)),emitted_attempt_count:1});
 }));
 it('does not shorten the deadline below an applicable quota constraint',async()=>fixture(async f=>{
 const charge=await authorize(f);await pool.query('update provider_quota_runtime set next_eligible_at=$2 where provider_instance_id=$1',[f.provider,new Date(f.now.getTime()+180000)]);
 await f.quota.recordOutcome(charge,{metadata:{status:429,headers:{'retry-after':'120'}},streamId:f.stream});expect((await f.retry.load(f.unit)).next_retry_at).toEqual(new Date(f.now.getTime()+180000));
 }));
 it('supports deterministic bounded additive jitter',async()=>{
 const now=new Date('2026-01-01Z'),f=failureClassification('timeout');expect(retryDisposition(2,f,now,null,()=>1234).next).toEqual(new Date(now.getTime()+61234));expect(()=>retryDisposition(2,f,now,null,()=>-1)).toThrow('retry_jitter_invalid');
 });
 it('reserves at most five concurrent attempts and exhausts durably without race or duplicate increment',async()=>fixture(async f=>{
 const attempts=await Promise.all(Array.from({length:9},()=>f.quota.authorize(f.provider,'current',f.stream,f.unit)));const allowed=attempts.filter(d=>d.allowed);expect(allowed).toHaveLength(5);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 await Promise.all(allowed.flatMap(d=>[failure(f,d.chargeId!),failure(f,d.chargeId!)]));const exhausted=await new AcquisitionRetryService().load(f.unit);expect(exhausted).toMatchObject({state:'exhausted',emitted_attempt_count:5,next_retry_at:null});expect(await processReload(f.unit)).toEqual({emitted_attempt_count:5,state:'exhausted',next_retry_at:null});advance(f);expect((await f.quota.authorize(f.provider,'current',f.stream,f.unit)).allowed).toBe(false);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(5);
 }));
 it.each([401,403,404,409])('persists non-retryable HTTP %s disposition',async status=>fixture(async f=>{
 const charge=await authorize(f);await f.quota.recordOutcome(charge,{metadata:{status,headers:{}},streamId:f.stream});expect(await f.retry.load(f.unit)).toMatchObject({emitted_attempt_count:1,state:status===401||status===403?'auth_failure':'permanent_failure',next_retry_at:null,http_status:status});
 }));
 it('preserves handoff JSON and stable canonical cursor identity',async()=>fixture(async f=>{
 await pool.query('update sync_streams set historical_state=$2::jsonb where id=$1',[f.stream,JSON.stringify({unrelated:true,canonical_handoff_v1:{version:1,traversals:{[f.traversal]:{state:'HANDOFF_BACKOFF',attempts:2,updated_at:f.now.toISOString(),error_code:'synthetic_handoff_failure'}}}})]);
 const before=(await pool.query('select historical_state from sync_streams where id=$1',[f.stream])).rows[0];const c=await pool.connect();try{const id=await f.retry.ensure(c,{providerId:f.provider,streamId:f.stream,traversalId:f.traversal,cursor:{page:1},workClass:'current_global',season:2026,safeUnitKey:'synthetic'});expect(id).toBe(f.unit);}finally{c.release();}
 await failure(f,await authorize(f));expect((await pool.query('select historical_state from sync_streams where id=$1',[f.stream])).rows[0]).toEqual(before);
 }));
 it('rolls back charge outcome, retry count and health together on retry persistence failure',async()=>fixture(async f=>{
 const charge=await authorize(f);const spy=vi.spyOn(AcquisitionRetryService.prototype,'recordCharge').mockRejectedValueOnce(new Error('injected retry persistence fault'));
 try{await expect(failure(f,charge)).rejects.toThrow('injected retry persistence fault');}finally{spy.mockRestore();}
 expect((await pool.query('select emitted from provider_request_charges where id=$1',[charge])).rows[0].emitted).toBeNull();expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);await failure(f,charge);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(1);
 }));
 it('keeps unresolved reservations across reload and releases only confirmed not-emitted authorizations',async()=>fixture(async f=>{
 const ids=await Promise.all(Array.from({length:5},()=>authorize(f)));expect((await new AcquisitionRetryService().load(f.unit)).emitted_attempt_count).toBe(0);expect((await f.quota.authorize(f.provider,'current',f.stream,f.unit)).allowed).toBe(false);await f.quota.markNotEmitted(ids[0]);expect((await f.quota.authorize(f.provider,'current',f.stream,f.unit)).allowed).toBe(true);
 }));
 it('persists a real acquisition failure through the bound quota gate',async()=>fixture(async f=>{
 // Remove the standalone fixture traversal; executeUnit owns its own traversal.
 const scheduler=new PersistentSchedulerService({now:()=>f.now});const lease=await scheduler.acquire('synthetic-retry',{streamId:f.stream});expect(lease).not.toBeNull();
 const adapter={fetchWorkUnit:async(input:{requestGate:ProviderRequestGate;signal:AbortSignal})=>{await fetchProviderJson({url:new URL('https://fixture.test/'),allowedHosts:['fixture.test'],gate:input.requestGate,signal:input.signal,now:()=>f.now,fetchImpl:vi.fn(async()=>new Response('not json',{status:503,headers:{'retry-after':'120'}}))});}};
 const service=new AcquisitionTransactionService(scheduler,{now:()=>f.now});const input={providerInstanceId:f.provider,providerChampionshipId:f.link,season:2026,workClass:'current_global',safeUnitKey:'integration',lease:{streamId:f.stream,runId:lease!.run_id,workerId:'synthetic-retry',generation:lease!.lease_generation},adapter,fetchInput:{cursor:{page:1},signal:new AbortController().signal,requestGate:f.gate}} as unknown as Parameters<typeof service.executeUnit>[0];
 await expect(service.executeUnit(input)).rejects.toMatchObject({code:'http_503'});const unit=(await pool.query('select * from provider_acquisition_retry_units where stream_id=$1 and traversal_id<>$2',[f.stream,f.traversal])).rows[0];expect(unit).toMatchObject({emitted_attempt_count:1,state:'retry_wait',http_status:503,next_retry_at:new Date(f.now.getTime()+120000)});
 }));
 it('rejects early retry admission without changing durable deadline or count',async()=>fixture(async f=>{
 await failure(f,await authorize(f));const before=await f.retry.load(f.unit);const d=await f.quota.authorize(f.provider,'current',f.stream,f.unit);expect(d).toMatchObject({allowed:false,blocking_reason:'acquisition_retry_not_due'});expect(await f.retry.load(f.unit)).toEqual(before);
 }));
 it('keeps local pause and validation failures at zero emitted attempts',async()=>fixture(async f=>{
 await pool.query("update provider_instances set state='paused' where id=$1",[f.provider]);expect((await f.quota.authorize(f.provider,'current',f.stream,f.unit)).allowed).toBe(false);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 const c=await pool.connect();try{await c.query('begin');await f.retry.recordUnitFailure(c,f.unit,failureClassification('invalid_source_configuration'));await c.query('commit');}finally{c.release();}
 expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 }));
 it('retains terminal failure when an already reserved concurrent request succeeds',async()=>fixture(async f=>{
 const a=await authorize(f),b=await authorize(f);await f.quota.recordOutcome(a,{metadata:{status:404,headers:{}},streamId:f.stream});await f.quota.recordOutcome(b,{metadata:{status:200,headers:{}},streamId:f.stream});expect(await f.retry.load(f.unit)).toMatchObject({state:'permanent_failure',emitted_attempt_count:2,next_retry_at:null,http_status:404});
 }));
 it('refuses rollback while durable units exist without deleting data',async()=>fixture(async f=>{
 const sql=await readFile(new URL('../../../infra/postgres/migrations/0042_acquisition_retry_state.down.sql',import.meta.url),'utf8');const c=await pool.connect();try{await c.query('begin');await expect(c.query(sql)).rejects.toThrow('Cannot remove acquisition retry state');await c.query('rollback');}finally{c.release();}expect(await f.retry.load(f.unit)).not.toBeNull();
 }));

 it('local endpoint validation prevents emission and quota charging',async()=>fixture(async f=>{
 const fetchImpl=vi.fn(async()=>Response.json({}));await expect(fetchProviderJson({url:new URL('https://forbidden.fixture.test/'),allowedHosts:['fixture.test'],gate:f.gate,fetchImpl})).rejects.toMatchObject({code:'unsafe_endpoint'});expect(fetchImpl).not.toHaveBeenCalled();expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');
 }));
 it('local counter callback failure releases authorization before emission',async()=>fixture(async f=>{
 const fetchImpl=vi.fn(async()=>Response.json({}));await expect(fetchProviderJson({url:new URL('https://fixture.test/'),allowedHosts:['fixture.test'],gate:f.gate,fetchImpl,counter:{increment(){throw new Error('synthetic counter error');}}})).rejects.toMatchObject({code:'internal_callback_error'});expect(fetchImpl).not.toHaveBeenCalled();expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);expect((await pool.query('select emitted from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].emitted).toBe(false);
 }));
 it('scheduler lease refusal prevents acquisition before retry reservation',async()=>fixture(async f=>{
 const fetchWorkUnit=vi.fn();const service=new AcquisitionTransactionService();const input={providerInstanceId:f.provider,providerChampionshipId:f.link,season:2026,workClass:'current_global',safeUnitKey:'invalid lease',lease:{streamId:f.stream,runId:randomUUID(),workerId:'not-owner',generation:1},adapter:{fetchWorkUnit},fetchInput:{cursor:{page:1},requestGate:f.gate}} as unknown as Parameters<typeof service.executeUnit>[0];await expect(service.executeUnit(input)).rejects.toThrow('stale_worker');expect(fetchWorkUnit).not.toHaveBeenCalled();expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 }));

 it.each([true,false])('honors exhausted provider observations, known reset=%s',async known=>fixture(async f=>{
 const charge=await authorize(f);const reset=known?new Date(f.now.getTime()+1800000):null;
 await f.quota.recordOutcome(charge,{metadata:{status:503,headers:{'retry-after':'1'}},streamId:f.stream,observation:{windowKind:'hour',limit:100,remaining:0,resetsAt:reset?.toISOString()??null,reliable:true}});
 expect(await f.retry.load(f.unit)).toMatchObject({emitted_attempt_count:1,state:known?'retry_wait':'quota_wait',next_retry_at:reset,failure_category:'HTTP_TRANSIENT'});
 }));
 it('honors minimum cadence and exhausted configured quota windows',async()=>fixture(async f=>{
 await pool.query('update provider_quota_policies set minimum_interval_seconds=3600,minute_limit=1,safety_margin_percent=0 where provider_instance_id=$1',[f.provider]);const charge=await authorize(f);await failure(f,charge,'timeout');expect((await f.retry.load(f.unit)).next_retry_at).toEqual(new Date(f.now.getTime()+3600000));
 }));

 it('serializes linked cancellation/outcome races consistently with the quota ledger',async()=>fixture(async f=>{
 const charge=await authorize(f);await Promise.all([f.quota.markNotEmitted(charge),failure(f,charge)]);const emitted=(await pool.query('select emitted from provider_request_charges where id=$1',[charge])).rows[0].emitted;expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(emitted?1:0);
 }));
 it.each(['success','cursor_invalid','persistence_failure'])('closes the logical acquisition outcome atomically: %s',async kind=>fixture(async f=>{
 const scheduler=new PersistentSchedulerService({now:()=>f.now}),lease=await scheduler.acquire('synthetic-outcome',{streamId:f.stream});expect(lease).not.toBeNull();
 const adapter={fetchWorkUnit:async(input:{requestGate:ProviderRequestGate;signal:AbortSignal})=>{await fetchProviderJson({url:new URL('https://fixture.test/'),allowedHosts:['fixture.test'],gate:input.requestGate,signal:input.signal,fetchImpl:vi.fn(async()=>Response.json({}))});return {status:kind==='cursor_invalid'?'cursor_invalid':'progress',items:[],itemAnomalies:[],nextCursor:{page:2},requestCount:1,complete:false,completionReason:null};}};
 const service=new AcquisitionTransactionService(scheduler,{now:()=>f.now});const input={providerInstanceId:f.provider,providerChampionshipId:f.link,season:2026,workClass:'current_global',safeUnitKey:'outcome',lease:{streamId:f.stream,runId:lease!.run_id,workerId:'synthetic-outcome',generation:lease!.lease_generation},adapter,fetchInput:{cursor:{page:1},signal:new AbortController().signal,requestGate:f.gate},...(kind==='persistence_failure'?{beforeCommit:async()=>{throw new Error('synthetic persistence failure');}}:{})} as unknown as Parameters<typeof service.executeUnit>[0];
 if(kind==='persistence_failure')await expect(service.executeUnit(input)).rejects.toThrow('synthetic persistence failure');else await service.executeUnit(input);
 const unit=(await pool.query('select * from provider_acquisition_retry_units where stream_id=$1 and traversal_id<>$2',[f.stream,f.traversal])).rows[0];expect(unit).toMatchObject({emitted_attempt_count:1,state:kind==='success'?'succeeded':'permanent_failure',next_retry_at:null});if(kind==='cursor_invalid')expect(unit.failure_code).toBe('cursor_invalid');
 }));

});
