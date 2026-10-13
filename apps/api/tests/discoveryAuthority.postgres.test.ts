import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
import {afterAll,describe,expect,it} from 'vitest';
import {pool} from '../src/lib/db.js';
import {ProviderDiscoveryService} from '../src/providers/discoveryService.js';
import {PersistentSchedulerService} from '../src/providers/schedulerService.js';
import type {ProviderConfigurationService} from '../src/providers/providerService.js';

const suite=describe.skipIf(process.env.RUN_R1_A2_3_RETRY_POSTGRES!=='1');
type DiscoveredItem={externalChampionshipId:string;name:string;sourceConfig:Record<string,never>;metadata:Record<string,never>};
async function fixture(test:(f:Awaited<ReturnType<typeof setup>>)=>Promise<void>){const f=await setup();try{await test(f);}finally{await f.observer.end();await pool.query('delete from provider_instances where id=$1',[f.id]);}}
async function setup(){
 const id=randomUUID(),item=randomUUID(),worker='synthetic-discovery-'+randomUUID(),now=new Date('2026-01-01T00:00:00Z'),clock={now:()=>new Date(now.getTime())};
 const scheduler=new PersistentSchedulerService(clock),context={principal:{sub:worker,role:'admin' as const,exp:2147483647,auth_method:'technical_hmac' as const},requestId:randomUUID()};
 const behavior:{items:DiscoveredItem[];complete:boolean;fetch?:()=>Promise<void>}={items:[],complete:true};
 const adapter={sourceConfigVersion:1,validateSourceConfig:(value:Record<string,never>)=>value,discoverChampionships:async()=>{await behavior.fetch?.();return {items:behavior.items,complete:behavior.complete};}};
 const facade={get:async()=>({adapter_key:'synthetic-authority',config:{}}),registry:new Map([['synthetic-authority',adapter]]),readSecretForAdapter:async()=>null};
 const service=new ProviderDiscoveryService(facade as unknown as ProviderConfigurationService,undefined,undefined,clock);
 await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config,discovery_enabled,discovery_interval_days) values($1,'synthetic-authority',$2,true,'active','{}',true,7)",[id,'Synthetic discovery '+id]);
 await pool.query("insert into provider_discovered_championships(id,provider_instance_id,external_championship_id,name,proposed_source_config,proposed_source_config_version,proposed_source_config_hash,missing_complete_cycles) values($1,$2,'old','Synthetic old','{}',1,'synthetic',2)",[item,id]);
 const lease=await scheduler.acquireDueDiscovery(worker);if(!lease||lease.id!==id)throw new Error('fixture lease missing');
 const execution={workerId:worker,generation:Number(lease.discovery_lease_generation)},observer=new Client({connectionString:process.env.DATABASE_URL});await observer.connect();
 const read=async()=>({provider:(await observer.query('select discovery_lease_owner,discovery_lease_generation,discovery_lease_expires_at,last_discovery_at,discovery_next_eligible_at from provider_instances where id=$1',[id])).rows[0],items:(await observer.query('select external_championship_id,state,missing_complete_cycles from provider_discovered_championships where provider_instance_id=$1 order by external_championship_id',[id])).rows,runs:(await observer.query('select id,status,is_complete,finished_at,error_code from provider_discovery_runs where provider_instance_id=$1 order by id',[id])).rows});
 const run=()=>service.discover(id,'periodic',context,execution).then(value=>({value}),error=>({error:error as Error&{cause?:Error}}));
 return {id,item,worker,now,clock,scheduler,context,behavior,service,execution,observer,read,run,expiry:new Date(lease.discovery_lease_expires_at).getTime()};
}
async function waitForLock(observer:Client,pid:number,prefix:string){const deadline=Date.now()+5000;while(Date.now()<deadline){const rows=(await observer.query("select query from pg_stat_activity where wait_event_type='Lock' and $1=any(pg_blocking_pids(pid))",[pid])).rows;if(rows.some(row=>row.query.startsWith(prefix)))return;}throw new Error('expected PostgreSQL lock wait: '+prefix);}
function latch(){let release!:()=>void;const wait=new Promise<void>(r=>release=r);return {wait,release};}

suite('P2-17 discovery transactional authority',()=>{
 afterAll(async()=>pool.end());
 it.each([-1,0,1])('revalidates after a blocking write at expiry offset %s and rolls back preceding inserts',async offset=>fixture(async f=>{
  f.behavior.items=[{externalChampionshipId:'fresh',name:'Synthetic fresh',sourceConfig:{},metadata:{}}];
  const locker=await pool.connect();let pending:ReturnType<typeof f.run>|undefined,held=false;
  try{await locker.query('begin');held=true;await locker.query('select id from provider_discovered_championships where id=$1 for update',[f.item]);const pid=(await locker.query('select pg_backend_pid() pid')).rows[0].pid;
   pending=f.run();await waitForLock(f.observer,pid,'update provider_discovered_championships set missing_complete_cycles');const before=await f.read();expect(before.items).toHaveLength(1);expect(before.runs[0].status).toBe('running');
   f.now.setTime(f.expiry+offset);await locker.query('commit');held=false;const result=await pending,after=await f.read();
   if(offset<0){expect(result.value?.status).toBe('completed');expect(after.items).toHaveLength(2);expect(after.items.find(i=>i.external_championship_id==='old')).toMatchObject({state:'not_found',missing_complete_cycles:3});expect(after.provider.last_discovery_at).not.toBeNull();}
   else{expect(result.error?.message).toBe('lease_lost');expect(after).toEqual(before);}
  }finally{if(held)await locker.query('rollback');if(pending)await pending;locker.release();}
 }));
 it('serializes a queued replacement lease with expired finalization rollback',async()=>fixture(async f=>{
  const locker=await pool.connect();let pending:ReturnType<typeof f.run>|undefined,replacement:ReturnType<typeof f.scheduler.acquireDueDiscovery>|undefined,held=false;
  try{await locker.query('begin');held=true;await locker.query('select id from provider_discovered_championships where id=$1 for update',[f.item]);const pid=(await locker.query('select pg_backend_pid() pid')).rows[0].pid;
   pending=f.run();await waitForLock(f.observer,pid,'update provider_discovered_championships set missing_complete_cycles');const before=await f.read();f.now.setTime(f.expiry+1);replacement=f.scheduler.acquireDueDiscovery('replacement-worker');
   const deadline=Date.now()+5000;let queued=false;while(Date.now()<deadline){queued=(await f.observer.query("select 1 from pg_stat_activity where wait_event_type='Lock' and query like 'select singleton from scheduler_configuration%'")).rowCount!>0;if(queued)break;}expect(queued).toBe(true);
   await locker.query('commit');held=false;expect((await pending).error?.message).toBe('lease_lost');const newer=await replacement;expect(newer?.id).toBe(f.id);expect(Number(newer?.discovery_lease_generation)).toBe(f.execution.generation+1);
   const after=await f.read();expect(after.items).toEqual(before.items);expect(after.runs).toEqual(before.runs);expect(after.provider.last_discovery_at).toBeNull();expect(after.provider.discovery_lease_owner).toBe('replacement-worker');
  }finally{if(held)await locker.query('rollback');if(pending)await pending;if(replacement)await replacement;locker.release();}
 }));
 it.each(['new-worker','same-worker'])('rejects old finalization after expired lease recovery: %s',async mode=>fixture(async f=>{
  const entered=latch(),finish=latch();f.behavior.fetch=async()=>{entered.release();await finish.wait;};const pending=f.run();try{await entered.wait;f.now.setTime(f.expiry+1);const newer=await f.scheduler.acquireDueDiscovery(mode==='same-worker'?f.worker:'replacement');expect(Number(newer?.discovery_lease_generation)).toBe(2);const before=await f.read();finish.release();expect((await pending).error?.message).toBe('lease_lost');expect(await f.read()).toEqual(before);}finally{finish.release();await pending;}
 }));
 it('rejects a lease expired while initial run creation waits',async()=>fixture(async f=>{
  const locker=await pool.connect();let pending:ReturnType<typeof f.run>|undefined,held=false;try{await locker.query('begin');held=true;await locker.query('select id from provider_instances where id=$1 for update',[f.id]);const pid=(await locker.query('select pg_backend_pid() pid')).rows[0].pid;pending=f.run();await waitForLock(f.observer,pid,'select discovery_lease_owner');const before=await f.read();f.now.setTime(f.expiry);await locker.query('commit');held=false;expect((await pending).error?.message).toBe('lease_lost');expect(await f.read()).toEqual(before);}finally{if(held)await locker.query('rollback');if(pending)await pending;locker.release();}
 }));
 it.each(['worker','generation','principal','missing'])('rejects invalid identity before any durable run: %s',async mode=>fixture(async f=>{
  const execution=mode==='missing'?undefined:{...f.execution,workerId:mode==='worker'?'wrong':f.worker,generation:mode==='generation'?2:1},context=mode==='principal'?{...f.context,principal:{...f.context.principal,sub:'wrong'}}:f.context;
  const before=await f.read();await expect(f.service.discover(f.id,'periodic',context,execution)).rejects.toThrow('lease_lost');expect(await f.read()).toEqual(before);
 }));
 it('admits only one consumer/finalization per discovery generation',async()=>fixture(async f=>{
  const entered=latch(),finish=latch();let calls=0;f.behavior.fetch=async()=>{calls++;entered.release();await finish.wait;};const first=f.run();try{await entered.wait;const before=await f.read();expect((await f.run()).error?.message).toBe('discovery_run_lost');expect(await f.read()).toEqual(before);finish.release();expect((await first).value?.status).toBe('completed');expect(calls).toBe(1);expect((await f.read()).runs).toHaveLength(1);}finally{finish.release();await first;}
 }));
 it('does not hold database locks across adapter I/O',async()=>fixture(async f=>{
  const entered=latch(),finish=latch();f.behavior.fetch=async()=>{entered.release();await finish.wait;};const pending=f.run();try{await entered.wait;await f.scheduler.heartbeatDiscovery(f.id,f.worker,1);finish.release();expect((await pending).value?.status).toBe('completed');}finally{finish.release();await pending;}
 }));
 it('refuses a run whose durable finalization status changed during adapter I/O',async()=>fixture(async f=>{
  const entered=latch(),finish=latch();f.behavior.fetch=async()=>{entered.release();await finish.wait;};const pending=f.run();try{await entered.wait;await pool.query("update provider_discovery_runs set status='failed' where provider_instance_id=$1",[f.id]);const before=await f.read();finish.release();expect((await pending).error?.message).toBe('discovery_run_lost');expect(await f.read()).toEqual(before);}finally{finish.release();await pending;}
 }));
 it.each([false,true])('rolls back finalization SQL failure; cleanup failure=%s',async cleanupFails=>fixture(async f=>{
  f.behavior.items=[{externalChampionshipId:'fresh',name:'Fresh',sourceConfig:{},metadata:{}}];
  await pool.query("create function p217_fail_finalization() returns trigger language plpgsql as $$ begin if new.last_discovery_at is distinct from old.last_discovery_at then raise exception 'p217_finalization_error'; end if; return new; end $$");
  await pool.query('create trigger p217_fail_finalization before update on provider_instances for each row execute function p217_fail_finalization()');
  if(cleanupFails){await pool.query("create function p217_fail_cleanup() returns trigger language plpgsql as $$ begin if new.status='failed' then raise exception 'p217_cleanup_error'; end if; return new; end $$");await pool.query('create trigger p217_fail_cleanup before update on provider_discovery_runs for each row execute function p217_fail_cleanup()');}
  try{const before=await f.read(),result=await f.run(),after=await f.read();expect(result.error?.message).toContain(cleanupFails?'p217_cleanup_error':'p217_finalization_error');if(cleanupFails)expect(result.error?.cause?.message).toContain('p217_finalization_error');expect(after.items).toEqual(before.items);expect(after.provider).toEqual(before.provider);expect(after.runs[0].status).toBe(cleanupFails?'running':'failed');expect(after.runs[0].is_complete).not.toBe(true);}finally{await pool.query('drop trigger p217_fail_finalization on provider_instances');await pool.query('drop function p217_fail_finalization()');if(cleanupFails){await pool.query('drop trigger p217_fail_cleanup on provider_discovery_runs');await pool.query('drop function p217_fail_cleanup()');}}
 }));
 it('rolls back all outcome writes if SQL skips the final run update',async()=>fixture(async f=>{
  await pool.query("create function p217_skip_run() returns trigger language plpgsql as $$ begin return null; end $$");await pool.query('create trigger p217_skip_run before update on provider_discovery_runs for each row execute function p217_skip_run()');
  try{const result=await f.run(),after=await f.read();expect(result.error?.message).toBe('discovery_run_lost');expect(after.provider.last_discovery_at).toBeNull();expect(after.items[0]).toMatchObject({missing_complete_cycles:2,state:'needs_association'});expect(after.runs[0].status).toBe('running');}finally{await pool.query('drop trigger p217_skip_run on provider_discovery_runs');await pool.query('drop function p217_skip_run()');}
 }));
 it('rolls back an error cleanup whose lease expires during the run-row wait',async()=>fixture(async f=>{
  const entered=latch(),finish=latch();f.behavior.fetch=async()=>{entered.release();await finish.wait;throw new Error('synthetic_adapter_error');};const pending=f.run(),locker=await pool.connect();let held=false;
  try{await entered.wait;const runId=(await f.read()).runs[0].id;await locker.query('begin');held=true;await locker.query('select id from provider_discovery_runs where id=$1 for update',[runId]);const pid=(await locker.query('select pg_backend_pid() pid')).rows[0].pid;finish.release();await waitForLock(f.observer,pid,'select id from provider_discovery_runs');const before=await f.read();f.now.setTime(f.expiry);await locker.query('commit');held=false;const result=await pending;expect(result.error?.message).toBe('lease_lost');expect(result.error?.cause?.message).toBe('synthetic_adapter_error');expect(await f.read()).toEqual(before);}finally{if(held)await locker.query('rollback');finish.release();await pending;locker.release();}
 }));
 it.each([false,true])('guards quota-deferred plan and run together; expired=%s',async expired=>fixture(async f=>{
  f.behavior.fetch=async()=>{if(expired)f.now.setTime(f.expiry);throw Object.assign(new Error('quota'),{code:'quota_deferred',reason:'synthetic',nextEligibleAt:'2026-01-02T00:00:00Z'});};const before=await f.read(),result=await f.run(),after=await f.read();
  if(expired){expect(result.error?.message).toBe('lease_lost');expect(after.provider).toEqual(before.provider);expect(after.runs[0].status).toBe('running');}else{expect(result.value?.status).toBe('deferred_quota');expect(after.provider.discovery_next_eligible_at).toEqual(new Date('2026-01-02T00:00:00Z'));}
 }));
 it.each([true,false])('preserves authorized manual discovery with complete=%s',async complete=>fixture(async f=>{f.behavior.complete=complete;const result=await f.service.discover(f.id,'manual',f.context);expect(result.status).toBe(complete?'completed':'partial');expect(result.is_complete).toBe(complete);expect((await f.read()).provider.discovery_lease_owner).toBe(f.worker);}));
});
