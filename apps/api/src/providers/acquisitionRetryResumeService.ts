import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
import {pool} from '../lib/db.js';
import {CanonicalAcquisitionPublicationService} from '../normalization/canonicalAcquisitionPublicationService.js';
import {dueAcquisitionRetries,retryHandoffAllowsAcquisition,type RetrySelectionCursor,type DueAcquisitionRetry} from './acquisitionRetryEligibility.js';
import {acquisitionRetryKey,ACQUISITION_RETRY_POLICY} from './acquisitionRetryService.js';
import {DurableAcquisitionOrchestrator} from './acquisitionOrchestrator.js';
import {AcquisitionTransactionService} from './acquisitionTransactionService.js';
import {acquisitionQuotaGate,StrictProviderRequestBudget} from './providerOneShotRunner.js';
import {QuotaCadenceService} from './quotaCadenceService.js';
import {PersistentSchedulerService,systemClock,type Clock} from './schedulerService.js';
import type {ProviderAdapterRegistry} from './registry.js';
import type {AcquiredProviderSourceItem,JsonObject,ProviderAdapter} from './contracts.js';

type RetryContext={providerConfig:JsonObject;sourceConfig:JsonObject;credentials:Readonly<Record<string,string>>;signal?:AbortSignal};
export class AcquisitionRetryResumeService{
  constructor(readonly adapters:ProviderAdapterRegistry,readonly clock:Clock=systemClock,readonly scheduler=new PersistentSchedulerService(clock),readonly quota=new QuotaCadenceService(clock),readonly handoff:Pick<CanonicalAcquisitionPublicationService,'handoffTraversal'>=new CanonicalAcquisitionPublicationService()){}
  private restore(work:DueAcquisitionRetry){
    if(!retryHandoffAllowsAcquisition(work))return null;
    const adapter=this.adapters.get(work.adapter_key);if(!adapter)return null;
    try{const cursor=adapter.restoreCursor(work.cursor,Number(work.cursor_version));return acquisitionRetryKey({cursor,workClass:work.work_class,season:work.season,safeUnitKey:work.safe_unit_key})===work.logical_unit_key?{adapter,cursor}:null;}catch{return null;}
  }
  async selectDuePage(limit=10,after:RetrySelectionCursor|null=null){const candidates=await dueAcquisitionRetries(this.clock.now(),limit,null,pool,false,after);const last=candidates.at(-1);return {units:candidates.filter(work=>this.restore(work)!==null),nextCursor:last?{deadline:last.effective_deadline,id:last.id}:null};}
  async selectDue(limit=10){return (await this.selectDuePage(limit)).units;}
  // Explicit one-unit call only. Credentials are supplied by a trusted caller, never loaded here.
  async resume(id:string,prepare:(work:DueAcquisitionRetry)=>Promise<RetryContext>){
    const connection=new Client(pool.options);let locked=false;
    try{
      await connection.connect();
      locked=(await connection.query('select pg_try_advisory_lock(223,hashtext($1)) acquired',[id])).rows[0].acquired;
      if(!locked)return {status:'busy' as const};
      let work=(await dueAcquisitionRetries(this.clock.now(),1,id))[0];if(!work||!retryHandoffAllowsAcquisition(work))return {status:'not_eligible' as const};
      let restored=this.restore(work);if(!restored)return {status:'identity_unavailable' as const};
      const context=await prepare(work);restored.adapter.validateProviderConfig(context.providerConfig);restored.adapter.validateSourceConfig(context.sourceConfig,{providerConfig:context.providerConfig});
      const workerId='acquisition-retry:'+randomUUID();
      let lease;
      try{lease=await this.scheduler.acquire(workerId,{streamId:work.stream_id,preserveCursor:true,prepare:async client=>{
        // Stream before unit, matching outcome writers; NO KEY UPDATE permits charge FK checks.
        await client.query('select id from sync_streams where id=$1 for no key update',[work.stream_id]);
        await client.query('select id from provider_acquisition_retry_units where id=$1 for update',[id]);
        const selected=(await dueAcquisitionRetries(this.clock.now(),1,id,client))[0];if(!selected||!this.restore(selected))return false;
        work=selected;restored=this.restore(selected)!;
        await client.query("update provider_acquisition_traversals set status='partial' where id=$1 and status='failed' and not complete",[work.traversal_id]);
        await client.query("update sync_streams set state='ready' where id=$1 and state in('error','backoff')",[work.stream_id]);return true;
      }});}catch(error){if((error as Error).message==='retry_activation_unavailable')return {status:'busy' as const};throw error;}
      if(!lease)return {status:'not_eligible' as const};
      const orchestrator=new DurableAcquisitionOrchestrator(this.clock,new AcquisitionTransactionService(this.scheduler,this.clock));
      try{
        const gate=new StrictProviderRequestBudget(ACQUISITION_RETRY_POLICY.maxAttempts,acquisitionQuotaGate(this.quota,work.provider_instance_id,work.stream_id,restored.adapter,work.phase==='current'?'current':work.work_class==='deep_history'?'deep_history':'recent_catchup'));
        const outcome=await orchestrator.executeLease({providerInstanceId:work.provider_instance_id,providerChampionshipId:work.provider_championship_id,season:work.season,lease:{streamId:work.stream_id,runId:lease.run_id,workerId,generation:lease.lease_generation},adapter:restored.adapter as ProviderAdapter<JsonObject,JsonObject,JsonObject,AcquiredProviderSourceItem>,retryTarget:{unitId:id,workClass:work.work_class,season:work.season,safeUnitKey:work.safe_unit_key,resumableTraversalId:work.traversal_id,boundMappingVersionId:work.mapping_version_id},fetchInput:{...context,providerInstanceId:work.provider_instance_id,providerChampionshipId:work.provider_championship_id,championshipId:work.championship_id,signal:context.signal??new AbortController().signal,phase:work.phase,season:work.season,cursor:restored.cursor,requestGate:gate},partialErrorCodes:['quota_deferred','request_budget_exhausted','aborted']});
        const publication=outcome.result.complete?await this.handoff.handoffTraversal(work.traversal_id):null;
        return {status:'completed' as const,retry_unit_id:id,traversal_id:work.traversal_id,outcome,handoff:publication};
      }catch(error){
        // Initialization can fail before executeUnit's normal failure handler releases its lease.
        const active=(await pool.query('select lease_owner from sync_streams where id=$1',[work.stream_id])).rows[0];
        if(active?.lease_owner===workerId)await this.scheduler.fail({streamId:work.stream_id,runId:lease.run_id,workerId,generation:lease.lease_generation,durable:false,code:'retry_activation_failed'});
        throw error;
      }
    }finally{await connection.end();}
  }
}
