import {randomUUID} from 'node:crypto';
import {pool} from '../lib/db.js';
import {CanonicalAcquisitionPublicationService} from '../normalization/canonicalAcquisitionPublicationService.js';
import {PostgresNormalizationMappingRepository} from '../normalization/postgresNormalizationMappingRepository.js';
import type {AcquiredProviderSourceItem,JsonObject,ProviderAdapter,ProviderRequestGate,ProviderResponseMetadata} from './contracts.js';
import {DurableAcquisitionOrchestrator,currentPrioritySequence} from './acquisitionOrchestrator.js';
import {ProviderConfigurationService} from './providerService.js';
import {QuotaCadenceService} from './quotaCadenceService.js';
import type {RegisteredProviderAdapter} from './registry.js';
import {PersistentSchedulerService} from './schedulerService.js';

export type OneShotStatus='preflight_ok'|'completed'|'budget_exhausted'|'cancelled'|'busy'|'configuration_invalid'|'provider_error'|'handoff_error';
export type OneShotTarget={providerInstanceId:string;providerChampionshipId:string;streamId:string;maxProviderRequests:number;preflight:boolean};

type PreflightRow={provider_instance_id:string;adapter_key:string;provider_enabled:boolean;provider_state:string;provider_config:JsonObject;provider_championship_id:string;championship_id:string;external_championship_id:string;sync_state:string;source_config:JsonObject;source_strategy:string|null;stream_id:string;phase:string;stream_state:string;cursor:JsonObject;cursor_version:number;lease_owner:string|null;lease_expires_at:Date|null;mapping_version_id:string|null;credential_present:boolean;quota_configuration:JsonObject|null};

export class StrictProviderRequestBudget implements ProviderRequestGate{
  private count=0;
  private stopped=false;
  constructor(readonly limit:number,private readonly delegate:ProviderRequestGate){if(!Number.isSafeInteger(limit)||limit<=0)throw new Error('max_provider_requests_invalid');}
  get emitted(){return this.count;}
  get remaining(){return this.limit-this.count;}
  stop(){this.stopped=true;}
  async beforeRequest(){if(this.stopped)return {allowed:false,reason:'request_cancelled'};if(this.count>=this.limit)return {allowed:false,reason:'request_budget_exhausted'};this.count+=1;let decision:Awaited<ReturnType<ProviderRequestGate['beforeRequest']>>;try{decision=await this.delegate.beforeRequest();}catch(error){this.count-=1;throw error;}if(!decision.allowed){this.count-=1;return decision;}if(this.stopped){this.count-=1;if(decision.chargeId)await this.delegate.cancelAuthorization?.(decision.chargeId);return {allowed:false,reason:'request_cancelled'};}return decision;}
  afterResponse(chargeId:string,response:ProviderResponseMetadata){return this.delegate.afterResponse(chargeId,response);}
  afterError(chargeId:string,error:{code:string;statusCode?:number}){return this.delegate.afterError(chargeId,error);}
}

const requestCounter=()=>{let value=0;return {increment(){value+=1;},get value(){return value;}};};
const safeError=(error:unknown)=>({code:String((error as {code?:string;anomaly?:{code?:string}}).code??(error as {anomaly?:{code?:string}}).anomaly?.code??'runner_failed'),message:String((error as Error).message??'runner_failed').replace(/https?:\/\/\S+/g,'[URL redacted]').slice(0,300)});

export class BoundedProviderOneShotRunner{
  constructor(
    readonly providers:ProviderConfigurationService,
    readonly scheduler=new PersistentSchedulerService(),
    readonly orchestrator=new DurableAcquisitionOrchestrator(),
    readonly handoff=new CanonicalAcquisitionPublicationService(),
    readonly mappings=new PostgresNormalizationMappingRepository(),
    readonly quota=new QuotaCadenceService()
  ){}

  async preflight(target:OneShotTarget){
    const row=(await pool.query<PreflightRow>(`select p.id provider_instance_id,p.adapter_key,p.enabled provider_enabled,p.state provider_state,p.config provider_config,
      pc.id provider_championship_id,pc.championship_id,pc.external_championship_id,pc.sync_state,sc.config source_config,sc.config->>'strategy' source_strategy,
      s.id stream_id,s.phase,s.state stream_state,s.cursor,s.cursor_version,s.lease_owner,s.lease_expires_at,
      active.mapping_version_id,exists(select 1 from provider_secrets secret where secret.provider_instance_id=p.id and secret.secret_name='api_key') credential_present,
      to_jsonb(quota.*) quota_configuration
      from provider_instances p join provider_championships pc on pc.provider_instance_id=p.id
      join provider_championship_source_configs sc on sc.provider_championship_id=pc.id join sync_streams s on s.provider_championship_id=pc.id
      left join provider_championship_active_normalization_mappings active on active.provider_championship_id=pc.id
      left join provider_quota_policies quota on quota.provider_instance_id=p.id
      where p.id=$1 and pc.id=$2 and s.id=$3`,[target.providerInstanceId,target.providerChampionshipId,target.streamId])).rows[0];
    if(!row)return {status:'configuration_invalid' as const,reason:'exact_target_not_found',provider_requests_budget:target.maxProviderRequests,provider_requests_emitted:0,provider_requests_remaining:target.maxProviderRequests,PROVIDER_CALLS:0};
    const adapter=this.providers.registry.get(row.adapter_key);let runtimeMappingIdentity:string|null=null,sourceValid=false;
    try{sourceValid=Boolean(adapter?.validateSourceConfig(row.source_config,{providerConfig:row.provider_config}));if(row.mapping_version_id)runtimeMappingIdentity=(await this.mappings.resolveMappingConfig(row.mapping_version_id)).version;}catch{/* reported as invalid */}
    const valid=Boolean(adapter)&&sourceValid&&row.provider_enabled&&row.provider_state==='active'&&row.sync_state==='active'&&row.phase==='current'&&['ready','pending','running'].includes(row.stream_state)&&Boolean(row.mapping_version_id)&&row.credential_present;
    return {status:valid?'preflight_ok' as const:'configuration_invalid' as const,provider_instance_id:row.provider_instance_id,adapter_key:row.adapter_key,provider_enabled:row.provider_enabled,provider_state:row.provider_state,provider_championship_id:row.provider_championship_id,canonical_championship_id:row.championship_id,external_championship_id:row.external_championship_id,source_strategy:row.source_strategy,stream_id:row.stream_id,stream_phase:row.phase,stream_state:row.stream_state,active_mapping_uuid:row.mapping_version_id,runtime_mapping_identity:runtimeMappingIdentity,credential_present:row.credential_present,quota_configuration:row.quota_configuration,active_lease:{owned:row.lease_owner!==null,owner:row.lease_owner,expires_at:row.lease_expires_at?.toISOString()??null},requested_max_provider_requests:target.maxProviderRequests,publication_control:{preview_api_enabled:process.env.PREVIEW_API_ENABLED==='true'},provider_requests_budget:target.maxProviderRequests,provider_requests_emitted:0,provider_requests_remaining:target.maxProviderRequests,PROVIDER_CALLS:0};
  }

  private quotaGate(providerId:string,streamId:string,adapter:RegisteredProviderAdapter):ProviderRequestGate{return {beforeRequest:async()=>{const decision=await this.quota.authorize(providerId,'current',streamId);return {allowed:decision.allowed,chargeId:decision.chargeId,nextEligibleAt:decision.next_eligible_at,reason:decision.blocking_reason};},afterResponse:(chargeId,response)=>this.quota.recordOutcome(chargeId,{metadata:response,observation:adapter.observeQuota?.(response)??null,streamId}),afterError:(chargeId,error)=>this.quota.recordOutcome(chargeId,{metadata:error.statusCode?{status:error.statusCode,headers:{}}:undefined,errorCode:error.code,streamId}),cancelAuthorization:chargeId=>this.quota.markNotEmitted(chargeId)};}

  async run(target:OneShotTarget,signal?:AbortSignal){
    const report=await this.preflight(target);if(target.preflight||report.status!=='preflight_ok')return report;
    const adapter=this.providers.registry.get(report.adapter_key)!;const acquisitionAdapter=adapter as ProviderAdapter<JsonObject,JsonObject,JsonObject,AcquiredProviderSourceItem>;const apiKey=await this.providers.readSecretForAdapter(target.providerInstanceId,'api_key');if(!apiKey)return {...report,status:'configuration_invalid' as const,reason:'credential_missing'};
    const budget=new StrictProviderRequestBudget(target.maxProviderRequests,this.quotaGate(target.providerInstanceId,target.streamId,adapter));const counter=requestCounter();const abort=()=>budget.stop();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)budget.stop();
    const workerId=`provider-once:${process.pid}:${randomUUID()}`;let traversalId:string|undefined;let pagesCompleted=0;let cursor=report.status==='preflight_ok'?(await pool.query<{cursor:JsonObject;cursor_version:number}>('select cursor,cursor_version from sync_streams where id=$1',[target.streamId])).rows[0]!:null;
    try{
      while(true){
        if(signal?.aborted||budget.remaining===0){if(traversalId)await pool.query("update provider_acquisition_traversals set status='partial',complete=false,finished_at=now() where id=$1 and complete=false",[traversalId]);return {status:signal?.aborted?'cancelled' as const:'budget_exhausted' as const,traversal_id:traversalId??null,provider_championship_id:target.providerChampionshipId,stream_id:target.streamId,provider_requests_budget:budget.limit,provider_requests_emitted:budget.emitted,provider_requests_remaining:budget.remaining,pages_completed:pagesCompleted,next_page_or_cursor:cursor?.cursor??null};}
        const acquired=await this.scheduler.acquire(workerId,{streamId:target.streamId});if(!acquired)return {status:'busy' as const,provider_championship_id:target.providerChampionshipId,stream_id:target.streamId,provider_requests_budget:budget.limit,provider_requests_emitted:budget.emitted,provider_requests_remaining:budget.remaining,pages_completed:pagesCompleted};
        cursor={cursor:acquired.stream.cursor,cursor_version:Number(acquired.stream.cursor_version)};
        try{
          const outcome=await this.orchestrator.executeLease({providerInstanceId:target.providerInstanceId,providerChampionshipId:target.providerChampionshipId,season:new Date().getUTCFullYear(),dispatchCounter:currentPrioritySequence.indexOf('current_global'),lease:{streamId:target.streamId,runId:acquired.run_id,workerId,generation:acquired.lease_generation},adapter:acquisitionAdapter,fetchInput:{providerInstanceId:target.providerInstanceId,providerChampionshipId:target.providerChampionshipId,championshipId:report.canonical_championship_id,providerConfig:(await this.providers.get(target.providerInstanceId))!.config,credentials:{api_key:apiKey},sourceConfig:(await pool.query<{config:JsonObject}>('select config from provider_championship_source_configs where provider_championship_id=$1',[target.providerChampionshipId])).rows[0]!.config,phase:'current',season:new Date().getUTCFullYear(),cursor:acquisitionAdapter.restoreCursor(cursor.cursor,cursor.cursor_version),signal:signal??new AbortController().signal,requestCounter:counter,requestGate:budget},mappingVersionId:report.active_mapping_uuid!,partialErrorCodes:['request_budget_exhausted','aborted','quota_deferred']});
          traversalId=outcome.traversalId;pagesCompleted+=1;if(!outcome.result.complete)continue;
          const persisted=(await pool.query('select complete,status from provider_acquisition_traversals where id=$1',[traversalId])).rows[0];if(persisted?.complete!==true||!['complete','empty_confirmed'].includes(String(persisted.status)))throw new Error('traversal_completeness_not_persisted');
          try{const publication=await this.handoff.handoffTraversal(traversalId);return {status:'completed' as const,traversal_id:traversalId,provider_championship_id:target.providerChampionshipId,stream_id:target.streamId,provider_requests_budget:budget.limit,provider_requests_emitted:budget.emitted,provider_requests_remaining:budget.remaining,pages_completed:pagesCompleted,handoff:publication};}catch(error){return {status:'handoff_error' as const,traversal_id:traversalId,provider_championship_id:target.providerChampionshipId,stream_id:target.streamId,provider_requests_budget:budget.limit,provider_requests_emitted:budget.emitted,provider_requests_remaining:budget.remaining,pages_completed:pagesCompleted,error:safeError(error)};}
        }catch(error){traversalId=traversalId??(error as {traversalId?:string}).traversalId;const code=(error as {code?:string}).code;if(code==='request_budget_exhausted'||code==='aborted')return {status:code==='aborted'?'cancelled' as const:'budget_exhausted' as const,traversal_id:traversalId??null,provider_championship_id:target.providerChampionshipId,stream_id:target.streamId,provider_requests_budget:budget.limit,provider_requests_emitted:budget.emitted,provider_requests_remaining:budget.remaining,pages_completed:pagesCompleted,next_page_or_cursor:cursor.cursor};return {status:'provider_error' as const,traversal_id:traversalId??null,provider_championship_id:target.providerChampionshipId,stream_id:target.streamId,provider_requests_budget:budget.limit,provider_requests_emitted:budget.emitted,provider_requests_remaining:budget.remaining,pages_completed:pagesCompleted,error:safeError(error)};}
      }
    }finally{signal?.removeEventListener('abort',abort);}
  }
}
