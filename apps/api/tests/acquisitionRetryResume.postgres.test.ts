import {randomUUID} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {afterAll,describe,it,expect,vi} from 'vitest';
import {pool} from '../src/lib/db.js';
import {AcquisitionRetryService} from '../src/providers/acquisitionRetryService.js';
import {AcquisitionRetryResumeService} from '../src/providers/acquisitionRetryResumeService.js';
import {ProviderAdapterRegistry} from '../src/providers/registry.js';
import {QuotaCadenceService} from '../src/providers/quotaCadenceService.js';
import {PersistentSchedulerService} from '../src/providers/schedulerService.js';
import {fetchProviderJson} from '../src/providers/providerHttp.js';
import type {AcquiredProviderSourceItem,JsonObject,ProviderAdapter,FetchWorkUnitInput} from '../src/providers/contracts.js';
import type {CanonicalAcquisitionPublicationService} from '../src/normalization/canonicalAcquisitionPublicationService.js';

const suite=describe.skipIf(process.env.RUN_R1_A2_3_RETRY_POSTGRES!=='1');
const context=async()=>({providerConfig:{},sourceConfig:{},credentials:{}});
async function fixture(run:(f:{unit:string;stream:string;traversal:string;provider:string;now:Date;retry:AcquisitionRetryService;service:AcquisitionRetryResumeService;scheduler:PersistentSchedulerService;quota:QuotaCadenceService;fetch:ReturnType<typeof vi.fn>;handoff:ReturnType<typeof vi.fn>;behavior:{status:number;complete:boolean;requests:number;inFetch?:()=>void;beforeFetch?:(input:FetchWorkUnitInput<JsonObject,JsonObject,JsonObject>)=>Promise<void>}})=>Promise<void>){
 const provider=randomUUID(),champ=randomUUID(),link=randomUUID(),stream=randomUUID(),traversal=randomUUID(),now=new Date('2026-01-01T00:00:00Z'),clock={now:()=>now};
 const retry=new AcquisitionRetryService(clock,()=>0),quota=new QuotaCadenceService(clock,()=>0),scheduler=new PersistentSchedulerService(clock);
 const behavior:{status:number;complete:boolean;requests:number;inFetch?:()=>void;beforeFetch?:(input:FetchWorkUnitInput<JsonObject,JsonObject,JsonObject>)=>Promise<void>}={status:200,complete:false,requests:1};
 const fetch=vi.fn(async(input:FetchWorkUnitInput<JsonObject,JsonObject,JsonObject>)=>{await behavior.beforeFetch?.(input);for(let request=0;request<behavior.requests;request++)await fetchProviderJson({url:new URL('https://fixture.test/'),allowedHosts:['fixture.test'],gate:input.requestGate,signal:input.signal,now:()=>now,fetchImpl:vi.fn(async()=>{behavior.inFetch?.();return new Response('{}',{status:behavior.status,headers:{'content-type':'application/json'}});})});return {status:'progress' as const,items:[],itemAnomalies:[],nextCursor:{page:2},requestCount:behavior.requests,complete:behavior.complete,completionReason:null};});
 const adapter:ProviderAdapter<JsonObject,JsonObject,JsonObject,AcquiredProviderSourceItem>={key:'fixture',capabilities:{supportsChampionshipDiscovery:false,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:false},providerConfigVersion:1,sourceConfigVersion:1,cursorVersion:1,providerForm:()=>[],championshipForm:()=>[],validateProviderConfig:()=>({}),validateSourceConfig:()=>({}),initialCursor:()=>({page:1}),validateCursor:v=>v as JsonObject,serializeCursor:v=>v,restoreCursor:v=>({page:1,...v as JsonObject}),fetchWorkUnit:fetch,normalize:()=>({status:'invalid',reason:'synthetic'}) as ReturnType<typeof adapter.normalize>,confirmEmptySeason:async()=>({confirmed:false}) as Awaited<ReturnType<typeof adapter.confirmEmptySeason>>};
 const registry=new ProviderAdapterRegistry();registry.register(adapter);const handoff=vi.fn(async()=>({}));const service=new AcquisitionRetryResumeService(registry,clock,scheduler,quota,{handoffTraversal:handoff} as unknown as Pick<CanonicalAcquisitionPublicationService,'handoffTraversal'>);
 await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config) values($1,'fixture',$2,true,'active','{}')",[provider,'Synthetic retry resume '+provider]);
 try{
 await pool.query("insert into championships(id,slug,name,season,active,sync_enabled) values($1,$2,'Synthetic',2026,true,false)",[champ,'resume-'+champ]);
 await pool.query("insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary) values($1,$2,$3,'synthetic','manual','active',true)",[link,provider,champ]);
 await pool.query("insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,historical_state) values($1,$2,'current','error',1,'{}')",[stream,link]);
 await pool.query("insert into provider_quota_policies(provider_instance_id,minute_limit,minimum_interval_seconds,current_reserve_mode,current_reserve_value,provider_timezone,limits_source) values($1,100,0,'absolute',0,'UTC','configured')",[provider]);
 await pool.query("insert into provider_acquisition_traversals(id,stream_id,lease_generation,work_class,season,safe_unit_key,status) values($1,$2,1,'current_global',2026,'synthetic','failed')",[traversal,stream]);
 const c=await pool.connect();let unit:string;try{unit=await retry.ensure(c,{providerId:provider,streamId:stream,traversalId:traversal,cursor:{page:1},workClass:'current_global',season:2026,safeUnitKey:'synthetic'});}finally{c.release();}
 await pool.query("update provider_acquisition_retry_units set state='retry_wait',next_retry_at=$2 where id=$1",[unit,now]);
 await run({unit,stream,traversal,provider,now,retry,service,scheduler,quota,fetch,handoff,behavior});
 }finally{await pool.query('delete from provider_instances where id=$1',[provider]);await pool.query('delete from championships where id=$1',[champ]);}
}
type ResumeFixture=Parameters<Parameters<typeof fixture>[0]>[0];
async function fixtures(n:number,run:(rows:ResumeFixture[])=>Promise<void>,rows:ResumeFixture[]=[]):Promise<void>{if(!n)return run(rows);await fixture(f=>fixtures(n-1,run,[...rows,f]));}
suite('A2.3 explicitly invoked targeted retry',()=>{
 afterAll(async()=>{await pool.end();});
 it('selects due work deterministically with bounded limit and survives restart',async()=>fixture(async f=>{
 expect((await f.service.selectDue()).map(r=>r.id)).toContain(f.unit);expect((await f.service.selectDue(1))).toHaveLength(1);await expect(f.service.selectDue(101)).rejects.toThrow('limit_invalid');
 const reload=await promisify(execFile)('node',['-e',"const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('select state,next_retry_at from provider_acquisition_retry_units where id=$1',[process.argv[1]]).then(r=>{console.log(JSON.stringify(r.rows[0]));return p.end()})",f.unit]);expect(JSON.parse(reload.stdout).state).toBe('retry_wait');
 }));
 it.each(['succeeded','exhausted','permanent_failure','auth_failure','paused','ready'])('does not select or activate %s',async state=>fixture(async f=>{
 await pool.query('update provider_acquisition_retry_units set state=$2,next_retry_at=null,emitted_attempt_count=$3 where id=$1',[f.unit,state,state==='exhausted'?5:0]);expect(await f.service.selectDue()).toEqual([]);expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');expect(f.fetch).not.toHaveBeenCalled();
 }));
 it.each(['next_retry_at','local_backoff_until','quota_deadline','retry_after_at'])('respects future durable %s',async field=>fixture(async f=>{
 await pool.query(`update provider_acquisition_retry_units set ${field}=$2,retry_after_state='valid' where id=$1`,[f.unit,new Date(f.now.getTime()+60000)]);expect(await f.service.selectDue()).toEqual([]);expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');
 }));
 it.each([false,true])('quota_wait requires known and satisfied deadline, due=%s',async due=>fixture(async f=>{
 await pool.query("update provider_acquisition_retry_units set state='quota_wait',next_retry_at=$2,quota_deadline=$3 where id=$1",[f.unit,due?f.now:null,due?f.now:new Date(f.now.getTime()+60000)]);expect((await f.service.selectDue()).length).toBe(due?1:0);
 }));
 it('preserves stable deadline/id ordering and the requested limit',async()=>fixture(async f=>fixture(async g=>{
 await pool.query('update provider_acquisition_retry_units set next_retry_at=$2 where id=$1',[g.unit,new Date(g.now.getTime()-1000)]);expect((await f.service.selectDue()).map(r=>r.id)).toEqual([g.unit,f.unit]);
 await pool.query('update provider_acquisition_retry_units set next_retry_at=$2 where id=$1',[g.unit,g.now]);const ordered=[f.unit,g.unit].sort();expect((await f.service.selectDue()).map(r=>r.id)).toEqual(ordered);expect((await f.service.selectDue(1)).map(r=>r.id)).toEqual(ordered.slice(0,1));
 })));
 it('resumes exactly one unit through certified accounting without a fresh traversal or budget',async()=>fixture(async f=>{
 expect((await f.service.resume(f.unit,context)).status).toBe('completed');expect(f.fetch).toHaveBeenCalledTimes(1);expect(f.fetch.mock.calls[0][0].cursor).toEqual({page:1});expect(await f.retry.load(f.unit)).toMatchObject({state:'succeeded',emitted_attempt_count:1});expect((await pool.query('select count(*) n from provider_acquisition_traversals where stream_id=$1',[f.stream])).rows[0].n).toBe('1');expect(f.handoff).not.toHaveBeenCalled();
 }));
 it('continues complete acquisition through existing handoff',async()=>fixture(async f=>{f.behavior.complete=true;await f.service.resume(f.unit,context);expect(f.handoff).toHaveBeenCalledExactlyOnceWith(f.traversal);}));
 it('admits only one concurrent consumer',async()=>fixture(async f=>{
 let release!:()=>void;let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);const wait=new Promise<void>(r=>release=r);f.behavior.beforeFetch=async()=>{entered();await wait;};const first=f.service.resume(f.unit,context);await ready;expect((await f.service.resume(f.unit,context)).status).toBe('busy');release();await first;expect(f.fetch).toHaveBeenCalledTimes(1);
 }));
 it.each(['succeeded','exhausted','deadline','budget','reservation','handoff'])('revalidates stale selection after prepare: %s',async change=>fixture(async f=>{
 if(change==='reservation')await pool.query('update provider_acquisition_retry_units set emitted_attempt_count=4 where id=$1',[f.unit]);
 const selected=(await f.service.selectDue())[0];expect(selected.id).toBe(f.unit);
 const prepare=async()=>{if(change==='succeeded'||change==='exhausted')await pool.query('update provider_acquisition_retry_units set state=$2,next_retry_at=null,emitted_attempt_count=$3 where id=$1',[f.unit,change,change==='exhausted'?5:0]);
 else if(change==='deadline')await pool.query('update provider_acquisition_retry_units set next_retry_at=$2 where id=$1',[f.unit,new Date(f.now.getTime()+60000)]);
 else if(change==='budget')await pool.query('update provider_acquisition_retry_units set emitted_attempt_count=5 where id=$1',[f.unit]);
 else if(change==='reservation'){for(let i=0;i<1;i++)expect((await f.quota.authorize(f.provider,'current',f.stream,f.unit)).allowed).toBe(true);}
 else await pool.query('update sync_streams set historical_state=$2::jsonb where id=$1',[f.stream,JSON.stringify({canonical_handoff_v1:{version:1,traversals:{[f.traversal]:{state:'DONE',attempts:1,updated_at:f.now.toISOString(),error_code:null}}}})]);return context();};
 expect((await f.service.resume(f.unit,prepare)).status).toBe('not_eligible');expect(f.fetch).not.toHaveBeenCalled();
 }));
 it.each(['HANDOFF_PENDING','HANDOFF_BACKOFF','HANDOFF_PAUSED','HANDOFF_BLOCKED','DONE','DONE_WITH_REVIEW','ABANDONED'])('blocks handoff ownership %s',async state=>fixture(async f=>{
 await pool.query('update sync_streams set historical_state=$2::jsonb where id=$1',[f.stream,JSON.stringify({canonical_handoff_v1:{version:1,traversals:{[f.traversal]:{state,attempts:1,updated_at:f.now.toISOString(),error_code:null}}}})]);const before=(await pool.query('select historical_state from sync_streams where id=$1',[f.stream])).rows[0];expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');expect(f.fetch).not.toHaveBeenCalled();expect((await pool.query('select historical_state from sync_streams where id=$1',[f.stream])).rows[0]).toEqual(before);
 }));
 it('allows valid ACQUIRING and rejects a superseded cursor',async()=>fixture(async f=>{
 await pool.query('update sync_streams set cursor=$2::jsonb where id=$1',[f.stream,JSON.stringify({page:99})]);expect(await f.service.selectDue()).toEqual([]);expect((await f.service.resume(f.unit,context)).status).toBe('identity_unavailable');expect(f.fetch).not.toHaveBeenCalled();
 }));
 it('preserves local refusal at zero confirmed emissions',async()=>fixture(async f=>{
 await pool.query('update provider_quota_policies set minute_limit=1,safety_margin_percent=0 where provider_instance_id=$1',[f.provider]);await pool.query("insert into provider_quota_windows(provider_instance_id,window_kind,window_started_at,consumed) values($1,'minute',$2,1)",[f.provider,f.now]);await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'quota_deferred'});expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 }));
 it('persists transient emitted outcome once with the same retry identity',async()=>fixture(async f=>{
 f.behavior.status=503;await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'http_503'});expect(await f.retry.load(f.unit)).toMatchObject({state:'retry_wait',emitted_attempt_count:1});expect(await f.service.selectDue()).toEqual([]);
 }));
 it('never admits beyond four confirmed plus one unknown, or five confirmed',async()=>fixture(async f=>{
 await pool.query('update provider_acquisition_retry_units set emitted_attempt_count=4 where id=$1',[f.unit]);expect((await f.quota.authorize(f.provider,'current',f.stream,f.unit)).allowed).toBe(true);expect(await f.service.selectDue()).toEqual([]);expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');expect(f.fetch).not.toHaveBeenCalled();
 }));
 it('logical claim is released on connection loss without state mutation',async()=>fixture(async f=>{
 const c=await pool.connect();await c.query('select pg_advisory_lock(223,hashtext($1))',[f.unit]);expect((await f.service.resume(f.unit,context)).status).toBe('busy');c.release(true);expect((await f.service.resume(f.unit,context)).status).toBe('completed');
 }));
 it('recovers a claimed stream lease before reservation without losing due identity',async()=>fixture(async f=>{
 await pool.query("update sync_streams set state='ready' where id=$1",[f.stream]);await pool.query("update provider_acquisition_traversals set status='partial' where id=$1",[f.traversal]);const lease=await f.scheduler.acquire('crashed-retry',{streamId:f.stream,preserveCursor:true});expect(lease).not.toBeNull();f.now.setTime(f.now.getTime()+121000);await f.scheduler.recover();expect((await f.service.selectDue()).map(r=>r.id)).toContain(f.unit);await f.service.resume(f.unit,context);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(1);
 }));
 it('permits ACQUIRING without changing the A1 envelope schema',async()=>fixture(async f=>{
 await pool.query('update sync_streams set historical_state=$2::jsonb where id=$1',[f.stream,JSON.stringify({canonical_handoff_v1:{version:1,traversals:{[f.traversal]:{state:'ACQUIRING',attempts:0,updated_at:f.now.toISOString(),error_code:null}}}})]);expect((await f.service.resume(f.unit,context)).status).toBe('completed');
 }));
 it('does not acquire another selected unit',async()=>fixture(async f=>fixture(async g=>{
 await f.service.resume(f.unit,context);expect((await g.retry.load(g.unit)).emitted_attempt_count).toBe(0);expect((await pool.query('select status from provider_acquisition_traversals where id=$1',[g.traversal])).rows[0].status).toBe('failed');expect(g.fetch).not.toHaveBeenCalled();
 })));
 it('rechecks terminal handoff after lease claim before provider acquisition',async()=>fixture(async f=>{
 const acquire=f.scheduler.acquire.bind(f.scheduler);vi.spyOn(f.scheduler,'acquire').mockImplementationOnce(async(...args)=>{const result=await acquire(...args);await pool.query('update sync_streams set historical_state=$2::jsonb where id=$1',[f.stream,JSON.stringify({canonical_handoff_v1:{version:1,traversals:{[f.traversal]:{state:'DONE',attempts:1,updated_at:f.now.toISOString(),error_code:null}}}})]);return result;});
 await expect(f.service.resume(f.unit,context)).rejects.toThrow('retry_activation_stale');expect(f.fetch).not.toHaveBeenCalled();expect((await pool.query('select historical_state from sync_streams where id=$1',[f.stream])).rows[0].historical_state.canonical_handoff_v1.traversals[f.traversal].state).toBe('DONE');
 }));
 it('post-emission caller abort is counted with health neutrality',async()=>fixture(async f=>{
 await pool.query('insert into provider_quota_runtime(provider_instance_id,provider_failure_count) values($1,7)',[f.provider]);await pool.query('update sync_streams set stream_failure_count=3 where id=$1',[f.stream]);const controller=new AbortController();f.behavior.inFetch=()=>{controller.abort();throw new DOMException('Synthetic abort','AbortError');};
 await expect(f.service.resume(f.unit,async()=>({...await context(),signal:controller.signal}))).rejects.toMatchObject({code:'aborted'});expect(await f.retry.load(f.unit)).toMatchObject({state:'paused',emitted_attempt_count:1});expect((await pool.query('select provider_failure_count from provider_quota_runtime where provider_instance_id=$1',[f.provider])).rows[0].provider_failure_count).toBe(7);expect((await pool.query('select stream_failure_count from sync_streams where id=$1',[f.stream])).rows[0].stream_failure_count).toBe(3);
 }));
 it('five indeterminate reservations remain unselectable after restart and clock advancement',async()=>fixture(async f=>{
 for(let i=0;i<5;i++)expect((await f.quota.authorize(f.provider,'current',f.stream,f.unit)).allowed).toBe(true);f.now.setTime(f.now.getTime()+86400000);expect(await f.service.selectDue()).toEqual([]);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');
 }));
 it('the fifth successful emitted retry remains succeeded and cannot be selected again',async()=>fixture(async f=>{
 await pool.query('update provider_acquisition_retry_units set emitted_attempt_count=4 where id=$1',[f.unit]);await f.service.resume(f.unit,context);expect(await f.retry.load(f.unit)).toMatchObject({state:'succeeded',emitted_attempt_count:5});expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');expect(f.fetch).toHaveBeenCalledTimes(1);
 }));
 it('transient failure and its due state survive a new service instance without extra budget',async()=>fixture(async f=>{
 f.behavior.status=503;await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'http_503'});f.now.setTime(f.now.getTime()+120000);const service=new AcquisitionRetryResumeService(f.service.adapters,{now:()=>f.now},f.scheduler,f.quota,f.service.handoff);expect((await service.selectDue()).map(r=>r.id)).toContain(f.unit);f.behavior.status=200;await service.resume(f.unit,context);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(2);
 }));

 it('bounded keyset pagination progresses past an unavailable cursor without starving later work',async()=>fixture(async f=>fixture(async g=>{
 await pool.query('update provider_acquisition_retry_units set next_retry_at=$2 where id=$1',[f.unit,new Date(f.now.getTime()-1000)]);await pool.query('update sync_streams set cursor=$2::jsonb where id=$1',[f.stream,JSON.stringify({page:99})]);
 const first=await f.service.selectDuePage(1);expect(first.units).toEqual([]);expect(first.nextCursor).not.toBeNull();const second=await f.service.selectDuePage(1,first.nextCursor);expect(second.units.map(r=>r.id)).toEqual([g.unit]);
 })));

 it('distinct concurrent claims do not exhaust the shared pool and hang activation',async()=>fixtures(12,async rows=>{
 const results=await Promise.all(rows.map(f=>f.service.resume(f.unit,context)));expect(results.some(r=>r.status==='completed')).toBe(true);expect(results.every(r=>['completed','not_eligible','busy'].includes(r.status))).toBe(true);
 }),10000);

 it('process death releases the logical claim before any reservation without losing the unit',async()=>fixture(async f=>{
 const child=spawn('node',['-e',"const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query('select pg_advisory_lock(223,hashtext($1))',[process.argv[1]])).then(()=>console.log('CLAIMED'));",f.unit]);
 const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));
 try{await new Promise<void>((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',()=>resolve());});expect((await f.service.resume(f.unit,context)).status).toBe('busy');expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);}finally{child.kill('SIGKILL');await exited;}
 expect((await f.service.resume(f.unit,context)).status).toBe('completed');expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(1);
 }));

 it('supports an existing multi-request work unit within the same sovereign budget',async()=>fixture(async f=>{
 f.behavior.requests=2;await f.service.resume(f.unit,context);expect(f.fetch).toHaveBeenCalledTimes(1);expect(await f.retry.load(f.unit)).toMatchObject({state:'succeeded',emitted_attempt_count:2});expect((await pool.query('select count(*) n from provider_acquisition_retry_units where stream_id=$1',[f.stream])).rows[0].n).toBe('1');
 }));

 it('claim and a late authoritative outcome finish without a new lock-order deadlock',async()=>fixture(async f=>{
 const d=await f.quota.authorize(f.provider,'current',f.stream,f.unit);expect(d.allowed).toBe(true);
 const results=await Promise.allSettled([f.service.resume(f.unit,context),f.quota.recordOutcome(d.chargeId!,{metadata:{status:503,headers:{}},streamId:f.stream})]);
 expect(results.every(r=>r.status==='fulfilled'||r.reason.code!=='40P01')).toBe(true);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBeLessThanOrEqual(2);
 }));

 it('quota_wait with known due retry but future quota deadline remains blocked',async()=>fixture(async f=>{
 await pool.query("update provider_acquisition_retry_units set state='quota_wait',quota_deadline=$2 where id=$1",[f.unit,new Date(f.now.getTime()+60000)]);expect(await f.service.selectDue()).toEqual([]);expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');
 }));
 it.each(['provider_backoff_until','next_eligible_at'])('respects future provider constraint %s',async field=>fixture(async f=>{
 await pool.query(`insert into provider_quota_runtime(provider_instance_id,${field}) values($1,$2)`,[f.provider,new Date(f.now.getTime()+60000)]);expect(await f.service.selectDue()).toEqual([]);expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');
 }));
 it.each(['stream_backoff_until','next_eligible_at'])('respects future stream constraint %s',async field=>fixture(async f=>{
 await pool.query(`update sync_streams set ${field}=$2 where id=$1`,[f.stream,new Date(f.now.getTime()+60000)]);expect(await f.service.selectDue()).toEqual([]);expect((await f.service.resume(f.unit,context)).status).toBe('not_eligible');
 }));

});
