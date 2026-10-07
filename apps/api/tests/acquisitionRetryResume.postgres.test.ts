import {randomUUID} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {afterAll,describe,it,expect,vi} from 'vitest';
import {pool} from '../src/lib/db.js';
import {Client} from 'pg';
import {failureClassification,ProviderConfigurationError} from '../src/providers/providerFailure.js';
import {AcquisitionRetryService,type RetryExecution} from '../src/providers/acquisitionRetryService.js';
import {AcquisitionRetryResumeService} from '../src/providers/acquisitionRetryResumeService.js';
import type {RetrySelectionCursor} from '../src/providers/acquisitionRetryEligibility.js';
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
 const adapter:ProviderAdapter<JsonObject,JsonObject,JsonObject,AcquiredProviderSourceItem>={key:'fixture',capabilities:{supportsChampionshipDiscovery:false,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:false},providerConfigVersion:1,sourceConfigVersion:1,cursorVersion:1,providerForm:()=>[],championshipForm:()=>[],validateProviderConfig:()=>({}),validateSourceConfig:()=>({}),initialCursor:()=>({page:1}),validateCursor:v=>v as JsonObject,serializeCursor:v=>v,restoreCursor:(v,version)=>{if(version!==1)throw new Error('fixture_cursor_version_invalid');return {page:1,...v as JsonObject};},fetchWorkUnit:fetch,normalize:()=>({status:'invalid',reason:'synthetic'}) as ReturnType<typeof adapter.normalize>,confirmEmptySeason:async()=>({confirmed:false}) as Awaited<ReturnType<typeof adapter.confirmEmptySeason>>};
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

 it('round-trips microsecond ordering keys without duplicates or skips at limit one',async()=>fixtures(4,async rows=>{
 const deadlines=['2025-12-31T23:59:59.000001Z','2025-12-31T23:59:59.000002Z','2025-12-31T23:59:59.000002Z','2025-12-31T23:59:59.000003Z'];
 for(const [index,f] of rows.entries())await pool.query('update provider_acquisition_retry_units set next_retry_at=$2::timestamptz where id=$1',[f.unit,deadlines[index]]);
 const expected=[...rows].sort((a,b)=>deadlines[rows.indexOf(a)].localeCompare(deadlines[rows.indexOf(b)])||a.unit.localeCompare(b.unit)).map(f=>f.unit);
 const seen:string[]=[];let cursor:RetrySelectionCursor|null=null;
 for(let page=0;page<rows.length;page++){
  const result=await rows[0].service.selectDuePage(1,cursor);expect(result.units).toHaveLength(1);expect(result.nextCursor).not.toBeNull();
  const unit=result.units[0];expect(seen).not.toContain(unit.id);seen.push(unit.id);
  expect(result.nextCursor!.deadline).toBe(deadlines[rows.findIndex(f=>f.unit===unit.id)]);
  cursor=JSON.parse(JSON.stringify(result.nextCursor)) as RetrySelectionCursor;
 }
 expect(seen).toEqual(expected);expect((await rows[0].service.selectDuePage(1,cursor)).units).toEqual([]);
 expect((await rows[0].service.selectDuePage(100)).units).toHaveLength(4);await expect(rows[0].service.selectDuePage(0)).rejects.toThrow('retry_selection_limit_invalid');
 }));

 const malformedCursors:unknown[]=[{deadline:null,id:'00000000-0000-0000-0000-000000000000'}, {},{id:'00000000-0000-0000-0000-000000000000'},
 {deadline:'2025-12-31T23:59:59.000001Z'},...['',null,'invalid'].map(id=>({deadline:'2025-12-31T23:59:59.000001Z',id})),
 ...['invalid','2025-02-29T00:00:00.000001Z','2025-13-01T00:00:00.000001Z','2025-01-01T24:00:00.000001Z','2025-01-01T00:00:00.001Z','2025-01-01T00:00:00.000001+00:00','0000-01-01T00:00:00.000001Z'].map(deadline=>({deadline,id:'00000000-0000-0000-0000-000000000000'}))];
 it.each(malformedCursors)('rejects malformed pagination cursor %j without provider work',async cursor=>fixture(async f=>{
 await expect(f.service.selectDuePage(1,cursor as RetrySelectionCursor)).rejects.toThrow('retry_selection_cursor_invalid');expect(f.fetch).not.toHaveBeenCalled();
 expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');
 }));

 it.each(['checkpoint','work_class','season','safe_unit_key','traversal','cursor_version'])('reconstructs current identity after committed claim and blocks changed %s',async change=>fixture(async f=>{
 const acquire=f.scheduler.acquire.bind(f.scheduler);vi.spyOn(f.scheduler,'acquire').mockImplementationOnce(async(...args)=>{
  const lease=await acquire(...args);
  if(change==='checkpoint')await pool.query('update sync_streams set cursor=$2::jsonb where id=$1',[f.stream,JSON.stringify({page:99})]);
  else if(change==='cursor_version')await pool.query('update sync_streams set cursor_version=99 where id=$1',[f.stream]);
  else if(change==='traversal'){const other=randomUUID();await pool.query("insert into provider_acquisition_traversals(id,stream_id,lease_generation,work_class,season,safe_unit_key,status) values($1,$2,1,'current_global',2026,'synthetic','partial')",[other,f.stream]);await pool.query('update provider_acquisition_retry_units set traversal_id=$2 where id=$1',[f.unit,other]);}
  else await pool.query(`update provider_acquisition_traversals set ${change}=$2 where id=$1`,[f.traversal,change==='season'?2025:change==='work_class'?'finalization':'changed']);
  return lease;
 });
 await expect(f.service.resume(f.unit,context)).rejects.toThrow('retry_activation_stale');expect(f.fetch).not.toHaveBeenCalled();
 expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 if(change==='checkpoint')expect((await pool.query('select cursor from sync_streams where id=$1',[f.stream])).rows[0].cursor).toEqual({page:99});
 }));

 it('allows the exact current checkpoint after the lease claim commits',async()=>fixture(async f=>{
 await pool.query('update sync_streams set cursor=$2::jsonb where id=$1',[f.stream,JSON.stringify({page:1})]);
 expect((await f.service.selectDue()).map(r=>r.id)).toContain(f.unit);expect((await f.service.resume(f.unit,context)).status).toBe('completed');
 expect(f.fetch).toHaveBeenCalledTimes(1);expect(f.fetch.mock.calls[0][0].cursor).toEqual({page:1});expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(1);
 }));

 it('waits for a concurrent checkpoint writer then refuses the superseded unit',async()=>fixture(async f=>{
 const writer=await pool.connect(),acquire=f.scheduler.acquire.bind(f.scheduler);let finish!:()=>void;let entered!:()=>void;
 const pending=new Promise<void>(resolve=>entered=resolve),allowCommit=new Promise<void>(resolve=>finish=resolve);
 vi.spyOn(f.scheduler,'acquire').mockImplementationOnce(async(...args)=>{const lease=await acquire(...args);await writer.query('begin');await writer.query('update sync_streams set cursor=$2::jsonb where id=$1',[f.stream,JSON.stringify({page:99})]);entered();return lease;});
 const resume=f.service.resume(f.unit,context);const rejected=expect(resume).rejects.toThrow('retry_activation_stale');
 try{await pending;await vi.waitFor(async()=>{expect((await pool.query("select count(*) n from pg_stat_activity where wait_event_type='Lock' and query like 'select historical_state from sync_streams%'")).rows[0].n).not.toBe('0');},{timeout:2000});expect(f.fetch).not.toHaveBeenCalled();const commit=allowCommit.then(()=>writer.query('commit'));finish();await commit;await rejected;
 expect(f.fetch).not.toHaveBeenCalled();expect((await pool.query('select cursor from sync_streams where id=$1',[f.stream])).rows[0].cursor).toEqual({page:99});
 expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 }finally{await writer.query('rollback');writer.release();}
 }));

 it('rejects superseded checkpoints before claim and after service restart',async()=>fixture(async f=>{
 expect((await f.service.selectDue()).map(r=>r.id)).toContain(f.unit);await pool.query('update sync_streams set cursor=$2::jsonb where id=$1',[f.stream,JSON.stringify({page:99})]);
 const restarted=new AcquisitionRetryResumeService(f.service.adapters,{now:()=>f.now},f.scheduler,f.quota,f.service.handoff);
 expect((await restarted.resume(f.unit,context)).status).toBe('identity_unavailable');expect(f.fetch).not.toHaveBeenCalled();expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 }));

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

 // A2.4-P2-01: actual targeted activation, with no synthetic transport emission.
 const preEmissionCases=[
  {code:'aborted',state:'paused'},
  {code:'provider_credentials_missing',state:'permanent_failure'},
  {code:'http_401',state:'auth_failure'},
  {code:'http_400',state:'permanent_failure'},
  {code:'http_429',state:'retry_wait'},
  {code:'http_503',state:'retry_wait'},
  {code:'timeout',state:'retry_wait'},
  {code:'network_error',state:'retry_wait'},
  {code:'internal_accounting_error',state:'permanent_failure'},
  {code:'internal_callback_error',state:'permanent_failure'},
 ];
 it.each(['retry_wait','quota_wait'])('A2.4 pre-emission abort from %s remains paused after restart',async state=>fixture(async f=>{
  await pool.query('update provider_acquisition_retry_units set state=$2,quota_deadline=$3 where id=$1',[f.unit,state,f.now]);
  const controller=new AbortController();controller.abort();let emissions=0;f.behavior.inFetch=()=>{emissions++;};
  await expect(f.service.resume(f.unit,async()=>({...await context(),signal:controller.signal}))).rejects.toMatchObject({code:'aborted',classification:{category:'CALLER_ABORTED'}});
  expect(emissions).toBe(0);expect(await f.retry.load(f.unit)).toMatchObject({state:'paused',emitted_attempt_count:0,next_retry_at:null});
  expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');
  const restarted=new AcquisitionRetryResumeService(f.service.adapters,{now:()=>f.now},f.scheduler,f.quota,f.service.handoff);
  expect(await restarted.selectDue()).toEqual([]);expect((await restarted.resume(f.unit,context)).status).toBe('not_eligible');
  const freshRetry=new AcquisitionRetryService({now:()=>f.now});expect((await freshRetry.load(f.unit)).state).toBe('paused');
 }));
 it.each(['retry_wait','quota_wait'])('A2.4 pre-emission disposition matrix from %s',async state=>{
  for(const entry of preEmissionCases)await fixture(async f=>{
   await pool.query('update provider_acquisition_retry_units set state=$2,quota_deadline=$3 where id=$1',[f.unit,state,f.now]);
   const failure=entry.code==='provider_credentials_missing'?new ProviderConfigurationError(entry.code,'Synthetic credentials missing'):Object.assign(new Error('Synthetic pre-emission failure'),{code:entry.code,classification:failureClassification(entry.code,{...(/^http_/.test(entry.code)?{httpStatus:Number(entry.code.slice(5))}:{})})});
   f.behavior.beforeFetch=async()=>{throw failure;};let emissions=0;f.behavior.inFetch=()=>{emissions++;};
   await expect(f.service.resume(f.unit,context)).rejects.toBe(failure);
   expect(emissions).toBe(0);expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');
   expect(await f.retry.load(f.unit)).toMatchObject({state:entry.state,emitted_attempt_count:0,failure_code:entry.code});
   const restarted=new AcquisitionRetryResumeService(f.service.adapters,{now:()=>f.now},f.scheduler,f.quota,f.service.handoff);
   expect(await restarted.selectDue()).toEqual([]);expect((await new AcquisitionRetryService({now:()=>f.now}).load(f.unit)).state).toBe(entry.state);
   if(entry.state==='retry_wait')expect(new Date((await f.retry.load(f.unit)).next_retry_at).getTime()).toBeGreaterThan(f.now.getTime());
  });
 });
 async function currentExecution(f:ResumeFixture):Promise<RetryExecution>{
  const row=(await pool.query('select t.run_id,s.lease_owner,s.lease_generation,row_to_json(u)::text outcome_snapshot from provider_acquisition_traversals t join sync_streams s on s.id=t.stream_id join provider_acquisition_retry_units u on u.traversal_id=t.id where u.id=$1',[f.unit])).rows[0];
  return {streamId:f.stream,traversalId:f.traversal,runId:row.run_id,workerId:row.lease_owner,generation:Number(row.lease_generation),outcomeSnapshot:row.outcome_snapshot};
 }
 async function recordFailure(f:ResumeFixture,execution:RetryExecution|undefined,code:string){
  const client=await pool.connect();try{await client.query('begin');await f.retry.recordUnitFailure(client,f.unit,failureClassification(code),execution);await client.query('commit');}catch(error){await client.query('rollback');throw error;}finally{client.release();}
 }
 it.each(['succeeded','exhausted','permanent_failure','auth_failure','paused'])('A2.4 protects terminal %s from late outcomes with and without current context',async state=>fixture(async f=>{
  f.behavior.beforeFetch=async()=>{
   const execution=await currentExecution(f);
   await pool.query('update provider_acquisition_retry_units set state=$2,next_retry_at=null,emitted_attempt_count=$3 where id=$1',[f.unit,state,state==='exhausted'?5:0]);
   const before=await f.retry.load(f.unit);
   for(const code of ['aborted','provider_credentials_missing','network_error']){await recordFailure(f,execution,code);await recordFailure(f,undefined,code);expect(await f.retry.load(f.unit)).toEqual(before);}
   throw new ProviderConfigurationError('provider_credentials_missing','Synthetic');
  };
  await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'provider_credentials_missing'});expect((await f.retry.load(f.unit)).state).toBe(state);
 }));
 it.each(['owner','generation','expired','run','traversal','identity','handoff'])('A2.4 rejects stale %s authority against a newer waiting execution',async change=>fixture(async f=>{
  let checked=false;
  f.behavior.beforeFetch=async()=>{
   const current=await currentExecution(f);const stale={...current};
   if(change==='owner')stale.workerId='old-worker';
   else if(change==='generation')stale.generation--;
   else if(change==='run')stale.runId=randomUUID();
   else if(change==='traversal')stale.traversalId=randomUUID();
   else if(change==='identity')stale.streamId=randomUUID();
   else if(change==='expired')await pool.query('update sync_streams set lease_expires_at=$2 where id=$1',[f.stream,f.now]);
   else await pool.query('update sync_streams set historical_state=$2::jsonb where id=$1',[f.stream,JSON.stringify({canonical_handoff_v1:{version:1,traversals:{[f.traversal]:{state:'HANDOFF_PENDING',attempts:0,updated_at:f.now.toISOString(),error_code:null}}}})]);
   const before=await f.retry.load(f.unit);if(change==='expired')await expect(recordFailure(f,stale,'aborted')).rejects.toThrow('stale_worker');else await recordFailure(f,stale,'aborted');expect(await f.retry.load(f.unit)).toEqual(before);checked=true;
   throw new ProviderConfigurationError('provider_credentials_missing','Synthetic');
  };
  await expect(f.service.resume(f.unit,context)).rejects.toThrow();expect(checked).toBe(true);
 }));
 it.each(['aborted','network_error'])('A2.4 duplicate current %s disposition is idempotent',async code=>fixture(async f=>{
  f.behavior.beforeFetch=async()=>{
   const execution=await currentExecution(f);await recordFailure(f,execution,code);const before=await f.retry.load(f.unit);
   f.now.setTime(f.now.getTime()+1);await recordFailure(f,execution,code);expect(await f.retry.load(f.unit)).toEqual(before);
   throw Object.assign(new Error('Synthetic abort'),{code:'aborted',classification:failureClassification('aborted')});
  };
  await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'aborted'});expect((await f.retry.load(f.unit)).state).toBe(code==='aborted'?'paused':'retry_wait');
 }));
 it('A2.4 preserves a newer authoritative HTTP outcome even against current local configuration failure',async()=>fixture(async f=>{
  f.behavior.beforeFetch=async()=>{
   const execution=await currentExecution(f);const charge=await f.quota.authorize(f.provider,'current',f.stream,f.unit);expect(charge.allowed).toBe(true);
   await f.quota.recordOutcome(charge.chargeId!,{metadata:{status:503,headers:{'retry-after':'120'}},streamId:f.stream});
   const before=await f.retry.load(f.unit);await recordFailure(f,execution,'provider_credentials_missing');expect(await f.retry.load(f.unit)).toEqual(before);
   throw new ProviderConfigurationError('provider_credentials_missing','Synthetic');
  };
  await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'provider_credentials_missing'});
  expect(await f.retry.load(f.unit)).toMatchObject({state:'retry_wait',emitted_attempt_count:1,failure_category:'HTTP_TRANSIENT',retry_after_state:'valid'});
 }));
 it('A2.4 old activated run cannot change a newer run on the same unit',async()=>fixture(async f=>{
  let checked=false;
  f.behavior.beforeFetch=async()=>{
   const old=await currentExecution(f),newRun=randomUUID(),worker='replacement-retry',generation=old.generation+1;
   const client=await pool.connect();try{
    await client.query('begin');await client.query('select id from sync_streams where id=$1 for update',[f.stream]);
    await client.query("update sync_runs set status='interrupted' where id=$1",[old.runId]);
    await client.query("insert into sync_runs(id,stream_id,worker_id,lease_generation,work_class,cursor_before,status,request_id) values($1,$2,$3,$4,'current','{\"page\":1}','running',$5)",[newRun,f.stream,worker,generation,randomUUID()]);
    await client.query('update sync_streams set lease_owner=$2,lease_generation=$3,lease_expires_at=$4 where id=$1',[f.stream,worker,generation,new Date(f.now.getTime()+120000)]);
    await client.query("update provider_acquisition_traversals set run_id=$2,lease_generation=$3,status='running' where id=$1",[f.traversal,newRun,generation]);
    await client.query('commit');
   }catch(error){await client.query('rollback');throw error;}finally{client.release();}
   const before=await f.retry.load(f.unit);await recordFailure(f,old,'aborted');await recordFailure(f,old,'provider_credentials_missing');expect(await f.retry.load(f.unit)).toEqual(before);checked=true;
   throw new ProviderConfigurationError('provider_credentials_missing','Old synthetic execution');
  };
  await expect(f.service.resume(f.unit,context)).rejects.toThrow('stale_worker');expect(checked).toBe(true);expect((await f.retry.load(f.unit)).state).toBe('retry_wait');
  expect((await pool.query('select status from provider_acquisition_traversals where id=$1',[f.traversal])).rows[0].status).toBe('running');
 }));
 it('A2.4 unqualified late waiting failure retains the authoritative deadline',async()=>fixture(async f=>{
  const before=await f.retry.load(f.unit);for(const code of ['aborted','provider_credentials_missing','network_error'])await recordFailure(f,undefined,code);
  expect(await f.retry.load(f.unit)).toEqual(before);
 }));

 const lockWaitCases=['retry_wait','quota_wait'].flatMap(state=>['aborted','provider_credentials_missing'].flatMap(code=>['unit','traversal'].flatMap(lock=>[-1,0,1].map(offset=>({state,code,lock,offset})))));
 it.each(lockWaitCases)('A2.4 P2-02 $state/$code waiting on $lock at expiry offset $offset',async ({state,code,lock,offset})=>fixture(async f=>{
  await pool.query('update provider_acquisition_retry_units set state=$2,quota_deadline=$3 where id=$1',[f.unit,state,f.now]);
  const before=await f.retry.load(f.unit),locker=await pool.connect();let held=false;
  const controller=new AbortController();if(code==='aborted')controller.abort();
  const pid=(await locker.query('select pg_backend_pid() pid')).rows[0].pid;
  f.behavior.beforeFetch=async()=>{
   await locker.query('begin');held=true;
   await locker.query(lock==='unit'?'select id from provider_acquisition_retry_units where id=$1 for update':'select id from provider_acquisition_traversals where id=$1 for update',[lock==='unit'?f.unit:f.traversal]);
   if(code==='provider_credentials_missing')throw new ProviderConfigurationError(code,'Synthetic missing credentials');
  };
  let emissions=0;f.behavior.inFetch=()=>{emissions++;};
  const pending=f.service.resume(f.unit,async()=>({...await context(),signal:controller.signal})).then(value=>({value,error:null}),error=>({value:null,error}));
  try{
   let waiting=false;
   for(let poll=0;poll<200;poll++){
    const rows=(await pool.query("select query from pg_stat_activity where wait_event_type='Lock' and $1=any(pg_blocking_pids(pid))",[pid])).rows;
    if(rows.some(r=>lock==='unit'?String(r.query).startsWith('select u.*,row_to_json(u)::text outcome_snapshot'):String(r.query).startsWith('select t.id from provider_acquisition_traversals'))){waiting=true;break;}
   }
   expect(waiting).toBe(true);
   const expires=new Date((await pool.query('select lease_expires_at from sync_streams where id=$1',[f.stream])).rows[0].lease_expires_at);
   f.now.setTime(expires.getTime()+offset);await locker.query('commit');held=false;
   const result=await pending;
   if(offset>=0){
    expect(result.error).toMatchObject({message:'stale_worker',statusCode:409});expect(await f.retry.load(f.unit)).toEqual(before);
    expect((await pool.query('select status,finished_at from provider_acquisition_traversals where id=$1',[f.traversal])).rows[0]).toEqual({status:'running',finished_at:null});
   }else{
    expect(result.error).toMatchObject({code});expect(await f.retry.load(f.unit)).toMatchObject({state:code==='aborted'?'paused':'permanent_failure',emitted_attempt_count:0});
   }
   expect(emissions).toBe(0);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(before.emitted_attempt_count);
   expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');
  }finally{if(held)await locker.query('rollback');locker.release();await pending;}
 }));
 it('A2.4 P2-02 outcome, duplicate outcome and scheduler recovery retain lock order',async()=>fixture(async f=>{
  let checked=false;f.behavior.beforeFetch=async()=>{
   const e=await currentExecution(f);
   const results=await Promise.allSettled([recordFailure(f,e,'aborted'),recordFailure(f,e,'aborted'),f.scheduler.recover()]);
   expect(results.every(r=>r.status==='fulfilled')).toBe(true);expect((await f.retry.load(f.unit)).state).toBe('paused');checked=true;
   throw Object.assign(new Error('Synthetic abort'),{code:'aborted',classification:failureClassification('aborted')});
  };
  await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'aborted'});expect(checked).toBe(true);
  expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);
 }));
 it('A2.4 P2-02 revalidates at the UPDATE after deadline/policy calculation',async()=>fixture(async f=>{
  let checked=false;f.behavior.beforeFetch=async()=>{
   const e=await currentExecution(f),before=await f.retry.load(f.unit);
   const expires=new Date((await pool.query('select lease_expires_at from sync_streams where id=$1',[f.stream])).rows[0].lease_expires_at);
   const retry=new AcquisitionRetryService({now:()=>f.now},()=>{f.now.setTime(expires.getTime());return 0;});
   const client=await pool.connect();try{
    await client.query('begin');await expect(retry.recordUnitFailure(client,f.unit,failureClassification('network_error'),e)).rejects.toThrow('stale_worker');
    expect((await client.query('select * from provider_acquisition_retry_units where id=$1',[f.unit])).rows[0]).toEqual(before);
   }finally{await client.query('rollback');client.release();}
   checked=true;throw new ProviderConfigurationError('provider_credentials_missing','Synthetic');
  };
  await expect(f.service.resume(f.unit,context)).rejects.toThrow('stale_worker');expect(checked).toBe(true);
  expect((await f.retry.load(f.unit)).state).toBe('retry_wait');
 }));

 // P2-03: preserve the failure transaction through its commit authorization.
 function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};}
 async function dispositionRows(f:ResumeFixture){
  return {unit:await f.retry.load(f.unit),traversal:(await pool.query('select * from provider_acquisition_traversals where id=$1',[f.traversal])).rows[0],anomalies:(await pool.query('select * from provider_acquisition_anomalies where provider_championship_id=(select provider_championship_id from sync_streams where id=$1) order by id',[f.stream])).rows};
 }
 const commitContentionCases=['retry_wait','quota_wait'].flatMap(state=>[false,true].flatMap(existing=>[-1,0,1].map(offset=>({state,existing,offset}))));
 it.each(commitContentionCases)('A2.4 P2-03 legitimate dual-stream anomaly contention from $state existing=$existing at offset $offset',async ({state,existing,offset})=>fixture(async f=>{
  const link=(await pool.query('select provider_championship_id id from sync_streams where id=$1',[f.stream])).rows[0].id;
  const stream=randomUUID(),traversal=randomUUID();
  if(existing)await pool.query("insert into provider_acquisition_anomalies(id,provider_championship_id,anomaly_key,anomaly_type,scope,details,occurrence_count,first_seen_at,last_seen_at) values($1,$2,'stream:acquisition_failed','stream:acquisition_failed','stream','{}',7,$3,$3)",[randomUUID(),link,f.now]);
  await pool.query('update provider_instances set max_concurrency=2 where id=$1',[f.provider]);
  await pool.query("insert into provider_acquisition_state(provider_championship_id,bootstrap_state) values($1,'complete')",[link]);
  await pool.query("insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor,historical_state) values($1,$2,'historical','error',1,'{\"page\":1}','{}')",[stream,link]);
  await pool.query("insert into provider_acquisition_traversals(id,stream_id,lease_generation,work_class,season,safe_unit_key,status) values($1,$2,1,'recent_catchup',2026,'other','failed')",[traversal,stream]);
  const c=await pool.connect();let unit:string;try{unit=await f.retry.ensure(c,{providerId:f.provider,streamId:stream,traversalId:traversal,cursor:{page:1},workClass:'recent_catchup',season:2026,safeUnitKey:'other'});}finally{c.release();}
  await pool.query('update provider_acquisition_retry_units set state=$2,next_retry_at=$3,quota_deadline=$3 where id=any($1::uuid[])',[[f.unit,unit],state,f.now]);
  const entered=[deferred(),deferred()],allow=[deferred(),deferred()],held=deferred(),release=deferred();let activations=0,paused=false;
  f.behavior.beforeFetch=async()=>{const n=activations++;entered[n].resolve();await allow[n].promise;throw new ProviderConfigurationError('provider_credentials_missing','Synthetic');};
  let emissions=0;f.behavior.inFetch=()=>emissions++;
  const original=Client.prototype.query;
  const intercept=vi.spyOn(Client.prototype,'query');
  intercept.mockImplementation(function(this:Client,...args:unknown[]){
   const result=Reflect.apply(original,this,args);
   if(typeof args[0]==='string'&&args[0].startsWith('insert into provider_acquisition_anomalies')&&!paused){paused=true;return Promise.resolve(result).then(async value=>{held.resolve();await release.promise;return value;});}
   return result;
  } as Parameters<typeof intercept.mockImplementation>[0]);
  let first:Promise<unknown>|undefined,second:Promise<unknown>|undefined;
  try{
   first=f.service.resume(f.unit,context).catch(error=>error);await entered[0].promise;
   second=f.service.resume(unit,context).catch(error=>error);await entered[1].promise;
   const before=await dispositionRows(f),otherBefore=(await pool.query('select * from provider_acquisition_retry_units where id=$1',[unit])).rows[0],traversalBefore=(await pool.query('select * from provider_acquisition_traversals where id=$1',[traversal])).rows[0];
   const streamsBefore=(await pool.query('select * from sync_streams where id=any($1::uuid[]) order by id',[[f.stream,stream]])).rows,runsBefore=(await pool.query('select * from sync_runs where stream_id=any($1::uuid[]) order by id',[[f.stream,stream]])).rows;
   allow[0].resolve();await held.promise;allow[1].resolve();
   let blocked=false;for(let poll=0;poll<200;poll++){
    const waiting=(await pool.query("select pg_blocking_pids(pid) blockers from pg_stat_activity where wait_event_type='Lock' and query like 'insert into provider_acquisition_anomalies%'")).rows;
    if(waiting.some(row=>row.blockers.length)){blocked=true;break;}
   }
   expect(blocked).toBe(true);
   const expiry=new Date((await pool.query('select lease_expires_at from sync_streams where id=$1',[stream])).rows[0].lease_expires_at);f.now.setTime(expiry.getTime()+offset);release.resolve();
   const errors=await Promise.all([first,second]);
   if(offset>=0){
    for(const error of errors)expect(error).toMatchObject({message:'stale_worker',statusCode:409});
    expect(await dispositionRows(f)).toEqual(before);
    expect((await pool.query('select * from sync_streams where id=any($1::uuid[]) order by id',[[f.stream,stream]])).rows).toEqual(streamsBefore);expect((await pool.query('select * from sync_runs where stream_id=any($1::uuid[]) order by id',[[f.stream,stream]])).rows).toEqual(runsBefore);
    expect((await pool.query('select * from provider_acquisition_retry_units where id=$1',[unit])).rows[0]).toEqual(otherBefore);
    expect((await pool.query('select * from provider_acquisition_traversals where id=$1',[traversal])).rows[0]).toEqual(traversalBefore);
   }else{
    for(const error of errors)expect(error).toMatchObject({code:'provider_credentials_missing'});
    expect((await f.retry.load(f.unit)).state).toBe('permanent_failure');expect((await f.retry.load(unit)).state).toBe('permanent_failure');
    expect((await dispositionRows(f)).anomalies).toHaveLength(1);expect((await dispositionRows(f)).anomalies[0].occurrence_count).toBe(existing?'9':'2');
   }
   expect(emissions).toBe(0);expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);expect((await f.retry.load(unit)).emitted_attempt_count).toBe(0);
   expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');
  }finally{allow.forEach(item=>item.resolve());release.resolve();await Promise.allSettled([first,second]);intercept.mockRestore();}
 }));
 const partialCommitCases=['retry_wait','quota_wait'].flatMap(state=>[-1,0,1].map(offset=>({state,offset})));
 it.each(partialCommitCases)('A2.4 P2-03 caller abort final scheduler write from $state at offset $offset',async ({state,offset})=>fixture(async f=>{
  await pool.query('update provider_acquisition_retry_units set state=$2,quota_deadline=$3 where id=$1',[f.unit,state,f.now]);
  let before:Awaited<ReturnType<typeof dispositionRows>>|undefined,streamBefore:unknown,runBefore:unknown;f.behavior.beforeFetch=async()=>{before=await dispositionRows(f);streamBefore=(await pool.query('select * from sync_streams where id=$1',[f.stream])).rows[0];runBefore=(await pool.query('select * from sync_runs where stream_id=$1',[f.stream])).rows;};
  const controller=new AbortController();controller.abort();const original=Client.prototype.query;let advanced=false;
  const intercept=vi.spyOn(Client.prototype,'query');intercept.mockImplementation(function(this:Client,...args:unknown[]){
   const result=Reflect.apply(original,this,args);
   if(typeof args[0]==='string'&&args[0].startsWith('update sync_streams set cursor=')&&!advanced){advanced=true;return Promise.resolve(result).then(async value=>{const expiry=new Date((await pool.query('select lease_expires_at from sync_streams where id=$1',[f.stream])).rows[0].lease_expires_at);f.now.setTime(expiry.getTime()+offset);return value;});}
   return result;
  } as Parameters<typeof intercept.mockImplementation>[0]);
  try{
   const error=await f.service.resume(f.unit,async()=>({...await context(),signal:controller.signal})).catch(error=>error);
   expect(advanced).toBe(true);
   if(offset>=0){expect(error).toMatchObject({message:'stale_worker',statusCode:409});expect(await dispositionRows(f)).toEqual(before);expect((await pool.query('select * from sync_streams where id=$1',[f.stream])).rows[0]).toEqual(streamBefore);expect((await pool.query('select * from sync_runs where stream_id=$1',[f.stream])).rows).toEqual(runBefore);}
   else{expect(error).toMatchObject({code:'aborted'});expect((await f.retry.load(f.unit)).state).toBe('paused');expect((await dispositionRows(f)).anomalies).toEqual([]);}
   expect((await f.retry.load(f.unit)).emitted_attempt_count).toBe(0);expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');
  }finally{intercept.mockRestore();}
 }));
 it.each(['before_unit_update','after_unit_update','anomaly_sql_error'])('A2.4 P2-03 SQL failure at %s rolls back all disposition writes',async stage=>fixture(async f=>{
  let before:Awaited<ReturnType<typeof dispositionRows>>|undefined;f.behavior.beforeFetch=async()=>{before=await dispositionRows(f);throw new ProviderConfigurationError('provider_credentials_missing','Synthetic');};
  const original=Client.prototype.query;let injected=false;
  const intercept=vi.spyOn(Client.prototype,'query');intercept.mockImplementation(function(this:Client,...args:unknown[]){
   const sql=args[0];const match=typeof sql==='string'&&(stage==='before_unit_update'?sql.startsWith('update provider_acquisition_retry_units set state='):stage==='after_unit_update'?sql.startsWith("update provider_acquisition_traversals set status='failed'"):sql.startsWith('insert into provider_acquisition_anomalies'));
   if(match&&!injected){injected=true;return Reflect.apply(original,this,['select 1/0']);}return Reflect.apply(original,this,args);
  } as Parameters<typeof intercept.mockImplementation>[0]);
  try{await expect(f.service.resume(f.unit,context)).rejects.toMatchObject({code:'22012'});expect(injected).toBe(true);expect(await dispositionRows(f)).toEqual(before);expect((await pool.query('select count(*) n from provider_request_charges where provider_instance_id=$1',[f.provider])).rows[0].n).toBe('0');}
  finally{intercept.mockRestore();}
 }));

});
