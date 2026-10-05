import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {pool} from '../src/lib/db.js';
import {AcquisitionTransactionService} from '../src/providers/acquisitionTransactionService.js';
import {PersistentSchedulerService} from '../src/providers/schedulerService.js';
import {handoffKey,readHandoffEnvelope} from '../src/providers/canonicalHandoffState.js';
import {BoundedProviderOneShotRunner} from '../src/providers/providerOneShotRunner.js';
import type {ProviderConfigurationService} from '../src/providers/providerService.js';
import {CanonicalAcquisitionPublicationService} from '../src/normalization/canonicalAcquisitionPublicationService.js';
import {PostgresNormalizationMappingRepository} from '../src/normalization/postgresNormalizationMappingRepository.js';
import type {AcquiredProviderSourceItem,JsonObject,ProviderAdapter} from '../src/providers/contracts.js';

const suite=process.env.RUN_R1_A1_HANDOFF_POSTGRES==='1'?describe:describe.skip;
suite('R1-A1 durable offline handoff',()=>{
  let provider:string,link:string,stream:string,historical:string,champ:string,season:string,circuit:string,mapping:string;
  const scheduler=new PersistentSchedulerService(),acquisition=new AcquisitionTransactionService(scheduler);
  const noNetwork=vi.fn(()=>{throw new Error('external transport forbidden');});
  const context={principal:{sub:'r1a1-fixture',role:'admin' as const,exp:2147483647,auth_method:'technical_hmac' as const},requestId:randomUUID()};
  beforeAll(()=>{
    const url=new URL(process.env.DATABASE_URL??'');
    if(url.hostname!=='127.0.0.1'||url.pathname!=='/r1a1_gate')throw new Error('r1a1_disposable_context_required');
    vi.stubGlobal('fetch',noNetwork);
  });
  afterAll(async()=>{expect(noNetwork).not.toHaveBeenCalled();vi.unstubAllGlobals();await pool.end();});
  beforeEach(async()=>{
    provider=randomUUID();link=randomUUID();stream=randomUUID();historical=randomUUID();season=randomUUID();circuit=randomUUID();champ=`r1a1-${randomUUID()}`;
    const venue=randomUUID(),layout=randomUUID(),sourceLink=randomUUID();
    await pool.query("insert into championships(id,slug,name,season,active) values($1,$1,'R1 fixture',2026,true)",[champ]);
    await pool.query("insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,$2,'2026','2026',2026,2026)",[season,champ]);
    await pool.query("insert into venues(id,key,name,kind_key,timezone) values($1::uuid,$1::text,'R1 venue','circuit','UTC')",[venue]);
    await pool.query("insert into venue_layouts(id,venue_id,key,name) values($1,$2,'gp','GP')",[layout,venue]);
    await pool.query("insert into circuits(id,name,country_code,timezone) values($1,'R1 circuit','FR','UTC')",[circuit]);
    await pool.query('insert into circuit_venue_links(circuit_id,venue_id,venue_layout_id) values($1,$2,$3)',[circuit,venue,layout]);
    await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state) values($1::uuid,'r1-fixture','R1 fixture '||$1::text,true,'active')",[provider]);
    await pool.query("insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values($1,$2,$3,'r1','active',true)",[link,provider,champ]);
    await pool.query("insert into provider_championship_source_configs(provider_championship_id,schema_version,config) values($1,1,'{}')",[link]);
    await pool.query("insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor,historical_state,current_window_year) values($1,$3,'current','ready',1,'{}','{\"sentinel\":true}',2026),($2,$3,'historical','ready',1,'{}','{\"recent_catchup_queue\":[{\"year\":2025}]}',2026)",[stream,historical,link]);
    await pool.query("insert into provider_acquisition_state(provider_championship_id,bootstrap_state,recent_catchup_state,deep_history_state) values($1,'complete','complete','complete')",[link]);
    await pool.query("insert into championship_source_links(id,provider_instance_id,external_championship_id,championship_id,created_by) values($1,$2,'r1',$3,'fixture')",[sourceLink,provider,champ]);
    await pool.query("insert into championship_season_source_links(id,championship_source_link_id,provider_instance_id,external_championship_id,external_season_id,championship_id,championship_season_id,created_by) values($1,$2,$3,'r1','2026',$4,$5,'fixture')",[randomUUID(),sourceLink,provider,champ,season]);
    mapping=(await new PostgresNormalizationMappingRepository().createAndActivateMappingVersion({providerChampionshipId:link,versionLabel:'r1',rulesVersion:'r1',actor:'fixture',mappingDocument:{championshipIds:{r1:champ},circuitIds:{r1:circuit},sessionTypes:{race:'race'},statuses:{scheduled:'scheduled'}}})).id;
    await pool.query("update publication_controls set enabled=true where control_key='promotion'");
  });
  const sources=(review=false):AcquiredProviderSourceItem[]=>[{entityKind:'meeting',externalId:'meeting',identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season:2026,sourceData:{name:'R1 meeting',external_season_id:review?'missing':'2026',circuit_id:'r1',status:'scheduled',round:'1',starts_at:'2026-12-06T12:00:00Z',ends_at:'2026-12-06T16:00:00Z'}}];
  async function acquire(options:{review?:boolean;phase?:'current'|'historical';fail?:boolean;partial?:boolean;unbound?:boolean;rename?:boolean}={}){
    const id=options.phase==='historical'?historical:stream;
    const lease=await scheduler.acquire('r1-test',{streamId:id});expect(lease).not.toBeNull();
    const fetchWorkUnit=vi.fn(async()=>({status:options.partial?'progress' as const:'complete' as const,items:sources(options.review).map(item=>options.rename?{...item,sourceRevision:2,sourceData:{...item.sourceData,name:'R1 renamed'}}:item),itemAnomalies:[],nextCursor:{page:2},requestCount:0,complete:!options.partial,completionReason:options.partial?null:'end_of_collection' as const}));
    const output=await acquisition.executeUnit({providerInstanceId:provider,providerChampionshipId:link,season:2026,workClass:'current_global',safeUnitKey:randomUUID(),lease:{streamId:id,runId:lease!.run_id,workerId:'r1-test',generation:lease!.lease_generation},adapter:{fetchWorkUnit} as unknown as ProviderAdapter<JsonObject,JsonObject,JsonObject,AcquiredProviderSourceItem>,fetchInput:{providerInstanceId:provider,providerChampionshipId:link,championshipId:champ,providerConfig:{},credentials:{},sourceConfig:{},phase:options.phase??'current',season:2026,cursor:{},signal:new AbortController().signal},mappingVersionId:options.unbound?undefined:mapping,afterPersist:options.fail?async()=>{throw new Error('crash before final commit');}:undefined});
    return {output,fetchWorkUnit};
  }
  async function entry(id:string,streamId=stream){return readHandoffEnvelope((await pool.query('select historical_state from sync_streams where id=$1',[streamId])).rows[0].historical_state).traversals[id];}
  async function counts(){return (await pool.query(`select (select count(*) from meetings where championship_id=$1)::int canonical,(select count(*) from public_resource_versions where championship_id=$1)::int versions,(select count(*) from public_resource_states where championship_id=$1)::int states,(select count(*) from normalization_decisions where source_entity_id in(select id from provider_source_entities where provider_championship_id=$2))::int decisions,(select count(*) from meeting_source_contributions where source_entity_id in(select id from provider_source_entities where provider_championship_id=$2))::int contributions,(select count(*) from public_change_log where resource_id in(select id from meetings where championship_id=$1))::int changes`,[champ,link])).rows[0];}
  const recover=(service=new CanonicalAcquisitionPublicationService(),id=stream)=>service.recoverPendingHandoff(new Date('2026-10-05T12:00:00Z'),id);

  async function reconciliationFixture(review=true){
    await acquire();expect(await recover()).toMatchObject({state:'DONE'});
    const meeting=(await pool.query('select id from meetings where championship_id=$1',[champ])).rows[0].id;
    const otherProvider=randomUUID(),otherLink=randomUUID(),otherSource=randomUUID(),policy=randomUUID();
    await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'r1-review-other',$2,true,'active')",[otherProvider,otherProvider]);
    await pool.query("insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state) values($1,$2,$3,'r1-review-other','inactive')",[otherLink,otherProvider,champ]);
    await pool.query("insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting','other',2026,'{}',$4,now(),now(),now())",[otherSource,otherProvider,otherLink,'a'.repeat(64)]);
    await pool.query("insert into meeting_source_links(source_entity_id,meeting_id,normalization_version,linked_at) values($1,$2,'r1-review',now())",[otherSource,meeting]);
    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_updated_at,source_revision)
      select $1,$2,$2,meeting_id,normalization_version,$3,$4,jsonb_set(normalized_values,'{startsAt}','"2026-12-07T12:00:00Z"'),structural_references,now(),now(),now(),1 from meeting_source_contributions where meeting_id=$5 limit 1`,[randomUUID(),otherSource,'a'.repeat(64),'b'.repeat(64),meeting]);
    await pool.query("insert into reconciliation_policies(id,championship_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id) values($1,$2,'meeting',1,'draft',$3,$4,$3,'r1-review-fixture')",[policy,champ,'c'.repeat(64),randomUUID()]);
    await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority,schedule_tolerance_seconds) values($1,$2,$3,$4,$5::jsonb,0)`,[randomUUID(),policy,review?'startsAt':'name',review?'SCHEDULE':'DISPLAY',JSON.stringify(review?[['r1-fixture','r1-review-other']]:[['r1-fixture'],['r1-review-other']])]);
    await pool.query("update reconciliation_policies set status='active',activated_at=now() where id=$1",[policy]);
    const acquired=await acquire({rename:true});
    const snapshot=async()=>({canonical:(await pool.query('select * from meetings where id=$1',[meeting])).rows,public:(await pool.query("select * from public_resource_states where resource_type='meeting' and resource_id=$1",[meeting])).rows,versions:(await pool.query("select * from public_resource_versions where resource_type='meeting' and resource_id=$1 order by revision",[meeting])).rows,changes:(await pool.query("select * from public_change_log where resource_type='meeting' and resource_id=$1 order by sequence",[meeting])).rows});
    const evidence=async()=>(await pool.query(`select (select count(*) from reconciliation_runs where entity_uuid=$1 and outcome='review_required')::int reviews,(select count(*) from reconciliation_field_decisions decision join reconciliation_runs run on run.id=decision.run_id where run.entity_uuid=$1 and decision.outcome='review_required')::int decisions,(select count(*) from reconciliation_conflicts where entity_uuid=$1 and status='REVIEW_REQUIRED')::int conflicts`,[meeting])).rows[0];
    return {...acquired,meeting,snapshot,evidence};
  }

  it.each([false,true])('ordinary handoff never reexecutes a terminal traversal (normalization review=%s)',async review=>{
    const {output,fetchWorkUnit}=await acquire({review}),service=new CanonicalAcquisitionPublicationService();
    await service.handoffTraversal(output.traversalId);const before=await counts(),terminal=await entry(output.traversalId),checkpoints=(await pool.query('select * from normalization_checkpoints where scope_key like $1',[`provider-championship:${link}:%`])).rows;
    const spy=vi.spyOn(service.normalization,'normalizeUnitInTransaction');
    expect(await service.handoffTraversal(output.traversalId)).toMatchObject({status:'already_terminal',handoff_state:review?'DONE_WITH_REVIEW':'DONE'});
    expect(spy).not.toHaveBeenCalled();spy.mockRestore();expect(await counts()).toEqual(before);expect(await entry(output.traversalId)).toEqual(terminal);expect((await pool.query('select * from normalization_checkpoints where scope_key like $1',[`provider-championship:${link}:%`])).rows).toEqual(checkpoints);expect(fetchWorkUnit).toHaveBeenCalledTimes(1);
  });

  it.each(['recovery','ordinary'] as const)('executes exactly once when %s wins the recovery/ordinary race',async first=>{
    const {output}=await acquire(),service=new CanonicalAcquisitionPublicationService();
    let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;}),wait=new Promise<void>(resolve=>{release=resolve;});
    const real=service.normalization.normalizeUnitInTransaction.bind(service.normalization);let executions=0;
    const spy=vi.spyOn(service.normalization,'normalizeUnitInTransaction').mockImplementation(async(...args)=>{executions++;if(executions===1){entered();await wait;}return real(...args);});
    const winner=first==='recovery'?recover(service):service.handoffTraversal(output.traversalId);await started;
    const follower=first==='recovery'?service.handoffTraversal(output.traversalId):recover(service);release();
    const results=await Promise.all([winner,follower]);
    expect(executions).toBe(1);expect(results[1]).toEqual(first==='recovery'?{traversal_id:output.traversalId,status:'already_terminal',handoff_state:'DONE'}:null);
    expect((await entry(output.traversalId)).attempts).toBe(1);expect((await counts()).changes).toBe(1);spy.mockRestore();
  });

  it('the actual one-shot runner uses ordinary terminal protection after another process closes handoff',async()=>{
    const {output,fetchWorkUnit}=await acquire();await recover();const before=await counts();
    const providers={registry:{get:vi.fn(()=>({restoreCursor:()=>({})}))},readSecretForAdapter:vi.fn(async()=> 'synthetic-fixture-only'),get:vi.fn(async()=>({config:{}}))} as unknown as ProviderConfigurationService;
    const runner=new BoundedProviderOneShotRunner(providers);
    vi.spyOn(runner,'preflight').mockResolvedValue({status:'preflight_ok',execution_ready:true,adapter_key:'r1-fixture',canonical_championship_id:champ,effective_mapping_uuid:mapping} as Awaited<ReturnType<typeof runner.preflight>>);
    vi.spyOn(runner.scheduler,'acquire').mockResolvedValue({stream:{cursor:{},cursor_version:1},run_id:randomUUID(),lease_generation:1} as Awaited<ReturnType<typeof runner.scheduler.acquire>>);
    // Only acquisition is simulated: runner.run invokes the real guarded handoff.
    const acquireSpy=vi.spyOn(runner.orchestrator,'executeLease').mockResolvedValue({...output,workClass:'current_global',season:2026});
    const execution=vi.spyOn(runner.handoff.normalization,'normalizeUnitInTransaction');
    expect(await runner.run({providerInstanceId:provider,providerChampionshipId:link,streamId:stream,maxProviderRequests:1,preflight:false})).toMatchObject({status:'completed',provider_requests_emitted:0,handoff:{status:'already_terminal',handoff_state:'DONE'}});
    expect(acquireSpy).toHaveBeenCalledTimes(1);expect(execution).not.toHaveBeenCalled();expect(fetchWorkUnit).toHaveBeenCalledTimes(1);expect(await counts()).toEqual(before);
    vi.restoreAllMocks();
  });

  it('persists real reconciliation review evidence and terminal review without unsafe publication or provider retry',async()=>{
    const fixture=await reconciliationFixture(),before=await fixture.snapshot(),service=new CanonicalAcquisitionPublicationService();
    expect(await recover(service)).toMatchObject({state:'DONE_WITH_REVIEW',error_code:null,result:{status:'review_required',candidates_review:1}});
    expect(await fixture.evidence()).toEqual({reviews:1,decisions:1,conflicts:1});expect(await fixture.snapshot()).toEqual(before);
    const execution=vi.spyOn(service.reconciliation,'reconcileLinkedInTransaction');
    expect(await recover(service)).toBeNull();expect(await service.handoffTraversal(fixture.output.traversalId)).toMatchObject({status:'already_terminal',handoff_state:'DONE_WITH_REVIEW'});expect(execution).not.toHaveBeenCalled();execution.mockRestore();expect(fixture.fetchWorkUnit).toHaveBeenCalledTimes(1);
  });

  it('rolls back real reconciliation/publication writes on a technical exception and retains offline backoff',async()=>{
    const fixture=await reconciliationFixture(false),before=await fixture.snapshot(),metadata=await counts(),service=new CanonicalAcquisitionPublicationService();
    const real=service.reconciliation.reconcileLinkedInTransaction.bind(service.reconciliation);
    const failure=vi.spyOn(service.reconciliation,'reconcileLinkedInTransaction').mockImplementation(async(...args)=>{const result=await real(...args);expect(result.outcome).toBe('applied');throw new Error('genuine technical failure after reconciliation/publication writes');});
    expect(await recover(service)).toMatchObject({state:'HANDOFF_BACKOFF',error_code:'handoff_technical_failure',result:null});failure.mockRestore();
    expect(await fixture.snapshot()).toEqual(before);expect(await counts()).toEqual(metadata);expect(await fixture.evidence()).toEqual({reviews:0,decisions:0,conflicts:0});expect((await entry(fixture.output.traversalId)).state).toBe('HANDOFF_BACKOFF');
    expect(await recover(service)).toMatchObject({state:'DONE'});expect(fixture.fetchWorkUnit).toHaveBeenCalledTimes(1);
  });

  it('atomically commits completeness and pending; a fresh service resumes offline and terminal is not reselected',async()=>{
    const {output,fetchWorkUnit}=await acquire(),id=output.traversalId;
    expect(await entry(id)).toMatchObject({state:'HANDOFF_PENDING',attempts:0});
    expect((await pool.query('select complete from provider_acquisition_traversals where id=$1',[id])).rows[0].complete).toBe(true);
    expect(await recover()).toMatchObject({traversal_id:id,state:'DONE'});
    expect(await entry(id)).toMatchObject({state:'DONE',attempts:1});
    expect(await recover()).toBeNull();expect(fetchWorkUnit).toHaveBeenCalledTimes(1);
    const before=await counts();expect(before).toMatchObject({canonical:1,versions:1,states:1,changes:1});
    const service=new CanonicalAcquisitionPublicationService(),spy=vi.spyOn(service.normalization,'normalizeUnitInTransaction');
    expect(await service.handoffTraversal(id)).toMatchObject({status:'already_terminal',handoff_state:'DONE'});expect(spy).not.toHaveBeenCalled();spy.mockRestore();
    expect(await counts()).toEqual(before);
  });
  it('discovers acquisition committed by the previous process using a fresh offline process',async()=>{
    const {output,fetchWorkUnit}=await acquire();
    const script="import {CanonicalAcquisitionPublicationService} from './dist/normalization/canonicalAcquisitionPublicationService.js';import {pool} from './dist/lib/db.js';const result=await new CanonicalAcquisitionPublicationService().recoverPendingHandoff(new Date(),process.argv[1]);console.log(JSON.stringify(result));await pool.end();";
    const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script,stream],{cwd:process.cwd()});
    expect(JSON.parse(stdout)).toMatchObject({traversal_id:output.traversalId,state:'DONE'});expect(fetchWorkUnit).toHaveBeenCalledTimes(1);
  });
  it('rolls back public work if terminal state persistence fails and resumes offline',async()=>{
    const {output}=await acquire(),before=await counts();
    await pool.query(`create function r1a1_fail_terminal() returns trigger language plpgsql as $$ begin if new.id='${stream}'::uuid and new.historical_state->'canonical_handoff_v1'->'traversals'->'${output.traversalId}'->>'state'='DONE' then raise exception 'synthetic crash at terminal persistence'; end if; return new; end $$`);
    await pool.query('create trigger r1a1_fail_terminal before update on sync_streams for each row execute function r1a1_fail_terminal()');
    try{expect(await recover()).toMatchObject({state:'HANDOFF_BACKOFF'});expect(await counts()).toEqual(before);}finally{await pool.query('drop trigger r1a1_fail_terminal on sync_streams');await pool.query('drop function r1a1_fail_terminal()');}
    expect(await recover()).toMatchObject({state:'DONE'});
  });
  it('rolls back completeness, observations and pending if the final acquisition transaction fails',async()=>{
    await expect(acquire({fail:true})).rejects.toThrow('crash before final commit');
    const row=(await pool.query('select id,complete from provider_acquisition_traversals where stream_id=$1',[stream])).rows[0];
    expect(row.complete).toBe(false);expect((await entry(row.id)).state).toBe('ACQUIRING');expect(await recover()).toBeNull();
    expect((await pool.query('select count(*)::int n from provider_source_entities where provider_championship_id=$1',[link])).rows[0].n).toBe(0);
  });
  it('makes review terminal without a provider retry',async()=>{
    const {output,fetchWorkUnit}=await acquire({review:true});
    expect(await recover()).toMatchObject({state:'DONE_WITH_REVIEW',result:{candidates_review:1}});
    expect((await entry(output.traversalId)).state).toBe('DONE_WITH_REVIEW');expect(await counts()).toMatchObject({canonical:0,decisions:1});
    expect((await pool.query("select count(*)::int n from normalized_candidates candidate join provider_source_entities source on source.id=candidate.source_entity_id where source.provider_championship_id=$1 and candidate.resolution_state='REVIEW_REQUIRED'",[link])).rows[0].n).toBe(1);
    expect(await recover()).toBeNull();expect(fetchWorkUnit).toHaveBeenCalledTimes(1);
  });
  it.each(['normalization','publication'] as const)('retains offline retry state after %s failure and rolls back partial canonical work',async stage=>{
    const {output,fetchWorkUnit}=await acquire(),service=new CanonicalAcquisitionPublicationService(),before=await counts();
    const spy=stage==='normalization'?vi.spyOn(service.normalization,'normalizeUnitInTransaction').mockRejectedValue(new Error('technical failure')):vi.spyOn(service.publication,'publishCandidateInTransaction').mockImplementation(async()=>{await pool.query('select 1');throw new Error('technical failure');});
    expect(await recover(service)).toMatchObject({state:'HANDOFF_BACKOFF',error_code:'handoff_technical_failure'});spy.mockRestore();
    expect(await counts()).toEqual(before);expect((await entry(output.traversalId)).attempts).toBe(1);
    expect(await recover()).toMatchObject({state:'DONE'});expect(fetchWorkUnit).toHaveBeenCalledTimes(1);
  });
  it('keeps a publication kill switch deferred and supports explicit audited offline resume',async()=>{
    const {output}=await acquire(),service=new CanonicalAcquisitionPublicationService();
    await pool.query("update publication_controls set enabled=false where control_key='promotion'");
    expect(await recover(service)).toMatchObject({state:'HANDOFF_PAUSED',result:{status:'deferred',candidates_deferred:1}});
    expect((await counts()).versions).toBe(0);expect(await recover()).toBeNull();
    await pool.query("update publication_controls set enabled=true where control_key='promotion'");
    await service.resolveHandoff({traversalId:output.traversalId,action:'resume',actor:'fixture',requestId:randomUUID(),expectedAttempts:1,reason:'Synthetic promotion enabled'});
    expect(await recover()).toMatchObject({state:'DONE'});
  });
  it('blocks conflicting current and historical selection and a previously leased acquisition commit',async()=>{
    await pool.query('update provider_instances set max_concurrency=2 where id=$1',[provider]);
    const other=await scheduler.acquire('old-historical',{streamId:historical});expect(other).not.toBeNull();
    const {output}=await acquire();const before=await counts();
    expect(await scheduler.acquire('blocked',{streamId:stream})).toBeNull();expect(await scheduler.acquire('blocked',{streamId:historical})).toBeNull();
    await expect(scheduler.commit({streamId:historical,runId:other!.run_id,workerId:'old-historical',generation:other!.lease_generation,cursorAfter:{},apply:async client=>{await client.query("update provider_source_entities set source_hash='replaced' where provider_championship_id=$1",[link]);}})).rejects.toMatchObject({code:'canonical_handoff_pending'});
    expect(await counts()).toEqual(before);expect((await entry(output.traversalId)).state).toBe('HANDOFF_PENDING');
  });
  it('allows only one valid concurrent recovery and prevents terminal reselection',async()=>{
    const {output}=await acquire();const results=await Promise.all([recover(),recover()]);expect(results.filter(Boolean)).toHaveLength(1);
    expect((await entry(output.traversalId)).attempts).toBe(1);expect((await counts()).changes).toBe(1);
  });
  it('preserves pending through resume/disable/activate/queue writers and rejects reset in both phases',async()=>{
    const {output}=await acquire();const before=await entry(output.traversalId);
    await scheduler.pause(link,context);await scheduler.resume(link,context);await scheduler.deactivate(link,context);await scheduler.activate(link,context);
    await scheduler.resyncSeason(link,2025,context);await scheduler.rebuildHistory(link,2024,context);await scheduler.resumeHistory(link,context);
    await scheduler.setChampionshipActive(link,false,context);await scheduler.setChampionshipActive(link,true,context);
    expect(await entry(output.traversalId)).toEqual(before);
    await expect(scheduler.reset(link,'current',context)).rejects.toMatchObject({code:'canonical_handoff_pending'});
    await expect(scheduler.reset(link,'historical',context)).rejects.toMatchObject({code:'canonical_handoff_pending'});
  });
  it('preserves terminal envelopes through historical replacement and both stream phases',async()=>{
    const {output}=await acquire({phase:'historical'});expect(await recover(undefined,historical)).toMatchObject({state:'DONE'});
    const before=await entry(output.traversalId,historical);await scheduler.reset(link,'historical',context);expect(await entry(output.traversalId,historical)).toEqual(before);
    const lease=await scheduler.acquire('replacement',{streamId:historical});expect(lease).not.toBeNull();
    await scheduler.commit({streamId:historical,runId:lease!.run_id,workerId:'replacement',generation:lease!.lease_generation,cursorAfter:{},historicalStateAfter:{replacement:true,[handoffKey]:{malicious:true}}});
    expect(await entry(output.traversalId,historical)).toEqual(before);
  });
  it('persists unbound traversal as permanently blocked and requires explicit audited abandonment',async()=>{
    const {output}=await acquire({unbound:true});
    expect(await recover()).toMatchObject({state:'HANDOFF_BLOCKED',error_code:'traversal_unbound'});expect(await recover()).toBeNull();
    const service=new CanonicalAcquisitionPublicationService();await service.resolveHandoff({traversalId:output.traversalId,action:'abandon',actor:'fixture',requestId:randomUUID(),expectedAttempts:1,reason:'Explicit synthetic discard; no publication claimed'});
    expect((await entry(output.traversalId)).state).toBe('ABANDONED');expect((await counts()).canonical).toBe(0);expect(await recover()).toBeNull();
    expect(await scheduler.acquire('after-explicit-resolution',{streamId:stream})).not.toBeNull();
  });
});
